/**
 * calculatorContext — Cross-app calculator-to-chat context bridge.
 *
 * When a user runs a calculation on any planning page, the result summary
 * is stored here. When the user then opens Chat and asks a follow-up
 * question (e.g. "what should I do about my estate tax?"), the chat
 * system injects the recent calculation results into the LLM context so
 * the AI already knows the numbers.
 *
 * Pure functions — no React hooks, no side effects except localStorage.
 * Designed for unit testing.
 */

const STORAGE_KEY = "stewardly-calculator-context";
const MAX_ENTRIES = 10;
const MAX_SUMMARY_LENGTH = 2000;

export interface CalculationResult {
  id: string;
  type: "tax" | "estate" | "retirement" | "income" | "insurance" | "risk" | "iul" | "bie" | "uwe" | "monte_carlo" | "custom";
  title: string;
  summary: string; // Human-readable summary of key results
  inputs: Record<string, unknown>; // Key input parameters
  outputs: Record<string, unknown>; // Key output values
  timestamp: number;
}

export interface CalculatorContextState {
  entries: CalculationResult[];
}

// ─── Pure Functions ────────────────────────────────────────────────

/** Parse stored state from localStorage. Defensive against corruption. */
export function parseCalculatorContext(raw: string | null): CalculatorContextState {
  if (!raw) return { entries: [] };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    // Filter out malformed entries
    const valid = parsed.entries.filter(
      (e: any) =>
        e &&
        typeof e === "object" &&
        typeof e.id === "string" &&
        typeof e.type === "string" &&
        typeof e.title === "string" &&
        typeof e.summary === "string" &&
        typeof e.timestamp === "number",
    );
    return { entries: valid.slice(0, MAX_ENTRIES) };
  } catch {
    return { entries: [] };
  }
}

/** Serialize state for localStorage. */
export function serializeCalculatorContext(state: CalculatorContextState): string {
  return JSON.stringify(state);
}

/** Record a new calculation result. Dedupes by id, caps at MAX_ENTRIES. */
export function recordCalculation(
  state: CalculatorContextState,
  result: CalculationResult,
): CalculatorContextState {
  // Clamp summary length
  const clamped: CalculationResult = {
    ...result,
    summary: result.summary.slice(0, MAX_SUMMARY_LENGTH),
  };
  // Remove existing entry with same id (update)
  const filtered = state.entries.filter((e) => e.id !== clamped.id);
  // Add to front, cap at MAX_ENTRIES
  return { entries: [clamped, ...filtered].slice(0, MAX_ENTRIES) };
}

/** Remove a calculation by id. */
export function removeCalculation(
  state: CalculatorContextState,
  id: string,
): CalculatorContextState {
  return { entries: state.entries.filter((e) => e.id !== id) };
}

/** Clear all stored calculations. */
export function clearCalculations(): CalculatorContextState {
  return { entries: [] };
}

/** Get entries of a specific type. */
export function filterByType(
  state: CalculatorContextState,
  type: CalculationResult["type"],
): CalculationResult[] {
  return state.entries.filter((e) => e.type === type);
}

/** Get the most recent N entries. */
export function recentCalculations(
  state: CalculatorContextState,
  limit = 5,
): CalculationResult[] {
  return state.entries
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

/**
 * Build a context overlay string for injection into the chat system prompt.
 * This is what the LLM sees so it knows what calculations the user has run.
 */
export function buildContextOverlay(state: CalculatorContextState): string {
  const recent = recentCalculations(state, 5);
  if (recent.length === 0) return "";

  const lines = recent.map((r) => {
    const age = Math.round((Date.now() - r.timestamp) / 60000);
    const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
    return `- [${r.type.toUpperCase()}] ${r.title} (${ageStr}): ${r.summary}`;
  });

  return [
    "## Recent Calculator Results",
    "The user has recently run the following calculations. Use these results to provide informed, contextual answers:",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Build a compact summary for display (e.g., in a tooltip or badge).
 */
export function summarizeContext(state: CalculatorContextState): {
  count: number;
  types: string[];
  mostRecent: CalculationResult | null;
} {
  return {
    count: state.entries.length,
    types: Array.from(new Set(state.entries.map((e) => e.type))),
    mostRecent: state.entries.length > 0
      ? state.entries.reduce((a, b) => (a.timestamp > b.timestamp ? a : b))
      : null,
  };
}

// ─── localStorage Helpers ──────────────────────────────────────────

/** Load current state from localStorage. */
export function loadCalculatorContext(): CalculatorContextState {
  try {
    return parseCalculatorContext(localStorage.getItem(STORAGE_KEY));
  } catch {
    return { entries: [] };
  }
}

/** Save state to localStorage. */
export function saveCalculatorContext(state: CalculatorContextState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeCalculatorContext(state));
  } catch {
    // Storage full or unavailable — fail silently
  }
}

/** Record and persist a calculation in one call. */
export function persistCalculation(result: CalculationResult): void {
  const current = loadCalculatorContext();
  const updated = recordCalculation(current, result);
  saveCalculatorContext(updated);
}
