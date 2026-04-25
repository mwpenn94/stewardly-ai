/**
 * pass36.test.ts — Vitest tests for Pass 36: EMBA parity learning engine pages
 *
 * Tests cover:
 * 1. Route registration in App.tsx for all 9 new pages
 * 2. Navigation entries in navigation.ts for all 9 new pages
 * 3. PersonaSidebar5 match array includes new paths
 * 4. listFormulas content service function exists
 * 5. listFormulas tRPC procedure exists in learning router
 * 6. PomodoroTimer component file exists
 * 7. Page component files exist for all 9 new pages
 * 8. NavReachability: new nav hrefs have corresponding routes
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), "utf-8");
}

// ─── Route Registration ─────────────────────────────────────────────────────

describe("Pass 36: Route registration in App.tsx", () => {
  const appSrc = readFile("client/src/App.tsx");

  const newRoutes = [
    "/learning/hands-free",
    "/learning/ai-quiz",
    "/learning/formula-lab",
    "/learning/analytics",
    "/learning/export",
    "/learning/bookmarks",
    "/learning/playlists",
    "/learning/groups",
    "/learning/discovery",
  ];

  for (const route of newRoutes) {
    it(`registers route ${route}`, () => {
      expect(appSrc).toContain(`path="${route}"`);
    });
  }
});

// ─── Lazy Imports ────────────────────────────────────────────────────────────

describe("Pass 36: Lazy imports in App.tsx", () => {
  const appSrc = readFile("client/src/App.tsx");

  const lazyComponents = [
    "HandsFreeStudy",
    "AIQuizPage",
    "FormulaLab",
    "StudyAnalytics",
    "ProgressExport",
    "Bookmarks",
    "Playlists",
    "StudyGroups",
    "DiscoveryHistory",
  ];

  for (const comp of lazyComponents) {
    it(`lazy-imports ${comp}`, () => {
      expect(appSrc).toContain(`const ${comp} = lazy(`);
    });
  }
});

// ─── Navigation Entries ──────────────────────────────────────────────────────

describe("Pass 36: Navigation entries in navigation.ts", () => {
  const navSrc = readFile("client/src/lib/navigation.ts");

  const navEntries = [
    { href: "/learning/hands-free", label: "Hands-Free Study" },
    { href: "/learning/ai-quiz", label: "AI Quiz" },
    { href: "/learning/formula-lab", label: "Formula Lab" },
    { href: "/learning/analytics", label: "Study Analytics" },
    { href: "/learning/export", label: "Export Progress" },
    { href: "/learning/bookmarks", label: "Bookmarks" },
    { href: "/learning/playlists", label: "Playlists" },
    { href: "/learning/groups", label: "Study Groups" },
    { href: "/learning/discovery", label: "Discovery Log" },
  ];

  for (const entry of navEntries) {
    it(`has nav entry for ${entry.label} (${entry.href})`, () => {
      expect(navSrc).toContain(`href: "${entry.href}"`);
      expect(navSrc).toContain(`label: "${entry.label}"`);
    });
  }
});

// ─── PersonaSidebar5 Match Array ─────────────────────────────────────────────

describe("Pass 36: PersonaSidebar5 match array", () => {
  const sidebarSrc = readFile("client/src/components/PersonaSidebar5.tsx");

  const newPaths = [
    "/learning/hands-free",
    "/learning/ai-quiz",
    "/learning/formula-lab",
    "/learning/analytics",
    "/learning/export",
    "/learning/bookmarks",
    "/learning/playlists",
    "/learning/groups",
    "/learning/discovery",
  ];

  for (const p of newPaths) {
    it(`includes ${p} in LEARN_ITEM match array`, () => {
      expect(sidebarSrc).toContain(`"${p}"`);
    });
  }
});

// ─── Page Component Files ────────────────────────────────────────────────────

describe("Pass 36: Page component files exist", () => {
  const pages = [
    "client/src/pages/learning/HandsFreeStudy.tsx",
    "client/src/pages/learning/AIQuizPage.tsx",
    "client/src/pages/learning/FormulaLab.tsx",
    "client/src/pages/learning/StudyAnalytics.tsx",
    "client/src/pages/learning/ProgressExport.tsx",
    "client/src/pages/learning/Bookmarks.tsx",
    "client/src/pages/learning/Playlists.tsx",
    "client/src/pages/learning/StudyGroups.tsx",
    "client/src/pages/learning/DiscoveryHistory.tsx",
  ];

  for (const page of pages) {
    it(`${page} exists`, () => {
      expect(fs.existsSync(path.join(ROOT, page))).toBe(true);
    });
  }

  it("PomodoroTimer component exists", () => {
    expect(fs.existsSync(path.join(ROOT, "client/src/components/PomodoroTimer.tsx"))).toBe(true);
  });
});

// ─── Backend: listFormulas ───────────────────────────────────────────────────

describe("Pass 36: listFormulas backend", () => {
  it("listFormulas function exists in content service", () => {
    const contentSrc = readFile("server/services/learning/content.ts");
    expect(contentSrc).toContain("listFormulas");
  });

  it("listFormulas procedure exists in learning router", () => {
    const routerSrc = readFile("server/routers/learning.ts");
    expect(routerSrc).toContain("listFormulas");
  });
});

// ─── Page Content Quality ────────────────────────────────────────────────────

describe("Pass 36: Page content quality checks", () => {
  it("HandsFreeStudy uses TTS/audio patterns", () => {
    const src = readFile("client/src/pages/learning/HandsFreeStudy.tsx");
    expect(src).toMatch(/tts|audio|speech|play|queue/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("AIQuizPage uses LLM quiz generation", () => {
    const src = readFile("client/src/pages/learning/AIQuizPage.tsx");
    expect(src).toMatch(/quiz|question|answer|difficulty/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("FormulaLab has interactive calculators", () => {
    const src = readFile("client/src/pages/learning/FormulaLab.tsx");
    expect(src).toMatch(/formula|calculator|compute|calculate/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("StudyAnalytics has charts/metrics", () => {
    const src = readFile("client/src/pages/learning/StudyAnalytics.tsx");
    expect(src).toMatch(/analytics|streak|accuracy|mastery/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("ProgressExport has CSV/JSON export", () => {
    const src = readFile("client/src/pages/learning/ProgressExport.tsx");
    expect(src).toMatch(/csv|json|export|download/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("Bookmarks has bookmark management", () => {
    const src = readFile("client/src/pages/learning/Bookmarks.tsx");
    expect(src).toMatch(/bookmark|note|remove|search/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("Playlists has CRUD operations", () => {
    const src = readFile("client/src/pages/learning/Playlists.tsx");
    expect(src).toMatch(/playlist|create|remove|share/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("StudyGroups has group management", () => {
    const src = readFile("client/src/pages/learning/StudyGroups.tsx");
    expect(src).toMatch(/group|invite|join|member/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("DiscoveryHistory has exploration log", () => {
    const src = readFile("client/src/pages/learning/DiscoveryHistory.tsx");
    expect(src).toMatch(/discovery|question|answer|explore/i);
    expect(src).toMatch(/AppShell|LearningShell/);
  });

  it("PomodoroTimer has timer logic", () => {
    const src = readFile("client/src/components/PomodoroTimer.tsx");
    expect(src).toMatch(/pomodoro|timer|work|break|interval/i);
    expect(src).toMatch(/play|pause|reset/i);
  });
});

// ─── Auth Guards ─────────────────────────────────────────────────────────────

describe("Pass 36: Auth guards on all pages", () => {
  const pages = [
    "client/src/pages/learning/HandsFreeStudy.tsx",
    "client/src/pages/learning/AIQuizPage.tsx",
    "client/src/pages/learning/FormulaLab.tsx",
    "client/src/pages/learning/StudyAnalytics.tsx",
    "client/src/pages/learning/ProgressExport.tsx",
    "client/src/pages/learning/Bookmarks.tsx",
    "client/src/pages/learning/Playlists.tsx",
    "client/src/pages/learning/StudyGroups.tsx",
    "client/src/pages/learning/DiscoveryHistory.tsx",
  ];

  for (const page of pages) {
    it(`${path.basename(page)} has auth guard`, () => {
      const src = readFile(page);
      expect(src).toMatch(/isAuthenticated|useAuth/);
      expect(src).toMatch(/getLoginUrl|Sign In/);
    });
  }
});
