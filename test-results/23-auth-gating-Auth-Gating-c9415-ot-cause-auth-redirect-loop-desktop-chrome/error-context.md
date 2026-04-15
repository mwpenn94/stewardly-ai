# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 23-auth-gating.spec.ts >> Auth Gating — Protected Routes >> /settings/knowledge does not cause auth redirect loop
- Location: e2e/23-auth-gating.spec.ts:11:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/chat
Call log:
  - navigating to "http://localhost:3000/chat", waiting until "domcontentloaded"

```

# Test source

```ts
  1   | /**
  2   |  * Authenticated E2E Test Fixtures
  3   |  * 
  4   |  * Since Manus OAuth requires real browser login, these fixtures simulate
  5   |  * authenticated state by injecting session cookies and localStorage values
  6   |  * that match what the app expects after a successful OAuth flow.
  7   |  * 
  8   |  * For CI environments, tests use the "mock auth" approach:
  9   |  * - Set localStorage flags that the app checks
  10  |  * - Skip auth-dependent tRPC queries gracefully
  11  |  * - Test UI rendering and navigation for each role level
  12  |  * 
  13  |  * For local testing with real auth, set E2E_AUTH_COOKIE env var.
  14  |  */
  15  | import { test as base, Page, expect } from "@playwright/test";
  16  | 
  17  | const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
  18  | 
  19  | /** Role definitions matching the app's ROLE_LEVEL system */
  20  | export type UserRole = "guest" | "user" | "advisor" | "manager" | "admin";
  21  | 
  22  | /** Sidebar sections visible per role (from PersonaSidebar5.tsx) */
  23  | export const ROLE_VISIBLE_SECTIONS: Record<UserRole, string[]> = {
  24  |   guest: ["Chat", "Code Chat", "Documents", "My Progress", "Audio"],
  25  |   user: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community"],
  26  |   advisor: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help"],
  27  |   manager: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help", "Settings"],
  28  |   admin: ["Chat", "Code Chat", "Documents", "My Progress", "Audio", "Passive Actions", "Products", "Integrations", "Community", "Wealth Engine", "Learn", "Help", "Settings"],
  29  | };
  30  | 
  31  | /** Routes that require authentication (protectedProcedure on server) */
  32  | export const PROTECTED_ROUTES = [
  33  |   "/passive-actions",
  34  |   "/wealth-engine",
  35  |   "/settings/profile",
  36  |   "/settings/knowledge",
  37  |   "/operations",
  38  |   "/advisory-hub",
  39  |   "/compliance-audit",
  40  |   "/admin",
  41  |   "/client-onboarding",
  42  | ];
  43  | 
  44  | /** Routes accessible without authentication */
  45  | export const PUBLIC_ROUTES = [
  46  |   "/chat",
  47  |   "/code-chat",
  48  |   "/calculators",
  49  |   "/learning",
  50  |   "/help",
  51  |   "/about",
  52  |   "/terms",
  53  |   "/privacy",
  54  |   "/community",
  55  |   "/integrations",
  56  | ];
  57  | 
  58  | /**
  59  |  * Setup page as a specific role level.
  60  |  * For guest: just skip onboarding
  61  |  * For authenticated roles: set localStorage to simulate auth state
  62  |  */
  63  | export async function setupAsRole(page: Page, path: string, role: UserRole = "guest") {
  64  |   // First visit to set localStorage
  65  |   await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
  66  |   await page.evaluate((r) => {
  67  |     localStorage.setItem("onboarding_tour_completed", "true");
  68  |     localStorage.setItem("consent_accepted", "true");
  69  |     if (r !== "guest") {
  70  |       // Simulate authenticated state for UI rendering
  71  |       localStorage.setItem("e2e_simulated_role", r);
  72  |     }
  73  |   }, role);
  74  | 
  75  |   // Navigate to target path
  76  |   await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  77  |   await page.waitForTimeout(2000);
  78  |   await expect(page.locator("#root")).toBeVisible({ timeout: 15000 });
  79  |   await page.waitForTimeout(1000);
  80  | }
  81  | 
  82  | /**
  83  |  * Verify that protected routes show auth prompt (not infinite redirect loop)
  84  |  * when accessed by unauthenticated users.
  85  |  */
  86  | export async function verifyAuthGating(page: Page, path: string) {
> 87  |   await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
      |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/chat
  88  |   await page.evaluate(() => {
  89  |     localStorage.setItem("onboarding_tour_completed", "true");
  90  |     localStorage.setItem("consent_accepted", "true");
  91  |   });
  92  |   await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  93  |   await page.waitForTimeout(3000);
  94  | 
  95  |   // Should NOT be in an infinite redirect loop — page should be stable
  96  |   const url = page.url();
  97  |   const isStable = !url.includes("oauth") && !url.includes("login");
  98  |   
  99  |   // The page should either show the content (with empty/loading state for protected data)
  100 |   // or show a sign-in prompt — but NOT redirect infinitely
  101 |   const root = page.locator("#root");
  102 |   await expect(root).toBeVisible({ timeout: 10000 });
  103 |   
  104 |   return { url, isStable };
  105 | }
  106 | 
  107 | /**
  108 |  * Test fixture that extends base test with role-based setup
  109 |  */
  110 | export const authTest = base.extend<{ role: UserRole }>({
  111 |   role: ["guest", { option: true }],
  112 | });
  113 | 
```