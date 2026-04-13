/**
 * RiskAssessment — Interactive risk profiling questionnaire with dynamic scoring,
 * portfolio risk metrics, and allocation recommendations.
 * Computes a real composite risk score from user answers across 5 dimensions.
 */
import { SEOHead } from "@/components/SEOHead";
import { LeadCaptureGate } from "@/components/LeadCaptureGate";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { PropensityGauge } from "@/components/PropensityGauge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { PlanningCrossNav } from "@/components/PlanningCrossNav";
import { ArrowLeft, BarChart3, Shield, TrendingDown, AlertTriangle, Target, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import AppShell from "@/components/AppShell";
import { persistCalculation } from "@/lib/calculatorContext";

// ─── Risk Assessment Questions ─────────────────────────────
const QUESTIONS = [
  {
    id: "timeHorizon",
    category: "Time Horizon",
    question: "How many years until you need to start withdrawing from your investments?",
    options: [
      { label: "Less than 3 years", score: 2 },
      { label: "3 – 5 years", score: 4 },
      { label: "6 – 10 years", score: 6 },
      { label: "11 – 20 years", score: 8 },
      { label: "More than 20 years", score: 10 },
    ],
    weight: 1.5,
  },
  {
    id: "incomeStability",
    category: "Income Stability",
    question: "How would you describe your current income situation?",
    options: [
      { label: "Unstable / variable with no safety net", score: 2 },
      { label: "Variable but with some reserves", score: 4 },
      { label: "Stable but single income", score: 6 },
      { label: "Stable with dual income", score: 8 },
      { label: "Highly stable with multiple income streams", score: 10 },
    ],
    weight: 1.0,
  },
  {
    id: "lossTolerance",
    category: "Loss Tolerance",
    question: "If your portfolio dropped 20% in a month, what would you do?",
    options: [
      { label: "Sell everything immediately", score: 1 },
      { label: "Sell some to reduce risk", score: 3 },
      { label: "Hold and wait for recovery", score: 6 },
      { label: "Hold and consider buying more", score: 8 },
      { label: "Buy more — this is an opportunity", score: 10 },
    ],
    weight: 2.0,
  },
  {
    id: "investmentKnowledge",
    category: "Investment Knowledge",
    question: "How would you rate your investment knowledge?",
    options: [
      { label: "None — I'm completely new to investing", score: 2 },
      { label: "Basic — I know stocks vs bonds", score: 4 },
      { label: "Intermediate — I understand diversification and asset allocation", score: 6 },
      { label: "Advanced — I understand options, alternatives, and tax strategies", score: 8 },
      { label: "Expert — I have professional investment experience", score: 10 },
    ],
    weight: 0.75,
  },
  {
    id: "liquidityNeeds",
    category: "Liquidity Needs",
    question: "How much of your invested assets might you need to access within the next 2 years?",
    options: [
      { label: "More than 50%", score: 2 },
      { label: "25% – 50%", score: 4 },
      { label: "10% – 25%", score: 6 },
      { label: "Less than 10%", score: 8 },
      { label: "None — fully funded emergency fund", score: 10 },
    ],
    weight: 1.0,
  },
  {
    id: "goalPriority",
    category: "Goal Priority",
    question: "What is most important to you?",
    options: [
      { label: "Preserving what I have — avoid any losses", score: 2 },
      { label: "Steady income with minimal volatility", score: 4 },
      { label: "Balanced growth and income", score: 6 },
      { label: "Long-term growth, willing to accept volatility", score: 8 },
      { label: "Maximum growth — I can handle big swings", score: 10 },
    ],
    weight: 1.5,
  },
  {
    id: "experience",
    category: "Market Experience",
    question: "Have you experienced a significant market downturn (e.g., 2008, 2020) while invested?",
    options: [
      { label: "No, and I'm concerned about it", score: 3 },
      { label: "No, but I think I'd be fine", score: 5 },
      { label: "Yes, and I sold some holdings", score: 4 },
      { label: "Yes, I held through it", score: 7 },
      { label: "Yes, I bought more during the downturn", score: 10 },
    ],
    weight: 1.25,
  },
];

// ─── Risk Profiles ─────────────────────────────────────────
const PROFILES = [
  { name: "Conservative", min: 0, max: 25, equity: 20, fixed: 50, alternatives: 10, cash: 20, color: "text-blue-400" },
  { name: "Moderately Conservative", min: 26, max: 40, equity: 35, fixed: 40, alternatives: 10, cash: 15, color: "text-cyan-400" },
  { name: "Moderate", min: 41, max: 60, equity: 50, fixed: 30, alternatives: 10, cash: 10, color: "text-emerald-400" },
  { name: "Moderately Aggressive", min: 61, max: 75, equity: 65, fixed: 20, alternatives: 10, cash: 5, color: "text-amber-400" },
  { name: "Aggressive", min: 76, max: 100, equity: 80, fixed: 10, alternatives: 8, cash: 2, color: "text-red-400" },
];

function getProfile(score: number) {
  return PROFILES.find(p => score >= p.min && score <= p.max) ?? PROFILES[2];
}

export default function RiskAssessment() {
  const [, navigate] = useLocation();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const { overallScore, categoryScores } = useMemo(() => {
    const cats: { category: string; score: number; weight: number }[] = [];
    let totalWeightedScore = 0;
    let totalWeight = 0;
    for (const q of QUESTIONS) {
      const ans = answers[q.id];
      if (ans != null) {
        cats.push({ category: q.category, score: ans, weight: q.weight });
        totalWeightedScore += ans * q.weight;
        totalWeight += q.weight;
      }
    }
    const score = totalWeight > 0 ? Math.round((totalWeightedScore / totalWeight / 10) * 100) : 0;
    return { overallScore: score, categoryScores: cats };
  }, [answers]);

  const answeredCount = Object.keys(answers).length;
  const allAnswered = answeredCount === QUESTIONS.length;
  const profile = getProfile(overallScore);

  // Persist risk assessment to calculator context for chat follow-up
  useEffect(() => {
    if (!allAnswered) return;
    persistCalculation({
      id: `risk-${overallScore}`,
      type: "risk",
      title: "Risk Assessment",
      summary: `Risk profile: ${profile.name} (score ${overallScore}/100). Recommended allocation: ${profile.equity}% equity, ${profile.fixed}% fixed income, ${profile.alternatives}% alternatives, ${profile.cash}% cash.`,
      inputs: { answers },
      outputs: { overallScore, profileName: profile.name, equity: profile.equity, fixed: profile.fixed, alternatives: profile.alternatives, cash: profile.cash },
      timestamp: Date.now(),
    });
  }, [allAnswered, overallScore, profile]);

  const handleAnswer = (qId: string, score: number) => {
    setAnswers(prev => ({ ...prev, [qId]: score }));
  };

  // ── Persist to calculator context bridge so Chat knows risk profile ──
  useEffect(() => {
    if (!allAnswered) return;
    persistCalculation({
      id: `risk-assessment-${overallScore}`,
      type: "risk",
      title: `Risk Assessment — ${profile.name}`,
      summary: `Risk score: ${overallScore}/100 (${profile.name}). Recommended allocation: ${profile.equity}% equity, ${profile.fixed}% fixed income, ${profile.alternatives}% alternatives, ${profile.cash}% cash.`,
      inputs: { questionCount: QUESTIONS.length, answeredCount, answers },
      outputs: { overallScore, profileName: profile.name, equity: profile.equity, fixed: profile.fixed, alternatives: profile.alternatives, cash: profile.cash, categoryScores },
      timestamp: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overallScore, allAnswered]);

  return (
    <AppShell title="Risk Assessment">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Risk Assessment" description="Interactive risk profiling and portfolio analysis" />

      <PlanningCrossNav />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/calculators")} aria-label="Back to calculators">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-heading">Risk Assessment</h1>
            <p className="text-sm text-muted-foreground">Answer 7 questions to determine your investment risk profile</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{answeredCount}/{QUESTIONS.length} answered</Badge>
          {allAnswered && !showResults && (
            <Button onClick={() => setShowResults(true)} aria-label="View results">
              View Results <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {showResults && (
            <Button variant="outline" onClick={() => { setShowResults(false); setAnswers({}); }} aria-label="Retake assessment">
              <Target className="h-3.5 w-3.5 mr-1" /> Retake
            </Button>
          )}
        </div>
      </div>

      {/* ─── Questionnaire ─────────────────────────────────── */}
      {!showResults && (
        <div className="space-y-4">
          {QUESTIONS.map((q, idx) => (
            <Card key={q.id} className={answers[q.id] != null ? "border-accent/30" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono text-muted-foreground mt-0.5">{idx + 1}.</span>
                  <div className="flex-1 space-y-3">
                    <div>
                      <Badge variant="outline" className="text-[10px] mb-1">{q.category}</Badge>
                      <p className="text-sm font-medium">{q.question}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {q.options.map(opt => (
                        <button
                          key={opt.score}
                          className={`text-left text-sm px-3 py-2 rounded-md border transition-colors ${
                            answers[q.id] === opt.score
                              ? "bg-accent/20 border-accent text-accent"
                              : "border-border/50 hover:bg-muted/50 text-foreground"
                          }`}
                          onClick={() => handleAnswer(q.id, opt.score)}
                          aria-pressed={answers[q.id] === opt.score}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {allAnswered && (
            <div className="text-center">
              <Button size="lg" onClick={() => setShowResults(true)} aria-label="View your results">
                View Your Risk Profile <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ─── Results ───────────────────────────────────────── */}
      {showResults && allAnswered && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Risk Score</p>
              <p className="text-lg font-semibold tabular-nums">{overallScore}/100</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Profile</p>
              <p className={`text-lg font-semibold ${profile.color}`}>{profile.name}</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Equity Target</p>
              <p className="text-lg font-semibold tabular-nums">{profile.equity}%</p>
            </div>
            <div className="bg-secondary/50 rounded-lg p-3 space-y-1">
              <p className="text-[10px] text-muted-foreground/70 uppercase tracking-wider">Fixed Income</p>
              <p className="text-lg font-semibold tabular-nums">{profile.fixed}%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Risk Factor Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {categoryScores.map(c => (
                  <div key={c.category} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.category}</span>
                      <span className="text-muted-foreground text-xs">{c.score}/10 (weight: {c.weight}x)</span>
                    </div>
                    <Progress value={c.score * 10} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Gauge */}
            <Card>
              <CardContent className="p-6 flex flex-col items-center justify-center">
                <PropensityGauge score={overallScore} label="Overall Risk Score" size="lg" />
                <Badge variant="outline" className={`mt-3 ${profile.color}`}>{profile.name}</Badge>
                <p className="text-xs text-muted-foreground mt-2 text-center max-w-xs">
                  Suitable for a portfolio with ~{profile.equity}% equities, ~{profile.fixed}% fixed income,
                  ~{profile.alternatives}% alternatives, and ~{profile.cash}% cash.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Recommended Allocation */}
          <LeadCaptureGate
            title="Unlock Portfolio Allocation Analysis"
            description="Enter your email to access rebalancing recommendations and personalized risk optimization."
            onCapture={() => {}}
          >
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Recommended Asset Allocation</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { asset: "Equities", pct: profile.equity, color: "bg-accent" },
                    { asset: "Fixed Income", pct: profile.fixed, color: "bg-emerald-500" },
                    { asset: "Alternatives", pct: profile.alternatives, color: "bg-purple-500" },
                    { asset: "Cash / Short-Term", pct: profile.cash, color: "bg-muted-foreground" },
                  ].map(a => (
                    <div key={a.asset} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-sm ${a.color}`} />
                          <span>{a.asset}</span>
                        </div>
                        <span className="font-mono text-xs">{a.pct}%</span>
                      </div>
                      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                        <div className={`absolute h-full ${a.color} rounded-full`} style={{ width: `${a.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Dynamic insights based on answers */}
            {(answers.lossTolerance ?? 0) <= 3 && (
              <CalculatorInsight
                title="Low Loss Tolerance Detected"
                summary="Your answers indicate discomfort with market downturns. A more conservative allocation with downside protection is recommended."
                detail="Consider bucket strategies: keep 2-3 years of expenses in cash/short-term bonds, so you never have to sell equities during a downturn. This psychological buffer helps investors stay the course."
                severity="warning"
              />
            )}
            {(answers.timeHorizon ?? 0) >= 8 && (answers.lossTolerance ?? 0) <= 3 && (
              <CalculatorInsight
                title="Time Horizon vs. Risk Tolerance Mismatch"
                summary="You have a long time horizon but low loss tolerance. Over 20+ years, conservative portfolios significantly underperform."
                detail="Historical data shows that over 20-year periods, a 60/40 portfolio has never lost money. Consider gradually increasing equity exposure while maintaining your psychological comfort through dollar-cost averaging."
                severity="info"
                actionLabel="Discuss with Advisor"
                onAction={() => navigate("/chat")}
              />
            )}
          </LeadCaptureGate>
        </>
      )}
    </div>
    </AppShell>
  );
}
