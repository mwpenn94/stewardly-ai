import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * AuthContext / AuthProvider structural tests
 * 
 * These tests verify the structural correctness of the auth refactoring:
 * 1. AuthContext.tsx exists and exports AuthProvider + useAuth
 * 2. The old useAuth.ts re-exports from AuthContext (not its own implementation)
 * 3. App.tsx wraps with AuthProvider above NotificationProvider
 * 4. No component calls useAuth outside of AuthProvider
 */

const ROOT = path.resolve(__dirname, "..");
const readFile = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf-8");

describe("AuthContext structural integrity", () => {
  it("AuthContext.tsx exports AuthProvider and useAuth", () => {
    const src = readFile("client/src/contexts/AuthContext.tsx");
    expect(src).toContain("export function AuthProvider");
    expect(src).toContain("export function useAuth");
  });

  it("AuthContext.tsx creates a React context", () => {
    const src = readFile("client/src/contexts/AuthContext.tsx");
    expect(src).toContain("createContext");
    expect(src).toContain("AuthContext.Provider");
  });

  it("AuthContext.tsx handles guest provisioning", () => {
    const src = readFile("client/src/contexts/AuthContext.tsx");
    expect(src).toContain("guest-session");
    expect(src).toContain("guestProvisioningDone");
  });

  it("AuthContext.tsx loading state accounts for guest provisioning", () => {
    const src = readFile("client/src/contexts/AuthContext.tsx");
    // The key fix: loading should be true while guest provisioning is in progress
    expect(src).toContain("isStillProvisioning");
    expect(src).toContain("isInitialLoading || isStillProvisioning");
  });

  it("old useAuth.ts re-exports from AuthContext (not its own implementation)", () => {
    const src = readFile("client/src/_core/hooks/useAuth.ts");
    expect(src).toContain('from "@/contexts/AuthContext"');
    // Should NOT contain its own trpc.auth.me.useQuery
    expect(src).not.toContain("trpc.auth.me.useQuery");
    expect(src).not.toContain("useMemo");
  });

  it("App.tsx wraps AuthProvider above NotificationProvider", () => {
    const src = readFile("client/src/App.tsx");
    const authProviderIdx = src.indexOf("<AuthProvider>");
    const notificationProviderIdx = src.indexOf("<NotificationProvider>");
    // AuthProvider must appear BEFORE NotificationProvider in the tree
    expect(authProviderIdx).toBeGreaterThan(-1);
    expect(notificationProviderIdx).toBeGreaterThan(-1);
    expect(authProviderIdx).toBeLessThan(notificationProviderIdx);
  });

  it("App.tsx does NOT use useGuestSession directly", () => {
    const src = readFile("client/src/App.tsx");
    expect(src).not.toContain("useGuestSession()");
    expect(src).not.toContain('from "./hooks/useGuestSession"');
  });

  it("App.tsx imports AuthProvider from contexts", () => {
    const src = readFile("client/src/App.tsx");
    expect(src).toContain('from "./contexts/AuthContext"');
  });

  it("useAuth throws if used outside AuthProvider", () => {
    const src = readFile("client/src/contexts/AuthContext.tsx");
    expect(src).toContain("useAuth must be used within an AuthProvider");
  });
});

describe("Auth redirect improvements", () => {
  it("getLoginUrl encodes returnPath in state parameter", () => {
    const src = readFile("client/src/const.ts");
    expect(src).toContain("returnPath");
    expect(src).toContain("state");
  });

  it("OAuth callback parses state for redirect", () => {
    const src = readFile("server/_core/oauth.ts");
    // Should parse state to extract returnPath
    expect(src).toContain("returnPath");
  });
});
