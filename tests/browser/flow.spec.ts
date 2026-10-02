import { test, expect } from "@playwright/test";
test("service → standard/custom meals → payment → next month → reversal", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service name").fill("Amma’s Kitchen");
  await dialog.getByLabel("Payment phone").fill("9876543210");
  await dialog.getByLabel("breakfast price").fill("40");
  await dialog.getByLabel("lunch price").fill("80");
  await dialog.getByLabel("dinner price").fill("70");
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: /Friday, 2 October, 0 meals/ }).click();
  await dialog.getByLabel("lunch amount for Amma’s Kitchen").fill("85.50");
  // The controlled checkbox reflects confirmed persistence, not an optimistic click.
  await dialog.getByRole("checkbox", { name: "Amma’s Kitchen lunch taken" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Amma’s Kitchen lunch taken" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "Amma’s Kitchen breakfast taken" })).not.toBeChecked();
  await dialog.getByRole("button", { name: "Add a custom meal" }).click();
  await dialog.getByLabel("Custom meal name").fill("Evening snacks");
  await dialog.getByLabel("Custom meal amount").fill("25");
  await dialog.getByRole("button", { name: "Add meal", exact: true }).click();
  await expect(dialog.getByLabel("Meal name Evening snacks")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("button", { name: /Friday, 2 October, 2 meals, 2 unpaid/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Friday, 2 October, 2 meals, 2 unpaid/ })).toBeVisible();
  const dailySummary = page.getByRole("region", { name: "Selected day meals" });
  await expect(dailySummary).toContainText("Evening snacks");
  await expect(dailySummary).toContainText("₹85.50");
  await dailySummary.getByRole("button", { name: "Log meal" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog.getByLabel("Meal name Evening snacks")).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Payments", exact: true }).filter({ visible: true }).click();
  await expect(page.locator(".balance-total")).toContainText("₹110.50");
  await page.getByRole("button", { name: "Pay all outstanding", exact: true }).click();
  await expect(dialog).toContainText("₹110.50");
  await dialog.getByRole("button", { name: "Pay all outstanding", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Select month and year")).toHaveValue("2026-11");
  await page.getByRole("button", { name: "Payments", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Reverse", exact: true }).click();
  await dialog.getByRole("button", { name: "Reverse payment", exact: true }).click();
  await expect(page.locator(".balance-total")).toContainText("₹110.50");
  await expect(page.locator(".history-row")).toContainText("Reversed");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("payments.png"), fullPage: true });
  await page.getByRole("button", { name: /^(Meal tracker|Tracker)$/ }).filter({ visible: true }).click();
  await page.getByLabel("Select month and year").fill("2026-10");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("calendar.png"), fullPage: true });
  await page.getByRole("button", { name: /^(Food services|Services)$/ }).filter({ visible: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: testInfo.outputPath("services.png"), fullPage: true });
});

test("failed saves preserve input and can be retried", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service name").fill("Lunch box");
  await dialog.getByLabel("Payment phone").fill("9876543210");
  for (const kind of ["breakfast", "lunch", "dinner"]) await dialog.getByLabel(`${kind} price`).fill("50");
  await page.evaluate(() => sessionStorage.setItem("fail-next-save", "1"));
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Could not save");
  await expect(dialog.getByLabel("Service name")).toHaveValue("Lunch box");
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: /Lunch box/ })).toBeVisible();
});

test("iPhone visitors get clear Add to Home Screen instructions", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "userAgent", { configurable: true, value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Install Mealbook" }).click();
  const dialog = page.getByRole("dialog", { name: "Add Mealbook to your home screen" });
  await expect(dialog).toContainText("Open this page in Safari and tap Share");
  await expect(dialog).toContainText("Add to Home Screen");
  await dialog.getByRole("button", { name: "Got it" }).click();
  await expect(dialog).not.toBeVisible();
});

test("uses the browser install prompt when it is available", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: async () => { document.documentElement.dataset.installPrompt = "shown"; },
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);
  });
  await page.getByRole("button", { name: "Install Mealbook" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-install-prompt", "shown");
  await expect(page.getByRole("button", { name: "Install Mealbook" })).not.toBeVisible();
});

test("small phones keep the meal editor and navigation within the viewport", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("small-phone.png") });
  await page.getByRole("button", { name: /Friday, 2 October/ }).click();
  const dialog = page.getByRole("dialog");
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(740);
  await expect(dialog.getByRole("button", { name: "Close dialog" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("small-phone-meal-sheet.png") });
});

test("hides the install action when Mealbook is already installed", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { configurable: true, value: true });
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Install Mealbook" })).not.toBeVisible();
});

test("optional service prices and natural meal counts", async ({ page }, testInfo) => {
  await page.goto("/");
  const count = page.locator(".stat-card").first().locator(".stat-value");
  await expect(count).toHaveText("0");
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service name").fill("Lunch only");
  await dialog.getByLabel("Payment phone").fill("9876543210");
  await dialog.getByLabel("lunch price").fill("80");
  await dialog.getByLabel("dinner price").fill("invalid");
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Enter a valid amount");
  await dialog.getByLabel("dinner price").fill("");
  await dialog.getByRole("button", { name: "Add food service", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Friday, 2 October, 0 meals/ }).click();
  await expect(dialog.getByLabel("breakfast amount for Lunch only")).toHaveValue("0");
  await expect(dialog.getByLabel("lunch amount for Lunch only")).toHaveValue("80");
  await expect(dialog.getByLabel("dinner amount for Lunch only")).toHaveValue("0");
  await dialog.getByLabel("breakfast amount for Lunch only").fill("40");
  await dialog.getByRole("checkbox", { name: "Lunch only breakfast taken" }).click();
  await expect(dialog.getByRole("checkbox", { name: "Lunch only breakfast taken" })).toBeChecked();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(count).toHaveText("1");
  for (const width of [364, 646]) {
    await page.setViewportSize({ width, height: 810 });
    const install = page.getByRole("button", { name: "Install Mealbook" });
    const button = await install.boundingBox();
    const icon = await install.locator("svg").boundingBox();
    expect(Math.abs((button!.x + button!.width / 2) - (icon!.x + icon!.width / 2))).toBeLessThan(1);
    expect(Math.abs((button!.y + button!.height / 2) - (icon!.y + icon!.height / 2))).toBeLessThan(1);
  }
  await page.getByRole("button", { name: "Add service", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("optional-prices.png") });
});
