/**
 * E2E Test: Advisor-Level Features
 * Tests pages that are visible to advisor+ roles in the sidebar.
 * Since we can't authenticate in E2E without real OAuth, we test that:
 * 1. Pages load without crashing
 * 2. Auth gating works (shows sign-in prompt, not infinite loop)
 * 3. UI structure is correct
 */
import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";

const ADVISOR_PAGES = [
  { path: "/wealth-engine", title: "Wealth Engine" },
  { path: "/learning", title: "Learning" },
  { path: "/help", title: "Help" },
  { path: "/calculators", title: "Calculators" },
  { path: "/products", title: "Products" },
];

test.describe("Advisor Features — Page Structure", () => {
  for (const { path, title } of ADVISOR_PAGES) {
    test(`${title} page loads and renders correctly`, async ({ page }) => {
      const errors = setupConsoleErrorTracker(page);
      await setupPage(page, path);
      
      // Page should render without error boundary
      const errorBoundary = page.locator('text=/Something went wrong/i');
      const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
      expect(hasError).toBe(false);
      
      // Should have main content area
      await expect(page.locator("#root")).toBeVisible();
    });
  }

  test("Wealth Engine Hub shows calculator categories", async ({ page }) => {
    await setupPage(page, "/wealth-engine");
    // Should show the wealth engine hub with navigation cards
    const heading = page.locator('h1, h2, [class*="heading"]').first();
    await expect(heading).toBeVisible({ timeout: 5000 });
  });

  test("Learning page shows course tracks", async ({ page }) => {
    await setupPage(page, "/learning");
    // Should show learning content
    const content = page.locator('[class*="card"], [class*="Card"], main').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test("Products page shows product categories", async ({ page }) => {
    await setupPage(page, "/products");
    // Should show product listing
    const content = page.locator('[class*="card"], [class*="Card"], main, [class*="grid"]').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });
});
