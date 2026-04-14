import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Operations Hub", () => {
  test("should render operations page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/operations");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Operations|workflows|compliance|agent/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Advisory Hub", () => {
  test("should render advisory hub without errors", async ({ page }) => {
    await setupPage(page, "/advisory");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});

test.describe("Relationships Hub", () => {
  test("should render relationships hub without errors", async ({ page }) => {
    await setupPage(page, "/relationships");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});
