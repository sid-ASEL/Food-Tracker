import { pgTable, uuid, text, integer, boolean, date, timestamp, index, uniqueIndex, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const services = pgTable("services", {
  id: uuid().primaryKey(), owner: text().notNull(), name: text().notNull(), category: text().notNull(), phone: text().notNull(),
  breakfast: integer().notNull(), lunch: integer().notNull(), dinner: integer().notNull(),
  archived: boolean().notNull().default(false), version: integer().notNull().default(1),
}, t => [index("services_owner_idx").on(t.owner), check("prices_nonnegative", sql`${t.breakfast} >= 0 AND ${t.lunch} >= 0 AND ${t.dinner} >= 0`)]);
export const payments = pgTable("payments", {
  id: uuid().primaryKey(), requestId: uuid("request_id").notNull().unique(),
  serviceId: uuid("service_id").notNull().references(() => services.id),
  amount: integer().notNull(), cutoff: date().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reversedAt: timestamp("reversed_at", { withTimezone: true }),
}, t => [check("payment_nonnegative", sql`${t.amount} >= 0`)]);
export const meals = pgTable("meals", {
  id: uuid().primaryKey(), serviceId: uuid("service_id").notNull().references(() => services.id),
  day: date().notNull(), kind: text().notNull(), label: text().notNull(), amount: integer().notNull(),
  paymentId: uuid("payment_id").references(() => payments.id), version: integer().notNull().default(1),
}, t => [
  uniqueIndex("standard_meal_slot").on(t.serviceId, t.day, t.kind).where(sql`${t.kind} <> 'custom'`),
  index("meals_service_day_idx").on(t.serviceId, t.day),
  check("meal_nonnegative", sql`${t.amount} >= 0`),
  check("meal_kind", sql`${t.kind} IN ('breakfast','lunch','dinner','custom')`),
]);
export const paymentItems = pgTable("payment_items", {
  id: uuid().primaryKey(), paymentId: uuid("payment_id").notNull().references(() => payments.id),
  mealId: uuid("meal_id").notNull(), day: date().notNull(), label: text().notNull(), amount: integer().notNull(),
});
