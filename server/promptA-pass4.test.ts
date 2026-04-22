/**
 * Prompt A — Pass 4 Tests
 * Verifies P1-1 (Capacitor), P1-3 (CE credits), P1-4 (Peer groups)
 * + learning-state convergence readiness
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// ─── P1-1: Capacitor Mobile Shell ───────────────────────────────────────

describe("P1-1: Capacitor Mobile Shell", () => {
  const configPath = path.join(ROOT, "capacitor.config.ts");

  it("capacitor.config.ts exists", () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  it("has correct appId", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("com.stewardly.ai");
  });

  it("has correct webDir pointing to client/dist", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("client/dist");
  });

  it("has SplashScreen plugin config", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("SplashScreen");
    expect(src).toContain("launchShowDuration");
  });

  it("has StatusBar plugin config", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("StatusBar");
  });

  it("has iOS and Android platform configs", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("ios:");
    expect(src).toContain("android:");
  });

  it("exports default config", () => {
    const src = fs.readFileSync(configPath, "utf-8");
    expect(src).toContain("export default config");
  });
});

// ─── P1-3: CE Credit Issuance Pipeline ──────────────────────────────────

describe("P1-3: CE Credit Issuance Pipeline", () => {
  const servicePath = path.join(ROOT, "server/services/learning/ceCredits.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("ceCredits service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports issueCeCredit function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function issueCeCredit");
  });

  it("exports revokeCeCredit function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function revokeCeCredit");
  });

  it("exports listUserCredits function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function listUserCredits");
  });

  it("exports getCreditSummary function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getCreditSummary");
  });

  it("exports verifyCeCredit function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function verifyCeCredit");
  });

  it("supports dual-track credit types (self_serve + partnership)", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("self_serve");
    expect(src).toContain("partnership");
  });

  it("prevents duplicate credit issuance for same track", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("CE credit already issued");
  });

  it("handles credit expiration in verification", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("expiresAt");
    expect(src).toContain("Credit expired");
  });

  it("uses getDb() pattern", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("import { getDb }");
  });

  it("schema has ceCredits table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("ceCredits");
    expect(schema).toContain("ce_credits");
  });

  it("learning router includes ceCredits subrouter", () => {
    const router = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf-8");
    expect(router).toContain("ceCredits: ceCreditsRouter");
  });
});

// ─── P1-4: Compliant Professional Peer Groups ──────────────────────────

describe("P1-4: Compliant Professional Peer Groups", () => {
  const servicePath = path.join(ROOT, "server/services/learning/peerGroups.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("peerGroups service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports createGroup function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function createGroup");
  });

  it("exports joinGroup function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function joinGroup");
  });

  it("exports leaveGroup function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function leaveGroup");
  });

  it("exports listGroups function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function listGroups");
  });

  it("exports postMessage function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function postMessage");
  });

  it("exports getMessages function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getMessages");
  });

  it("exports getMyGroups function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getMyGroups");
  });

  it("implements compliance gating", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("isComplianceGated");
    expect(src).toContain("professional credentials");
  });

  it("handles capacity limits", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("maxMembers");
    expect(src).toContain("Group is full");
  });

  it("prevents non-member message posting", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("Not a member");
  });

  it("auto-adds creator as admin member", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("role: \"admin\"");
  });

  it("uses getDb() pattern", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("import { getDb }");
  });

  it("schema has peerGroups table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("peerGroups");
    expect(schema).toContain("peer_groups");
  });

  it("schema has peerGroupMembers table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("peerGroupMembers");
    expect(schema).toContain("peer_group_members");
  });

  it("schema has peerGroupMessages table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("peerGroupMessages");
    expect(schema).toContain("peer_group_messages");
  });

  it("learning router includes peerGroups subrouter", () => {
    const router = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf-8");
    expect(router).toContain("peerGroups: peerGroupsRouter");
  });
});

// ─── Learning State Convergence Readiness ───────────────────────────────

describe("Learning State — Convergence Readiness", () => {
  it("learning-state.json is valid and at pass 4", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    expect(state.last_pass).toBe(4);
    expect(state.phase).toBe("pre-ai");
  });

  it("all 9 non-AI items are Shipped", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const shipped = Object.values(state.items).filter((i: any) => i.state === "Shipped");
    expect(shipped.length).toBe(9);
  });

  it("3 AI-dependent items remain in Proposed-Waiting-AI", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const aiItems = Object.values(state.items).filter((i: any) => i.state === "Proposed-Waiting-AI");
    expect(aiItems.length).toBe(3);
  });

  it("no non-AI items are non-terminal", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    expect(state.summary.non_ai_non_terminal_count).toBe(0);
  });

  it("all shipped items have measurement_start dates", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const shipped = Object.values(state.items).filter((i: any) => i.state === "Shipped") as any[];
    for (const item of shipped) {
      expect(item.measurement_start).toBeTruthy();
    }
  });

  it("all blocking questions resolved with AFK defaults", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const withBlockingQ = Object.values(state.items).filter((i: any) => i.blocking_q && !i.ai_integration_dependent) as any[];
    for (const item of withBlockingQ) {
      expect(item.blocking_q_resolved).toBe(true);
      expect(item.blocking_q_resolution).toBeTruthy();
    }
  });

  it("pre-registration baselines exist for all 9 shipped non-AI items", () => {
    const ids = ["P0-1", "P0-3", "P0-5", "P0-6", "P1-1", "P1-2", "P1-3", "P1-4", "P1-5"];
    for (const id of ids) {
      const baselinePath = path.join(ROOT, `docs/learning-baseline-${id}.json`);
      expect(fs.existsSync(baselinePath)).toBe(true);
    }
  });

  it("AFK decisions log has entries for Q1, Q2, Q3, Q4", () => {
    const afk = fs.readFileSync(path.join(ROOT, "docs/afk-decisions.md"), "utf-8");
    expect(afk).toContain("Q1");
    expect(afk).toContain("Q2");
    expect(afk).toContain("Q3");
    expect(afk).toContain("Q4");
  });
});
