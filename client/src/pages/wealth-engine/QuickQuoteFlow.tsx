/**
 * QuickQuoteFlow — 3-step wizard replicating the v7 Quick Quote panels.
 *
 * Step 1: Inputs (age, income, savings, dependents, coverage, homeowner, biz)
 * Step 2: 6-domain assessment scoring (0-3 each) → composite score
 * Step 3: Results — protection table + WealthBridge recommendation +
 *         CTA to the full Strategy Comparison page
 *
 * Replicates the v7 inline math for the 6-domain scoring so the
 * assessment lands instantly. Uses tRPC `runPreset` for the projection
 * snapshot in step 3.
 */

import { useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  Sparkles,
  Shield,
  Building2,
} from "lucide-react";
import { useLocation } from "wouter";

interface QuickQuoteInputs {
  age: number;
  income: number;
  savings: number;
  monthlySavings: number;
  dependents: number;
  hasLifeInsurance: boolean;
  hasHomeownerInsurance: boolean;
  isBizOwner: boolean;
}

const DOMAINS = [
  { key: "income", label: "Income Replacement" },
  { key: "emergency", label: "Emergency Fund" },
  { key: "retirement", label: "Retirement Savings" },
  { key: "protection", label: "Protection (Life + Disability)" },
  { key: "tax", label: "Tax Optimization" },
  { key: "estate", label: "Estate Planning" },
] as const;

type DomainKey = (typeof DOMAINS)[number]["key"];

function scoreDomains(inputs: QuickQuoteInputs): Record<DomainKey, number> {
  // Replicates the v7 0-3 per-domain scoring logic.
  const annual = inputs.income;
  const emergencyMonths = annual > 0 ? (inputs.savings / (annual / 12)) : 0;
  const savingsRate = annual > 0 ? (inputs.monthlySavings * 12) / annual : 0;

  return {
    income: inputs.income >= 100_000 ? 3 : inputs.income >= 60_000 ? 2 : inputs.income > 0 ? 1 : 0,
    emergency: emergencyMonths >= 6 ? 3 : emergencyMonths >= 3 ? 2 : emergencyMonths >= 1 ? 1 : 0,
    retirement: savingsRate >= 0.15 ? 3 : savingsRate >= 0.1 ? 2 : savingsRate > 0 ? 1 : 0,
    protection: inputs.hasLifeInsurance && inputs.dependents > 0 ? 3 : inputs.hasLifeInsurance ? 2 : inputs.dependents === 0 ? 2 : 0,
    tax: inputs.income >= 200_000 ? 1 : inputs.income >= 100_000 ? 2 : 1,
    estate: inputs.savings + inputs.income * 10 > 1_000_000 ? 1 : 2,
  };
}

export default function QuickQuoteFlowPage() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [inputs, setInputs] = useState<QuickQuoteInputs>({
    age: 40,
    income: 120_000,
    savings: 50_000,
    monthlySavings: 1500,
    dependents: 2,
    hasLifeInsurance: false,
    hasHomeownerInsurance: true,
    isBizOwner: false,
  });

  const scores = useMemo(() => scoreDomains(inputs), [inputs]);
  const total = useMemo(
    () => Object.values(scores).reduce((s, v) => s + v, 0),
    [scores],
  );
  const max = DOMAINS.length * 3;

  const runPreset = trpc.wealthEngine.runPreset.useMutation();
  const multiLine = trpc.wealthEngine.multiLineQuickQuote.useMutation();

  const onAdvanceToResults = () => {
    runPreset.mutate({
      preset: "wealthbridgeClient",
      profile: {
        age: inputs.age,
        income: inputs.income,
        savings: inputs.savings,
        monthlySavings: inputs.monthlySavings,
        dependents: inputs.dependents,
        netWorth: inputs.savings + inputs.income * 0.5,
        mortgage: inputs.hasHomeownerInsurance ? 250_000 : 0,
        debts: 30_000,
        marginalRate: 0.25,
        isBizOwner: inputs.isBizOwner,
      },
      years: 30,
    });
    // Kick off the multi-line bundle in parallel so step 4 lands instantly.
    multiLine.mutate({
      age: inputs.age,
      income: inputs.income,
      savings: inputs.savings,
      monthlySavings: inputs.monthlySavings,
      dependents: inputs.dependents,
      netWorth: inputs.savings + inputs.income * 0.5,
      hasHome: inputs.hasHomeownerInsurance,
      homeValue: inputs.hasHomeownerInsurance ? 400_000 : undefined,
      isBizOwner: inputs.isBizOwner,
    });
    setStep(3);
  };

  const projection = runPreset.data?.data ?? [];
  const finalSnap = projection[projection.length - 1];
  const bundle = multiLine.data?.data;

  return (
    <AppShell title="Quick Quote">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold">Quick Quote</h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of 4 —{" "}
            {step === 1
              ? "Tell us about you"
              : step === 2
                ? "Your protection scorecard"
                : step === 3
                  ? "Recommended plan"
                  : "Your coverage bundle"}
          </p>
          <StepBar step={step} />
        </header>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">About you</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <NumberField label="Age" value={inputs.age} onChange={(v) => setInputs({ ...inputs, age: v })} min={18} max={85} />
              <NumberField label="Annual income" value={inputs.income} onChange={(v) => setInputs({ ...inputs, income: v })} step={5000} />
              <NumberField label="Current savings" value={inputs.savings} onChange={(v) => setInputs({ ...inputs, savings: v })} step={5000} />
              <NumberField label="Monthly savings" value={inputs.monthlySavings} onChange={(v) => setInputs({ ...inputs, monthlySavings: v })} step={100} />
              <NumberField label="Dependents" value={inputs.dependents} onChange={(v) => setInputs({ ...inputs, dependents: v })} min={0} max={10} />
              <ToggleField label="I have life insurance" value={inputs.hasLifeInsurance} onChange={(v) => setInputs({ ...inputs, hasLifeInsurance: v })} />
              <ToggleField label="I am a homeowner" value={inputs.hasHomeownerInsurance} onChange={(v) => setInputs({ ...inputs, hasHomeownerInsurance: v })} />
              <ToggleField label="I'm a business owner" value={inputs.isBizOwner} onChange={(v) => setInputs({ ...inputs, isBizOwner: v })} />
              <div className="md:col-span-2 flex justify-end">
                <Button onClick={() => setStep(2)}>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your scorecard</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScoreRing total={total} max={max} />
              <div className="grid md:grid-cols-2 gap-2">
                {DOMAINS.map((d) => (
                  <DomainRow key={d.key} label={d.label} score={scores[d.key]} />
                ))}
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={onAdvanceToResults} disabled={runPreset.isPending}>
                  {runPreset.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  See your plan <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your WealthBridge plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {runPreset.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Running projection...
                </div>
              )}
              {finalSnap && (
                <>
                  <div className="rounded-lg p-6 text-center" style={{ background: `${chartTokens.colors.wealthbridge}10` }}>
                    <div className="text-xs uppercase text-muted-foreground tracking-wide">
                      Projected liquid wealth at age {finalSnap.age}
                    </div>
                    <div
                      className="text-4xl font-extrabold mt-2"
                      style={{ color: chartTokens.colors.wealthbridge, fontVariantNumeric: "tabular-nums" }}
                    >
                      {formatCurrency(finalSnap.totalLiquidWealth)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-2">
                      Total protection: {formatCurrency(finalSnap.totalProtection)}
                    </div>
                  </div>
                  <div className="rounded-md border p-4 text-sm flex items-start gap-3">
                    <ShieldAlert className="h-5 w-5 mt-0.5" style={{ color: chartTokens.colors.warning }} />
                    <div>
                      <div className="font-semibold">This is a projection, not advice.</div>
                      <div className="text-muted-foreground">
                        Run the full Strategy Comparison to see how this plan stacks up
                        against the peer set, or talk to a WealthBridge advisor.
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/wealth-engine/strategy-comparison")}>
                    Strategy comparison
                  </Button>
                  <Button onClick={() => setStep(4)}>
                    See coverage bundle <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" style={{ color: chartTokens.colors.wealthbridge }} />
                Coverage bundle
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {multiLine.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Building your multi-line quote...
                </div>
              )}
              {bundle && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <BundleStat
                      label="Lines"
                      value={`${bundle.coverageLines.length}`}
                      sub="Coverage recommendations"
                    />
                    <BundleStat
                      label="Critical"
                      value={formatCurrency(bundle.totals.annualPremiumCritical)}
                      sub="Per year"
                      emphasize
                    />
                    <BundleStat
                      label="All lines"
                      value={formatCurrency(bundle.totals.annualPremiumAll)}
                      sub="Per year"
                    />
                    <BundleStat
                      label="% of income"
                      value={`${(bundle.totals.asPctOfIncome * 100).toFixed(1)}%`}
                      sub="Total budget"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                          Coverage
                        </p>
                      </div>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                        {bundle.coverageLines.map((line, i) => (
                          <div
                            key={i}
                            className="flex items-start justify-between gap-2 rounded-md border p-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge
                                  variant="outline"
                                  className="h-4 text-[9px] px-1"
                                  style={{
                                    borderColor:
                                      line.priority === "critical"
                                        ? chartTokens.colors.danger
                                        : line.priority === "recommended"
                                          ? chartTokens.colors.wealthbridge
                                          : undefined,
                                    color:
                                      line.priority === "critical"
                                        ? chartTokens.colors.danger
                                        : line.priority === "recommended"
                                          ? chartTokens.colors.wealthbridge
                                          : undefined,
                                  }}
                                >
                                  {line.priority}
                                </Badge>
                                <p className="text-xs font-medium truncate">{line.product}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {line.rationale}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold tabular-nums">
                                {formatCurrency(line.annualPremium)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatCurrency(line.monthlyPremium)}/mo
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">
                          Planning actions
                        </p>
                      </div>
                      <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                        {bundle.planningActions.map((action, i) => (
                          <div
                            key={i}
                            className="flex items-start gap-2 rounded-md border p-2.5"
                          >
                            <Badge
                              variant="outline"
                              className="h-4 text-[9px] px-1 shrink-0"
                              style={{
                                borderColor:
                                  action.priority === "critical"
                                    ? chartTokens.colors.danger
                                    : chartTokens.colors.wealthbridge,
                                color:
                                  action.priority === "critical"
                                    ? chartTokens.colors.danger
                                    : chartTokens.colors.wealthbridge,
                              }}
                            >
                              {action.priority}
                            </Badge>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium">{action.action}</p>
                              <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                {action.impact}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {bundle.warnings.length > 0 && (
                    <div className="rounded-md border p-3 text-[11px] space-y-1" style={{ borderColor: chartTokens.colors.warning }}>
                      {bundle.warnings.map((w, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <ShieldAlert
                            className="h-3.5 w-3.5 mt-0.5 shrink-0"
                            style={{ color: chartTokens.colors.warning }}
                          />
                          <span>{w}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => navigate("/insurance-analysis")}>
                    Insurance deep-dive
                  </Button>
                  <Button onClick={() => navigate("/wealth-engine/strategy-comparison")}>
                    Full strategy comparison <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function BundleStat({
  label,
  value,
  sub,
  emphasize,
}: {
  label: string;
  value: string;
  sub?: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        background: emphasize ? `${chartTokens.colors.wealthbridge}08` : undefined,
        borderColor: emphasize ? `${chartTokens.colors.wealthbridge}40` : undefined,
      }}
    >
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div
        className="text-lg font-bold mt-0.5 tabular-nums"
        style={{
          color: emphasize ? chartTokens.colors.wealthbridge : undefined,
        }}
      >
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {[1, 2, 3, 4].map((s) => (
        <div
          key={s}
          className="h-1 flex-1 rounded-full"
          style={{
            background:
              s <= step ? chartTokens.colors.wealthbridge : "#e2e8f0",
            transition: "background 240ms ease",
          }}
        />
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} min={min} max={max} step={step} />
    </div>
  );
}

function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <Label className="cursor-pointer flex-1">{label}</Label>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}

function ScoreRing({ total, max }: { total: number; max: number }) {
  const pct = total / max;
  const color =
    pct >= 0.75
      ? chartTokens.colors.positive
      : pct >= 0.5
        ? chartTokens.colors.warning
        : chartTokens.colors.danger;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  return (
    <div className="flex items-center justify-center py-2">
      <svg width={160} height={160} viewBox="0 0 160 160">
        <circle cx={80} cy={80} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={12} />
        <circle
          cx={80}
          cy={80}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 80 80)"
          style={{ transition: "stroke-dashoffset 800ms ease-out" }}
        />
        <text x={80} y={84} textAnchor="middle" fontSize={32} fontWeight={800} fill={color} style={{ fontVariantNumeric: "tabular-nums" }}>
          {total}/{max}
        </text>
      </svg>
    </div>
  );
}

function DomainRow({ label, score }: { label: string; score: number }) {
  const color =
    score === 3
      ? chartTokens.colors.positive
      : score === 2
        ? chartTokens.colors.warning
        : chartTokens.colors.danger;
  const Icon = score >= 2 ? CheckCircle2 : AlertCircle;
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Badge variant="outline" style={{ color, borderColor: color }} className="gap-1">
        <Icon className="h-3 w-3" /> {score}/3
      </Badge>
    </div>
  );
}
