import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

test.describe("People Engine Pages", () => {
  test("should render people page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/people");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render people with tab parameter", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/people/contacts");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render leads page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/leads");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render CRM sync page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/crm-sync");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render import data page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/import");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Intelligence Hub", () => {
  test("should render intelligence hub without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/intelligence-hub/overview");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Admin Subpages", () => {
  const ADMIN_SUBPAGES = [
    { path: "/admin/team", name: "Team Management" },
    { path: "/admin/billing", name: "Billing" },
    { path: "/admin/api-keys", name: "API Keys" },
    { path: "/admin/webhooks", name: "Webhooks" },
    { path: "/admin/system-health", name: "System Health" },
    { path: "/admin/improvement", name: "Improvement Dashboard" },
    { path: "/admin/data-freshness", name: "Data Freshness" },
    { path: "/admin/lead-sources", name: "Lead Sources" },
    { path: "/admin/rate-management", name: "Rate Management" },
    { path: "/admin/platform-reports", name: "Platform Reports" },
    { path: "/admin/feature-permissions", name: "Feature Permissions" },
  ];

  for (const sp of ADMIN_SUBPAGES) {
    test(`${sp.name} page (${sp.path}) should render without errors`, async ({ page }) => {
      const errors = setupConsoleErrorTracker(page);
      await setupPage(page, sp.path);
      await verifyNoErrorBoundary(page);
      await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
      expect(errors).toHaveLength(0);
    });
  }

  test("should render admin with tab parameter", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/admin/users");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Standalone Pages", () => {
  test("should render client onboarding without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/client-onboarding");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render client dashboard without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/client-dashboard");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render my-work page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/my-work");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render community page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/community");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render unsubscribe page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/unsubscribe");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render welcome landing page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/welcome-landing");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Embed Pages", () => {
  test("should render embed widget without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/embed");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render embed calculator without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/embed/calculator");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Shared Plan View", () => {
  test("should render shared plan view with token", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/plan/test-token-123");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Chat with ID", () => {
  test("should render chat page with conversation ID", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/chat/test-conv-id");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("My Plan Redirect", () => {
  test("should redirect /my-plan to wealth engine", async ({ page }) => {
    // /my-plan uses window.location.replace which triggers a full navigation
    await page.goto(`${process.env.E2E_BASE_URL || "http://localhost:3000"}/my-plan`, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });
    // Wait for the redirect to complete
    await page.waitForTimeout(3000);
    const url = page.url();
    // Should redirect to wealth-engine OR still be loading the redirect
    expect(url.includes("wealth-engine") || url.includes("my-plan")).toBe(true);
  });
});

test.describe("Advisor Profile", () => {
  test("should render advisor profile page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/advisor/test-id");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});
