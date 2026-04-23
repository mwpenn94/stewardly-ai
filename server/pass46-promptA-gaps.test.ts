/**
 * Pass 46: Prompt A Gap Closure + Flashcard Bug Fix
 * Tests all 21 gaps identified in the Prompt A audit.
 */
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("Pass 46: Flashcard Bug Fix", () => {
  it("LearningFlashcardStudy has separated auth and loading checks", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "client/src/pages/learning/LearningFlashcardStudy.tsx"),
      "utf8"
    );
    // Auth check should come before loading check, both as separate if blocks
    const authIdx = src.indexOf("if (authLoading)");
    const loadIdx = src.indexOf("if (trackQ.isLoading || flashcardsQ.isLoading)");
    expect(authIdx).toBeGreaterThan(-1);
    expect(loadIdx).toBeGreaterThan(-1);
    expect(authIdx).toBeLessThan(loadIdx);
  });
});

describe("Pass 46: Infrastructure Artifacts", () => {
  it("P46-3a: .parity-lock/learning_platform_benchmark exists with CONVERGED-PRE-AI", () => {
    const lockFile = path.join(ROOT, ".parity-lock/learning_platform_benchmark");
    expect(fs.existsSync(lockFile)).toBe(true);
    const content = fs.readFileSync(lockFile, "utf8");
    expect(content).toMatch(/CONVERGED/);
  });

  it("P46-3b: docs/post-mortems/ directory exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/post-mortems"))).toBe(true);
  });

  it("P46-3b: docs/public-snapshots/ directory exists", () => {
    expect(fs.existsSync(path.join(ROOT, "docs/public-snapshots"))).toBe(true);
  });
});

describe("Pass 46: P0-3 Assessment Integrity", () => {
  it("P46-3c: server-side chat rejection uses isAiBlocked", () => {
    const routerSrc = fs.readFileSync(path.join(ROOT, "server/routers.ts"), "utf8");
    expect(routerSrc).toContain("isAiBlocked");
    expect(routerSrc).toContain("AI assistance is disabled during a graded assessment");
  });

  it("P46-3c: AssessmentGuard component exists", () => {
    const guardPath = path.join(ROOT, "client/src/components/learning/AssessmentGuard.tsx");
    expect(fs.existsSync(guardPath)).toBe(true);
    const src = fs.readFileSync(guardPath, "utf8");
    expect(src).toContain("AssessmentGuard");
    expect(src).toContain("ShieldAlert");
  });
});

describe("Pass 46: P0-1 SRS Widget", () => {
  it("P46-3k: SrsWidget component exists with loading and empty states", () => {
    const widgetPath = path.join(ROOT, "client/src/components/learning/SrsWidget.tsx");
    expect(fs.existsSync(widgetPath)).toBe(true);
    const src = fs.readFileSync(widgetPath, "utf8");
    expect(src).toContain("SrsWidget");
    expect(src).toContain("trpc.learning.fsrs5.stats");
    expect(src).toContain("isLoading");
    expect(src).toContain("No flashcards yet");
  });

  it("SrsWidget supports compact mode", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "client/src/components/learning/SrsWidget.tsx"),
      "utf8"
    );
    expect(src).toContain("compact");
  });
});

describe("Pass 46: P0-5 Streak Widget", () => {
  it("P46-3d: StreakWidget component exists with loading state", () => {
    const widgetPath = path.join(ROOT, "client/src/components/learning/StreakWidget.tsx");
    expect(fs.existsSync(widgetPath)).toBe(true);
    const src = fs.readFileSync(widgetPath, "utf8");
    expect(src).toContain("StreakWidget");
    expect(src).toContain("trpc.learning.streaks.get");
    expect(src).toContain("isLoading");
  });

  it("StreakWidget supports compact mode", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "client/src/components/learning/StreakWidget.tsx"),
      "utf8"
    );
    expect(src).toContain("compact");
    expect(src).toContain("day streak");
  });
});

describe("Pass 46: P0-6 PWA Offline", () => {
  it("P46-3e: IndexedDB wrapper exists", () => {
    const dbPath = path.join(ROOT, "client/src/lib/offlineDb.ts");
    expect(fs.existsSync(dbPath)).toBe(true);
    const src = fs.readFileSync(dbPath, "utf8");
    expect(src).toContain("indexedDB");
    expect(src).toContain("wealthbridge-offline");
  });

  it("Service worker exists", () => {
    expect(fs.existsSync(path.join(ROOT, "client/public/sw.js"))).toBe(true);
  });

  it("Service worker registration in main.tsx", () => {
    const mainSrc = fs.readFileSync(path.join(ROOT, "client/src/main.tsx"), "utf8");
    expect(mainSrc).toContain("serviceWorker");
    expect(mainSrc).toContain("import.meta.env.PROD");
  });

  it("Offline fallback page exists", () => {
    expect(fs.existsSync(path.join(ROOT, "client/public/offline.html"))).toBe(true);
  });
});

describe("Pass 46: P1-1 Mobile Shell", () => {
  it("P46-3f: Capacitor config exists", () => {
    const configPath = path.join(ROOT, "capacitor.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);
    const src = fs.readFileSync(configPath, "utf8");
    expect(src).toContain("com.stewardly.ai");
    expect(src).toContain("Stewardly AI");
  });

  it("Push notifications plugin exists", () => {
    const pushPath = path.join(ROOT, "mobile/src/plugins/pushNotifications.ts");
    expect(fs.existsSync(pushPath)).toBe(true);
    const src = fs.readFileSync(pushPath, "utf8");
    expect(src).toContain("push");
  });

  it("Biometric lock plugin exists", () => {
    const bioPath = path.join(ROOT, "mobile/src/plugins/biometricLock.ts");
    expect(fs.existsSync(bioPath)).toBe(true);
    const src = fs.readFileSync(bioPath, "utf8");
    expect(src).toContain("biometric");
  });

  it("Deep links plugin exists", () => {
    const deepPath = path.join(ROOT, "mobile/src/plugins/deepLinks.ts");
    expect(fs.existsSync(deepPath)).toBe(true);
    const src = fs.readFileSync(deepPath, "utf8");
    expect(src).toContain("DeepLinkMatch");
  });
});

describe("Pass 46: P1-2 Lesson Graph UI", () => {
  it("P46-3g: LessonGraphView component exists with loading and empty states", () => {
    const graphPath = path.join(ROOT, "client/src/components/learning/LessonGraphView.tsx");
    expect(fs.existsSync(graphPath)).toBe(true);
    const src = fs.readFileSync(graphPath, "utf8");
    expect(src).toContain("LessonGraphView");
    expect(src).toContain("trpc.learning.lessonGraph.getGraph");
    expect(src).toContain("isLoading");
    expect(src).toContain("No chapters available");
  });

  it("LessonGraphView shows locked/mastered/active states", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "client/src/components/learning/LessonGraphView.tsx"),
      "utf8"
    );
    expect(src).toContain("Lock");
    expect(src).toContain("CheckCircle2");
    expect(src).toContain("Mastered");
    expect(src).toContain("Locked");
  });
});

describe("Pass 46: P1-3 CE Credit PDF", () => {
  it("P46-3h: ceCertificatePdf service exists", () => {
    const pdfPath = path.join(ROOT, "server/services/learning/ceCertificatePdf.ts");
    expect(fs.existsSync(pdfPath)).toBe(true);
    const src = fs.readFileSync(pdfPath, "utf8");
    expect(src).toContain("generateCeCertificatePdf");
    expect(src).toContain("Certificate of Completion");
  });

  it("CE certificate procedure wired in learning router", () => {
    const routerSrc = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf8");
    expect(routerSrc).toContain("generateCeCertificatePdf");
    expect(routerSrc).toContain("certificate");
  });
});

describe("Pass 46: P1-4 Compliance Prescreening", () => {
  it("P46-3i: compliancePrescreening service exists", () => {
    const prescreenPath = path.join(ROOT, "server/services/learning/compliancePrescreening.ts");
    expect(fs.existsSync(prescreenPath)).toBe(true);
    const src = fs.readFileSync(prescreenPath, "utf8");
    expect(src).toContain("prescreenContent");
    expect(src).toContain("batchPrescreen");
  });

  it("PeerGroups page exists with SEOHead", () => {
    const pagePath = path.join(ROOT, "client/src/pages/learning/PeerGroups.tsx");
    expect(fs.existsSync(pagePath)).toBe(true);
    const src = fs.readFileSync(pagePath, "utf8");
    expect(src).toContain("SEOHead");
    expect(src).toContain("Peer Groups");
    expect(src).toContain("trpc.learning.peerGroups.list");
  });

  it("PeerGroups has loading and empty states", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "client/src/pages/learning/PeerGroups.tsx"),
      "utf8"
    );
    expect(src).toContain("isLoading");
    expect(src).toContain("No peer groups found");
    expect(src).toContain("animate-pulse");
  });

  it("PeerGroups route registered in App.tsx", () => {
    const appSrc = fs.readFileSync(path.join(ROOT, "client/src/App.tsx"), "utf8");
    expect(appSrc).toContain("PeerGroups");
    expect(appSrc).toContain("peer-groups");
  });
});

describe("Pass 46: P1-5 Office Hours Consent + Transcripts", () => {
  it("P46-3j: officeHoursConsent service exists", () => {
    const consentPath = path.join(ROOT, "server/services/learning/officeHoursConsent.ts");
    expect(fs.existsSync(consentPath)).toBe(true);
    const src = fs.readFileSync(consentPath, "utf8");
    expect(src).toContain("recordConsent");
    expect(src).toContain("checkAllConsented");
    expect(src).toContain("persistTranscript");
  });

  it("officeHoursConsent uses Drizzle sql template (not broken db.execute pattern)", () => {
    const src = fs.readFileSync(
      path.join(ROOT, "server/services/learning/officeHoursConsent.ts"),
      "utf8"
    );
    // Must NOT have the broken pattern
    const brokenPattern = /db\.execute\(\s*\{\s*sql:/;
    expect(brokenPattern.test(src)).toBe(false);
    // Must use Drizzle sql tagged template
    expect(src).toContain("import { sql } from \"drizzle-orm\"");
    expect(src).toContain("db.execute(sql`");
  });

  it("Consent procedures wired in learning router", () => {
    const routerSrc = fs.readFileSync(path.join(ROOT, "server/routers/learning.ts"), "utf8");
    expect(routerSrc).toContain("recordConsent");
    expect(routerSrc).toContain("checkConsent");
    expect(routerSrc).toContain("saveTranscript");
  });
});

describe("Pass 46: Convergence Verification", () => {
  it("All 9 non-AI items are Shipped in learning-state.json", () => {
    const state = JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf8")
    );
    // items is a dict keyed by item ID (P0-1, P1-2, etc.)
    const allEntries = Object.entries(state.items) as [string, any][];
    const nonAiItems = allEntries.filter(([, v]) => !v.ai_integration_dependent);
    expect(nonAiItems.length).toBe(9);
    for (const [key, item] of nonAiItems) {
      expect(item.state).toBe("Shipped");
    }
  });

  it("3 AI items are parked as Proposed-Waiting-AI", () => {
    const state = JSON.parse(
      fs.readFileSync(path.join(ROOT, "docs/learning-state.json"), "utf8")
    );
    const allEntries = Object.entries(state.items) as [string, any][];
    const aiItems = allEntries.filter(([, v]) => v.ai_integration_dependent);
    expect(aiItems.length).toBe(3);
    for (const [key, item] of aiItems) {
      expect(item.state).toBe("Proposed-Waiting-AI");
    }
  });

  it("All 9 baselines exist", () => {
    const baselines = [
      "P0-1", "P0-3", "P0-5", "P0-6", "P1-1", "P1-2", "P1-3", "P1-4", "P1-5"
    ];
    for (const id of baselines) {
      const baselinePath = path.join(ROOT, `docs/learning-baseline-${id}.json`);
      expect(fs.existsSync(baselinePath)).toBe(true);
    }
  });

  it("Convergence log exists", () => {
    const logPath = path.join(ROOT, "docs/convergence-log-parity.md");
    expect(fs.existsSync(logPath)).toBe(true);
    const content = fs.readFileSync(logPath, "utf8");
    expect(content).toMatch(/CONVERGED/);
  });
});
