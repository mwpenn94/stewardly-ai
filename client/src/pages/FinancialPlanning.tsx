import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, TrendingUp, Target, DollarSign, RefreshCw,
  ChevronDown, ChevronUp, PiggyBank, Shield, Loader2,
  BarChart3, Percent, Calendar, Plus, Trash2, CheckCircle,
} from "lucide-react";

// ─── Monte Carlo Simulation ────────────────────────────────────────────
function runMonteCarlo(params: {
  currentSavings: number;
  annualContribution: number;
  yearsToRetirement: number;
  annualWithdrawal: number;
  yearsInRetirement: number;
  avgReturn: number;
  stdDev: number;
  trials: number;
}) {
  const { currentSavings, annualContribution, yearsToRetirement, annualWithdrawal, yearsInRetirement, avgReturn, stdDev, trials } = params;
  const results: number[] = [];
  const yearlyMedian: number[] = [];
  const yearly10th: number[] = [];
  const yearly90th: number[] = [];
  const totalYears = yearsToRetirement + yearsInRetirement;
  const yearlyValues: number[][] = Array.from({ length: totalYears }, () => []);

  for (let t = 0; t < trials; t++) {
    let balance = currentSavings;
    for (let y = 0; y < totalYears; y++) {
      // Box-Muller for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const annualReturn = avgReturn + stdDev * z;
      balance *= (1 + annualReturn);
      if (y < yearsToRetirement) {
        balance += annualContribution;
      } else {
        balance -= annualWithdrawal;
      }
      balance = Math.max(0, balance);
      yearlyValues[y].push(balance);
    }
    results.push(balance);
  }

  // Calculate percentiles per year
  for (let y = 0; y < totalYears; y++) {
    const sorted = yearlyValues[y].sort((a, b) => a - b);
    yearly10th.push(sorted[Math.floor(trials * 0.1)]);
    yearlyMedian.push(sorted[Math.floor(trials * 0.5)]);
    yearly90th.push(sorted[Math.floor(trials * 0.9)]);
  }

  const sorted = results.sort((a, b) => a - b);
  const successCount = results.filter(r => r > 0).length;

  return {
    successRate: (successCount / trials) * 100,
    p10: sorted[Math.floor(trials * 0.1)],
    p50: sorted[Math.floor(trials * 0.5)],
    p90: sorted[Math.floor(trials * 0.9)],
    yearly10th,
    yearlyMedian,
    yearly90th,
    totalYears,
  };
}

// ─── Social Security Calculator ────────────────────────────────────────
function calcSocialSecurity(fra: number, fraMonthly: number) {
  const at62 = fraMonthly * (1 - 0.0667 * Math.min(3, fra - 62) - 0.05 * Math.max(0, fra - 62 - 3));
  const at67 = fra <= 67 ? fraMonthly * (1 + 0.08 * (67 - fra)) : fraMonthly * (1 - 0.0667 * Math.min(3, fra - 67));
  const at70 = fraMonthly * (1 + 0.08 * (70 - fra));
  return { at62: Math.round(at62), atFRA: Math.round(fraMonthly), at67: Math.round(at67), at70: Math.round(at70) };
}

function cumulativeBenefit(monthly: number, startAge: number, endAge: number) {
  return monthly * 12 * (endAge - startAge);
}

// ─── Format helpers ────────────────────────────────────────────────────
const fmt = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
const fmtPct = (n: number) => `${n.toFixed(1)}%`;

// ─── Main Component ────────────────────────────────────────────────────
export default function FinancialPlanning() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("retirement");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">Financial Planning</h1>
            <p className="text-xs text-muted-foreground">Projections, simulations, and goal tracking</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="retirement" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Retirement</TabsTrigger>
            <TabsTrigger value="social-security" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> Social Security</TabsTrigger>
            <TabsTrigger value="roth" className="gap-1.5"><Percent className="w-3.5 h-3.5" /> Roth Conversion</TabsTrigger>
            <TabsTrigger value="goals" className="gap-1.5"><Target className="w-3.5 h-3.5" /> Goals</TabsTrigger>
          </TabsList>

          <TabsContent value="retirement"><RetirementProjection /></TabsContent>
          <TabsContent value="social-security"><SocialSecurityOptimizer /></TabsContent>
          <TabsContent value="roth"><RothConversion /></TabsContent>
          <TabsContent value="goals"><GoalTracker /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── Retirement Projection (Monte Carlo) ───────────────────────────────
function RetirementProjection() {
  const [params, setParams] = useState({
    currentSavings: 500000,
    annualContribution: 25000,
    yearsToRetirement: 20,
    annualWithdrawal: 60000,
    yearsInRetirement: 30,
    avgReturn: 0.07,
    stdDev: 0.15,
  });
  const [results, setResults] = useState<ReturnType<typeof runMonteCarlo> | null>(null);
  const [running, setRunning] = useState(false);
  const [scenario2, setScenario2] = useState<ReturnType<typeof runMonteCarlo> | null>(null);
  const [showScenario2, setShowScenario2] = useState(false);
  const [params2, setParams2] = useState({ ...params, yearsToRetirement: 25 });

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const r = runMonteCarlo({ ...params, trials: 1000 });
      setResults(r);
      if (showScenario2) {
        const r2 = runMonteCarlo({ ...params2, trials: 1000 });
        setScenario2(r2);
      }
      setRunning(false);
    }, 100);
  }, [params, params2, showScenario2]);

  const successColor = (rate: number) => rate >= 80 ? "text-emerald-400" : rate >= 60 ? "text-amber-400" : "text-red-400";

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><PiggyBank className="w-4 h-4" /> Scenario 1</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Current Savings</Label>
                <Input type="number" value={params.currentSavings} onChange={e => setParams(p => ({ ...p, currentSavings: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Annual Contribution</Label>
                <Input type="number" value={params.annualContribution} onChange={e => setParams(p => ({ ...p, annualContribution: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Years to Retirement</Label>
                <Input type="number" value={params.yearsToRetirement} onChange={e => setParams(p => ({ ...p, yearsToRetirement: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Annual Withdrawal</Label>
                <Input type="number" value={params.annualWithdrawal} onChange={e => setParams(p => ({ ...p, annualWithdrawal: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Years in Retirement</Label>
                <Input type="number" value={params.yearsInRetirement} onChange={e => setParams(p => ({ ...p, yearsInRetirement: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Avg Return (%)</Label>
                <Input type="number" step="0.01" value={(params.avgReturn * 100).toFixed(1)} onChange={e => setParams(p => ({ ...p, avgReturn: +e.target.value / 100 }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={run} disabled={running} className="flex-1 gap-1.5">
                {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Run 1,000 Simulations
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowScenario2(!showScenario2)}>
                {showScenario2 ? <ChevronUp className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Scenario 2 */}
        {showScenario2 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Scenario 2 (Compare)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Current Savings</Label>
                  <Input type="number" value={params2.currentSavings} onChange={e => setParams2(p => ({ ...p, currentSavings: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Annual Contribution</Label>
                  <Input type="number" value={params2.annualContribution} onChange={e => setParams2(p => ({ ...p, annualContribution: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Years to Retirement</Label>
                  <Input type="number" value={params2.yearsToRetirement} onChange={e => setParams2(p => ({ ...p, yearsToRetirement: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Annual Withdrawal</Label>
                  <Input type="number" value={params2.annualWithdrawal} onChange={e => setParams2(p => ({ ...p, annualWithdrawal: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Years in Retirement</Label>
                  <Input type="number" value={params2.yearsInRetirement} onChange={e => setParams2(p => ({ ...p, yearsInRetirement: +e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">Avg Return (%)</Label>
                  <Input type="number" step="0.01" value={(params2.avgReturn * 100).toFixed(1)} onChange={e => setParams2(p => ({ ...p, avgReturn: +e.target.value / 100 }))} />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className={`text-3xl font-bold font-mono tabular-nums ${successColor(results.successRate)}`}>{fmtPct(results.successRate)}</p>
                <p className="text-xs text-muted-foreground mt-1">Success Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-red-400">{fmt(results.p10)}</p>
                <p className="text-xs text-muted-foreground mt-1">10th Percentile</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-blue-400">{fmt(results.p50)}</p>
                <p className="text-xs text-muted-foreground mt-1">Median (50th)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xl font-bold text-emerald-400">{fmt(results.p90)}</p>
                <p className="text-xs text-muted-foreground mt-1">90th Percentile</p>
              </CardContent>
            </Card>
          </div>

          {/* Mini projection chart */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-3">Portfolio Projection (1,000 trials)</p>
              <div className="h-48 flex items-end gap-px">
                {results.yearlyMedian.map((val, i) => {
                  const maxVal = Math.max(...results.yearly90th);
                  const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
                  const h10 = maxVal > 0 ? (results.yearly10th[i] / maxVal) * 100 : 0;
                  const h90 = maxVal > 0 ? (results.yearly90th[i] / maxVal) * 100 : 0;
                  const isRetirement = i === params.yearsToRetirement;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center justify-end relative group" title={`Year ${i + 1}: ${fmt(val)}`}>
                      <div className="w-full bg-blue-500/10 rounded-t" style={{ height: `${h90}%` }}>
                        <div className="w-full bg-blue-500/30 rounded-t absolute bottom-0" style={{ height: `${h}%` }}>
                          <div className="w-full bg-blue-500/10 rounded-t absolute bottom-0" style={{ height: `${h10 > 0 ? (h10 / h) * 100 : 0}%` }} />
                        </div>
                      </div>
                      {isRetirement && <div className="absolute top-0 w-px h-full bg-amber-500/50" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>Year 1</span>
                <span className="text-amber-400">Retirement (Year {params.yearsToRetirement})</span>
                <span>Year {results.totalYears}</span>
              </div>
            </CardContent>
          </Card>

          {/* Scenario comparison */}
          {scenario2 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scenario Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Metric</p>
                    <p className="text-xs font-medium">Success Rate</p>
                    <p className="text-xs font-medium">Median End</p>
                    <p className="text-xs font-medium">10th Pctile</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Scenario 1</p>
                    <p className={`text-xs font-bold ${successColor(results.successRate)}`}>{fmtPct(results.successRate)}</p>
                    <p className="text-xs">{fmt(results.p50)}</p>
                    <p className="text-xs">{fmt(results.p10)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Scenario 2</p>
                    <p className={`text-xs font-bold ${successColor(scenario2.successRate)}`}>{fmtPct(scenario2.successRate)}</p>
                    <p className="text-xs">{fmt(scenario2.p50)}</p>
                    <p className="text-xs">{fmt(scenario2.p10)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Social Security Optimizer ─────────────────────────────────────────
function SocialSecurityOptimizer() {
  const [fra, setFra] = useState(67);
  const [fraMonthly, setFraMonthly] = useState(2800);
  const [lifeExpectancy, setLifeExpectancy] = useState(85);

  const ss = useMemo(() => calcSocialSecurity(fra, fraMonthly), [fra, fraMonthly]);
  const cumulative = useMemo(() => ({
    at62: cumulativeBenefit(ss.at62, 62, lifeExpectancy),
    atFRA: cumulativeBenefit(ss.atFRA, fra, lifeExpectancy),
    at70: cumulativeBenefit(ss.at70, 70, lifeExpectancy),
  }), [ss, fra, lifeExpectancy]);

  const maxCum = Math.max(cumulative.at62, cumulative.atFRA, cumulative.at70);
  const bestAge = cumulative.at70 >= cumulative.atFRA && cumulative.at70 >= cumulative.at62 ? 70 : cumulative.atFRA >= cumulative.at62 ? fra : 62;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Full Retirement Age (FRA)</Label>
          <Input type="number" min={62} max={70} value={fra} onChange={e => setFra(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Monthly Benefit at FRA ($)</Label>
          <Input type="number" value={fraMonthly} onChange={e => setFraMonthly(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Life Expectancy</Label>
          <Input type="number" min={62} max={100} value={lifeExpectancy} onChange={e => setLifeExpectancy(+e.target.value)} />
        </div>
      </div>

      {/* Monthly Benefits */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { age: 62, key: "early-62", monthly: ss.at62, label: "Age 62 (Early)" },
          { age: fra, key: "fra", monthly: ss.atFRA, label: `Age ${fra} (FRA)` },
          { age: 67, key: "age-67", monthly: ss.at67, label: "Age 67" },
          { age: 70, key: "max-70", monthly: ss.at70, label: "Age 70 (Max)" },
        ].filter((item, i, arr) => {
          // Remove "Age 67" card if FRA is already 67 to avoid duplicate
          if (item.key === "age-67" && fra === 67) return false;
          return true;
        }).map(item => (
          <Card key={item.key} className={item.age === bestAge ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className={`text-xl font-bold mt-1 ${item.age === bestAge ? "text-emerald-400" : ""}`}>{fmt(item.monthly)}/mo</p>
              {item.age === bestAge && <Badge className="mt-1 text-[10px] bg-emerald-500/10 text-emerald-400">Best for you</Badge>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cumulative Benefit Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Cumulative Lifetime Benefits (to age {lifeExpectancy})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: `Claim at 62`, value: cumulative.at62, color: "bg-red-500" },
            { label: `Claim at ${fra} (FRA)`, value: cumulative.atFRA, color: "bg-blue-500" },
            { label: `Claim at 70`, value: cumulative.at70, color: "bg-emerald-500" },
          ].map(item => (
            <div key={item.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{item.label}</span>
                <span className="font-medium">{fmt(item.value)}</span>
              </div>
              <div className="h-3 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full transition-all`} style={{ width: `${(item.value / maxCum) * 100}%` }} />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-2">
            Breakeven: Claiming at 70 surpasses claiming at 62 around age {Math.round(62 + (ss.at70 * (70 - 62) * 12) / ((ss.at70 - ss.at62) * 12))}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roth Conversion Analysis ──────────────────────────────────────────
function RothConversion() {
  const [traditionalBalance, setTraditionalBalance] = useState(500000);
  const [conversionAmount, setConversionAmount] = useState(50000);
  const [currentTaxRate, setCurrentTaxRate] = useState(24);
  const [futureTaxRate, setFutureTaxRate] = useState(32);
  const [yearsUntilWithdrawal, setYearsUntilWithdrawal] = useState(15);
  const [avgReturn, setAvgReturn] = useState(7);

  const analysis = useMemo(() => {
    const growth = Math.pow(1 + avgReturn / 100, yearsUntilWithdrawal);
    const taxOnConversion = conversionAmount * (currentTaxRate / 100);
    const rothFutureValue = conversionAmount * growth;
    const traditionalFutureValue = conversionAmount * growth;
    const taxOnTraditional = traditionalFutureValue * (futureTaxRate / 100);
    const rothNet = rothFutureValue; // Already taxed
    const traditionalNet = traditionalFutureValue - taxOnTraditional;
    const benefit = rothNet - traditionalNet - taxOnConversion;
    const breakEvenRate = currentTaxRate; // Simplified
    const irmaaThreshold = 206000; // 2024 IRMAA threshold (married)
    const irmaaRisk = conversionAmount > irmaaThreshold * 0.5;

    return {
      taxOnConversion,
      rothFutureValue,
      traditionalFutureValue,
      taxOnTraditional,
      rothNet,
      traditionalNet,
      benefit,
      breakEvenRate,
      irmaaRisk,
      worthIt: benefit > 0,
    };
  }, [traditionalBalance, conversionAmount, currentTaxRate, futureTaxRate, yearsUntilWithdrawal, avgReturn]);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Traditional IRA Balance</Label>
          <Input type="number" value={traditionalBalance} onChange={e => setTraditionalBalance(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Conversion Amount</Label>
          <Input type="number" value={conversionAmount} onChange={e => setConversionAmount(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Current Tax Rate (%)</Label>
          <Input type="number" value={currentTaxRate} onChange={e => setCurrentTaxRate(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Expected Future Tax Rate (%)</Label>
          <Input type="number" value={futureTaxRate} onChange={e => setFutureTaxRate(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Years Until Withdrawal</Label>
          <Input type="number" value={yearsUntilWithdrawal} onChange={e => setYearsUntilWithdrawal(+e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Avg Annual Return (%)</Label>
          <Input type="number" value={avgReturn} onChange={e => setAvgReturn(+e.target.value)} />
        </div>
      </div>

      {/* Verdict */}
      <Card className={analysis.worthIt ? "border-emerald-500/30 bg-emerald-500/5" : "border-amber-500/30 bg-amber-500/5"}>
        <CardContent className="p-6 text-center">
          <div className={`inline-flex items-center gap-2 text-lg font-bold ${analysis.worthIt ? "text-emerald-400" : "text-amber-400"}`}>
            {analysis.worthIt ? <CheckCircle className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            {analysis.worthIt ? "Conversion Recommended" : "Consider Waiting"}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Net benefit over {yearsUntilWithdrawal} years: <span className={`font-bold ${analysis.benefit > 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(analysis.benefit)}</span>
          </p>
        </CardContent>
      </Card>

      {/* Comparison */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-400">Convert to Roth</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tax paid now</span><span className="text-red-400">-{fmt(analysis.taxOnConversion)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Future value</span><span>{fmt(analysis.rothFutureValue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax on withdrawal</span><span className="text-emerald-400">$0</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-2"><span>Net after tax</span><span>{fmt(analysis.rothNet - analysis.taxOnConversion)}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-amber-400">Keep Traditional</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Tax paid now</span><span className="text-emerald-400">$0</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Future value</span><span>{fmt(analysis.traditionalFutureValue)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax on withdrawal</span><span className="text-red-400">-{fmt(analysis.taxOnTraditional)}</span></div>
            <div className="flex justify-between font-bold border-t border-border pt-2"><span>Net after tax</span><span>{fmt(analysis.traditionalNet)}</span></div>
          </CardContent>
        </Card>
      </div>

      {analysis.irmaaRisk && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">IRMAA Warning</p>
              <p className="text-xs text-muted-foreground">This conversion amount may push your MAGI above the IRMAA threshold, resulting in higher Medicare Part B/D premiums. Consider splitting the conversion across multiple tax years.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Goal Tracker ──────────────────────────────────────────────────────
function GoalTracker() {
  const [goals, setGoals] = useState([
    { id: 1, name: "Emergency Fund", target: 30000, current: 22500, deadline: "2025-12-31", category: "savings" },
    { id: 2, name: "Down Payment", target: 100000, current: 45000, deadline: "2027-06-30", category: "housing" },
    { id: 3, name: "Retirement (65)", target: 2000000, current: 500000, deadline: "2050-01-01", category: "retirement" },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newGoal, setNewGoal] = useState({ name: "", target: 0, current: 0, deadline: "", category: "savings" });

  const addGoal = () => {
    if (!newGoal.name || newGoal.target <= 0) return;
    setGoals(prev => [...prev, { ...newGoal, id: Date.now() }]);
    setNewGoal({ name: "", target: 0, current: 0, deadline: "", category: "savings" });
    setShowAdd(false);
  };

  const removeGoal = (id: number) => setGoals(prev => prev.filter(g => g.id !== id));

  const updateGoalCurrent = (id: number, current: number) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current } : g));
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Track progress toward your financial milestones</p>
        <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Goal
        </Button>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Goal Name</Label>
                <Input value={newGoal.name} onChange={e => setNewGoal(p => ({ ...p, name: e.target.value }))} placeholder="e.g., Vacation Fund" />
              </div>
              <div>
                <Label className="text-xs">Target Amount</Label>
                <Input type="number" value={newGoal.target || ""} onChange={e => setNewGoal(p => ({ ...p, target: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Current Amount</Label>
                <Input type="number" value={newGoal.current || ""} onChange={e => setNewGoal(p => ({ ...p, current: +e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Deadline</Label>
                <Input type="date" value={newGoal.deadline} onChange={e => setNewGoal(p => ({ ...p, deadline: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addGoal}>Save Goal</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {goals.map(goal => {
          const progress = Math.min(100, (goal.current / goal.target) * 100);
          const remaining = goal.target - goal.current;
          const daysLeft = goal.deadline ? Math.max(0, Math.ceil((new Date(goal.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;
          const monthlyNeeded = daysLeft && daysLeft > 0 ? remaining / (daysLeft / 30) : 0;
          const isComplete = progress >= 100;

          return (
            <Card key={goal.id} className={isComplete ? "border-emerald-500/30 bg-emerald-500/5" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm">{goal.name}</h3>
                      {isComplete && <Badge className="text-[10px] bg-emerald-500/10 text-emerald-400">Complete</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {fmt(goal.current)} of {fmt(goal.target)}
                      {daysLeft !== null && ` · ${daysLeft} days left`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-24 h-7 text-xs"
                      value={goal.current}
                      onChange={e => updateGoalCurrent(goal.id, +e.target.value)}
                    />
                    <Button variant="ghost" size="icon-sm" onClick={() => removeGoal(goal.id)}>
                      <Trash2 className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>{fmtPct(progress)} complete</span>
                  {!isComplete && monthlyNeeded > 0 && <span>{fmt(monthlyNeeded)}/month needed</span>}
                  {!isComplete && <span>{fmt(remaining)} remaining</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
