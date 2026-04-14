import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Integrations Page", () => {
  test("should render integrations page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/integrations");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Integrations|connect|data source/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Community Page", () => {
  test("should render community page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/community");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text=/Community|forum|discussion/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Changelog Page", () => {
  test("should render changelog without errors", async ({ page }) => {
    await setupPage(page, "/changelog");
    // Don't use verifyNoErrorBoundary here - changelog content may contain words like "Unhandled"
    await expect(page.locator("#root")).toBeVisible();
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});
