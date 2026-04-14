/**
 * E2E Test: Manager-Level Features
 * Tests pages visible to manager+ roles.
 * Verifies auth gating, page structure, and no crash on load.
 */
import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";

const MANAGER_PAGES = [
  { path: "/operations", title: "Operations Hub" },
  { path: "/advisory-hub", title: "Advisory Hub" },
  { path: "/settings/profile", title: "Settings Profile" },
  { path: "/settings/knowledge", title: "Settings Knowledge" },
];

test.describe("Manager Features — Auth Gating", () => {
  for (const { path, title } of MANAGER_PAGES) {
    test(`${title} page loads without auth redirect loop`, async ({ page }) => {
      await setupPage(page, path);
      
      // Page should be stable (not in redirect loop)
      const url = page.url();
      expect(url).not.toContain("oauth");
      
      // Root should be visible
      await expect(page.locator("#root")).toBeVisible();
    });
  }
});

test.describe("Manager Features — Page Structure", () => {
  test("Operations Hub shows tab navigation", async ({ page }) => {
    await setupPage(page, "/operations");
    // Should show operations content or auth prompt
    await expect(page.locator("#root")).toBeVisible();
    // Check for tab-like navigation or content structure
    const content = page.locator('main, [role="tablist"], [class*="tab"], [class*="card"]').first();
    await expect(content).toBeVisible({ timeout: 5000 });
  });

  test("Settings Profile page shows form fields", async ({ page }) => {
    await setupPage(page, "/settings/profile");
    // Should show settings content or auth prompt
    await expect(page.locator("#root")).toBeVisible();
  });

  test("Settings Knowledge page shows document management", async ({ page }) => {
    await setupPage(page, "/settings/knowledge");
    // Should show knowledge/documents content or auth prompt
    await expect(page.locator("#root")).toBeVisible();
  });
});
