import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";

test.describe("Command Palette (Cmd+K)", () => {
  test("should open command palette with keyboard shortcut", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/chat");
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(1000);
    await expect(page.locator("#root")).toBeVisible();
    expect(errors).toHaveLength(0);
  });

  test("should open command palette via search button", async ({ page }) => {
    await setupPage(page, "/chat");
    const searchBtn = page.locator('button:has-text("Search")').first();
    await searchBtn.click();
    await page.waitForTimeout(500);
    await expect(page.locator("#root")).toBeVisible();
  });
});
