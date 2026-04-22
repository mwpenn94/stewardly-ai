/**
 * FormulaLab.tsx — Interactive formula playground
 *
 * Pass 36. Lets users explore financial formulas with live computation,
 * variable sliders, step-by-step breakdowns, and discipline filtering.
 */
import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useStudySession } from "@/hooks/useStudySession";
import { FORMULA_REGISTRY } from "@/lib/formulaRegistry";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator, ArrowLeft, Sparkles, BookOpen, ChevronRight,
  DollarSign, TrendingUp, RotateCcw, Search,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

// Built-in formula definitions with variable metadata
const FORMULA_CATALOG = [
  {
    id: "future-value",
    name: "Future Value",
    category: "Time Value of Money",
    description: "Calculate the future value of a present sum at a given interest rate.",
    formula: "FV = PV × (1 + r)^n",
    variables: [
      { key: "PV", label: "Present Value ($)", min: 0, max: 1000000, step: 1000, default: 10000 },
      { key: "r", label: "Annual Rate (%)", min: 0, max: 0.30, step: 0.005, default: 0.07, isRate: true },
      { key: "n", label: "Years", min: 1, max: 50, step: 1, default: 10 },
    ],
    steps: (v: Record<string, number>) => [
      `Start with PV = $${v.PV.toLocaleString()}`,
      `Growth factor = (1 + ${(v.r * 100).toFixed(1)}%) = ${(1 + v.r).toFixed(4)}`,
      `Compound over ${v.n} years = ${(1 + v.r).toFixed(4)}^${v.n} = ${Math.pow(1 + v.r, v.n).toFixed(4)}`,
      `FV = $${v.PV.toLocaleString()} × ${Math.pow(1 + v.r, v.n).toFixed(4)} = $${(v.PV * Math.pow(1 + v.r, v.n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    ],
  },
  {
    id: "present-value",
    name: "Present Value",
    category: "Time Value of Money",
    description: "Discount a future sum back to today's dollars.",
    formula: "PV = FV / (1 + r)^n",
    variables: [
      { key: "FV", label: "Future Value ($)", min: 0, max: 2000000, step: 1000, default: 50000 },
      { key: "r", label: "Discount Rate (%)", min: 0, max: 0.30, step: 0.005, default: 0.05, isRate: true },
      { key: "n", label: "Years", min: 1, max: 50, step: 1, default: 10 },
    ],
    steps: (v: Record<string, number>) => [
      `Future amount = $${v.FV.toLocaleString()}`,
      `Discount factor = 1 / (1 + ${(v.r * 100).toFixed(1)}%)^${v.n} = ${(1 / Math.pow(1 + v.r, v.n)).toFixed(6)}`,
      `PV = $${v.FV.toLocaleString()} × ${(1 / Math.pow(1 + v.r, v.n)).toFixed(6)} = $${(v.FV / Math.pow(1 + v.r, v.n)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    ],
  },
  {
    id: "compound-interest",
    name: "Compound Interest",
    category: "Time Value of Money",
    description: "Calculate compound growth with periodic compounding.",
    formula: "A = P × (1 + r/n)^(n×t)",
    variables: [
      { key: "P", label: "Principal ($)", min: 0, max: 1000000, step: 1000, default: 10000 },
      { key: "r", label: "Annual Rate (%)", min: 0, max: 0.30, step: 0.005, default: 0.06, isRate: true },
      { key: "n", label: "Compounds/Year", min: 1, max: 365, step: 1, default: 12 },
      { key: "t", label: "Years", min: 1, max: 50, step: 1, default: 10 },
    ],
    steps: (v: Record<string, number>) => [
      `Principal = $${v.P.toLocaleString()}`,
      `Period rate = ${(v.r * 100).toFixed(1)}% / ${v.n} = ${((v.r / v.n) * 100).toFixed(4)}%`,
      `Total periods = ${v.n} × ${v.t} = ${v.n * v.t}`,
      `A = $${(v.P * Math.pow(1 + v.r / v.n, v.n * v.t)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    ],
  },
  {
    id: "rule-of-72",
    name: "Rule of 72",
    category: "Quick Estimates",
    description: "Estimate years to double your money.",
    formula: "Years ≈ 72 / (r × 100)",
    variables: [
      { key: "r", label: "Annual Rate (%)", min: 0.01, max: 0.30, step: 0.005, default: 0.08, isRate: true },
    ],
    steps: (v: Record<string, number>) => [
      `Rate = ${(v.r * 100).toFixed(1)}%`,
      `Years to double ≈ 72 / ${(v.r * 100).toFixed(1)} = ${(72 / (v.r * 100)).toFixed(1)} years`,
    ],
  },
  {
    id: "debt-to-income",
    name: "Debt-to-Income Ratio",
    category: "Personal Finance",
    description: "Calculate DTI ratio for lending qualification.",
    formula: "DTI = (Monthly Debt / Monthly Income) × 100",
    variables: [
      { key: "monthlyDebt", label: "Monthly Debt ($)", min: 0, max: 50000, step: 100, default: 2000 },
      { key: "monthlyIncome", label: "Monthly Income ($)", min: 1, max: 100000, step: 500, default: 6000 },
    ],
    steps: (v: Record<string, number>) => [
      `Monthly debt = $${v.monthlyDebt.toLocaleString()}`,
      `Monthly income = $${v.monthlyIncome.toLocaleString()}`,
      `DTI = ${((v.monthlyDebt / v.monthlyIncome) * 100).toFixed(1)}%`,
      (v.monthlyDebt / v.monthlyIncome) * 100 <= 36 ? "✅ Below 36% — generally qualifies for most loans" : "⚠️ Above 36% — may face lending restrictions",
    ],
  },
  {
    id: "monthly-payment",
    name: "Loan Monthly Payment",
    category: "Lending",
    description: "Calculate fixed monthly payment on an amortizing loan.",
    formula: "PMT = P × [r(1+r)^n] / [(1+r)^n - 1]",
    variables: [
      { key: "principal", label: "Loan Amount ($)", min: 1000, max: 2000000, step: 5000, default: 250000 },
      { key: "rate", label: "Annual Rate (%)", min: 0.01, max: 0.20, step: 0.0025, default: 0.065, isRate: true },
      { key: "years", label: "Term (Years)", min: 1, max: 30, step: 1, default: 30 },
    ],
    steps: (v: Record<string, number>) => {
      const r = v.rate / 12;
      const n = v.years * 12;
      const pmt = (v.principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
      return [
        `Loan = $${v.principal.toLocaleString()}, Rate = ${(v.rate * 100).toFixed(2)}%, Term = ${v.years} years`,
        `Monthly rate = ${(r * 100).toFixed(4)}%, Total payments = ${n}`,
        `Monthly payment = $${pmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Total paid = $${(pmt * n).toLocaleString(undefined, { maximumFractionDigits: 0 })} (interest: $${((pmt * n) - v.principal).toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
      ];
    },
  },
  {
    id: "net-worth",
    name: "Net Worth",
    category: "Personal Finance",
    description: "Calculate net worth from assets and liabilities.",
    formula: "Net Worth = Total Assets - Total Liabilities",
    variables: [
      { key: "totalAssets", label: "Total Assets ($)", min: 0, max: 10000000, step: 10000, default: 500000 },
      { key: "totalLiabilities", label: "Total Liabilities ($)", min: 0, max: 5000000, step: 5000, default: 200000 },
    ],
    steps: (v: Record<string, number>) => [
      `Assets = $${v.totalAssets.toLocaleString()}`,
      `Liabilities = $${v.totalLiabilities.toLocaleString()}`,
      `Net Worth = $${(v.totalAssets - v.totalLiabilities).toLocaleString()}`,
    ],
  },
  {
    id: "savings-goal",
    name: "Monthly Savings Goal",
    category: "Planning",
    description: "How much to save monthly to reach a goal.",
    formula: "PMT = Goal × r / [(1+r)^n - 1]",
    variables: [
      { key: "goal", label: "Savings Goal ($)", min: 1000, max: 5000000, step: 5000, default: 100000 },
      { key: "rate", label: "Annual Return (%)", min: 0, max: 0.20, step: 0.005, default: 0.07, isRate: true },
      { key: "months", label: "Months", min: 6, max: 600, step: 6, default: 120 },
    ],
    steps: (v: Record<string, number>) => {
      const r = v.rate / 12;
      const pmt = (v.goal * r) / (Math.pow(1 + r, v.months) - 1);
      return [
        `Goal = $${v.goal.toLocaleString()}, Return = ${(v.rate * 100).toFixed(1)}%/yr, Timeline = ${v.months} months`,
        `Monthly return = ${(r * 100).toFixed(4)}%`,
        `Monthly savings needed = $${pmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
        `Total contributed = $${(pmt * v.months).toLocaleString(undefined, { maximumFractionDigits: 0 })} (growth: $${(v.goal - pmt * v.months).toLocaleString(undefined, { maximumFractionDigits: 0 })})`,
      ];
    },
  },
];

export default function FormulaLab() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vars, setVars] = useState<Record<string, number>>({});
  const [showSteps, setShowSteps] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const studySession = useStudySession({ discipline: "formula-lab" });
  const formulasQ = trpc.learning.content.listFormulas.useQuery(undefined, { enabled: !!isAuthenticated });

  const categories = useMemo(() => {
    const cats = new Set(FORMULA_CATALOG.map((f) => f.category));
    return ["all", ...Array.from(cats)];
  }, []);

  const filteredFormulas = useMemo(() => {
    return FORMULA_CATALOG.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase()) && !f.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, searchTerm]);

  const selectedFormula = useMemo(() => FORMULA_CATALOG.find((f) => f.id === selectedId), [selectedId]);

  const selectFormula = useCallback((id: string) => {
    const formula = FORMULA_CATALOG.find((f) => f.id === id);
    if (!formula) return;
    setSelectedId(id);
    studySession.recordItem();
    const defaults: Record<string, number> = {};
    for (const v of formula.variables) {
      defaults[v.key] = v.default;
    }
    setVars(defaults);
    setShowSteps(false);
  }, []);

  const result = useMemo(() => {
    if (!selectedId || !FORMULA_REGISTRY[selectedId]) return null;
    try {
      return FORMULA_REGISTRY[selectedId](vars);
    } catch {
      return null;
    }
  }, [selectedId, vars]);

  const steps = useMemo(() => {
    if (!selectedFormula?.steps) return [];
    try {
      return selectedFormula.steps(vars);
    } catch {
      return [];
    }
  }, [selectedFormula, vars]);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Formula Lab" description="Interactive financial formula playground" />
        <div className="container py-16 text-center space-y-4">
          <Calculator className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Formula Lab</h1>
          <p className="text-muted-foreground">Sign in to explore financial formulas.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/formula-lab")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Formula Lab" description="Interactive financial formula playground" />
      <div className="container max-w-5xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Calculator className="h-6 w-6 text-primary" />
              Formula Lab
            </h1>
            <p className="text-sm text-muted-foreground">Interactive financial formula playground</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formula List */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search formulas..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>{c === "all" ? "All Categories" : c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredFormulas.map((f) => (
                <button
                  key={f.id}
                  onClick={() => selectFormula(f.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedId === f.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium text-sm">{f.name}</div>
                  <div className="text-xs text-muted-foreground">{f.category}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Calculator */}
          <div className="lg:col-span-2 space-y-4">
            {selectedFormula ? (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{selectedFormula.name}</CardTitle>
                      <Badge variant="outline">{selectedFormula.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{selectedFormula.description}</p>
                    <code className="block mt-2 p-2 bg-muted rounded text-sm font-mono">{selectedFormula.formula}</code>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {selectedFormula.variables.map((v) => (
                      <div key={v.key} className="space-y-2">
                        <div className="flex justify-between">
                          <Label className="text-sm">{v.label}</Label>
                          <span className="text-sm font-mono font-medium">
                            {v.isRate ? `${((vars[v.key] ?? v.default) * 100).toFixed(1)}%` : `$${(vars[v.key] ?? v.default).toLocaleString()}`}
                          </span>
                        </div>
                        <Slider
                          value={[vars[v.key] ?? v.default]}
                          min={v.min}
                          max={v.max}
                          step={v.step}
                          onValueChange={([val]) => setVars((prev) => ({ ...prev, [v.key]: val }))}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Result */}
                {result !== null && (
                  <Card className="border-2 border-primary/30">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-sm text-muted-foreground mb-1">Result</div>
                        <div className="text-3xl font-bold text-primary">
                          {selectedId === "rule-of-72"
                            ? `${result.toFixed(1)} years`
                            : selectedId === "debt-to-income"
                            ? `${result.toFixed(1)}%`
                            : `$${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Step-by-step */}
                <Button variant="outline" className="w-full" onClick={() => setShowSteps(!showSteps)}>
                  {showSteps ? "Hide" : "Show"} Step-by-Step Breakdown
                </Button>
                <AnimatePresence>
                  {showSteps && steps.length > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <Card>
                        <CardContent className="pt-4 space-y-2">
                          {steps.map((step, i) => (
                            <div key={i} className="flex gap-3 items-start">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">{i + 1}</span>
                              <span className="text-sm">{step}</span>
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                <div className="text-center space-y-2">
                  <Calculator className="mx-auto h-12 w-12 opacity-30" />
                  <p>Select a formula to get started</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
