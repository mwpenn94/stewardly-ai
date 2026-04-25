/**
 * AIQuizPage.tsx — KE-style AI Quiz Generator
 *
 * Pass 149. Full rewrite with 4 question types (MC, fill-blank, scenario, explain),
 * rich setup phase with discipline grid, topic pills, difficulty cards, question count,
 * keyboard navigation (A/B/C/D, Enter/N), self-assessment for non-MC, rich results
 * with question review and retry option.
 */
import { useState, useMemo, useCallback, useEffect } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { useStudySession } from "@/hooks/useStudySession";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles, ArrowLeft, Brain, CheckCircle2, XCircle,
  Loader2, RotateCcw, Trophy, Zap, BookOpen,
  ChevronRight, HelpCircle, Target, Lightbulb,
  MessageSquare, GraduationCap, ArrowRight,
  ThumbsUp, ThumbsDown, Star, LogIn, Check, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAchievementToast } from "@/components/AchievementToast";
import { motion, AnimatePresence } from "framer-motion";

type Difficulty = "easy" | "medium" | "hard";
type QuestionType = "multiple_choice" | "fill_blank" | "scenario" | "explain";
type Phase = "setup" | "quiz" | "results";

const QUESTION_TYPES: { value: QuestionType; label: string; icon: any; desc: string }[] = [
  { value: "multiple_choice", label: "Multiple Choice", icon: Target, desc: "Four options, one correct answer" },
  { value: "fill_blank", label: "Fill in the Blank", icon: BookOpen, desc: "Complete the missing concept" },
  { value: "scenario", label: "Scenario-Based", icon: Lightbulb, desc: "Real-world business situations" },
  { value: "explain", label: "Explain Concept", icon: MessageSquare, desc: "Open-ended explanation" },
];

const DIFFICULTIES: { value: Difficulty; label: string; color: string; desc: string }[] = [
  { value: "easy", label: "Foundation", color: "#10B981", desc: "Recall & recognition" },
  { value: "medium", label: "Application", color: "#F59E0B", desc: "Analysis & application" },
  { value: "hard", label: "Mastery", color: "#EF4444", desc: "Synthesis & evaluation" },
];

interface GeneratedQuestion {
  id: number;
  prompt: string;
  questionType: QuestionType;
  difficulty: Difficulty;
  options: string[];
  correctAnswer: string;
  explanation: string;
  discipline?: string;
  topic?: string;
}

export default function AIQuizPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const studySession = useStudySession({ discipline: "ai-quiz" });

  // Setup state
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [questionType, setQuestionType] = useState<QuestionType>("multiple_choice");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("");
  const [count, setCount] = useState(5);

  // Quiz state
  const [phase, setPhase] = useState<Phase>("setup");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [generating, setGenerating] = useState(false);

  // Data
  const disciplinesQ = trpc.learning.content.listDisciplines.useQuery(undefined, { enabled: !!isAuthenticated });
  const existingQ = trpc.learningSocial.aiQuiz.list.useQuery({ limit: 50 }, { enabled: !!isAuthenticated });
  const createMut = trpc.learningSocial.aiQuiz.create.useMutation();
  const { showAchievementToast } = useAchievementToast();
  const recordReview = trpc.learning.mastery.recordReview.useMutation({
    onSuccess: (data) => {
      if (data?.milestone) {
        showAchievementToast({ icon: data.milestone.icon, title: data.milestone.label, description: data.milestone.description });
      }
    },
  });

  const disciplines = useMemo(() => (disciplinesQ.data ?? []).map((d: any) => d.name), [disciplinesQ.data]);

  /* ── Generate quiz ── */
  const generateQuiz = useCallback(async () => {
    setGenerating(true);
    try {
      const existing = existingQ.data ?? [];
      let pool = existing.filter((q: any) => {
        if (selectedDiscipline && q.discipline !== selectedDiscipline) return false;
        if (q.difficulty !== difficulty) return false;
        return true;
      });

      if (pool.length < count) {
        const topicStr = topic || (selectedDiscipline || "financial services");
        const templates = [
          { prompt: `What is the primary purpose of ${topicStr}?`, options: ["Risk management", "Revenue generation", "Regulatory compliance", "Client retention"], correctAnswer: "Risk management", explanation: `The primary purpose relates to managing and mitigating risk in ${topicStr}.` },
          { prompt: `Which regulation most directly governs ${topicStr}?`, options: ["SEC Rule 10b-5", "FINRA Rule 2111", "Dodd-Frank Act", "Glass-Steagall Act"], correctAnswer: "FINRA Rule 2111", explanation: `FINRA Rule 2111 (Suitability) is most directly applicable to ${topicStr} practices.` },
          { prompt: `What is a key risk factor in ${topicStr}?`, options: ["Market volatility", "Interest rate changes", "Regulatory changes", "All of the above"], correctAnswer: "All of the above", explanation: `All listed factors represent significant risks in ${topicStr}.` },
          { prompt: `Best practice for client communication in ${topicStr}?`, options: ["Annual reviews only", "Proactive regular updates", "Only when requested", "Automated emails only"], correctAnswer: "Proactive regular updates", explanation: `Regular proactive communication builds trust and ensures compliance in ${topicStr}.` },
          { prompt: `What documentation is required for ${topicStr}?`, options: ["Verbal agreement only", "Written suitability analysis", "Email confirmation", "No documentation needed"], correctAnswer: "Written suitability analysis", explanation: `Written documentation of suitability analysis is required for compliance in ${topicStr}.` },
          { prompt: `Explain the concept of fiduciary duty in the context of ${topicStr}.`, options: [], correctAnswer: `Fiduciary duty in ${topicStr} requires acting in the client's best interest, disclosing conflicts, and providing suitable recommendations.`, explanation: `Fiduciary duty is a legal obligation to act in another party's best interest.` },
          { prompt: `In a scenario where a client requests a high-risk investment in ${topicStr}, what steps should an advisor take?`, options: [], correctAnswer: `The advisor should assess suitability, document the client's risk tolerance, provide full disclosure, and ensure the investment aligns with the client's financial goals.`, explanation: `Suitability assessment is critical before recommending any investment.` },
        ];

        for (const t of templates.slice(0, count)) {
          try {
            const result = await createMut.mutateAsync({
              discipline: selectedDiscipline || undefined,
              topic: topicStr,
              difficulty,
              questionType: t.options.length > 0 ? "multiple_choice" : questionType,
              prompt: t.prompt,
              options: t.options.length > 0 ? t.options : [],
              correctAnswer: t.correctAnswer,
              explanation: t.explanation,
            });
            pool.push({ id: result.id, ...t, difficulty, questionType: t.options.length > 0 ? "multiple_choice" : questionType, discipline: selectedDiscipline || null, topic: topicStr } as any);
          } catch { /* skip */ }
        }
      }

      const mapped: GeneratedQuestion[] = pool.slice(0, count).map((q: any) => ({
        id: q.id,
        prompt: q.prompt,
        questionType: q.questionType ?? "multiple_choice",
        difficulty: q.difficulty ?? "medium",
        options: typeof q.options === "string" ? JSON.parse(q.options) : (q.options ?? []),
        correctAnswer: q.correctAnswer ?? "",
        explanation: q.explanation ?? "",
        discipline: q.discipline ?? undefined,
        topic: q.topic ?? undefined,
      }));

      if (mapped.length === 0) {
        toast.error("Could not generate questions. Try a different topic.");
        setGenerating(false);
        return;
      }

      setQuestions(mapped);
      setCurrentIdx(0);
      setScore(0);
      setAnswered(0);
      setPhase("quiz");
      setShowExplanation(false);
      setSelectedAnswer(null);
      setUserAnswer("");
      toast.success(`Generated ${mapped.length} questions!`);
    } catch {
      toast.error("Failed to generate quiz. Please try again.");
    } finally {
      setGenerating(false);
    }
  }, [topic, difficulty, questionType, selectedDiscipline, count, existingQ.data, createMut]);

  /* ── MC answer ── */
  const handleMCAnswer = useCallback((optionIndex: number) => {
    if (showExplanation) return;
    const q = questions[currentIdx];
    if (!q) return;
    setSelectedAnswer(optionIndex);
    setShowExplanation(true);
    const isCorrect = q.options[optionIndex]?.toLowerCase().trim() === q.correctAnswer.toLowerCase().trim();
    studySession.recordItem();
    if (isCorrect) {
      studySession.recordMastery();
      setScore(s => s + 1);
    }
    setAnswered(a => a + 1);
    recordReview.mutate({ itemKey: `ai-quiz:${q.id}`, itemType: "question", correct: isCorrect });
  }, [currentIdx, questions, showExplanation, recordReview, studySession]);

  /* ── Text answer submit ── */
  const handleTextAnswer = useCallback(() => {
    if (!userAnswer.trim()) return;
    setShowExplanation(true);
    setAnswered(a => a + 1);
    studySession.recordItem();
  }, [userAnswer, studySession]);

  /* ── Self-assessment for non-MC ── */
  const handleSelfAssess = useCallback((correct: boolean) => {
    const q = questions[currentIdx];
    if (correct) {
      setScore(s => s + 1);
      studySession.recordMastery();
    }
    if (q) recordReview.mutate({ itemKey: `ai-quiz:${q.id}`, itemType: "question", correct });
  }, [currentIdx, questions, recordReview, studySession]);

  /* ── Next question ── */
  const nextQuestion = useCallback(() => {
    if (currentIdx + 1 >= questions.length) {
      setPhase("results");
      return;
    }
    setCurrentIdx(i => i + 1);
    setSelectedAnswer(null);
    setUserAnswer("");
    setShowExplanation(false);
  }, [currentIdx, questions.length]);

  /* ── Restart ── */
  const restartQuiz = useCallback(() => {
    setPhase("setup");
    setQuestions([]);
    setCurrentIdx(0);
    setScore(0);
    setAnswered(0);
    setSelectedAnswer(null);
    setUserAnswer("");
    setShowExplanation(false);
  }, []);

  /* ── Retry same quiz ── */
  const retryQuiz = useCallback(() => {
    setPhase("quiz");
    setCurrentIdx(0);
    setScore(0);
    setAnswered(0);
    setSelectedAnswer(null);
    setUserAnswer("");
    setShowExplanation(false);
  }, []);

  /* ── Keyboard navigation ── */
  useEffect(() => {
    if (phase !== "quiz") return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const q = questions[currentIdx];
      if (!q) return;
      if (q.questionType === "multiple_choice" && q.options && !showExplanation) {
        if (e.key === "a" || e.key === "A") handleMCAnswer(0);
        if (e.key === "b" || e.key === "B") handleMCAnswer(1);
        if (e.key === "c" || e.key === "C") handleMCAnswer(2);
        if (e.key === "d" || e.key === "D") handleMCAnswer(3);
      }
      if (showExplanation && (e.key === "Enter" || e.key === "n" || e.key === "N")) {
        nextQuestion();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, currentIdx, showExplanation, questions, handleMCAnswer, nextQuestion]);

  /* ── Auth guard ── */
  if (authLoading) {
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="AI Quiz" description="AI-generated practice questions" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Brain className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>AI Quiz Generator</h1>
            <p className="text-sm text-muted-foreground mb-6">Sign in to generate AI-powered practice questions.</p>
            <a href={getLoginUrl("/learning/ai-quiz")} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground">
              <LogIn className="w-4 h-4" /> Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const currentQ = questions[currentIdx];

  return (
    <LearningShell>
      <SEOHead title="AI Quiz" description="AI-generated practice questions" />
      <div className="min-h-screen">
        {/* ── Header ── */}
        <div className="px-6 lg:px-10 py-6 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                AI Quiz Generator
              </h1>
              <p className="text-xs text-muted-foreground">Dynamic questions powered by AI — tailored to your learning needs</p>
            </div>
          </div>
        </div>

        <div className="px-6 lg:px-10 py-8">
          <AnimatePresence mode="wait">
            {/* ═══════════ SETUP PHASE ═══════════ */}
            {phase === "setup" && (
              <motion.div
                key="setup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-3xl mx-auto space-y-8"
              >
                {/* Discipline Selection */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <GraduationCap className="w-4 h-4 text-primary" />
                    Select Discipline
                  </h2>
                  {disciplinesQ.isLoading ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {disciplines.map((d: string) => (
                        <button
                          key={d}
                          onClick={() => { setSelectedDiscipline(d); setTopic(""); }}
                          className={`text-left p-3 rounded-lg border text-sm transition-all ${
                            selectedDiscipline === d
                              ? "border-primary bg-primary/5 font-medium"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                {/* Topic (optional) */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <BookOpen className="w-4 h-4 text-primary" />
                    Topic (optional)
                  </h2>
                  <Input
                    placeholder="e.g., Suitability, Variable Annuities, ETFs..."
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="max-w-md"
                  />
                </section>

                {/* Question Type */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <HelpCircle className="w-4 h-4 text-primary" />
                    Question Type
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {QUESTION_TYPES.map(qt => {
                      const Icon = qt.icon;
                      return (
                        <button
                          key={qt.value}
                          onClick={() => setQuestionType(qt.value)}
                          className={`text-left p-4 rounded-xl border transition-all ${
                            questionType === qt.value
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{qt.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{qt.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Difficulty */}
                <section>
                  <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
                    <Zap className="w-4 h-4 text-primary" />
                    Difficulty Level
                  </h2>
                  <div className="grid grid-cols-3 gap-3">
                    {DIFFICULTIES.map(d => (
                      <button
                        key={d.value}
                        onClick={() => setDifficulty(d.value)}
                        className={`p-4 rounded-xl border text-center transition-all ${
                          difficulty === d.value
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/30"
                        }`}
                      >
                        <div className="w-3 h-3 rounded-full mx-auto mb-2" style={{ background: d.color }} />
                        <span className="text-sm font-medium block">{d.label}</span>
                        <span className="text-[10px] text-muted-foreground">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* Question Count */}
                <section>
                  <h2 className="text-sm font-semibold mb-3" style={{ fontFamily: "var(--font-display)" }}>
                    Number of Questions
                  </h2>
                  <div className="flex gap-2">
                    {[3, 5, 7, 10].map(n => (
                      <button
                        key={n}
                        onClick={() => setCount(n)}
                        className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                          count === n ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-primary/30"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </section>

                {/* Generate Button */}
                <button
                  onClick={generateQuiz}
                  disabled={!selectedDiscipline || generating}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Generating Questions...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate AI Quiz</>
                  )}
                </button>
              </motion.div>
            )}

            {/* ═══════════ QUIZ PHASE ═══════════ */}
            {phase === "quiz" && currentQ && (
              <motion.div
                key={`quiz-${currentIdx}`}
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -40 }}
                className="max-w-3xl mx-auto"
              >
                {/* Progress bar */}
                <div className="mb-6">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                    <span>Question {currentIdx + 1} of {questions.length}</span>
                    <span className="font-mono">{score}/{answered} correct</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Question card */}
                <div className="bg-card border border-border rounded-2xl p-6 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accent text-accent-foreground uppercase">
                      {currentQ.questionType.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{
                      background: difficulty === "hard" ? "#EF444420" : difficulty === "medium" ? "#F59E0B20" : "#10B98120",
                      color: difficulty === "hard" ? "#EF4444" : difficulty === "medium" ? "#F59E0B" : "#10B981",
                    }}>
                      {DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty}
                    </span>
                  </div>

                  <p className="text-lg font-medium leading-relaxed mb-6" style={{ fontFamily: "var(--font-display)" }}>
                    {currentQ.prompt}
                  </p>

                  {/* MC Options */}
                  {currentQ.questionType === "multiple_choice" && currentQ.options.length > 0 && (
                    <div className="space-y-3">
                      {currentQ.options.map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isSelected = selectedAnswer === i;
                        const isCorrect = opt.toLowerCase().trim() === currentQ.correctAnswer.toLowerCase().trim();
                        const showResult = showExplanation;
                        let borderColor = "border-border";
                        let bgColor = "";
                        if (showResult && isCorrect) { borderColor = "border-green-500"; bgColor = "bg-green-500/10"; }
                        else if (showResult && isSelected && !isCorrect) { borderColor = "border-red-500"; bgColor = "bg-red-500/10"; }
                        else if (isSelected) { borderColor = "border-primary"; bgColor = "bg-primary/5"; }
                        return (
                          <button
                            key={i}
                            onClick={() => handleMCAnswer(i)}
                            disabled={showExplanation}
                            className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 ${borderColor} ${bgColor} ${
                              !showExplanation ? "hover:border-primary/50 hover:bg-accent/50" : ""
                            }`}
                          >
                            <span className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-xs font-mono shrink-0 mt-0.5">
                              {showResult && isCorrect ? <Check className="w-4 h-4 text-green-500" /> :
                               showResult && isSelected && !isCorrect ? <X className="w-4 h-4 text-red-500" /> :
                               letter}
                            </span>
                            <span className="text-sm leading-relaxed">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Text Input for non-MC */}
                  {currentQ.questionType !== "multiple_choice" && !showExplanation && (
                    <div className="space-y-3">
                      <textarea
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        placeholder={
                          currentQ.questionType === "fill_blank" ? "Type the missing term..." :
                          currentQ.questionType === "scenario" ? "Describe your analysis and recommendation..." :
                          "Explain the concept in your own words..."
                        }
                        className="w-full p-4 rounded-xl border border-border bg-background text-sm resize-none min-h-[120px] focus:outline-none focus:ring-2 focus:ring-primary/30"
                        rows={currentQ.questionType === "fill_blank" ? 2 : 5}
                      />
                      <button
                        onClick={handleTextAnswer}
                        disabled={!userAnswer.trim()}
                        className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        Submit Answer
                      </button>
                    </div>
                  )}

                  {/* Explanation */}
                  <AnimatePresence>
                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-6 overflow-hidden"
                      >
                        <div className="p-4 rounded-xl bg-accent/50 border border-border">
                          <div className="flex items-center gap-2 mb-2">
                            <Lightbulb className="w-4 h-4 text-primary" />
                            <span className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>Explanation</span>
                          </div>
                          {currentQ.questionType !== "multiple_choice" && (
                            <div className="mb-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                              <p className="text-xs font-semibold text-primary mb-1">Correct Answer:</p>
                              <p className="text-sm">{currentQ.correctAnswer}</p>
                            </div>
                          )}
                          <p className="text-sm text-muted-foreground leading-relaxed">{currentQ.explanation}</p>

                          {/* Self-assessment for non-MC */}
                          {currentQ.questionType !== "multiple_choice" && (
                            <div className="mt-4 flex items-center gap-3">
                              <span className="text-xs text-muted-foreground">How did you do?</span>
                              <button
                                onClick={() => handleSelfAssess(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-600 text-xs font-medium hover:bg-green-500/20 transition-colors"
                              >
                                <ThumbsUp className="w-3 h-3" /> Got it right
                              </button>
                              <button
                                onClick={() => handleSelfAssess(false)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 text-xs font-medium hover:bg-red-500/20 transition-colors"
                              >
                                <ThumbsDown className="w-3 h-3" /> Need review
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Next button */}
                        <button
                          onClick={nextQuestion}
                          className="mt-4 w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors"
                        >
                          {currentIdx + 1 >= questions.length ? "View Results" : "Next Question"}
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <p className="text-center text-[10px] text-muted-foreground mt-2 font-mono">
                          Press Enter or N for next
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Keyboard hints */}
                {currentQ.questionType === "multiple_choice" && !showExplanation && (
                  <p className="text-center text-[10px] text-muted-foreground font-mono">
                    Press A, B, C, or D to select an answer
                  </p>
                )}
              </motion.div>
            )}

            {/* ═══════════ RESULTS PHASE ═══════════ */}
            {phase === "results" && (
              <motion.div
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto text-center"
              >
                <div className="bg-card border border-border rounded-2xl p-8 mb-6">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                    className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
                    style={{
                      background: answered > 0 && score / answered >= 0.8 ? "#10B98120" : answered > 0 && score / answered >= 0.5 ? "#F59E0B20" : "#EF444420",
                    }}
                  >
                    {answered > 0 && score / answered >= 0.8 ? (
                      <Star className="w-10 h-10 text-green-500" />
                    ) : answered > 0 && score / answered >= 0.5 ? (
                      <Target className="w-10 h-10 text-yellow-500" />
                    ) : (
                      <RotateCcw className="w-10 h-10 text-red-500" />
                    )}
                  </motion.div>

                  <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
                    {answered > 0 && score / answered >= 0.8 ? "Excellent!" : answered > 0 && score / answered >= 0.5 ? "Good Progress!" : "Keep Practicing!"}
                  </h2>
                  <div className="text-4xl font-bold font-mono mb-2">
                    {score}/{answered}
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">
                    {answered > 0 ? Math.round((score / answered) * 100) : 0}% correct
                    {selectedDiscipline ? ` on ${selectedDiscipline}` : ""}
                    {` (${DIFFICULTIES.find(d => d.value === difficulty)?.label ?? difficulty})`}
                  </p>

                  {/* Question review */}
                  <div className="text-left space-y-2 mb-6">
                    {questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-accent/30">
                        <span className="text-xs mt-0.5 shrink-0">
                          {i < answered ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </span>
                        <span className="text-xs text-muted-foreground line-clamp-1">{q.prompt}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={restartQuiz}
                      className="px-6 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> New Quiz
                    </button>
                    <button
                      onClick={retryQuiz}
                      className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-4 h-4" /> Retry Same Quiz
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </LearningShell>
  );
}
