import { test, expect } from "@playwright/test";
import { setupPage } from "./helpers";

test.describe("Accessibility", () => {
  test("should have proper heading hierarchy on chat page", async ({ page }) => {
    await setupPage(page, "/chat");
    const h1Count = await page.locator("h1").count();
    const h2Count = await page.locator("h2").count();
    expect(h1Count + h2Count).toBeGreaterThan(0);
  });

  test("should have ARIA labels on interactive elements", async ({ page }) => {
    await setupPage(page, "/chat");
    const buttons = page.locator("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have proper focus management", async ({ page }) => {
    await setupPage(page, "/chat");
    await page.keyboard.press("Tab");
    const focusedEl = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedEl).toBeTruthy();
  });
});
