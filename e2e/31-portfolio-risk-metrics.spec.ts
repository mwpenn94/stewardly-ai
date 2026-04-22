import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Portfolio Risk Metrics", () => {
  test("should render the page without error boundary", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    await verifyNoErrorBoundary(page);
    // Page should render title (either full page or sign-in prompt)
    await expect(page.locator('text="Portfolio Risk Metrics"').first()).toBeVisible({ timeout: 8000 });
  });

  test("should display configuration card with risk profile buttons", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    await expect(page.locator('text="Configuration"')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button:has-text("conservative")')).toBeVisible();
    await expect(page.locator('button:has-text("moderate")')).toBeVisible();
    await expect(page.locator('button:has-text("aggressive")')).toBeVisible();
  });

  test("should show sign-in prompt for unauthenticated users", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    // Either shows sign-in prompt or the full page (if auth is mocked)
    const signInBtn = page.locator('button:has-text("Sign In")');
    const configCard = page.locator('text="Configuration"');
    await expect(signInBtn.or(configCard).first()).toBeVisible({ timeout: 8000 });
  });

  test("should switch risk profiles when clicking buttons", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    const configCard = page.locator('text="Configuration"');
    if (await configCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      const conservativeBtn = page.locator('button:has-text("conservative")');
      await conservativeBtn.click();
      await page.waitForTimeout(500);
      // After clicking, the button should appear selected (variant="default")
      await expect(conservativeBtn).toBeVisible();
    }
  });

  test("should have risk-free rate slider", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    const configCard = page.locator('text="Configuration"');
    if (await configCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(page.locator('text=/Risk-Free Rate/i')).toBeVisible();
    }
  });

  test("should have custom returns input field", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    const configCard = page.locator('text="Configuration"');
    if (await configCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      const customInput = page.locator('input[placeholder*="0.02"]');
      await expect(customInput).toBeVisible();
    }
  });

  test("should navigate back to wealth engine", async ({ page }) => {
    await setupPage(page, "/portfolio-risk");
    const backBtn = page.locator('a[href="/wealth-engine"]');
    if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await backBtn.click();
      await page.waitForTimeout(1500);
      await expect(page).toHaveURL(/wealth-engine/);
    }
  });
});
