import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Financial Planning Page", () => {
  test("should render financial planning page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/financial-planning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should display financial planning content or auth prompt", async ({ page }) => {
    await setupPage(page, "/financial-planning");
    // Page should render something meaningful — either content or sign-in prompt
    const hasContent = await page.locator("h1, h2, h3, [role='heading']").first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasSignIn = await page.locator("text=/sign in|log in|authenticate/i").first().isVisible({ timeout: 2000 }).catch(() => false);
    expect(hasContent || hasSignIn).toBe(true);
  });
});

test.describe("Tax Planning Page", () => {
  test("should render tax planning page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/tax-planning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Insurance Analysis Page", () => {
  test("should render insurance analysis page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/insurance-analysis");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Estate Planning Page", () => {
  test("should render estate planning page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/estate");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Social Security Page", () => {
  test("should render social security page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/social-security");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Medicare Analysis Page", () => {
  test("should render medicare analysis page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/medicare");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Risk Assessment Page", () => {
  test("should render risk assessment page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/risk-assessment");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Income Projection Page", () => {
  test("should render income projection page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/income-projection");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Protection Score Page", () => {
  test("should render protection score page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/protection-score");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Public Calculators Page", () => {
  test("should render public calculators page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/public-calculators");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Calculator Panel Navigation", () => {
  test("should navigate to specific calculator panel via URL", async ({ page }) => {
    await setupPage(page, "/calculators/cashflow");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
  });

  test("should navigate to wealth engine panel via URL", async ({ page }) => {
    await setupPage(page, "/wealth-engine/retirement");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
  });
});
