/**
 * ChatGreeting — Premium AI chat empty state.
 * Dramatic glass morphism cards, gradient glow, and premium typography.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  Sparkles,
  AlertTriangle,
  MessageSquare,
  Clock,
  ArrowRight,
  LogIn,
  Shield,
  TrendingUp,
  PiggyBank,
  GraduationCap,
} from "lucide-react";
import { getLoginUrl } from "@/const";

// ── Types ───────────────────────────────────────────────────────────
export interface RecentConversation {
  id: number;
  title: string;
  updatedAt: string | Date | null;
  messageCount?: number;
  mode?: string;
}

export interface ProactiveInsight {
  title?: string;
  content: string;
  priority?: string;
  category?: string;
}

export interface ChatGreetingV2Props {
  userName?: string;
  isAuthenticated: boolean;
  onSuggestionClick: (prompt: string) => void;
  onResumeConversation?: (id: number) => void;
  userRole?: "user" | "client" | "advisor" | "manager" | "steward";
  aiHealthy?: boolean;
  recentConversations?: RecentConversation[];
  topInsight?: ProactiveInsight | null;
  activeContextSources?: {
    documents?: number;
    memories?: number;
    financialProfile?: boolean;
    integrations?: number;
  };
}

// ── Helpers ─────────────────────────────────────────────────────────
function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

// ── Suggestion pools — role-aware, rotated daily ────────────────────
const SUGGESTION_CARDS = [
  { icon: GraduationCap, text: "Help me plan for my children's education", color: "from-blue-600/30 to-cyan-600/20 border-blue-400/40 hover:border-blue-300/70 hover:from-blue-600/40 hover:to-cyan-600/30" },
  { icon: Shield, text: "What insurance coverage gaps do I have?", color: "from-emerald-600/30 to-teal-600/20 border-emerald-400/40 hover:border-emerald-300/70 hover:from-emerald-600/40 hover:to-teal-600/30" },
  { icon: TrendingUp, text: "Run a retirement projection for me", color: "from-amber-600/30 to-orange-600/20 border-amber-400/40 hover:border-amber-300/70 hover:from-amber-600/40 hover:to-orange-600/30" },
  { icon: PiggyBank, text: "Help me compare investment strategies", color: "from-purple-600/30 to-violet-600/20 border-purple-400/40 hover:border-purple-300/70 hover:from-purple-600/40 hover:to-violet-600/30" },
];

const GUEST_SUGGESTIONS = [
  { icon: Shield, text: "How does life insurance protect my family?", color: "from-emerald-600/30 to-teal-600/20 border-emerald-400/40 hover:border-emerald-300/70 hover:from-emerald-600/40 hover:to-teal-600/30" },
  { icon: TrendingUp, text: "What's the difference between a Roth IRA and Traditional IRA?", color: "from-amber-600/30 to-orange-600/20 border-amber-400/40 hover:border-amber-300/70 hover:from-amber-600/40 hover:to-orange-600/30" },
  { icon: PiggyBank, text: "Help me understand index universal life insurance", color: "from-purple-600/30 to-violet-600/20 border-purple-400/40 hover:border-purple-300/70 hover:from-purple-600/40 hover:to-violet-600/30" },
  { icon: GraduationCap, text: "What should I know about estate planning?", color: "from-blue-600/30 to-cyan-600/20 border-blue-400/40 hover:border-blue-300/70 hover:from-blue-600/40 hover:to-cyan-600/30" },
];

const USER_SUGGESTIONS = SUGGESTION_CARDS;

const ADVISOR_SUGGESTIONS = [
  { icon: MessageSquare, text: "Help me build a client presentation", color: "from-blue-600/30 to-cyan-600/20 border-blue-400/40 hover:border-blue-300/70 hover:from-blue-600/40 hover:to-cyan-600/30" },
  { icon: TrendingUp, text: "Run a practice income projection", color: "from-amber-600/30 to-orange-600/20 border-amber-400/40 hover:border-amber-300/70 hover:from-amber-600/40 hover:to-orange-600/30" },
  { icon: Shield, text: "Compare IUL vs whole life for a client", color: "from-emerald-600/30 to-teal-600/20 border-emerald-400/40 hover:border-emerald-300/70 hover:from-emerald-600/40 hover:to-teal-600/30" },
  { icon: PiggyBank, text: "Draft a follow-up email for a prospect", color: "from-purple-600/30 to-violet-600/20 border-purple-400/40 hover:border-purple-300/70 hover:from-purple-600/40 hover:to-violet-600/30" },
];

const MANAGER_SUGGESTIONS = [
  { icon: TrendingUp, text: "Show me team production metrics", color: "from-amber-600/30 to-orange-600/20 border-amber-400/40 hover:border-amber-300/70 hover:from-amber-600/40 hover:to-orange-600/30" },
  { icon: MessageSquare, text: "Help me plan recruiting strategy", color: "from-blue-600/30 to-cyan-600/20 border-blue-400/40 hover:border-blue-300/70 hover:from-blue-600/40 hover:to-cyan-600/30" },
  { icon: PiggyBank, text: "Analyze our practice growth trajectory", color: "from-purple-600/30 to-violet-600/20 border-purple-400/40 hover:border-purple-300/70 hover:from-purple-600/40 hover:to-violet-600/30" },
  { icon: Shield, text: "What compliance items need attention?", color: "from-emerald-600/30 to-teal-600/20 border-emerald-400/40 hover:border-emerald-300/70 hover:from-emerald-600/40 hover:to-teal-600/30" },
];

// ── Animation ──────────────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const noMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// ── Component ───────────────────────────────────────────────────────
export default function ChatGreetingV2({
  userName, isAuthenticated, onSuggestionClick, onResumeConversation,
  userRole = "user", aiHealthy = true, recentConversations,
}: ChatGreetingV2Props) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const variant = reducedMotion ? noMotionVariants : fadeUpVariants;

  const suggestions = useMemo(() => {
    let pool: typeof SUGGESTION_CARDS;
    if (!isAuthenticated) pool = GUEST_SUGGESTIONS;
    else if (userRole === "manager" || userRole === "steward") pool = MANAGER_SUGGESTIONS;
    else if (userRole === "advisor") pool = ADVISOR_SUGGESTIONS;
    else pool = USER_SUGGESTIONS;
    return seededShuffle(pool, dailySeed()).slice(0, 4);
  }, [isAuthenticated, userRole]);

  const resumeConversations = useMemo(() => {
    if (!recentConversations || !isAuthenticated) return [];
    return recentConversations
      .filter((c) => (c.messageCount ?? 0) > 0 && c.title && c.title !== "New Conversation")
      .slice(0, 2);
  }, [recentConversations, isAuthenticated]);

  const timeOfDay = getTimeOfDay();
  const greeting = userName
    ? t("chat.greeting", { timeOfDay: t(`common.${timeOfDay}`, timeOfDay), name: userName })
    : `Good ${timeOfDay}`;

  return (
    <div className="flex flex-col items-center justify-center gap-10 px-4 py-20 max-w-2xl mx-auto relative">
      {/* Ambient glow behind the greeting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-[200px] h-[200px] rounded-full bg-blue-500/5 blur-[80px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/3 w-[200px] h-[200px] rounded-full bg-purple-500/5 blur-[80px] pointer-events-none" />
      
      {/* AI health warning — only shown when degraded */}
      {!aiHealthy && (
        <motion.div className="w-full flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 backdrop-blur-sm px-4 py-3 text-sm" initial="hidden" animate="visible" variants={variant} custom={0}>
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">{t("error.serverError", "AI services are experiencing issues. Responses may be slower.")}</span>
        </motion.div>
      )}

      {/* Greeting — clean and personal with gradient text */}
      <motion.div className="text-center space-y-4 relative z-10" initial="hidden" animate="visible" variants={variant} custom={1}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-primary/70" />
          <span className="text-xs font-medium text-primary/70 uppercase tracking-widest">AI Financial Advisor</span>
          <Sparkles className="w-5 h-5 text-primary/70" />
        </div>
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight not-italic bg-gradient-to-b from-foreground via-foreground/90 to-foreground/50 bg-clip-text text-transparent" style={{ fontStyle: 'normal' }}>
          {greeting}{userName ? "" : ", Guest User"}
        </h2>
        <p className="text-muted-foreground text-base leading-relaxed max-w-md mx-auto">
          {isAuthenticated
            ? "How can I help you today?"
            : "Your AI-powered financial advisor. Ask anything about planning, insurance, or investments."}
        </p>
      </motion.div>

      {/* Resume where you left off — max 2, glass cards */}
      {resumeConversations.length > 0 && onResumeConversation && (
        <motion.div className="w-full space-y-3 relative z-10" initial="hidden" animate="visible" variants={variant} custom={2}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 px-1">
            <Clock className="w-3 h-3" />
            <span>Continue where you left off</span>
          </div>
          <div className="flex flex-col gap-2">
            {resumeConversations.map((conv) => (
              <button type="button" key={conv.id} onClick={() => onResumeConversation(conv.id)}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm px-4 py-3.5 text-left transition-all duration-300 hover:bg-card hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-ring">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <MessageSquare className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{conv.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {formatRelativeTime(conv.updatedAt)}{conv.messageCount ? ` · ${conv.messageCount} messages` : ""}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 shrink-0 transition-all" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sign-in CTA for unauthenticated users */}
      {!isAuthenticated && (
        <motion.div className="w-full flex justify-center relative z-10" initial="hidden" animate="visible" variants={variant} custom={2.5}>
          <button
            type="button"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-sm px-6 py-3 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogIn className="w-4 h-4" />
            Sign in to save conversations & unlock all features
          </button>
        </motion.div>
      )}

      {/* Suggestion prompts — glass cards with icons and gradient borders */}
      <motion.div className="w-full relative z-10" initial="hidden" animate="visible" variants={variant} custom={3}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {suggestions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.button
                type="button"
                key={item.text}
                onClick={() => onSuggestionClick(item.text)}
                initial="hidden"
                animate="visible"
                variants={variant}
                custom={3 + idx * 0.15}
                className={`group flex items-start gap-3 rounded-xl border bg-gradient-to-br ${item.color} backdrop-blur-sm px-4 py-4 text-left transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]`}
              >
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/25 group-hover:scale-110 transition-all duration-300 shadow-sm">
                  <Icon className="w-4.5 h-4.5 text-foreground/90 group-hover:text-foreground transition-colors" />
                </div>
                <span className="text-sm text-foreground/80 group-hover:text-foreground leading-snug transition-colors pt-1">{item.text}</span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
