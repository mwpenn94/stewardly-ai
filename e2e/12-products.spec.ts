import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Products Marketplace", () => {
  test("should render products page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/products");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Products|marketplace|recommended/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});
