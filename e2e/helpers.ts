import { Page, expect } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

/** Navigate to a path and wait for DOM content */
export async function navigateAndWait(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2000);
}

/** Wait for the app shell to render */
export async function waitForAppShell(page: Page) {
  await expect(page.locator("#root")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1000);
}

/**
 * Pre-set localStorage to skip onboarding tour before navigating.
 * This prevents the z-[10000] overlay from blocking all interactions.
 */
export async function skipOnboardingViaStorage(page: Page) {
  await page.goto(`${BASE}/chat`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem("onboarding_tour_completed", "true");
    localStorage.setItem("consent_accepted", "true");
  });
}

/** Dismiss any remaining overlays (consent banner, modals) */
export async function dismissOverlays(page: Page) {
  // Try to dismiss onboarding tour via the Skip tour button (aria-label)
  const skipTourBtn = page.locator('button[aria-label="Skip tour"]');
  if (await skipTourBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipTourBtn.click({ force: true });
    await page.waitForTimeout(500);
  }

  // Dismiss consent banner "Got it" button
  const gotItBtn = page.locator('button:has-text("Got it")');
  if (await gotItBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await gotItBtn.click({ force: true });
    await page.waitForTimeout(300);
  }

  // Close any X dismiss buttons
  const closeBtns = page.locator('button[aria-label="Close"], button[aria-label="Dismiss"]');
  const closeCount = await closeBtns.count();
  for (let i = 0; i < Math.min(closeCount, 3); i++) {
    const btn = closeBtns.nth(i);
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click({ force: true });
      await page.waitForTimeout(200);
    }
  }

  await page.waitForTimeout(300);
}

/**
 * Full page setup: skip onboarding via localStorage, navigate, wait for shell, dismiss remaining overlays.
 * This is the primary helper for most tests (except onboarding tour tests).
 */
export async function setupPage(page: Page, path: string) {
  // Pre-set localStorage to bypass onboarding tour
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.evaluate(() => {
    localStorage.setItem("onboarding_tour_completed", "true");
    localStorage.setItem("consent_accepted", "true");
  });
  // Reload with localStorage set
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(2000);
  await waitForAppShell(page);
  // Dismiss any remaining overlays
  await dismissOverlays(page);
}

/** Track console errors (excluding known transient ones) */
export function setupConsoleErrorTracker(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (
        text.includes("Failed to fetch") ||
        text.includes("net::ERR") ||
        text.includes("favicon") ||
        text.includes("HMR") ||
        text.includes("WebSocket") ||
        text.includes("rate limit") ||
        text.includes("429") ||
        text.includes("API Query Error") ||
        text.includes("ResizeObserver")
      ) return;
      errors.push(text);
    }
  });
  return errors;
}

/** Verify no React error boundary is showing */
export async function verifyNoErrorBoundary(page: Page) {
  const errorBoundary = page.locator('text=/Something went wrong|Error boundary|Unhandled/i');
  const isError = await errorBoundary.isVisible({ timeout: 1000 }).catch(() => false);
  expect(isError).toBe(false);
}
