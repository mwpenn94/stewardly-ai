/**
 * E2E Test: Visual Regression
 * Captures screenshots of key pages and compares against baselines.
 * 
 * First run creates baseline screenshots in e2e/__screenshots__/
 * Subsequent runs compare against baselines with configurable threshold.
 * 
 * Usage:
 *   npx playwright test e2e/27-visual-regression.spec.ts --update-snapshots  # Create baselines
 *   npx playwright test e2e/27-visual-regression.spec.ts                     # Compare against baselines
 */
import { test, expect } from "@playwright/test";
import { setupPage } from "./helpers";

/** Key pages for visual regression testing */
const VISUAL_REGRESSION_PAGES = [
  { path: "/chat", name: "chat-page", description: "AI Chat interface" },
  { path: "/code-chat", name: "code-chat-page", description: "Code Chat interface" },
  { path: "/calculators", name: "calculators-page", description: "Financial Calculators hub" },
  { path: "/wealth-engine", name: "wealth-engine-hub", description: "Wealth Engine Hub" },
  { path: "/learning", name: "learning-page", description: "Learning & Certification" },
  { path: "/help", name: "help-page", description: "Help & Documentation" },
  { path: "/products", name: "products-page", description: "Products Marketplace" },
  { path: "/community", name: "community-page", description: "Community page" },
  { path: "/integrations", name: "integrations-page", description: "Integrations page" },
  { path: "/about", name: "about-page", description: "About / Landing page" },
];

test.describe("Visual Regression — Desktop", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  for (const { path, name, description } of VISUAL_REGRESSION_PAGES) {
    test(`${description} visual snapshot`, async ({ page }) => {
      await setupPage(page, path);
      // Wait for animations and lazy-loaded content to settle
      await page.waitForTimeout(2000);
      
      // Take full-page screenshot with tolerance for minor rendering differences
      await expect(page).toHaveScreenshot(`${name}-desktop.png`, {
        fullPage: false, // Viewport only to avoid scroll-dependent content
        maxDiffPixelRatio: 0.05, // Allow 5% pixel difference for font rendering
        threshold: 0.3, // Per-pixel color threshold
      });
    });
  }
});

test.describe("Visual Regression — Mobile", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone X

  const MOBILE_PAGES = [
    { path: "/chat", name: "chat-page", description: "AI Chat" },
    { path: "/calculators", name: "calculators-page", description: "Calculators" },
    { path: "/learning", name: "learning-page", description: "Learning" },
    { path: "/help", name: "help-page", description: "Help" },
  ];

  for (const { path, name, description } of MOBILE_PAGES) {
    test(`${description} mobile visual snapshot`, async ({ page }) => {
      await setupPage(page, path);
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot(`${name}-mobile.png`, {
        fullPage: false,
        maxDiffPixelRatio: 0.08, // Slightly more tolerance for mobile rendering
        threshold: 0.3,
      });
    });
  }
});

test.describe("Visual Regression — Dark Theme Components", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("Sidebar navigation visual consistency", async ({ page }) => {
    await setupPage(page, "/chat");
    await page.waitForTimeout(1000);
    
    // Capture just the sidebar area
    const sidebar = page.locator('nav, [class*="sidebar"], [class*="Sidebar"]').first();
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(sidebar).toHaveScreenshot("sidebar-desktop.png", {
        maxDiffPixelRatio: 0.05,
        threshold: 0.3,
      });
    }
  });

  test("Chat input area visual consistency", async ({ page }) => {
    await setupPage(page, "/chat");
    await page.waitForTimeout(1000);
    
    // Capture the chat input area
    const chatInput = page.locator('textarea, [class*="chat-input"], [class*="ChatInput"]').first();
    if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(chatInput).toHaveScreenshot("chat-input-desktop.png", {
        maxDiffPixelRatio: 0.05,
        threshold: 0.3,
      });
    }
  });
});
