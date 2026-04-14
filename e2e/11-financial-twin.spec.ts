import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Financial Twin Dashboard", () => {
  test("should render financial twin page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/financial-twin");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Financial Twin|digital twin|overview/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});
