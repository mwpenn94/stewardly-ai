/**
 * Unit tests for the pure meeting note extractor.
 *
 * Pass 3 of the hybrid build loop — PARITY-MEET-0001 partial.
 */
import { describe, it, expect } from "vitest";
import {
  extractNotes,
  parseDatePhrase,
  renderNotesMarkdown,
} from "./noteExtractor";

const FIXED_TODAY = new Date("2026-04-10T12:00:00Z");

// ─── parseDatePhrase ──────────────────────────────────────────────────────

describe("meetings/noteExtractor — parseDatePhrase", () => {
  it("parses ISO format", () => {
    expect(parseDatePhrase("2026-05-15")).toBe("2026-05-15");
  });
  it("parses US mm/dd/yyyy format", () => {
    expect(parseDatePhrase("5/15/2026")).toBe("2026-05-15");
  });
  it("parses US mm/dd/yy with 2-digit year (assumed 20xx)", () => {
    expect(parseDatePhrase("5/15/26")).toBe("2026-05-15");
  });
  it("pads single-digit months and days", () => {
    expect(parseDatePhrase("1/5/2026")).toBe("2026-01-05");
  });
  it("returns null for invalid months", () => {
    expect(parseDatePhrase("13/1/2026")).toBeNull();
  });
  it("parses 'in 2 weeks' relative to today", () => {
    const res = parseDatePhrase("in 2 weeks", FIXED_TODAY);
    expect(res).toBe("2026-04-24");
  });
  it("parses 'in 3 days'", () => {
    expect(parseDatePhrase("in 3 days", FIXED_TODAY)).toBe("2026-04-13");
  });
  it("parses 'in 2 months'", () => {
    expect(parseDatePhrase("in 2 months", FIXED_TODAY)).toBe("2026-06-10");
  });
  it("parses 'next week'", () => {
    expect(parseDatePhrase("next week", FIXED_TODAY)).toBe("2026-04-17");
  });
  it("returns null for unresolvable phrases", () => {
    expect(parseDatePhrase("sometime soon", FIXED_TODAY)).toBeNull();
  });
});

// ─── extractNotes — action items ──────────────────────────────────────────

describe("meetings/noteExtractor — action items", () => {
  it("catches checkbox bullets", () => {
    const t = `- [ ] Send 1099 to client\n- [ ] Review portfolio by Friday`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(2);
    expect(n.actionItems[0].text).toContain("Send 1099");
  });

  it("catches labeled action items", () => {
    const t = `TODO: Schedule follow-up meeting`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(1);
    expect(n.actionItems[0].text).toBe("Schedule follow-up meeting");
    expect(n.actionItems[0].reason).toBe("labeled");
  });

  it("catches 'Action:' and 'Follow up:' labels", () => {
    const t = `Action: Get updated beneficiary forms\nFollow up: Review estate docs`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(2);
  });

  it("catches 'we will' verb phrases", () => {
    const t = `We will rebalance the portfolio on 2026-05-15.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(1);
    expect(n.actionItems[0].reason).toBe("verb-phrase");
    expect(n.actionItems[0].dueDate).toBe("2026-05-15");
  });

  it("catches 'let's' verb phrases", () => {
    const t = `Let's schedule a review for next month.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(1);
  });

  it("assigns priority high on urgency keywords", () => {
    const t = `- [ ] URGENT: file the 1099 today`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems[0].priority).toBe("high");
  });

  it("assigns priority low on eventually", () => {
    const t = `- [ ] Eventually clean up the old docs`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems[0].priority).toBe("low");
  });

  it("extracts a numbered bullet action", () => {
    const t = `1. File tax extension before April 15`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(1);
  });

  it("ignores too-short bullets", () => {
    const t = `- OK`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems).toHaveLength(0);
  });

  it("captures an assignee from 'Client will'", () => {
    const t = `- [ ] Client will send updated W-2`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.actionItems[0].assignee).toBe("client");
  });
});

// ─── Decisions ─────────────────────────────────────────────────────────────

describe("meetings/noteExtractor — decisions", () => {
  it("catches 'Decision:' labels", () => {
    const t = `Decision: Move to 60/40 allocation`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.decisions).toHaveLength(1);
    expect(n.decisions[0].text).toBe("Move to 60/40 allocation");
  });

  it("catches inline 'we decided' phrases", () => {
    const t = `After discussion, we decided to delay the Roth conversion.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.decisions).toHaveLength(1);
    expect(n.decisions[0].text).toMatch(/delay the Roth/);
  });

  it("catches 'Resolved:' labels", () => {
    const t = `Resolved: Open the 529 for the kids`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.decisions).toHaveLength(1);
  });

  it("does not double-count a decision as an action item", () => {
    const t = `Decision: We will rebalance in May`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.decisions).toHaveLength(1);
    expect(n.actionItems).toHaveLength(0);
  });
});

// ─── Concerns ──────────────────────────────────────────────────────────────

describe("meetings/noteExtractor — concerns", () => {
  it("catches 'Concern:' labels", () => {
    const t = `Concern: Market volatility in 2027`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.concerns).toHaveLength(1);
    expect(n.concerns[0].category).toBe("risk");
  });

  it("catches 'worried about' phrases", () => {
    const t = `Client is worried about tax implications of inherited IRA.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.concerns).toHaveLength(1);
    expect(n.concerns[0].category).toBe("tax");
  });

  it("categorizes planning concerns", () => {
    const t = `Risk: retirement savings shortfall`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.concerns[0].category).toBe("planning");
  });

  it("defaults to general when no category matches", () => {
    const t = `Issue: scheduling conflict`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.concerns[0].category).toBe("general");
  });
});

// ─── Dates ─────────────────────────────────────────────────────────────────

describe("meetings/noteExtractor — dates", () => {
  it("collects ISO dates from anywhere in the transcript", () => {
    const t = `We'll follow up on 2026-06-15 to review.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.dates.some((d) => d.iso === "2026-06-15")).toBe(true);
  });

  it("collects US-format dates", () => {
    const t = `Scheduled for 6/15/2026.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.dates.some((d) => d.iso === "2026-06-15")).toBe(true);
  });

  it("collects relative phrases (may resolve to null iso)", () => {
    const t = `We'll reconvene by end of quarter.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.dates.some((d) => d.kind === "relative")).toBe(true);
  });
});

// ─── Participants ──────────────────────────────────────────────────────────

describe("meetings/noteExtractor — participants", () => {
  it("parses 'Present:' labels", () => {
    const t = `Present: Jane Smith, John Doe`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.participants.length).toBe(2);
    expect(n.participants.map((p) => p.name)).toContain("Jane Smith");
  });

  it("catches role + name inline", () => {
    const t = `Advisor: Sarah Lee began the meeting.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.participants.some((p) => p.name === "Sarah Lee")).toBe(true);
    expect(n.participants.some((p) => p.role === "advisor")).toBe(true);
  });

  it("handles 'Attendees:' alias", () => {
    const t = `Attendees: Alice, Bob`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.participants.length).toBe(2);
  });
});

// ─── Compliance flags ──────────────────────────────────────────────────────

describe("meetings/noteExtractor — compliance flags", () => {
  it("flags guarantee language as block", () => {
    const t = `This fund is guaranteed to return 8% per year.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.complianceFlags.some((f) => f.severity === "block")).toBe(true);
  });

  it("flags recommendation language as warn", () => {
    const t = `I recommend moving into bonds.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.complianceFlags.some((f) => f.severity === "warn")).toBe(true);
  });

  it("flags insurance mentions as info", () => {
    const t = `Let's talk about life insurance coverage.`;
    const n = extractNotes(t, FIXED_TODAY);
    expect(n.complianceFlags.some((f) => f.trigger === "insurance")).toBe(true);
  });

  it("catches multiple triggers on one line", () => {
    const t = `I recommend this guaranteed annuity — tax advice to follow.`;
    const n = extractNotes(t, FIXED_TODAY);
    const triggers = new Set(n.complianceFlags.map((f) => f.trigger));
    expect(triggers.has("recommendation")).toBe(true);
    expect(triggers.has("guarantee")).toBe(true);
    expect(triggers.has("tax_advice")).toBe(true);
  });
});

// ─── Empty / malformed transcripts ─────────────────────────────────────────

describe("meetings/noteExtractor — defensive handling", () => {
  it("returns empty output + warning on empty transcript", () => {
    const n = extractNotes("");
    expect(n.actionItems).toHaveLength(0);
    expect(n.warnings.some((w) => /Empty/i.test(w))).toBe(true);
  });

  it("warns on very short transcripts", () => {
    const n = extractNotes("Hi.");
    expect(n.warnings.some((w) => /short/i.test(w))).toBe(true);
  });

  it("ignores blank lines in the line count", () => {
    const n = extractNotes("Line 1\n\n\nLine 2");
    expect(n.analyzedLines).toBe(2);
  });
});

// ─── renderNotesMarkdown ───────────────────────────────────────────────────

describe("meetings/noteExtractor — renderNotesMarkdown", () => {
  it("produces sections only when populated", () => {
    const t = `- [ ] Send docs\nDecision: Rebalance`;
    const n = extractNotes(t, FIXED_TODAY);
    const md = renderNotesMarkdown(n);
    expect(md).toMatch(/## Action items/);
    expect(md).toMatch(/## Decisions/);
    expect(md).not.toMatch(/## Attendees/);
  });

  it("formats action items as checkbox markdown", () => {
    const t = `- [ ] Client will send docs by 2026-05-01`;
    const n = extractNotes(t, FIXED_TODAY);
    const md = renderNotesMarkdown(n);
    expect(md).toMatch(/- \[ \]/);
    expect(md).toMatch(/due 2026-05-01/);
  });

  it("returns empty string when nothing was extracted", () => {
    const n = extractNotes("");
    expect(renderNotesMarkdown(n)).toBe("");
  });
});

// ─── End-to-end: realistic advisor transcript ─────────────────────────────

describe("meetings/noteExtractor — realistic transcript", () => {
  const TRANSCRIPT = `Present: Sarah Lee (advisor), Jane Doe (client), Bob Doe

Sarah Lee: Thanks for coming in. Before we start, I want to note that I recommend we discuss the IRA rollover today.

Jane Doe: We're worried about the market volatility and what it means for our retirement plan.

Bob Doe: And we're concerned about taxes next year.

Decision: Move 20% from tech to bonds next month.

- [ ] Advisor will prepare a rollover checklist by 2026-05-01
- [ ] Client will gather W-2 documents by 5/15/2026
- [ ] Send updated beneficiary forms in 2 weeks

We decided to delay the Roth conversion until Q4.

Let's reconvene by end of quarter.`;

  it("extracts everything", () => {
    const n = extractNotes(TRANSCRIPT, FIXED_TODAY);
    expect(n.actionItems.length).toBeGreaterThanOrEqual(3);
    expect(n.decisions.length).toBeGreaterThanOrEqual(2);
    expect(n.concerns.length).toBeGreaterThanOrEqual(2);
    expect(n.participants.length).toBeGreaterThanOrEqual(3);
    expect(n.complianceFlags.length).toBeGreaterThan(0);
    expect(n.dates.some((d) => d.iso === "2026-05-01")).toBe(true);
    expect(n.dates.some((d) => d.iso === "2026-05-15")).toBe(true);
  });
});
