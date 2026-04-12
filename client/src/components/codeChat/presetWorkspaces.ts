/**
 * Preset workspace environments — Pass 260.
 *
 * A "preset" bundles the Code Chat configuration tree into a single
 * named save slot: model override, enabled tools, max iterations,
 * mutation permission, project instructions toggle, pinned files,
 * memory overlay opt-in. Users can switch between presets to
 * instantly reconfigure the whole agent setup for a different kind
 * of task (e.g. "read-only exploration" vs "refactoring" vs "test
 * writing").
 *
 * This is DIFFERENT from:
 *   - Sessions (Pass 212): save the conversation history
 *   - Checkpoints (Pass 253): save the full runtime state
 *   - Agent memory (Pass 241): persistent facts across all sessions
 *
 * Presets are fast switches — applying one doesn't touch messages
 * or memory, just the knobs.
 */

export interface PresetWorkspace {
  id: string;
  name: string;
  description?: string;
  /** Model registry id */
  modelOverride?: string;
  /** Which code tools are enabled */
  enabledTools: string[];
  /** ReAct max iterations */
  maxIterations: number;
  /** Allow write_file / edit_file / run_bash */
  allowMutations: boolean;
  /** Auto-load CLAUDE.md / .stewardly instructions */
  includeProjectInstructions: boolean;
  createdAt: number;
  updatedAt: number;
  /** Built-ins ship as read-only suggestions */
  builtin?: boolean;
}

export const MAX_PRESETS = 50;
const STORAGE_KEY = "stewardly-codechat-presets";

// ─── Built-in starter presets ────────────────────────────────────────

export const BUILT_IN_PRESETS: Readonly<PresetWorkspace[]> = [
  {
    id: "builtin-readonly",
    name: "Read-only exploration",
    description: "Safe read-only tools for exploring the codebase",
    enabledTools: ["read_file", "list_directory", "grep_search", "find_symbol", "update_todos"],
    maxIterations: 8,
    allowMutations: false,
    includeProjectInstructions: true,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-refactor",
    name: "Refactor mode",
    description: "Full edit access for multi-file refactors",
    enabledTools: [
      "read_file",
      "list_directory",
      "grep_search",
      "find_symbol",
      "edit_file",
      "write_file",
      "update_todos",
    ],
    maxIterations: 15,
    allowMutations: true,
    includeProjectInstructions: true,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-testwriter",
    name: "Test writer",
    description: "Write new tests — needs read + write but no bash",
    enabledTools: [
      "read_file",
      "list_directory",
      "grep_search",
      "find_symbol",
      "write_file",
      "edit_file",
      "update_todos",
    ],
    maxIterations: 10,
    allowMutations: true,
    includeProjectInstructions: true,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-quick",
    name: "Quick answer",
    description: "Minimal tools, max speed, for quick questions",
    enabledTools: ["read_file", "grep_search"],
    maxIterations: 3,
    allowMutations: false,
    includeProjectInstructions: false,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
  {
    id: "builtin-shell",
    name: "Shell power user",
    description: "Full access including bash — use with care",
    enabledTools: [
      "read_file",
      "list_directory",
      "grep_search",
      "find_symbol",
      "write_file",
      "edit_file",
      "run_bash",
      "update_todos",
    ],
    maxIterations: 20,
    allowMutations: true,
    includeProjectInstructions: true,
    createdAt: 0,
    updatedAt: 0,
    builtin: true,
  },
];

// ─── Mutations ───────────────────────────────────────────────────────

function generateId(): string {
  return `ps-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createPreset(
  partial: Omit<PresetWorkspace, "id" | "createdAt" | "updatedAt" | "builtin"> & {
    id?: string;
  },
): PresetWorkspace {
  const now = Date.now();
  return {
    id: partial.id ?? generateId(),
    name: partial.name.trim(),
    description: partial.description?.trim() || undefined,
    modelOverride: partial.modelOverride,
    enabledTools: [...partial.enabledTools],
    maxIterations: Math.max(1, Math.min(50, partial.maxIterations)),
    allowMutations: Boolean(partial.allowMutations),
    includeProjectInstructions: partial.includeProjectInstructions !== false,
    createdAt: now,
    updatedAt: now,
  };
}

export function addPreset(
  list: PresetWorkspace[],
  next: PresetWorkspace,
): PresetWorkspace[] {
  // Dedupe by name — replacing existing non-builtin entries
  const filtered = list.filter(
    (p) => !(p.name === next.name && !p.builtin),
  );
  const merged = [next, ...filtered];
  return merged.slice(0, MAX_PRESETS);
}

export function removePreset(
  list: PresetWorkspace[],
  id: string,
): PresetWorkspace[] {
  return list.filter((p) => !(p.id === id && !p.builtin));
}

export function updatePreset(
  list: PresetWorkspace[],
  id: string,
  patch: Partial<Omit<PresetWorkspace, "id" | "createdAt" | "builtin">>,
): PresetWorkspace[] {
  return list.map((p) => {
    if (p.id !== id || p.builtin) return p;
    return {
      ...p,
      ...patch,
      enabledTools: patch.enabledTools ? [...patch.enabledTools] : p.enabledTools,
      maxIterations: patch.maxIterations
        ? Math.max(1, Math.min(50, patch.maxIterations))
        : p.maxIterations,
      name: patch.name?.trim() || p.name,
      description: patch.description?.trim() || p.description,
      updatedAt: Date.now(),
    };
  });
}

export function seedBuiltins(list: PresetWorkspace[]): PresetWorkspace[] {
  const seenNames = new Set(
    list.filter((p) => p.builtin).map((p) => p.name),
  );
  const out = [...list];
  for (const builtin of BUILT_IN_PRESETS) {
    if (!seenNames.has(builtin.name)) {
      out.push({ ...builtin });
    }
  }
  return out;
}

/**
 * Capture the current Code Chat runtime config as a new preset.
 */
export function captureCurrentAsPreset(
  name: string,
  description: string | undefined,
  runtime: {
    modelOverride?: string;
    enabledTools: string[];
    maxIterations: number;
    allowMutations: boolean;
    includeProjectInstructions: boolean;
  },
): PresetWorkspace {
  return createPreset({
    name,
    description,
    ...runtime,
  });
}

// ─── Persistence ─────────────────────────────────────────────────────

export function parsePresets(raw: string | null): PresetWorkspace[] {
  if (!raw) return seedBuiltins([]);
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedBuiltins([]);
    const out: PresetWorkspace[] = [];
    for (const e of parsed) {
      if (!e || typeof e !== "object") continue;
      const pp = e as Record<string, unknown>;
      if (typeof pp.id !== "string" || typeof pp.name !== "string") continue;
      if (!Array.isArray(pp.enabledTools)) continue;
      out.push({
        id: pp.id,
        name: pp.name,
        description: typeof pp.description === "string" ? pp.description : undefined,
        modelOverride: typeof pp.modelOverride === "string" ? pp.modelOverride : undefined,
        enabledTools: pp.enabledTools.filter((t): t is string => typeof t === "string"),
        maxIterations: typeof pp.maxIterations === "number" ? pp.maxIterations : 5,
        allowMutations: Boolean(pp.allowMutations),
        includeProjectInstructions: pp.includeProjectInstructions !== false,
        createdAt: typeof pp.createdAt === "number" ? pp.createdAt : 0,
        updatedAt: typeof pp.updatedAt === "number" ? pp.updatedAt : 0,
        builtin: Boolean(pp.builtin),
      });
      if (out.length >= MAX_PRESETS) break;
    }
    return seedBuiltins(out);
  } catch {
    return seedBuiltins([]);
  }
}

export function serializePresets(list: PresetWorkspace[]): string {
  // Persist only user presets — built-ins auto-reseed
  return JSON.stringify(list.filter((p) => !p.builtin));
}

export function loadPresets(): PresetWorkspace[] {
  if (typeof localStorage === "undefined") return seedBuiltins([]);
  try {
    return parsePresets(localStorage.getItem(STORAGE_KEY));
  } catch {
    return seedBuiltins([]);
  }
}

export function savePresets(list: PresetWorkspace[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, serializePresets(list));
  } catch {
    /* quota */
  }
}
