import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Client Onboarding", () => {
  test("should render client onboarding page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/client-onboarding");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Client Onboarding|onboarding|welcome/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});
