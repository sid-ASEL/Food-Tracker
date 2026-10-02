"use server";
import { requireOwner, signIn, signOut } from "@/auth";
import { getDb } from "@/db/client";
import { Repository } from "@/db/repository";
import type { Result, Snapshot, ExpectedMeal } from "@/lib/types";
import type { MealInput, ServiceInput } from "@/lib/domain";
import { ZodError } from "zod";
import { UserError } from "@/lib/errors";

async function run(operation: (repo: Repository) => Promise<unknown>): Promise<Result<Snapshot>> {
  try {
    const owner = await requireOwner();
    const repo = new Repository(getDb(), owner);
    await operation(repo);
    return { ok: true, data: await repo.snapshot() };
  } catch (error) {
    if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Please check the entered values." };
    if (error instanceof UserError) return { ok: false, error: error.message };
    // Never send connection strings or SQL parameters back to the browser.
    console.error("Food Tracker operation failed.");
    return { ok: false, error: "Could not save or load data. Check your connection and try again." };
  }
}
export async function refreshData() { return run(async () => {}); }
export async function saveService(input: ServiceInput) { return run(repo => repo.saveService(input)); }
export async function saveMeal(input: MealInput) { return run(repo => repo.saveMeal(input)); }
export async function removeMeal(serviceId: string, mealId: string, version: number) { return run(repo => repo.deleteMeal(serviceId, mealId, version)); }
export async function markPaid(serviceId: string, day: string, requestId: string, mealId: string, expected: ExpectedMeal[]) { return run(repo => repo.pay(serviceId, day, requestId, expected, mealId)); }
export async function settleService(serviceId: string, cutoff: string, requestId: string, expected: ExpectedMeal[]) { return run(repo => repo.pay(serviceId, cutoff, requestId, expected)); }
export async function reversePayment(serviceId: string, paymentId: string) { return run(repo => repo.reverse(serviceId, paymentId)); }
export async function googleSignIn() { await signIn("google", { redirectTo: "/" }); }
export async function logOut() { await signOut({ redirectTo: "/" }); }
