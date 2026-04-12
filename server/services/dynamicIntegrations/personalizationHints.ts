/**
 * Personalization Hint Extraction
 *
 * When a dynamic integration ingests data (CRM dump, portfolio export,
 * document extraction), we want to derive per-user personalization hints
 * that feed into:
 *   - Learning recommendations (which exam tracks / concepts are relevant)
 *   - Calculator focus (which wealth engines to spotlight)
 *   - Chat personalization (what context to inject into contextualLLM)
 *   - CRM segmentation (which segment model to apply)
 *
 * This is the "force multiplier" layer that connects data ingestion to the
 * Learning, Wealth Engine, and Chat subsystems so every new data point
 * improves the system's personalization quality.
 *
 * Pure-function module. No I/O. Takes inferred records + schema, returns
 * structured hints the downstream services can consume without reshaping.
 */

import type { InferredSchema, InferredField } from "./schemaInference";
import type { CrmMappingResult } from "./crmCanonicalMap";

// ─── Types ─────────────────────────────────────────────────────────────────

export type HintCategory =
  | "learning_track"
  | "calculator_focus"
  | "chat_context"
  | "crm_segment"
  | "risk_indicator"
  | "retention_signal";

export interface PersonalizationHint {
  category: HintCategory;
  key: string;             // stable identifier (e.g. "series_7", "retirement_calc")
  label: string;           // human-readable title
  rationale: string;       // why this hint is suggested
  confidence: number;      // 0..1
  source: string;          // which field / heuristic triggered it
  priority: 1 | 2 | 3;     // 1 = high, 3 = low
}

export interface PersonalizationHintResult {
  hints: PersonalizationHint[];
  byCategory: Record<HintCategory, PersonalizationHint[]>;
  overallConfidence: number;
  recordCount: number;
}

// ─── Trigger rules (pure) ─────────────────────────────────────────────────

/**
 * Static trigger table — when a schema has a field matching one of these
 * patterns, suggest the corresponding personalization hint. Each trigger
 * includes a `match` predicate over an InferredField and a `build` function
 * that turns a matched field into one or more hints.
 */
interface TriggerRule {
  id: string;
  match: (f: InferredField) => boolean;
  build: (f: InferredField, recordCount: number) => PersonalizationHint[];
}

const TRIGGER_RULES: TriggerRule[] = [
  // ─── Learning track triggers ─────────────────────────────────────
  {
    id: "has_series_7_license",
    match: (f) => /series_?7|series7/.test(f.normalizedName),
    build: (f) => [
      {
        category: "learning_track",
        key: "series_7",
        label: "Series 7 (General Securities Rep)",
        rationale: `Field "${f.name}" indicates Series 7 licensure or interest`,
        confidence: 0.9,
        source: f.name,
        priority: 1,
      },
    ],
  },
  {
    id: "has_cfp_mention",
    match: (f) => /cfp|certified_financial_planner/.test(f.normalizedName),
    build: (f) => [
      {
        category: "learning_track",
        key: "cfp",
        label: "Certified Financial Planner",
        rationale: `Field "${f.name}" suggests CFP credentialing interest`,
        confidence: 0.92,
        source: f.name,
        priority: 1,
      },
    ],
  },
  {
    id: "has_insurance_license",
    match: (f) => /insurance_license|life_license|health_license|p_c_license|pnc_license/.test(f.normalizedName),
    build: (f) => [
      {
        category: "learning_track",
        key: "insurance_licensing",
        label: "Life/Health or P&C Insurance",
        rationale: `Field "${f.name}" indicates insurance licensing`,
        confidence: 0.88,
        source: f.name,
        priority: 2,
      },
    ],
  },
  {
    id: "premium_financing_signal",
    match: (f) =>
      /premium_fin|prem_finance|iul_loan|indexed_universal/.test(f.normalizedName),
    build: (f) => [
      {
        category: "learning_track",
        key: "premium_financing",
        label: "Premium Financing & IUL Loans",
        rationale: `Field "${f.name}" indicates premium financing activity`,
        confidence: 0.85,
        source: f.name,
        priority: 1,
      },
      {
        category: "calculator_focus",
        key: "premium_finance_calculator",
        label: "Premium Finance Calculator",
        rationale: "Premium financing data detected — spotlight the PF calculator",
        confidence: 0.9,
        source: f.name,
        priority: 1,
      },
    ],
  },
  // ─── Calculator focus triggers ────────────────────────────────────
  {
    id: "retirement_account",
    match: (f) => /401k|403b|ira|roth|pension|retire/.test(f.normalizedName),
    build: (f) => [
      {
        category: "calculator_focus",
        key: "retirement_calculator",
        label: "Retirement Calculator",
        rationale: `Field "${f.name}" indicates retirement account data`,
        confidence: 0.9,
        source: f.name,
        priority: 1,
      },
      {
        category: "learning_track",
        key: "retirement_planning",
        label: "Retirement Planning",
        rationale: "Retirement account data is present in the source",
        confidence: 0.85,
        source: f.name,
        priority: 2,
      },
    ],
  },
  {
    id: "estate_planning",
    match: (f) => /estate|trust|will|beneficiary|inheritance/.test(f.normalizedName),
    build: (f) => [
      {
        category: "calculator_focus",
        key: "estate_calculator",
        label: "Estate Planning Calculator",
        rationale: `Field "${f.name}" indicates estate planning data`,
        confidence: 0.87,
        source: f.name,
        priority: 1,
      },
      {
        category: "learning_track",
        key: "estate_planning",
        label: "Estate Planning",
        rationale: "Estate-related fields detected",
        confidence: 0.82,
        source: f.name,
        priority: 2,
      },
    ],
  },
  {
    id: "tax_planning",
    match: (f) => /tax_return|agi|adjusted_gross|capital_gain|deduction/.test(f.normalizedName),
    build: (f) => [
      {
        category: "calculator_focus",
        key: "tax_planning_calculator",
        label: "Tax Planning Calculator",
        rationale: `Field "${f.name}" indicates tax planning data`,
        confidence: 0.9,
        source: f.name,
        priority: 1,
      },
    ],
  },
  // ─── Risk indicators ──────────────────────────────────────────────
  {
    id: "debt_exposure",
    match: (f) => /debt|loan_balance|credit_card|mortgage|leverage/.test(f.normalizedName),
    build: (f) => [
      {
        category: "risk_indicator",
        key: "debt_exposure",
        label: "Debt exposure signal",
        rationale: `Field "${f.name}" indicates debt — risk review recommended`,
        confidence: 0.7,
        source: f.name,
        priority: 2,
      },
    ],
  },
  {
    id: "missing_beneficiary",
    match: (f) => /beneficiary/.test(f.normalizedName) && f.nullRate > 0.3,
    build: (f) => [
      {
        category: "risk_indicator",
        key: "missing_beneficiary",
        label: "Missing beneficiary designations",
        rationale: `${Math.round(f.nullRate * 100)}% of records have no beneficiary`,
        confidence: 0.85,
        source: f.name,
        priority: 1,
      },
    ],
  },
  // ─── Retention / churn signals ────────────────────────────────────
  {
    id: "inactive_signal",
    match: (f) =>
      /last_login|last_activity|last_contact|churned|inactive/.test(f.normalizedName),
    build: (f) => [
      {
        category: "retention_signal",
        key: "activity_tracking",
        label: "Activity-tracking signal",
        rationale: `Field "${f.name}" enables retention analysis`,
        confidence: 0.75,
        source: f.name,
        priority: 2,
      },
    ],
  },
  // ─── CRM segment triggers ────────────────────────────────────────
  {
    id: "high_net_worth",
    match: (f) =>
      /net_worth|aum|assets_under_management/.test(f.normalizedName) &&
      f.type !== "null",
    build: (f) => [
      {
        category: "crm_segment",
        key: "high_net_worth",
        label: "HNW segment model",
        rationale: `Field "${f.name}" enables net-worth-based segmentation`,
        confidence: 0.88,
        source: f.name,
        priority: 1,
      },
    ],
  },
];

// ─── Main extraction pipeline ─────────────────────────────────────────────

/**
 * Extract personalization hints from an inferred schema + record count.
 * Hints are deduped by (category, key) and ranked by confidence.
 */
export function extractPersonalizationHints(
  schema: InferredSchema,
  options?: { minConfidence?: number },
): PersonalizationHintResult {
  const minConfidence = options?.minConfidence ?? 0.5;
  const raw: PersonalizationHint[] = [];

  for (const field of schema.fields) {
    for (const rule of TRIGGER_RULES) {
      try {
        if (rule.match(field)) {
          raw.push(...rule.build(field, schema.recordCount));
        }
      } catch {
        // Rule execution shouldn't block the pipeline on a bad field
      }
    }
  }

  // Dedupe by (category, key): keep the highest-confidence hint
  const byKey = new Map<string, PersonalizationHint>();
  for (const hint of raw) {
    if (hint.confidence < minConfidence) continue;
    const k = `${hint.category}::${hint.key}`;
    const existing = byKey.get(k);
    if (!existing || hint.confidence > existing.confidence) {
      byKey.set(k, hint);
    }
  }

  const hints = Array.from(byKey.values()).sort((a, b) => {
    // Priority ascending (1 is high), then confidence descending
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.confidence - a.confidence;
  });

  const byCategory: Record<HintCategory, PersonalizationHint[]> = {
    learning_track: [],
    calculator_focus: [],
    chat_context: [],
    crm_segment: [],
    risk_indicator: [],
    retention_signal: [],
  };
  for (const hint of hints) {
    byCategory[hint.category].push(hint);
  }

  const overallConfidence =
    hints.length > 0
      ? hints.reduce((sum, h) => sum + h.confidence, 0) / hints.length
      : 0;

  return {
    hints,
    byCategory,
    overallConfidence,
    recordCount: schema.recordCount,
  };
}

/**
 * Given the CRM-canonical mapping output + the raw schema, augment the
 * personalization hints with CRM-segment-aware signals.
 */
export function augmentWithCrmHints(
  result: PersonalizationHintResult,
  mapping: CrmMappingResult,
): PersonalizationHintResult {
  const augmented = [...result.hints];

  // If no email was found, flag as chat-context signal (we can't personalize)
  if (mapping.missingRequired.includes("email")) {
    augmented.push({
      category: "chat_context",
      key: "no_email",
      label: "Identity-limited personalization",
      rationale: "No email field — contact-level personalization will be limited",
      confidence: 0.95,
      source: "crm_mapping.missingRequired",
      priority: 1,
    });
  }
  // If the mapping has company, suggest B2B segmentation
  if (mapping.matches.some((m) => m.canonicalField === "company")) {
    augmented.push({
      category: "crm_segment",
      key: "b2b_orient",
      label: "B2B segmentation model",
      rationale: "Company field is present — B2B segmentation is available",
      confidence: 0.8,
      source: "crm_mapping.company",
      priority: 2,
    });
  }

  // Rebuild byCategory + confidence
  const byKey = new Map<string, PersonalizationHint>();
  for (const hint of augmented) {
    const k = `${hint.category}::${hint.key}`;
    const existing = byKey.get(k);
    if (!existing || hint.confidence > existing.confidence) {
      byKey.set(k, hint);
    }
  }
  const hints = Array.from(byKey.values()).sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return b.confidence - a.confidence;
  });

  const byCategory: Record<HintCategory, PersonalizationHint[]> = {
    learning_track: [],
    calculator_focus: [],
    chat_context: [],
    crm_segment: [],
    risk_indicator: [],
    retention_signal: [],
  };
  for (const h of hints) byCategory[h.category].push(h);

  return {
    hints,
    byCategory,
    overallConfidence:
      hints.length > 0 ? hints.reduce((s, h) => s + h.confidence, 0) / hints.length : 0,
    recordCount: result.recordCount,
  };
}

/**
 * Compact one-line summary for the UI / Code Chat tool output.
 */
export function summarizeHints(result: PersonalizationHintResult): string {
  const parts: string[] = [];
  parts.push(`${result.hints.length} hints`);
  if (result.byCategory.learning_track.length > 0) {
    parts.push(`${result.byCategory.learning_track.length} learning`);
  }
  if (result.byCategory.calculator_focus.length > 0) {
    parts.push(`${result.byCategory.calculator_focus.length} calc`);
  }
  if (result.byCategory.risk_indicator.length > 0) {
    parts.push(`${result.byCategory.risk_indicator.length} risk`);
  }
  parts.push(`conf=${Math.round(result.overallConfidence * 100)}%`);
  return parts.join(" · ");
}
