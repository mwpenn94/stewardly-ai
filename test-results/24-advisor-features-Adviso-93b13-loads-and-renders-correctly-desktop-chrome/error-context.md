# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 24-advisor-features.spec.ts >> Advisor Features — Page Structure >> Products page loads and renders correctly
- Location: e2e/24-advisor-features.spec.ts:22:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('button:has-text("Got it")')
    - locator resolved to <button class="text-xs font-medium text-foreground bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap">Got it</button>

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T"
  - generic [ref=e3]:
    - heading "Command Palette" [level=2] [ref=e4]
    - paragraph [ref=e5]: Search pages, actions, and conversations
  - dialog "Multisensory tour" [ref=e6]:
    - generic [ref=e7]:
      - generic [ref=e8]:
        - generic [ref=e9]:
          - img [ref=e11]
          - generic [ref=e12]:
            - heading "Multisensory tour" [level=3] [ref=e13]
            - paragraph [ref=e14]: Voice + keyboard + screen reader
        - button "Dismiss voice tour" [ref=e15] [cursor=pointer]:
          - img [ref=e16]
      - list [ref=e19]:
        - listitem [ref=e20]:
          - img [ref=e22]
          - generic [ref=e24]:
            - generic [ref=e25]: Shift + V
            - paragraph [ref=e26]: Toggle hands-free mode from any page.
        - listitem [ref=e27]:
          - img [ref=e29]
          - generic [ref=e31]:
            - generic [ref=e32]: Shift + R
            - paragraph [ref=e33]: Read the current page aloud in any Stewardship voice.
        - listitem [ref=e34]:
          - img [ref=e36]
          - generic [ref=e39]:
            - generic [ref=e40]: Say "send", "stop", or a page name
            - paragraph [ref=e41]: Once hands-free is on, talk to Steward like a colleague. "Stop" aborts the current response.
      - generic [ref=e42]:
        - button "Maybe later" [ref=e43] [cursor=pointer]
        - button "Try it now" [ref=e44] [cursor=pointer]
  - status [ref=e45]
  - alert [ref=e46]
  - button "Enter hands-free voice mode (Alt+H)" [ref=e47] [cursor=pointer]:
    - img [ref=e48]
    - generic [ref=e54]: Hands-free off
  - generic [ref=e96]:
    - paragraph [ref=e97]:
      - text: By using this service, you agree to our
      - link "Terms of Service" [ref=e98] [cursor=pointer]:
        - /url: /terms
      - text: and
      - link "Privacy Policy" [ref=e99] [cursor=pointer]:
        - /url: /privacy
      - text: . Your data is private by default.
    - button "Got it" [ref=e100] [cursor=pointer]
    - button "Dismiss" [ref=e101] [cursor=pointer]:
      - img [ref=e102]
  - button "Help & Tips" [ref=e105] [cursor=pointer]:
    - img
```

# Test source

```ts
  1   | import { Page, expect } from "@playwright/test";
  2   | 
  3   | const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
  4   | 
  5   | /** Navigate to a path and wait for DOM content */
  6   | export async function navigateAndWait(page: Page, path: string) {
  7   |   await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  8   |   await page.waitForTimeout(2000);
  9   | }
  10  | 
  11  | /** Wait for the app shell to render */
  12  | export async function waitForAppShell(page: Page) {
  13  |   await expect(page.locator("#root")).toBeVisible({ timeout: 15000 });
  14  |   await page.waitForTimeout(1000);
  15  | }
  16  | 
  17  | /**
  18  |  * Pre-set localStorage to skip onboarding tour before navigating.
  19  |  * This prevents the z-[10000] overlay from blocking all interactions.
  20  |  */
  21  | export async function skipOnboardingViaStorage(page: Page) {
  22  |   await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
  23  |   await page.evaluate(() => {
  24  |     localStorage.setItem("onboarding_tour_completed", "true");
  25  |     localStorage.setItem("consent_accepted", "true");
  26  |   });
  27  | }
  28  | 
  29  | /** Dismiss any remaining overlays (consent banner, modals) */
  30  | export async function dismissOverlays(page: Page) {
  31  |   // Try to dismiss onboarding tour via the Skip tour button (aria-label)
  32  |   const skipTourBtn = page.locator('button[aria-label="Skip tour"]');
  33  |   if (await skipTourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
  34  |     await skipTourBtn.click({ force: true });
  35  |     await page.waitForTimeout(500);
  36  |   }
  37  | 
  38  |   // Dismiss consent banner "Got it" button
  39  |   const gotItBtn = page.locator('button:has-text("Got it")');
  40  |   if (await gotItBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
> 41  |     await gotItBtn.click({ force: true });
      |                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
  42  |     await page.waitForTimeout(300);
  43  |   }
  44  | 
  45  |   // Close any X dismiss buttons
  46  |   const closeBtns = page.locator('button[aria-label="Close"], button[aria-label="Dismiss"]');
  47  |   const closeCount = await closeBtns.count();
  48  |   for (let i = 0; i < Math.min(closeCount, 3); i++) {
  49  |     const btn = closeBtns.nth(i);
  50  |     if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
  51  |       await btn.click({ force: true });
  52  |       await page.waitForTimeout(200);
  53  |     }
  54  |   }
  55  | 
  56  |   await page.waitForTimeout(300);
  57  | }
  58  | 
  59  | /**
  60  |  * Full page setup: skip onboarding via localStorage, navigate, wait for shell, dismiss remaining overlays.
  61  |  * This is the primary helper for most tests (except onboarding tour tests).
  62  |  */
  63  | export async function setupPage(page: Page, path: string) {
  64  |   // Pre-set localStorage to bypass onboarding tour
  65  |   await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  66  |   await page.evaluate(() => {
  67  |     localStorage.setItem("onboarding_tour_completed", "true");
  68  |     localStorage.setItem("consent_accepted", "true");
  69  |   });
  70  |   // Reload with localStorage set
  71  |   await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  72  |   await page.waitForTimeout(2000);
  73  |   await waitForAppShell(page);
  74  |   // Dismiss any remaining overlays
  75  |   await dismissOverlays(page);
  76  | }
  77  | 
  78  | /** Track console errors (excluding known transient ones) */
  79  | export function setupConsoleErrorTracker(page: Page): string[] {
  80  |   const errors: string[] = [];
  81  |   page.on("console", (msg) => {
  82  |     if (msg.type() === "error") {
  83  |       const text = msg.text();
  84  |       if (
  85  |         text.includes("Failed to fetch") ||
  86  |         text.includes("net::ERR") ||
  87  |         text.includes("favicon") ||
  88  |         text.includes("HMR") ||
  89  |         text.includes("WebSocket") ||
  90  |         text.includes("rate limit") ||
  91  |         text.includes("429") ||
  92  |         text.includes("API Query Error") ||
  93  |         text.includes("ResizeObserver")
  94  |       ) return;
  95  |       errors.push(text);
  96  |     }
  97  |   });
  98  |   return errors;
  99  | }
  100 | 
  101 | /** Verify no React error boundary is showing */
  102 | export async function verifyNoErrorBoundary(page: Page) {
  103 |   const errorBoundary = page.locator('text=/Something went wrong|Error boundary|Unhandled/i');
  104 |   const isError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
  105 |   expect(isError).toBe(false);
  106 | }
  107 | 
```