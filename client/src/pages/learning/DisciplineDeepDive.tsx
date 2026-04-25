/**
 * DisciplineDeepDive.tsx — KE-style Tabbed Deep Dive with Personalized Sequencing
 *
 * Pass 149. Full rewrite with:
 * - 4 sequence modes (General, Personalized, Weak Areas, Due Review)
 * - Sticky header with backdrop blur, progress bar, studied/mastered stats
 * - Pill-style tabs with counts
 * - Keyboard navigation (Space/Enter reveal, arrows nav, 1-5 confidence, R reset)
 * - Difficulty badges, mastered badges
 * - Audio toggle in header
 * - Formula cards with font-mono display
 * - Cases with decision points
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  ArrowLeft, BookOpen, Calculator, Briefcase, FileText,
  Star, Volume2, ChevronLeft, ChevronRight, RotateCcw,
  Play, Search, Loader2, Eye, Check, GraduationCap,
  Layers, Target, Brain, Shuffle, TrendingUp, Lightbulb,
  LogIn,
} from "lucide-react";
import { useAudioCompanion, type AudioItem } from "@/components/AudioCompanion";
import { FORMULA_REGISTRY } from "@/lib/formulaRegistry";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import BookmarkButton from "@/components/BookmarkButton";

/* ── types ── */
interface DefinitionItem {
  id: number;
  term: string;
  definition: string;
  category?: string | null;
  difficulty?: string;
  audioScript?: string;
}

interface FormulaItem {
  id: string;
  name: string;
  description: string;
  registryKey: string;
  formula?: string;
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
type SequenceMode = "general" | "personalized" | "weak-first" | "due-review";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "definitions", label: "Definitions", icon: BookOpen },
  { id: "formulas", label: "Formulas", icon: Calculator },
  { id: "cases", label: "Cases", icon: Briefcase },
  { id: "fs-applications", label: "FS Apps", icon: Lightbulb },
];

const SEQUENCE_MODES: { id: SequenceMode; label: string; icon: any; desc: string }[] = [
  { id: "general", label: "General", icon: Layers, desc: "Foundation → Intermediate, alphabetical" },
  { id: "personalized", label: "Personalized", icon: Target, desc: "Unseen first, then weak areas" },
  { id: "weak-first", label: "Weak Areas", icon: Brain, desc: "Low confidence items only" },
  { id: "due-review", label: "Due Review", icon: RotateCcw, desc: "Spaced repetition items due now" },
];

/* ── component ── */
export default function DisciplineDeepDive() {
  const params = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const slug = params?.slug ?? "";
  const audio = useAudioCompanion();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>("definitions");
  const [sequenceMode, setSequenceMode] = useState<SequenceMode>("general");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDefinition, setShowDefinition] = useState(false);
  const [showAudio, setShowAudio] = useState(false);
  const [confidence, setConfidence] = useState<Record<number, number>>({});
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch data
  const defsQ = trpc.learning.content.listDefinitions.useQuery({ limit: 200 }, { enabled: !!isAuthenticated });
  const casesQ = trpc.learning.content.listCases.useQuery(undefined, { enabled: !!isAuthenticated, retry: false });
  const fsAppsQ = trpc.learning.content.listFsApplications.useQuery(undefined, { enabled: !!isAuthenticated, retry: false });
  const summaryQ = trpc.learning.mastery.summary.useQuery(undefined, { enabled: !!isAuthenticated });
  const recordReview = trpc.learning.mastery.recordReview.useMutation();

  const definitions: DefinitionItem[] = useMemo(() => {
    return (defsQ.data ?? []).map((d: any) => ({
      id: d.id,
      term: d.term,
      definition: d.definition,
      category: d.category ?? null,
      difficulty: d.category?.toLowerCase().includes("advanced") ? "advanced" : d.category?.toLowerCase().includes("foundation") ? "foundation" : "intermediate",
      audioScript: `${d.term}. ${d.definition}`,
    }));
  }, [defsQ.data]);

  // Sequenced definitions based on mode
  const sequencedDefinitions = useMemo(() => {
    let defs = [...definitions];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      defs = defs.filter(d => d.term.toLowerCase().includes(q) || d.definition.toLowerCase().includes(q));
    }
    switch (sequenceMode) {
      case "general":
        return defs.sort((a, b) => {
          const order: Record<string, number> = { foundation: 0, intermediate: 1, advanced: 2 };
          const da = order[a.difficulty ?? "intermediate"] ?? 1;
          const db = order[b.difficulty ?? "intermediate"] ?? 1;
          if (da !== db) return da - db;
          return a.term.localeCompare(b.term);
        });
      case "personalized":
        return defs.sort((a, b) => {
          const ca = confidence[a.id] ?? 0;
          const cb = confidence[b.id] ?? 0;
          if (ca === 0 && cb !== 0) return -1;
          if (cb === 0 && ca !== 0) return 1;
          return ca - cb;
        });
      case "weak-first":
        return defs.filter(d => (confidence[d.id] ?? 0) < 3).sort((a, b) => (confidence[a.id] ?? 0) - (confidence[b.id] ?? 0));
      case "due-review":
        return defs.filter(d => (confidence[d.id] ?? 0) > 0 && (confidence[d.id] ?? 0) < 5);
      default:
        return defs;
    }
  }, [definitions, sequenceMode, confidence, searchQuery]);

  // Static formula metadata
  const formulas: FormulaItem[] = useMemo(() => [
    { id: "future-value", name: "Future Value", description: "Calculate the future value of a present sum.", formula: "FV = PV × (1 + r)ⁿ", registryKey: "future-value", variables: [
      { name: "PV", label: "Present Value ($)", defaultValue: 10000, min: 0, max: 1000000, step: 100 },
      { name: "r", label: "Annual Rate", defaultValue: 0.07, min: 0, max: 0.5, step: 0.005 },
      { name: "n", label: "Years", defaultValue: 10, min: 1, max: 50, step: 1 },
    ]},
    { id: "present-value", name: "Present Value", description: "What a future sum is worth today.", formula: "PV = FV / (1 + r)ⁿ", registryKey: "present-value", variables: [
      { name: "FV", label: "Future Value ($)", defaultValue: 50000, min: 0, max: 1000000, step: 100 },
      { name: "r", label: "Annual Rate", defaultValue: 0.06, min: 0, max: 0.5, step: 0.005 },
      { name: "n", label: "Years", defaultValue: 15, min: 1, max: 50, step: 1 },
    ]},
    { id: "compound-interest", name: "Compound Interest", description: "Principal grown with compound interest.", formula: "A = P(1 + r/n)^(nt)", registryKey: "compound-interest", variables: [
      { name: "P", label: "Principal ($)", defaultValue: 5000, min: 0, max: 500000, step: 100 },
      { name: "r", label: "Annual Rate", defaultValue: 0.05, min: 0, max: 0.5, step: 0.005 },
      { name: "n", label: "Compounds/Year", defaultValue: 12, min: 1, max: 365, step: 1 },
      { name: "t", label: "Years", defaultValue: 10, min: 1, max: 50, step: 1 },
    ]},
    { id: "rule-of-72", name: "Rule of 72", description: "Estimate years to double an investment.", formula: "Years ≈ 72 / (r × 100)", registryKey: "rule-of-72", variables: [
      { name: "r", label: "Annual Rate (decimal)", defaultValue: 0.08, min: 0.01, max: 0.5, step: 0.005 },
    ]},
    { id: "debt-to-income", name: "Debt-to-Income Ratio", description: "Monthly debt as % of income.", formula: "DTI = (Debt / Income) × 100", registryKey: "debt-to-income", variables: [
      { name: "monthlyDebt", label: "Monthly Debt ($)", defaultValue: 1500, min: 0, max: 50000, step: 50 },
      { name: "monthlyIncome", label: "Monthly Income ($)", defaultValue: 6000, min: 100, max: 100000, step: 100 },
    ]},
    { id: "monthly-payment", name: "Monthly Loan Payment", description: "Fixed monthly payment for a loan.", formula: "M = P[r(1+r)ⁿ]/[(1+r)ⁿ-1]", registryKey: "monthly-payment", variables: [
      { name: "principal", label: "Loan Amount ($)", defaultValue: 250000, min: 1000, max: 2000000, step: 1000 },
      { name: "rate", label: "Annual Rate", defaultValue: 0.065, min: 0.005, max: 0.3, step: 0.005 },
      { name: "years", label: "Term (years)", defaultValue: 30, min: 1, max: 50, step: 1 },
    ]},
  ], []);

  // Cases
  const cases: CaseItem[] = useMemo(() => {
    const dbCases = (casesQ.data ?? []).map((c: any) => ({
      id: String(c.id),
      title: c.title,
      description: (c.content ?? "").slice(0, 300),
      difficulty: (Array.isArray(c.tags) && c.tags.includes("advanced") ? "advanced" : c.tags?.includes?.("beginner") ? "beginner" : "intermediate") as CaseItem["difficulty"],
      tags: Array.isArray(c.tags) ? c.tags : [],
    }));
    if (dbCases.length > 0) return dbCases;
    return [
      { id: "estate-high-net-worth", title: "High Net Worth Estate Plan", description: "A couple with $12M in assets needs an estate plan that minimizes federal estate taxes while ensuring liquidity for surviving spouse.", difficulty: "advanced" as const, tags: ["estate", "tax", "trust"] },
      { id: "retirement-gap", title: "Retirement Income Gap Analysis", description: "Client retiring in 5 years with a $400K shortfall. Evaluate annuity vs. systematic withdrawal strategies.", difficulty: "intermediate" as const, tags: ["retirement", "income", "annuity"] },
      { id: "young-professional", title: "Young Professional Financial Plan", description: "28-year-old with $80K income, $35K student loans, and $0 savings. Build a comprehensive plan.", difficulty: "beginner" as const, tags: ["planning", "debt", "savings"] },
      { id: "business-succession", title: "Business Succession Planning", description: "Owner of a $5M manufacturing firm wants to retire in 3 years. Evaluate buy-sell agreements and transition strategies.", difficulty: "advanced" as const, tags: ["business", "succession", "insurance"] },
      { id: "insurance-review", title: "Life Insurance Policy Review", description: "Client has 3 overlapping policies totaling $2M. Evaluate coverage adequacy and cost optimization.", difficulty: "intermediate" as const, tags: ["insurance", "review", "optimization"] },
    ];
  }, [casesQ.data]);

  // FS Applications
  const fsApps: FSAppItem[] = useMemo(() => {
    const dbApps = (fsAppsQ.data ?? []).map((a: any) => ({
      id: String(a.id),
      title: a.title,
      content: a.content ?? "",
      category: (Array.isArray(a.tags) && a.tags[0]) ? a.tags[0] : "General",
      audioScript: `${a.title}. ${(a.content ?? "").slice(0, 200)}`,
    }));
    if (dbApps.length > 0) return dbApps;
    return [
      { id: "fs-fiduciary", title: "Fiduciary Standard of Care", content: "The fiduciary standard requires advisors to act in the best interest of their clients at all times. This includes full disclosure of conflicts, reasonable compensation, and ongoing monitoring.", category: "Compliance", audioScript: "Fiduciary Standard of Care." },
      { id: "fs-kyc", title: "Know Your Customer (KYC)", content: "KYC procedures verify client identity, assess risk tolerance, and determine suitability. FINRA Rule 2111 requires a reasonable basis for any recommendation.", category: "Compliance", audioScript: "Know Your Customer." },
      { id: "fs-mpt", title: "Modern Portfolio Theory", content: "MPT optimizes portfolio construction by considering the mean-variance trade-off. Efficient frontier analysis helps select asset mixes that maximize return for a given risk level.", category: "Investment", audioScript: "Modern Portfolio Theory." },
      { id: "fs-tax-harvest", title: "Tax-Loss Harvesting", content: "Systematic selling of securities at a loss to offset capital gains. Wash sale rules (30-day window) must be observed. Can generate 0.5-1.5% annual alpha.", category: "Tax", audioScript: "Tax Loss Harvesting." },
      { id: "fs-risk", title: "Risk Capacity vs. Tolerance", content: "Risk capacity is the objective financial ability to absorb losses. Risk tolerance is the subjective emotional willingness. Both dimensions inform allocation decisions.", category: "Planning", audioScript: "Risk Capacity vs Tolerance." },
    ];
  }, [fsAppsQ.data]);

  const tabCounts: Record<Tab, number> = {
    definitions: definitions.length,
    formulas: formulas.length,
    cases: cases.length,
    "fs-applications": fsApps.length,
  };

  const currentDef = sequencedDefinitions[currentIndex];
  const masteredCount = definitions.filter(d => (confidence[d.id] ?? 0) >= 4).length;
  const seenCount = Object.keys(confidence).length;
  const progress = definitions.length > 0 ? Math.round((masteredCount / definitions.length) * 100) : 0;

  /* ── Navigation helpers ── */
  const revealDefinition = useCallback(() => {
    setShowDefinition(true);
  }, []);

  const goNext = useCallback(() => {
    if (currentIndex < sequencedDefinitions.length - 1) {
      setCurrentIndex(i => i + 1);
      setShowDefinition(false);
    }
  }, [currentIndex, sequencedDefinitions.length]);

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setShowDefinition(false);
    }
  }, [currentIndex]);

  const resetSequence = useCallback(() => {
    setCurrentIndex(0);
    setShowDefinition(false);
  }, []);

  const rateConfidence = useCallback((defId: number, stars: number) => {
    setConfidence(prev => ({ ...prev, [defId]: stars }));
  }, []);

  const playCurrentAudio = useCallback(() => {
    if (!currentDef) return;
    audio.play({
      id: `def-${currentDef.id}`,
      type: "definition",
      title: currentDef.term,
      script: currentDef.audioScript ?? `${currentDef.term}. ${currentDef.definition}`,
    });
  }, [currentDef, audio]);

  const playAllAudio = useCallback(() => {
    const items = sequencedDefinitions.map(d => ({
      id: `def-${d.id}`,
      type: "definition" as const,
      title: d.term,
      script: d.audioScript ?? `${d.term}. ${d.definition}`,
    }));
    if (items.length > 0) {
      audio.enqueue(items);
      toast.success(`Queued ${items.length} items for audio playback`);
    }
  }, [sequencedDefinitions, audio]);

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    if (activeTab !== "definitions") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case " ":
        case "Enter":
          e.preventDefault();
          if (!showDefinition) revealDefinition();
          break;
        case "ArrowRight":
        case "n":
          e.preventDefault();
          goNext();
          break;
        case "ArrowLeft":
        case "p":
          e.preventDefault();
          goPrev();
          break;
        case "1": case "2": case "3": case "4": case "5":
          if (showDefinition && currentDef) {
            e.preventDefault();
            rateConfidence(currentDef.id, parseInt(e.key));
          }
          break;
        case "r":
          e.preventDefault();
          resetSequence();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeTab, showDefinition, currentDef, revealDefinition, goNext, goPrev, resetSequence, rateConfidence]);

  /* ── Auth guard ── */
  if (authLoading) {
    return <LearningShell><div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></LearningShell>;
  }
  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Deep Dive" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Deep Dive</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to access deep dive learning.</p>
            <a href={getLoginUrl("/learning/deep-dive")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  if (defsQ.isLoading) {
    return (
      <LearningShell>
        <SEOHead title="Deep Dive" />
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell>
      <SEOHead title="Deep Dive" description="Deep dive into discipline concepts and formulas" />
      <div className="min-h-screen">
        {/* ── Sticky Header ── */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
          <div className="px-6 lg:px-10 py-4">
            <div className="flex items-center gap-3 mb-3">
              <Link href="/learning">
                <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                  <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </Link>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold tracking-tight truncate" style={{ fontFamily: "var(--font-display)" }}>
                  Deep Dive
                </h1>
                <p className="text-xs text-muted-foreground font-mono">
                  {seenCount}/{definitions.length} studied · {masteredCount} mastered · {progress}%
                </p>
              </div>
              <button
                onClick={() => setShowAudio(!showAudio)}
                className={`p-2 rounded-lg transition-colors ${showAudio ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
                title="Toggle audio"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 bg-muted rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            {/* Pill tabs */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const count = tabCounts[tab.id];
                return (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id); setCurrentIndex(0); setShowDefinition(false); }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="px-6 lg:px-10 py-6 space-y-6">
          {/* Audio controls */}
          <AnimatePresence>
            {showAudio && activeTab === "definitions" && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="flex gap-2 mb-4">
                  <button onClick={playCurrentAudio} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent transition-colors">
                    <Volume2 className="w-3.5 h-3.5" /> Play Current
                  </button>
                  <button onClick={playAllAudio} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs hover:bg-accent transition-colors">
                    <Play className="w-3.5 h-3.5" /> Play All ({sequencedDefinitions.length})
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ═══════════ DEFINITIONS TAB ═══════════ */}
            {activeTab === "definitions" && (
              <motion.div key="defs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
                {/* Sequence Mode Selector */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SEQUENCE_MODES.map(mode => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => { setSequenceMode(mode.id); setCurrentIndex(0); setShowDefinition(false); }}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          sequenceMode === mode.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${sequenceMode === mode.id ? "text-primary" : "text-muted-foreground"}`} />
                        <p className="text-xs font-semibold">{mode.label}</p>
                        <p className="text-[10px] text-muted-foreground">{mode.desc}</p>
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search definitions..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setCurrentIndex(0); setShowDefinition(false); }}
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>

                {/* Flashcard Area */}
                {sequencedDefinitions.length > 0 ? (
                  <div className="space-y-4">
                    {/* Progress indicator */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-mono">{currentIndex + 1} / {sequencedDefinitions.length}</span>
                      <span>{currentDef?.difficulty ?? "intermediate"} level</span>
                    </div>

                    {/* Card */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="rounded-2xl border-2 border-border bg-card p-6 min-h-[240px] flex flex-col"
                      >
                        {/* Term header */}
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent text-muted-foreground">
                              {currentDef?.difficulty ?? "foundation"}
                            </span>
                            <h2 className="text-xl font-bold mt-2" style={{ fontFamily: "var(--font-display)" }}>
                              {currentDef?.term}
                            </h2>
                            {currentDef?.category && (
                              <Badge variant="outline" className="mt-1 text-[10px]">{currentDef.category}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {(confidence[currentDef?.id ?? 0] ?? 0) >= 4 && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10">
                                <GraduationCap className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[10px] text-primary font-medium">Mastered</span>
                              </div>
                            )}
                            {currentDef && (
                              <BookmarkButton
                                contentType="definition"
                                contentId={String(currentDef.id)}
                                contentTitle={currentDef.term}
                                discipline={slug}
                              />
                            )}
                          </div>
                        </div>

                        {/* Definition (reveal on click) */}
                        {!showDefinition ? (
                          <button
                            onClick={revealDefinition}
                            className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/30 transition-colors"
                          >
                            <div className="text-center py-8">
                              <Eye className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">Click to reveal definition</p>
                              <p className="text-[10px] text-muted-foreground mt-1 font-mono">Press Space or Enter</p>
                            </div>
                          </button>
                        ) : (
                          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex-1">
                            <p className="text-sm text-foreground/90 leading-relaxed mb-4">
                              {currentDef?.definition}
                            </p>
                            {/* Confidence Rating */}
                            <div className="flex items-center gap-3 pt-3 border-t border-border/50">
                              <span className="text-xs text-muted-foreground">Confidence:</span>
                              <div className="flex gap-1">
                                {[1, 2, 3, 4, 5].map(level => (
                                  <button
                                    key={level}
                                    onClick={() => rateConfidence(currentDef!.id, level)}
                                    className="transition-transform hover:scale-125 p-0.5"
                                    title={`${level}/5 — press ${level}`}
                                  >
                                    <Star
                                      className="w-5 h-5"
                                      fill={(confidence[currentDef?.id ?? 0] ?? 0) >= level ? "hsl(var(--primary))" : "transparent"}
                                      stroke={(confidence[currentDef?.id ?? 0] ?? 0) >= level ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
                                    />
                                  </button>
                                ))}
                              </div>
                              {(confidence[currentDef?.id ?? 0] ?? 0) >= 4 && (
                                <span className="text-[10px] text-primary font-medium flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Mastered
                                </span>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={goPrev}
                        disabled={currentIndex === 0}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" /> Prev
                      </button>
                      <div className="flex gap-2">
                        <button onClick={playCurrentAudio} className="p-2 rounded-lg hover:bg-accent transition-colors" title="Play audio">
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                        <button onClick={resetSequence} className="p-2 rounded-lg hover:bg-accent transition-colors" title="Reset (R)">
                          <RotateCcw className="w-4 h-4 text-muted-foreground" />
                        </button>
                      </div>
                      <button
                        onClick={goNext}
                        disabled={currentIndex >= sequencedDefinitions.length - 1}
                        className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-30"
                      >
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Keyboard hints */}
                    <p className="text-center text-[10px] text-muted-foreground font-mono">
                      Space/Enter: reveal · ←/→ or P/N: navigate · 1-5: rate confidence · R: reset
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
                    <h3 className="text-base font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {sequenceMode === "weak-first" ? "No weak areas found" : sequenceMode === "due-review" ? "No items due for review" : "No definitions match your search"}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {sequenceMode !== "general" && (
                        <button onClick={() => { setSequenceMode("general"); setCurrentIndex(0); }} className="text-primary hover:underline">
                          Switch to General Mode
                        </button>
                      )}
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ═══════════ FORMULAS TAB ═══════════ */}
            {activeTab === "formulas" && (
              <motion.div key="formulas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="grid gap-4 md:grid-cols-2">
                  {formulas.map((f, i) => (
                    <motion.div
                      key={f.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <FormulaCalculator formula={f} />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ═══════════ CASES TAB ═══════════ */}
            {activeTab === "cases" && (
              <motion.div key="cases" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                <p className="text-sm text-muted-foreground">Select a case study to enter the branching scenario simulator.</p>
                {cases.map((c, i) => {
                  const diffColor: Record<string, string> = { beginner: "text-emerald-500", intermediate: "text-amber-500", advanced: "text-rose-500" };
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                      <Link href={`/learning/cases/${c.id}`}>
                        <div className="rounded-xl border border-border bg-card p-5 hover:border-primary/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2 mb-2">
                            <Briefcase className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{c.title}</h3>
                            <Badge variant="outline" className={`text-[10px] capitalize ${diffColor[c.difficulty] ?? ""}`}>
                              {c.difficulty}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{c.description}</p>
                          <div className="flex gap-1">
                            {c.tags.map(t => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                            ))}
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* ═══════════ FS APPLICATIONS TAB ═══════════ */}
            {activeTab === "fs-applications" && (
              <motion.div key="fs" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
                {fsApps.map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="rounded-xl border border-border bg-card p-5"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{a.title}</h3>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{a.category}</span>
                      </div>
                      {a.audioScript && (
                        <button
                          onClick={() => audio.play({
                            id: `fs-${a.id}`,
                            type: "page_narration",
                            title: a.title,
                            script: a.audioScript!,
                          })}
                          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
                        >
                          <Volume2 className="w-4 h-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{a.content}</p>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LearningShell>
  );
}

/* ── Formula Calculator ── */
function FormulaCalculator({ formula }: { formula: FormulaItem }) {
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const v of formula.variables) init[v.name] = v.defaultValue;
    return init;
  });

  const compute = FORMULA_REGISTRY[formula.registryKey];
  const result = compute ? compute(values) : NaN;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <Calculator className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{formula.name}</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-2">{formula.description}</p>
      {formula.formula && (
        <p className="text-sm font-mono px-3 py-2 rounded-lg bg-accent mb-3 text-primary">{formula.formula}</p>
      )}
      <div className="space-y-3">
        {formula.variables.map(v => (
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
              onValueChange={([val]) => setValues(prev => ({ ...prev, [v.name]: val }))}
            />
          </div>
        ))}
        <div className="pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground">Result</p>
          <p className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
            {isFinite(result)
              ? result < 100
                ? result.toFixed(2)
                : "$" + Math.round(result).toLocaleString()
              : "---"}
          </p>
        </div>
      </div>
    </div>
  );
}
