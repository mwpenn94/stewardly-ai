/**
 * calculatorHelpers — Pure helper functions for calculator UI components.
 *
 * Extracted from CalculatorContextBar and ExamSimulatorPage so they
 * can be unit-tested without React/tRPC dependencies.
 */

/* ── Benchmark formatting ────────────────────────────────────── */

export const BENCHMARK_LABELS: Record<string, string> = {
  savingsRate: "National Savings Rate",
  investorBehaviorGap: "Investor Behavior Gap",
  lifeInsuranceGap: "Life Insurance Gap",
  retirementReadiness: "Retirement Readiness",
  estatePlanningGap: "Estate Planning Gap",
  advisorAlpha: "Advisor Alpha",
  avgAdvisoryFee: "Avg Advisory Fee",
  avgWealthGrowth: "Avg Wealth Growth",
};

export const PARAM_LABELS: Record<string, string> = {
  returnRate: "Investment Return",
  savingsRate: "Savings Rate",
  growthRate: "Growth Rate",
  inflationRate: "Inflation",
  taxRate: "Tax Rate",
  investmentReturn: "Investment Return",
};

/**
 * Format a benchmark value for display, handling the heterogeneous
 * shapes of INDUSTRY_BENCHMARKS entries.
 */
export function formatBenchmarkValue(key: string, bm: any): string {
  if (bm.national != null) return `${(bm.national * 100).toFixed(1)}%`;
  if (bm.gap != null) return `${(bm.gap * 100).toFixed(1)}%/yr`;
  if (bm.pct != null) return `${(bm.pct * 100).toFixed(0)}%`;
  if (key === "avgAdvisoryFee" && bm.value != null) return `${(bm.value * 100).toFixed(2)}%`;
  if (key === "advisorAlpha" && bm.value != null) return `~${(bm.value * 100).toFixed(0)}%/yr`;
  if (bm.sp500 != null) return `S&P: ${(bm.sp500 * 100).toFixed(1)}%`;
  if (bm.value != null) return String(bm.value);
  return "—";
}

/* ── Exam question transformation ────────────────────────────── */

export interface TransformedQuestion {
  id: string;
  text: string;
  options: { key: string; text: string }[];
  correctKey: string;
  explanation: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  moduleSlug: string;
}

/**
 * Transform a database practice question row into the ExamSimulator
 * Question format. Returns null if the row is malformed.
 */
export function transformDbQuestion(
  q: any,
  slug: string,
  trackName?: string,
): TransformedQuestion | null {
  if (!q || typeof q !== "object") return null;

  const options: string[] = Array.isArray(q.options) ? q.options : [];
  if (options.length < 2) return null;

  const correctIndex = typeof q.correctIndex === "number"
    ? q.correctIndex
    : (typeof q.correct === "number" ? q.correct : 0);

  if (correctIndex < 0 || correctIndex >= options.length) return null;

  const text = q.prompt ?? q.text ?? "";
  if (!text) return null;

  return {
    id: String(q.id ?? ""),
    text,
    options: options.map((opt: string, i: number) => ({
      key: String.fromCharCode(65 + i),
      text: opt,
    })),
    correctKey: String.fromCharCode(65 + correctIndex),
    explanation: q.explanation ?? "",
    topic: q.tags?.[0] ?? trackName ?? slug,
    difficulty: (q.difficulty as "easy" | "medium" | "hard") ?? "medium",
    moduleSlug: slug,
  };
}

/**
 * Transform an array of database questions, filtering out malformed ones.
 */
export function transformDbQuestions(
  rows: any[],
  slug: string,
  trackName?: string,
): TransformedQuestion[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((q: any) => q.status === "published" || !q.status)
    .map((q) => transformDbQuestion(q, slug, trackName))
    .filter((q): q is TransformedQuestion => q !== null);
}

/* ── Guardrail parameter sanitization ────────────────────────── */

/**
 * Sanitize user input params for guardrail checking.
 * Strips non-numeric and NaN values.
 */
export function sanitizeGuardrailParams(params: Record<string, number>): Record<string, number> {
  const mapped: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number" && !isNaN(v)) mapped[k] = v;
  }
  return mapped;
}
