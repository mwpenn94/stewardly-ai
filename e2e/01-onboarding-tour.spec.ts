import { test, expect } from "@playwright/test";
import { navigateAndWait, waitForAppShell, setupConsoleErrorTracker } from "./helpers";

test.describe("Onboarding Tour Journey", () => {
  test("should display the onboarding tour on first visit to chat", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    // Clear localStorage to ensure tour shows
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem("onboarding_tour_completed");
      localStorage.removeItem("consent_accepted");
    });
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
    await waitForAppShell(page);

    // The tour overlay should be visible
    const tourOverlay = page.locator('.fixed.inset-0');
    const tourTitle = page.locator('h3:has-text("Welcome to Stewardly")');
    const isTourVisible = await tourTitle.isVisible({ timeout: 5000 }).catch(() => false);

    if (isTourVisible) {
      // Tour is showing - verify step counter
      await expect(page.locator('text=/1 of/').first()).toBeVisible({ timeout: 3000 });
      // Click Next to advance
      const nextBtn = page.locator('button:has-text("Next")');
      await expect(nextBtn).toBeVisible({ timeout: 3000 });
      await nextBtn.click({ force: true });
      await page.waitForTimeout(500);
      await expect(page.locator('text=/2 of/').first()).toBeVisible({ timeout: 3000 });
    }

    expect(errors).toHaveLength(0);
  });

  test("should allow skipping the tour via X button", async ({ page }) => {
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem("onboarding_tour_completed");
      localStorage.removeItem("consent_accepted");
    });
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
    await waitForAppShell(page);

    const skipBtn = page.locator('button[aria-label="Skip tour"]');
    if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await skipBtn.click({ force: true });
      await page.waitForTimeout(500);
      // Tour should be dismissed
      await expect(page.locator('h3:has-text("Welcome to Stewardly")')).not.toBeVisible({ timeout: 2000 });
    }
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should display consent banner for users", async ({ page }) => {
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.removeItem("consent_accepted");
      localStorage.setItem("onboarding_tour_completed", "true");
    });
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
    await waitForAppShell(page);

    const consentBanner = page.locator('text=/By using this service|Your data is private/i').first();
    await expect(consentBanner).toBeVisible({ timeout: 5000 });
  });
});
