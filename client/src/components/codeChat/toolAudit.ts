/**
 * Tool audit rules + trail — Pass 249.
 *
 * A pure client-side rule engine that evaluates every tool call event
 * (tool_start / tool_result) against a user-defined list of pattern
 * rules. Each rule emits an AuditVerdict (`safe` / `warn` / `block` /
 * `log`). Rules are stored in localStorage and matched by:
 *   - tool name (exact, or "*" wildcard)
 *   - optional regex against a JSON-serialized argument payload
 *
 * The trail itself is a ring buffer of AuditEntry rows, each capturing
 * {ruleId, toolName, verdict, note, timestamp, stepIndex}. Export as
 * CSV for compliance archives.
 *
 * The module is pure — no React, no DOM. Integration lives in
 * useCodeChatStream.ts which dispatches tool events through
 * evaluateTool() and the ToolAuditPopover component which renders the
 * rules editor + trail.
 *
 * Claude Code parity: this is the closest analog of Claude Code's
 * PreToolUse / PostToolUse hooks system. Since the Code Chat server
 * runs tools synchronously inside the SSE stream, we can't _block_ a
 * tool execution, but we can warn + log + expose the full audit
 * history with compliance-grade CSV export.
 */

export type AuditVerdict = "safe" | "warn" | "block" | "log";

export interface AuditRule {
  /** Stable identifier (uuid-ish) */
  id: string;
  /** Human label shown in the rules editor */
  label: string;
  /** Tool name to match, or "*" for any */
  tool: string;
  /** Optional regex source matched against JSON.stringify(args) */
  argPattern?: string;
  /** Verdict to emit on match */
  verdict: AuditVerdict;
  /** Optional short explanation shown when the rule fires */
  note?: string;
  /** If false, the rule is kept but skipped during evaluation */
  enabled: boolean;
  /** Unix ms timestamp of creation */
  createdAt: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  toolName: string;
  stepIndex: number;
  verdict: AuditVerdict;
  ruleId: string;
  ruleLabel: string;
  note?: string;
  /** Trimmed JSON preview of the args that triggered the rule */
  argsPreview?: string;
}

export interface AuditState {
  rules: AuditRule[];
  entries: AuditEntry[];
}

export const MAX_ENTRIES = 500;
export const MAX_RULES = 100;
const STORAGE_KEY = "stewardly-codechat-audit";

// ─── Built-in rules ───────────────────────────────────────────────────

/**
 * Starter set of dangerous-pattern rules. These are merged in once on
 * first load so new users get safety coverage without having to
 * configure anything. Each entry is deterministic — the id is a stable
 * slug so re-imports don't duplicate.
 */
export const BUILT_IN_RULES: Readonly<AuditRule[]> = [
  {
    id: "builtin-rm-rf-root",
    label: "rm -rf against root or wildcards",
    tool: "run_bash",
    argPattern: "rm\\s+-[a-z]*r[a-z]*f?\\s+(/|~|\\*|\\.)",
    verdict: "block",
    note: "Recursive delete targets root, home, or a broad wildcard",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-sudo",
    label: "sudo invocation",
    tool: "run_bash",
    argPattern: "\\bsudo\\b",
    verdict: "warn",
    note: "Privilege escalation attempted inside the sandbox",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-git-hard-reset",
    label: "git destructive reset",
    tool: "run_bash",
    argPattern: "git\\s+(reset\\s+--hard|clean\\s+-[a-z]*f)",
    verdict: "warn",
    note: "Destructive git operation detected",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-force-push",
    label: "git force push",
    tool: "run_bash",
    argPattern: "git\\s+push\\s+.*--force",
    verdict: "block",
    note: "Force push can rewrite remote history",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-env-file-write",
    label: "Writing into .env files",
    tool: "write_file",
    argPattern: "\\.env(?:$|[\\\"'/\\.])",
    verdict: "warn",
    note: "Secret files should only be edited by humans",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-drop-table",
    label: "SQL DROP TABLE statement",
    tool: "*",
    argPattern: "DROP\\s+TABLE",
    verdict: "warn",
    note: "Destructive SQL migration detected",
    enabled: true,
    createdAt: 0,
  },
  {
    id: "builtin-log-writes",
    label: "Audit every write",
    tool: "write_file",
    verdict: "log",
    enabled: true,
    createdAt: 0,
  },
];

// ─── Rule matching ────────────────────────────────────────────────────

export interface RuleMatch {
  rule: AuditRule;
  verdict: AuditVerdict;
  argsPreview: string;
}

/**
 * Safely compile a regex. Returns null on invalid source so the
 * evaluator can silently skip broken rules rather than crashing the
 * entire hook pipeline.
 */
export function compilePattern(source: string | undefined): RegExp | null {
  if (!source) return null;
  try {
    return new RegExp(source, "i");
  } catch {
    return null;
  }
}

/**
 * Evaluate a single tool call against the rule list. Returns every
 * rule that matched, in declaration order. Rules with the most severe
 * verdict are surfaced first via `strongestVerdict`.
 *
 * An `args` value that can't be serialized (cyclic structure, etc.)
 * is treated as an empty-string payload so the `tool === "*"` no-arg
 * rules still fire.
 */
export function evaluateTool(
  rules: AuditRule[],
  toolName: string,
  args: Record<string, unknown> | undefined,
): RuleMatch[] {
  let argsJson = "";
  try {
    argsJson = args ? JSON.stringify(args) : "";
  } catch {
    argsJson = "";
  }
  const preview = argsJson.length > 300 ? argsJson.slice(0, 300) + "…" : argsJson;
  const out: RuleMatch[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.tool !== "*" && rule.tool !== toolName) continue;
    if (rule.argPattern) {
      const compiled = compilePattern(rule.argPattern);
      if (!compiled) continue;
      if (!compiled.test(argsJson)) continue;
    }
    out.push({ rule, verdict: rule.verdict, argsPreview: preview });
  }
  return out;
}

const VERDICT_RANK: Record<AuditVerdict, number> = {
  log: 0,
  safe: 1,
  warn: 2,
  block: 3,
};

/**
 * Given a set of matches, return the single most severe verdict
 * (block > warn > safe > log). Returns "safe" when the list is empty.
 */
export function strongestVerdict(matches: RuleMatch[]): AuditVerdict {
  if (matches.length === 0) return "safe";
  let best: AuditVerdict = "log";
  for (const m of matches) {
    if (VERDICT_RANK[m.verdict] > VERDICT_RANK[best]) best = m.verdict;
  }
  return best;
}

// ─── State mutations ──────────────────────────────────────────────────

export function createEmptyState(): AuditState {
  return { rules: [], entries: [] };
}

export function seedBuiltins(state: AuditState): AuditState {
  const existingIds = new Set(state.rules.map((r) => r.id));
  const merged = [...state.rules];
  for (const rule of BUILT_IN_RULES) {
    if (!existingIds.has(rule.id)) {
      merged.push({ ...rule });
    }
  }
  return { ...state, rules: merged };
}

export function addRule(
  state: AuditState,
  partial: Omit<AuditRule, "id" | "createdAt" | "enabled"> & {
    enabled?: boolean;
    id?: string;
  },
): AuditState {
  if (state.rules.length >= MAX_RULES) {
    return state;
  }
  const rule: AuditRule = {
    id: partial.id ?? `rule-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: partial.label,
    tool: partial.tool,
    argPattern: partial.argPattern,
    verdict: partial.verdict,
    note: partial.note,
    enabled: partial.enabled ?? true,
    createdAt: Date.now(),
  };
  return { ...state, rules: [...state.rules, rule] };
}

export function removeRule(state: AuditState, id: string): AuditState {
  return { ...state, rules: state.rules.filter((r) => r.id !== id) };
}

export function toggleRule(state: AuditState, id: string): AuditState {
  return {
    ...state,
    rules: state.rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r,
    ),
  };
}

export function updateRule(
  state: AuditState,
  id: string,
  patch: Partial<Omit<AuditRule, "id" | "createdAt">>,
): AuditState {
  return {
    ...state,
    rules: state.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  };
}

/**
 * Append audit entries for every rule that matched. Enforces the
 * MAX_ENTRIES ring-buffer cap by dropping the oldest.
 */
export function recordMatches(
  state: AuditState,
  toolName: string,
  stepIndex: number,
  matches: RuleMatch[],
): AuditState {
  if (matches.length === 0) return state;
  const now = Date.now();
  const added: AuditEntry[] = matches.map((m, i) => ({
    id: `entry-${now}-${stepIndex}-${i}`,
    timestamp: now,
    toolName,
    stepIndex,
    verdict: m.verdict,
    ruleId: m.rule.id,
    ruleLabel: m.rule.label,
    note: m.rule.note,
    argsPreview: m.argsPreview,
  }));
  const merged = [...state.entries, ...added];
  // Keep only the newest MAX_ENTRIES
  const trimmed =
    merged.length > MAX_ENTRIES
      ? merged.slice(merged.length - MAX_ENTRIES)
      : merged;
  return { ...state, entries: trimmed };
}

export function clearEntries(state: AuditState): AuditState {
  return { ...state, entries: [] };
}

export function clearRules(state: AuditState): AuditState {
  return { ...state, rules: [] };
}

// ─── Persistence ──────────────────────────────────────────────────────

function isValidVerdict(v: unknown): v is AuditVerdict {
  return v === "safe" || v === "warn" || v === "block" || v === "log";
}

export function parseState(raw: string | null): AuditState {
  if (!raw) return seedBuiltins(createEmptyState());
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return seedBuiltins(createEmptyState());
    }
    const rawRules = Array.isArray(parsed.rules) ? parsed.rules : [];
    const rawEntries = Array.isArray(parsed.entries) ? parsed.entries : [];
    const rules: AuditRule[] = [];
    for (const r of rawRules) {
      if (!r || typeof r !== "object") continue;
      const rr = r as Record<string, unknown>;
      if (typeof rr.id !== "string" || typeof rr.label !== "string") continue;
      if (typeof rr.tool !== "string") continue;
      if (!isValidVerdict(rr.verdict)) continue;
      rules.push({
        id: rr.id,
        label: rr.label,
        tool: rr.tool,
        argPattern: typeof rr.argPattern === "string" ? rr.argPattern : undefined,
        verdict: rr.verdict,
        note: typeof rr.note === "string" ? rr.note : undefined,
        enabled: rr.enabled !== false,
        createdAt: typeof rr.createdAt === "number" ? rr.createdAt : 0,
      });
      if (rules.length >= MAX_RULES) break;
    }
    const entries: AuditEntry[] = [];
    for (const e of rawEntries) {
      if (!e || typeof e !== "object") continue;
      const ee = e as Record<string, unknown>;
      if (typeof ee.id !== "string") continue;
      if (typeof ee.toolName !== "string") continue;
      if (!isValidVerdict(ee.verdict)) continue;
      entries.push({
        id: ee.id,
        timestamp: typeof ee.timestamp === "number" ? ee.timestamp : 0,
        toolName: ee.toolName,
        stepIndex: typeof ee.stepIndex === "number" ? ee.stepIndex : 0,
        verdict: ee.verdict,
        ruleId: typeof ee.ruleId === "string" ? ee.ruleId : "",
        ruleLabel: typeof ee.ruleLabel === "string" ? ee.ruleLabel : "",
        note: typeof ee.note === "string" ? ee.note : undefined,
        argsPreview: typeof ee.argsPreview === "string" ? ee.argsPreview : undefined,
      });
      if (entries.length >= MAX_ENTRIES) break;
    }
    // Always top up built-ins if the user wiped them — keeps the
    // safety net intact without clobbering user overrides since we
    // dedupe by id.
    const state: AuditState = { rules, entries };
    return seedBuiltins(state);
  } catch {
    return seedBuiltins(createEmptyState());
  }
}

export function serializeState(state: AuditState): string {
  return JSON.stringify({ rules: state.rules, entries: state.entries });
}

export function loadState(): AuditState {
  if (typeof localStorage === "undefined") {
    return seedBuiltins(createEmptyState());
  }
  try {
    return parseState(localStorage.getItem(STORAGE_KEY));
  } catch {
    return seedBuiltins(createEmptyState());
  }
}

export function saveState(state: AuditState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeState(state));
  } catch {
    /* quota */
  }
}

// ─── Export ──────────────────────────────────────────────────────────

/**
 * Convert the trail into CSV for compliance archiving. Fields are
 * wrapped in double quotes and internal quotes escaped per RFC 4180.
 * Order matches a typical SIEM import: timestamp first.
 */
export function exportAuditCsv(entries: AuditEntry[]): string {
  const rows: string[][] = [
    ["timestamp", "tool", "step", "verdict", "rule", "note", "args_preview"],
  ];
  for (const e of entries) {
    rows.push([
      new Date(e.timestamp).toISOString(),
      e.toolName,
      String(e.stepIndex),
      e.verdict,
      e.ruleLabel,
      e.note ?? "",
      e.argsPreview ?? "",
    ]);
  }
  return rows
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");
}

function csvEscape(v: string): string {
  if (v == null) return '""';
  const needsQuote = /[",\n\r]/.test(v);
  const escaped = v.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

// ─── Summary helpers ──────────────────────────────────────────────────

export interface AuditSummary {
  total: number;
  byVerdict: Record<AuditVerdict, number>;
  byTool: Record<string, number>;
  lastAt: number | null;
}

export function summarizeTrail(entries: AuditEntry[]): AuditSummary {
  const byVerdict: Record<AuditVerdict, number> = {
    safe: 0,
    warn: 0,
    block: 0,
    log: 0,
  };
  const byTool: Record<string, number> = {};
  let lastAt: number | null = null;
  for (const e of entries) {
    byVerdict[e.verdict] = (byVerdict[e.verdict] ?? 0) + 1;
    byTool[e.toolName] = (byTool[e.toolName] ?? 0) + 1;
    if (lastAt === null || e.timestamp > lastAt) lastAt = e.timestamp;
  }
  return { total: entries.length, byVerdict, byTool, lastAt };
}
