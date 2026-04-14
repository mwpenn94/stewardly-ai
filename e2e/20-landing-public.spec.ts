import { test, expect } from "@playwright/test";
import { setupPage } from "./helpers";

test.describe("Landing Page & Public Routes", () => {
  test("should render landing page at root URL", async ({ page }) => {
    await setupPage(page, "/");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("should render terms page", async ({ page }) => {
    await setupPage(page, "/terms");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("should render privacy page", async ({ page }) => {
    await setupPage(page, "/privacy");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    const bodyText = await page.textContent("body");
    expect(bodyText!.length).toBeGreaterThan(50);
  });

  test("should handle 404 gracefully", async ({ page }) => {
    await setupPage(page, "/nonexistent-page-xyz");
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
  });
});
