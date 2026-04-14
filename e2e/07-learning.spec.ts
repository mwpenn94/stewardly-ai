import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Learning & Licensing Page", () => {
  test("should render learning page with KPI cards", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/learning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text="Learning & Licensing"')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=/MASTERY/i').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/STREAK/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test("should display exam tracks", async ({ page }) => {
    await setupPage(page, "/learning");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await expect(page.locator('text="Exam Tracks"')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text="SIE"').first()).toBeVisible({ timeout: 3000 });
  });

  test("should display Agent Recommendations", async ({ page }) => {
    await setupPage(page, "/learning");
    await expect(page.locator('text="Agent Recommendations"')).toBeVisible({ timeout: 5000 });
  });

  test("should display Learning Tools section", async ({ page }) => {
    await setupPage(page, "/learning");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);
    await expect(page.locator('text="Learning Tools"')).toBeVisible({ timeout: 5000 });
  });
});
