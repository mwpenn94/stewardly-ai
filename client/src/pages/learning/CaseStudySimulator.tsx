/**
 * CaseStudySimulator.tsx — Branching scenario decision engine
 *
 * Pass 113. Financial case studies with branching decisions.
 */

import { useState, useCallback, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, ShieldCheck, AlertTriangle, CheckCircle2,
  ChevronRight, Volume2, ArrowLeft, RotateCcw, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { useCelebration } from "@/lib/CelebrationEngine";
import { sendFeedback } from "@/lib/feedbackSpecs";
import { trpc } from "@/lib/trpc";

/* ── types ─────────────────────────────────────────────────────── */

interface CaseOption {
  key: string;
  text: string;
  consequence: string;
  score: number;
  complianceFlag?: string;
  nextDecisionIndex?: number;
}

interface CaseDecision {
  prompt: string;
  options: CaseOption[];
  audioScript?: string;
}

interface CaseStudyData {
  id: string;
  title: string;
  moduleSlug: string;
  clientProfile: string;
  situation: string;
  decisions: CaseDecision[];
  audioIntro?: string;
}

interface Props {
  caseStudy?: CaseStudyData;
  onBack?: () => void;
  onComplete?: (score: number, maxScore: number, complianceFlags: string[]) => void;
}

const DEMO_CASES: CaseStudyData[] = [
  {
    id: "demo-1",
    title: "High Net Worth Estate Planning",
    moduleSlug: "estate-planning",
    clientProfile: "A 62-year-old business owner with $8M in assets, married, 3 adult children.",
    situation: "The client wants to minimize estate taxes while ensuring equitable distribution among children, one of whom works in the family business.",
    decisions: [
      {
        prompt: "The client asks about transferring the business to the child who works there. What's your first recommendation?",
        options: [
          { key: "A", text: "Recommend an immediate full transfer via gift", consequence: "A full gift transfer could trigger significant gift tax liability and remove the client's control prematurely.", score: 3, complianceFlag: "Suitability concern: gift tax implications not fully disclosed" },
          { key: "B", text: "Suggest a buy-sell agreement with installment payments", consequence: "A buy-sell agreement provides a structured transition with fair market value documentation, useful for estate planning purposes.", score: 8, nextDecisionIndex: 1 },
          { key: "C", text: "Propose a family limited partnership (FLP)", consequence: "An FLP can provide valuation discounts and gradual transfer of ownership while retaining management control.", score: 9, nextDecisionIndex: 1 },
          { key: "D", text: "Recommend doing nothing until retirement", consequence: "Delaying planning could result in higher estate tax exposure and missed discount opportunities.", score: 2 },
        ],
      },
      {
        prompt: "The client is interested in your recommendation. They also want to ensure the other two children receive equitable value. How do you address this?",
        options: [
          { key: "A", text: "Recommend equal ownership splits across all three children", consequence: "Equal splits regardless of involvement can lead to conflicts and doesn't account for the working child's sweat equity.", score: 4 },
          { key: "B", text: "Use life insurance to equalize for non-business children", consequence: "An ILIT with sufficient coverage can provide equitable value to the non-business children without fragmenting business ownership.", score: 9 },
          { key: "C", text: "Suggest the business child buy out siblings over time", consequence: "This works but may strain the business with debt obligations and doesn't provide immediate security for the other children.", score: 6 },
        ],
      },
    ],
  },
  {
    id: "demo-2",
    title: "Retirement Income Strategy",
    moduleSlug: "retirement-planning",
    clientProfile: "A 58-year-old couple, both employed. Combined income $220K, $1.2M in 401(k), $300K in taxable brokerage, $50K in Roth IRA.",
    situation: "They want to retire at 62 but worry about the Medicare gap (62-65) and whether their savings can last 30+ years.",
    decisions: [
      {
        prompt: "The couple asks: 'Should we both retire at 62, or should one of us keep working until 65 for health insurance?' What do you recommend?",
        options: [
          { key: "A", text: "Both retire at 62 and use ACA marketplace insurance", consequence: "ACA coverage is viable but requires careful income management to stay within premium subsidy thresholds. Their 401(k) withdrawals could push them above the cliff.", score: 7 },
          { key: "B", text: "One spouse works until 65 for employer insurance", consequence: "This provides a bridge to Medicare and keeps one income stream. The working spouse's coverage can often extend to the retired spouse via COBRA or spousal benefits.", score: 9, nextDecisionIndex: 1 },
          { key: "C", text: "Both retire at 62 and rely on COBRA for 18 months", consequence: "COBRA premiums are typically 2-3x employee cost and only last 18 months — doesn't bridge the full gap to 65.", score: 4, complianceFlag: "Incomplete analysis: COBRA duration insufficient for Medicare gap" },
        ],
      },
      {
        prompt: "They agree with your recommendation. Now they ask about their withdrawal strategy for the first few years. What's the optimal sequence?",
        options: [
          { key: "A", text: "Draw from the taxable brokerage first, let tax-deferred grow", consequence: "Drawing from taxable first preserves tax-deferred growth and keeps their income low for ACA subsidies. Capital gains in the brokerage may be taxed at 0% if income is low enough.", score: 9 },
          { key: "B", text: "Take 401(k) distributions immediately since they're the largest bucket", consequence: "401(k) distributions are ordinary income — this could trigger higher ACA premiums, push them into a higher tax bracket, and accelerate depletion of the largest retirement asset.", score: 3, complianceFlag: "Tax efficiency concern: suboptimal withdrawal sequencing" },
          { key: "C", text: "Convert some 401(k) to Roth during low-income years", consequence: "Strategic Roth conversions during the income gap can fill up lower tax brackets. But must be balanced against ACA MAGI thresholds.", score: 8 },
        ],
      },
    ],
  },
  {
    id: "demo-3",
    title: "Premium Financing Suitability",
    moduleSlug: "premium-financing",
    clientProfile: "A 45-year-old surgeon earning $800K/yr, net worth $3M, $2M in real estate, $500K in securities, $500K in retirement accounts.",
    situation: "A carrier agent has proposed a $10M IUL policy financed at SOFR + 2%. The client asks you to evaluate whether this is suitable.",
    decisions: [
      {
        prompt: "You review the premium financing proposal. The projected credited rate is 7.5% with a 10% cap and 0% floor. Loan rate is 7.3%. What's your initial assessment?",
        options: [
          { key: "A", text: "The 0.2% positive spread is adequate — approve the plan", consequence: "A 0.2% spread is dangerously thin. If SOFR rises even slightly or credited rates underperform, the client goes underwater. This spread doesn't account for policy charges (COI, admin fees).", score: 2, complianceFlag: "Reg BI concern: thin spread does not justify the risk for a non-accredited suitability profile" },
          { key: "B", text: "Request a stress test showing what happens if SOFR rises 200bps", consequence: "This is the right move. A 200bps rate shock would flip the spread negative, and the client's collateral ($500K securities) would be at risk of a margin call. The stress test reveals the true risk profile.", score: 9, nextDecisionIndex: 1 },
          { key: "C", text: "Decline the proposal — premium financing is inherently unsuitable", consequence: "While caution is warranted, premium financing isn't categorically unsuitable for HNW clients. A blanket rejection misses the fiduciary duty to evaluate on its merits.", score: 5 },
        ],
      },
      {
        prompt: "The stress test shows that at SOFR + 400bps, the client would need to post an additional $300K in collateral by year 5. The client says 'I can handle it.' How do you proceed?",
        options: [
          { key: "A", text: "Accept the client's risk tolerance statement and proceed", consequence: "A verbal 'I can handle it' is insufficient documentation under Reg BI. The client may not understand the compounding nature of the loan balance in a rising-rate environment.", score: 3, complianceFlag: "Reg BI violation: insufficient documentation of risk disclosure and client understanding" },
          { key: "B", text: "Document the risks formally and require a signed acknowledgment", consequence: "Proper documentation with a detailed risk disclosure letter and signed acknowledgment protects both the client and the advisor. Include specific dollar amounts at various rate scenarios.", score: 9 },
          { key: "C", text: "Suggest reducing the face amount to lower the risk exposure", consequence: "A reasonable compromise. A $5M policy with the same structure halves the downside risk while still providing significant coverage. This balances the client's desire with suitability requirements.", score: 8 },
        ],
      },
    ],
  },
];

/** Parse a DB case row's content field into CaseStudyData structure */
function parseCaseFromDb(row: { id: number; title: string; content: string; tags?: unknown }): CaseStudyData | null {
  try {
    const parsed = JSON.parse(row.content);
    if (!parsed.decisions || !Array.isArray(parsed.decisions)) return null;
    return {
      id: `db-${row.id}`,
      title: row.title,
      moduleSlug: parsed.moduleSlug || "general",
      clientProfile: parsed.clientProfile || "",
      situation: parsed.situation || "",
      decisions: parsed.decisions,
      audioIntro: parsed.audioIntro,
    };
  } catch {
    return null;
  }
}

export default function CaseStudySimulator({ caseStudy, onBack, onComplete }: Props) {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/learning/case-study/:id");
  const audio = useAudioCompanion();
  const celebrate = useCelebration();

  // Fetch cases from DB (graceful fallback to demo data)
  const dbCases = trpc.learning.content.listCases.useQuery(undefined, {
    staleTime: 300_000,
    retry: false,
  });

  // Build available cases: DB cases (parsed) + demo fallbacks
  const availableCases = useMemo(() => {
    const parsed: CaseStudyData[] = [];
    if (dbCases.data && Array.isArray(dbCases.data)) {
      for (const row of dbCases.data as any[]) {
        const c = parseCaseFromDb(row);
        if (c) parsed.push(c);
      }
    }
    // Always include demo cases as fallbacks
    return parsed.length > 0 ? [...parsed, ...DEMO_CASES] : DEMO_CASES;
  }, [dbCases.data]);

  // Select case: prop > URL param > first available
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const resolvedCaseId = caseStudy?.id ?? selectedCaseId ?? params?.id ?? null;
  const cs = caseStudy ?? availableCases.find(c => c.id === resolvedCaseId) ?? availableCases[0];

  const [phase, setPhase] = useState<"intro" | "active" | "consequence" | "results">("intro");
  const [currentDecisionIdx, setCurrentDecisionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<CaseOption | null>(null);
  const [history, setHistory] = useState<{ decisionIdx: number; option: CaseOption }[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [maxPossibleScore, setMaxPossibleScore] = useState(0);
  const [complianceFlags, setComplianceFlags] = useState<string[]>([]);

  const currentDecision = cs.decisions[currentDecisionIdx];
  const handleBack = onBack ?? (() => navigate("/learning"));

  const handleSelect = useCallback((option: CaseOption) => {
    setSelectedOption(option);
    setPhase("consequence");
    setTotalScore(prev => prev + option.score);
    setMaxPossibleScore(prev => prev + Math.max(...currentDecision.options.map(o => o.score)));
    setHistory(prev => [...prev, { decisionIdx: currentDecisionIdx, option }]);
    if (option.complianceFlag) {
      setComplianceFlags(prev => [...prev, option.complianceFlag!]);
    }
  }, [currentDecision, currentDecisionIdx]);

  const handleContinue = useCallback(() => {
    if (!selectedOption) return;
    if (selectedOption.nextDecisionIndex !== undefined && selectedOption.nextDecisionIndex < cs.decisions.length) {
      setCurrentDecisionIdx(selectedOption.nextDecisionIndex);
      setSelectedOption(null);
      setPhase("active");
    } else {
      setPhase("results");
      const pct = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
      if (pct >= 70) celebrate("medium");
      // Pass 16 — PIL feedback dispatch (G1/G8).
      sendFeedback("learning.case_complete", { percentage: pct, complianceFlags });
      onComplete?.(totalScore, maxPossibleScore, complianceFlags);
    }
  }, [selectedOption, cs, totalScore, maxPossibleScore, complianceFlags, celebrate, onComplete]);

  const restart = () => {
    setPhase("intro");
    setCurrentDecisionIdx(0);
    setSelectedOption(null);
    setHistory([]);
    setTotalScore(0);
    setMaxPossibleScore(0);
    setComplianceFlags([]);
  };

  if (phase === "intro") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <button onClick={handleBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground cursor-pointer mb-6">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        {/* Case picker — show when multiple cases available and no specific case was passed */}
        {!caseStudy && availableCases.length > 1 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Choose a Case Study</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {availableCases.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelectedCaseId(c.id); restart(); }}
                  className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                    cs.id === c.id
                      ? "border-accent bg-accent/5"
                      : "border-border/50 bg-card/30 hover:border-border"
                  }`}
                  aria-label={`Select case study: ${c.title}`}
                >
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{c.clientProfile}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-6 rounded-xl border border-border bg-card/60">
          <h1 className="font-heading text-xl font-bold mb-4">{cs.title}</h1>
          <div className="flex items-start gap-3 mb-4 p-3 rounded-lg bg-primary/5 border border-primary/10">
            <Users className="w-5 h-5 text-primary flex-none mt-0.5" />
            <div>
              <div className="text-xs font-medium text-primary uppercase tracking-widest mb-1">Client Profile</div>
              <p className="text-sm text-foreground">{cs.clientProfile}</p>
            </div>
          </div>
          <div className="mb-6">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2">Situation</div>
            <p className="text-sm text-foreground leading-relaxed">{cs.situation}</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => setPhase("active")} className="gap-2 cursor-pointer">
              Begin Case Study <ChevronRight className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="gap-2 cursor-pointer"
              onClick={() => {
                audio.play({ id: `case-intro-${cs.id}`, type: "case_study", title: cs.title, script: cs.audioIntro || `${cs.title}. Client: ${cs.clientProfile}. ${cs.situation}` });
                setPhase("active");
              }}>
              <Volume2 className="w-4 h-4" /> Listen & Begin
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "results") {
    const pct = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    const passed = pct >= 70;
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <div className={`w-16 h-16 rounded-2xl ${passed ? "bg-emerald-500/10" : "bg-amber-500/10"} flex items-center justify-center mx-auto mb-4`}>
          {passed ? <Award className="w-8 h-8 text-emerald-400" /> : <RotateCcw className="w-8 h-8 text-amber-400" />}
        </div>
        <h2 className="font-heading text-2xl font-bold mb-2">{passed ? "Case Complete!" : "Review Needed"}</h2>
        <p className="text-3xl font-heading font-bold text-primary mb-1">{pct}%</p>
        <p className="text-sm text-muted-foreground mb-6">{totalScore}/{maxPossibleScore} points · {history.length} decisions</p>
        {complianceFlags.length > 0 && (
          <div className="text-left mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
            <h3 className="flex items-center gap-2 text-xs font-medium text-amber-400 uppercase tracking-widest mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Compliance Flags ({complianceFlags.length})
            </h3>
            <div className="space-y-1.5">
              {complianceFlags.map((flag, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 mt-0.5 flex-none" />
                  <span>{flag}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="text-left mb-6">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 px-1">Your Decisions</h3>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className={`p-3 rounded-lg border ${h.option.score >= 7 ? "border-emerald-500/20 bg-emerald-500/5" : h.option.score >= 4 ? "border-border bg-card/30" : "border-rose-500/20 bg-rose-500/5"}`}>
                <div className="text-xs text-muted-foreground mb-1">Decision {i + 1}</div>
                <div className="text-sm font-medium">{h.option.text}</div>
                <div className="text-xs text-muted-foreground mt-1">{h.option.consequence}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleBack} className="gap-1.5 cursor-pointer"><ArrowLeft className="w-4 h-4" /> Back</Button>
          <Button onClick={restart} className="gap-1.5 cursor-pointer"><RotateCcw className="w-4 h-4" /> Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
        <span>Decision {history.length + 1}</span>
        <span>{complianceFlags.length > 0 && `${complianceFlags.length} flag${complianceFlags.length > 1 ? "s" : ""}`}</span>
      </div>
      <AnimatePresence mode="wait">
        {phase === "active" && currentDecision && (
          <motion.div key={`decision-${currentDecisionIdx}`} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <h2 className="text-base font-medium text-foreground leading-relaxed mb-6">{currentDecision.prompt}</h2>
            <div className="space-y-2">
              {currentDecision.options.map(option => (
                <button key={option.key} onClick={() => handleSelect(option)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/40 hover:border-primary/30 hover:bg-card/70 text-left cursor-pointer transition-all">
                  <span className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground flex-none">{option.key}</span>
                  <span className="text-sm text-foreground">{option.text}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
        {phase === "consequence" && selectedOption && (
          <motion.div key="consequence" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className={`p-4 rounded-xl border mb-4 ${selectedOption.score >= 7 ? "border-emerald-500/30 bg-emerald-500/5" : selectedOption.score >= 4 ? "border-border bg-card/40" : "border-rose-500/30 bg-rose-500/5"}`}>
              <p className="text-sm text-foreground leading-relaxed mb-3">{selectedOption.consequence}</p>
              {selectedOption.complianceFlag && (
                <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <ShieldCheck className="w-4 h-4 text-amber-400 flex-none mt-0.5" />
                  <div className="text-xs text-amber-300">{selectedOption.complianceFlag}</div>
                </div>
              )}
            </div>
            <Button onClick={handleContinue} className="gap-1.5 cursor-pointer">
              {selectedOption.nextDecisionIndex !== undefined ? <>Continue <ChevronRight className="w-4 h-4" /></> : <>See Results <CheckCircle2 className="w-4 h-4" /></>}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
