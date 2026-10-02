// Only the isolated Vite test harness aliases to these mocks. Production uses server actions.
import type { MealInput, ServiceInput } from "../../src/lib/domain";
import type { Snapshot, Result } from "../../src/lib/types";
const key = "mealbook-ui-test";
const seed: Snapshot = { services: [], meals: [], payments: [] };
export function initialData(): Snapshot { return JSON.parse(sessionStorage.getItem(key) ?? JSON.stringify(seed)); }
const data = initialData();
async function result(): Promise<Result<Snapshot>> {
  await new Promise(r => setTimeout(r, 50));
  sessionStorage.setItem(key, JSON.stringify(data));
  return { ok: true, data: structuredClone(data) };
}
function failure(): Result<Snapshot> | null {
  if (sessionStorage.getItem("fail-next-save")) { sessionStorage.removeItem("fail-next-save"); return { ok: false, error: "Could not save or load data. Check your connection and try again." }; }
  return null;
}
export async function refreshData() { return result(); }
export async function saveService(service: ServiceInput) {
  const failed = failure(); if (failed) return failed;
  data.services = [...data.services.filter(s => s.id !== service.id), { ...service, version: service.version + 1 }];
  return result();
}
export async function saveMeal(meal: MealInput) {
  const failed = failure(); if (failed) return failed;
  data.meals = [...data.meals.filter(m => m.id !== meal.id), { ...meal, paymentId: null, version: meal.version + 1 }];
  return result();
}
export async function removeMeal(_serviceId: string, mealId: string) { data.meals = data.meals.filter(m => m.id !== mealId); return result(); }
export async function settleService(serviceId: string, cutoff: string, requestId: string, _expected?: unknown, mealId?: string) {
  const failed = failure(); if (failed) return failed;
  const entries = data.meals.filter(m => m.serviceId === serviceId && !m.paymentId && m.day <= cutoff && (!mealId || m.id === mealId));
  const id = crypto.randomUUID();
  data.payments.unshift({ id, serviceId, cutoff, amount: entries.reduce((n, m) => n + m.amount, 0), createdAt: "2026-10-02T08:00:00Z", reversedAt: null, mealCount: entries.length });
  data.meals = data.meals.map(m => entries.some(e => e.id === m.id) ? { ...m, paymentId: id, version: m.version + 1 } : m);
  void requestId;
  return result();
}
export async function markPaid(serviceId: string, day: string, requestId: string, mealId: string) { return settleService(serviceId, day, requestId, undefined, mealId); }
export async function reversePayment(_serviceId: string, paymentId: string) {
  data.payments = data.payments.map(p => p.id === paymentId ? { ...p, reversedAt: "2026-10-02T09:00:00Z" } : p);
  data.meals = data.meals.map(m => m.paymentId === paymentId ? { ...m, paymentId: null, version: m.version + 1 } : m);
  return result();
}
export async function logOut() {}
