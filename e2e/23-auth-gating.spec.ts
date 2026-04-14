/**
 * E2E Test: Auth Gating — Verify protected routes don't cause auth redirect loops
 * and show appropriate content for unauthenticated users.
 */
import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";
import { verifyAuthGating, PROTECTED_ROUTES, PUBLIC_ROUTES } from "./auth-fixtures";

test.describe("Auth Gating — Protected Routes", () => {
  for (const route of PROTECTED_ROUTES) {
    test(`${route} does not cause auth redirect loop`, async ({ page }) => {
      const { url, isStable } = await verifyAuthGating(page, route);
      // Page should be stable (not redirecting)
      expect(isStable).toBe(true);
      // Root should be visible
      await expect(page.locator("#root")).toBeVisible();
    });
  }
});

test.describe("Auth Gating — Public Routes Accessible", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`${route} loads without authentication`, async ({ page }) => {
      await setupPage(page, route);
      // Root should be visible
      await expect(page.locator("#root")).toBeVisible();
      // Should not redirect to login
      const url = page.url();
      expect(url).not.toContain("oauth");
      expect(url).not.toContain("login");
    });
  }
});

test.describe("Auth Gating — No Console Errors on Protected Routes", () => {
  const criticalRoutes = ["/passive-actions", "/wealth-engine", "/settings/profile"];
  
  for (const route of criticalRoutes) {
    test(`${route} shows no critical console errors`, async ({ page }) => {
      const errors = setupConsoleErrorTracker(page);
      await setupPage(page, route);
      await page.waitForTimeout(2000);
      
      // Filter out expected auth-related errors
      const criticalErrors = errors.filter(e => 
        !e.includes("UNAUTHORIZED") && 
        !e.includes("401") &&
        !e.includes("auth") &&
        !e.includes("login")
      );
      
      // Should have no critical non-auth errors
      expect(criticalErrors.length).toBe(0);
    });
  }
});
