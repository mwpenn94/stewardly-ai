/**
 * PFR Wizard — Personal Financial Review Template
 *
 * A guided step-by-step flow that walks users through a structured
 * Personal Financial Review: Foundation → Protect → Grow → Analyze.
 *
 * Each step navigates to the appropriate calculator panel and provides
 * contextual guidance on what to review and why.
 */
import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CheckCircle2, Circle, ChevronRight, ChevronLeft, Info, User,
  DollarSign, Shield, TrendingUp, BarChart3, Target, Clock,
  Scale, GraduationCap, Building2, FileText, ArrowRight, Sparkles,
  Download, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/** PFR step definition */
interface PFRStep {
  id: string;
  panelId: string;
  label: string;
  category: "foundation" | "protect" | "plan" | "grow" | "analyze";
  icon: React.ReactNode;
  description: string;
  guidance: string;
  keyQuestions: string[];
  estimatedMinutes: number;
  required: boolean;
}

const PFR_STEPS: PFRStep[] = [
  // ── FOUNDATION ──
  {
    id: "profile",
    panelId: "profile",
    label: "Client Profile",
    category: "foundation",
    icon: <User className="w-5 h-5" />,
    description: "Establish the client's personal and financial baseline.",
    guidance: "Start by capturing demographics, income sources, and current financial position. This data feeds every downstream calculation.",
    keyQuestions: [
      "What is the client's household income (all sources)?",
      "What are current assets and liabilities?",
      "What is the client's risk tolerance?",
      "Are there any business ownership interests?",
    ],
    estimatedMinutes: 5,
    required: true,
  },
  {
    id: "cashflow",
    panelId: "cash",
    label: "Cash Flow Analysis",
    category: "foundation",
    icon: <DollarSign className="w-5 h-5" />,
    description: "Map income vs. expenses to find savings capacity.",
    guidance: "Review monthly cash flow to identify savings rate, emergency fund adequacy, and discretionary income available for planning.",
    keyQuestions: [
      "Is the emergency fund adequate (3–6 months)?",
      "What is the current savings rate?",
      "Are there expense categories that could be optimized?",
      "Is debt service manageable relative to income?",
    ],
    estimatedMinutes: 3,
    required: true,
  },
  // ── PLAN ──
  {
    id: "retirement",
    panelId: "retire",
    label: "Retirement Planning",
    category: "plan",
    icon: <Clock className="w-5 h-5" />,
    description: "Project retirement readiness and identify any gaps.",
    guidance: "Model retirement income needs against projected savings, Social Security, and pension benefits. Identify the gap and required additional savings.",
    keyQuestions: [
      "What is the projected retirement income gap?",
      "Is the current savings rate sufficient?",
      "When should Social Security benefits be claimed?",
      "What withdrawal rate is sustainable?",
    ],
    estimatedMinutes: 5,
    required: true,
  },
  {
    id: "tax",
    panelId: "tax",
    label: "Tax Planning",
    category: "plan",
    icon: <Building2 className="w-5 h-5" />,
    description: "Identify tax optimization opportunities.",
    guidance: "Review current tax situation, identify deductions, and model strategies like Roth conversions, tax-loss harvesting, and charitable giving.",
    keyQuestions: [
      "Is the client maximizing tax-advantaged accounts?",
      "Are there Roth conversion opportunities?",
      "Is charitable giving structured tax-efficiently?",
      "Are there business tax optimization strategies?",
    ],
    estimatedMinutes: 4,
    required: false,
  },
  {
    id: "estate",
    panelId: "estate",
    label: "Estate Planning",
    category: "plan",
    icon: <Scale className="w-5 h-5" />,
    description: "Assess estate tax exposure and legacy planning.",
    guidance: "Review estate documents, beneficiary designations, and potential estate tax liability. Identify trust and gifting strategies.",
    keyQuestions: [
      "Are estate documents current (will, POA, healthcare directive)?",
      "Is there estate tax exposure above the exemption?",
      "Are beneficiary designations up to date?",
      "Should trusts be considered for asset protection?",
    ],
    estimatedMinutes: 4,
    required: false,
  },
  {
    id: "education",
    panelId: "edu",
    label: "Education Planning",
    category: "plan",
    icon: <GraduationCap className="w-5 h-5" />,
    description: "Plan for children's education funding.",
    guidance: "Project education costs, review 529 plan adequacy, and balance education funding against retirement savings.",
    keyQuestions: [
      "How many children need education funding?",
      "What is the target institution cost?",
      "Is the current 529 balance on track?",
      "How does education funding compete with retirement?",
    ],
    estimatedMinutes: 3,
    required: false,
  },
  // ── PROTECT ──
  {
    id: "protection",
    panelId: "protect",
    label: "Protection Needs",
    category: "protect",
    icon: <Shield className="w-5 h-5" />,
    description: "Evaluate life, disability, and long-term care coverage.",
    guidance: "Calculate income replacement needs, review existing coverage, and identify gaps in life insurance, disability, and LTC protection.",
    keyQuestions: [
      "Is life insurance adequate for income replacement?",
      "Does disability coverage protect 60–70% of income?",
      "Is long-term care risk addressed?",
      "Are policy beneficiaries current?",
    ],
    estimatedMinutes: 4,
    required: true,
  },
  // ── GROW ──
  {
    id: "growth",
    panelId: "grow",
    label: "Growth & Accumulation",
    category: "grow",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "Review investment allocation and growth strategy.",
    guidance: "Assess current asset allocation against risk tolerance, review diversification, and model growth projections under different scenarios.",
    keyQuestions: [
      "Does the allocation match the stated risk tolerance?",
      "Is the portfolio adequately diversified?",
      "Are fees reasonable relative to benchmarks?",
      "Is rebalancing happening systematically?",
    ],
    estimatedMinutes: 4,
    required: true,
  },
  // ── ANALYZE ──
  {
    id: "costbenefit",
    panelId: "costben",
    label: "Cost-Benefit Analysis",
    category: "analyze",
    icon: <BarChart3 className="w-5 h-5" />,
    description: "Weigh trade-offs across all planning domains.",
    guidance: "Review the cost-benefit analysis across strategies to prioritize actions with the highest impact relative to cost and complexity.",
    keyQuestions: [
      "Which strategies offer the highest ROI?",
      "Are there quick wins to implement immediately?",
      "What are the opportunity costs of inaction?",
      "How do strategies interact (synergies vs. conflicts)?",
    ],
    estimatedMinutes: 3,
    required: true,
  },
  {
    id: "summary",
    panelId: "summary",
    label: "Summary & Recommendations",
    category: "analyze",
    icon: <FileText className="w-5 h-5" />,
    description: "Generate the holistic plan summary with action items.",
    guidance: "Review the unified scorecard, prioritized recommendations, and create an action plan with timelines and accountability.",
    keyQuestions: [
      "What is the overall holistic score?",
      "What are the top 3 priority actions?",
      "What is the implementation timeline?",
      "When should the next review be scheduled?",
    ],
    estimatedMinutes: 3,
    required: true,
  },
];

const CATEGORY_META: Record<string, { label: string; color: string; bgColor: string }> = {
  foundation: { label: "① Foundation", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  plan: { label: "② Plan", color: "text-purple-400", bgColor: "bg-purple-500/10" },
  protect: { label: "③ Protect", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  grow: { label: "④ Grow", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  analyze: { label: "⑤ Analyze", color: "text-rose-400", bgColor: "bg-rose-500/10" },
};

interface PFRWizardProps {
  onNavigateToPanel: (panelId: string) => void;
  weData?: {
    holisticScore: number;
    clientHubScore: number;
    advancedHubScore: number;
    practiceHubScore: number;
    domainScores: { domain: string; score: number; allocation: number; gap?: number }[];
    recommendations: { product: string; coverage: string; premium: number; carrier: string; priority: string; category?: string }[];
    keyMetrics?: {
      totalIncome: number;
      netWorth: number;
      totalSavings: number;
      retirementGap: number;
      protectionCoverage: number;
      taxEfficiency: number;
    };
  };
}

export default function PFRWizard({ onNavigateToPanel, weData }: PFRWizardProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [mode, setMode] = useState<"overview" | "guided">("overview");
  const { user } = useAuth();
  const generatePdf = trpc.pfrReport.generate.useMutation();

  const handleGeneratePdf = useCallback(async () => {
    if (!weData) {
      toast.error("Complete at least one step to generate a report.");
      return;
    }
    try {
      const result = await generatePdf.mutateAsync({
        clientName: user?.name || "Client",
        advisorName: "Financial Advisor",
        holisticScore: weData.holisticScore,
        clientHubScore: weData.clientHubScore,
        advancedHubScore: weData.advancedHubScore,
        practiceHubScore: weData.practiceHubScore,
        domainScores: weData.domainScores,
        recommendations: weData.recommendations,
        steps: PFR_STEPS.map(s => ({
          id: s.id,
          label: s.label,
          category: s.category,
          completed: completedSteps.has(s.id),
        })),
        keyMetrics: weData.keyMetrics,
      });
      window.open(result.url, "_blank", "noopener,noreferrer");
      toast.success("PFR Report generated successfully.");
    } catch {
      toast.error("Failed to generate PFR report.");
    }
  }, [weData, user, completedSteps, generatePdf]);

  const currentStep = PFR_STEPS[currentStepIdx];
  const totalRequired = PFR_STEPS.filter(s => s.required).length;
  const completedRequired = PFR_STEPS.filter(s => s.required && completedSteps.has(s.id)).length;
  const progress = Math.round((completedSteps.size / Math.max(PFR_STEPS.length, 1)) * 100);

  // Edge case: if steps array is somehow empty or currentStep is undefined
  if (!PFR_STEPS.length || !currentStep) {
    return (
      <Card className="border-destructive/20">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Unable to load PFR steps. Please refresh the page.</p>
        </CardContent>
      </Card>
    );
  }
  const totalMinutes = PFR_STEPS.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const remainingMinutes = PFR_STEPS.filter(s => !completedSteps.has(s.id)).reduce((sum, s) => sum + s.estimatedMinutes, 0);

  const stepsByCategory = useMemo(() => {
    const groups: { category: string; steps: PFRStep[] }[] = [];
    let lastCat = "";
    for (const step of PFR_STEPS) {
      if (step.category !== lastCat) {
        groups.push({ category: step.category, steps: [] });
        lastCat = step.category;
      }
      groups[groups.length - 1].steps.push(step);
    }
    return groups;
  }, []);

  const toggleComplete = (stepId: string) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  };

  const goToStepAndPanel = (idx: number) => {
    setCurrentStepIdx(idx);
    onNavigateToPanel(PFR_STEPS[idx].panelId);
  };

  const advanceStep = () => {
    toggleComplete(currentStep.id);
    if (currentStepIdx < PFR_STEPS.length - 1) {
      goToStepAndPanel(currentStepIdx + 1);
    }
  };

  // ── OVERVIEW MODE ──
  if (mode === "overview") {
    return (
      <div className="space-y-6">
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Personal Financial Review
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        A structured PFR walks through every domain of a client's financial life — from cash flow to estate planning — ensuring nothing is missed. This wizard guides you through the standard review process used by CFP professionals.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </CardTitle>
                <CardDescription className="mt-1">
                  Structured {PFR_STEPS.length}-step review covering Foundation, Plan, Protect, Grow, and Analyze
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => { setMode("guided"); goToStepAndPanel(0); }}>
                  Start Guided Review <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
                {user && completedSteps.size > 0 && (
                  <Button variant="outline" onClick={handleGeneratePdf} disabled={generatePdf.isPending}>
                    {generatePdf.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
                    Generate PDF Report
                  </Button>
                )}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span>Est. {totalMinutes} min total</span>
              <span>•</span>
              <span>{totalRequired} required steps</span>
              <span>•</span>
              <span>{PFR_STEPS.length - totalRequired} optional</span>
            </div>
            {completedSteps.size > 0 && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>{completedSteps.size}/{PFR_STEPS.length} steps completed</span>
                  <span>{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
            )}
          </CardHeader>
        </Card>

        {stepsByCategory.map(({ category, steps }) => {
          const meta = CATEGORY_META[category];
          return (
            <Card key={category}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-base ${meta.color}`}>{meta.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {steps.map((step, i) => {
                  const globalIdx = PFR_STEPS.indexOf(step);
                  const done = completedSteps.has(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        done ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50 border border-transparent"
                      }`}
                      onClick={() => goToStepAndPanel(globalIdx)}
                    >
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleComplete(step.id); }}
                        className="shrink-0"
                      >
                        {done ? (
                          <CheckCircle2 className="w-5 h-5 text-primary" />
                        ) : (
                          <Circle className="w-5 h-5 text-muted-foreground/40" />
                        )}
                      </button>
                      <div className="shrink-0 text-muted-foreground">{step.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${done ? "line-through text-muted-foreground" : ""}`}>
                            {step.label}
                          </span>
                          {step.required && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Required</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.description}</p>
                      </div>
                      <div className="text-xs text-muted-foreground shrink-0">{step.estimatedMinutes} min</div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  // ── GUIDED MODE ──
  const catMeta = CATEGORY_META[currentStep.category];
  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">
              Step {currentStepIdx + 1} of {PFR_STEPS.length}
              <Badge variant="outline" className={`ml-2 ${catMeta.color} ${catMeta.bgColor} border-0`}>
                {catMeta.label}
              </Badge>
            </span>
            <span className="text-muted-foreground">{remainingMinutes} min remaining</span>
          </div>
          <Progress value={((currentStepIdx + 1) / PFR_STEPS.length) * 100} className="h-2" />
          {/* Step dots */}
          <div className="flex gap-1 mt-2 justify-center">
            {PFR_STEPS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStepIdx
                    ? "bg-primary"
                    : completedSteps.has(s.id)
                    ? "bg-primary/40"
                    : "bg-muted-foreground/20"
                }`}
                onClick={() => goToStepAndPanel(i)}
                aria-label={`Go to step ${i + 1}: ${s.label}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current step card */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${catMeta.bgColor}`}>{currentStep.icon}</div>
            <div>
              <CardTitle className="text-lg">{currentStep.label}</CardTitle>
              <CardDescription>{currentStep.description}</CardDescription>
            </div>
            {currentStep.required && <Badge className="ml-auto">Required</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Guidance */}
          <div className="p-3 rounded-lg bg-muted/30 border border-muted">
            <p className="text-sm font-medium mb-1 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-primary" /> Guidance
            </p>
            <p className="text-sm text-muted-foreground">{currentStep.guidance}</p>
          </div>

          {/* Key questions */}
          <div>
            <p className="text-sm font-medium mb-2">Key Questions to Address:</p>
            <ul className="space-y-1.5">
              {currentStep.keyQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Target className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/60" />
                  {q}
                </li>
              ))}
            </ul>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => goToStepAndPanel(Math.max(0, currentStepIdx - 1))}
                disabled={currentStepIdx === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMode("overview")}>
                Overview
              </Button>
            </div>
            <div className="flex gap-2">
              {!completedSteps.has(currentStep.id) && (
                <Button size="sm" variant="outline" onClick={() => toggleComplete(currentStep.id)}>
                  Skip
                </Button>
              )}
              <Button size="sm" onClick={advanceStep}>
                {completedSteps.has(currentStep.id) ? "Next" : "Complete & Next"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
