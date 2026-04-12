/**
 * CalculatorContextBar — Contextual guardrail warnings + benchmark comparisons
 *
 * Displays alongside any calculator result to give users confidence
 * that their assumptions are reasonable, with citations and industry data.
 * Calls calculatorEngine.checkGuardrails and shows industry benchmarks inline.
 */

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle2, Info, Scale, TrendingUp, Shield,
} from "lucide-react";

interface Props {
  /** Map of parameter name → current value for guardrail checking */
  params: Record<string, number>;
  /** Show the benchmark comparison section */
  showBenchmarks?: boolean;
  className?: string;
}

const PARAM_LABELS: Record<string, string> = {
  returnRate: "Investment Return",
  savingsRate: "Savings Rate",
  growthRate: "Growth Rate",
  inflationRate: "Inflation",
  taxRate: "Tax Rate",
  investmentReturn: "Investment Return",
};

const SEVERITY_STYLES = {
  info: { border: "border-chart-3/30", bg: "bg-chart-3/5", icon: Info, color: "text-chart-3" },
  warning: { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: AlertTriangle, color: "text-amber-400" },
  error: { border: "border-destructive/30", bg: "bg-destructive/5", icon: AlertTriangle, color: "text-destructive" },
};

const BENCHMARK_LABELS: Record<string, string> = {
  savingsRate: "National Savings Rate",
  investorBehaviorGap: "Investor Behavior Gap",
  lifeInsuranceGap: "Life Insurance Gap",
  retirementReadiness: "Retirement Readiness",
  estatePlanningGap: "Estate Planning Gap",
  advisorAlpha: "Advisor Alpha",
  avgAdvisoryFee: "Avg Advisory Fee",
  avgWealthGrowth: "Avg Wealth Growth",
};

function formatBenchmarkValue(key: string, bm: any): string {
  if (bm.national != null) return `${(bm.national * 100).toFixed(1)}%`;
  if (bm.gap != null) return `${(bm.gap * 100).toFixed(1)}%/yr`;
  if (bm.pct != null) return `${(bm.pct * 100).toFixed(0)}%`;
  if (key === "avgAdvisoryFee" && bm.value != null) return `${(bm.value * 100).toFixed(2)}%`;
  if (key === "advisorAlpha" && bm.value != null) return `~${(bm.value * 100).toFixed(0)}%/yr`;
  if (bm.sp500 != null) return `S&P: ${(bm.sp500 * 100).toFixed(1)}%`;
  if (bm.value != null) return String(bm.value);
  return "—";
}

export function CalculatorContextBar({ params, showBenchmarks = true, className }: Props) {
  // Check guardrails against user's current inputs
  const guardrailParams = useMemo(() => {
    const mapped: Record<string, number> = {};
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "number" && !isNaN(v)) mapped[k] = v;
    }
    return mapped;
  }, [params]);

  const { data: warnings } = trpc.calculatorEngine.checkGuardrails.useQuery(
    { params: guardrailParams },
    { enabled: Object.keys(guardrailParams).length > 0, retry: false },
  );

  const { data: benchmarks } = trpc.calculatorEngine.industryBenchmarks.useQuery(
    undefined,
    { enabled: showBenchmarks, retry: false },
  );

  const hasWarnings = warnings && warnings.length > 0;

  // Don't render anything until we have data
  if (!hasWarnings && !benchmarks) return null;

  return (
    <div className={className}>
      {/* Guardrail Warnings */}
      {hasWarnings && (
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-amber-400" />
              <CardTitle className="text-sm">Assumption Check</CardTitle>
              <Badge variant="outline" className="text-[10px]">
                {warnings.length} note{warnings.length !== 1 ? "s" : ""}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            {warnings.map((w: any, i: number) => {
              const sev = SEVERITY_STYLES[w.severity as keyof typeof SEVERITY_STYLES] ?? SEVERITY_STYLES.info;
              const Icon = sev.icon;
              return (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-md text-xs ${sev.border} ${sev.bg} border`}>
                  <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${sev.color}`} />
                  <div>
                    <span className="font-medium">
                      {PARAM_LABELS[w.field] ?? w.field}: {typeof w.value === "number" && w.value < 1 ? `${(w.value * 100).toFixed(1)}%` : w.value}
                    </span>
                    <span className="text-muted-foreground ml-1">— {w.message}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* All Clear */}
      {!hasWarnings && warnings && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-muted-foreground">All assumptions within historical norms.</span>
        </div>
      )}

      {/* Benchmark Context */}
      {showBenchmarks && benchmarks && (
        <Card className="border-border/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <CardTitle className="text-sm">Industry Benchmarks</CardTitle>
              <Badge variant="outline" className="text-[10px]">Reference</Badge>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {Object.entries(benchmarks as Record<string, any>).map(([key, bm]: [string, any]) => {
                const displayValue = formatBenchmarkValue(key, bm);
                return (
                  <div key={key} className="p-2 rounded-md bg-secondary/50 text-[10px]">
                    <p className="text-muted-foreground truncate">{BENCHMARK_LABELS[key] ?? key}</p>
                    <p className="font-semibold text-xs tabular-nums mt-0.5">{displayValue}</p>
                    {bm.source && (
                      <p className="text-muted-foreground/60 mt-0.5 leading-tight">{bm.source}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
