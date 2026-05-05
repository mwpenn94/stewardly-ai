/**
 * ChatGreeting — Manus-aligned clean chat empty state.
 * Minimal, centered, no glow effects. Simple card-based suggestions.
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
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
  { icon: GraduationCap, text: "Help me plan for my children's education" },
  { icon: Shield, text: "What insurance coverage gaps do I have?" },
  { icon: TrendingUp, text: "Run a retirement projection for me" },
  { icon: PiggyBank, text: "Help me compare investment strategies" },
];

const GUEST_SUGGESTIONS = [
  { icon: Shield, text: "How does life insurance protect my family?" },
  { icon: TrendingUp, text: "What's the difference between a Roth IRA and Traditional IRA?" },
  { icon: PiggyBank, text: "Help me understand index universal life insurance" },
  { icon: GraduationCap, text: "What should I know about estate planning?" },
];

const USER_SUGGESTIONS = SUGGESTION_CARDS;

const ADVISOR_SUGGESTIONS = [
  { icon: MessageSquare, text: "Help me build a client presentation" },
  { icon: TrendingUp, text: "Run a practice income projection" },
  { icon: Shield, text: "Compare IUL vs whole life for a client" },
  { icon: PiggyBank, text: "Draft a follow-up email for a prospect" },
];

const MANAGER_SUGGESTIONS = [
  { icon: TrendingUp, text: "Show me team production metrics" },
  { icon: MessageSquare, text: "Help me plan recruiting strategy" },
  { icon: PiggyBank, text: "Analyze our practice growth trajectory" },
  { icon: Shield, text: "What compliance items need attention?" },
];

// ── Animation ──────────────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
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
      .slice(0, 3);
  }, [recentConversations, isAuthenticated]);

  const timeOfDay = getTimeOfDay();
  const greeting = userName
    ? `Good ${timeOfDay}, ${userName.split(" ")[0]}.`
    : `Good ${timeOfDay}.`;

  return (
    <div className="flex flex-col items-center justify-center px-4 md:px-6 py-12 md:py-20 max-w-[640px] mx-auto w-full">
      {/* AI health warning — only shown when degraded */}
      {!aiHealthy && (
        <motion.div className="w-full flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm mb-8" initial="hidden" animate="visible" variants={variant} custom={0}>
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">{t("error.serverError", "AI services are experiencing issues. Responses may be slower.")}</span>
        </motion.div>
      )}

      {/* Greeting — clean, simple, like manus */}
      <motion.div className="text-center mb-8 md:mb-10" initial="hidden" animate="visible" variants={variant} custom={0.5}>
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
          {greeting}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated
            ? "What can I help you with?"
            : "Your AI-powered financial advisor. Ask anything."}
        </p>
      </motion.div>

      {/* Resume where you left off */}
      {resumeConversations.length > 0 && onResumeConversation && (
        <motion.div className="w-full mb-8" initial="hidden" animate="visible" variants={variant} custom={1}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 px-1">Continue where you left off</p>
          <div className="space-y-1">
            {resumeConversations.map((conv) => (
              <button type="button" key={conv.id} onClick={() => onResumeConversation(conv.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-primary/50 transition-colors group flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{conv.title}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(conv.updatedAt)}
                </span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sign-in CTA for unauthenticated users */}
      {!isAuthenticated && (
        <motion.div className="w-full flex justify-center mb-6" initial="hidden" animate="visible" variants={variant} custom={1.5}>
          <a
            href={getLoginUrl()}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
          >
            <LogIn className="w-4 h-4" />
            Sign in to save conversations
          </a>
        </motion.div>
      )}

      {/* Suggestion cards — horizontal scroll like manus */}
      <motion.div className="w-full max-w-4xl overflow-hidden" initial="hidden" animate="visible" variants={variant} custom={2}>
        <div
          className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', maskImage: 'linear-gradient(to right, black calc(100% - 2rem), transparent)', WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 2rem), transparent)' }}
        >
          {suggestions.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.button
                type="button"
                key={item.text}
                onClick={() => onSuggestionClick(item.text)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-left p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-all group shrink-0 w-[260px] min-h-[80px] active:scale-[0.97] touch-manipulation"
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent transition-colors">
                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {item.text}
                    </p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
