/**
 * Code chat executor — Round B1.
 *
 * Claude-Code-style multi-turn coding agent that:
 *  1. Takes a user instruction
 *  2. Plans a sequence of code-tool calls
 *  3. Executes them via the sandboxed file tools
 *  4. Iterates until the task is complete or max-iterations hit
 *  5. Returns a structured trace + final summary
 *
 * The executor is model-agnostic: it accepts a `runLLM` callback so
 * the same loop can be driven by different models (Claude, GPT,
 * Gemini, etc.) via Stewardly's existing model registry. This is
 * intentional — different coding tasks suit different models, and
 * the autonomous loop (B3) picks the model per task.
 *
 * The executor does NOT directly invoke an LLM. The chat router
 * (Phase B5) wires it to `contextualLLM` from stewardlyWiring.
 */

import {
  readFile,
  writeFile,
  editFile,
  listDirectory,
  runBash,
  type SandboxOptions,
  type ReadFileResult,
  type WriteFileResult,
  type EditFileResult,
  type BashResult,
  type ListDirEntry,
  SandboxError,
} from "./fileTools";

// ─── Tool registry ────────────────────────────────────────────────────────

export type CodeToolName =
  | "read_file"
  | "write_file"
  | "edit_file"
  | "list_directory"
  | "grep_search"
  | "run_bash"
  | "update_todos"
  | "find_symbol"
  | "infer_schema"
  | "generate_adapter"
  | "detect_schema_drift"
  | "map_to_crm_contact"
  | "finish";

export interface CodeToolCall {
  name: CodeToolName;
  /** Tool-specific arguments. Validated at dispatch time. */
  args: Record<string, unknown>;
  /** Optional natural-language reason for the call */
  reason?: string;
}

export interface AgentTodoItem {
  id: string;
  content: string;
  activeForm: string;
  status: "pending" | "in_progress" | "completed";
}

export interface SymbolLookupHit {
  name: string;
  kind: string;
  path: string;
  line: number;
  snippet: string;
  exported: boolean;
}

export type CodeToolResult =
  | { kind: "read"; result: ReadFileResult }
  | { kind: "write"; result: WriteFileResult }
  | { kind: "edit"; result: EditFileResult }
  | { kind: "list"; result: { path: string; entries: ListDirEntry[] } }
  | { kind: "grep"; result: { matches: Array<{ file: string; line: number; text: string }>; truncated: boolean } }
  | { kind: "bash"; result: BashResult }
  | { kind: "todos"; result: { todos: AgentTodoItem[]; count: number } }
  | { kind: "symbols"; result: { query: string; matches: SymbolLookupHit[]; truncated: boolean } }
  | { kind: "schema_inference"; result: { summary: string; fieldCount: number; primaryKey: string | null; confidence: number; schema: unknown } }
  | { kind: "adapter_spec"; result: { summary: string; ready: boolean; confidence: number; spec: unknown } }
  | { kind: "schema_drift"; result: { summary: string; compatible: boolean; breaking: number; warning: number; info: number; changes: unknown } }
  | { kind: "crm_mapping"; result: { summary: string; entityType: string; matchedCount: number; missingRequired: string[]; confidence: number; matches: unknown } }
  | { kind: "finish"; result: { summary: string } }
  | { kind: "error"; error: string; code: string };

export interface CodeChatStep {
  index: number;
  toolCall: CodeToolCall;
  result: CodeToolResult;
  durationMs: number;
}

export interface CodeChatRunResult {
  finished: boolean;
  iterations: number;
  steps: CodeChatStep[];
  summary: string;
  /** Aggregate counts the autonomous loop uses for budget caps */
  stats: {
    reads: number;
    writes: number;
    edits: number;
    bashRuns: number;
    grepSearches: number;
    errors: number;
  };
}

// ─── Single tool dispatch ────────────────────────────────────────────────

/**
 * Dispatch one tool call. Used both by the multi-turn executor below
 * and by the tRPC procedures that expose individual tools.
 */
export async function dispatchCodeTool(
  call: CodeToolCall,
  sandbox: SandboxOptions,
): Promise<CodeToolResult> {
  try {
    switch (call.name) {
      case "read_file": {
        const r = await readFile(sandbox, String(call.args.path));
        return { kind: "read", result: r };
      }
      case "write_file": {
        const r = await writeFile(
          sandbox,
          String(call.args.path),
          String(call.args.content ?? ""),
        );
        return { kind: "write", result: r };
      }
      case "edit_file": {
        const r = await editFile(
          sandbox,
          String(call.args.path),
          String(call.args.oldString ?? ""),
          String(call.args.newString ?? ""),
          Boolean(call.args.replaceAll),
        );
        return { kind: "edit", result: r };
      }
      case "list_directory": {
        const r = await listDirectory(sandbox, String(call.args.path ?? "."));
        return { kind: "list", result: r };
      }
      case "grep_search": {
        // Use ripgrep via runBash if available; falls back to a simple
        // line-by-line scan if rg is missing. Only the public API
        // shape is committed here so the executor stays portable.
        const pattern = String(call.args.pattern ?? "");
        const path = String(call.args.path ?? ".");
        if (!pattern) {
          return { kind: "error", error: "pattern required", code: "BAD_ARGS" };
        }
        const cmd = `rg --json --max-count 50 -e ${shellQuote(pattern)} ${shellQuote(path)} 2>/dev/null || true`;
        const bash = await runBash(
          { ...sandbox, allowMutations: true /* read-only intent */ },
          cmd,
        );
        const matches: Array<{ file: string; line: number; text: string }> = [];
        for (const line of bash.stdout.split("\n")) {
          if (!line) continue;
          try {
            const obj = JSON.parse(line);
            if (obj.type === "match") {
              matches.push({
                file: obj.data.path?.text ?? "",
                line: obj.data.line_number ?? 0,
                text: (obj.data.lines?.text ?? "").trimEnd(),
              });
            }
          } catch {
            /* skip non-JSON lines (rg --json prints JSON per line) */
          }
        }
        return {
          kind: "grep",
          result: {
            matches: matches.slice(0, 100),
            truncated: matches.length > 100,
          },
        };
      }
      case "run_bash": {
        const r = await runBash(sandbox, String(call.args.command ?? ""));
        return { kind: "bash", result: r };
      }
      case "find_symbol": {
        // Pass 242: regex-based symbol lookup against the workspace
        // symbol index. Read-only tool so it works even without
        // admin/write mode. The cache lives in symbolIndexCache.ts
        // and rebuilds every 60s.
        const { getSymbolIndex } = await import("./symbolIndexCache");
        const { findSymbols, findExactName } = await import("./symbolIndex");
        const name = String(call.args.name ?? "").trim();
        if (!name) {
          return { kind: "error", error: "name required", code: "BAD_ARGS" };
        }
        const exact = Boolean(call.args.exact);
        const limit = Math.min(Math.max(Number(call.args.limit ?? 20), 1), 100);
        const index = await getSymbolIndex(sandbox.workspaceRoot);
        const raw = exact ? findExactName(index, name) : findSymbols(index, name, limit);
        const matches = raw.slice(0, limit).map((s) => ({
          name: s.name,
          kind: s.kind,
          path: s.path,
          line: s.line,
          snippet: s.snippet,
          exported: s.exported,
        }));
        return {
          kind: "symbols",
          result: {
            query: name,
            matches,
            truncated: raw.length > limit,
          },
        };
      }
      case "update_todos": {
        // Validate + normalize the todos array. No file system side
        // effect — this tool exists so the agent can stream progress
        // updates to the UI without modifying state outside the loop.
        const raw = call.args.todos;
        if (!Array.isArray(raw)) {
          return { kind: "error", error: "todos must be an array", code: "BAD_ARGS" };
        }
        const todos: AgentTodoItem[] = [];
        for (let i = 0; i < raw.length; i++) {
          const entry = raw[i];
          if (!entry || typeof entry !== "object") continue;
          const anyEntry = entry as Record<string, unknown>;
          const content = typeof anyEntry.content === "string" ? anyEntry.content.trim() : "";
          if (!content) continue;
          const activeForm =
            typeof anyEntry.activeForm === "string" && anyEntry.activeForm.trim()
              ? anyEntry.activeForm.trim()
              : content;
          const rawStatus = typeof anyEntry.status === "string" ? anyEntry.status : "pending";
          const status: AgentTodoItem["status"] =
            rawStatus === "in_progress" || rawStatus === "completed" ? rawStatus : "pending";
          const id = typeof anyEntry.id === "string" && anyEntry.id ? anyEntry.id : `todo-${i + 1}`;
          todos.push({ id, content, activeForm, status });
          if (todos.length >= 50) break;
        }
        return { kind: "todos", result: { todos, count: todos.length } };
      }
      case "infer_schema": {
        // Dynamic CRUD integrations: infer schema from sample records
        const { inferSchema, summarizeSchema } = await import("../dynamicIntegrations/schemaInference");
        const records = Array.isArray(call.args.records) ? call.args.records : [];
        if (records.length === 0) {
          return { kind: "error", error: "records required (array)", code: "BAD_ARGS" };
        }
        const safeRecords = records
          .filter((r: unknown) => r && typeof r === "object")
          .slice(0, 2000);
        const schema = inferSchema(safeRecords as Array<Record<string, unknown>>);
        return {
          kind: "schema_inference",
          result: {
            summary: summarizeSchema(schema),
            fieldCount: schema.fields.length,
            primaryKey: schema.primaryKey,
            confidence: schema.confidence,
            schema,
          },
        };
      }
      case "generate_adapter": {
        const { inferSchema } = await import("../dynamicIntegrations/schemaInference");
        const { generateAdapter, summarizeAdapter } = await import("../dynamicIntegrations/adapterGenerator");
        const records = Array.isArray(call.args.records) ? call.args.records : [];
        const name = typeof call.args.name === "string" ? call.args.name : "unnamed";
        if (records.length === 0) {
          return { kind: "error", error: "records required (array)", code: "BAD_ARGS" };
        }
        const safeRecords = records
          .filter((r: unknown) => r && typeof r === "object")
          .slice(0, 2000);
        const schema = inferSchema(safeRecords as Array<Record<string, unknown>>);
        const spec = generateAdapter(schema, {
          name,
          baseUrl: typeof call.args.baseUrl === "string" ? call.args.baseUrl : undefined,
          listEndpoint: typeof call.args.listEndpoint === "string" ? call.args.listEndpoint : undefined,
          authHint: typeof call.args.authType === "string"
            ? { type: call.args.authType as "bearer" | "api_key_header" | "basic" | "oauth2" | "unknown" | "none" }
            : undefined,
        });
        return {
          kind: "adapter_spec",
          result: {
            summary: summarizeAdapter(spec),
            ready: spec.readinessReport.ready,
            confidence: spec.confidence,
            spec,
          },
        };
      }
      case "detect_schema_drift": {
        const { inferSchema } = await import("../dynamicIntegrations/schemaInference");
        const { diffSchemas, summarizeDrift } = await import("../dynamicIntegrations/schemaDrift");
        const baseline = Array.isArray(call.args.baselineRecords) ? call.args.baselineRecords : [];
        const current = Array.isArray(call.args.currentRecords) ? call.args.currentRecords : [];
        if (baseline.length === 0 || current.length === 0) {
          return { kind: "error", error: "baselineRecords and currentRecords both required", code: "BAD_ARGS" };
        }
        const baselineSchema = inferSchema(baseline.filter((r: unknown) => r && typeof r === "object").slice(0, 2000) as Array<Record<string, unknown>>);
        const currentSchema = inferSchema(current.filter((r: unknown) => r && typeof r === "object").slice(0, 2000) as Array<Record<string, unknown>>);
        const report = diffSchemas(baselineSchema, currentSchema);
        return {
          kind: "schema_drift",
          result: {
            summary: summarizeDrift(report),
            compatible: report.compatible,
            breaking: report.summary.breaking,
            warning: report.summary.warning,
            info: report.summary.info,
            changes: report.changes,
          },
        };
      }
      case "map_to_crm_contact": {
        const { inferSchema } = await import("../dynamicIntegrations/schemaInference");
        const { mapToCanonicalContact, summarizeMapping } = await import("../dynamicIntegrations/crmCanonicalMap");
        const records = Array.isArray(call.args.records) ? call.args.records : [];
        if (records.length === 0) {
          return { kind: "error", error: "records required (array)", code: "BAD_ARGS" };
        }
        const safeRecords = records
          .filter((r: unknown) => r && typeof r === "object")
          .slice(0, 2000);
        const schema = inferSchema(safeRecords as Array<Record<string, unknown>>);
        const mapping = mapToCanonicalContact(schema);
        return {
          kind: "crm_mapping",
          result: {
            summary: summarizeMapping(mapping),
            entityType: mapping.entityType,
            matchedCount: mapping.matches.length,
            missingRequired: mapping.missingRequired,
            confidence: mapping.confidence,
            matches: mapping.matches,
          },
        };
      }
      case "finish": {
        return {
          kind: "finish",
          result: { summary: String(call.args.summary ?? "Task completed.") },
        };
      }
      default:
        return {
          kind: "error",
          error: `unknown tool: ${call.name}`,
          code: "UNKNOWN_TOOL",
        };
    }
  } catch (err) {
    if (err instanceof SandboxError) {
      return { kind: "error", error: err.message, code: err.code };
    }
    return {
      kind: "error",
      error: err instanceof Error ? err.message : "unknown",
      code: "EXEC_FAILED",
    };
  }
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`;
}

// ─── Multi-turn loop ─────────────────────────────────────────────────────

export interface PlannerCallback {
  /**
   * Given the current trace, return the next tool call. Return null to
   * indicate the planner believes the task is complete (the executor
   * will then synthesize a summary).
   *
   * The planner is the LLM. It receives a serialized view of the
   * trace + the original instruction and is expected to emit one
   * tool call per turn.
   */
  (
    instruction: string,
    steps: CodeChatStep[],
  ): Promise<CodeToolCall | null>;
}

export interface ExecuteCodeChatOpts {
  instruction: string;
  sandbox: SandboxOptions;
  planner: PlannerCallback;
  maxIterations?: number;
  /** Hard budget caps for the autonomous loop */
  maxWrites?: number;
  maxBashRuns?: number;
  /** Optional progress callback fired after every step */
  onStep?: (step: CodeChatStep) => void;
}

export async function executeCodeChat(
  opts: ExecuteCodeChatOpts,
): Promise<CodeChatRunResult> {
  const maxIterations = opts.maxIterations ?? 12;
  const maxWrites = opts.maxWrites ?? 30;
  const maxBashRuns = opts.maxBashRuns ?? 15;
  const steps: CodeChatStep[] = [];
  const stats = {
    reads: 0,
    writes: 0,
    edits: 0,
    bashRuns: 0,
    grepSearches: 0,
    errors: 0,
  };
  let finished = false;
  let summary = "";

  for (let i = 0; i < maxIterations; i++) {
    // Budget check
    if (stats.writes >= maxWrites) {
      summary = `Stopped: max writes (${maxWrites}) reached.`;
      break;
    }
    if (stats.bashRuns >= maxBashRuns) {
      summary = `Stopped: max bash runs (${maxBashRuns}) reached.`;
      break;
    }

    const call = await opts.planner(opts.instruction, steps);
    if (!call) {
      finished = true;
      summary = "Planner returned no further calls (task believed complete).";
      break;
    }

    const t0 = Date.now();
    const result = await dispatchCodeTool(call, opts.sandbox);
    const durationMs = Date.now() - t0;
    const step: CodeChatStep = { index: i, toolCall: call, result, durationMs };
    steps.push(step);
    if (opts.onStep) opts.onStep(step);

    // Update stats
    switch (result.kind) {
      case "read":
        stats.reads++;
        break;
      case "write":
        stats.writes++;
        break;
      case "edit":
        stats.edits++;
        break;
      case "bash":
        stats.bashRuns++;
        break;
      case "grep":
        stats.grepSearches++;
        break;
      case "error":
        stats.errors++;
        break;
      case "finish":
        finished = true;
        summary = result.result.summary;
        break;
    }
    if (finished) break;
  }

  if (!finished && !summary) {
    summary = `Reached max iterations (${maxIterations}) without finishing.`;
  }

  return { finished, iterations: steps.length, steps, summary, stats };
}

// ─── LLM tool definitions for the planner ───────────────────────────────
// These are returned to the LLM so it knows what tools it can call.

export const CODE_CHAT_TOOL_DEFINITIONS = [
  {
    name: "read_file",
    description: "Read a file from the workspace. Returns up to 256KB.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative path" } },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Create or overwrite a file. Requires allowMutations.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Find/replace a unique substring in a file. Use replaceAll for multi-occurrence.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string" },
        oldString: { type: "string" },
        newString: { type: "string" },
        replaceAll: { type: "boolean" },
      },
      required: ["path", "oldString", "newString"],
    },
  },
  {
    name: "list_directory",
    description: "List files + directories at the given path.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Workspace-relative path (default '.')" } },
    },
  },
  {
    name: "grep_search",
    description: "Search file contents for a pattern using ripgrep.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string" },
        path: { type: "string", description: "Where to start searching (default '.')" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "run_bash",
    description:
      "Run a shell command. Subject to denylist + 30s timeout. Requires allowMutations.",
    parameters: {
      type: "object",
      properties: { command: { type: "string" } },
      required: ["command"],
    },
  },
  {
    name: "find_symbol",
    description:
      "Find where a symbol (function, class, interface, type, const, enum) is defined in the workspace. Use this instead of grep when you know the symbol name — it's faster and returns only definition sites, not call sites. Set `exact: true` to match the name exactly, or leave it off for fuzzy substring matching.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Symbol name or query" },
        exact: { type: "boolean", description: "Require exact name match" },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_todos",
    description:
      "Update the live todo list for a multi-step task. Send the full list every time — items not in the new list are dropped. Each item has {id, content, activeForm, status}. Status is one of pending|in_progress|completed. Use activeForm as the present-continuous label ('Reading auth.ts') for the in-progress status display. Use this aggressively on any task with 3+ steps so the user sees progress.",
    parameters: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              content: { type: "string", description: "Imperative form" },
              activeForm: { type: "string", description: "Present-continuous form" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["content", "activeForm", "status"],
          },
        },
      },
      required: ["todos"],
    },
  },
  {
    name: "infer_schema",
    description:
      "Analyze sample records from any data source (JSON API, CSV export, DB dump) and infer a typed schema with field types, semantic hints (email/phone/currency/date/ssn/etc), primary-key candidates, and CRUD field roles. Use this when you need to onboard a third-party source that has limited or nonexistent documentation — sample data alone is enough. Safe read-only tool.",
    parameters: {
      type: "object",
      properties: {
        records: {
          type: "array",
          description: "Array of sample records (1-2000). Each record is an object with field name → value pairs.",
          items: { type: "object" },
        },
      },
      required: ["records"],
    },
  },
  {
    name: "generate_adapter",
    description:
      "Generate a declarative CRUD adapter spec from sample records + connection hints. Returns endpoints (list/get/create/update/delete), field mappings, auth, pagination, and a readiness report. Use after infer_schema when you want a full adapter contract, not just a schema. Safe read-only tool.",
    parameters: {
      type: "object",
      properties: {
        records: { type: "array", items: { type: "object" } },
        name: { type: "string", description: "Human-readable name for the adapter" },
        baseUrl: { type: "string", description: "Base URL of the source API (optional but needed for ready=true)" },
        listEndpoint: { type: "string", description: "List endpoint path (defaults to '/')" },
        authType: {
          type: "string",
          description: "Auth style: bearer / api_key_header / api_key_query / basic / oauth2 / none / unknown",
        },
      },
      required: ["records", "name"],
    },
  },
  {
    name: "detect_schema_drift",
    description:
      "Compare two sets of sample records (baseline from last run, current from this run) and report schema drift: added/removed/renamed/type-changed fields with breaking/warning/info severity. Use in continuous monitoring loops to catch source-side changes before they break a pipeline. Safe read-only tool.",
    parameters: {
      type: "object",
      properties: {
        baselineRecords: { type: "array", items: { type: "object" } },
        currentRecords: { type: "array", items: { type: "object" } },
      },
      required: ["baselineRecords", "currentRecords"],
    },
  },
  {
    name: "map_to_crm_contact",
    description:
      "Take sample records from any contact-like source and map the fields to Stewardly's canonical CRM contact shape (email/firstName/lastName/phone/company/etc). Returns match confidence per field and lists missing-required canonical fields. Use when onboarding a new lead source to Stewardly's CRM. Safe read-only tool.",
    parameters: {
      type: "object",
      properties: {
        records: { type: "array", items: { type: "object" } },
      },
      required: ["records"],
    },
  },
  {
    name: "finish",
    description: "Signal that the task is complete and provide a summary.",
    parameters: {
      type: "object",
      properties: { summary: { type: "string" } },
      required: ["summary"],
    },
  },
] as const;
