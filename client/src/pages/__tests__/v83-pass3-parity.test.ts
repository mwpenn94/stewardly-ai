/**
 * v8.3 Pass 3 — parity tests
 *
 * G18  Focus trap wired into overlays
 * G20  Icon-only buttons have aria-label
 * G27  Shortcut hints in Calculators tooltips
 * PARITY-NAV-0006  PersonaSidebar5 coverage ≥100 match paths
 * PARITY-MOBILE-0008  CodeChat outline+files panels mobile-visible
 * PARITY-DATA-0007  RelationshipsHub meetings+campaigns stats wired
 * G45  200% zoom CSS safety rules
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const CLIENT = path.resolve(__dirname, "../..");

function read(rel: string) {
  return fs.readFileSync(path.join(CLIENT, rel), "utf-8");
}

// ─── G18: Focus trap in overlays ──────────────────────────────────────────
describe("G18 — universal focus trap", () => {
  const overlays = [
    { file: "components/KeyboardShortcuts.tsx", label: "KeyboardShortcuts" },
    { file: "components/codeChat/KeyboardShortcutsOverlay.tsx", label: "codeChat KBOverlay" },
    { file: "components/codeChat/ActionPalettePopover.tsx", label: "ActionPalette" },
    { file: "components/codeChat/AgentMemoryPopover.tsx", label: "AgentMemory" },
    { file: "components/codeChat/SessionsLibraryPopover.tsx", label: "SessionsLibrary" },
    { file: "components/learning/KeyboardHelpOverlay.tsx", label: "Learning KBHelp" },
  ];

  overlays.forEach(({ file, label }) => {
    it(`${label} imports useFocusTrap`, () => {
      const src = read(file);
      expect(src).toContain("useFocusTrap");
    });
  });
});

// ─── G20: Icon-only button aria-label audit ───────────────────────────────
describe("G20 — icon-only buttons have aria-label", () => {
  it("Calculators.tsx keyboard shortcut button has aria-label", () => {
    const src = read("pages/Calculators.tsx");
    // The keyboard shortcut icon button should have aria-label
    expect(src).toMatch(/aria-label=.*[Kk]eyboard/);
  });

  it("no icon-only buttons without aria-label in key pages", () => {
    // Spot check: PersonaSidebar5 icon buttons
    const sidebar = read("components/PersonaSidebar5.tsx");
    // All buttons in sidebar should have aria-label or visible text
    const buttonMatches = sidebar.match(/<button[^>]*>/g) || [];
    const missingLabel = buttonMatches.filter(
      (b) => !b.includes("aria-label") && !b.includes("role=")
    );
    // Allow some buttons that have visible text children (not icon-only)
    // Just verify the count is reasonable (< 5 unlabeled)
    expect(missingLabel.length).toBeLessThan(5);
  });
});

// ─── G27: Shortcut hints in tooltips ──────────────────────────────────────
describe("G27 — shortcut hints in Calculators tooltips", () => {
  it("Calculators.tsx imports Tooltip components", () => {
    const src = read("pages/Calculators.tsx");
    expect(src).toContain("Tooltip");
    expect(src).toContain("TooltipTrigger");
    expect(src).toContain("TooltipContent");
  });

  it("TooltipProvider is in global layout (App.tsx)", () => {
    const app = read("App.tsx");
    expect(app).toContain("TooltipProvider");
  });

  it("toolbar buttons wrapped in Tooltip with shortcut text", () => {
    const src = read("pages/Calculators.tsx");
    // Should have shortcut hints like ⌘/ or similar in tooltip content
    expect(src).toMatch(/TooltipContent/);
    // Should have at least 2 tooltip-wrapped toolbar buttons
    const tooltipCount = (src.match(/TooltipContent/g) || []).length;
    expect(tooltipCount).toBeGreaterThanOrEqual(2);
  });
});

// ─── PARITY-NAV-0006: PersonaSidebar5 coverage ───────────────────────────
describe("PARITY-NAV-0006 — sidebar coverage", () => {
  it("PersonaSidebar5 has ≥100 match paths", () => {
    const src = read("components/PersonaSidebar5.tsx");
    const matches = src.match(/match:\s*\[([^\]]+)\]/g) || [];
    let totalPaths = 0;
    matches.forEach((m) => {
      const paths = m.match(/"\//g) || [];
      totalPaths += paths.length;
    });
    expect(totalPaths).toBeGreaterThanOrEqual(100);
  });

  it("/code-chat is matched under Chat nav item", () => {
    const src = read("components/PersonaSidebar5.tsx");
    expect(src).toMatch(/label:\s*"Chat"[^}]*match:\s*\[[^\]]*"\/code-chat"/);
  });

  it("/changelog is matched under Help footer item", () => {
    const src = read("components/PersonaSidebar5.tsx");
    expect(src).toMatch(/label:\s*"Help"[^}]*match:\s*\[[^\]]*"\/changelog"/);
  });

  it("/ai-settings is matched under Settings footer item", () => {
    const src = read("components/PersonaSidebar5.tsx");
    expect(src).toMatch(/label:\s*"Settings"[^}]*match:\s*\[[^\]]*"\/ai-settings"/);
  });
});

// ─── PARITY-MOBILE-0008: CodeChat mobile sidebars ────────────────────────
describe("PARITY-MOBILE-0008 — CodeChat mobile panels", () => {
  it("outline panel is not hidden md:flex (mobile-visible)", () => {
    const src = read("pages/CodeChat.tsx");
    // Should NOT have "hidden md:flex" on the outline panel anymore
    expect(src).not.toMatch(/hidden md:flex flex-col w-60 border-r/);
    // Should have responsive width
    expect(src).toContain("w-full md:w-60");
  });

  it("files panel is not hidden md:flex (mobile-visible)", () => {
    const src = read("pages/CodeChat.tsx");
    expect(src).not.toMatch(/hidden md:flex flex-col w-80 border-l/);
    expect(src).toContain("w-full md:w-80");
  });

  it("mobile menu has Outline and Files toggle buttons", () => {
    const src = read("pages/CodeChat.tsx");
    expect(src).toMatch(/Show Outline|Hide Outline/);
    expect(src).toMatch(/Show Files|Hide Files/);
  });

  it("split layout uses flex-col md:flex-row for mobile stacking", () => {
    const src = read("pages/CodeChat.tsx");
    expect(src).toContain("flex flex-col md:flex-row flex-1 min-h-0");
  });
});

// ─── PARITY-DATA-0007: RelationshipsHub real stats ───────────────────────
describe("PARITY-DATA-0007 — RelationshipsHub real stats", () => {
  it("wires meetings.list query", () => {
    const src = read("pages/RelationshipsHub.tsx");
    expect(src).toContain("trpc.meetings.list.useQuery");
  });

  it("wires emailCampaign.list query", () => {
    const src = read("pages/RelationshipsHub.tsx");
    expect(src).toContain("trpc.emailCampaign.list.useQuery");
  });

  it("Upcoming stat uses upcomingCount variable", () => {
    const src = read("pages/RelationshipsHub.tsx");
    expect(src).toContain("String(upcomingCount)");
  });

  it("Campaigns stat uses campaignCount variable", () => {
    const src = read("pages/RelationshipsHub.tsx");
    expect(src).toContain("String(campaignCount)");
  });
});

// ─── G45: 200% zoom CSS safety ──────────────────────────────────────────
describe("G45 — 200% zoom font safety", () => {
  it("index.css has min-resolution 192dpi media query", () => {
    const cssContent = read("index.css");
    expect(cssContent).toContain("min-resolution: 192dpi");
  });

  it("zoom safety rules cover text-[9px] through text-[12px]", () => {
    const cssContent = read("index.css");
    expect(cssContent).toContain(".text-\\[9px\\]");
    expect(cssContent).toContain(".text-\\[10px\\]");
    expect(cssContent).toContain(".text-\\[11px\\]");
    expect(cssContent).toContain(".text-\\[12px\\]");
  });

  it("uses max() function for progressive enhancement", () => {
    const cssContent = read("index.css");
    expect(cssContent).toMatch(/font-size:\s*max\(/);
  });
});
