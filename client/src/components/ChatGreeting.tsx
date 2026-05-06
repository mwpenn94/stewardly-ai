/**
 * ChatGreeting — Manus-aligned chat empty state with per-engine AI engagement.
 * Clean, centered, with engine cards that surface the AI substrate capabilities.
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
  Brain,
  Users,
  Database,
  BookOpen,
  Sparkles,
  Calculator,
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
  onEngineSelect?: (engineId: string, prompt: string) => void;
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

// ── Engine cards — per-engine AI engagement ─────────────────────────
const ENGINE_CARDS = [
  {
    id: "wealth",
    icon: Calculator,
    label: "Wealth Engine",
    description: "Projections, comparisons, planning",
    prompt: "I want to work with the Wealth Engine. Help me run a financial projection or compare strategies.",
    gradient: "from-blue-500/10 to-blue-600/5",
  },
  {
    id: "learning",
    icon: BookOpen,
    label: "Learning Engine",
    description: "Study, certifications, mastery",
    prompt: "I want to work with the Learning Engine. Help me study for my next certification or review flashcards.",
    gradient: "from-emerald-500/10 to-emerald-600/5",
  },
  {
    id: "people",
    icon: Users,
    label: "People Engine",
    description: "Leads, outreach, CRM",
    prompt: "I want to work with the People Engine. Help me manage leads, draft outreach, or analyze my pipeline.",
    gradient: "from-purple-500/10 to-purple-600/5",
  },
  {
    id: "data",
    icon: Database,
    label: "Data Engine",
    description: "Market data, integrations, feeds",
    prompt: "I want to work with the Data Engine. Show me market data, check my integrations, or analyze trends.",
    gradient: "from-amber-500/10 to-amber-600/5",
  },
];

// ── Quick suggestions — role-aware ──────────────────────────────────
const QUICK_SUGGESTIONS = [
  "Run a retirement projection",
  "Compare investment strategies",
  "Review my insurance gaps",
  "Help me study for Series 65",
];

const GUEST_QUICK = [
  "How does life insurance work?",
  "Roth IRA vs Traditional IRA",
  "What is index universal life?",
  "Help me plan for retirement",
];

const ADVISOR_QUICK = [
  "Build a client presentation",
  "Run practice income projection",
  "Compare IUL vs whole life",
  "Draft prospect follow-up",
];

const MANAGER_QUICK = [
  "Team production metrics",
  "Recruiting strategy",
  "Practice growth analysis",
  "Compliance review",
];

// ── Animation ──────────────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const noMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// ── Component ───────────────────────────────────────────────────────
export default function ChatGreetingV2({
  userName, isAuthenticated, onSuggestionClick, onEngineSelect, onResumeConversation,
  userRole = "user", aiHealthy = true, recentConversations,
}: ChatGreetingV2Props) {
  const { t } = useTranslation();
  const reducedMotion = usePrefersReducedMotion();
  const variant = reducedMotion ? noMotionVariants : fadeUpVariants;

  const quickSuggestions = useMemo(() => {
    let pool: string[];
    if (!isAuthenticated) pool = GUEST_QUICK;
    else if (userRole === "manager" || userRole === "steward") pool = MANAGER_QUICK;
    else if (userRole === "advisor") pool = ADVISOR_QUICK;
    else pool = QUICK_SUGGESTIONS;
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
    <div className="flex flex-col items-center justify-center px-4 md:px-6 py-8 md:py-16 max-w-[720px] mx-auto w-full">
      {/* AI health warning */}
      {!aiHealthy && (
        <motion.div className="w-full flex items-center gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm mb-6" initial="hidden" animate="visible" variants={variant} custom={0}>
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">{t("error.serverError", "AI services are experiencing issues. Responses may be slower.")}</span>
        </motion.div>
      )}

      {/* Greeting */}
      <motion.div className="text-center mb-8" initial="hidden" animate="visible" variants={variant} custom={0.5}>
        <h2 className="text-3xl md:text-4xl font-semibold text-foreground tracking-tight mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
          {greeting}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isAuthenticated
            ? "What can I help you with?"
            : "Your AI-powered financial advisor. Ask anything."}
        </p>
      </motion.div>

      {/* Engine cards — per-engine AI engagement */}
      {isAuthenticated && (
        <motion.div className="w-full grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-8" initial="hidden" animate="visible" variants={variant} custom={1}>
          {ENGINE_CARDS.map((engine) => {
            const Icon = engine.icon;
            return (
              <motion.button
                type="button"
                key={engine.id}
                onClick={() => onEngineSelect ? onEngineSelect(engine.id, engine.prompt) : onSuggestionClick(engine.prompt)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className={`relative text-left p-3.5 rounded-xl border border-border bg-gradient-to-br ${engine.gradient} hover:border-foreground/20 transition-all group overflow-hidden`}
              >
                <div className="flex flex-col gap-2">
                  <div className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur-sm flex items-center justify-center border border-border/50">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-foreground">{engine.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{engine.description}</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      )}

      {/* Resume where you left off */}
      {resumeConversations.length > 0 && onResumeConversation && (
        <motion.div className="w-full mb-6" initial="hidden" animate="visible" variants={variant} custom={1.5}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 px-1">Continue where you left off</p>
          <div className="space-y-1">
            {resumeConversations.map((conv) => (
              <button type="button" key={conv.id} onClick={() => onResumeConversation(conv.id)}
                className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group flex items-center gap-2.5">
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
            Sign in to unlock all engines
          </a>
        </motion.div>
      )}

      {/* Quick suggestions — text pills */}
      <motion.div className="w-full" initial="hidden" animate="visible" variants={variant} custom={2}>
        <div className="flex flex-wrap gap-2 justify-center">
          {quickSuggestions.map((text) => (
            <button
              type="button"
              key={text}
              onClick={() => onSuggestionClick(text)}
              className="px-3.5 py-2 text-xs rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-accent transition-all"
            >
              {text}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
