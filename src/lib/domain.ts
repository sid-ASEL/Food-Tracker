import { z } from "zod";
import type { Meal } from "./types";
export { standardMeals } from "./types";

export function todayIndia(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function shiftMonth(month: string, delta: number) {
  const [year, index] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, index - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function monthEnd(month: string) {
  const [year, index] = month.split("-").map(Number);
  return `${month}-${new Date(Date.UTC(year, index, 0)).getUTCDate()}`;
}
export function calendarDays(month: string): (string | null)[] {
  const [year, index] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const days: (string | null)[] = Array(start).fill(null);
  for (let day = 1; day <= count; day++) days.push(`${month}-${String(day).padStart(2, "0")}`);
  while (days.length % 7) days.push(null);
  return days;
}
export function money(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: paise % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(paise / 100);
}
export function parseRupees(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) throw new Error("Enter a valid amount with up to two decimal places.");
  const [whole, decimals = ""] = value.trim().split(".");
  const paise = Number(whole) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise > 100000000) throw new Error("Amount must be between ₹0 and ₹10,00,000.");
  return paise;
}
export function balances(meals: Meal[], serviceId: string, month: string) {
  let charges = 0, paid = 0, arrears = 0;
  const end = monthEnd(month);
  for (const meal of meals) {
    if (meal.serviceId !== serviceId || meal.day > end) continue;
    if (meal.day.startsWith(month)) {
      charges += meal.amount;
      if (meal.paymentId) paid += meal.amount;
    } else if (!meal.paymentId) arrears += meal.amount;
  }
  return { charges, paid, arrears, due: charges - paid + arrears };
}
export const uuid = z.uuid();
export const amount = z.number().int().min(0).max(100000000);
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(v => Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100, "Choose a year between 2000 and 2100.");
export const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
  const date = new Date(`${v}T00:00:00Z`);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === v && monthSchema.safeParse(v.slice(0, 7)).success;
}, "Choose a valid date.");
export const serviceSchema = z.object({
  id: uuid, name: z.string().trim().min(1).max(80), category: z.string().trim().min(1).max(40),
  phone: z.string().trim().regex(/^\+?[\d ()-]{7,20}$/, "Enter a valid phone number."),
  breakfast: amount, lunch: amount, dinner: amount, archived: z.boolean(), version: z.number().int().min(0),
});
export const mealSchema = z.object({
  id: uuid, serviceId: uuid, day: daySchema, kind: z.enum(["breakfast", "lunch", "dinner", "custom"]),
  label: z.string().trim().min(1).max(80), amount, version: z.number().int().min(0),
});
export type ServiceInput = z.infer<typeof serviceSchema>;
export type MealInput = z.infer<typeof mealSchema>;
