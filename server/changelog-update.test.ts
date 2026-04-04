import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const WHATS_NEW_PATH = "/home/ubuntu/wealthbridge-ai/client/src/components/WhatsNewModal.tsx";
const CHANGELOG_BELL_PATH = "/home/ubuntu/wealthbridge-ai/client/src/components/ChangelogBell.tsx";

describe("Changelog Data Update (v2026.04.04)", () => {
  const content = readFileSync(WHATS_NEW_PATH, "utf-8");

  it("CURRENT_VERSION is updated to 2026.04.04", () => {
    expect(content).toContain('CURRENT_VERSION = "2026.04.04"');
  });

  it("v2026.04.04 release is the first entry in CHANGELOG array", () => {
    const firstVersionIdx = content.indexOf('version: "2026.04.04"');
    const secondVersionIdx = content.indexOf('version: "2026.04.01"');
    expect(firstVersionIdx).toBeGreaterThan(0);
    expect(secondVersionIdx).toBeGreaterThan(firstVersionIdx);
  });

  it("v2026.04.04 includes all 8 entries", () => {
    const titles = [
      "Sentry error tracking",
      "131 new database tables deployed",
      "Shared navigation config",
      "Mobile swipe gestures",
      "Onboarding moved to notifications",
      "Notification panel visibility",
      "Chat audio text rendering",
      "CORS enforcement",
    ];
    for (const title of titles) {
      expect(content).toContain(title);
    }
  });

  it("v2026.04.04 has correct category distribution (4 feature, 1 improvement, 2 fix, 1 security)", () => {
    // Extract the v2026.04.04 section
    const startIdx = content.indexOf('version: "2026.04.04"');
    const endIdx = content.indexOf('version: "2026.04.01"');
    const section = content.substring(startIdx, endIdx);

    const featureCount = (section.match(/category: "feature"/g) || []).length;
    const improvementCount = (section.match(/category: "improvement"/g) || []).length;
    const fixCount = (section.match(/category: "fix"/g) || []).length;
    const securityCount = (section.match(/category: "security"/g) || []).length;

    expect(featureCount).toBe(4);
    expect(improvementCount).toBe(1);
    expect(fixCount).toBe(2);
    expect(securityCount).toBe(1);
  });

  it("previous releases are preserved (5 total releases)", () => {
    const releases = content.match(/version: "20\d{2}\.\d{2}\.\d{2}/g) || [];
    expect(releases.length).toBeGreaterThanOrEqual(5);
  });
});

describe("ChangelogBell Portal Fix", () => {
  const content = readFileSync(CHANGELOG_BELL_PATH, "utf-8");

  it("uses createPortal for the dropdown", () => {
    expect(content).toContain("createPortal");
    expect(content).toContain("document.body");
  });

  it("uses fixed positioning with z-index 9999", () => {
    expect(content).toContain('position: "fixed"');
    expect(content).toContain("zIndex: 9999");
  });

  it("calculates position from bell button rect", () => {
    expect(content).toContain("getBoundingClientRect");
    expect(content).toContain("bellRef");
  });

  it("supports upward and downward opening", () => {
    expect(content).toContain("spaceBelow");
    expect(content).toContain("spaceAbove");
    // Uses bottom/top style properties for direction
    expect(content).toContain("bottom:");
    expect(content).toContain("top: rect.bottom");
  });

  it("handles outside clicks and Escape key", () => {
    expect(content).toContain("mousedown");
    expect(content).toContain("Escape");
  });

  it("recalculates position on resize and scroll", () => {
    expect(content).toContain("resize");
    expect(content).toContain("scroll");
  });

  it("suppresses tooltip when panel is open", () => {
    // When isOpen, the bell button renders without Tooltip wrapper
    expect(content).toContain("isOpen ? (");
    expect(content).toContain("bellButton");
    // When closed, tooltip wraps the bell
    expect(content).toContain("<Tooltip>");
    expect(content).toContain("<TooltipTrigger asChild>");
  });

  it("matches NotificationBell positioning pattern (bottom/top style, panelStyle object)", () => {
    expect(content).toContain("panelStyle");
    expect(content).toContain("setPanelStyle");
    expect(content).toContain("calculatePosition");
    // Uses same margin and width approach
    expect(content).toContain("margin");
    expect(content).toContain("panelWidth");
  });
});
