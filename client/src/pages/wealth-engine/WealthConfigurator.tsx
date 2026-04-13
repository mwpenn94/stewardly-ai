/**
 * WealthConfigurator — UWE (Unified Wealth Engine) configurator.
 * Full product-level wealth strategy builder with client profile,
 * company strategy selection, product customization, and year-by-year
 * simulation wired to the real wealthEngine tRPC endpoints.
 * Closes PARITY-CALC-0007.
 */
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Loader2, ShieldCheck, DollarSign, TrendingUp,
  Building2, Briefcase, Sparkles, BarChart3, ChevronDown,
  ChevronUp, Play,
} from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import AppShell from "@/components/AppShell";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { persistCalculation } from "@/lib/calculatorContext";
import { useFinancialProfile, profileValue } from "@/hooks/useFinancialProfile";

// ─── UTILITIES ──────────────────────────────────────────────────────
function fmt(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// ─── COMPANY DEFINITIONS (mirrors server/shared/calculators/uwe.ts) ─
const COMPANIES = [
  { key: "wealthbridge", name: "WealthBridge Plan", color: "#16A34A", desc: "Holistic — all 14 products, advanced strategies" },
  { key: "captivemutual", name: "Captive Mutual", color: "#1E40AF", desc: "Northwestern Mutual / NYLife — strong WL dividends" },
  { key: "wirehouse", name: "Wirehouse", color: "#2563EB", desc: "Merrill Lynch / Morgan Stanley — AUM-focused" },
  { key: "ria", name: "Independent RIA", color: "#7C3AED", desc: "Fee-only fiduciary — lower fees, broad shelf" },
  { key: "communitybd", name: "Community BD", color: "#0891B2", desc: "Edward Jones / Ameriprise — local, moderate shelf" },
  { key: "diy", name: "DIY / Robo", color: "#64748B", desc: "Betterment / Vanguard — lowest fees, self-directed" },
  { key: "donothing", name: "Do Nothing", color: "#6B7280", desc: "Baseline control — no products, no cost" },
] as const;

const PRODUCT_LABELS: Record<string, string> = {
  term: "Term Life", iul: "Indexed Universal Life", wl: "Whole Life",
  di: "Disability Income", ltc: "Long-Term Care", fia: "Fixed Index Annuity",
  aum: "AUM Advisory", "401k": "401(k)", roth: "Roth IRA",
  "529": "529 Education", estate: "Estate Planning", premfin: "Premium Finance",
  splitdollar: "Split Dollar", deferredcomp: "Deferred Comp",
};

// ─── STAT CARD ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
      <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${positive === true ? "text-emerald-400" : positive === false ? "text-red-400" : "text-foreground"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ─── SLIDER INPUT ───────────────────────────────────────────────────
function SliderInput({
  label, value, onChange, min, max, step = 1, prefix = "", suffix = "", format,
}: {
  label: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
  prefix?: string; suffix?: string; format?: (v: number) => string;
}) {
  const display = format ? format(value) : `${prefix}${value.toLocaleString()}${suffix}`;
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
        className="[&_[role=slider]]:h-3.5 [&_[role=slider]]:w-3.5"
      />
    </div>
  );
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────
export default function WealthConfigurator() {
  const [, navigate] = useLocation();
  const { profile: sharedProfile, updateProfile } = useFinancialProfile("wealth-configurator");

  // ── Client profile state (initialized from shared profile) ──
  const [age, setAge] = useState(() => profileValue(sharedProfile, "currentAge", 40));
  const [income, setIncome] = useState(() => profileValue(sharedProfile, "annualIncome", 150000));
  const [netWorth, setNetWorth] = useState(() => profileValue(sharedProfile, "netWorth", 500000));
  const [savings, setSavings] = useState(() => profileValue(sharedProfile, "portfolioBalance", 100000));
  const [monthlySavings, setMonthlySavings] = useState(() => profileValue(sharedProfile, "monthlyContribution", 2000));
  const [dependents, setDependents] = useState(() => profileValue(sharedProfile, "dependents", 2));
  const [mortgage, setMortgage] = useState(() => profileValue(sharedProfile, "mortgageBalance", 300000));
  const [debts, setDebts] = useState(() => profileValue(sharedProfile, "otherDebts", 25000));
  const [marginalRate, setMarginalRate] = useState(0.24);
  const [equitiesReturn, setEquitiesReturn] = useState(0.07);
  const [existingInsurance, setExistingInsurance] = useState(() => profileValue(sharedProfile, "existingLifeInsurance", 0));
  const [isBizOwner, setIsBizOwner] = useState(() => profileValue(sharedProfile, "isBizOwner", false));

  // ── Strategy state ──
  type CompanyKey = "wealthbridge" | "captivemutual" | "wirehouse" | "ria" | "communitybd" | "diy" | "donothing";
  const [companyKey, setCompanyKey] = useState<CompanyKey>("wealthbridge");
  const [horizon, setHorizon] = useState(30);
  const [showProducts, setShowProducts] = useState(false);
  const [activeTab, setActiveTab] = useState("results");

  // ── Derived profile ──
  const profile = useMemo(() => ({
    age, income, netWorth, savings, monthlySavings,
    dependents, mortgage, debts, marginalRate,
    equitiesReturn, existingInsurance, isBizOwner,
  }), [age, income, netWorth, savings, monthlySavings, dependents, mortgage, debts, marginalRate, equitiesReturn, existingInsurance, isBizOwner]);

  // ── Input guardrails ──
  const warnings = useMemo(() => {
    const w: { level: "warn" | "error"; msg: string }[] = [];
    if (equitiesReturn > 0.12) w.push({ level: "error", msg: "Return rates above 12% are historically rare and may overstate projections." });
    else if (equitiesReturn > 0.10) w.push({ level: "warn", msg: "Return rate above 10% — only realistic for aggressive equity portfolios." });
    if (marginalRate > 0.40) w.push({ level: "warn", msg: "Marginal rate above 40% — verify this includes state + federal combined." });
    if (monthlySavings > income / 12 * 0.5) w.push({ level: "warn", msg: "Monthly savings exceeds 50% of monthly income — is this sustainable?" });
    if (mortgage + debts > netWorth * 2) w.push({ level: "warn", msg: "Total debts exceed 2× net worth — high leverage scenario." });
    if (age >= 65 && dependents > 3) w.push({ level: "warn", msg: "Age 65+ with 3+ dependents — consider long-term care and estate planning." });
    return w;
  }, [equitiesReturn, marginalRate, monthlySavings, income, mortgage, debts, netWorth, age, dependents]);

  // ── tRPC mutations ──
  const buildMut = trpc.wealthEngine.buildStrategy.useMutation({ onError: (e) => toast.error(e.message) });
  const simMut = trpc.wealthEngine.simulate.useMutation({ onError: (e) => toast.error(e.message) });
  const bestMut = trpc.wealthEngine.generateBestOverall.useMutation({ onError: (e) => toast.error(e.message) });
  const mcMut = trpc.wealthEngine.monteCarloSim.useMutation({ onError: (e) => toast.error(e.message) });

  // ── Persist to calculator-to-chat context bridge ──
  function persistUWEResult(strat: any, simData: any[]) {
    const final = simData[simData.length - 1];
    if (!final) return;
    persistCalculation({
      id: `uwe-${strat.company}-${Date.now()}`,
      type: "uwe",
      title: `${strat.companyName} — ${simData.length}yr UWE Projection`,
      summary: `${strat.companyName} strategy with ${strat.products?.length || 0} products over ${simData.length} years. Total value: ${fmt(final.totalValue)}, net value: ${fmt(final.netValue)}, ROI: ${pct(final.roi)}, protection: ${fmt(final.totalProtection)}.`,
      inputs: { companyKey: strat.company, age, income, netWorth, savings, dependents, horizon },
      outputs: { totalValue: final.totalValue, netValue: final.netValue, roi: final.roi, protection: final.totalProtection, savingsBalance: final.savingsBalance, productCount: strat.products?.length },
      timestamp: Date.now(),
    });
  }

  // ── Actions ──
  async function runStrategy() {
    // Sync inputs to shared profile
    updateProfile({
      currentAge: age, annualIncome: income, netWorth,
      portfolioBalance: savings, monthlyContribution: monthlySavings,
      dependents, mortgageBalance: mortgage, otherDebts: debts,
      existingLifeInsurance: existingInsurance, isBizOwner,
    });
    try {
      const built = await buildMut.mutateAsync({ companyKey, profile });
      const strategy = built.data;
      const sim = await simMut.mutateAsync({ strategy, maxYears: horizon });
      persistUWEResult(strategy, sim.data);
      setActiveTab("results");
      toast.success(`${strategy.companyName} — ${sim.data.length} year projection complete`);
    } catch {
      // error handled by mutation onError
    }
  }

  async function runBestOverall() {
    try {
      const built = await bestMut.mutateAsync({ profile });
      const strategy = built.data;
      const sim = await simMut.mutateAsync({ strategy, maxYears: horizon });
      persistUWEResult(strategy, sim.data);
      setActiveTab("results");
      toast.success(`Best Overall — ${sim.data.length} year projection complete`);
    } catch {
      // error handled by mutation onError
    }
  }

  async function runMonteCarlo() {
    if (!simMut.data?.data?.length) {
      toast.error("Run a strategy simulation first");
      return;
    }
    const strat = buildMut.data?.data || bestMut.data?.data;
    if (!strat) return;
    try {
      await mcMut.mutateAsync({
        strategyConfig: {
          investReturn: strat.profile?.equitiesReturn ?? equitiesReturn,
          volatility: 0.15,
          ...strat,
        },
        maxYears: horizon,
        numTrials: 1000,
      });
      setActiveTab("montecarlo");
      toast.success("Monte Carlo simulation complete — 1,000 trials");
    } catch {
      // error handled by mutation onError
    }
  }

  const isRunning = buildMut.isPending || simMut.isPending || bestMut.isPending;
  const simData = simMut.data?.data;
  const strategy = buildMut.data?.data || bestMut.data?.data;
  const mcData = mcMut.data?.data;
  const finalYear = simData?.[simData.length - 1];

  return (
    <AppShell title="Wealth Configurator">
      <SEOHead title="Wealth Configurator" description="Build and simulate custom wealth strategies with the Unified Wealth Engine" />
      <div className="min-h-screen">
        {/* Header */}
        <div className="hidden lg:block border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3 relative">
            <Button variant="ghost" size="sm" className="shrink-0 gap-1.5" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" />
              <span className="font-semibold text-sm font-heading">Wealth Configurator</span>
            </div>
            <Badge variant="outline" className="text-[10px] ml-auto">UWE · 14 Products · 7 Strategies</Badge>
          </div>
        </div>

        {/* Main layout: config panel left, results right */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">

          {/* ─── LEFT: Configuration Panel ─── */}
          <div className="lg:col-span-4 space-y-4">
            {/* Client Profile */}
            <ClientProfileSection
              age={age} setAge={setAge}
              income={income} setIncome={setIncome}
              netWorth={netWorth} setNetWorth={setNetWorth}
              savings={savings} setSavings={setSavings}
              monthlySavings={monthlySavings} setMonthlySavings={setMonthlySavings}
              dependents={dependents} setDependents={setDependents}
              mortgage={mortgage} setMortgage={setMortgage}
              debts={debts} setDebts={setDebts}
              marginalRate={marginalRate} setMarginalRate={setMarginalRate}
              equitiesReturn={equitiesReturn} setEquitiesReturn={setEquitiesReturn}
              existingInsurance={existingInsurance} setExistingInsurance={setExistingInsurance}
              isBizOwner={isBizOwner} setIsBizOwner={setIsBizOwner}
            />

            {/* Company Strategy Selector */}
            <CompanySelector
              companyKey={companyKey} setCompanyKey={setCompanyKey}
              horizon={horizon} setHorizon={setHorizon}
            />

            {/* Guardrail Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-1.5">
                {warnings.map((w, i) => (
                  <div key={i} role="alert" className={`text-xs px-3 py-2 rounded-md border ${w.level === "error" ? "border-destructive/50 bg-destructive/10 text-destructive" : "border-amber-500/50 bg-amber-500/10 text-amber-400"}`}>
                    {w.msg}
                  </div>
                ))}
              </div>
            )}

            {/* Run Buttons */}
            <div className="space-y-2">
              <Button className="w-full gap-2" onClick={runStrategy} disabled={isRunning}>
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run {COMPANIES.find(c => c.key === companyKey)?.name || "Strategy"}
              </Button>
              <Button variant="outline" className="w-full gap-2" onClick={runBestOverall} disabled={isRunning}>
                {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate Best Overall
              </Button>
              {simData && (
                <>
                  <Button variant="outline" className="w-full gap-2" onClick={runMonteCarlo} disabled={mcMut.isPending}>
                    {mcMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarChart3 className="w-4 h-4" />}
                    Monte Carlo (1,000 trials)
                  </Button>
                  <Button variant="ghost" className="w-full gap-2 text-xs" onClick={() => navigate("/chat")}>
                    Discuss results in Chat →
                  </Button>
                </>
              )}
            </div>

            {/* Product Summary (collapsible) */}
            {strategy && (
              <ProductSummary
                strategy={strategy}
                showProducts={showProducts}
                setShowProducts={setShowProducts}
              />
            )}
          </div>

          {/* ─── RIGHT: Results Panel ─── */}
          <div className="lg:col-span-8 space-y-4">
            {!simData && !isRunning && (
              <EmptyState />
            )}
            {isRunning && (
              <Card className="border-border/50">
                <CardContent className="py-16 flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-accent" />
                  <p className="text-sm text-muted-foreground">Running simulation…</p>
                </CardContent>
              </Card>
            )}
            {simData && !isRunning && (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="mb-3">
                  <TabsTrigger value="results">Results</TabsTrigger>
                  <TabsTrigger value="products">Products</TabsTrigger>
                  <TabsTrigger value="table">Year Table</TabsTrigger>
                  {mcData && <TabsTrigger value="montecarlo">Monte Carlo</TabsTrigger>}
                </TabsList>

                <TabsContent value="results">
                  <ResultsOverview simData={simData} finalYear={finalYear} strategy={strategy} />
                </TabsContent>

                <TabsContent value="products">
                  <ProductDetailView simData={simData} />
                </TabsContent>

                <TabsContent value="table">
                  <YearByYearTable simData={simData} />
                </TabsContent>

                {mcData && (
                  <TabsContent value="montecarlo">
                    <MonteCarloResults mcData={mcData} />
                  </TabsContent>
                )}
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

// ─── SECTION COMPONENTS (defined below) ─────────────────────────────

function ClientProfileSection({
  age, setAge, income, setIncome, netWorth, setNetWorth,
  savings, setSavings, monthlySavings, setMonthlySavings,
  dependents, setDependents, mortgage, setMortgage, debts, setDebts,
  marginalRate, setMarginalRate, equitiesReturn, setEquitiesReturn,
  existingInsurance, setExistingInsurance, isBizOwner, setIsBizOwner,
}: {
  age: number; setAge: (v: number) => void;
  income: number; setIncome: (v: number) => void;
  netWorth: number; setNetWorth: (v: number) => void;
  savings: number; setSavings: (v: number) => void;
  monthlySavings: number; setMonthlySavings: (v: number) => void;
  dependents: number; setDependents: (v: number) => void;
  mortgage: number; setMortgage: (v: number) => void;
  debts: number; setDebts: (v: number) => void;
  marginalRate: number; setMarginalRate: (v: number) => void;
  equitiesReturn: number; setEquitiesReturn: (v: number) => void;
  existingInsurance: number; setExistingInsurance: (v: number) => void;
  isBizOwner: boolean; setIsBizOwner: (v: boolean) => void;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-accent" />
          Client Profile
        </CardTitle>
        <CardDescription className="text-xs">Financial snapshot for product selection</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SliderInput label="Age" value={age} onChange={setAge} min={18} max={80} suffix=" years" />
        <SliderInput label="Annual Income" value={income} onChange={setIncome} min={30000} max={1000000} step={5000} format={v => fmt(v)} />
        <SliderInput label="Net Worth" value={netWorth} onChange={setNetWorth} min={0} max={10000000} step={25000} format={v => fmt(v)} />
        <SliderInput label="Current Savings" value={savings} onChange={setSavings} min={0} max={5000000} step={10000} format={v => fmt(v)} />
        <SliderInput label="Monthly Savings" value={monthlySavings} onChange={setMonthlySavings} min={0} max={20000} step={100} format={v => fmt(v)} />
        <SliderInput label="Dependents" value={dependents} onChange={setDependents} min={0} max={10} />
        <SliderInput label="Mortgage Balance" value={mortgage} onChange={setMortgage} min={0} max={3000000} step={10000} format={v => fmt(v)} />
        <SliderInput label="Other Debts" value={debts} onChange={setDebts} min={0} max={500000} step={5000} format={v => fmt(v)} />
        <SliderInput label="Marginal Tax Rate" value={marginalRate} onChange={setMarginalRate} min={0.10} max={0.50} step={0.01} format={v => `${(v * 100).toFixed(0)}%`} />
        <SliderInput label="Expected Return" value={equitiesReturn} onChange={setEquitiesReturn} min={0.02} max={0.15} step={0.005} format={v => `${(v * 100).toFixed(1)}%`} />
        <SliderInput label="Existing Insurance" value={existingInsurance} onChange={setExistingInsurance} min={0} max={5000000} step={50000} format={v => fmt(v)} />
        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs text-muted-foreground">Business Owner</Label>
          <Switch checked={isBizOwner} onCheckedChange={setIsBizOwner} aria-label="Business owner toggle" />
        </div>
      </CardContent>
    </Card>
  );
}

type CompanyKeyType = "wealthbridge" | "captivemutual" | "wirehouse" | "ria" | "communitybd" | "diy" | "donothing";

function CompanySelector({
  companyKey, setCompanyKey, horizon, setHorizon,
}: {
  companyKey: string; setCompanyKey: (v: CompanyKeyType) => void;
  horizon: number; setHorizon: (v: number) => void;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="w-4 h-4 text-accent" />
          Strategy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-1.5">
          {COMPANIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCompanyKey(c.key as CompanyKeyType)}
              className={`text-left px-3 py-2 rounded-md border text-xs transition-colors ${
                companyKey === c.key
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border/50 hover:border-accent/50"
              }`}
              aria-pressed={companyKey === c.key}
            >
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <span className="font-medium">{c.name}</span>
              </div>
              <p className="text-muted-foreground ml-4 mt-0.5">{c.desc}</p>
            </button>
          ))}
        </div>
        <SliderInput label="Projection Horizon" value={horizon} onChange={setHorizon} min={5} max={50} suffix=" years" />
      </CardContent>
    </Card>
  );
}

function ProductSummary({
  strategy, showProducts, setShowProducts,
}: {
  strategy: any; showProducts: boolean; setShowProducts: (v: boolean) => void;
}) {
  const products = strategy?.products || [];
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowProducts(!showProducts)}>
        <CardTitle className="text-sm flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-accent" />
          Products ({products.length})
          {showProducts ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
        </CardTitle>
      </CardHeader>
      {showProducts && (
        <CardContent className="pt-0 space-y-1">
          {products.map((p: any, i: number) => (
            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/30 last:border-0">
              <span>{PRODUCT_LABELS[p.type] || p.type}</span>
              {p.annualPremium > 0 && <span className="text-muted-foreground tabular-nums">{fmt(p.annualPremium)}/yr</span>}
              {p.face > 0 && <Badge variant="outline" className="text-[9px] px-1">{fmt(p.face)} face</Badge>}
            </div>
          ))}
          {products.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No products in this strategy</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function EmptyState() {
  return (
    <Card className="border-border/50 border-dashed">
      <CardContent className="py-16 flex flex-col items-center gap-3 text-center">
        <ShieldCheck className="w-10 h-10 text-accent/40" />
        <div>
          <p className="font-medium text-sm">Unified Wealth Engine</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Configure a client profile and select a company strategy to build a holistic
            wealth projection across all 14 financial product types.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultsOverview({
  simData, finalYear, strategy,
}: {
  simData: any[]; finalYear: any; strategy: any;
}) {
  if (!finalYear) return null;
  const year1 = simData[0];
  return (
    <div className="space-y-4">
      {/* Strategy badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge className="gap-1" style={{ backgroundColor: strategy?.color || undefined }}>
          {strategy?.companyName || "Custom"}
        </Badge>
        <span className="text-xs text-muted-foreground">{simData.length} year projection · {strategy?.products?.length || 0} products</span>
      </div>

      {/* Headline metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Total Value" value={fmt(finalYear.totalValue)} sub={`Year ${simData.length}`} positive={finalYear.totalValue > 0} />
        <StatCard label="Net Value" value={fmt(finalYear.netValue)} sub={`After ${fmt(finalYear.cumulativeCost)} cost`} positive={finalYear.netValue > 0} />
        <StatCard label="ROI" value={pct(finalYear.roi)} positive={finalYear.roi > 0} />
        <StatCard label="Protection" value={fmt(finalYear.totalProtection)} sub="Death benefit + living" />
      </div>

      {/* Secondary metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatCard label="Savings Balance" value={fmt(finalYear.savingsBalance)} />
        <StatCard label="Product Cash Value" value={fmt(finalYear.productCashValue)} />
        <StatCard label="Tax Savings" value={fmt(finalYear.cumulativeTaxSaving)} positive />
        <StatCard label="Annual Cost" value={fmt(finalYear.totalAnnualCost)} />
      </div>

      {/* Mini bar chart of total value over time */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-2">
            <TrendingUp className="w-3 h-3 text-accent" />
            Total Value Trajectory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MiniBarChart data={simData} valueKey="totalValue" />
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Year 1: {fmt(year1?.totalValue || 0)}</span>
            <span>Year {simData.length}: {fmt(finalYear.totalValue)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MiniBarChart({ data, valueKey, maxBars = 20 }: { data: any[]; valueKey: string; maxBars?: number }) {
  if (!data.length) return null;
  const sampled = data.length > maxBars
    ? Array.from({ length: maxBars }, (_, i) => data[Math.floor(i * (data.length - 1) / (maxBars - 1))])
    : data;
  const max = Math.max(...sampled.map((d: any) => Math.abs(d[valueKey])));
  return (
    <div className="flex items-end gap-[2px] h-20">
      {sampled.map((d: any, i: number) => {
        const val = d[valueKey];
        const height = max > 0 ? Math.max(2, (Math.abs(val) / max) * 100) : 2;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-accent/60 transition-all hover:bg-accent/80"
            style={{ height: `${height}%` }}
            title={`Year ${d.year || i + 1}: ${fmt(val)}`}
          />
        );
      })}
    </div>
  );
}

function ProductDetailView({ simData }: { simData: any[] }) {
  const finalYear = simData[simData.length - 1];
  const details = finalYear?.productDetails || [];
  if (!details.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No product details available
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Product Breakdown — Final Year</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-xs text-right">Cash Value</TableHead>
                <TableHead className="text-xs text-right">Death Benefit</TableHead>
                <TableHead className="text-xs text-right">Tax Savings</TableHead>
                <TableHead className="text-xs text-right">Living Benefit</TableHead>
                <TableHead className="text-xs text-right">Annual Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {details.map((d: any, i: number) => (
                <TableRow key={i}>
                  <TableCell className="text-xs font-medium">
                    {PRODUCT_LABELS[d.type] || d.type}
                    {d.carrier && <span className="text-muted-foreground ml-1">({d.carrier})</span>}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(d.cashValue)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(d.deathBenefit)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(d.taxSaving)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(d.livingBenefit)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(d.annualCost)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function YearByYearTable({ simData }: { simData: any[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Year-by-Year Projection</CardTitle>
        <CardDescription className="text-xs">{simData.length} years of compound growth</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full max-h-[60vh] md:max-h-[500px]">
          <div className="overflow-x-auto">
          <Table className="min-w-[500px]">
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs sticky top-0 bg-card">Year</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Age</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Total Value</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Net Value</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Savings</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Cash Value</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">Protection</TableHead>
                <TableHead className="text-xs text-right sticky top-0 bg-card">ROI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simData.map((row: any, i: number) => (
                <TableRow key={i} className={i % 5 === 4 ? "border-b-2 border-accent/20" : ""}>
                  <TableCell className="text-xs tabular-nums">{row.year}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{row.age}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(row.totalValue)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(row.netValue)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(row.savingsBalance)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(row.productCashValue)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{fmt(row.totalProtection)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{pct(row.roi)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function MonteCarloResults({ mcData }: { mcData: any }) {
  if (!mcData?.length) {
    return (
      <Card className="border-border/50">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No Monte Carlo data available
        </CardContent>
      </Card>
    );
  }
  const final = mcData[mcData.length - 1];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <StatCard label="P10 (Pessimistic)" value={fmt(final.p10)} />
        <StatCard label="P25" value={fmt(final.p25)} />
        <StatCard label="P50 (Median)" value={fmt(final.p50)} positive />
        <StatCard label="P75" value={fmt(final.p75)} positive />
        <StatCard label="P90 (Optimistic)" value={fmt(final.p90)} positive />
      </div>
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Percentile Bands Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full max-h-[50vh] md:max-h-[400px]">
            <div className="overflow-x-auto">
            <Table className="min-w-[450px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Year</TableHead>
                  <TableHead className="text-xs text-right">P10</TableHead>
                  <TableHead className="text-xs text-right">P25</TableHead>
                  <TableHead className="text-xs text-right">P50</TableHead>
                  <TableHead className="text-xs text-right">P75</TableHead>
                  <TableHead className="text-xs text-right">P90</TableHead>
                  <TableHead className="text-xs text-right">Mean</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mcData.map((row: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs tabular-nums">{i + 1}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-red-400">{fmt(row.p10)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(row.p25)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums font-medium">{fmt(row.p50)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(row.p75)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums text-emerald-400">{fmt(row.p90)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{fmt(row.mean)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
