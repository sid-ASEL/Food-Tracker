import { test, expect } from "@playwright/test";

test("mobile landing explains Mealbook and exposes sign-in and installation", async ({ page }, testInfo) => {
  await page.goto("/?landing");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Good meals.");
  await expect(page.getByText("Keep your tiffin, mess, and everyday food expenses in one place.", { exact: false })).toBeVisible();
  const signIn = page.getByRole("button", { name: "Get started with Google" });
  await signIn.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html")).toHaveAttribute("data-sign-in", "google");
  const install = page.getByRole("button", { name: "Install Mealbook" });
  await expect(install.getByText("Install", { exact: true })).toBeVisible();
  const loginBounds = await signIn.boundingBox(), installBounds = await install.boundingBox();
  expect(installBounds!.y).toBeGreaterThan(loginBounds!.y + loginBounds!.height);
  await install.click();
  await expect(page.getByRole("dialog")).toContainText("Add to Home screen");
  await page.getByRole("button", { name: "Got it" }).click();
  for (const width of [320, 412, 1440]) {
    await page.setViewportSize({ width, height: 915 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await page.locator(".landing-content").boundingBox())!.width).toBeLessThanOrEqual(460);
    await page.screenshot({ path: testInfo.outputPath(`landing-${width}.png`), fullPage: true });
  }
});

test("landing handles unavailable setup, sign-in errors, and installed mode", async ({ page }) => {
  await page.goto("/?landing&notReady");
  await expect(page.getByRole("button", { name: "Get started with Google" })).not.toBeVisible();
  await expect(page.getByText("Mealbook is getting ready.", { exact: false })).toBeVisible();
  await page.goto("/?landing&error=AccessDenied");
  await expect(page.getByRole("alert")).toContainText("verified Google account");
  await expect(page.getByRole("button", { name: "Get started with Google" })).toBeVisible();
  await page.addInitScript(() => Object.defineProperty(navigator, "standalone", { configurable: true, value: true }));
  await page.goto("/?landing");
  await expect(page.getByRole("button", { name: "Install Mealbook" })).not.toBeVisible();
});
