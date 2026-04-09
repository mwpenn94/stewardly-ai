/**
 * Model Results Dashboard
 * Visualizes outputs from all 8 analytical models with interactive charts.
 * Users can run models on-demand and view historical results.
 */
import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Play, Loader2, TrendingUp, PiggyBank, Scale, DollarSign,
  Shield, GraduationCap, BarChart3, Activity, Clock, CheckCircle2,
  XCircle, AlertTriangle, ChevronDown, ChevronUp, RefreshCw, FileDown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart, ReferenceLine,
} from "recharts";

// ─── UTILS ─────────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function pct(n: number, decimals = 1) {
  return `${(n * (n > 1 ? 1 : 100)).toFixed(decimals)}%`;
}
function fmtK(n: number) {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return fmt(n);
}

const COLORS = {
  primary: "oklch(0.68 0.16 230)",
  accent: "oklch(0.75 0.18 160)",
  warning: "oklch(0.80 0.15 80)",
  danger: "oklch(0.65 0.20 25)",
  muted: "oklch(0.55 0.02 250)",
  chart: ["#38bdf8", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#fb923c", "#2dd4bf", "#e879f9"],
};

// ─── MODEL CONFIGS ─────────────────────────────────────────────────
const MODEL_TABS = [
  { slug: "monte-carlo-retirement", label: "Retirement", icon: <PiggyBank className="w-4 h-4" />, shortLabel: "Retire" },
  { slug: "debt-optimization", label: "Debt Optimization", icon: <Scale className="w-4 h-4" />, shortLabel: "Debt" },
  { slug: "tax-optimization", label: "Tax Strategy", icon: <DollarSign className="w-4 h-4" />, shortLabel: "Tax" },
  { slug: "cash-flow-projection", label: "Cash Flow", icon: <TrendingUp className="w-4 h-4" />, shortLabel: "Cash" },
  { slug: "insurance-gap-analysis", label: "Insurance Gaps", icon: <Shield className="w-4 h-4" />, shortLabel: "Ins." },
  { slug: "estate-planning", label: "Estate Plan", icon: <BarChart3 className="w-4 h-4" />, shortLabel: "Estate" },
  { slug: "education-funding", label: "Education Fund", icon: <GraduationCap className="w-4 h-4" />, shortLabel: "Edu" },
  { slug: "risk-tolerance-assessment", label: "Risk Profile", icon: <Activity className="w-4 h-4" />, shortLabel: "Risk" },
];

// ─── STAT CARD ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: "success" | "warning" | "danger" | "default" }) {
  const colors = {
    success: "border-emerald-500/30 bg-emerald-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    danger: "border-red-500/30 bg-red-500/5",
    default: "border-border bg-secondary/30",
  };
  return (
    <div className={`rounded-lg border p-3 space-y-0.5 ${colors[variant || "default"]}`}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold font-mono tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── SCORE GAUGE ───────────────────────────────────────────────────
function ScoreGauge({ score, label, max = 100 }: { score: number; label: string; max?: number }) {
  const pctVal = Math.min(100, (score / max) * 100);
  const color = pctVal >= 70 ? "text-emerald-400" : pctVal >= 40 ? "text-amber-400" : "text-red-400";
  const bgColor = pctVal >= 70 ? "bg-emerald-400" : pctVal >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/20" />
          <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6"
            className={color}
            strokeDasharray={`${pctVal * 2.64} 264`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${color}`}>{Math.round(score)}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── RETIREMENT CHART ──────────────────────────────────────────────
function RetirementResults({ data }: { data: any }) {
  if (!data) return null;
  const chartData = (data.yearByYearMedian || []).map((d: any) => ({
    age: d.age,
    balance: d.balance,
  }));
  const successVariant = data.successRate >= 80 ? "success" : data.successRate >= 50 ? "warning" : "danger";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Success Rate" value={`${data.successRate?.toFixed(1)}%`} variant={successVariant} sub={`${data.simulations || 10000} simulations`} />
        <StatCard label="Median Ending Balance" value={fmtK(data.medianEndingBalance)} />
        <StatCard label="10th Percentile" value={fmtK(data.percentile10)} variant={data.percentile10 < 0 ? "danger" : "default"} />
        <StatCard label="90th Percentile" value={fmtK(data.percentile90)} variant="success" />
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Projected Balance by Age</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="retGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="age" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} labelFormatter={(l: string) => `Age ${l}`} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Area type="monotone" dataKey="balance" stroke="#38bdf8" fill="url(#retGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Balance at Retirement" value={fmtK(data.medianBalanceAtRetirement)} />
        <StatCard label="Additional Savings Needed" value={fmtK(data.recommendedAdditionalSavings)} variant={data.recommendedAdditionalSavings > 0 ? "warning" : "success"} />
        <StatCard label="Total Contributions" value={fmtK(data.totalContributions)} />
      </div>
    </div>
  );
}

// ─── DEBT OPTIMIZATION CHART ───────────────────────────────────────
function DebtResults({ data }: { data: any }) {
  if (!data) return null;
  const strategies = ["avalanche", "snowball", "hybrid"].filter(s => data[s]);
  const comparisonData = strategies.map(s => ({
    strategy: data[s].strategy || s.charAt(0).toUpperCase() + s.slice(1),
    totalInterest: data[s].totalInterestPaid,
    months: data[s].monthsToPayoff,
    totalPaid: data[s].totalPaid,
    saved: data[s].interestSaved,
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Debt" value={fmtK(data.totalDebt)} />
        <StatCard label="Weighted Avg Rate" value={`${(data.weightedAverageRate * 100).toFixed(1)}%`} />
        <StatCard label="Best Strategy" value={data.recommendation?.split(" ")[0] || "Avalanche"} variant="success" />
        <StatCard label="Min-Only Interest" value={fmtK(data.minimumOnly?.totalInterestPaid || 0)} variant="danger" />
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Strategy Comparison</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={comparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="strategy" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="totalInterest" name="Total Interest" fill="#f87171" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saved" name="Interest Saved" fill="#34d399" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {strategies.map(s => (
          <Card key={s} className="bg-card/50">
            <CardContent className="p-3 space-y-1">
              <p className="text-sm font-semibold capitalize">{data[s].strategy || s}</p>
              <p className="text-xs text-muted-foreground">Payoff in <strong>{data[s].monthsToPayoff}</strong> months</p>
              <p className="text-xs text-muted-foreground">Total paid: {fmtK(data[s].totalPaid)}</p>
              <p className="text-xs text-emerald-400">Saves {fmtK(data[s].interestSaved)} vs min-only</p>
              <p className="text-[10px] text-muted-foreground">Debt-free: {data[s].debtFreeDate}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── TAX OPTIMIZATION CHART ────────────────────────────────────────
function TaxResults({ data }: { data: any }) {
  if (!data) return null;
  const brackets = (data.bracketAnalysis || []).map((b: any) => ({
    bracket: b.bracket,
    rate: b.rate * 100,
    tax: b.taxInBracket,
    income: b.incomeInBracket,
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Tax Liability" value={fmtK(data.currentTaxLiability)} />
        <StatCard label="Effective Rate" value={`${(data.effectiveRate * 100).toFixed(1)}%`} />
        <StatCard label="Marginal Rate" value={`${(data.marginalRate * 100).toFixed(0)}%`} />
        <StatCard label="Total Savings" value={fmtK(data.totalOptimizedSavings)} variant="success" />
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Tax Bracket Analysis</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={brackets}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="bracket" tick={{ fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="income" name="Income in Bracket" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tax" name="Tax in Bracket" fill="#f87171" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-semibold">Roth Conversion</p>
            <Badge variant={data.rothConversion?.recommended ? "default" : "secondary"} className="text-[10px]">
              {data.rothConversion?.recommended ? "Recommended" : "Not Recommended"}
            </Badge>
            {data.rothConversion?.recommended && (
              <>
                <p className="text-xs text-muted-foreground">Optimal amount: {fmtK(data.rothConversion.optimalAmount)}</p>
                <p className="text-xs text-muted-foreground">20yr savings: {fmtK(data.rothConversion.projectedSavings20yr)}</p>
                <p className="text-xs text-muted-foreground">Break-even: {data.rothConversion.breakEvenYears} years</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-semibold">Retirement Optimization</p>
            <p className="text-xs text-muted-foreground">401k benefit: {fmtK(data.retirementOptimization?.current401kBenefit || 0)}</p>
            <p className="text-xs text-muted-foreground">Max contribution benefit: {fmtK(data.retirementOptimization?.maxContributionBenefit || 0)}</p>
            <p className="text-xs text-muted-foreground">HSA benefit: {fmtK(data.retirementOptimization?.hsaBenefit || 0)}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3 space-y-1">
            <p className="text-sm font-semibold">Deduction Strategy</p>
            <p className="text-xs text-muted-foreground">{data.standardVsItemized?.recommendation}</p>
            <p className="text-xs text-muted-foreground">Standard: {fmtK(data.standardVsItemized?.standard || 0)}</p>
            <p className="text-xs text-muted-foreground">Itemized: {fmtK(data.standardVsItemized?.itemized || 0)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── CASH FLOW CHART ───────────────────────────────────────────────
function CashFlowResults({ data }: { data: any }) {
  if (!data) return null;
  const projections = (data.monthlyProjections || []).map((p: any) => ({
    month: p.month,
    income: p.totalIncome,
    expenses: p.totalExpenses,
    net: p.netCashFlow,
    balance: p.cumulativeBalance,
  }));
  const s = data.summary || {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Avg Monthly Income" value={fmtK(s.averageMonthlyIncome || 0)} />
        <StatCard label="Avg Monthly Expenses" value={fmtK(s.averageMonthlyExpenses || 0)} />
        <StatCard label="Savings Rate" value={`${((s.savingsRate || 0) * 100).toFixed(1)}%`} variant={s.savingsRate >= 0.2 ? "success" : s.savingsRate >= 0.1 ? "warning" : "danger"} />
        <StatCard label="Projected End Balance" value={fmtK(s.projectedEndBalance || 0)} />
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Cash Flow Projection</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={projections}>
              <defs>
                <linearGradient id="cfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Legend />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="#38bdf8" fill="url(#cfGrad)" strokeWidth={2} />
              <Bar dataKey="income" name="Income" fill="#34d399" opacity={0.6} />
              <Bar dataKey="expenses" name="Expenses" fill="#f87171" opacity={0.6} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {(data.alerts || []).length > 0 && (
        <Card className="bg-card/50 border-amber-500/20">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Alerts</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.alerts.map((a: any, i: number) => (
              <p key={i} className={`text-xs ${a.type === "danger" ? "text-red-400" : "text-amber-400"}`}>
                Month {a.month}: {a.message}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── INSURANCE GAP CHART ───────────────────────────────────────────
function InsuranceResults({ data }: { data: any }) {
  if (!data) return null;
  const gaps = (data.gaps || []).map((g: any) => ({
    type: g.type,
    current: g.currentCoverage,
    recommended: g.recommendedCoverage,
    gap: g.gap,
    priority: g.priority,
    cost: g.estimatedAnnualCost,
  }));
  const priorityColors: Record<string, string> = { critical: "#f87171", high: "#fb923c", medium: "#fbbf24", low: "#34d399" };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 justify-center">
        <ScoreGauge score={data.overallScore || 0} label="Coverage Score" />
        <div className="space-y-1">
          <StatCard label="Annual Premiums" value={fmtK(data.totalAnnualPremiums || 0)} />
          <StatCard label="Premium/Income" value={`${((data.premiumToIncomeRatio || 0) * 100).toFixed(1)}%`} />
        </div>
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Coverage Gaps by Type</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={gaps} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <YAxis type="category" dataKey="type" tick={{ fontSize: 11, fill: "#888" }} width={100} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Legend />
              <Bar dataKey="current" name="Current" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              <Bar dataKey="recommended" name="Recommended" fill="#34d399" radius={[0, 4, 4, 0]} opacity={0.5} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="space-y-2">
        {gaps.map((g: any, i: number) => (
          <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
            <Badge variant="outline" className="text-[10px]" style={{ borderColor: priorityColors[g.priority], color: priorityColors[g.priority] }}>{g.priority}</Badge>
            <span className="text-sm font-medium flex-1 capitalize">{g.type.replace(/_/g, " ")}</span>
            <span className="text-xs text-muted-foreground">Gap: {fmtK(g.gap)}</span>
            <span className="text-xs text-muted-foreground">~{fmtK(g.cost)}/yr</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── ESTATE PLANNING CHART ─────────────────────────────────────────
function EstateResults({ data }: { data: any }) {
  if (!data) return null;
  const beneficiaries = (data.beneficiaryAnalysis || []).map((b: any) => ({
    name: b.beneficiary,
    value: b.totalValue,
    pct: b.percentOfEstate,
  }));
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gross Estate" value={fmtK(data.grossEstate)} />
        <StatCard label="Taxable Estate" value={fmtK(data.taxableEstate)} />
        <StatCard label="Federal Estate Tax" value={fmtK(data.federalEstateTax)} variant={data.federalEstateTax > 0 ? "danger" : "success"} />
        <StatCard label="Potential Savings" value={fmtK(data.totalPotentialSavings)} variant="success" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Beneficiary Distribution</CardTitle></CardHeader>
          <CardContent>
            {beneficiaries.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={beneficiaries} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, pct }: any) => `${name}: ${(pct * 100).toFixed(0)}%`}>
                    {beneficiaries.map((_: any, i: number) => (
                      <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">No beneficiary data</p>
            )}
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Strategies</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {(data.strategies || []).slice(0, 5).map((s: any, i: number) => (
              <div key={i} className="p-2 rounded-lg bg-secondary/30 space-y-0.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{s.strategy}</span>
                  <Badge variant="outline" className="text-[10px]">{s.complexity}</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground">{s.description}</p>
                <p className="text-[10px] text-emerald-400">Saves up to {fmtK(s.potentialSavings)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label="Exemption Used" value={fmtK(data.exemptionUsed)} />
        <StatCard label="Exemption Remaining" value={fmtK(data.exemptionRemaining)} variant={data.exemptionRemaining > 0 ? "success" : "warning"} />
        <StatCard label="Effective Estate Tax Rate" value={`${((data.effectiveEstateTaxRate || 0) * 100).toFixed(1)}%`} />
      </div>
    </div>
  );
}

// ─── EDUCATION FUNDING CHART ───────────────────────────────────────
function EducationResults({ data }: { data: any }) {
  if (!data) return null;
  const yearData = (data.yearByYear || []).map((y: any) => ({
    year: y.year,
    age: y.childAge,
    balance: y.balance,
    contribution: y.contribution,
    growth: y.growth,
    withdrawal: y.withdrawal || 0,
  }));
  const fundingPct = Math.min(100, data.fundingPercentage || 0);
  const fundingVariant = fundingPct >= 90 ? "success" : fundingPct >= 60 ? "warning" : "danger";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Projected Cost" value={fmtK(data.totalProjectedCost)} />
        <StatCard label="After Aid/Scholarships" value={fmtK(data.totalAfterAid)} />
        <StatCard label="529 Balance at Start" value={fmtK(data.projected529Balance)} />
        <StatCard label="Funding Gap" value={fmtK(data.fundingGap)} variant={data.fundingGap > 0 ? "danger" : "success"} />
      </div>
      <div className="flex items-center gap-4 justify-center">
        <ScoreGauge score={fundingPct} label="Funded" />
        <StatCard label="Monthly Needed to Close Gap" value={fmtK(data.monthlyNeeded || 0)} variant={data.monthlyNeeded > 0 ? "warning" : "success"} />
      </div>
      <Card className="bg-card/50">
        <CardHeader className="pb-2"><CardTitle className="text-sm">529 Balance Projection</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={yearData}>
              <defs>
                <linearGradient id="eduGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="age" tick={{ fontSize: 11, fill: "#888" }} label={{ value: "Child Age", position: "insideBottom", offset: -5, fontSize: 10, fill: "#888" }} />
              <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v: number) => fmtK(v)} />
              <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              <Area type="monotone" dataKey="balance" stroke="#a78bfa" fill="url(#eduGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      {(data.alternativeStrategies || []).length > 0 && (
        <Card className="bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Alternative Strategies</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {data.alternativeStrategies.map((s: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                <span className="text-xs">{s.strategy}</span>
                <span className="text-xs text-emerald-400">{s.impact > 0 ? "+" : ""}{fmtK(s.impact)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── RISK TOLERANCE CHART ──────────────────────────────────────────
function RiskResults({ data }: { data: any }) {
  if (!data) return null;
  const dims = data.dimensions || {};
  const radarData = Object.entries(dims).map(([key, val]: [string, any]) => ({
    dimension: key.charAt(0).toUpperCase() + key.slice(1),
    score: val.score,
    weight: val.weight * 100,
  }));
  const alloc = data.recommendedAllocation || {};
  const allocData = Object.entries(alloc).filter(([_, v]) => (v as number) > 0).map(([key, val]) => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    value: val as number,
  }));
  const categoryColors: Record<string, string> = {
    conservative: "text-blue-400",
    moderately_conservative: "text-cyan-400",
    moderate: "text-emerald-400",
    moderately_aggressive: "text-amber-400",
    aggressive: "text-red-400",
  };
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-6 justify-center flex-wrap">
        <ScoreGauge score={data.compositeScore || 0} label="Risk Score" />
        <div className="text-center space-y-1">
          <Badge className={`${categoryColors[data.category] || ""} text-sm`} variant="outline">
            {(data.category || "").replace(/_/g, " ")}
          </Badge>
          <p className="text-xs text-muted-foreground">Confidence: {data.confidenceLevel || 0}%</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Dimensions</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 10, fill: "#888" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9, fill: "#666" }} />
                <Radar name="Score" dataKey="score" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Allocation</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={allocData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }: any) => `${name}: ${value}%`}>
                  {allocData.map((_, i) => (
                    <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1a1a2e", border: "1px solid #333", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      {(data.warnings || []).length > 0 && (
        <Card className="bg-card/50 border-amber-500/20">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Warnings</p>
            {data.warnings.map((w: string, i: number) => <p key={i} className="text-xs text-muted-foreground">{w}</p>)}
          </CardContent>
        </Card>
      )}
      {(data.behavioralInsights || []).length > 0 && (
        <Card className="bg-card/50">
          <CardContent className="p-3 space-y-1">
            <p className="text-xs font-semibold text-accent">Behavioral Insights</p>
            {data.behavioralInsights.map((b: string, i: number) => <p key={i} className="text-xs text-muted-foreground">{b}</p>)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── RUN HISTORY PANEL ─────────────────────────────────────────────
function RunHistory({ modelSlug, onSelectRun }: { modelSlug: string; onSelectRun: (output: any) => void }) {
  const historyQuery = trpc.modelEngine.getRunHistory.useQuery({ modelSlug, limit: 10 }, { staleTime: 30000 });
  const runs = historyQuery.data || [];
  if (runs.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">No previous runs</p>;
  return (
    <div className="space-y-1">
      {runs.map((run: any) => (
        <button
          key={run.id}
          className="w-full text-left p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors flex items-center gap-2"
          onClick={() => {
            try {
              const output = typeof run.outputData === "string" ? JSON.parse(run.outputData) : run.outputData;
              onSelectRun(output);
            } catch {
              toast.error("Could not parse run output");
            }
          }}
        >
          {run.status === "completed" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : run.status === "failed" ? (
            <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          ) : (
            <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium truncate">{run.triggeredBy} — {run.durationMs ? `${run.durationMs}ms` : "..."}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(run.createdAt || run.startedAt).toLocaleString()}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────────
export default function ModelResults() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("monte-carlo-retirement");
  const [results, setResults] = useState<Record<string, any>>({});
  const [showHistory, setShowHistory] = useState(false);

  const generatePdfMut = trpc.reports.generate.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success(`Report generated (${data.sectionsIncluded.length} sections, ${(data.sizeBytes / 1024).toFixed(0)}KB)`);
    },
    onError: (err) => toast.error(err.message),
  });

  const generateSinglePdfMut = trpc.reports.generateSingle.useMutation({
    onSuccess: (data) => {
      window.open(data.url, "_blank");
      toast.success("PDF downloaded");
    },
    onError: (err) => toast.error(err.message),
  });

  const executeMut = trpc.modelEngine.execute.useMutation({
    onSuccess: (data, variables) => {
      setResults(prev => ({ ...prev, [variables.modelSlug]: data.output }));
      toast.success(`Model completed in ${data.durationMs}ms`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleRunModel = (slug: string) => {
    // Use sensible default inputs for demo
    const defaults: Record<string, any> = {
      "monte-carlo-retirement": {
        currentAge: 35, retirementAge: 65, lifeExpectancy: 90, currentSavings: 150000,
        annualContribution: 20000, contributionGrowthRate: 0.03, expectedReturn: 0.07,
        returnStdDev: 0.15, inflationRate: 0.03, annualExpensesInRetirement: 60000,
        socialSecurityAnnual: 24000, socialSecurityStartAge: 67, simulations: 5000,
      },
      "debt-optimization": {
        debts: [
          { name: "Credit Card", balance: 8500, interestRate: 0.22, minimumPayment: 200, type: "credit_card" },
          { name: "Student Loan", balance: 35000, interestRate: 0.055, minimumPayment: 400, type: "student_loan" },
          { name: "Auto Loan", balance: 18000, interestRate: 0.065, minimumPayment: 350, type: "auto" },
        ],
        monthlyBudget: 1200, extraPayment: 250,
      },
      "tax-optimization": {
        filingStatus: "married_joint", grossIncome: 185000, w2Income: 160000,
        selfEmploymentIncome: 25000, capitalGainsShortTerm: 3000, capitalGainsLongTerm: 8000,
        dividendsQualified: 2500, dividendsOrdinary: 1000,
        deductions: { mortgage: 18000, stateLocalTax: 10000, charitableGiving: 5000, medicalExpenses: 2000, studentLoanInterest: 2500, businessExpenses: 8000, retirementContributions: 20500, hsaContributions: 7300 },
        traditionalIraBalance: 250000, rothIraBalance: 80000, age: 42, state: "AZ",
      },
      "cash-flow-projection": {
        monthlyIncome: [{ source: "Salary", amount: 12000, growthRate: 0.03 }, { source: "Side Income", amount: 2000, growthRate: 0.05 }],
        monthlyExpenses: [{ category: "Housing", amount: 3200, growthRate: 0.02 }, { category: "Food", amount: 800, growthRate: 0.03 }, { category: "Transport", amount: 600, growthRate: 0.02 }, { category: "Insurance", amount: 500, growthRate: 0.04 }, { category: "Other", amount: 2000, growthRate: 0.03 }],
        oneTimeEvents: [{ month: 6, amount: -15000, description: "Home Repair", type: "expense" }, { month: 12, amount: 5000, description: "Bonus", type: "income" }],
        currentCash: 25000, projectionMonths: 24, inflationRate: 0.03, emergencyFundTarget: 30000,
      },
      "insurance-gap-analysis": {
        annualIncome: 150000, age: 40, dependents: 2, mortgageBalance: 350000,
        totalDebt: 45000, monthlyExpenses: 7000, homeValue: 500000, autoValue: 35000, netWorth: 600000,
        hasEmployerDisability: true, employerDisabilityPercent: 0.6,
        currentPolicies: [
          { type: "life", coverageAmount: 500000, annualPremium: 600, deductible: 0, provider: "MetLife" },
          { type: "home", coverageAmount: 400000, annualPremium: 1800, deductible: 2500, provider: "State Farm" },
          { type: "auto", coverageAmount: 100000, annualPremium: 1200, deductible: 500, provider: "Geico" },
        ],
      },
      "estate-planning": {
        totalEstateValue: 3500000, filingStatus: "married", age: 55, spouseAge: 52,
        assets: [
          { type: "Primary Home", value: 800000, beneficiary: "Spouse", inTrust: false },
          { type: "Investment Portfolio", value: 1200000, beneficiary: "Children", inTrust: false },
          { type: "Business Interest", value: 500000, beneficiary: "Children", inTrust: true },
          { type: "Rental Property", value: 400000, beneficiary: "Trust", inTrust: true },
        ],
        lifeInsuranceProceeds: 1000000, retirementAccounts: 600000, annualGifting: 36000,
        existingTrusts: [{ type: "Revocable Living Trust", value: 900000 }],
        state: "AZ", charitableIntent: 0.05,
      },
      "education-funding": {
        childAge: 8, collegeStartAge: 18, yearsOfCollege: 4, annualCostToday: 35000,
        educationInflation: 0.05, current529Balance: 45000, monthlyContribution: 500,
        expectedReturn: 0.06, financialAidExpected: 5000, scholarshipsExpected: 3000, stateDeductionRate: 0.025,
      },
      "risk-tolerance-assessment": {
        questionnaireAnswers: [
          { questionId: "q1", answer: 4, category: "willingness" },
          { questionId: "q2", answer: 3, category: "capacity" },
          { questionId: "q3", answer: 4, category: "willingness" },
          { questionId: "q4", answer: 3, category: "knowledge" },
          { questionId: "q5", answer: 2, category: "need" },
          { questionId: "q6", answer: 4, category: "knowledge" },
          { questionId: "q7", answer: 3, category: "capacity" },
        ],
        behavioralSignals: {
          portfolioChangesLast12m: 3, panicSellEvents: 0, riskAssetAllocation: 0.65,
          loginFrequencyDuringVolatility: 1.5, averageHoldingPeriod: 36,
        },
        financialContext: {
          age: 42, yearsToRetirement: 23, incomeStability: 4, emergencyFundMonths: 6, debtToIncomeRatio: 0.25, dependents: 2,
        },
      },
    };
    executeMut.mutate({ modelSlug: slug, inputData: defaults[slug] || {} });
  };

  const renderResults = (slug: string) => {
    const data = results[slug];
    if (!data) return (
      <div className="text-center py-12 space-y-3">
        <BarChart3 className="w-10 h-10 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">No results yet. Run the model or select a previous run.</p>
      </div>
    );
    switch (slug) {
      case "monte-carlo-retirement": return <RetirementResults data={data} />;
      case "debt-optimization": return <DebtResults data={data} />;
      case "tax-optimization": return <TaxResults data={data} />;
      case "cash-flow-projection": return <CashFlowResults data={data} />;
      case "insurance-gap-analysis": return <InsuranceResults data={data} />;
      case "estate-planning": return <EstateResults data={data} />;
      case "education-funding": return <EducationResults data={data} />;
      case "risk-tolerance-assessment": return <RiskResults data={data} />;
      default: return <p className="text-sm text-muted-foreground">Unknown model</p>;
    }
  };

  const activeModel = MODEL_TABS.find(m => m.slug === activeTab);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="container max-w-7xl py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">Model Results Dashboard</h1>
            <p className="text-xs text-muted-foreground">Run and visualize analytical models</p>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => handleRunModel(activeTab)}
            disabled={executeMut.isPending}
          >
            {executeMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Run {activeModel?.shortLabel || "Model"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              if (results[activeTab]) {
                generateSinglePdfMut.mutate({ modelSlug: activeTab, outputData: results[activeTab] });
              } else {
                toast.error("Run the model first to generate a PDF");
              }
            }}
            disabled={generateSinglePdfMut.isPending || !results[activeTab]}
          >
            {generateSinglePdfMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => generatePdfMut.mutate({})}
            disabled={generatePdfMut.isPending || Object.keys(results).length === 0}
          >
            {generatePdfMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            Full Report
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowHistory(!showHistory)}
          >
            <Clock className="w-3.5 h-3.5" />
            History
          </Button>
        </div>
      </div>

      <div className="container max-w-7xl py-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <ScrollArea className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-b border-border/30 rounded-none h-auto p-0 gap-0">
              {MODEL_TABS.map(m => (
                <TabsTrigger
                  key={m.slug}
                  value={m.slug}
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-3 py-2 text-xs gap-1.5"
                >
                  {m.icon}
                  <span className="hidden md:inline">{m.label}</span>
                  <span className="md:hidden">{m.shortLabel}</span>
                  {results[m.slug] && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>

          <div className="mt-4 flex gap-4">
            {/* Main results area */}
            <div className="flex-1 min-w-0">
              {MODEL_TABS.map(m => (
                <TabsContent key={m.slug} value={m.slug} className="mt-0">
                  {renderResults(m.slug)}
                </TabsContent>
              ))}
            </div>

            {/* History sidebar */}
            {showHistory && (
              <Card className="w-64 shrink-0 bg-card/50 hidden md:block">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Run History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RunHistory
                    modelSlug={activeTab}
                    onSelectRun={(output) => setResults(prev => ({ ...prev, [activeTab]: output }))}
                  />
                </CardContent>
              </Card>
            )}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
