/**
 * InsuranceAnalysis — Insurance needs analysis wired to UWE premium
 * estimation engine. Users configure their profile and see real premium
 * estimates + coverage gap analysis via calculatorEngine.uweEstPrem.
 */
import { SEOHead } from "@/components/SEOHead";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Shield, Heart, Home, Car, Umbrella, CheckCircle2, Loader2, Calculator } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState } from "react";

function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

const ICON_MAP: Record<string, any> = { heart: Heart, shield: Shield, home: Home, car: Car, umbrella: Umbrella };

interface CoverageItem {
  id: string;
  type: string;
  icon: string;
  productType: "term" | "iul" | "wl" | "di" | "ltc";
  currentAmount: number;
  recommendedAmount: number;
  carrier: string;
}

const DEFAULT_COVERAGE: CoverageItem[] = [
  { id: "life", type: "Life Insurance (Term)", icon: "heart", productType: "term", currentAmount: 500000, recommendedAmount: 1200000, carrier: "Northwestern Mutual" },
  { id: "iul", type: "IUL (Cash Value)", icon: "shield", productType: "iul", currentAmount: 0, recommendedAmount: 500000, carrier: "Penn Mutual" },
  { id: "di", type: "Disability Income", icon: "shield", productType: "di", currentAmount: 0, recommendedAmount: 72000, carrier: "Guardian" },
  { id: "ltc", type: "Long-Term Care", icon: "shield", productType: "ltc", currentAmount: 0, recommendedAmount: 150000, carrier: "Lincoln" },
];

export default function InsuranceAnalysis() {
  const [, navigate] = useLocation();
  const [age, setAge] = useState(41);
  const [income, setIncome] = useState(150000);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);

  // UWE premium estimation queries
  const termPrem = trpc.calculatorEngine.uweEstPrem.useQuery(
    { type: "term", age, face: coverage.find(c => c.id === "life")?.recommendedAmount ?? 1200000 },
    { retry: false },
  );
  const iulPrem = trpc.calculatorEngine.uweEstPrem.useQuery(
    { type: "iul", age, face: coverage.find(c => c.id === "iul")?.recommendedAmount ?? 500000 },
    { retry: false },
  );
  const diPrem = trpc.calculatorEngine.uweEstPrem.useQuery(
    { type: "di", age, face: Math.round(income * 0.6) },
    { retry: false },
  );
  const ltcPrem = trpc.calculatorEngine.uweEstPrem.useQuery(
    { type: "ltc", age, face: coverage.find(c => c.id === "ltc")?.recommendedAmount ?? 150000 },
    { retry: false },
  );

  const premiums: Record<string, number> = {
    life: termPrem.data?.premium ?? 0,
    iul: iulPrem.data?.premium ?? 0,
    di: diPrem.data?.premium ?? 0,
    ltc: ltcPrem.data?.premium ?? 0,
  };

  const totalAnnualPremium = Object.values(premiums).reduce((s, p) => s + p, 0);
  const gapCount = coverage.filter(c => c.currentAmount < c.recommendedAmount).length;
  const coverageScore = coverage.length > 0
    ? Math.round(coverage.reduce((s, c) => s + Math.min(1, c.currentAmount / (c.recommendedAmount || 1)), 0) / coverage.length * 100)
    : 0;

  function updateCoverage(id: string, field: "currentAmount" | "recommendedAmount", value: number) {
    setCoverage(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  }

  return (
    <AppShell title="Insurance Analysis">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Insurance Analysis" description="Insurance needs analysis powered by UWE premium estimation" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Insurance Analysis</h1>
            <p className="text-sm text-muted-foreground">Coverage assessment with real premium estimates from the UWE engine</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Coverage Score</p>
          <p className={`text-lg font-semibold ${coverageScore >= 80 ? "text-emerald-400" : coverageScore >= 50 ? "text-amber-400" : "text-red-400"}`}>{coverageScore}%</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Gaps Found</p>
          <p className="text-lg font-semibold">{gapCount}</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Est. Annual Premiums</p>
          <p className="text-lg font-semibold tabular-nums">{fmt(totalAnnualPremium)}</p>
          <p className="text-[10px] text-muted-foreground">{fmt(Math.round(totalAnnualPremium / 12))}/mo</p>
        </CardContent></Card>
        <Card className="bg-card/60 border-border/50"><CardContent className="p-3">
          <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Premium/Income</p>
          <p className="text-lg font-semibold tabular-nums">{income > 0 ? (totalAnnualPremium / income * 100).toFixed(1) : 0}%</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile inputs */}
        <Card className="bg-card/60 border-border/50">
          <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="w-4 h-4 text-accent" /> Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label className="text-xs text-muted-foreground">Age</Label>
              <Input type="number" value={age} onChange={e => setAge(Number(e.target.value))} className="h-8 text-sm" /></div>
            <div><Label className="text-xs text-muted-foreground">Annual Income</Label>
              <Input type="number" value={income} onChange={e => setIncome(Number(e.target.value))} className="h-8 text-sm" /></div>
            <div className="border-t border-border/50 pt-3 space-y-3">
              <p className="text-xs font-medium">Coverage Amounts</p>
              {coverage.map(c => (
                <div key={c.id} className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">{c.type}</Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[9px] text-muted-foreground/60">Current</span>
                      <Input type="number" value={c.currentAmount} onChange={e => updateCoverage(c.id, "currentAmount", Number(e.target.value))} className="h-7 text-xs" />
                    </div>
                    <div>
                      <span className="text-[9px] text-muted-foreground/60">Recommended</span>
                      <Input type="number" value={c.recommendedAmount} onChange={e => updateCoverage(c.id, "recommendedAmount", Number(e.target.value))} className="h-7 text-xs" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Coverage analysis */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage Overview + Premium Estimates</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-4">
                {coverage.map(c => {
                  const Icon = ICON_MAP[c.icon] || Shield;
                  const pct = c.recommendedAmount > 0 ? Math.min(100, Math.round(c.currentAmount / c.recommendedAmount * 100)) : 100;
                  const status = pct >= 100 ? "adequate" : pct > 0 ? "gap" : "missing";
                  const premium = premiums[c.id] ?? 0;
                  return (
                    <div key={c.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{c.type}</span>
                          {status === "adequate" && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">Adequate</Badge>}
                          {status === "gap" && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Gap</Badge>}
                          {status === "missing" && <Badge variant="outline" className="text-[10px] text-red-400 border-red-500/30">Missing</Badge>}
                        </div>
                        <div className="text-right text-xs">
                          <span className="text-muted-foreground">{c.carrier}</span>
                          {premium > 0 && <span className="ml-2 font-mono text-accent">{fmt(Math.round(premium / 12))}/mo</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-24 text-right">
                          {fmt(c.currentAmount)} / {fmt(c.recommendedAmount)}
                        </span>
                      </div>
                      {premium > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          UWE estimated premium: {fmt(premium)}/yr ({fmt(Math.round(premium / 12))}/mo) for age {age}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-3 border-t border-border flex justify-between text-sm font-medium">
                <span>Total Annual Premiums</span>
                <span className="font-mono">{fmt(totalAnnualPremium)}/yr</span>
              </div>
            </CardContent>
          </Card>

          {gapCount > 0 && (
            <CalculatorInsight
              title={`${gapCount} Coverage Gap${gapCount > 1 ? "s" : ""} Detected`}
              summary={`Your current coverage falls short of recommendations in ${gapCount} area${gapCount > 1 ? "s" : ""}. Review the gaps above and consider filling the highest-priority items first.`}
              detail="Life insurance and disability income are typically the highest-priority gaps for income earners with dependents. Long-term care becomes critical after age 50."
              severity="warning"
              actionLabel="Discuss with AI Advisor"
              onAction={() => navigate("/chat")}
            />
          )}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Premium estimates are illustrative based on industry averages. Actual premiums vary by health, underwriting, and carrier.
      </p>
    </div>
    </AppShell>
  );
}
