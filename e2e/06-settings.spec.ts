import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Settings Page", () => {
  test("should render settings with all tabs", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/settings/profile");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text="Settings"').first()).toBeVisible({ timeout: 5000 });
    const tabs = ["Profile & Style", "Connected Accounts", "Financial Profile", "Knowledge Base", "AI Tuning", "Voice & Speech", "Notifications", "Appearance"];
    for (const tab of tabs) {
      await expect(page.locator(`[role="tab"]:has-text("${tab}")`)).toBeVisible({ timeout: 3000 });
    }
    expect(errors).toHaveLength(0);
  });

  test("should navigate between settings tabs", async ({ page }) => {
    await setupPage(page, "/settings/profile");
    const appearanceTab = page.locator('[role="tab"]:has-text("Appearance")');
    await appearanceTab.click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=/Theme|colors|font|density/i').first()).toBeVisible({ timeout: 5000 });
  });
});
