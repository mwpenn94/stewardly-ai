/**
 * Tests for tool audit rules — Pass 249.
 */

import { describe, it, expect } from "vitest";
import {
  evaluateTool,
  strongestVerdict,
  createEmptyState,
  seedBuiltins,
  addRule,
  removeRule,
  toggleRule,
  updateRule,
  recordMatches,
  clearEntries,
  clearRules,
  parseState,
  serializeState,
  exportAuditCsv,
  summarizeTrail,
  compilePattern,
  MAX_ENTRIES,
  MAX_RULES,
  BUILT_IN_RULES,
  type AuditState,
  type AuditRule,
} from "./toolAudit";

function makeRule(partial: Partial<AuditRule>): AuditRule {
  return {
    id: partial.id ?? "r1",
    label: partial.label ?? "test",
    tool: partial.tool ?? "run_bash",
    argPattern: partial.argPattern,
    verdict: partial.verdict ?? "warn",
    note: partial.note,
    enabled: partial.enabled ?? true,
    createdAt: partial.createdAt ?? 0,
  };
}

describe("compilePattern", () => {
  it("compiles a valid regex", () => {
    const re = compilePattern("rm\\s+-rf");
    expect(re).not.toBeNull();
    expect(re!.test("rm -rf /tmp")).toBe(true);
  });

  it("returns null for an invalid regex", () => {
    expect(compilePattern("[unterminated")).toBeNull();
  });

  it("returns null for an empty source", () => {
    expect(compilePattern("")).toBeNull();
    expect(compilePattern(undefined)).toBeNull();
  });

  it("case-insensitive matching", () => {
    const re = compilePattern("SUDO");
    expect(re!.test("sudo apt")).toBe(true);
  });
});

describe("evaluateTool", () => {
  it("matches by exact tool name", () => {
    const rules = [makeRule({ tool: "write_file", verdict: "log" })];
    const hits = evaluateTool(rules, "write_file", { path: "foo" });
    expect(hits).toHaveLength(1);
  });

  it("matches wildcard tool", () => {
    const rules = [makeRule({ tool: "*", verdict: "log" })];
    const hits = evaluateTool(rules, "read_file", { path: "foo" });
    expect(hits).toHaveLength(1);
  });

  it("ignores disabled rules", () => {
    const rules = [makeRule({ tool: "*", enabled: false })];
    expect(evaluateTool(rules, "read_file", {})).toHaveLength(0);
  });

  it("filters by argPattern", () => {
    const rules = [
      makeRule({
        tool: "run_bash",
        argPattern: "rm\\s+-rf",
        verdict: "block",
      }),
    ];
    expect(
      evaluateTool(rules, "run_bash", { command: "rm -rf /tmp" }),
    ).toHaveLength(1);
    expect(
      evaluateTool(rules, "run_bash", { command: "ls -la" }),
    ).toHaveLength(0);
  });

  it("skips rules with broken regex", () => {
    const rules = [makeRule({ argPattern: "[oops" })];
    // should not throw, just skip
    expect(evaluateTool(rules, "run_bash", { command: "ls" })).toHaveLength(0);
  });

  it("returns multiple matches in declaration order", () => {
    const rules = [
      makeRule({ id: "a", tool: "*", verdict: "log" }),
      makeRule({ id: "b", tool: "run_bash", verdict: "warn" }),
    ];
    const hits = evaluateTool(rules, "run_bash", { command: "ls" });
    expect(hits.map((h) => h.rule.id)).toEqual(["a", "b"]);
  });

  it("truncates large args preview", () => {
    const rules = [makeRule({ tool: "*" })];
    const hits = evaluateTool(rules, "x", {
      content: "a".repeat(500),
    });
    expect(hits[0].argsPreview.length).toBeLessThanOrEqual(301);
    expect(hits[0].argsPreview.endsWith("…")).toBe(true);
  });

  it("handles undefined args gracefully", () => {
    const rules = [makeRule({ tool: "*" })];
    const hits = evaluateTool(rules, "x", undefined);
    expect(hits).toHaveLength(1);
  });
});

describe("strongestVerdict", () => {
  it("returns safe for empty matches", () => {
    expect(strongestVerdict([])).toBe("safe");
  });

  it("prefers block over warn", () => {
    const rules = [
      { rule: makeRule({ verdict: "warn" }), verdict: "warn" as const, argsPreview: "" },
      { rule: makeRule({ verdict: "block" }), verdict: "block" as const, argsPreview: "" },
    ];
    expect(strongestVerdict(rules)).toBe("block");
  });

  it("prefers warn over log", () => {
    const rules = [
      { rule: makeRule({ verdict: "log" }), verdict: "log" as const, argsPreview: "" },
      { rule: makeRule({ verdict: "warn" }), verdict: "warn" as const, argsPreview: "" },
    ];
    expect(strongestVerdict(rules)).toBe("warn");
  });
});

describe("seedBuiltins", () => {
  it("adds all built-ins to empty state", () => {
    const state = seedBuiltins(createEmptyState());
    expect(state.rules.length).toBe(BUILT_IN_RULES.length);
    expect(state.rules.some((r) => r.id === "builtin-rm-rf-root")).toBe(true);
  });

  it("does not duplicate when run twice", () => {
    const once = seedBuiltins(createEmptyState());
    const twice = seedBuiltins(once);
    expect(twice.rules.length).toBe(BUILT_IN_RULES.length);
  });

  it("preserves user rules when seeding", () => {
    const state = addRule(createEmptyState(), {
      label: "mine",
      tool: "write_file",
      verdict: "log",
    });
    const seeded = seedBuiltins(state);
    expect(seeded.rules.some((r) => r.label === "mine")).toBe(true);
    expect(seeded.rules.length).toBe(BUILT_IN_RULES.length + 1);
  });
});

describe("addRule / removeRule / toggleRule / updateRule", () => {
  it("addRule assigns stable id when omitted", () => {
    const state = addRule(createEmptyState(), {
      label: "a",
      tool: "run_bash",
      verdict: "warn",
    });
    expect(state.rules[0].id).toMatch(/^rule-/);
  });

  it("addRule respects explicit id", () => {
    const state = addRule(createEmptyState(), {
      id: "explicit",
      label: "a",
      tool: "run_bash",
      verdict: "warn",
    });
    expect(state.rules[0].id).toBe("explicit");
  });

  it("caps total rules at MAX_RULES", () => {
    let state = createEmptyState();
    for (let i = 0; i < MAX_RULES + 5; i++) {
      state = addRule(state, {
        label: `r${i}`,
        tool: "*",
        verdict: "log",
      });
    }
    expect(state.rules.length).toBe(MAX_RULES);
  });

  it("removeRule drops matching id", () => {
    const seeded = seedBuiltins(createEmptyState());
    const out = removeRule(seeded, "builtin-sudo");
    expect(out.rules.some((r) => r.id === "builtin-sudo")).toBe(false);
    expect(out.rules.length).toBe(seeded.rules.length - 1);
  });

  it("toggleRule flips enabled", () => {
    const seeded = seedBuiltins(createEmptyState());
    const toggled = toggleRule(seeded, "builtin-sudo");
    const rule = toggled.rules.find((r) => r.id === "builtin-sudo")!;
    expect(rule.enabled).toBe(false);
    const toggled2 = toggleRule(toggled, "builtin-sudo");
    expect(toggled2.rules.find((r) => r.id === "builtin-sudo")!.enabled).toBe(
      true,
    );
  });

  it("updateRule patches fields", () => {
    const state = addRule(createEmptyState(), {
      id: "u1",
      label: "a",
      tool: "*",
      verdict: "log",
    });
    const out = updateRule(state, "u1", { label: "b", verdict: "warn" });
    expect(out.rules[0].label).toBe("b");
    expect(out.rules[0].verdict).toBe("warn");
  });
});

describe("recordMatches", () => {
  it("appends one entry per match", () => {
    const state = createEmptyState();
    const matches = [
      {
        rule: makeRule({ id: "a", label: "A" }),
        verdict: "warn" as const,
        argsPreview: "{}",
      },
      {
        rule: makeRule({ id: "b", label: "B" }),
        verdict: "block" as const,
        argsPreview: "{}",
      },
    ];
    const out = recordMatches(state, "run_bash", 3, matches);
    expect(out.entries.length).toBe(2);
    expect(out.entries[0].ruleLabel).toBe("A");
    expect(out.entries[1].verdict).toBe("block");
  });

  it("caps entries at MAX_ENTRIES", () => {
    let state = createEmptyState();
    for (let i = 0; i < MAX_ENTRIES + 50; i++) {
      state = recordMatches(state, "write_file", i, [
        {
          rule: makeRule({ id: `r${i}` }),
          verdict: "log",
          argsPreview: "",
        },
      ]);
    }
    expect(state.entries.length).toBe(MAX_ENTRIES);
  });

  it("empty matches returns unchanged state", () => {
    const state = createEmptyState();
    const out = recordMatches(state, "x", 0, []);
    expect(out).toBe(state);
  });
});

describe("clearEntries / clearRules", () => {
  it("clearEntries empties the trail", () => {
    let state = createEmptyState();
    state = recordMatches(state, "x", 0, [
      { rule: makeRule({}), verdict: "log", argsPreview: "" },
    ]);
    expect(state.entries.length).toBe(1);
    state = clearEntries(state);
    expect(state.entries.length).toBe(0);
  });

  it("clearRules empties rules without touching trail", () => {
    let state = seedBuiltins(createEmptyState());
    state = recordMatches(state, "x", 0, [
      { rule: makeRule({}), verdict: "log", argsPreview: "" },
    ]);
    const cleared = clearRules(state);
    expect(cleared.rules.length).toBe(0);
    expect(cleared.entries.length).toBe(1);
  });
});

describe("parseState / serializeState", () => {
  it("round-trips through JSON", () => {
    const state = addRule(createEmptyState(), {
      id: "r1",
      label: "l",
      tool: "run_bash",
      verdict: "warn",
      argPattern: "x",
    });
    const out = parseState(serializeState(state));
    expect(out.rules.some((r) => r.id === "r1")).toBe(true);
  });

  it("returns built-ins on null input", () => {
    const out = parseState(null);
    expect(out.rules.length).toBe(BUILT_IN_RULES.length);
  });

  it("rejects malformed JSON gracefully", () => {
    const out = parseState("{not json");
    expect(out.rules.length).toBe(BUILT_IN_RULES.length);
  });

  it("drops entries with invalid verdict", () => {
    const raw = JSON.stringify({
      rules: [
        {
          id: "r1",
          label: "a",
          tool: "run_bash",
          verdict: "bogus",
        },
      ],
      entries: [],
    });
    const out = parseState(raw);
    // The user rule was dropped; built-ins remain
    expect(out.rules.some((r) => r.id === "r1")).toBe(false);
    expect(out.rules.length).toBe(BUILT_IN_RULES.length);
  });

  it("rebuilds missing built-ins", () => {
    const raw = JSON.stringify({ rules: [], entries: [] });
    const out = parseState(raw);
    expect(out.rules.length).toBe(BUILT_IN_RULES.length);
  });
});

describe("exportAuditCsv", () => {
  it("produces a header + row per entry", () => {
    const entries = [
      {
        id: "e1",
        timestamp: 0,
        toolName: "run_bash",
        stepIndex: 3,
        verdict: "warn" as const,
        ruleId: "r1",
        ruleLabel: "test",
        note: "a",
        argsPreview: "{}",
      },
    ];
    const csv = exportAuditCsv(entries);
    const lines = csv.split("\n");
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain("timestamp");
    expect(lines[1]).toContain("run_bash");
  });

  it("escapes embedded quotes per RFC 4180", () => {
    const entries = [
      {
        id: "e1",
        timestamp: 0,
        toolName: "x",
        stepIndex: 0,
        verdict: "log" as const,
        ruleId: "r",
        ruleLabel: 'label with "quote"',
        argsPreview: "",
      },
    ];
    const csv = exportAuditCsv(entries);
    expect(csv).toContain('"label with ""quote"""');
  });

  it("escapes commas and newlines", () => {
    const entries = [
      {
        id: "e1",
        timestamp: 0,
        toolName: "x",
        stepIndex: 0,
        verdict: "log" as const,
        ruleId: "r",
        ruleLabel: "a, b\nc",
        argsPreview: "",
      },
    ];
    const csv = exportAuditCsv(entries);
    expect(csv).toContain('"a, b\nc"');
  });
});

describe("summarizeTrail", () => {
  it("counts by verdict and tool", () => {
    const state: AuditState = { rules: [], entries: [] };
    const next = recordMatches(state, "run_bash", 0, [
      { rule: makeRule({ verdict: "warn" }), verdict: "warn", argsPreview: "" },
      { rule: makeRule({ verdict: "block" }), verdict: "block", argsPreview: "" },
    ]);
    const s = summarizeTrail(next.entries);
    expect(s.total).toBe(2);
    expect(s.byVerdict.warn).toBe(1);
    expect(s.byVerdict.block).toBe(1);
    expect(s.byTool.run_bash).toBe(2);
    expect(s.lastAt).not.toBeNull();
  });

  it("returns zeros for empty trail", () => {
    const s = summarizeTrail([]);
    expect(s.total).toBe(0);
    expect(s.lastAt).toBeNull();
  });
});

describe("built-in rule matchers", () => {
  it("rm -rf / flags as block", () => {
    const state = seedBuiltins(createEmptyState());
    const hits = evaluateTool(state.rules, "run_bash", {
      command: "rm -rf /",
    });
    expect(hits.some((h) => h.rule.id === "builtin-rm-rf-root")).toBe(true);
    expect(strongestVerdict(hits)).toBe("block");
  });

  it("force push flags as block", () => {
    const state = seedBuiltins(createEmptyState());
    const hits = evaluateTool(state.rules, "run_bash", {
      command: "git push origin main --force",
    });
    expect(hits.some((h) => h.rule.id === "builtin-force-push")).toBe(true);
  });

  it("sudo flags as warn", () => {
    const state = seedBuiltins(createEmptyState());
    const hits = evaluateTool(state.rules, "run_bash", {
      command: "sudo apt install",
    });
    expect(hits.some((h) => h.rule.id === "builtin-sudo")).toBe(true);
  });

  it(".env writes flag as warn", () => {
    const state = seedBuiltins(createEmptyState());
    const hits = evaluateTool(state.rules, "write_file", {
      path: "config/.env",
      content: "SECRET=x",
    });
    expect(hits.some((h) => h.rule.id === "builtin-env-file-write")).toBe(true);
  });

  it("normal ls command is safe", () => {
    const state = seedBuiltins(createEmptyState());
    const hits = evaluateTool(state.rules, "run_bash", {
      command: "ls -la",
    });
    // May match a log-everything rule but not warn/block
    const strongest = strongestVerdict(hits);
    expect(strongest === "safe" || strongest === "log").toBe(true);
  });
});
