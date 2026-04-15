import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// Mock the dependencies before importing
vi.mock("../shared/const", () => ({
  COOKIE_NAME: "app_session_id",
  AUTHENTICATED_SESSION_MS: 86400000,
}));

vi.mock("./db", () => ({
  upsertUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./_core/cookies", () => ({
  getSessionCookieOptions: vi.fn().mockReturnValue({
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: true,
  }),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    exchangeCodeForToken: vi.fn().mockResolvedValue({ accessToken: "test-token" }),
    getUserInfo: vi.fn().mockResolvedValue({
      openId: "user-123",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "google",
      platform: "google",
    }),
    createSessionToken: vi.fn().mockResolvedValue("jwt-session-token"),
    authenticateRequest: vi.fn().mockRejectedValue(new Error("No session")),
  },
}));

vi.mock("./_core/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("OAuth callback", () => {
  let registerOAuthRoutes: (app: any) => void;
  let mockApp: any;
  let callbackHandler: (req: Request, res: Response) => Promise<void>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./_core/oauth");
    registerOAuthRoutes = mod.registerOAuthRoutes;

    mockApp = {
      get: vi.fn(),
    };

    registerOAuthRoutes(mockApp);
    // The first call to app.get should be the callback route
    expect(mockApp.get).toHaveBeenCalledWith("/api/oauth/callback", expect.any(Function));
    callbackHandler = mockApp.get.mock.calls[0][1];
  });

  it("returns 200 HTML instead of 302 redirect", async () => {
    const statePayload = JSON.stringify({ origin: "https://stewardly.manus.space", returnPath: "/learning" });
    const state = Buffer.from(statePayload).toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: {
        "x-forwarded-host": "stewardly.manus.space",
        "x-forwarded-proto": "https",
      },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      redirect: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
      json: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    // Should NOT use 302 redirect
    expect(res.redirect).not.toHaveBeenCalled();

    // Should set cookie
    expect(res.cookie).toHaveBeenCalledWith(
      "app_session_id",
      "jwt-session-token",
      expect.objectContaining({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
        maxAge: 86400000,
      })
    );

    // Should return 200 HTML
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("<!DOCTYPE html>"));
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("Signing you in"));
  });

  it("includes sessionStorage flag in the HTML", async () => {
    const statePayload = JSON.stringify({ origin: "https://stewardly.manus.space", returnPath: "/" });
    const state = Buffer.from(statePayload).toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain("stewardly_oauth_pending");
    expect(html).toContain("sessionStorage.setItem");
  });

  it("includes client-side redirect to the return path", async () => {
    const statePayload = JSON.stringify({ origin: "https://stewardly.manus.space", returnPath: "/learning" });
    const state = Buffer.from(statePayload).toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain("window.location.replace");
    expect(html).toContain("/learning");
  });

  it("falls back to / when state has no returnPath", async () => {
    const statePayload = JSON.stringify({ origin: "https://stewardly.manus.space" });
    const state = Buffer.from(statePayload).toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    // Should redirect to /
    expect(html).toContain('window.location.replace("/")');
  });

  it("sanitizes returnPath to prevent open redirect", async () => {
    const statePayload = JSON.stringify({ origin: "https://stewardly.manus.space", returnPath: "//evil.com" });
    const state = Buffer.from(statePayload).toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    const html = res.send.mock.calls[0][0] as string;
    // Should NOT redirect to //evil.com — should fall back to /
    expect(html).not.toContain("evil.com");
    expect(html).toContain('window.location.replace("/")');
  });

  it("returns 400 when code or state is missing", async () => {
    const req = {
      query: {},
      hostname: "stewardly.manus.space",
      headers: {},
    } as unknown as Request;

    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "code and state are required" });
  });

  it("handles legacy state format (plain URL string)", async () => {
    const state = Buffer.from("https://stewardly.manus.space/api/oauth/callback").toString("base64");

    const req = {
      query: { code: "auth-code", state },
      hostname: "stewardly.manus.space",
      headers: { "x-forwarded-proto": "https" },
    } as unknown as Request;

    const res = {
      cookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as unknown as Response;

    await callbackHandler(req, res);

    // Should fall back to / for legacy format
    const html = res.send.mock.calls[0][0] as string;
    expect(html).toContain('window.location.replace("/")');
  });
});
