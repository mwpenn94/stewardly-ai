/**
 * GuardrailWarning — inline input validation feedback for calculator pages.
 *
 * Shows a small amber/red warning when a user's input exceeds safe bounds
 * defined by the v7 guardrail rules in benchmarks.ts. Pure client-side —
 * mirrors the server-side checkGuardrail() logic without a network call.
 */

import { AlertTriangle } from "lucide-react";

// ─── Guardrail definitions (mirrored from benchmarks.ts) ────────────
interface GuardrailRule {
  min: number;
  max: number;
  warn: string;
}

const GUARDRAILS: Record<string, GuardrailRule> = {
  returnRate: {
    min: 0,
    max: 0.15,
    warn: "Return rates above 12% are historically rare (Morningstar 2025). S&P 500 avg: 10.3%.",
  },
  savingsRate: {
    min: 0,
    max: 0.80,
    warn: "Savings rates above 50% may not be sustainable long-term.",
  },
  inflationRate: {
    min: 0,
    max: 0.10,
    warn: "US inflation avg 3.2% since 1913 (BLS). Rates above 6% = extreme scenario.",
  },
  aumFee: {
    min: 0,
    max: 0.03,
    warn: "Advisory fees above 2% are well above the 1.02% industry avg (Kitces 2025).",
  },
  loanRate: {
    min: 0.02,
    max: 0.12,
    warn: "Current SOFR: ~4.3% (NY Fed April 2026). Typical PremFin spread: SOFR + 1-2%.",
  },
  creditingRate: {
    min: 0.03,
    max: 0.12,
    warn: "AG 49-A limits IUL illustrated rates. Current NLG FlexLife cap: 10-12%.",
  },
  investmentReturn: {
    min: 0,
    max: 0.15,
    warn: "Return rates above 12% are historically rare (Morningstar 2025). S&P 500 avg: 10.3%.",
  },
  taxRate: {
    min: 0.05,
    max: 0.50,
    warn: "Tax rates above 40% are in the top federal bracket territory (37% + state).",
  },
};

/**
 * Check a guardrail and return warning info or null.
 */
export function checkGuardrail(
  key: string,
  value: number,
): { type: "warn" | "error"; msg: string } | null {
  const g = GUARDRAILS[key];
  if (!g) return null;
  if (value < g.min) return { type: "error", msg: `Value below minimum (${(g.min * 100).toFixed(0)}%)` };
  if (value > g.max) return { type: "error", msg: `Value exceeds maximum (${(g.max * 100).toFixed(0)}%)` };
  if (value > g.max * 0.8) return { type: "warn", msg: g.warn };
  return null;
}

/**
 * Inline guardrail warning component.
 * Renders nothing when the value is in the safe range.
 */
export function GuardrailWarning({
  guardrailKey,
  value,
}: {
  guardrailKey: string;
  value: number;
}) {
  const check = checkGuardrail(guardrailKey, value);
  if (!check) return null;

  const isError = check.type === "error";
  return (
    <div
      className={`flex items-start gap-1.5 mt-1 text-[10px] leading-tight ${
        isError ? "text-red-400" : "text-amber-400/80"
      }`}
    >
      <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
      <span>{check.msg}</span>
    </div>
  );
}
