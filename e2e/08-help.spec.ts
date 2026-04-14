import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Help & Platform Guide", () => {
  test("should render help page with all tabs", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/help");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Help|Platform Guide/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="tab"]:has-text("Guide")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("FAQ")')).toBeVisible();
    await expect(page.locator('[role="tab"]:has-text("Architecture")')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("should switch to Architecture tab", async ({ page }) => {
    await setupPage(page, "/help");
    await page.locator('[role="tab"]:has-text("Architecture")').click();
    await page.waitForTimeout(500);
    const archContent = page.locator('text=/architecture|system|layer|stack/i').first();
    await expect(archContent).toBeVisible({ timeout: 5000 });
  });

  test("should switch to FAQ tab", async ({ page }) => {
    await setupPage(page, "/help");
    await page.locator('[role="tab"]:has-text("FAQ")').click();
    await page.waitForTimeout(500);
    await expect(page.locator("#root")).toBeVisible();
  });
});
