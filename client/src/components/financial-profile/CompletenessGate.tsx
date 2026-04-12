/**
 * CompletenessGate — wraps an engine run CTA with a "fill in N more
 * fields for a high-confidence result" affordance. When the profile
 * is missing any required fields, the gate renders a warning banner
 * listing the missing fields (with friendly labels) and still lets
 * the user run with defaults if they choose. When the profile is
 * ready, it renders a compact confidence chip next to the CTA.
 *
 * Declarative API:
 *
 *   <CompletenessGate
 *     requiredFields={["age", "income", "savings"]}
 *     optionalFields={["marginalRate", "monthlySavings"]}
 *   >
 *     {(gate) => (
 *       <Button onClick={handleRun} disabled={!gate.ready && strict}>
 *         Run
 *       </Button>
 *     )}
 *   </CompletenessGate>
 *
 * Pass 9 history: ships gap G10 from docs/PARITY.md.
 */

import { useMemo } from "react";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import {
  evaluateGate,
  labelFor,
  type CompletenessGateResult,
} from "@/stores/completenessGate";
import type { FinancialProfile } from "@/stores/financialProfile";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletenessGateProps {
  /** Field names the engine must have to run meaningfully. */
  requiredFields: (keyof FinancialProfile)[];
  /** Field names that raise confidence but aren't blockers. */
  optionalFields?: (keyof FinancialProfile)[];
  /** Label shown above the missing-fields list. */
  title?: string;
  /** Render prop; receives the gate result. */
  children: (gate: CompletenessGateResult) => React.ReactNode;
  /** Hide the whole warning banner when the profile is ready. */
  hideWhenReady?: boolean;
  /** ClassName passthrough for layout overrides. */
  className?: string;
}

export function CompletenessGate({
  requiredFields,
  optionalFields = [],
  title = "Profile check",
  children,
  hideWhenReady = false,
  className,
}: CompletenessGateProps) {
  const { profile } = useFinancialProfile("completeness-gate");

  const gate = useMemo(
    () => evaluateGate(profile, requiredFields, optionalFields),
    [profile, requiredFields, optionalFields],
  );

  const showBanner = !hideWhenReady || !gate.ready;

  return (
    <div className={cn("space-y-3", className)}>
      {showBanner && (
        <div
          role={gate.ready ? "status" : "alert"}
          aria-live="polite"
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
            gate.ready
              ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-500"
              : gate.tier === "medium"
                ? "border-amber-500/30 bg-amber-500/5 text-amber-500"
                : "border-destructive/30 bg-destructive/5 text-destructive",
          )}
          data-testid="completeness-gate-banner"
        >
          <span className="flex-shrink-0 mt-0.5">
            {gate.ready ? (
              <CheckCircle2 className="w-3.5 h-3.5" />
            ) : gate.tier === "medium" ? (
              <CircleAlert className="w-3.5 h-3.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{title}</span>
              <Badge
                variant="outline"
                className="h-4 px-1 text-[10px] capitalize border-current"
              >
                {gate.tier} confidence
              </Badge>
              {gate.ready ? (
                <span className="text-[11px] opacity-80">{gate.summary}</span>
              ) : null}
            </div>
            {!gate.ready && gate.missing.length > 0 && (
              <p className="text-[11px] mt-1 opacity-90">
                Fill in{" "}
                <strong>
                  {gate.missing.map((f) => labelFor(f)).join(", ")}
                </strong>{" "}
                on the Quick Quote to raise confidence. You can still run
                with defaults below.
              </p>
            )}
          </div>
        </div>
      )}
      {children(gate)}
    </div>
  );
}
