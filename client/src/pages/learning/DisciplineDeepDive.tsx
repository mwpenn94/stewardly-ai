/**
 * DisciplineDeepDive.tsx — Tabbed deep-dive learning view.
 *
 * Four tabs:
 *   Definitions — flashcard-style flip cards with confidence rating + audio
 *   Formulas    — interactive calculators backed by FORMULA_REGISTRY
 *   Cases       — links into the CaseStudySimulator
 *   FS Apps     — financial-services application content cards with audio
 */

import { useState, useMemo, useCallback } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft,
  BookOpen,
  Calculator,
  Briefcase,
  FileText,
  Star,
  Volume2,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Play,
  Search,
} from "lucide-react";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { FORMULA_REGISTRY } from "@/lib/formulaRegistry";
import { trpc } from "@/lib/trpc";

/* ── types ─────────────────────────────────────────────────────── */

interface DefinitionItem {
  id: number;
  term: string;
  definition: string;
  category?: string | null;
  audioScript?: string;
}

interface FormulaItem {
  id: string;
  name: string;
  description: string;
  registryKey: string;
  variables: { name: string; label: string; defaultValue: number; min?: number; max?: number; step?: number }[];
}

interface CaseItem {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string[];
}

interface FSAppItem {
  id: string;
  title: string;
  content: string;
  category: string;
  audioScript?: string;
}

type Tab = "definitions" | "formulas" | "cases" | "fs-applications";

/* ── component ─────────────────────────────────────────────────── */

export default function DisciplineDeepDive() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();

  const [activeTab, setActiveTab] = useState<Tab>("definitions");

  // Fetch definitions from the learning content API
  const defsQ = trpc.learning.content.listDefinitions.useQuery(
    { limit: 200 },
    { enabled: true },
  );

  const definitions: DefinitionItem[] = useMemo(() => {
    return (defsQ.data ?? []).map((d: any) => ({
      id: d.id,
      term: d.term,
      definition: d.definition,
      category: d.category ?? null,
      audioScript: `${d.term}. ${d.definition}`,
    }));
  }, [defsQ.data]);

  // Static formula metadata that maps to FORMULA_REGISTRY
  const formulas: FormulaItem[] = useMemo(
    () => [
      {
        id: "future-value",
        name: "Future Value",
        description: "Calculate the future value of a present sum at a given rate.",
        registryKey: "future-value",
        variables: [
          { name: "PV", label: "Present Value ($)", defaultValue: 10000, min: 0, max: 1000000, step: 100 },
          { name: "r", label: "Annual Rate", defaultValue: 0.07, min: 0, max: 0.5, step: 0.005 },
          { name: "n", label: "Years", defaultValue: 10, min: 1, max: 50, step: 1 },
        ],
      },
      {
        id: "present-value",
        name: "Present Value",
        description: "Calculate what a future sum is worth today.",
        registryKey: "present-value",
        variables: [
          { name: "FV", label: "Future Value ($)", defaultValue: 50000, min: 0, max: 1000000, step: 100 },
          { name: "r", label: "Annual Rate", defaultValue: 0.06, min: 0, max: 0.5, step: 0.005 },
          { name: "n", label: "Years", defaultValue: 15, min: 1, max: 50, step: 1 },
        ],
      },
      {
        id: "compound-interest",
        name: "Compound Interest",
        description: "Principal grown with compound interest over time.",
        registryKey: "compound-interest",
        variables: [
          { name: "P", label: "Principal ($)", defaultValue: 5000, min: 0, max: 500000, step: 100 },
          { name: "r", label: "Annual Rate", defaultValue: 0.05, min: 0, max: 0.5, step: 0.005 },
          { name: "n", label: "Compounds/Year", defaultValue: 12, min: 1, max: 365, step: 1 },
          { name: "t", label: "Years", defaultValue: 10, min: 1, max: 50, step: 1 },
        ],
      },
      {
        id: "rule-of-72",
        name: "Rule of 72",
        description: "Estimate years to double an investment.",
        registryKey: "rule-of-72",
        variables: [
          { name: "r", label: "Annual Rate (decimal)", defaultValue: 0.08, min: 0.01, max: 0.5, step: 0.005 },
        ],
      },
      {
        id: "debt-to-income",
        name: "Debt-to-Income Ratio",
        description: "Monthly debt payments as a percentage of income.",
        registryKey: "debt-to-income",
        variables: [
          { name: "monthlyDebt", label: "Monthly Debt ($)", defaultValue: 1500, min: 0, max: 50000, step: 50 },
          { name: "monthlyIncome", label: "Monthly Income ($)", defaultValue: 6000, min: 100, max: 100000, step: 100 },
        ],
      },
      {
        id: "monthly-payment",
        name: "Monthly Loan Payment",
        description: "Fixed monthly payment for a loan.",
        registryKey: "monthly-payment",
        variables: [
          { name: "principal", label: "Loan Amount ($)", defaultValue: 250000, min: 1000, max: 2000000, step: 1000 },
          { name: "rate", label: "Annual Rate", defaultValue: 0.065, min: 0.005, max: 0.3, step: 0.005 },
          { name: "years", label: "Term (years)", defaultValue: 30, min: 1, max: 50, step: 1 },
        ],
      },
    ],
    [],
  );

  // Cases — DB-backed with static fallback
  const casesQ = trpc.learning.content.listCases.useQuery(undefined, { retry: false });
  const cases: CaseItem[] = useMemo(() => {
    const dbCases = (casesQ.data ?? []).map((c: any) => ({
      id: String(c.id),
      title: c.title,
      description: (c.content ?? "").slice(0, 300),
      difficulty: (Array.isArray(c.tags) && c.tags.includes("advanced") ? "advanced" : c.tags?.includes?.("beginner") ? "beginner" : "intermediate") as CaseItem["difficulty"],
      tags: Array.isArray(c.tags) ? c.tags : [],
    }));
    if (dbCases.length > 0) return dbCases;
    // Fallback demo data when DB has no cases yet
    return [
      { id: "estate-high-net-worth", title: "High Net Worth Estate Plan", description: "A couple with $12M in assets needs an estate plan that minimizes federal estate taxes while ensuring liquidity for surviving spouse.", difficulty: "advanced" as const, tags: ["estate", "tax", "trust"] },
      { id: "retirement-gap", title: "Retirement Income Gap Analysis", description: "Client retiring in 5 years with a $400K shortfall. Evaluate annuity vs. systematic withdrawal strategies.", difficulty: "intermediate" as const, tags: ["retirement", "income", "annuity"] },
      { id: "young-professional", title: "Young Professional Financial Plan", description: "28-year-old with $80K income, $35K student loans, and $0 savings. Build a comprehensive plan.", difficulty: "beginner" as const, tags: ["planning", "debt", "savings"] },
      { id: "business-succession", title: "Business Succession Planning", description: "Owner of a $5M manufacturing firm wants to retire in 3 years. Evaluate buy-sell agreements and transition strategies.", difficulty: "advanced" as const, tags: ["business", "succession", "insurance"] },
      { id: "insurance-review", title: "Life Insurance Policy Review", description: "Client has 3 overlapping policies totaling $2M. Evaluate coverage adequacy and cost optimization.", difficulty: "intermediate" as const, tags: ["insurance", "review", "optimization"] },
    ];
  }, [casesQ.data]);

  // FS Applications — DB-backed with static fallback
  const fsAppsQ = trpc.learning.content.listFsApplications.useQuery(undefined, { retry: false });
  const fsApps: FSAppItem[] = useMemo(() => {
    const dbApps = (fsAppsQ.data ?? []).map((a: any) => ({
      id: String(a.id),
      title: a.title,
      content: a.content ?? "",
      category: (Array.isArray(a.tags) && a.tags[0]) ? a.tags[0] : "General",
      audioScript: `${a.title}. ${(a.content ?? "").slice(0, 200)}`,
    }));
    if (dbApps.length > 0) return dbApps;
    // Fallback demo data when DB has no FS applications yet
    return [
      { id: "fs-fiduciary", title: "Fiduciary Standard of Care", content: "The fiduciary standard requires advisors to act in the best interest of their clients at all times. This includes full disclosure of conflicts, reasonable compensation, and ongoing monitoring of recommendations.", category: "Compliance", audioScript: "Fiduciary Standard of Care. The fiduciary standard requires advisors to act in the best interest of their clients at all times." },
      { id: "fs-kyc", title: "Know Your Customer (KYC)", content: "KYC procedures verify client identity, assess risk tolerance, and determine suitability. FINRA Rule 2111 requires a reasonable basis for any recommendation based on client-specific factors.", category: "Compliance", audioScript: "Know Your Customer. KYC procedures verify client identity, assess risk tolerance, and determine suitability." },
      { id: "fs-asset-allocation", title: "Modern Portfolio Theory Application", content: "MPT optimizes portfolio construction by considering the mean-variance trade-off. Efficient frontier analysis helps advisors select asset mixes that maximize expected return for a given risk level.", category: "Investment", audioScript: "Modern Portfolio Theory Application. MPT optimizes portfolio construction by considering the mean-variance trade-off." },
      { id: "fs-tax-harvesting", title: "Tax-Loss Harvesting", content: "Systematic selling of securities at a loss to offset capital gains tax liability. Wash sale rules (30-day window) must be observed. Can generate 0.5-1.5% annual alpha for taxable accounts.", category: "Tax", audioScript: "Tax Loss Harvesting. Systematic selling of securities at a loss to offset capital gains tax liability." },
      { id: "fs-risk-assessment", title: "Risk Capacity vs. Risk Tolerance", content: "Risk capacity is the objective financial ability to absorb losses. Risk tolerance is the subjective emotional willingness. A complete assessment considers both dimensions before making allocation decisions.", category: "Planning", audioScript: "Risk Capacity vs Risk Tolerance. Risk capacity is the objective financial ability to absorb losses. Risk tolerance is the subjective emotional willingness." },
    ];
  }, [fsAppsQ.data]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "definitions", label: "Definitions", icon: <BookOpen className="h-4 w-4" />, count: definitions.length },
    { key: "formulas", label: "Formulas", icon: <Calculator className="h-4 w-4" />, count: formulas.length },
    { key: "cases", label: "Cases", icon: <Briefcase className="h-4 w-4" />, count: cases.length },
    { key: "fs-applications", label: "FS Applications", icon: <FileText className="h-4 w-4" />, count: fsApps.length },
  ];

  return (
    <AppShell title="Deep Dive">
      <SEOHead title="Deep Dive" description="Deep dive into discipline concepts and formulas" />
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/learning")}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Learning
          </Button>
          <h1 className="text-xl font-heading font-semibold tracking-tight">
            Deep Dive
          </h1>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 border-b">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors border-b-2 -mb-px cursor-pointer",
                activeTab === tab.key
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
                {tab.count}
              </Badge>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "definitions" && (
              <DefinitionsTab definitions={definitions} audio={audio} />
            )}
            {activeTab === "formulas" && <FormulasTab formulas={formulas} />}
            {activeTab === "cases" && <CasesTab cases={cases} />}
            {activeTab === "fs-applications" && (
              <FSApplicationsTab items={fsApps} audio={audio} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

/* ── Definitions tab ──────────────────────────────────────────── */

function DefinitionsTab({
  definitions,
  audio,
}: {
  definitions: DefinitionItem[];
  audio: ReturnType<typeof useAudioCompanion>;
}) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [confidence, setConfidence] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return definitions;
    const q = searchQuery.toLowerCase();
    return definitions.filter(
      (d) => d.term.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q),
    );
  }, [definitions, searchQuery]);

  const current = filtered[index];
  const total = filtered.length;

  const playAudio = useCallback(() => {
    if (!current) return;
    audio.play({
      id: `def-${current.id}`,
      type: "definition",
      title: current.term,
      script: current.audioScript ?? `${current.term}. ${current.definition}`,
    });
  }, [current, audio]);

  const playAll = useCallback(() => {
    if (filtered.length === 0) return;
    const items = filtered.map((d) => ({
      id: `def-${d.id}`,
      type: "definition" as const,
      title: d.term,
      script: d.audioScript ?? `${d.term}. ${d.definition}`,
    }));
    audio.enqueue(items);
  }, [filtered, audio]);

  const rateConfidence = useCallback((stars: number) => {
    if (!current) return;
    setConfidence((prev) => ({ ...prev, [current.id]: stars }));
  }, [current]);

  if (total === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <BookOpen className="h-8 w-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            {definitions.length === 0
              ? "No definitions loaded. Import content from Content Studio."
              : "No definitions match your search."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search definitions..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setIndex(0); setFlipped(false); }}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <Button variant="outline" size="sm" onClick={playAll}>
          <Play className="h-3.5 w-3.5 mr-1" /> Study all
        </Button>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Card {index + 1} of {total}</span>
        <span>{Math.round(((index + 1) / total) * 100)}%</span>
      </div>
      <Progress value={((index + 1) / total) * 100} />

      {current && (
        <Card
          className="min-h-[240px] cursor-pointer select-none"
          role="button"
          tabIndex={0}
          onClick={() => setFlipped((f) => !f)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); } }}
        >
          <CardContent className="p-8 flex flex-col items-center justify-center min-h-[240px] text-center">
            {flipped ? (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Definition
                </p>
                <p className="text-base leading-relaxed max-w-lg">
                  {current.definition}
                </p>
                {current.category && (
                  <Badge variant="outline" className="mt-3">
                    {current.category}
                  </Badge>
                )}
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Term
                </p>
                <p className="text-xl font-semibold">{current.term}</p>
                <p className="text-xs text-muted-foreground mt-3">
                  Click to reveal definition
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confidence rating */}
      {flipped && current && (
        <div className="flex items-center justify-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">Confidence:</span>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              onClick={(e) => { e.stopPropagation(); rateConfidence(s); }}
              className="cursor-pointer p-0.5"
            >
              <Star
                className={`h-5 w-5 transition-colors ${
                  (confidence[current.id] ?? 0) >= s
                    ? "fill-accent text-accent"
                    : "text-muted-foreground/30"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => { setIndex((i) => i - 1); setFlipped(false); }}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Prev
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={playAudio}>
            <Volume2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setIndex(0); setFlipped(false); }}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={index >= total - 1}
          onClick={() => { setIndex((i) => i + 1); setFlipped(false); }}
        >
          Next <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/* ── Formulas tab ─────────────────────────────────────────────── */

function FormulasTab({ formulas }: { formulas: FormulaItem[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {formulas.map((f) => (
        <FormulaCalculator key={f.id} formula={f} />
      ))}
    </div>
  );
}

function FormulaCalculator({ formula }: { formula: FormulaItem }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const v of formula.variables) init[v.name] = v.defaultValue;
    return init;
  });

  const compute = FORMULA_REGISTRY[formula.registryKey];
  const result = compute ? compute(values) : NaN;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Calculator className="h-4 w-4 text-accent" />
          {formula.name}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{formula.description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {formula.variables.map((v) => (
          <div key={v.name} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground">{v.label}</label>
              <span className="text-xs font-mono tabular-nums">
                {values[v.name] != null
                  ? values[v.name] < 1 && values[v.name] > 0
                    ? (values[v.name] * 100).toFixed(1) + "%"
                    : values[v.name].toLocaleString()
                  : ""}
              </span>
            </div>
            <Slider
              value={[values[v.name] ?? v.defaultValue]}
              min={v.min ?? 0}
              max={v.max ?? 100}
              step={v.step ?? 1}
              onValueChange={([val]) =>
                setValues((prev) => ({ ...prev, [v.name]: val }))
              }
            />
          </div>
        ))}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">Result</p>
          <p className="text-2xl font-semibold tabular-nums">
            {isFinite(result)
              ? result < 100
                ? result.toFixed(2)
                : "$" + Math.round(result).toLocaleString()
              : "---"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Cases tab ────────────────────────────────────────────────── */

function CasesTab({ cases }: { cases: CaseItem[] }) {
  const difficultyColor: Record<string, string> = {
    beginner: "text-emerald-600",
    intermediate: "text-amber-600",
    advanced: "text-rose-600",
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a case study to enter the branching scenario simulator.
      </p>
      {cases.map((c) => (
        <Link key={c.id} href={`/learning/cases/${c.id}`}>
          <Card className="cursor-pointer hover:border-primary/50 transition-colors">
            <CardContent className="p-4 flex items-start gap-3">
              <Briefcase className="h-5 w-5 text-accent mt-0.5 flex-none" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium">{c.title}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] capitalize ${difficultyColor[c.difficulty] ?? ""}`}
                  >
                    {c.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {c.description}
                </p>
                <div className="flex gap-1 mt-2">
                  {c.tags.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/* ── FS Applications tab ──────────────────────────────────────── */

function FSApplicationsTab({
  items,
  audio,
}: {
  items: FSAppItem[];
  audio: ReturnType<typeof useAudioCompanion>;
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-accent" />
                <p className="text-sm font-medium">{item.title}</p>
                <Badge variant="outline" className="text-[10px]">
                  {item.category}
                </Badge>
              </div>
              {item.audioScript && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    audio.play({
                      id: `fs-${item.id}`,
                      type: "page_narration",
                      title: item.title,
                      script: item.audioScript!,
                    })
                  }
                >
                  <Volume2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {item.content}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
