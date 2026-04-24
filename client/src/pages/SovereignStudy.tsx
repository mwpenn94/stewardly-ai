/**
 * SovereignStudy — Unified study app prototype surface.
 * Three tabs: StudyHome (overview + progress), CalculatorLab (interactive calc sandbox),
 * ConceptExplorer (domain concept map with search).
 *
 * Reuses existing calculator engine + references from calculators/engine.ts & references.ts.
 * Wired to trpc.learning.* for progress tracking where available.
 */
import { useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  BookOpen, Calculator, Compass, GraduationCap,
  TrendingUp, DollarSign, Shield, Heart, Home,
  Briefcase, Scale, PiggyBank, Search, ChevronRight,
  ExternalLink, Lightbulb, Target, BarChart3,
  ArrowRight, Sparkles, Brain, Layers,
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import { fmt } from '@/lib/format';

/* ═══════════════════════════════════════════════════════════════════════
   Inline domain data (from engine.ts CALC_METHODS + references.ts)
   ═══════════════════════════════════════════════════════════════════════ */
const DOMAINS = [
  { key: "cash", label: "Cash Flow", icon: DollarSign, color: "text-emerald-500", desc: "Gross-to-net budget analysis with DTI ratio", source: "BLS Consumer Expenditure Survey 2024" },
  { key: "protect", label: "Protection", icon: Shield, color: "text-blue-500", desc: "DIME method (Debt + Income + Mortgage + Education)", source: "LIMRA 2024, SOA mortality tables" },
  { key: "growth", label: "Growth", icon: TrendingUp, color: "text-purple-500", desc: "Future value with monthly contributions, multi-vehicle comparison", source: "Morningstar 2024 capital market assumptions" },
  { key: "retire", label: "Retirement", icon: PiggyBank, color: "text-amber-500", desc: "SS claiming age comparison + 4% withdrawal rule", source: "SSA 2024, Trinity Study (Bengen)" },
  { key: "tax", label: "Tax", icon: Scale, color: "text-red-500", desc: "Marginal bracket analysis + deduction optimization", source: "IRS Rev Proc 2024-40, IRC §199A/§408A" },
  { key: "estate", label: "Estate", icon: Home, color: "text-indigo-500", desc: "Gross estate minus exemption, 40% federal rate", source: "IRC §2010, 2024 exemption $13.61M" },
  { key: "edu", label: "Education", icon: GraduationCap, color: "text-cyan-500", desc: "529 FV projection with inflation-adjusted cost", source: "College Board 2024, Vanguard 529" },
  { key: "costBenefit", label: "Cost-Benefit", icon: BarChart3, color: "text-orange-500", desc: "Multi-horizon NPV across all product dimensions", source: "Industry actuarial tables, carrier illustrations" },
  { key: "premiums", label: "Premiums", icon: Briefcase, color: "text-teal-500", desc: "Age-interpolated rate tables (term/IUL/WL/DI/LTC)", source: "NLG, Guardian, Lincoln, Athene rate sheets" },
];

const REFERENCE_CATEGORIES_SUMMARY = [
  { name: "Funnel & Conversion Metrics", count: 16, desc: "Lead-to-sale conversion rates, speed-to-lead data" },
  { name: "Commission & GDC Structures", count: 8, desc: "FYC rates, override structures, compensation benchmarks" },
  { name: "Marketing & Lead Generation", count: 6, desc: "CPL by channel, content marketing ROI" },
  { name: "Client Financial Planning", count: 5, desc: "Capital market assumptions, advisor alpha, savings rates" },
  { name: "Industry Trends (2024-2026)", count: 7, desc: "Digital transformation, AI adoption, regulatory changes" },
  { name: "Premium & Fee Benchmarks", count: 5, desc: "Product pricing, fee structures, carrier comparisons" },
  { name: "Carrier Products", count: 6, desc: "Product features, underwriting, illustration data" },
  { name: "Recruiting & Retention", count: 5, desc: "Agent retention, talent acquisition, training ROI" },
  { name: "Cost vs. Benefit Due Diligence", count: 4, desc: "NPV analysis, opportunity cost frameworks" },
  { name: "Regulatory & Compliance", count: 5, desc: "State requirements, fiduciary standards, DOL rules" },
  { name: "Engine Methodology", count: 9, desc: "Calculation methods, source citations, validation" },
  { name: "AUM & Advisory Management", count: 4, desc: "Fee schedules, breakpoints, platform comparisons" },
  { name: "Technology & Digital Tools", count: 5, desc: "CRM, planning software, digital marketing tools" },
  { name: "Estate & Trust Planning", count: 4, desc: "Trust structures, estate tax strategies, gifting" },
];

/* ═══════════════════════════════════════════════════════════════════════
   Calculator Lab — interactive sandbox
   ═══════════════════════════════════════════════════════════════════════ */
function CalculatorLab() {
  const [income, setIncome] = useState(100000);
  const [age, setAge] = useState(35);
  const [savings, setSavings] = useState(50000);
  const [monthlyContrib, setMonthlyContrib] = useState(1000);
  const [years, setYears] = useState(30);
  const [rate, setRate] = useState(7);

  const fv = useMemo(() => {
    const r = rate / 100 / 12;
    const n = years * 12;
    const pvGrowth = savings * Math.pow(1 + r, n);
    const contribGrowth = monthlyContrib * ((Math.pow(1 + r, n) - 1) / r);
    return pvGrowth + contribGrowth;
  }, [savings, monthlyContrib, years, rate]);

  const dti = useMemo(() => {
    const monthlyIncome = income / 12;
    const estimatedDebt = income * 0.28 / 12; // assume 28% housing ratio
    return monthlyIncome > 0 ? (estimatedDebt / monthlyIncome * 100) : 0;
  }, [income]);

  const lifeInsNeed = useMemo(() => {
    return income * 10 + 50000 + 100000 - savings; // DIME simplified
  }, [income, savings]);

  const estEstateTax = useMemo(() => {
    const exemption = 13610000;
    const grossEstate = fv + savings;
    return grossEstate > exemption ? (grossEstate - exemption) * 0.40 : 0;
  }, [fv, savings]);


  return (
    <div className="space-y-6">
      <SEOHead title="Sovereign Study" description="Personal financial knowledge lab and study app" />
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Calculator className="h-5 w-5 text-primary" /> Interactive Calculator Sandbox</CardTitle>
          <CardDescription>Adjust inputs to see real-time projections across all 9 financial domains.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inputs */}
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Annual Income</Label>
              <Input type="number" value={income} onChange={(e) => setIncome(Number(e.target.value))} />
              <p className="text-xs text-muted-foreground mt-1">Gross annual income</p>
            </div>
            <div>
              <Label>Age</Label>
              <Input type="number" value={age} onChange={(e) => setAge(Number(e.target.value))} />
            </div>
            <div>
              <Label>Current Savings</Label>
              <Input type="number" value={savings} onChange={(e) => setSavings(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Monthly Contribution: ${monthlyContrib.toLocaleString()}</Label>
              <Slider value={[monthlyContrib]} onValueChange={([v]) => setMonthlyContrib(v)} min={0} max={10000} step={100} className="mt-2" />
            </div>
            <div>
              <Label>Investment Horizon: {years} years</Label>
              <Slider value={[years]} onValueChange={([v]) => setYears(v)} min={1} max={50} step={1} className="mt-2" />
            </div>
            <div>
              <Label>Expected Return: {rate}%</Label>
              <Slider value={[rate]} onValueChange={([v]) => setRate(v)} min={1} max={15} step={0.5} className="mt-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="border-emerald-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-emerald-500 mb-2"><DollarSign className="h-5 w-5" /> Cash Flow</div>
            <p className="text-2xl font-bold">{dti.toFixed(1)}% DTI</p>
            <p className="text-xs text-muted-foreground">Housing ratio (28% assumed)</p>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-blue-500 mb-2"><Shield className="h-5 w-5" /> Protection</div>
            <p className="text-2xl font-bold">{fmt(lifeInsNeed)}</p>
            <p className="text-xs text-muted-foreground">DIME life insurance need</p>
          </CardContent>
        </Card>
        <Card className="border-purple-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-purple-500 mb-2"><TrendingUp className="h-5 w-5" /> Growth</div>
            <p className="text-2xl font-bold">{fmt(fv)}</p>
            <p className="text-xs text-muted-foreground">Projected portfolio in {years}yr</p>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-amber-500 mb-2"><PiggyBank className="h-5 w-5" /> Retirement</div>
            <p className="text-2xl font-bold">{fmt(fv * 0.04)}/yr</p>
            <p className="text-xs text-muted-foreground">4% safe withdrawal</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-red-500 mb-2"><Scale className="h-5 w-5" /> Tax</div>
            <p className="text-2xl font-bold">{income > 191950 ? "32%" : income > 100525 ? "24%" : "22%"}</p>
            <p className="text-xs text-muted-foreground">Marginal federal bracket (2024)</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-indigo-500 mb-2"><Home className="h-5 w-5" /> Estate</div>
            <p className="text-2xl font-bold">{estEstateTax > 0 ? fmt(estEstateTax) : "Exempt"}</p>
            <p className="text-xs text-muted-foreground">Est. federal estate tax</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="py-4 text-center">
          <p className="text-sm text-muted-foreground">
            For full multi-product analysis with 34+ calculation methods, visit the{" "}
            <Link href="/calculators" className="text-primary underline">Wealth Engine Calculators</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Concept Explorer — searchable domain knowledge map
   ═══════════════════════════════════════════════════════════════════════ */
function ConceptExplorer() {
  const [search, setSearch] = useState("");
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  const filteredDomains = useMemo(() => {
    if (!search.trim()) return DOMAINS;
    const q = search.toLowerCase();
    return DOMAINS.filter(d =>
      d.label.toLowerCase().includes(q) ||
      d.desc.toLowerCase().includes(q) ||
      d.source.toLowerCase().includes(q)
    );
  }, [search]);

  const filteredRefs = useMemo(() => {
    if (!search.trim()) return REFERENCE_CATEGORIES_SUMMARY;
    const q = search.toLowerCase();
    return REFERENCE_CATEGORIES_SUMMARY.filter(r =>
      r.name.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search domains, methods, references..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Domain Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Brain className="h-5 w-5 text-primary" /> Financial Domains ({filteredDomains.length})</h3>
        <div className="grid md:grid-cols-3 gap-3">
          {filteredDomains.map(d => (
            <Card key={d.key} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setExpandedDomain(expandedDomain === d.key ? null : d.key)}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <d.icon className={`h-5 w-5 ${d.color}`} />
                  <span className="font-medium">{d.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{d.desc}</p>
                {expandedDomain === d.key && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-xs"><strong>Source:</strong> {d.source}</p>
                    </div>
                    <Link href="/calculators" className="text-xs text-primary flex items-center gap-1 hover:underline">
                      Open in Calculator <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Reference Library */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Layers className="h-5 w-5 text-primary" /> Reference Library ({filteredRefs.reduce((a, r) => a + r.count, 0)} entries across {filteredRefs.length} categories)</h3>
        <Accordion type="single" collapsible>
          {filteredRefs.map((r, i) => (
            <AccordionItem key={i} value={r.name}>
              <AccordionTrigger className="text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{r.count}</Badge>
                  {r.name}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-muted-foreground mb-2">{r.desc}</p>
                <Link href="/wealth-engine/references" className="text-xs text-primary flex items-center gap-1 hover:underline">
                  View full references <ExternalLink className="h-3 w-3" />
                </Link>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Study Home — overview + progress
   ═══════════════════════════════════════════════════════════════════════ */
function StudyHome() {
  const progressQ = trpc.learning.mastery.summary.useQuery(undefined, { retry: false });
  const progress = progressQ.data as any;

  const domainProgress = useMemo(() => {
    // Derive domain progress from mastery summary — each domain gets
    // a proportional score based on overall mastery percentage.
    const pct = progress?.masteryPct ?? 0;
    const baseScore = Math.min(3, Math.round((pct / 100) * 3));
    return DOMAINS.map(d => ({
      ...d,
      score: baseScore,
      maxScore: 3,
    }));
  }, [progress]);

  const totalScore = domainProgress.reduce((a, d) => a + d.score, 0);
  const maxTotal = domainProgress.reduce((a, d) => a + d.maxScore, 0);

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-1">Sovereign Study</h2>
              <p className="text-muted-foreground text-sm">
                Your personal financial knowledge lab. Explore 9 financial domains, 34+ calculation methods,
                101+ industry references, and interactive calculators — all in one place.
              </p>
              <div className="flex gap-3 mt-4">
                <Link href="/learning">
                  <Button variant="outline" size="sm" className="gap-1"><GraduationCap className="h-4 w-4" /> Learning Hub</Button>
                </Link>
                <Link href="/calculators">
                  <Button variant="outline" size="sm" className="gap-1"><Calculator className="h-4 w-4" /> Full Calculators</Button>
                </Link>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Domain Mastery</CardTitle>
          <CardDescription>Your progress across 9 financial planning domains ({totalScore}/{maxTotal})</CardDescription>
        </CardHeader>
        <CardContent>
          {progressQ.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : (
            <div className="space-y-3">
              {domainProgress.map(d => {
                const pct = d.maxScore > 0 ? Math.round((d.score / d.maxScore) * 100) : 0;
                return (
                  <div key={d.key} className="flex items-center gap-3">
                    <d.icon className={`h-5 w-5 ${d.color} shrink-0`} />
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{d.label}</span>
                        <span className="text-muted-foreground">{d.score}/{d.maxScore}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid md:grid-cols-3 gap-3">
        {[
          { label: "Flashcard Review", href: "/learning/review", icon: Brain, desc: "Spaced repetition for due cards" },
          { label: "Exam Simulator", href: "/learning/exam/financial-planning", icon: GraduationCap, desc: "Practice exam questions" },
          { label: "Study Buddy AI", href: "/learning/study-buddy", icon: Sparkles, desc: "AI-powered study assistant" },
        ].map(l => (
          <Link key={l.href} href={l.href}>
            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <l.icon className="h-5 w-5 text-primary" />
                  <span className="font-medium text-sm">{l.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{l.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Main Export — Tabbed Container
   ═══════════════════════════════════════════════════════════════════════ */
export default function SovereignStudy() {
  const [tab, setTab] = useState("home");

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Compass className="h-8 w-8 text-primary" /> Sovereign Study
        </h1>
        <p className="text-muted-foreground mt-1">
          Your personal financial knowledge lab — explore domains, run calculations, and master concepts.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="home" className="gap-1"><BookOpen className="h-4 w-4" /> Study Home</TabsTrigger>
          <TabsTrigger value="calculator" className="gap-1"><Calculator className="h-4 w-4" /> Calculator Lab</TabsTrigger>
          <TabsTrigger value="explorer" className="gap-1"><Compass className="h-4 w-4" /> Concept Explorer</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="mt-4"><StudyHome /></TabsContent>
        <TabsContent value="calculator" className="mt-4"><CalculatorLab /></TabsContent>
        <TabsContent value="explorer" className="mt-4"><ConceptExplorer /></TabsContent>
      </Tabs>
    </div>
  );
}
