import { test, expect } from "@playwright/test";

test("theme follows the device until chosen, then persists across pages", async ({ page }, testInfo) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/?landing");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.screenshot({ path: testInfo.outputPath("landing-dark.png"), fullPage: true });
  await toggle.focus(); await page.keyboard.press("Space");
  await expect(toggle).not.toBeChecked();
  await page.reload();
  await expect(toggle).not.toBeChecked();
  await page.goto("/");
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(toggle).toBeChecked();
  await page.reload();
  await expect(toggle).toBeChecked();
});

test("dark tracker, forms, payments, and services fit small phones", async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem("mealbook-theme", "dark"));
  await page.setViewportSize({ width: 320, height: 810 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service name").fill("Home kitchen");
  await dialog.getByLabel("Payment phone").fill("9876543210");
  await page.screenshot({ path: testInfo.outputPath("service-form-dark.png") });
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /Friday, 2 October, 0 meals/ }).click();
  await expect(dialog.getByLabel("breakfast amount for Home kitchen")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("meal-editor-dark.png") });
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  for (const name of ["Tracker", "Payments", "Services"]) {
    await page.getByRole("button", { name, exact: true }).filter({ visible: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`${name}-dark.png`), fullPage: true });
  }
});

test("theme toggle works when device storage is unavailable", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { value: { getItem: () => { throw new Error("Unavailable"); }, setItem: () => { throw new Error("Unavailable"); } } });
  });
  await page.goto("/?landing");
  const toggle = page.getByRole("switch", { name: "Dark mode" });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
});
