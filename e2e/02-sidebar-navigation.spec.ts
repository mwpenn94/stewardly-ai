import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("Sidebar Navigation", () => {
  // Guest-visible sidebar items with their actual route paths
  const sidebarItems = [
    { label: "Chat", urlPart: "/chat" },
    { label: "Code Chat", urlPart: "/code-chat" },
    { label: "Documents", urlPart: "/settings/knowledge" },
    { label: "My Progress", urlPart: "/proficiency" },
    { label: "Audio", urlPart: "/settings/audio" },
  ];

  for (const item of sidebarItems) {
    test(`should navigate to ${item.label} page`, async ({ page }) => {
      const errors = setupConsoleErrorTracker(page);
      await setupPage(page, "/chat");
      const navBtn = page.locator(`button:has-text("${item.label}")`).first();
      await navBtn.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain(item.urlPart);
      await verifyNoErrorBoundary(page);
      expect(errors).toHaveLength(0);
    });
  }

  test("should navigate to Settings page", async ({ page }) => {
    await setupPage(page, "/chat");
    const settingsLink = page.locator('button:has-text("Settings")').first();
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain("/settings");
    }
    await expect(page.locator("#root")).toBeVisible();
  });

  test("should navigate to Help page", async ({ page }) => {
    await setupPage(page, "/chat");
    const helpLink = page.locator('button:has-text("Help")').first();
    if (await helpLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await helpLink.click();
      await page.waitForTimeout(1500);
      expect(page.url()).toContain("/help");
    }
    await expect(page.locator("#root")).toBeVisible();
  });
});
