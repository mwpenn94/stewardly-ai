/**
 * GuardrailBadge — inline validation badge for calculator inputs.
 *
 * Calls wealthEngine.checkGuardrail to validate a numeric input against
 * the SCUI guardrail rules (return rate, savings rate, inflation, etc.)
 * and renders a color-coded badge with the warning/error message.
 *
 * Usage:
 *   <GuardrailBadge param="returnRate" value={0.15} />
 */

import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";

interface Props {
  /** Guardrail key from SCUI GUARDRAILS (returnRate, savingsRate, inflationRate, aumFee, loanRate, creditingRate) */
  param: string;
  /** Current numeric value */
  value: number;
  /** Show even when value is in the green zone (default: false) */
  showOk?: boolean;
  /** Compact mode — icon only (default: false) */
  compact?: boolean;
}

export function GuardrailBadge({ param, value, showOk = false, compact = false }: Props) {
  const { data } = trpc.wealthEngine.checkGuardrail.useQuery(
    { key: param, value },
    { enabled: value != null && !isNaN(value), retry: false },
  );

  const check = data?.check;

  if (!check && !showOk) return null;

  if (!check) {
    // Value is in the green zone
    if (!showOk) return null;
    return (
      <Badge variant="outline" className="text-[10px] gap-1 text-emerald-400 border-emerald-400/30">
        {!compact && <CheckCircle2 className="w-3 h-3" />}
        {!compact && "OK"}
      </Badge>
    );
  }

  if (check.type === "error") {
    return (
      <Badge variant="destructive" className="text-[10px] gap-1" title={check.msg}>
        <XCircle className="w-3 h-3" />
        {!compact && <span className="max-w-[200px] truncate">{check.msg}</span>}
      </Badge>
    );
  }

  // Warning
  return (
    <Badge variant="outline" className="text-[10px] gap-1 text-amber-400 border-amber-400/30 bg-amber-400/5" title={check.msg}>
      <AlertTriangle className="w-3 h-3" />
      {!compact && <span className="max-w-[200px] truncate">{check.msg}</span>}
    </Badge>
  );
}

/**
 * GuardrailsSummary — a compact panel showing all guardrail rules
 * with their current defaults and threshold ranges.
 */
export function GuardrailsSummary() {
  const { data } = trpc.wealthEngine.getGuardrails.useQuery();

  if (!data) return null;

  return (
    <div className="space-y-2">
      {Object.entries(data.guardrails).map(([key, rule]: [string, any]) => (
        <div key={key} className="p-2 rounded-lg border border-border/50 bg-card/60">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium">{rule.label}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Default: {(rule.default * 100).toFixed(1)}%
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>Min: {(rule.min * 100).toFixed(1)}%</span>
            <div className="flex-1 h-1.5 rounded-full bg-muted/50 relative overflow-hidden">
              <div
                className="absolute inset-y-0 bg-emerald-400/40 rounded-full"
                style={{
                  left: `${(rule.min / rule.max) * 100}%`,
                  right: `${100 - (rule.max * 0.8 / rule.max) * 100}%`,
                }}
              />
              <div
                className="absolute inset-y-0 bg-amber-400/40 rounded-full"
                style={{
                  left: `${(rule.max * 0.8 / rule.max) * 100}%`,
                  right: "0%",
                }}
              />
              <div
                className="absolute top-0 bottom-0 w-1 bg-accent rounded-full"
                style={{ left: `${(rule.default / rule.max) * 100}%` }}
              />
            </div>
            <span>Max: {(rule.max * 100).toFixed(1)}%</span>
          </div>
          <p className="text-[9px] text-muted-foreground/60 mt-1">{rule.warn}</p>
        </div>
      ))}
    </div>
  );
}
