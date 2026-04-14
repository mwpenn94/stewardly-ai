import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Code Chat Page", () => {
  test("should render Code Chat page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/code-chat");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Code Chat|code/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test("should have input area for code questions", async ({ page }) => {
    await setupPage(page, "/code-chat");
    const input = page.locator("textarea").first();
    await expect(input).toBeVisible({ timeout: 5000 });
  });
});
