import { test, expect } from "@playwright/test";
import { setupPage, verifyNoErrorBoundary } from "./helpers";

test.describe("Wealth Engine Sub-pages", () => {
  const subpages = [
    { path: "/passive-actions", name: "Passive Actions" },
    { path: "/insights", name: "Insights" },
    { path: "/suitability", name: "Suitability" },
  ];

  for (const sp of subpages) {
    test(sp.name + " page should render without errors", async ({ page }) => {
      await setupPage(page, sp.path);
      await verifyNoErrorBoundary(page);
      await expect(page.locator("#root")).toBeVisible();
      const bodyText = await page.textContent("body");
      expect(bodyText!.length).toBeGreaterThan(100);
    });
  }
});
