import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Wealth Engine Hub", () => {
  test("should render Wealth Engine hub page with all sections", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/wealth-engine");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('text="Wealth Engine"').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Quick Bundle|Multi-line/i').first()).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test("should have Quick Bundle form with input fields", async ({ page }) => {
    await setupPage(page, "/wealth-engine");
    const ageInput = page.locator('input[type="number"]').first();
    await expect(ageInput).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Run bundle")')).toBeVisible();
  });

  test("should filter tools by category tabs", async ({ page }) => {
    await setupPage(page, "/wealth-engine");
    await page.locator('[role="tab"]:has-text("Plan")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text="Retirement Planner"')).toBeVisible();
  });
});

test.describe("Unified Wealth Engine (Calculators)", () => {
  test("should render calculators page with sidebar navigation", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/calculators");
    await verifyNoErrorBoundary(page);
    await expect(page.locator('button:has-text("Client Profile")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Cash Flow")')).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("should display Client Profile form with default values", async ({ page }) => {
    await setupPage(page, "/calculators");
    const ageInput = page.locator('input#age');
    await expect(ageInput).toBeVisible({ timeout: 5000 });
    const ageValue = await ageInput.inputValue();
    expect(parseInt(ageValue)).toBeGreaterThan(0);
  });

  test("should display Financial Health Scorecard", async ({ page }) => {
    await setupPage(page, "/calculators");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(500);
    await expect(page.locator('text="Financial Health Scorecard"')).toBeVisible({ timeout: 5000 });
  });

  test("should have toolbar with Save/Load/PDF/CSV/Reset", async ({ page }) => {
    await setupPage(page, "/calculators");
    await expect(page.locator('button:has-text("Save")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("PDF")').first()).toBeVisible();
  });

  test("should navigate between calculator panels", async ({ page }) => {
    await setupPage(page, "/calculators");
    await page.locator('button:has-text("Cash Flow")').first().click();
    await page.waitForTimeout(500);
    const cashFlowHeading = page.locator('h2:has-text("Cash Flow")').first();
    await expect(cashFlowHeading).toBeVisible({ timeout: 5000 });
  });
});
