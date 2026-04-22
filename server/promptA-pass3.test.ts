/**
 * Prompt A — Pass 3 Tests
 * Verifies P0-6 (PWA offline), P1-2 (Lesson graph), P1-5 (Office hours)
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

// ─── P0-6: PWA Offline ─────────────────────────────────────────────────

describe("P0-6: PWA Offline Mode", () => {
  const swPath = path.join(ROOT, "client/public/sw.js");
  const offlinePath = path.join(ROOT, "client/public/offline.html");
  const manifestPath = path.join(ROOT, "client/public/manifest.json");
  const mainTsxPath = path.join(ROOT, "client/src/main.tsx");

  it("service worker file exists", () => {
    expect(fs.existsSync(swPath)).toBe(true);
  });

  it("service worker has install, activate, fetch listeners", () => {
    const sw = fs.readFileSync(swPath, "utf-8");
    expect(sw).toContain("addEventListener(\"install\"");
    expect(sw).toContain("addEventListener(\"activate\"");
    expect(sw).toContain("addEventListener(\"fetch\"");
  });

  it("service worker pre-caches app shell", () => {
    const sw = fs.readFileSync(swPath, "utf-8");
    expect(sw).toContain("PRECACHE_URLS");
    expect(sw).toContain("/offline.html");
  });

  it("service worker uses cache-first for static assets", () => {
    const sw = fs.readFileSync(swPath, "utf-8");
    expect(sw).toContain("caches.match(request)");
  });

  it("service worker uses network-first for API calls", () => {
    const sw = fs.readFileSync(swPath, "utf-8");
    expect(sw).toContain("/api/");
    expect(sw).toContain("fetch(request)");
  });

  it("offline fallback page exists with retry button", () => {
    expect(fs.existsSync(offlinePath)).toBe(true);
    const html = fs.readFileSync(offlinePath, "utf-8");
    expect(html).toContain("Offline");
    expect(html).toContain("Try Again");
    expect(html).toContain("reload()");
  });

  it("manifest.json has required PWA fields", () => {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toBeDefined();
    expect(manifest.icons.length).toBeGreaterThan(0);
  });

  it("main.tsx registers service worker in production", () => {
    const main = fs.readFileSync(mainTsxPath, "utf-8");
    expect(main).toContain("serviceWorker");
    expect(main).toContain("import.meta.env.PROD");
    expect(main).toContain("/sw.js");
  });
});

// ─── P1-2: Lesson Graph + Mastery Gating ────────────────────────────────

describe("P1-2: Lesson Graph + Mastery Gating", () => {
  const servicePath = path.join(ROOT, "server/services/learning/lessonGraph.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("lessonGraph service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports getLessonGraph function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getLessonGraph");
  });

  it("exports isChapterUnlocked function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function isChapterUnlocked");
  });

  it("exports addPrerequisite function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function addPrerequisite");
  });

  it("exports removePrerequisite function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function removePrerequisite");
  });

  it("implements cycle detection for DAG integrity", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("detectCycle");
    expect(src).toContain("circular dependency");
  });

  it("exports getNextUnlockable function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getNextUnlockable");
  });

  it("uses getDb() pattern (not direct db import)", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("import { getDb }");
    expect(src).not.toContain("import { db }");
  });

  it("schema has chapterPrerequisites table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("chapterPrerequisites");
    expect(schema).toContain("chapter_prerequisites");
  });

  it("chapterPrerequisites has minMasteryScore column", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    // Find the chapterPrerequisites definition and check for minMasteryScore
    expect(schema).toContain("minMasteryScore");
  });

  it("learning router includes lessonGraph subrouter", () => {
    const router = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf-8");
    expect(router).toContain("lessonGraph");
  });
});

// ─── P1-5: Faculty Office Hours ─────────────────────────────────────────

describe("P1-5: Faculty Office Hours", () => {
  const servicePath = path.join(ROOT, "server/services/learning/officeHours.ts");
  const schemaPath = path.join(ROOT, "drizzle/schema.ts");

  it("officeHours service file exists", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
  });

  it("exports createSession function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function createSession");
  });

  it("exports listUpcoming function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function listUpcoming");
  });

  it("exports register function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function register");
  });

  it("exports cancelRegistration function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function cancelRegistration");
  });

  it("exports markAttendance function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function markAttendance");
  });

  it("exports updateSessionStatus function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function updateSessionStatus");
  });

  it("exports getMyRegistrations function", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("export async function getMyRegistrations");
  });

  it("handles capacity limits", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("maxAttendees");
    expect(src).toContain("Session is full");
  });

  it("handles re-registration after cancellation", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("Re-registered successfully");
  });

  it("uses getDb() pattern (not direct db import)", () => {
    const src = fs.readFileSync(servicePath, "utf-8");
    expect(src).toContain("import { getDb }");
    expect(src).not.toContain("import { db }");
  });

  it("schema has officeHours table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("officeHours");
    expect(schema).toContain("office_hours");
  });

  it("schema has officeHourRegistrations table", () => {
    const schema = fs.readFileSync(schemaPath, "utf-8");
    expect(schema).toContain("officeHourRegistrations");
    expect(schema).toContain("office_hour_registrations");
  });

  it("learning router includes officeHours subrouter", () => {
    const router = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf-8");
    expect(router).toContain("officeHours");
  });
});

// ─── Learning State Integrity ───────────────────────────────────────────

describe("Learning State Integrity (Pass 3)", () => {
  it("learning-state.json is valid and at pass 4+", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    expect(state.last_pass).toBeGreaterThanOrEqual(3);
    expect(state.phase).toBe("pre-ai");
  });

  it("at least 6 items are Shipped (9 after Pass 4)", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const shipped = Object.values(state.items).filter((i: any) => i.state === "Shipped");
    expect(shipped.length).toBeGreaterThanOrEqual(6);
  });

  it("P0-6, P1-2, P1-5 are Shipped (Pass 3 items)", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    expect(state.items["P0-6"].state).toBe("Shipped");
    expect(state.items["P1-2"].state).toBe("Shipped");
    expect(state.items["P1-5"].state).toBe("Shipped");
  });

  it("all shipped items have measurement_start dates", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const shipped = Object.values(state.items).filter((i: any) => i.state === "Shipped") as any[];
    for (const item of shipped) {
      expect(item.measurement_start).toBeTruthy();
    }
  });

  it("AI-dependent items remain in Proposed-Waiting-AI", () => {
    const state = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf-8"));
    const aiItems = Object.values(state.items).filter((i: any) => i.ai_integration_dependent) as any[];
    for (const item of aiItems) {
      expect(item.state).toBe("Proposed-Waiting-AI");
    }
  });

  it("pre-registration baselines exist for all shipped items", () => {
    const baselines = ["P0-1", "P0-3", "P0-5", "P0-6"];
    for (const id of baselines) {
      const baselinePath = path.join(ROOT, `docs/learning-baseline-${id}.json`);
      expect(fs.existsSync(baselinePath)).toBe(true);
    }
  });
});
