export const standardMeals = ["breakfast", "lunch", "dinner"] as const;
export type MealKind = typeof standardMeals[number] | "custom";
export type Service = {
  id: string; name: string; category: string; phone: string;
  breakfast: number; lunch: number; dinner: number; archived: boolean; version: number;
};
export type Meal = {
  id: string; serviceId: string; day: string; kind: MealKind; label: string;
  amount: number; paymentId: string | null; version: number;
};
export type Payment = {
  id: string; serviceId: string; amount: number; createdAt: string;
  reversedAt: string | null; mealCount: number; cutoff: string;
};
export type Snapshot = { services: Service[]; meals: Meal[]; payments: Payment[] };
export type ExpectedMeal = { id: string; version: number };
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };
