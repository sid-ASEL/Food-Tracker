import { describe, expect, it } from "vitest";
import { balances, calendarDays, daySchema, monthEnd, parseRupees, shiftMonth, todayIndia } from "@/lib/domain";
import type { Meal } from "@/lib/types";
describe("money and calendar rules", () => {
  it("uses exact paise, including zero, and rejects malformed prices", () => {
    expect(parseRupees("123.45")).toBe(12345);
    expect(parseRupees("0")).toBe(0);
    expect(parseRupees("0.1")).toBe(10);
    for (const bad of ["", "-1", "1.234", "1e3", "Infinity", "₹50", "1000001"]) expect(() => parseRupees(bad)).toThrow();
  });
  it("handles leap years, month boundaries, and India midnight", () => {
    expect(calendarDays("2024-02").filter(Boolean)).toHaveLength(29);
    expect(calendarDays("2025-02").filter(Boolean)).toHaveLength(28);
    expect(calendarDays("2026-10")).toHaveLength(35);
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(todayIndia(new Date("2026-10-01T18:29:59Z"))).toBe("2026-10-01");
    expect(todayIndia(new Date("2026-10-01T18:30:00Z"))).toBe("2026-10-02");
    expect(daySchema.safeParse("2025-02-29").success).toBe(false);
    expect(daySchema.safeParse("2024-02-29").success).toBe(true);
  });
  it("counts only recorded meals, keeps arrears separate, and excludes future charges", () => {
    const make = (day: string, amount: number, paymentId: string | null): Meal => ({ id: crypto.randomUUID(), serviceId: "a", day, amount, paymentId, label: "Lunch", kind: "lunch", version: 1 });
    expect(balances([make("2026-09-01", 1000, null), make("2026-09-02", 3000, "p"), make("2026-10-01", 5000, null), make("2026-10-02", 7000, "p"), make("2026-11-01", 9000, null)], "a", "2026-10")).toEqual({ charges: 12000, paid: 7000, arrears: 1000, due: 6000 });
    expect(balances([], "a", "2026-10")).toEqual({ charges: 0, paid: 0, arrears: 0, due: 0 });
  });
});
