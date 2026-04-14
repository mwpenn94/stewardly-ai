import { test, expect } from "@playwright/test";
import { setupPage } from "./helpers";

test.describe("Dark Theme Consistency", () => {
  test("should render with dark theme by default", async ({ page }) => {
    await setupPage(page, "/chat");
    const html = page.locator("html");
    const className = await html.getAttribute("class");
    expect(className).toContain("dark");
  });

  test("should have readable text on dark background", async ({ page }) => {
    await setupPage(page, "/chat");
    const bg = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).backgroundColor;
    });
    expect(bg).not.toBe("rgb(255, 255, 255)");
  });
});
