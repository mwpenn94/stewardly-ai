/**
 * CaseStudySimulator.tsx — Branching scenario decision engine
 *
 * Pass 113. Financial case studies with branching decisions.
 */

import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, ShieldCheck, AlertTriangle, CheckCircle2,
  ChevronRight, Volume2, ArrowLeft, RotateCcw, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { useCelebration } from "@/lib/CelebrationEngine";

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

const DEMO_CASE: CaseStudyData = {
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
};

export default function CaseStudySimulator({ caseStudy, onBack, onComplete }: Props) {
  const [, navigate] = useLocation();
  const audio = useAudioCompanion();
  const celebrate = useCelebration();
  const cs = caseStudy ?? DEMO_CASE;

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
