import { test, expect } from "@playwright/test";
import { setupPage, setupConsoleErrorTracker, verifyNoErrorBoundary } from "./helpers";

const LEARNING_SUBPAGES = [
  { path: "/learning/achievements", name: "Achievements" },
  { path: "/learning/ai-quiz", name: "AI Quiz" },
  { path: "/learning/analytics", name: "Analytics" },
  { path: "/learning/bookmarks", name: "Bookmarks" },
  { path: "/learning/connections", name: "Connections" },
  { path: "/learning/discovery", name: "Discovery" },
  { path: "/learning/export", name: "Export" },
  { path: "/learning/formula-lab", name: "Formula Lab" },
  { path: "/learning/groups", name: "Study Groups" },
  { path: "/learning/hands-free", name: "Hands-Free Study" },
  { path: "/learning/licenses", name: "Licenses" },
  { path: "/learning/peer-groups", name: "Peer Groups" },
  { path: "/learning/playlists", name: "Playlists" },
  { path: "/learning/review", name: "Review" },
  { path: "/learning/search", name: "Search" },
  { path: "/learning/studio", name: "Studio" },
  { path: "/learning/study-buddy", name: "Study Buddy" },
];

test.describe("Learning Engine Subpages", () => {
  for (const sp of LEARNING_SUBPAGES) {
    test(`${sp.name} page (${sp.path}) should render without errors`, async ({ page }) => {
      const errors = setupConsoleErrorTracker(page);
      await setupPage(page, sp.path);
      await verifyNoErrorBoundary(page);
      await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
      expect(errors).toHaveLength(0);
    });
  }
});

test.describe("Learning Track Navigation", () => {
  test("should render a discipline page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/learning/discipline/financial-planning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });

  test("should render a track page without errors", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/learning/tracks/retirement-planning");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});

test.describe("Learning Studio Tabs", () => {
  test("should render studio with tab parameter", async ({ page }) => {
    const errors = setupConsoleErrorTracker(page);
    await setupPage(page, "/learning/studio/create");
    await verifyNoErrorBoundary(page);
    await expect(page.locator("#root")).toBeVisible({ timeout: 10000 });
    expect(errors).toHaveLength(0);
  });
});
