import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker } from "./helpers";

test.describe("AI Chat Conversation Flow", () => {
  test("should render chat page with greeting", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/chat");
    await expect(
      page.locator('h2').filter({ hasText: /Good morning|Good afternoon|Good evening/ }).first()
    ).toBeVisible({ timeout: 5000 });
    expect(errors).toHaveLength(0);
  });

  test("should display action cards", async ({ page }) => {
    await setupPage(page, "/chat");
    await expect(page.locator('text="Ask Anything"')).toBeVisible({ timeout: 5000 });
  });

  test("should have a functional chat input area", async ({ page }) => {
    await setupPage(page, "/chat");
    const chatInput = page.locator("textarea").first();
    await expect(chatInput).toBeVisible({ timeout: 5000 });
    await chatInput.fill("What is term life insurance?");
    const inputValue = await chatInput.inputValue();
    expect(inputValue).toBe("What is term life insurance?");
  });

  test("should show mode selector tabs", async ({ page }) => {
    await setupPage(page, "/chat");
    await expect(page.locator('text="General"')).toBeVisible({ timeout: 5000 });
  });

  test("should display New Conversation button", async ({ page }) => {
    await setupPage(page, "/chat");
    const newChatBtn = page.locator('button:has-text("New Conversation")').first();
    await expect(newChatBtn).toBeVisible({ timeout: 5000 });
  });
});
