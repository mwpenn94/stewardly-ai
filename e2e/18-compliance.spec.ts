import { test, expect } from "@playwright/test";
import { setupPage } from "./helpers";

test.describe("Compliance Footer & Disclosures", () => {
  const pagesToCheck = [
    { path: "/calculators", name: "Calculators" },
    { path: "/help", name: "Help" },
  ];

  for (const pg of pagesToCheck) {
    test(pg.name + " page should have compliance footer", async ({ page }) => {
      await setupPage(page, pg.path);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);
      const tosLink = page.locator('a:has-text("Terms of Service")').first();
      const disclaimer = page.locator('text=/Not a substitute|professional financial|educational|illustrative/i').first();
      const tosVisible = await tosLink.isVisible({ timeout: 3000 }).catch(() => false);
      const disclaimerVisible = await disclaimer.isVisible({ timeout: 3000 }).catch(() => false);
      expect(tosVisible || disclaimerVisible).toBe(true);
    });
  }

  test("should have consent banner on fresh visit", async ({ page }) => {
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.evaluate(() => {
      localStorage.setItem("onboarding_tour_completed", "true");
      localStorage.removeItem("consent_accepted");
    });
    await page.goto("http://localhost:3000/chat", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForTimeout(3000);
    const consentBanner = page.locator('text=/By using this service|Terms of Service|Privacy Policy/i').first();
    await expect(consentBanner).toBeVisible({ timeout: 5000 });
  });

  test("Calculators page should have detailed disclosures", async ({ page }) => {
    await setupPage(page, "/calculators");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    const disclosure = page.locator('text=/disclosure|illustrative|educational|not a substitute/i').first();
    await expect(disclosure).toBeVisible({ timeout: 5000 });
  });
});
