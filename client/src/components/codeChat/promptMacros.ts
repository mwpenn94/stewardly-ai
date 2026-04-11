/**
 * Prompt macro recorder — Pass 266.
 *
 * A macro is a named sequence of prompts that the user can replay
 * in order. Use cases:
 *   - "Explore + summarize" = "explore the src directory",
 *     "summarize what you found", "suggest refactors"
 *   - "Write a component" = "plan the component structure",
 *     "implement it", "write tests", "update docs"
 *
 * Recording captures prompts until stopped. Replay sends each prompt
 * sequentially, waiting for the previous to complete before sending
 * the next (orchestration lives in the parent CodeChat component).
 *
 * Pure store + localStorage.
 */

export interface PromptMacro {
  id: string;
  name: string;
  description?: string;
  steps: string[];
  createdAt: number;
  updatedAt: number;
  /** Last time the macro was played back */
  lastPlayedAt?: number;
  /** Total number of times played */
  playCount: number;
  builtin?: boolean;
}

export const MAX_MACROS = 50;
export const MAX_STEPS = 20;
const STORAGE_KEY = "stewardly-codechat-prompt-macros";

// ─── Built-in starter macros ────────────────────────────────────────

export const BUILT_IN_MACROS: Readonly<PromptMacro[]> = [
  {
    id: "builtin-explore",
    name: "Explore codebase",
    description: "Walk the major folders and produce a map",
    steps: [
      "List the top-level directories and summarize what each contains.",
      "For each important directory, read the README or entry file and explain the architecture.",
      "Identify the 5 most complex files by rough size + dependency count.",
      "Summarize the overall architecture in 3 bullet points.",
    ],
    createdAt: 0,
    updatedAt: 0,
    playCount: 0,
    builtin: true,
  },
  {
    id: "builtin-test-runner",
    name: "Test a file",
    description: "Write tests for a specific file end-to-end",
    steps: [
      "Read the file I'm about to specify and identify every exported function.",
      "Write vitest tests covering each exported function's happy path + edge cases.",
      "Run the tests and fix any failures.",
    ],
    createdAt: 0,
    updatedAt: 0,
    playCount: 0,
    builtin: true,
  },
  {
    id: "builtin-review",
    name: "Review changes",
    description: "Review the currently staged diff",
    steps: [
      "Show me the current git diff --cached output.",
      "Walk through each changed file and explain what changed.",
      "Flag any potential bugs, style issues, or missing tests.",
      "Suggest a commit message.",
    ],
    createdAt: 0,
    updatedAt: 0,
    playCount: 0,
    builtin: true,
  },
  {
    id: "builtin-refactor",
    name: "Refactor a module",
    description: "Structured refactor with tests + review",
    steps: [
      "Read the target module and identify code smells, dead code, and duplication.",
      "Propose a refactor plan with specific step-by-step changes.",
      "Apply the refactor.",
      "Run the tests and verify nothing regressed.",
    ],
    createdAt: 0,
    updatedAt: 0,
    playCount: 0,
    builtin: true,
  },
];

// ─── Mutations ───────────────────────────────────────────────────────

function generateId(): string {
  return `macro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createMacro(
  partial: Omit<
    PromptMacro,
    "id" | "createdAt" | "updatedAt" | "playCount" | "lastPlayedAt" | "builtin"
  > & { id?: string },
): PromptMacro {
  const now = Date.now();
  return {
    id: partial.id ?? generateId(),
    name: partial.name.trim(),
    description: partial.description?.trim() || undefined,
    steps: partial.steps
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_STEPS),
    createdAt: now,
    updatedAt: now,
    playCount: 0,
  };
}

export function addMacro(
  list: PromptMacro[],
  next: PromptMacro,
): PromptMacro[] {
  // Dedupe by name for user macros only
  const filtered = list.filter(
    (m) => !(m.name === next.name && !m.builtin),
  );
  const merged = [next, ...filtered];
  return merged.slice(0, MAX_MACROS);
}

export function removeMacro(
  list: PromptMacro[],
  id: string,
): PromptMacro[] {
  return list.filter((m) => !(m.id === id && !m.builtin));
}

export function updateMacro(
  list: PromptMacro[],
  id: string,
  patch: Partial<Omit<PromptMacro, "id" | "createdAt" | "builtin">>,
): PromptMacro[] {
  return list.map((m) => {
    if (m.id !== id || m.builtin) return m;
    return {
      ...m,
      ...patch,
      name: patch.name?.trim() || m.name,
      description: patch.description?.trim() || m.description,
      steps: patch.steps
        ? patch.steps.map((s) => s.trim()).filter(Boolean).slice(0, MAX_STEPS)
        : m.steps,
      updatedAt: Date.now(),
    };
  });
}

export function recordPlay(
  list: PromptMacro[],
  id: string,
): PromptMacro[] {
  return list.map((m) =>
    m.id === id
      ? { ...m, lastPlayedAt: Date.now(), playCount: m.playCount + 1 }
      : m,
  );
}

export function seedBuiltins(list: PromptMacro[]): PromptMacro[] {
  const seenNames = new Set(
    list.filter((m) => m.builtin).map((m) => m.name),
  );
  const out = [...list];
  for (const builtin of BUILT_IN_MACROS) {
    if (!seenNames.has(builtin.name)) {
      out.push({ ...builtin });
    }
  }
  return out;
}

// ─── Recording session state ────────────────────────────────────────

export interface RecordingSession {
  active: boolean;
  steps: string[];
}

export function startRecording(): RecordingSession {
  return { active: true, steps: [] };
}

export function appendToRecording(
  session: RecordingSession,
  prompt: string,
): RecordingSession {
  if (!session.active) return session;
  const trimmed = prompt.trim();
  if (!trimmed) return session;
  if (session.steps.length >= MAX_STEPS) return session;
  return { ...session, steps: [...session.steps, trimmed] };
}

export function stopRecording(session: RecordingSession): RecordingSession {
  return { ...session, active: false };
}

export function clearRecording(): RecordingSession {
  return { active: false, steps: [] };
}

// ─── Persistence ─────────────────────────────────────────────────────

export function parseMacros(raw: string | null): PromptMacro[] {
  if (!raw) return seedBuiltins([]);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedBuiltins([]);
    const out: PromptMacro[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const ee = e as Record<string, unknown>;
      if (typeof ee.id !== "string" || typeof ee.name !== "string") continue;
      if (!Array.isArray(ee.steps)) continue;
      out.push({
        id: ee.id,
        name: ee.name,
        description: typeof ee.description === "string" ? ee.description : undefined,
        steps: ee.steps
          .filter((s): s is string => typeof s === "string")
          .slice(0, MAX_STEPS),
        createdAt: typeof ee.createdAt === "number" ? ee.createdAt : 0,
        updatedAt: typeof ee.updatedAt === "number" ? ee.updatedAt : 0,
        lastPlayedAt:
          typeof ee.lastPlayedAt === "number" ? ee.lastPlayedAt : undefined,
        playCount: typeof ee.playCount === "number" ? ee.playCount : 0,
        builtin: Boolean(ee.builtin),
      });
      if (out.length >= MAX_MACROS) break;
    }
    return seedBuiltins(out);
  } catch {
    return seedBuiltins([]);
  }
}

export function serializeMacros(list: PromptMacro[]): string {
  return JSON.stringify(list.filter((m) => !m.builtin));
}

export function loadMacros(): PromptMacro[] {
  if (typeof localStorage === "undefined") return seedBuiltins([]);
  try {
    return parseMacros(localStorage.getItem(STORAGE_KEY));
  } catch {
    return seedBuiltins([]);
  }
}

export function saveMacros(list: PromptMacro[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeMacros(list));
  } catch {
    /* quota */
  }
}
