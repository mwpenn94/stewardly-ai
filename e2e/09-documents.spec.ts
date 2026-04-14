import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Documents Page", () => {
  test("should render documents page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/documents");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Documents|files|upload/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});
