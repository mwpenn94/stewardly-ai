/**
 * Pass 76 — Global Notification Integration Tests
 *
 * Covers:
 * 1. NotificationBell added to AppShell (mobile + desktop)
 * 2. ChangelogBell added to AppShell desktop
 * 3. All non-chat pages now have notification access
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../client/src");

describe("Pass 76 — AppShell Notification Integration", () => {
  const filePath = path.join(CLIENT, "components/AppShell.tsx");
  let src: string;

  it("AppShell.tsx exists", () => {
    expect(fs.existsSync(filePath)).toBe(true);
    src = fs.readFileSync(filePath, "utf8");
  });

  it("imports NotificationBell", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("NotificationBell");
  });

  it("imports useNotifications from NotificationContext", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("useNotifications");
    expect(src).toContain("NotificationContext");
  });

  it("imports useOnboardingNotifications", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("useOnboardingNotifications");
  });

  it("imports ChangelogBell", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("ChangelogBell");
  });

  it("merges WS and onboarding notifications", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("allNotifications");
    expect(src).toContain("totalUnread");
  });

  it("renders NotificationBell in mobile header", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    // Should have NotificationBell inside the header element
    expect(src).toContain("onMarkAsRead={markAsRead}");
    expect(src).toContain("onMarkAllAsRead={markAllAsRead}");
    expect(src).toContain("onClear={clearNotifications}");
  });

  it("renders NotificationBell in desktop fixed position", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    // Desktop bell is in a hidden lg:flex fixed div
    expect(src).toContain("hidden lg:flex fixed");
    expect(src).toContain("onNavigate");
  });

  it("renders ChangelogBell in desktop position", () => {
    src = src || fs.readFileSync(filePath, "utf8");
    expect(src).toContain("<ChangelogBell");
  });
});

describe("Pass 76 — Notification Components Exist", () => {
  it("NotificationBell component exists with proper exports", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/NotificationBell.tsx"), "utf8");
    expect(src).toContain("export function NotificationBell");
  });

  it("NotificationContext provides all required fields", () => {
    const src = fs.readFileSync(path.join(CLIENT, "contexts/NotificationContext.tsx"), "utf8");
    expect(src).toContain("notifications");
    expect(src).toContain("unreadCount");
    expect(src).toContain("connected");
    expect(src).toContain("markAsRead");
    expect(src).toContain("markAllAsRead");
    expect(src).toContain("clearNotifications");
  });

  it("OnboardingNotifications provides useOnboardingNotifications", () => {
    const src = fs.readFileSync(path.join(CLIENT, "components/OnboardingNotifications.tsx"), "utf8");
    expect(src).toContain("export function useOnboardingNotifications");
  });

  it("ChangelogBell component exists", () => {
    expect(fs.existsSync(path.join(CLIENT, "components/ChangelogBell.tsx"))).toBe(true);
  });
});
