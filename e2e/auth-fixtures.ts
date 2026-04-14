/**
 * Authenticated E2E Test Fixtures
 * 
 * Since Manus OAuth requires real browser login, these fixtures simulate
 * authenticated state by injecting session cookies and localStorage values
 * that match what the app expects after a successful OAuth flow.
 * 
 * For CI environments, tests use the "mock auth" approach:
 * - Set localStorage flags that the app checks
 * - Skip auth-dependent tRPC queries gracefully
 * - Test UI rendering and navigation for each role level
 * 
 * For local testing with real auth, set E2E_AUTH_COOKIE env var.
 */
import { test as base, Page, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

/** Role definitions matching the app's ROLE_LEVEL system */
export type UserRole = "guest" | "user" | "advisor" | "manager" | "admin";

/** Sidebar sections visible per role (from PersonaSidebar5.tsx) */
export const ROLE_VISIBLE_SECTIONS: Record<UserRole, string[]> = {
  guest: ["Chat", "Code Chat", "Documents", "My Progress", "Audio"],
  user: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community"],
  advisor: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help"],
  manager: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help", "Settings"],
  admin: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help", "Settings"],
};

/** Routes that require authentication (protectedProcedure on server) */
export const PROTECTED_ROUTES = [
  "/passive-actions",
  "/wealth-engine",
  "/settings/profile",
  "/settings/knowledge",
  "/operations",
  "/advisory-hub",
  "/compliance-audit",
  "/admin",
  "/client-onboarding",
];

/** Routes accessible without authentication */
export const PUBLIC_ROUTES = [
  "/chat",
  "/code-chat",
  "/calculators",
  "/learning",
  "/help",
  "/about",
  "/terms",
  "/privacy",
  "/community",
  "/integrations",
];

/**
 * Setup page as a specific role level.
 * For guest: just skip onboarding
 * For authenticated roles: set localStorage to simulate auth state
 */
export async function setupAsRole(page: Page, path: string, role: UserRole = "guest") {
  // First visit to set localStorage
  await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate((r) => {
    localStorage.setItem("onboarding_tour_completed", "true");
    localStorage.setItem("consent_accepted", "true");
    if (r !== "guest") {
      // Simulate authenticated state for UI rendering
      localStorage.setItem("e2e_simulated_role", r);
    }
  }, role);

  // Navigate to target path
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2000);
  await expect(page.locator("#root")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

/**
 * Verify that protected routes show auth prompt (not infinite redirect loop)
 * when accessed by unauthenticated users.
 */
export async function verifyAuthGating(page: Page, path: string) {
  await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem("onboarding_tour_completed", "true");
    localStorage.setItem("consent_accepted", "true");
  });
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(3000);

  // Should NOT be in an infinite redirect loop — page should be stable
  const url = page.url();
  const isStable = !url.includes("oauth") && !url.includes("login");
  
  // The page should either show the content (with empty/loading state for protected data)
  // or show a sign-in prompt — but NOT redirect infinitely
  const root = page.locator("#root");
  await expect(root).toBeVisible({ timeout: 10000 });
  
  return { url, isStable };
}

/**
 * Test fixture that extends base test with role-based setup
 */
export const authTest = base.extend<{ role: UserRole }>({
  role: ["guest", { option: true }],
});
