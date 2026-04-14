/**
 * E2E Test: Admin-Level Features
 * Tests admin-only pages and features.
 * Verifies auth gating, no crash, and page structure.
 */
import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";

const ADMIN_PAGES = [
  { path: "/admin", title: "Admin Panel" },
  { path: "/compliance-audit", title: "Compliance Audit" },
  { path: "/client-onboarding", title: "Client Onboarding" },
];

test.describe("Admin Features — Auth Gating", () => {
  for (const { path, title } of ADMIN_PAGES) {
    test(`${title} does not cause auth redirect loop`, async ({ page }) => {
      await setupPage(page, path);
      
      // Page should be stable
      const url = page.url();
      expect(url).not.toContain("oauth");
      
      // Root should be visible
      await expect(page.locator("#root")).toBeVisible();
    });
  }
});

test.describe("Admin Features — Page Structure", () => {
  test("Admin page loads without crashing", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/admin");
    
    // No error boundary
    const errorBoundary = page.locator('text=/Something went wrong/i');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBe(false);
  });

  test("Compliance Audit page loads without crashing", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/compliance-audit");
    
    // No error boundary
    const errorBoundary = page.locator('text=/Something went wrong/i');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBe(false);
  });

  test("Client Onboarding page loads without crashing", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/client-onboarding");
    
    // No error boundary
    const errorBoundary = page.locator('text=/Something went wrong/i');
    const hasError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
    expect(hasError).toBe(false);
  });
});
