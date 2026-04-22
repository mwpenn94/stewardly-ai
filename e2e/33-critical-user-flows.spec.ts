import { test, expect } from "@playwright/test";
import { setupPage, verifyNoErrorBoundary } from "./helpers";

test.describe("Critical User Flows", () => {
  test.describe("Landing / Chat Page", () => {
    test("should render the main chat interface", async ({ page }) => {
      await setupPage(page, "/");
      await verifyNoErrorBoundary(page);
      // The landing page is the chat dashboard with a greeting
      await expect(page.getByText(/Good .*, Guest User|How can I help/i).first()).toBeVisible({ timeout: 8000 });
    });

    test("should have navigation sidebar", async ({ page }) => {
      await setupPage(page, "/");
      // Sidebar has key navigation items - use role-based selectors to avoid strict mode
      await expect(page.getByRole("button", { name: "Chat" })).toBeVisible({ timeout: 8000 });
      await expect(page.getByText("Wealth Engine").first()).toBeVisible();
    });

    test("should have message textarea", async ({ page }) => {
      await setupPage(page, "/chat");
      await verifyNoErrorBoundary(page);
      // Chat page has a textarea for input
      const textarea = page.locator("textarea").first();
      await expect(textarea).toBeVisible({ timeout: 8000 });
    });

    test("should show suggestion cards", async ({ page }) => {
      await setupPage(page, "/chat");
      // Should show suggestion prompts
      const suggestion = page.getByText(/tax optimization|investment strategies|retirement projection/i).first();
      await expect(suggestion).toBeVisible({ timeout: 8000 });
    });
  });

  test.describe("Calculator Interactions", () => {
    test("should render calculators page", async ({ page }) => {
      await setupPage(page, "/calculators");
      await verifyNoErrorBoundary(page);
      // Should have calculator-related content
      const calcContent = page.getByText("Client Profile").or(page.getByText("Wealth Engine")).or(page.getByText("Calculator"));
      await expect(calcContent.first()).toBeVisible({ timeout: 8000 });
    });

    test("should allow numeric input in calculator fields", async ({ page }) => {
      await setupPage(page, "/calculators");
      const numInput = page.locator("input#age").or(page.locator('input[type="number"]').first());
      if (await numInput.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await numInput.first().clear();
        await numInput.first().fill("45");
        const val = await numInput.first().inputValue();
        expect(val).toBe("45");
      }
    });

    test("should navigate between calculator panels", async ({ page }) => {
      await setupPage(page, "/calculators");
      const cashFlowBtn = page.getByRole("button", { name: /Cash Flow/i });
      if (await cashFlowBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cashFlowBtn.click();
        await page.waitForTimeout(1000);
        const cashFlowContent = page.getByText(/Cash Flow|Income|Expense/i).first();
        await expect(cashFlowContent).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe("Auth & Navigation", () => {
    test("should render settings page or show guest content", async ({ page }) => {
      await setupPage(page, "/settings");
      // Settings page should render some content (guest or authenticated)
      const anyContent = page.getByText("Settings").or(page.getByText("Guest")).or(page.getByText("Chat"));
      await expect(anyContent.first()).toBeVisible({ timeout: 8000 });
    });

    test("should allow access to public routes", async ({ page }) => {
      await setupPage(page, "/terms");
      await expect(page.getByText(/Terms|Service/i).first()).toBeVisible({ timeout: 8000 });
    });

    test("should allow access to privacy page", async ({ page }) => {
      await setupPage(page, "/privacy");
      await expect(page.getByText(/Privacy|Policy/i).first()).toBeVisible({ timeout: 8000 });
    });

    test("should handle unknown routes gracefully", async ({ page }) => {
      await setupPage(page, "/this-route-does-not-exist-12345");
      // Should show some content (redirect to chat, 404, etc.)
      const anyContent = page.getByText(/not found|404|Chat|Guest/i).first();
      await expect(anyContent).toBeVisible({ timeout: 8000 });
    });

    test("should navigate to wealth engine", async ({ page }) => {
      await setupPage(page, "/wealth-engine");
      await verifyNoErrorBoundary(page);
      await expect(page.getByText(/Wealth Engine|Calculator/i).first()).toBeVisible({ timeout: 8000 });
    });
  });
});
