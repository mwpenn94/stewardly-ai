/**
 * InsuranceAnalysis — Interactive insurance needs analysis using the DIME method
 * (Debt, Income, Mortgage, Education) with coverage gap identification and
 * actionable recommendations.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";
import { PlanningCrossNav } from "@/components/PlanningCrossNav";
import { ArrowLeft, Shield, Heart, Home, Car, Umbrella, AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { persistCalculation } from "@/lib/calculatorContext";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "$",
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; prefix?: string;
}) {
  const display = prefix === "$" ? fmt(value) : `${value.toLocaleString()}${prefix === "" ? "" : prefix}`;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="text-xs font-mono text-foreground">{display}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min} max={max} step={step}
        aria-label={label}
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

type PolicyEntry = {
  id: string;
  type: "life" | "disability" | "homeowners" | "auto" | "umbrella" | "health" | "ltc";
  carrier: string;
  coverage: number;
  premium: number; // monthly
};

const TYPE_LABELS: Record<string, string> = {
  life: "Life Insurance",
  disability: "Disability (LTD)",
  homeowners: "Homeowners",
  auto: "Auto",
  umbrella: "Umbrella",
  health: "Health",
  ltc: "Long-Term Care",
};

const TYPE_ICONS: Record<string, typeof Heart> = {
  life: Heart,
  disability: Shield,
  homeowners: Home,
  auto: Car,
  umbrella: Umbrella,
  health: Shield,
  ltc: Shield,
};

export default function InsuranceAnalysis() {
  const [, navigate] = useLocation();
  const { profile } = useFinancialProfile("insurance-analysis");

  // ─── DIME Method Inputs (initialized from shared profile) ──
  const [annualIncome, setAnnualIncome] = useState(profileValue(profile, "annualIncome", 150000));
  const [yearsToReplace, setYearsToReplace] = useState(10);
  const [mortgageBalance, setMortgageBalance] = useState(profileValue(profile, "mortgageBalance", 350000));
  const [otherDebts, setOtherDebts] = useState(profileValue(profile, "otherDebts", 25000));
  const [childrenCount, setChildrenCount] = useState(profileValue(profile, "childrenCount", 2));
  const [educationPerChild, setEducationPerChild] = useState(profileValue(profile, "educationCostPerChild", 100000));
  const [finalExpenses, setFinalExpenses] = useState(15000);
  const [existingLifeInsurance, setExistingLifeInsurance] = useState(profileValue(profile, "existingLifeInsurance", 500000));
  const [spouseIncome, setSpouseIncome] = useState(profileValue(profile, "spouseIncome", 60000));
  const [currentAge, setCurrentAge] = useState(profileValue(profile, "currentAge", 40));
  const [netWorth, setNetWorth] = useState(profileValue(profile, "netWorth", 1_250_000));

  // ─── Policy tracker ─────────────────────────────────────
  const [policies, setPolicies] = useState<PolicyEntry[]>([
    { id: "life1", type: "life", carrier: "", coverage: 500000, premium: 145 },
    { id: "dis1", type: "disability", carrier: "", coverage: 60, premium: 89 },
    { id: "home1", type: "homeowners", carrier: "", coverage: 450000, premium: 210 },
    { id: "auto1", type: "auto", carrier: "", coverage: 300000, premium: 165 },
  ]);

  const addPolicy = () => {
    setPolicies(prev => [...prev, {
      id: `policy-${Date.now()}`,
      type: "life",
      carrier: "",
      coverage: 0,
      premium: 0,
    }]);
  };

  const removePolicy = (id: string) => {
    setPolicies(prev => prev.filter(p => p.id !== id));
  };

  const updatePolicy = (id: string, updates: Partial<PolicyEntry>) => {
    setPolicies(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  // ─── DIME Calculation ───────────────────────────────────
  const dime = useMemo(() => {
    const debt = mortgageBalance + otherDebts;
    const income = annualIncome * yearsToReplace;
    const education = childrenCount * educationPerChild;
    const total = debt + income + education + finalExpenses;
    const gap = total - existingLifeInsurance;
    const withSpouseOffset = Math.max(0, gap - (spouseIncome * yearsToReplace * 0.3)); // spouse covers 30%
    return {
      debt,
      income,
      education,
      finalExpenses,
      total,
      gap: Math.max(0, gap),
      recommended: Math.max(0, withSpouseOffset),
      coverageRatio: existingLifeInsurance > 0 ? Math.min(100, Math.round((existingLifeInsurance / total) * 100)) : 0,
    };
  }, [annualIncome, yearsToReplace, mortgageBalance, otherDebts, childrenCount, educationPerChild, finalExpenses, existingLifeInsurance, spouseIncome]);

  // ─── Insurance needs by type ────────────────────────────
  const needs = useMemo(() => {
    const lifePolicies = policies.filter(p => p.type === "life");
    const totalLife = lifePolicies.reduce((s, p) => s + p.coverage, 0);
    const hasUmbrella = policies.some(p => p.type === "umbrella" && p.coverage > 0);
    const hasDisability = policies.some(p => p.type === "disability" && p.coverage > 0);
    const hasHomeowners = policies.some(p => p.type === "homeowners" && p.coverage > 0);
    const totalPremium = policies.reduce((s, p) => s + p.premium, 0);

    // Umbrella recommendation: 1x net worth minimum
    const umbrellaNeeded = Math.max(1_000_000, netWorth);
    const umbrellaCurrent = policies.filter(p => p.type === "umbrella").reduce((s, p) => s + p.coverage, 0);

    // Disability: 60% of income replacement
    const disabilityNeeded = Math.round(annualIncome * 0.6);
    const disabilityCurrent = policies.filter(p => p.type === "disability").reduce((s, p) => s + p.coverage, 0); // as % of income

    return {
      lifeGap: Math.max(0, dime.recommended - totalLife),
      totalLife,
      hasUmbrella,
      hasDisability,
      hasHomeowners,
      totalPremium,
      umbrellaNeeded,
      umbrellaCurrent,
      disabilityNeeded,
      disabilityCurrent,
    };
  }, [policies, dime, netWorth, annualIncome]);

  // Coverage score (0-100)
  const coverageScore = useMemo(() => {
    let score = 0;
    // Life: 0-40 points based on coverage ratio
    score += Math.min(40, Math.round((needs.totalLife / Math.max(1, dime.total)) * 40));
    // Disability: 20 points if present
    score += needs.hasDisability ? 20 : 0;
    // Homeowners: 15 points if present
    score += needs.hasHomeowners ? 15 : 0;
    // Umbrella: 15 points if present
    score += needs.hasUmbrella ? 15 : 0;
    // Age-appropriate: 10 points bonus if > 60
    score += Math.min(10, Math.round((dime.coverageRatio / 100) * 10));
    return Math.min(100, score);
  }, [needs, dime]);

  // ── Persist to calculator context bridge so Chat knows insurance analysis ──
  useEffect(() => {
    persistCalculation({
      id: `insurance-dime-${annualIncome}-${childrenCount}`,
      type: "insurance",
      title: "Insurance Analysis — DIME Method",
      summary: `Coverage score: ${coverageScore}/100. DIME need: ${fmt(dime.total)}, existing: ${fmt(existingLifeInsurance)}, gap: ${needs.lifeGap === 0 ? "none" : fmt(needs.lifeGap)}. Monthly premiums: ${fmt(needs.totalPremium)}. Umbrella: ${needs.hasUmbrella ? "yes" : "MISSING"}. Disability: ${needs.hasDisability ? "yes" : "MISSING"}.`,
      inputs: { annualIncome, mortgageBalance, otherDebts, childrenCount, educationPerChild, existingLifeInsurance, spouseIncome, currentAge, netWorth, policyCount: policies.length },
      outputs: { dimeTotal: dime.total, dimeGap: dime.gap, recommended: dime.recommended, coverageRatio: dime.coverageRatio, coverageScore, lifeGap: needs.lifeGap, totalPremium: needs.totalPremium, hasUmbrella: needs.hasUmbrella, hasDisability: needs.hasDisability },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverageScore, dime.total, needs.lifeGap]);

  return (
    <AppShell title="Insurance Analysis">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Insurance Analysis" description="Interactive insurance needs analysis with DIME method and coverage gap identification" />

      <PlanningCrossNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Insurance Analysis</h1>
            <p className="text-sm text-muted-foreground">DIME-method needs analysis and coverage gap identification</p>
          </div>
        </div>
      </div>

      {/* ─── Summary Stats ─────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Coverage Score</p>
          <p className={`text-lg font-semibold tabular-nums ${coverageScore >= 80 ? "text-emerald-400" : coverageScore >= 50 ? "text-amber-400" : "text-red-400"}`}>{coverageScore}/100</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Life Insurance Need</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(dime.total)}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Coverage Gap</p>
          <p className={`text-lg font-semibold tabular-nums ${needs.lifeGap === 0 ? "text-emerald-400" : "text-red-400"}`}>{needs.lifeGap === 0 ? "None" : fmt(needs.lifeGap)}</p>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Monthly Premiums</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(needs.totalPremium)}</p>
        </div>
      </div>

      <Tabs defaultValue="needs">
        <TabsList>
          <TabsTrigger value="needs">Needs Analysis</TabsTrigger>
          <TabsTrigger value="policies">Current Policies</TabsTrigger>
          <TabsTrigger value="gaps">Gap Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="needs" className="mt-4 space-y-4">
          {/* ─── DIME Inputs ─────────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">DIME Method — Life Insurance Needs</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                <SliderInput label="Annual Income" value={annualIncome} onChange={setAnnualIncome} min={0} max={500000} step={5000} />
                <SliderInput label="Years to Replace" value={yearsToReplace} onChange={setYearsToReplace} min={1} max={30} prefix="" />
                <SliderInput label="Mortgage Balance" value={mortgageBalance} onChange={setMortgageBalance} min={0} max={2_000_000} step={10000} />
                <SliderInput label="Other Debts" value={otherDebts} onChange={setOtherDebts} min={0} max={500000} step={5000} />
                <SliderInput label="Children" value={childrenCount} onChange={setChildrenCount} min={0} max={6} prefix="" />
                <SliderInput label="Education Cost per Child" value={educationPerChild} onChange={setEducationPerChild} min={0} max={300000} step={10000} />
                <SliderInput label="Final Expenses" value={finalExpenses} onChange={setFinalExpenses} min={0} max={50000} step={1000} />
                <SliderInput label="Existing Life Insurance" value={existingLifeInsurance} onChange={setExistingLifeInsurance} min={0} max={5_000_000} step={50000} />
                <SliderInput label="Spouse Income" value={spouseIncome} onChange={setSpouseIncome} min={0} max={300000} step={5000} />
                <SliderInput label="Net Worth (for umbrella)" value={netWorth} onChange={setNetWorth} min={0} max={10_000_000} step={50000} />
              </div>
            </CardContent>
          </Card>

          {/* ─── DIME Breakdown ────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">DIME Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { label: "D — Debt", value: dime.debt, desc: `Mortgage (${fmt(mortgageBalance)}) + other debts (${fmt(otherDebts)})` },
                  { label: "I — Income Replacement", value: dime.income, desc: `${fmt(annualIncome)}/yr × ${yearsToReplace} years` },
                  { label: "M — Mortgage", value: mortgageBalance, desc: "Already included in Debt above (combined)" },
                  { label: "E — Education", value: dime.education, desc: `${childrenCount} children × ${fmt(educationPerChild)}` },
                  { label: "Final Expenses", value: dime.finalExpenses, desc: "Funeral, legal, and probate costs" },
                ].map((row, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div>
                      <span className="text-sm font-medium">{row.label}</span>
                      <p className="text-xs text-muted-foreground">{row.desc}</p>
                    </div>
                    <span className="text-sm font-mono">{fmt(row.value)}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-border">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Total Need</span>
                    <span className="text-lg font-bold">{fmt(dime.total)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm text-muted-foreground">Less: Existing Coverage</span>
                    <span className="text-sm font-mono text-emerald-400">-{fmt(existingLifeInsurance)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-sm font-medium">Recommended Additional Coverage</span>
                    <span className={`text-lg font-bold ${dime.recommended === 0 ? "text-emerald-400" : "text-accent"}`}>{fmt(dime.recommended)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Current Policies</CardTitle>
                <Button variant="outline" size="sm" onClick={addPolicy} aria-label="Add policy">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Policy
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {policies.map(pol => {
                const Icon = TYPE_ICONS[pol.type] ?? Shield;
                return (
                  <div key={pol.id} className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end py-2 border-b border-border/30 last:border-0">
                    <div className="space-y-1">
                      <Label htmlFor={`type-${pol.id}`} className="text-[10px] text-muted-foreground">Type</Label>
                      <Select value={pol.type} onValueChange={v => updatePolicy(pol.id, { type: v as any })}>
                        <SelectTrigger id={`type-${pol.id}`} aria-label="Policy type" className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(TYPE_LABELS).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`carrier-${pol.id}`} className="text-[10px] text-muted-foreground">Carrier</Label>
                      <Input
                        id={`carrier-${pol.id}`}
                        value={pol.carrier}
                        onChange={e => updatePolicy(pol.id, { carrier: e.target.value })}
                        placeholder="Carrier name"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`coverage-${pol.id}`} className="text-[10px] text-muted-foreground">Coverage ($)</Label>
                      <Input
                        id={`coverage-${pol.id}`}
                        type="number"
                        value={pol.coverage}
                        onChange={e => updatePolicy(pol.id, { coverage: Number(e.target.value) || 0 })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`premium-${pol.id}`} className="text-[10px] text-muted-foreground">Monthly Premium</Label>
                      <Input
                        id={`premium-${pol.id}`}
                        type="number"
                        value={pol.premium}
                        onChange={e => updatePolicy(pol.id, { premium: Number(e.target.value) || 0 })}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <Button variant="ghost" size="icon-sm" onClick={() => removePolicy(pol.id)} aria-label={`Remove ${TYPE_LABELS[pol.type]} policy`}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}
              <div className="pt-2 flex justify-between items-center">
                <span className="text-sm font-medium">Total Monthly Premiums</span>
                <span className="text-lg font-bold">{fmt(needs.totalPremium)}/mo</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="gaps" className="mt-4 space-y-4">
          {/* Coverage overview */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage Assessment</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { type: "Life Insurance", current: needs.totalLife, recommended: dime.total, status: needs.lifeGap === 0 ? "adequate" : "gap" },
                  { type: "Disability", current: needs.disabilityCurrent, recommended: needs.disabilityNeeded, status: needs.hasDisability ? "adequate" : "missing" },
                  { type: "Homeowners", current: policies.filter(p => p.type === "homeowners").reduce((s, p) => s + p.coverage, 0), recommended: mortgageBalance * 1.2, status: needs.hasHomeowners ? "adequate" : "missing" },
                  { type: "Umbrella", current: needs.umbrellaCurrent, recommended: needs.umbrellaNeeded, status: needs.hasUmbrella ? "adequate" : "missing" },
                ].map(row => {
                  const pct = row.status === "missing" ? 0 : row.status === "adequate" ? 100 : Math.min(100, Math.round((row.current / Math.max(1, row.recommended)) * 100));
                  return (
                    <div key={row.type} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{row.type}</span>
                          {row.status === "adequate" && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Adequate</Badge>}
                          {row.status === "gap" && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Gap</Badge>}
                          {row.status === "missing" && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Missing</Badge>}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {fmt(row.current)} / {fmt(row.recommended)}
                        </span>
                      </div>
                      <Progress value={pct} className="h-2" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Dynamic insights */}
          {!needs.hasUmbrella && netWorth > 500000 && (
            <CalculatorInsight
              title="Critical: No Umbrella Policy"
              summary={`With ${fmt(netWorth)} in assets and no umbrella liability coverage, you're exposed to significant lawsuit risk.`}
              detail={`An umbrella policy providing ${fmt(needs.umbrellaNeeded)} in excess liability coverage typically costs $300–$500/year. Given your net worth, this is the highest-priority insurance gap.`}
              severity="critical"
              actionLabel="Discuss with Advisor"
              onAction={() => navigate("/chat")}
            />
          )}
          {needs.lifeGap > 0 && (
            <CalculatorInsight
              title={`Life Insurance Gap: ${fmt(needs.lifeGap)}`}
              summary={`Current life insurance of ${fmt(needs.totalLife)} covers ${dime.coverageRatio}% of your ${fmt(dime.total)} DIME need.`}
              detail={`Recommendation: Add a ${fmt(needs.lifeGap)} 20-year term policy. At age ${currentAge}, estimated premium is $${Math.round(needs.lifeGap / 1000 * 0.65)}–$${Math.round(needs.lifeGap / 1000 * 0.95)}/month for preferred rates.`}
              severity="warning"
              actionLabel="Compare Term Quotes"
              onAction={() => navigate("/chat")}
            />
          )}
          {!needs.hasDisability && (
            <CalculatorInsight
              title="No Disability Coverage"
              summary={`You're missing long-term disability insurance. If you can't work, you'd lose ${fmt(annualIncome)}/year in income.`}
              detail={`A disability event is 3-4x more likely than death before age 65. A policy covering 60% of income (${fmt(needs.disabilityNeeded)}/year) typically costs 1-3% of annual income.`}
              severity="warning"
            />
          )}
          {needs.lifeGap === 0 && needs.hasUmbrella && needs.hasDisability && (
            <CalculatorInsight
              title="All Major Coverage Gaps Closed"
              summary="Your insurance coverage adequately protects your income, assets, and family. Review annually or after major life changes."
              severity="success"
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
    </AppShell>
  );
}
