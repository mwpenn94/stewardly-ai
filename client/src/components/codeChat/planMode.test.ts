/**
 * Tests for planMode.ts (Pass 236).
 */

import { describe, it, expect } from "vitest";
import {
  parsePlanFromText,
  looksLikePlan,
  planProgress,
  nextPendingStep,
  updateStepStatus,
  updateStepDescription,
  addStep,
  removeStep,
  reorderStep,
  approveAllSteps,
  rejectPlan,
  unapprovePlan,
  discardPlan,
  buildExecutionPrompt,
  snapshotPlan,
  restorePlan,
  type Plan,
} from "./planMode";

const mkPlan = (stepCount = 3): Plan => {
  const now = 1_700_000_000_000;
  return {
    id: "plan-1",
    title: "Test plan",
    createdAt: now,
    updatedAt: now,
    status: "draft",
    steps: Array.from({ length: stepCount }, (_, i) => ({
      id: `step-${i + 1}`,
      description: `Step ${i + 1}`,
      status: "pending" as const,
    })),
  };
};

describe("parsePlanFromText", () => {
  it("parses a numbered list", () => {
    const plan = parsePlanFromText(`
      1. Read the file
      2. Grep for usages
      3. Write the fix
    `);
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBe(3);
    expect(plan!.steps[0].description).toBe("Read the file");
    expect(plan!.steps[2].description).toBe("Write the fix");
    expect(plan!.steps[0].status).toBe("pending");
  });

  it("parses Step N: prefixes", () => {
    const plan = parsePlanFromText(`
      Step 1: Identify the bug
      Step 2: Fix the logic
      Step 3: Add a test
    `);
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBe(3);
    expect(plan!.steps[1].description).toBe("Fix the logic");
  });

  it("parses bullets when no numbered list exists", () => {
    const plan = parsePlanFromText(`
      - Do A
      - Do B
      - Do C
    `);
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBe(3);
  });

  it("prefers numbered over bullets when both present", () => {
    const plan = parsePlanFromText(`
      1. First thing
      2. Second thing
      - unrelated bullet
    `);
    expect(plan).not.toBeNull();
    expect(plan!.steps.length).toBe(2);
  });

  it("extracts title from markdown heading", () => {
    const plan = parsePlanFromText(`
      # Refactor auth layer

      1. Read middleware
      2. Update token check
    `);
    expect(plan!.title).toBe("Refactor auth layer");
  });

  it("falls back to Execution Plan when no title", () => {
    const plan = parsePlanFromText(`1. foo\n2. bar`);
    expect(plan!.title).toBe("Execution Plan");
  });

  it("honors explicit title override", () => {
    const plan = parsePlanFromText(`1. foo`, "Custom");
    expect(plan!.title).toBe("Custom");
  });

  it("returns null when no structure is found", () => {
    expect(parsePlanFromText("just prose with no list")).toBeNull();
    expect(parsePlanFromText("")).toBeNull();
  });

  it("returns null for non-string input", () => {
    // @ts-expect-error — intentionally passing wrong type
    expect(parsePlanFromText(null)).toBeNull();
    // @ts-expect-error
    expect(parsePlanFromText(undefined)).toBeNull();
  });

  it("extracts tool hints from bracketed annotations", () => {
    const plan = parsePlanFromText(`1. Read server/index.ts [tool: read_file]`);
    expect(plan!.steps[0].toolHint).toBe("read_file");
  });

  it("extracts tool hints from (uses X) form", () => {
    const plan = parsePlanFromText(`1. Search for TODO (uses grep_search)`);
    expect(plan!.steps[0].toolHint).toBe("grep_search");
  });

  it("assigns sequential ids", () => {
    const plan = parsePlanFromText(`1. A\n2. B\n3. C`);
    expect(plan!.steps.map((s) => s.id)).toEqual(["step-1", "step-2", "step-3"]);
  });
});

describe("looksLikePlan", () => {
  it("accepts valid multi-step plans", () => {
    expect(looksLikePlan("1. a\n2. b")).toBe(true);
  });
  it("rejects single-step text", () => {
    expect(looksLikePlan("1. just one thing")).toBe(false);
  });
  it("rejects plain prose", () => {
    expect(looksLikePlan("This is a paragraph.")).toBe(false);
  });
  it("rejects empty string", () => {
    expect(looksLikePlan("")).toBe(false);
  });
});

describe("planProgress", () => {
  it("reports 0/N on a fresh plan", () => {
    const plan = mkPlan(3);
    const p = planProgress(plan);
    expect(p.done).toBe(0);
    expect(p.total).toBe(3);
    expect(p.pct).toBe(0);
    expect(p.complete).toBe(false);
  });

  it("counts done/failed/skipped/executing separately", () => {
    const plan = mkPlan(4);
    plan.steps[0].status = "done";
    plan.steps[1].status = "failed";
    plan.steps[2].status = "skipped";
    plan.steps[3].status = "executing";
    const p = planProgress(plan);
    expect(p.done).toBe(1);
    expect(p.failed).toBe(1);
    expect(p.skipped).toBe(1);
    expect(p.executing).toBe(1);
  });

  it("reports complete when all steps finished", () => {
    const plan = mkPlan(2);
    plan.steps[0].status = "done";
    plan.steps[1].status = "skipped";
    const p = planProgress(plan);
    expect(p.complete).toBe(true);
    expect(p.pct).toBe(1);
  });

  it("handles empty plan", () => {
    const plan = mkPlan(0);
    const p = planProgress(plan);
    expect(p.total).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.complete).toBe(false);
  });
});

describe("nextPendingStep", () => {
  it("returns the first pending step", () => {
    const plan = mkPlan(3);
    plan.steps[0].status = "done";
    const next = nextPendingStep(plan);
    expect(next?.id).toBe("step-2");
  });

  it("returns the first approved step if no pending remain", () => {
    const plan = mkPlan(2);
    plan.steps[0].status = "done";
    plan.steps[1].status = "approved";
    const next = nextPendingStep(plan);
    expect(next?.id).toBe("step-2");
  });

  it("returns null when all finished", () => {
    const plan = mkPlan(2);
    plan.steps[0].status = "done";
    plan.steps[1].status = "failed";
    expect(nextPendingStep(plan)).toBeNull();
  });
});

describe("mutations", () => {
  it("updateStepStatus changes status + note", () => {
    const plan = mkPlan(2);
    const next = updateStepStatus(plan, "step-1", "done", "all good");
    expect(next.steps[0].status).toBe("done");
    expect(next.steps[0].note).toBe("all good");
    expect(next.steps[1].status).toBe("pending");
    // Original unchanged
    expect(plan.steps[0].status).toBe("pending");
  });

  it("updateStepStatus ignores unknown id", () => {
    const plan = mkPlan(1);
    const next = updateStepStatus(plan, "missing", "done");
    expect(next).toBe(plan);
  });

  it("updateStepDescription trims and rewrites", () => {
    const plan = mkPlan(1);
    const next = updateStepDescription(plan, "step-1", "  new desc  ");
    expect(next.steps[0].description).toBe("new desc");
  });

  it("updateStepDescription rejects empty string", () => {
    const plan = mkPlan(1);
    const next = updateStepDescription(plan, "step-1", "   ");
    expect(next).toBe(plan);
  });

  it("addStep appends when no afterId", () => {
    const plan = mkPlan(2);
    const next = addStep(plan, "New step");
    expect(next.steps.length).toBe(3);
    expect(next.steps[2].description).toBe("New step");
  });

  it("addStep inserts after specified id", () => {
    const plan = mkPlan(3);
    const next = addStep(plan, "Inserted", "step-1");
    expect(next.steps.length).toBe(4);
    expect(next.steps[1].description).toBe("Inserted");
    expect(next.steps[2].id).toBe("step-2");
  });

  it("addStep rejects empty description", () => {
    const plan = mkPlan(1);
    const next = addStep(plan, "   ");
    expect(next).toBe(plan);
  });

  it("removeStep drops the matching id", () => {
    const plan = mkPlan(3);
    const next = removeStep(plan, "step-2");
    expect(next.steps.length).toBe(2);
    expect(next.steps.map((s) => s.id)).toEqual(["step-1", "step-3"]);
  });

  it("removeStep is a no-op for unknown id", () => {
    const plan = mkPlan(2);
    const next = removeStep(plan, "missing");
    expect(next).toBe(plan);
  });

  it("reorderStep moves up", () => {
    const plan = mkPlan(3);
    const next = reorderStep(plan, "step-2", "up");
    expect(next.steps.map((s) => s.id)).toEqual(["step-2", "step-1", "step-3"]);
  });

  it("reorderStep moves down", () => {
    const plan = mkPlan(3);
    const next = reorderStep(plan, "step-1", "down");
    expect(next.steps.map((s) => s.id)).toEqual(["step-2", "step-1", "step-3"]);
  });

  it("reorderStep at edges is a no-op", () => {
    const plan = mkPlan(2);
    expect(reorderStep(plan, "step-1", "up")).toBe(plan);
    expect(reorderStep(plan, "step-2", "down")).toBe(plan);
  });

  it("approveAllSteps flips pending to approved + marks plan approved", () => {
    const plan = mkPlan(3);
    plan.steps[1].status = "done";
    const next = approveAllSteps(plan);
    expect(next.status).toBe("approved");
    expect(next.steps[0].status).toBe("approved");
    expect(next.steps[1].status).toBe("done"); // untouched
    expect(next.steps[2].status).toBe("approved");
  });

  it("rejectPlan sets status to aborted", () => {
    const plan = mkPlan(2);
    const next = rejectPlan(plan);
    expect(next.status).toBe("aborted");
  });
});

// Pass v5 #83: unapprove/discard mutators
describe("unapprovePlan", () => {
  it("flips an approved plan with only pending/approved steps back to draft", () => {
    const plan = approveAllSteps(mkPlan(3));
    expect(plan.status).toBe("approved");
    expect(plan.steps.every((s) => s.status === "approved")).toBe(true);
    const next = unapprovePlan(plan);
    expect(next.status).toBe("draft");
    expect(next.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("refuses to unapprove if any step is executing", () => {
    const plan = approveAllSteps(mkPlan(3));
    plan.steps[1].status = "executing";
    const next = unapprovePlan(plan);
    expect(next).toBe(plan); // no-op
  });

  it("refuses to unapprove if any step is done or failed", () => {
    const p1 = approveAllSteps(mkPlan(3));
    p1.steps[0].status = "done";
    expect(unapprovePlan(p1)).toBe(p1);
    const p2 = approveAllSteps(mkPlan(3));
    p2.steps[0].status = "failed";
    expect(unapprovePlan(p2)).toBe(p2);
  });

  it("tolerates skipped steps when unapproving", () => {
    const plan = approveAllSteps(mkPlan(3));
    plan.steps[1].status = "skipped";
    const next = unapprovePlan(plan);
    expect(next.status).toBe("draft");
    // Skipped stays skipped; approved flips to pending
    expect(next.steps[0].status).toBe("pending");
    expect(next.steps[1].status).toBe("skipped");
    expect(next.steps[2].status).toBe("pending");
  });
});

describe("discardPlan", () => {
  it("returns null for any plan", () => {
    expect(discardPlan(mkPlan(3))).toBeNull();
    expect(discardPlan(mkPlan(0))).toBeNull();
    expect(discardPlan(approveAllSteps(mkPlan(2)))).toBeNull();
  });
});

describe("buildExecutionPrompt", () => {
  it("includes every step numbered", () => {
    const plan = mkPlan(3);
    const prompt = buildExecutionPrompt(plan);
    expect(prompt).toContain("1. Step 1");
    expect(prompt).toContain("2. Step 2");
    expect(prompt).toContain("3. Step 3");
  });

  it("includes the plan title", () => {
    const plan = mkPlan(1);
    const prompt = buildExecutionPrompt(plan);
    expect(prompt).toContain("Test plan");
  });

  it("includes the progress marker format", () => {
    const prompt = buildExecutionPrompt(mkPlan(1));
    expect(prompt).toContain("✓ Step N complete");
    expect(prompt).toContain("✗ Step N failed");
    expect(prompt).toContain("— Step N skipped");
  });
});

describe("snapshotPlan / restorePlan", () => {
  it("round-trips a plan through snapshot and back", () => {
    const plan = mkPlan(2);
    plan.steps[0].status = "done";
    plan.steps[0].note = "ok";
    const snap = snapshotPlan(plan);
    const restored = restorePlan(snap);
    expect(restored.id).toBe(plan.id);
    expect(restored.title).toBe(plan.title);
    expect(restored.steps[0].status).toBe("done");
    expect(restored.steps[0].note).toBe("ok");
  });

  it("omits undefined notes from snapshots", () => {
    const plan = mkPlan(1);
    const snap = snapshotPlan(plan);
    expect(snap.steps[0].note).toBeUndefined();
  });
});
