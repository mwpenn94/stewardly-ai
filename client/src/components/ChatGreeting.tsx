/**
 * ChatGreeting — Claude/Manus-style minimal chat empty state.
 *
 * Pass 130: Stripped down from 30+ interactive elements to a clean,
 * inviting greeting with:
 *   - Time-based personalized greeting
 *   - Resume where you left off (max 2 recent conversations)
 *   - 3–4 rotating suggestion prompts (role-aware)
 *   - AI health warning (only when degraded)
 *
 * All capability discovery moved to sidebar navigation and hub pages
 * where it belongs. The chat is for conversation, not a feature catalog.
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
const GUEST_SUGGESTIONS = [
  "How does life insurance protect my family?",
  "What's the difference between a Roth IRA and Traditional IRA?",
  "Help me understand index universal life insurance",
  "What should I know about estate planning?",
];

const USER_SUGGESTIONS = [
  "Run a retirement projection for me",
  "What's my financial protection score?",
  "Help me compare investment strategies",
  "Analyze my tax optimization options",
  "What insurance coverage gaps do I have?",
  "Help me plan for my children's education",
];

const ADVISOR_SUGGESTIONS = [
  "Help me build a client presentation",
  "Run a practice income projection",
  "Compare IUL vs whole life for a client",
  "Draft a follow-up email for a prospect",
  "What's the latest on Roth conversion strategies?",
  "Help me prepare for a client annual review",
];

const MANAGER_SUGGESTIONS = [
  "Show me team production metrics",
  "Help me plan recruiting strategy",
  "Analyze our practice growth trajectory",
  "What compliance items need attention?",
  "Compare our firm's compensation structure",
  "Help me build a business development plan",
];

// ── Animation ──────────────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: "easeOut" as const },
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
    let pool: string[];
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
    : `${t(`common.${timeOfDay}`, `Good ${timeOfDay}`)}`;
  // Fallback for common.morning/afternoon/evening — add to en.ts

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-4 py-16 max-w-xl mx-auto">
      {/* AI health warning — only shown when degraded */}
      {!aiHealthy && (
        <motion.div className="w-full flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" initial="hidden" animate="visible" variants={variant} custom={0}>
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">{t("error.serverError", "AI services are experiencing issues. Responses may be slower.")}</span>
        </motion.div>
      )}

      {/* Greeting — clean and personal */}
      <motion.div className="text-center space-y-2" initial="hidden" animate="visible" variants={variant} custom={1}>
        <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight">{greeting}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isAuthenticated
            ? t("chat.howCanIHelp")
            : t("chat.emptyState.description")}
        </p>
      </motion.div>

      {/* Resume where you left off — max 2, compact */}
      {resumeConversations.length > 0 && onResumeConversation && (
        <motion.div className="w-full space-y-2" initial="hidden" animate="visible" variants={variant} custom={2}>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 px-1">
            <Clock className="w-3 h-3" />
            <span>{t("chat.resumeWhereYouLeftOff")}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {resumeConversations.map((conv) => (
              <button type="button" key={conv.id} onClick={() => onResumeConversation(conv.id)}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-left transition-all duration-200 hover:bg-card/80 hover:border-primary/20 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring">
                <MessageSquare className="w-4 h-4 text-muted-foreground/50 group-hover:text-accent shrink-0 transition-colors" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{conv.title}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                    {formatRelativeTime(conv.updatedAt)}{conv.messageCount ? ` · ${conv.messageCount} messages` : ""}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-accent shrink-0 transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Sign-in CTA for unauthenticated users */}
      {!isAuthenticated && (
        <motion.div className="w-full flex justify-center" initial="hidden" animate="visible" variants={variant} custom={2.5}>
          <button
            type="button"
            onClick={() => { window.location.href = getLoginUrl(); }}
            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50 transition-all focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogIn className="w-4 h-4" />
            Sign in to save conversations & unlock all features
          </button>
        </motion.div>
      )}

      {/* Suggestion prompts — 3-4 rotating, clean pills */}
      <motion.div className="w-full flex flex-col items-center gap-2" initial="hidden" animate="visible" variants={variant} custom={3}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {suggestions.map((text) => (
            <button type="button" key={text} onClick={() => onSuggestionClick(text)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-card/30 px-4 py-2.5 text-sm text-foreground/70 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-200 focus-visible:ring-2 focus-visible:ring-ring shadow-sm hover:shadow">
              <Sparkles className="w-3 h-3 text-accent/60 shrink-0" />
              <span className="line-clamp-1">{text}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
