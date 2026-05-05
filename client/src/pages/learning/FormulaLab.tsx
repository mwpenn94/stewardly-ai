/**
 * FormulaLab.tsx — Interactive formula playground
 *
 * KE-inherited design: formula cards with 2px accent bars, category grouping
 * with colored headers, interactive calculator with sliders, step-by-step
 * breakdowns, font-display headings, font-mono metadata, motion animations.
 */
import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useStudySession } from "@/hooks/useStudySession";
import { FORMULA_REGISTRY } from "@/lib/formulaRegistry";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calculator, ArrowLeft, Sparkles, BookOpen, ChevronDown, ChevronUp,
  DollarSign, TrendingUp, RotateCcw, Search, LogIn,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

/* ── Category colors (KE pattern) ── */
const CATEGORY_COLORS: Record<string, string> = {
  "Time Value of Money": "#8B5CF6",
  "Quick Estimates": "#F59E0B",
  "Personal Finance": "#10B981",
  "Lending": "#EF4444",
  "Planning": "#6366F1",
};

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
      (v.monthlyDebt / v.monthlyIncome) * 100 <= 36 ? "Below 36% — generally qualifies for most loans" : "Above 36% — may face lending restrictions",
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
    return Array.from(cats);
  }, []);

  const filteredFormulas = useMemo(() => {
    return FORMULA_CATALOG.filter((f) => {
      if (categoryFilter !== "all" && f.category !== categoryFilter) return false;
      if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase()) && !f.description.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [categoryFilter, searchTerm]);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, typeof FORMULA_CATALOG> = {};
    filteredFormulas.forEach(f => {
      if (!groups[f.category]) groups[f.category] = [];
      groups[f.category].push(f);
    });
    return groups;
  }, [filteredFormulas]);

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
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Formula Lab" description="Interactive financial formula playground" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Calculator className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Formula Lab
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to explore interactive financial formulas.
            </p>
            <a
              href={getLoginUrl("/learning/formula-lab")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Formula Lab" description="Interactive financial formula playground" />
      <div className="min-h-screen px-6 lg:px-10 py-8">
        {/* Header — KE pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Calculator className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Formula Lab
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {FORMULA_CATALOG.length} formulas across {categories.length} categories
              </p>
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formula List — KE pattern */}
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search formulas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Category filter pills */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              {categories.map(cat => {
                const color = CATEGORY_COLORS[cat] || "#6366F1";
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(categoryFilter === cat ? "all" : cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      categoryFilter === cat ? "text-white" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                    style={categoryFilter === cat ? { background: color } : undefined}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Formula cards grouped by category */}
            <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1">
              {Object.entries(grouped).map(([cat, formulas]) => {
                const color = CATEGORY_COLORS[cat] || "#6366F1";
                return (
                  <div key={cat}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</span>
                    </div>
                    <div className="space-y-2">
                      {formulas.map(f => (
                        <motion.button
                          key={f.id}
                          whileHover={{ x: 2 }}
                          onClick={() => selectFormula(f.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all relative overflow-hidden ${
                            selectedId === f.id
                              ? "border-primary/50 bg-primary/5"
                              : "border-border bg-card hover:border-primary/30"
                          }`}
                        >
                          {/* Accent bar */}
                          <div className="absolute top-0 left-0 bottom-0 w-[2px]" style={{ background: color }} />
                          <div className="pl-2">
                            <div className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{f.name}</div>
                            <div className="text-[11px] text-muted-foreground line-clamp-1">{f.description}</div>
                            <code className="text-[10px] font-mono text-muted-foreground/70 mt-1 block">{f.formula}</code>
                          </div>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calculator — KE pattern */}
          <div className="lg:col-span-2 space-y-4">
            {selectedFormula ? (
              <>
                {/* Formula header card */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card border border-border rounded-xl p-5 relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: CATEGORY_COLORS[selectedFormula.category] || "#6366F1" }} />
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{selectedFormula.name}</h2>
                      <p className="text-xs text-muted-foreground">{selectedFormula.description}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary text-primary-foreground">
                      {selectedFormula.category}
                    </span>
                  </div>
                  <code className="block p-3 rounded-lg bg-accent/30 border border-border/50 text-sm font-mono text-foreground">
                    {selectedFormula.formula}
                  </code>
                </motion.div>

                {/* Variable sliders */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  className="bg-card border border-border rounded-xl p-5 space-y-5"
                >
                  <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Variables</h3>
                  {selectedFormula.variables.map((v) => (
                    <div key={v.key} className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <label className="text-xs text-muted-foreground">{v.label}</label>
                        <span className="text-sm font-mono font-semibold text-foreground">
                          {v.isRate ? `${((vars[v.key] ?? v.default) * 100).toFixed(1)}%` : (v.key === "n" || v.key === "t" || v.key === "years" || v.key === "months") ? `${vars[v.key] ?? v.default}` : `$${(vars[v.key] ?? v.default).toLocaleString()}`}
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
                </motion.div>

                {/* Result — KE accent card */}
                {result !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                    className="bg-card border-2 border-primary/30 rounded-xl p-6 text-center"
                  >
                    <div className="text-xs text-muted-foreground font-mono mb-1">Result</div>
                    <div className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--primary)" }}>
                      {selectedId === "rule-of-72"
                        ? `${result.toFixed(1)} years`
                        : selectedId === "debt-to-income"
                        ? `${result.toFixed(1)}%`
                        : `$${result.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                    </div>
                  </motion.div>
                )}

                {/* Step-by-step toggle */}
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowSteps(!showSteps)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/30 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  {showSteps ? "Hide" : "Show"} Step-by-Step Breakdown
                  {showSteps ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </motion.button>

                <AnimatePresence>
                  {showSteps && steps.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                        {steps.map((step, i) => (
                          <div key={i} className="flex gap-3 items-start">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-mono font-medium">
                              {i + 1}
                            </span>
                            <span className="text-sm text-foreground leading-relaxed">{step}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-center h-64"
              >
                <div className="text-center">
                  <Calculator className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground" style={{ fontFamily: "var(--font-display)" }}>
                    Select a formula to get started
                  </p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Choose from {FORMULA_CATALOG.length} financial formulas
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </LearningShell>
  );
}
