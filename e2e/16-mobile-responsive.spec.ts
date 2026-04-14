import { test, expect } from "@playwright/test";
import { setupPage, verifyNoErrorBoundary } from "./helpers";

test.describe("Mobile Responsive Layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("should render chat page on mobile", async ({ page }) => {
    await setupPage(page, "/chat");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should render calculators page on mobile", async ({ page }) => {
    await setupPage(page, "/calculators");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should render settings page on mobile", async ({ page }) => {
    await setupPage(page, "/settings/profile");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should render learning page on mobile", async ({ page }) => {
    await setupPage(page, "/learning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should render help page on mobile", async ({ page }) => {
    await setupPage(page, "/help");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible();
  });
});
