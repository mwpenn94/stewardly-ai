import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const chatTsx = readFileSync(resolve(__dirname, "../client/src/pages/Chat.tsx"), "utf-8");
const chatGreetingTsx = readFileSync(resolve(__dirname, "../client/src/components/ChatGreeting.tsx"), "utf-8");
const appsGridMenuTsx = readFileSync(resolve(__dirname, "../client/src/components/AppsGridMenu.tsx"), "utf-8");

describe("Manus-next UI Overhaul — ChatGreeting", () => {
  it("renders serif greeting with time-of-day logic", () => {
    expect(chatGreetingTsx).toContain("Good morning");
    expect(chatGreetingTsx).toContain("Good afternoon");
    expect(chatGreetingTsx).toContain("Good evening");
    expect(chatGreetingTsx).toContain("font-heading");
  });

  it("has horizontal suggestion cards for engines", () => {
    expect(chatGreetingTsx).toContain("SUGGESTION_CARDS");
    expect(chatGreetingTsx).toContain("Run a Financial Projection");
    expect(chatGreetingTsx).toContain("Manage Client Relationships");
    expect(chatGreetingTsx).toContain("Study for Certification");
  });

  it("has quick action pills", () => {
    expect(chatGreetingTsx).toContain("QUICK_ACTIONS");
    expect(chatGreetingTsx).toContain("Retirement projection");
    expect(chatGreetingTsx).toContain("Compare strategies");
    expect(chatGreetingTsx).toContain("Insurance review");
  });

  it("has continue where you left off section", () => {
    expect(chatGreetingTsx).toContain("Continue where you left off");
    expect(chatGreetingTsx).toContain("recentConversations");
  });
});

describe("Manus-next UI Overhaul — AppsGridMenu", () => {
  it("exports AppsGridMenu component", () => {
    expect(appsGridMenuTsx).toContain("export function AppsGridMenu");
  });

  it("contains all 4 engine entries", () => {
    expect(appsGridMenuTsx).toContain("Wealth Engine");
    expect(appsGridMenuTsx).toContain("People");
    expect(appsGridMenuTsx).toContain("Learning");
    expect(appsGridMenuTsx).toContain("Intelligence");
  });

  it("uses dropdown menu pattern for the drawer", () => {
    expect(appsGridMenuTsx).toContain("DropdownMenu");
    expect(appsGridMenuTsx).toContain("DropdownMenuTrigger");
    expect(appsGridMenuTsx).toContain("DropdownMenuContent");
  });
});

describe("Manus-next UI Overhaul — Message Display", () => {
  it("uses clean Stewardly name label instead of TierBadge", () => {
    // The old TierBadge pattern should be gone from the message rendering
    expect(chatTsx).not.toMatch(/TierBadge[\s\S]*?model=\{msg\.model/);
    // New clean header
    expect(chatTsx).toContain('"text-xs font-semibold text-foreground">Stewardly</span>');
  });

  it("uses compact text-label action buttons", () => {
    // Manus-next pattern: text labels like "Listen", "Regenerate"
    expect(chatTsx).toContain("Listen");
    expect(chatTsx).toContain("Regenerate");
    // Uses 11px text size
    expect(chatTsx).toContain('text-[11px]');
  });

  it("removed verbose consensus panels from message rendering area", () => {
    // The message rendering section (after line 2300) should not contain consensus inline
    const messageSection = chatTsx.slice(chatTsx.indexOf("Manus-next clean header"));
    expect(messageSection).not.toContain("Consensus: {Math.round");
    expect(messageSection).not.toContain("wealthConsensus");
  });

  it("removed ReasoningChain and QualityScoreDisplay from message rendering", () => {
    // These should not appear in the message rendering section
    const messageSection = chatTsx.slice(chatTsx.indexOf("Manus-next clean header"));
    expect(messageSection).not.toContain("<ReasoningChain");
    expect(messageSection).not.toContain("<QualityScoreDisplay");
  });
});

describe("Manus-next UI Overhaul — Sidebar Filter Pills", () => {
  it("has task status filter pills (All, Active, Completed)", () => {
    expect(chatTsx).toContain("convFilter");
    expect(chatTsx).toContain('"All", "Active", "Completed"');
  });

  it("filters conversations based on status", () => {
    expect(chatTsx).toContain('convFilter === "Active"');
    expect(chatTsx).toContain('convFilter === "Completed"');
  });
});

describe("Manus-next UI Overhaul — Bottom Bar", () => {
  it("has compact icon row in sidebar bottom", () => {
    expect(chatTsx).toContain("AppsGridMenu");
  });
});
