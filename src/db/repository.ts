import { and, eq, isNull, lte, sql, asc, desc, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { services, meals, payments, paymentItems } from "./schema";
import { serviceSchema, mealSchema, daySchema, uuid, type ServiceInput, type MealInput } from "@/lib/domain";
import type { Meal, Snapshot } from "@/lib/types";
import type { ExpectedMeal } from "@/lib/types";
import { z } from "zod";
import { UserError } from "@/lib/errors";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
const stale = "This entry changed on another screen. Refresh and try again.";

export class Repository {
  constructor(private db: Database, private owner: string) {}

  private async lockService(tx: Transaction, id: string) {
    const [service] = await tx.select().from(services).where(and(eq(services.id, id), eq(services.owner, this.owner))).for("update");
    if (!service) throw new UserError("Food service not found.");
    return service;
  }

  async snapshot(): Promise<Snapshot> {
    // A single repeatable-read snapshot keeps totals consistent with their payment history.
    return this.db.transaction(async tx => {
      const serviceRows = await tx.select().from(services).where(eq(services.owner, this.owner)).orderBy(asc(services.name));
      const mealRows = await tx.select({ meal: meals }).from(meals).innerJoin(services, eq(meals.serviceId, services.id)).where(eq(services.owner, this.owner)).orderBy(asc(meals.day));
      const paymentRows = await tx.select({ payment: payments }).from(payments).innerJoin(services, eq(payments.serviceId, services.id)).where(eq(services.owner, this.owner)).orderBy(desc(payments.createdAt));
      const items = await tx.select({ paymentId: paymentItems.paymentId }).from(paymentItems).innerJoin(payments, eq(paymentItems.paymentId, payments.id)).innerJoin(services, eq(payments.serviceId, services.id)).where(eq(services.owner, this.owner));
      const counts = new Map<string, number>();
      for (const item of items) counts.set(item.paymentId, (counts.get(item.paymentId) ?? 0) + 1);
      return {
        services: serviceRows.map(({ owner: _owner, ...service }) => { void _owner; return service; }),
        meals: mealRows.map(({ meal }) => ({ ...meal, kind: meal.kind as Meal["kind"] })),
        payments: paymentRows.map(({ payment }) => ({ ...payment, createdAt: payment.createdAt.toISOString(), reversedAt: payment.reversedAt?.toISOString() ?? null, mealCount: counts.get(payment.id) ?? 0 })),
      };
    }, { isolationLevel: "repeatable read", accessMode: "read only" });
  }

  async saveService(raw: ServiceInput) {
    const input = serviceSchema.parse(raw);
    await this.db.transaction(async tx => {
      const { version, ...values } = input;
      if (version === 0) {
        await tx.insert(services).values({ ...values, owner: this.owner, version: 1 });
      } else {
        const current = await this.lockService(tx, input.id);
        if (current.version !== version) throw new UserError(stale);
        await tx.update(services).set({ ...values, version: version + 1 }).where(eq(services.id, input.id));
      }
    });
  }

  async saveMeal(raw: MealInput) {
    const input = mealSchema.parse(raw);
    await this.db.transaction(async tx => {
      const service = await this.lockService(tx, input.serviceId);
      if (service.archived) throw new UserError("Restore this service before recording meals.");
      const [current] = await tx.select().from(meals).where(eq(meals.id, input.id));
      if (current) {
        if (current.serviceId !== input.serviceId || current.day !== input.day || current.kind !== input.kind) throw new UserError("Meal identity cannot be changed.");
        if (current.version !== input.version) throw new UserError(stale);
        if (current.paymentId) throw new UserError("Reverse the payment before changing this meal.");
        await tx.update(meals).set({ label: input.label, amount: input.amount, version: current.version + 1 }).where(eq(meals.id, input.id));
      } else {
        if (input.version !== 0) throw new UserError(stale);
        if (input.kind !== "custom") {
          const [slot] = await tx.select().from(meals).where(and(eq(meals.serviceId, input.serviceId), eq(meals.day, input.day), eq(meals.kind, input.kind)));
          if (slot) throw new UserError(stale);
        }
        await tx.insert(meals).values({ ...input, version: 1 });
      }
    });
  }

  async deleteMeal(serviceId: string, mealId: string, version: number) {
    uuid.parse(serviceId); uuid.parse(mealId);
    await this.db.transaction(async tx => {
      await this.lockService(tx, serviceId);
      const [meal] = await tx.select().from(meals).where(and(eq(meals.id, mealId), eq(meals.serviceId, serviceId)));
      if (!meal || meal.version !== version) throw new UserError(stale);
      if (meal.paymentId) throw new UserError("Reverse the payment before removing this meal.");
      await tx.delete(meals).where(eq(meals.id, meal.id));
    });
  }

  async pay(serviceId: string, cutoff: string, requestId: string, expected: ExpectedMeal[], mealId?: string) {
    uuid.parse(serviceId); daySchema.parse(cutoff); uuid.parse(requestId);
    if (mealId) uuid.parse(mealId);
    z.array(z.object({ id: uuid, version: z.number().int().positive() })).min(1).max(10000).parse(expected);
    const expectedVersions = new Map(expected.map(meal => [meal.id, meal.version]));
    if (expectedVersions.size !== expected.length) throw new UserError("Payment contains duplicate meal entries.");
    return this.db.transaction(async tx => {
      await this.lockService(tx, serviceId);
      const [existing] = await tx.select().from(payments).where(eq(payments.requestId, requestId));
      if (existing) {
        const existingItems = await tx.select().from(paymentItems).where(eq(paymentItems.paymentId, existing.id));
        if (existing.serviceId !== serviceId || existing.cutoff !== cutoff || existingItems.length !== expected.length || existingItems.some(item => !expectedVersions.has(item.mealId)) || (mealId && (existingItems.length !== 1 || existingItems[0].mealId !== mealId))) throw new UserError("Payment request does not match its original operation.");
        if (existing.reversedAt) throw new UserError("This payment was reversed. Refresh before recording a new payment.");
        return existing.id;
      }
      const entries = await tx.select().from(meals).where(and(eq(meals.serviceId, serviceId), isNull(meals.paymentId), lte(meals.day, cutoff), mealId ? eq(meals.id, mealId) : undefined)).orderBy(asc(meals.day)).for("update");
      if (!entries.length) throw new UserError("There are no unpaid meals to settle. Refresh your balances.");
      if (entries.length !== expected.length || entries.some(entry => expectedVersions.get(entry.id) !== entry.version)) throw new UserError("These meals changed after you reviewed the payment. Refresh and confirm the new balance.");
      const id = crypto.randomUUID();
      const total = entries.reduce((sum, meal) => sum + meal.amount, 0);
      if (!Number.isSafeInteger(total) || total > 2147483647) throw new UserError("Balance is too large to settle in one payment. Mark individual meals paid.");
      await tx.insert(payments).values({ id, requestId, serviceId, amount: total, cutoff });
      await tx.insert(paymentItems).values(entries.map(meal => ({ id: crypto.randomUUID(), paymentId: id, mealId: meal.id, day: meal.day, label: meal.label, amount: meal.amount })));
      await tx.update(meals).set({ paymentId: id, version: sql`${meals.version} + 1` }).where(and(eq(meals.serviceId, serviceId), inArray(meals.id, entries.map(meal => meal.id))));
      return id;
    });
  }

  async reverse(serviceId: string, paymentId: string) {
    uuid.parse(serviceId); uuid.parse(paymentId);
    await this.db.transaction(async tx => {
      await this.lockService(tx, serviceId);
      const [payment] = await tx.select().from(payments).where(and(eq(payments.id, paymentId), eq(payments.serviceId, serviceId))).for("update");
      if (!payment) throw new UserError("Payment not found.");
      if (payment.reversedAt) return;
      await tx.update(meals).set({ paymentId: null, version: sql`${meals.version} + 1` }).where(and(eq(meals.serviceId, serviceId), eq(meals.paymentId, paymentId)));
      await tx.update(payments).set({ reversedAt: new Date() }).where(eq(payments.id, paymentId));
    });
  }
}
