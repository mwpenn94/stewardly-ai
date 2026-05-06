/**
 * ChatGreeting — Manus-next aligned greeting + suggestion cards.
 * Clean serif greeting, subtitle, horizontal engine suggestion cards,
 * quick action pills. Progressive disclosure via 4 engine cards.
 */
import { useRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  LogIn,
  Calculator,
  Users,
  BookOpen,
  Database,
  TrendingUp,
  Shield,
  Target,
  Compass,
} from "lucide-react";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";

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

// ── Engine Suggestion Cards (maps to 4 engines via progressive disclosure) ──
const SUGGESTION_CARDS = [
  {
    id: "wealth",
    icon: Calculator,
    title: "Run a Financial Projection",
    description: "Model retirement, compare strategies, or analyze insurance gaps.",
    prompt: "Help me run a financial projection for retirement planning.",
  },
  {
    id: "people",
    icon: Users,
    title: "Manage Client Relationships",
    description: "Draft outreach, review pipeline, or prepare a client meeting.",
    prompt: "Help me prepare for my next client meeting and review my pipeline.",
  },
  {
    id: "learning",
    icon: BookOpen,
    title: "Study for Certification",
    description: "Review flashcards, practice exams, or explore new concepts.",
    prompt: "Help me study for my next financial certification exam.",
  },
  {
    id: "data",
    icon: Database,
    title: "Analyze Market Data",
    description: "Check market trends, review integrations, or pull reports.",
    prompt: "Show me the latest market trends and portfolio insights.",
  },
  {
    id: "planning",
    icon: Target,
    title: "Build a Financial Plan",
    description: "Create comprehensive plans with tax, estate, and risk analysis.",
    prompt: "Help me build a comprehensive financial plan for a client.",
  },
  {
    id: "intelligence",
    icon: Compass,
    title: "Competitive Intelligence",
    description: "Research competitors, product comparisons, and industry trends.",
    prompt: "Research competitive landscape and product comparisons in my market.",
  },
];

// ── Quick Action Pills ──────────────────────────────────────────────
const QUICK_ACTIONS = [
  { label: "Retirement projection", icon: TrendingUp, prompt: "Run a retirement income projection" },
  { label: "Compare strategies", icon: Calculator, prompt: "Compare investment strategies side by side" },
  { label: "Insurance review", icon: Shield, prompt: "Review my insurance coverage gaps" },
  { label: "Study flashcards", icon: BookOpen, prompt: "Help me study with flashcards for Series 65" },
  { label: "Draft outreach", icon: Users, prompt: "Draft a prospect follow-up email" },
];

const GUEST_QUICK_ACTIONS = [
  { label: "How does life insurance work?", icon: Shield, prompt: "How does life insurance work?" },
  { label: "Roth IRA vs Traditional", icon: Calculator, prompt: "Compare Roth IRA vs Traditional IRA" },
  { label: "Retirement planning", icon: TrendingUp, prompt: "Help me plan for retirement" },
  { label: "Index Universal Life", icon: Target, prompt: "What is index universal life insurance?" },
];

// ── Component ───────────────────────────────────────────────────────
export default function ChatGreetingV2({
  userName,
  isAuthenticated,
  onSuggestionClick,
  onEngineSelect,
  onResumeConversation,
  recentConversations = [],
}: ChatGreetingV2Props) {
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [activeDot, setActiveDot] = useState(0);

  const handleSuggestionsScroll = useCallback(() => {
    const el = suggestionsRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / (260 + 12));
    setActiveDot(Math.min(index, SUGGESTION_CARDS.length - 1));
  }, []);

  // Time-based greeting
  const greeting = (() => {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const name = userName?.split(" ")[0];
    return name ? `${timeGreeting}, ${name}.` : `${timeGreeting}.`;
  })();

  const quickActions = isAuthenticated ? QUICK_ACTIONS : GUEST_QUICK_ACTIONS;
  const resumeConversations = (recentConversations || []).filter((c) => (c.messageCount ?? 0) > 0 && c.title && c.title !== "New Conversation").slice(0, 3);

  return (
    <div className="h-full overflow-y-auto relative bg-background">
      <div className="relative z-10 flex flex-col items-center justify-start md:justify-center min-h-[calc(100%-60px)] px-3 md:px-6 pt-8 pb-8 md:py-12">
        {/* Greeting */}
        <motion.div
          className="text-center mb-6 md:mb-10"
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <h1
            className="text-3xl md:text-4xl font-semibold text-foreground mb-2 tracking-tight"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {greeting}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isAuthenticated
              ? "What can I help you with today?"
              : "Your AI-powered financial steward. Ask anything."}
          </p>
        </motion.div>

        {/* Quick Action Chips — horizontal scroll */}
        <motion.div
          className="w-full max-w-[640px] mb-6 md:mb-10 overflow-hidden"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div
            className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pr-8 md:pr-0"
            style={{
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
              maskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
              WebkitMaskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
            }}
          >
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => onSuggestionClick(action.prompt)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-border bg-transparent text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-all whitespace-nowrap shrink-0"
                style={{ scrollSnapAlign: "start" }}
              >
                <action.icon className="w-3.5 h-3.5" />
                {action.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Suggestion Cards — horizontal scroll like manus-next */}
        <motion.div
          className="w-full max-w-4xl overflow-hidden"
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.2 }}
        >
          <div
            ref={suggestionsRef}
            onScroll={handleSuggestionsScroll}
            className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-1 pr-8 md:pr-1"
            style={{
              scrollSnapType: "x mandatory",
              WebkitOverflowScrolling: "touch",
              scrollBehavior: "smooth",
              maskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
              WebkitMaskImage: "linear-gradient(to right, black calc(100% - 2rem), transparent)",
            }}
          >
            {SUGGESTION_CARDS.map((suggestion, i) => (
              <motion.button
                key={suggestion.title}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.15 + i * 0.04 }}
                onClick={() => {
                  if (onEngineSelect) {
                    onEngineSelect(suggestion.id, suggestion.prompt);
                  } else {
                    onSuggestionClick(suggestion.prompt);
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="text-left p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-all group shrink-0 w-[260px] min-h-[80px] active:scale-[0.97] touch-manipulation"
                style={{ scrollSnapAlign: "start" }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-accent transition-all">
                    <suggestion.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-all" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {suggestion.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                      {suggestion.description}
                    </p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
          {/* Pagination dots — mobile only */}
          <div className="flex items-center justify-center gap-3 mt-2 md:hidden">
            {SUGGESTION_CARDS.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  const el = suggestionsRef.current;
                  if (el) {
                    el.scrollTo({ left: i * (260 + 12), behavior: "smooth" });
                  }
                }}
                className="flex items-center justify-center w-11 h-11 -m-4 rounded-full transition-all duration-200"
                aria-label={`Go to suggestion ${i + 1}`}
              >
                <span
                  className={cn(
                    "rounded-full transition-all duration-200",
                    activeDot === i
                      ? "bg-foreground w-3 h-2"
                      : "bg-muted-foreground hover:bg-foreground/60 w-2 h-2 opacity-40 hover:opacity-60"
                  )}
                />
              </button>
            ))}
          </div>
        </motion.div>

        {/* Recent tasks — continue where you left off */}
        {isAuthenticated && resumeConversations.length > 0 && onResumeConversation && (
          <motion.div
            className="w-full max-w-[640px] mt-8"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <p className="text-xs text-muted-foreground mb-2 px-1">Continue where you left off</p>
            <div className="space-y-0.5">
              {resumeConversations.map((conv) => (
                <button
                  type="button"
                  key={conv.id}
                  onClick={() => onResumeConversation(conv.id)}
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors group flex items-center gap-2.5"
                >
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
          <motion.div
            className="w-full flex justify-center mt-8"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
          >
            <a
              href={getLoginUrl()}
              className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-5 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
            >
              <LogIn className="w-4 h-4" />
              Sign in to unlock all engines
            </a>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────
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
