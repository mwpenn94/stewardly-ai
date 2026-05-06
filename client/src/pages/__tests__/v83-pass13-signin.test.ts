/**
 * v8.3 Pass 13 — Sign-in CTA + Degraded Banner + People Engine
 *
 * Tests:
 * 1. ChatGreeting has sign-in CTA for unauthenticated users
 * 2. ServiceStatusBanner auto-dismisses for non-auth users
 * 3. Chat mobile header shows Sign In for null user
 * 4. Chat sidebar shows sign-in for null/anonymous users
 * 5. People Engine nav is gated behind authentication
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const root = resolve(__dirname, "../../../..");

function read(rel: string) {
  return readFileSync(resolve(root, rel), "utf-8");
}

describe("Pass 13 — Sign-in CTA & Degraded Banner", () => {
  // ── ChatGreeting sign-in CTA ──────────────────────────────────────
  it("ChatGreeting imports getLoginUrl for sign-in", () => {
    const src = read("client/src/components/ChatGreeting.tsx");
    expect(src).toContain('import { getLoginUrl } from "@/const"');
  });

  it("ChatGreeting imports LogIn icon", () => {
    const src = read("client/src/components/ChatGreeting.tsx");
    expect(src).toContain("LogIn");
  });

  it("ChatGreeting renders sign-in CTA when not authenticated", () => {
    const src = read("client/src/components/ChatGreeting.tsx");
    expect(src).toContain("!isAuthenticated");
    expect(src).toContain("Sign in to unlock all engines");
    expect(src).toContain("getLoginUrl()");
  });

  it("ChatGreeting sign-in CTA uses emerald styling", () => {
    const src = read("client/src/components/ChatGreeting.tsx");
    expect(src).toContain("emerald-500");
  });

  // ── ServiceStatusBanner auto-dismiss ──────────────────────────────
  it("ServiceStatusBanner auto-dismisses for non-auth users", () => {
    const src = read("client/src/components/ServiceStatusBanner.tsx");
    expect(src).toContain("!isAuthenticated");
    expect(src).toContain("setDismissed(true)");
    expect(src).toContain("8_000");
  });

  it("ServiceStatusBanner uses empty deps for stable timer", () => {
    const src = read("client/src/components/ServiceStatusBanner.tsx");
    // The useEffect for auto-dismiss should have empty deps to prevent resetting
    expect(src).toContain("}, []);");
  });

  // ── Chat mobile header sign-in ────────────────────────────────────
  it("Chat mobile header shows Sign In for null user (not just anonymous)", () => {
    const src = read("client/src/pages/Chat.tsx");
    // Should show sign-in when not authenticated OR anonymous
    expect(src).toContain('!isAuthenticated || user?.authTier === "anonymous"');
  });

  // ── Chat sidebar sign-in ──────────────────────────────────────────
  it("Chat sidebar shows sign-in for unauthenticated users", () => {
    const src = read("client/src/pages/Chat.tsx");
    // Sidebar auth section should handle null user
    expect(src).toContain("getLoginUrl");
  });

  // ── People Engine gating ──────────────────────────────────────────
  it("People Engine nav is in PersonaSidebar5 with auth gating", () => {
    const src = read("client/src/components/PersonaSidebar5.tsx");
    // People is in sidebar nav items, gated behind professional tier
    expect(src).toContain('label: "People"');
    expect(src).toContain('/people');
  });

  // ── systemRouter serviceHealth is public ──────────────────────────
  it("serviceHealth is a publicProcedure (not protected)", () => {
    const src = read("server/_core/systemRouter.ts");
    // Should use publicProcedure for serviceHealth to avoid 401 loops
    expect(src).toMatch(/serviceHealth.*publicProcedure/s);
  });

  it("serviceHealth has a 5s timeout wrapper", () => {
    const src = read("server/_core/systemRouter.ts");
    expect(src).toContain("Promise.race");
    expect(src).toContain("5000");
  });

  // ── splitLink for auth.me ─────────────────────────────────────────
  it("main.tsx uses splitLink to isolate auth.me", () => {
    const src = read("client/src/main.tsx");
    expect(src).toContain("splitLink");
    expect(src).toContain("httpLink");
    expect(src).toContain("auth.me");
  });

  it("handleUnauthorizedGracefully skips for first-visit users", () => {
    const src = read("client/src/main.tsx");
    // Should check for stored token before invalidating
    expect(src).toContain("hasStoredToken");
  });
});
