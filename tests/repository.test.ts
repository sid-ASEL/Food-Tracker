import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { readFile, readdir } from "node:fs/promises";
import * as schema from "@/db/schema";
import { Repository } from "@/db/repository";
import { Accounts } from "@/db/accounts";
import { balances, type MealInput, type ServiceInput } from "@/lib/domain";

const pg = new PGlite();
for (const file of (await readdir("migrations")).filter(f => f.endsWith(".sql")).sort()) await pg.exec(await readFile(`migrations/${file}`, "utf8"));
// The same Drizzle Postgres query builder runs against isolated embedded Postgres.
const db = drizzle(pg, { schema }) as unknown as NodePgDatabase<typeof schema>;
const repo = new Repository(db, "owner@gmail.com");
const stranger = new Repository(db, "other@gmail.com");
let service: ServiceInput;
function entry(day = "2026-10-02", kind: MealInput["kind"] = "lunch", amount = 8000): MealInput {
  return { id: crypto.randomUUID(), serviceId: service.id, day, kind, label: kind === "custom" ? "Snacks" : kind, amount, version: 0 };
}
async function expected(mealId?: string, cutoff = "2026-10-31") {
  return (await repo.snapshot()).meals.filter(m => m.serviceId === service.id && !m.paymentId && m.day <= cutoff && (!mealId || m.id === mealId)).map(m => ({ id: m.id, version: m.version }));
}
beforeEach(async () => {
  await pg.exec("TRUNCATE accounts, payment_items, meals, payments, services CASCADE");
  service = { id: crypto.randomUUID(), name: "Amma’s Kitchen", category: "Tiffin", phone: "9876543210", breakfast: 4000, lunch: 8000, dinner: 7000, archived: false, version: 0 };
  await repo.saveService(service);
});
afterAll(async () => { await pg.close(); });

describe("persistent meal and payment flow", () => {
  it("records standard and custom meals, overrides amounts, and preserves historical prices", async () => {
    const lunch = entry();
    await repo.saveMeal(lunch);
    await repo.saveMeal(entry("2026-10-02", "custom", 12345));
    await repo.saveMeal(entry("2026-10-02", "custom", 0));
    await repo.saveMeal({ ...lunch, amount: 8500, version: 1 });
    await repo.saveService({ ...service, lunch: 15000, version: 1 });
    const data = await new Repository(db, "owner@gmail.com").snapshot();
    expect(data.meals).toHaveLength(3);
    expect(data.meals.find(m => m.id === lunch.id)?.amount).toBe(8500);
    expect(balances(data.meals, service.id, "2026-10").charges).toBe(20845);
    expect(data.services[0].lunch).toBe(15000);
    await expect(repo.saveMeal(entry())).rejects.toThrow("changed");
  });
  it("settles individual meals, bulk arrears, retries idempotently, and reverses history", async () => {
    const sept = entry("2026-09-30"); const oct = entry(); const future = entry("2026-11-01");
    await repo.saveMeal(sept); await repo.saveMeal(oct); await repo.saveMeal(future);
    const singleExpected = await expected(oct.id);
    const singleRequest = crypto.randomUUID();
    const single = await repo.pay(service.id, oct.day, singleRequest, singleExpected, oct.id);
    expect(await repo.pay(service.id, oct.day, singleRequest, singleExpected, oct.id)).toBe(single);
    const bulkExpected = await expected();
    const request = crypto.randomUUID();
    const bulk = await repo.pay(service.id, "2026-10-31", request, bulkExpected);
    expect(await repo.pay(service.id, "2026-10-31", request, bulkExpected)).toBe(bulk);
    let data = await repo.snapshot();
    expect(data.payments).toHaveLength(2);
    expect(data.meals.find(m => m.id === future.id)?.paymentId).toBeNull();
    expect(balances(data.meals, service.id, "2026-10").due).toBe(0);
    await repo.reverse(service.id, bulk); await repo.reverse(service.id, bulk);
    data = await repo.snapshot();
    expect(data.payments.find(p => p.id === bulk)?.reversedAt).toBeTruthy();
    expect(data.payments.find(p => p.id === bulk)?.mealCount).toBe(1);
    expect(balances(data.meals, service.id, "2026-10").due).toBe(8000);
    await expect(repo.pay(service.id, "2026-10-31", request, bulkExpected)).rejects.toThrow("reversed");
  });
  it("locks paid entries until their payment is reversed", async () => {
    const meal = entry(); await repo.saveMeal(meal);
    const id = await repo.pay(service.id, meal.day, crypto.randomUUID(), await expected(meal.id), meal.id);
    await expect(repo.saveMeal({ ...meal, version: 2, amount: 100 })).rejects.toThrow("Reverse");
    await expect(repo.deleteMeal(service.id, meal.id, 2)).rejects.toThrow("Reverse");
    await repo.reverse(service.id, id);
    await repo.deleteMeal(service.id, meal.id, 3);
    const data = await repo.snapshot();
    expect(data.meals).toHaveLength(0);
    expect(data.payments[0].amount).toBe(8000);
    expect(data.payments[0].mealCount).toBe(1);
  });
  it("rejects stale edits and changed payment previews without partial writes", async () => {
    const meal = entry(); await repo.saveMeal(meal);
    const before = await expected();
    await repo.saveMeal({ ...meal, amount: 9500, version: 1 });
    await expect(repo.saveMeal({ ...meal, amount: 5000, version: 1 })).rejects.toThrow("changed");
    await expect(repo.deleteMeal(service.id, meal.id, 1)).rejects.toThrow("changed");
    await expect(repo.pay(service.id, "2026-10-31", crypto.randomUUID(), before)).rejects.toThrow("reviewed");
    expect((await repo.snapshot()).payments).toHaveLength(0);
    expect((await repo.snapshot()).meals[0].paymentId).toBeNull();
  });
  it("keeps archived balances and allows settlement, while preventing new meals", async () => {
    await repo.saveMeal(entry());
    await repo.saveService({ ...service, archived: true, version: 1 });
    await expect(repo.saveMeal(entry("2026-10-03"))).rejects.toThrow("Restore");
    await repo.pay(service.id, "2026-10-31", crypto.randomUUID(), await expected());
    expect(balances((await repo.snapshot()).meals, service.id, "2026-10").due).toBe(0);
    await repo.saveService({ ...service, archived: false, version: 2 });
    await repo.saveMeal(entry("2026-10-03"));
  });
  it("isolates all reads and writes by owner, even with guessed identifiers", async () => {
    const meal = entry(); await repo.saveMeal(meal);
    const payment = await repo.pay(service.id, meal.day, crypto.randomUUID(), await expected(meal.id), meal.id);
    expect(await stranger.snapshot()).toEqual({ services: [], meals: [], payments: [] });
    await expect(stranger.saveService({ ...service, version: 1 })).rejects.toThrow("not found");
    await expect(stranger.saveMeal(entry("2026-10-03"))).rejects.toThrow("not found");
    await expect(stranger.deleteMeal(service.id, meal.id, 2)).rejects.toThrow("not found");
    await expect(stranger.pay(service.id, meal.day, crypto.randomUUID(), [{ id: meal.id, version: 2 }], meal.id)).rejects.toThrow("not found");
    await expect(stranger.reverse(service.id, payment)).rejects.toThrow("not found");
  });
  it("prevents duplicate settlement from concurrent requests", async () => {
    await repo.saveMeal(entry());
    const entries = await expected();
    const results = await Promise.allSettled([repo.pay(service.id, "2026-10-31", crypto.randomUUID(), entries), repo.pay(service.id, "2026-10-31", crypto.randomUUID(), entries)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect((await repo.snapshot()).payments).toHaveLength(1);
  });
  it("handles free meals as taken and paid without inventing a charge", async () => {
    await repo.saveMeal(entry("2026-10-02", "breakfast", 0));
    await repo.pay(service.id, "2026-10-31", crypto.randomUUID(), await expected());
    const data = await repo.snapshot();
    expect(data.meals[0].paymentId).toBeTruthy();
    expect(data.payments[0].amount).toBe(0);
  });
});

describe("Google account ownership", () => {
  const accounts = new Accounts(db);
  const identity = { googleId: "google-owner", email: "owner@gmail.com", name: "Owner", canClaimLegacy: true };
  it("preserves legacy meals and payments without changing their owner", async () => {
    const meal = entry(); await repo.saveMeal(meal);
    await repo.pay(service.id, meal.day, crypto.randomUUID(), await expected(meal.id), meal.id);
    await accounts.register(identity);
    expect(await accounts.owner(identity.googleId)).toBe(identity.email);
    const saved = await new Repository(db, await accounts.owner(identity.googleId)).snapshot();
    expect(saved).toEqual(await repo.snapshot());
    expect(saved.payments).toHaveLength(1);
    await accounts.register({ ...identity, email: "renamed@gmail.com", name: "Renamed" });
    expect(await accounts.owner(identity.googleId)).toBe(identity.email);
    const [stored] = await db.select().from(schema.accounts);
    expect(stored.email).toBe("renamed@gmail.com");
    expect(stored.name).toBe("Renamed");
  });
  it("does not give a second identity an already claimed legacy tracker", async () => {
    await accounts.register(identity);
    const other = await accounts.register({ ...identity, googleId: "new-google-owner" });
    expect(other.ownerKey).toBe("google:new-google-owner");
    expect((await new Repository(db, other.ownerKey).snapshot()).services).toHaveLength(0);
  });
  it("does not claim third-party email records automatically", async () => {
    const legacy = new Repository(db, "person@example.com");
    await legacy.saveService({ ...service, id: crypto.randomUUID() });
    const account = await accounts.register({ googleId: "external", email: "person@example.com", name: null, canClaimLegacy: false });
    expect(account.ownerKey).toBe("google:external");
    expect(await new Repository(db, account.ownerKey).snapshot()).toEqual({ services: [], meals: [], payments: [] });
    expect((await legacy.snapshot()).services).toHaveLength(1);
  });
  it("makes repeat and concurrent registration idempotent", async () => {
    const results = await Promise.all([accounts.register(identity), accounts.register(identity)]);
    expect(results[0].ownerKey).toBe(results[1].ownerKey);
    expect(await db.select().from(schema.accounts)).toHaveLength(1);
    await expect(accounts.owner("missing")).rejects.toThrow("sign in again");
  });
  it("isolates two populated trackers and rejects cross-account identifiers", async () => {
    const a = await accounts.register(identity);
    const b = await accounts.register({ ...identity, googleId: "second", email: "second@gmail.com" });
    const first = new Repository(db, a.ownerKey), second = new Repository(db, b.ownerKey);
    const secondService = { ...service, id: crypto.randomUUID(), name: "Second kitchen" };
    await second.saveService(secondService);
    const firstMeal = entry(), secondMeal = { ...entry(), serviceId: secondService.id };
    await first.saveMeal(firstMeal); await second.saveMeal(secondMeal);
    const request = crypto.randomUUID();
    const payment = await first.pay(service.id, firstMeal.day, request, [{ id: firstMeal.id, version: 1 }], firstMeal.id);
    await expect(second.pay(secondService.id, secondMeal.day, request, [{ id: secondMeal.id, version: 1 }], secondMeal.id)).rejects.toThrow("does not match");
    await expect(second.saveService({ ...service, version: 1 })).rejects.toThrow("not found");
    await expect(second.saveMeal({ ...firstMeal, version: 2 })).rejects.toThrow("not found");
    await expect(second.saveMeal({ ...firstMeal, serviceId: secondService.id, version: 2 })).rejects.toThrow("identity");
    await expect(second.deleteMeal(service.id, firstMeal.id, 2)).rejects.toThrow("not found");
    await expect(second.pay(service.id, firstMeal.day, crypto.randomUUID(), [{ id: firstMeal.id, version: 2 }], firstMeal.id)).rejects.toThrow("not found");
    await expect(second.reverse(secondService.id, payment)).rejects.toThrow("not found");
    const secondPayment = await second.pay(secondService.id, secondMeal.day, crypto.randomUUID(), [{ id: secondMeal.id, version: 1 }], secondMeal.id);
    const firstData = await first.snapshot(), secondData = await second.snapshot();
    expect(firstData.services.map(s => s.id)).toEqual([service.id]);
    expect(secondData.services.map(s => s.id)).toEqual([secondService.id]);
    expect(firstData.meals.map(m => m.id)).toEqual([firstMeal.id]);
    expect(secondData.meals.map(m => m.id)).toEqual([secondMeal.id]);
    expect(firstData.payments.map(p => p.id)).toEqual([payment]);
    expect(secondData.payments.map(p => p.id)).toEqual([secondPayment]);
  });
});
