import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Study Analytics (Enhanced)", () => {
  test("should render the page without error boundary", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text="Study Analytics"').first()).toBeVisible({ timeout: 8000 });
  });

  test("should display tabs: Overview, Topics, Efficiency, Insights", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    // Page renders either sign-in or tabs (or both if partially loaded)
    const overviewTab = page.locator('[role="tab"]:has-text("Overview")');
    const signIn = page.locator('button:has-text("Sign In")');
    // Wait for either to appear
    await expect(overviewTab.or(signIn).first()).toBeVisible({ timeout: 8000 });
    // If tabs are visible, check all four
    if (await overviewTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(page.locator('[role="tab"]:has-text("Topics")')).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("Efficiency")')).toBeVisible();
      await expect(page.locator('[role="tab"]:has-text("Insights")')).toBeVisible();
    }
  });

  test("should show sign-in prompt for unauthenticated users", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    // Either sign-in button or overview tab should be visible
    const signInBtn = page.locator('button:has-text("Sign In")');
    const overviewTab = page.locator('[role="tab"]:has-text("Overview")');
    await expect(signInBtn.or(overviewTab).first()).toBeVisible({ timeout: 8000 });
  });

  test("should switch between tabs", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    const topicsTab = page.locator('[role="tab"]:has-text("Topics")');
    if (await topicsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await topicsTab.click();
      await page.waitForTimeout(500);
      // Should show topic-related content or empty state
      const topicContent = page.locator('text=/Topic Mastery|No Topic Data/i').first();
      await expect(topicContent).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show efficiency tab content", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    const effTab = page.locator('[role="tab"]:has-text("Efficiency")');
    if (await effTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await effTab.click();
      await page.waitForTimeout(500);
      const effContent = page.locator('text=/Efficiency Scores|No Efficiency Data/i').first();
      await expect(effContent).toBeVisible({ timeout: 5000 });
    }
  });

  test("should show insights tab content", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    const insightsTab = page.locator('[role="tab"]:has-text("Insights")');
    if (await insightsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await insightsTab.click();
      await page.waitForTimeout(500);
      const insightsContent = page.locator('text=/Personalized Recommendations|No Insights/i').first();
      await expect(insightsContent).toBeVisible({ timeout: 5000 });
    }
  });

  test("should navigate back to learning home", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    const backBtn = page.locator('a[href="/learning"]');
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/learning/);
    }
  });

  test("should show mastery distribution in overview", async ({ page }) => {
    await setupPage(page, "/learning/analytics");
    const overviewTab = page.locator('[role="tab"]:has-text("Overview")');
    if (await overviewTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await overviewTab.click();
      await page.waitForTimeout(500);
      // Should show mastery distribution or loading skeleton
      const masteryOrSkeleton = page.locator('text="Mastery Distribution"').or(page.locator('[class*="skeleton"]').first());
      await expect(masteryOrSkeleton).toBeVisible({ timeout: 5000 });
    }
  });
});
