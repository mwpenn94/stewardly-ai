/**
 * v83-pass12b-blankscreen.test.ts — Pass 12b regression tests
 *
 * Validates the P0 blank screen fix:
 * 1. splitLink ensures auth.me is never batched with slow DB queries
 * 2. ServiceStatusProvider defers serviceHealth query by 3s
 * 3. systemRouter serviceHealth has 5s timeout wrapper
 * 4. AuthContext guest provisioning has 8s timeout with anonymousMode fallback
 */
import { describe, it, expect } from "vitest";

// ── T1: splitLink configuration ──────────────────────────────────
describe("splitLink configuration", () => {
  it("should route auth.me through non-batching httpLink", async () => {
    // The splitLink condition checks for 'auth.me' and 'auth.logout'
    // These paths should be routed through httpLink (not httpBatchLink)
    const mainTsx = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/main.tsx"),
        "utf-8"
      )
    );

    // Verify splitLink is used
    expect(mainTsx).toContain("splitLink");
    expect(mainTsx).toContain("httpLink");
    expect(mainTsx).toContain("httpBatchLink");

    // Verify the condition routes auth.me and auth.logout
    expect(mainTsx).toContain("auth.me");
    expect(mainTsx).toContain("auth.logout");

    // Verify the condition is in the splitLink
    expect(mainTsx).toMatch(/splitLink\(\{[\s\S]*?condition:[\s\S]*?auth\.me/);
  });

  it("should use authedFetch for both links", async () => {
    const mainTsx = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/main.tsx"),
        "utf-8"
      )
    );

    // Both httpLink and httpBatchLink should use authedFetch
    const httpLinkMatch = mainTsx.match(/httpLink\(\{[\s\S]*?fetch:\s*(\w+)/);
    const httpBatchLinkMatch = mainTsx.match(/httpBatchLink\(\{[\s\S]*?fetch:\s*(\w+)/);

    expect(httpLinkMatch).toBeTruthy();
    expect(httpBatchLinkMatch).toBeTruthy();
    expect(httpLinkMatch![1]).toBe("authedFetch");
    expect(httpBatchLinkMatch![1]).toBe("authedFetch");
  });
});

// ── T2: ServiceStatusProvider deferred query ─────────────────────
describe("ServiceStatusProvider deferred query", () => {
  it("should defer serviceHealth query with enabled guard", async () => {
    const ctx = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/contexts/ServiceStatusContext.tsx"),
        "utf-8"
      )
    );

    // Verify the enabled guard exists
    expect(ctx).toContain("enabled: ready");

    // Verify the 3s delay
    expect(ctx).toContain("setTimeout(() => setReady(true), 3000)");
  });
});

// ── T3: systemRouter serviceHealth timeout ───────────────────────
describe("systemRouter serviceHealth timeout", () => {
  it("should have a Promise.race timeout wrapper", async () => {
    const router = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../../server/_core/systemRouter.ts"),
        "utf-8"
      )
    );

    // Verify Promise.race with timeout
    expect(router).toContain("Promise.race");
    expect(router).toContain("Health check timeout");
    expect(router).toContain("5000");
  });

  it("should be a publicProcedure", async () => {
    const router = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../../server/_core/systemRouter.ts"),
        "utf-8"
      )
    );

    expect(router).toContain("serviceHealth: publicProcedure");
  });
});

// ── T4: AuthContext guest provisioning timeout ───────────────────
describe("AuthContext guest provisioning timeout", () => {
  it("should have an 8s timeout for guest provisioning", async () => {
    const auth = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/contexts/AuthContext.tsx"),
        "utf-8"
      )
    );

    expect(auth).toContain("GUEST_PROVISION_TIMEOUT_MS");
    expect(auth).toContain("8_000");
  });

  it("should set anonymousMode on timeout", async () => {
    const auth = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/contexts/AuthContext.tsx"),
        "utf-8"
      )
    );

    expect(auth).toContain('localStorage.setItem("anonymousMode", "true")');
  });

  it("should use AbortController for fetch timeout", async () => {
    const auth = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/contexts/AuthContext.tsx"),
        "utf-8"
      )
    );

    expect(auth).toContain("AbortController");
    expect(auth).toContain("controller.abort()");
  });
});

// ── T5: handleUnauthorizedGracefully skips first-visit users ─────
describe("handleUnauthorizedGracefully", () => {
  it("should skip invalidation for users without stored token", async () => {
    const mainTsx = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/main.tsx"),
        "utf-8"
      )
    );

    // Should check for stored token before invalidating
    expect(mainTsx).toContain("getSessionToken()");
    expect(mainTsx).toContain("handleUnauthorizedGracefully");
  });
});

// ── T6: Landing page sets anonymousMode ──────────────────────────
describe("Landing page anonymous mode", () => {
  it("should set anonymousMode for unauthenticated users", async () => {
    const landing = await import("fs").then(fs =>
      fs.readFileSync(
        require("path").resolve(__dirname, "../../../src/pages/Landing.tsx"),
        "utf-8"
      )
    );

    expect(landing).toContain('localStorage.setItem("anonymousMode", "true")');
    expect(landing).toContain("navigate(\"/chat\")");
  });
});
