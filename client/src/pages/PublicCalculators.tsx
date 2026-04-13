/**
 * PublicCalculators — Public-facing financial calculators with lead capture.
 * Embeddable calculators for retirement, tax, insurance, and estate planning.
 *
 * Pass 8 history: now wires the shared financial profile store via
 * useFinancialProfile so guest visitors build a profile as they use
 * the calculators. The profile is localStorage-only for guests (the
 * server sync is gated on isAuthenticated inside the hook) so nothing
 * leaks to the backend until a user signs up.
 */
import { useState, useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, DollarSign, PiggyBank, TrendingUp, Shield, Heart, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import type { FinancialProfile } from "@/stores/financialProfile";

function RetirementCalculator() {
  const { profile, updateProfile } = useFinancialProfile();
  const [age, setAge] = useState(profile.age ?? 35);
  const [retireAge, setRetireAge] = useState(profile.retirementAge ?? 65);
  const [savings, setSavings] = useState(profile.savings ?? 250000);
  const [monthly, setMonthly] = useState(profile.monthlySavings ?? 1500);
  const [result, setResult] = useState<number | null>(null);

  // Late hydration: when the profile loads after mount (e.g.,
  // localStorage is slow on first paint), apply its values once.
  useEffect(() => {
    if (profile.age !== undefined) setAge(profile.age);
    if (profile.retirementAge !== undefined) setRetireAge(profile.retirementAge);
    if (profile.savings !== undefined) setSavings(profile.savings);
    if (profile.monthlySavings !== undefined) setMonthly(profile.monthlySavings);
    // Only run on the very first render after hydration. The hook's
    // setters are stable so re-runs are cheap if it fires again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.lastUpdated]);

  const handlePrefill = (p: FinancialProfile) => {
    if (p.age !== undefined) setAge(p.age);
    if (p.retirementAge !== undefined) setRetireAge(p.retirementAge);
    if (p.savings !== undefined) setSavings(p.savings);
    if (p.monthlySavings !== undefined) setMonthly(p.monthlySavings);
  };

  const calculate = () => {
    // Persist the current inputs to the profile so the Tax /
    // Insurance / Social Security tabs can reuse them without
    // asking again. Source "user" since this is a direct edit.
    updateProfile({
      age,
      retirementAge: retireAge,
      savings,
      monthlySavings: monthly,
    });
    const years = retireAge - age;
    const rate = 0.07 / 12;
    const months = years * 12;
    const fv = savings * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate);
    setResult(Math.round(fv));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><PiggyBank className="h-4 w-4" /> Retirement Savings Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FinancialProfileBanner
          onPrefill={handlePrefill}
          usesFields={["age", "retirementAge", "savings", "monthlySavings"]}
        />
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Current Age</Label><Input type="number" value={age} onChange={e => setAge(+e.target.value)} /></div>
          <div><Label className="text-xs">Retirement Age</Label><Input type="number" value={retireAge} onChange={e => setRetireAge(+e.target.value)} /></div>
          <div><Label className="text-xs">Current Savings ($)</Label><Input type="number" value={savings} onChange={e => setSavings(+e.target.value)} /></div>
          <div><Label className="text-xs">Monthly Contribution ($)</Label><Input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)} /></div>
        </div>
        <Button onClick={calculate} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button>
        {result !== null && (
          <div className="p-3 bg-muted/30 rounded-lg text-center">
            <p className="text-xs text-muted-foreground">Projected Retirement Savings</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-primary">${result.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">Assuming 7% average annual return</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TaxBracketCalculator() {
  const { profile, updateProfile } = useFinancialProfile();
  const [income, setIncome] = useState(profile.income ?? 150000);
  const [result, setResult] = useState<{ effective: string; marginal: string; tax: number; marginalRate: number } | null>(null);

  useEffect(() => {
    if (profile.income !== undefined) setIncome(profile.income);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.lastUpdated]);

  const handlePrefill = (p: FinancialProfile) => {
    if (p.income !== undefined) setIncome(p.income);
  };

  const calculate = () => {
    const brackets = [
      { min: 0, max: 23850, rate: 0.10 },
      { min: 23850, max: 96950, rate: 0.12 },
      { min: 96950, max: 206700, rate: 0.22 },
      { min: 206700, max: 394600, rate: 0.24 },
      { min: 394600, max: 501050, rate: 0.32 },
      { min: 501050, max: 751600, rate: 0.35 },
      { min: 751600, max: Infinity, rate: 0.37 },
    ];
    let tax = 0;
    let marginal = "10%";
    let marginalRate = 0.1;
    for (const b of brackets) {
      if (income > b.min) {
        const taxable = Math.min(income, b.max) - b.min;
        tax += taxable * b.rate;
        marginal = `${b.rate * 100}%`;
        marginalRate = b.rate;
      }
    }
    // Persist the income + derived marginal rate to the shared
    // profile so every downstream calc reuses them automatically.
    updateProfile({ income, marginalRate, filingStatus: "mfj" });
    setResult({ effective: `${(tax / income * 100).toFixed(1)}%`, marginal, tax: Math.round(tax), marginalRate });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4" /> Tax Bracket Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FinancialProfileBanner
          onPrefill={handlePrefill}
          usesFields={["income", "marginalRate"]}
        />
        <div><Label className="text-xs">Taxable Income (MFJ)</Label><Input type="number" value={income} onChange={e => setIncome(+e.target.value)} /></div>
        <Button onClick={calculate} className="w-full"><Calculator className="h-4 w-4 mr-1" /> Calculate</Button>
        {result && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Federal Tax</p>
              <p className="text-lg font-bold">${result.tax.toLocaleString()}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Effective Rate</p>
              <p className="text-lg font-bold">{result.effective}</p>
            </div>
            <div className="p-2 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Marginal Rate</p>
              <p className="text-lg font-bold">{result.marginal}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PublicCalculators() {
  const [gated, setGated] = useState(false);
  const [, navigate] = useLocation();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Financial Calculators" description="Free financial planning calculators for retirement, tax, and insurance analysis" />

      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Financial Calculators</h1>
        <p className="text-muted-foreground max-w-lg mx-auto">Free tools to help you plan your financial future. Get personalized results and expert insights.</p>
      </div>

      <Tabs defaultValue="retirement">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="retirement">Retirement</TabsTrigger>
          <TabsTrigger value="tax">Tax Brackets</TabsTrigger>
        </TabsList>

        <TabsContent value="retirement" className="mt-4">
          <RetirementCalculator />
        </TabsContent>
        <TabsContent value="tax" className="mt-4">
          <TaxBracketCalculator />
        </TabsContent>
      </Tabs>

      {!gated && (
        <LeadCaptureGate
          title="Get Your Personalized Financial Plan"
          description="Enter your email to receive a detailed analysis based on your calculator results, plus access to advanced planning tools."
          onCapture={(email) => {
            setGated(true);
            toast.success(`Analysis sent to ${email}`);
          }}
        >
          <div className="text-sm text-muted-foreground text-center p-4">Advanced planning tools and personalized analysis will appear here.</div>
        </LeadCaptureGate>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Shield, title: "Insurance Needs", desc: "Calculate your coverage gaps", href: "/insurance-analysis" },
          { icon: Heart, title: "Medicare Costs", desc: "Estimate IRMAA surcharges", href: "/medicare" },
          { icon: TrendingUp, title: "Social Security", desc: "Optimize claiming strategy", href: "/social-security" },
        ].map(c => (
          <Card key={c.title} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(c.href)}>
            <CardContent className="p-4 flex items-center gap-3">
              <c.icon className="h-8 w-8 text-primary/60" />
              <div>
                <p className="text-sm font-medium">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.desc}</p>
              </div>
              <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
