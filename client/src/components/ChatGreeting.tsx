/**
 * ChatGreetingV2 -- enhanced chat empty-state greeting with:
 * - Time-based greeting
 * - Role-specific suggestion chips with daily rotation (year-aware seed)
 * - Feature discovery cards (guest / user / advisor pools)
 * - AI health warning banner
 * - Reduced motion support
 */
import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Brain,
  Calculator,
  Shield,
  BookOpen,
  BarChart3,
  Users,
  AlertTriangle,
  MessageSquare,
  Zap,
  GraduationCap,
  TrendingUp,
} from "lucide-react";

// ── Types ───────────────────────────────────────────────────────────
export interface ChatGreetingV2Props {
  userName?: string;
  isAuthenticated: boolean;
  onSuggestionClick: (prompt: string) => void;
  userRole?: "user" | "client" | "advisor" | "manager" | "steward";
  aiHealthy?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Deterministic daily seed that includes the year (bug fix 6). */
function dailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 1000 + Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
}

/** Simple seeded shuffle (Fisher-Yates with a linear congruential PRNG). */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const copy = [...arr];
  let s = seed;
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function usePrefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// ── Suggestion chip pools ───────────────────────────────────────────
const GUEST_SUGGESTIONS = [
  "What can Stewardly help me with?",
  "Show me the retirement calculator",
  "How does multi-model consensus work?",
  "What compliance guardrails are built in?",
  "Tell me about the Wealth Engine",
  "How do I get started as a financial advisor?",
];

const USER_SUGGESTIONS = [
  "Review my financial protection score",
  "Run a quick retirement projection",
  "What insurance coverage do I need?",
  "Help me understand my portfolio allocation",
  "Compare term vs whole life scenarios",
  "What's my estimated tax liability?",
];

const ADVISOR_SUGGESTIONS = [
  "Analyze my pipeline for the week",
  "Draft a compliant client outreach email",
  "Run a strategy comparison for a 55-year-old client",
  "Show me practice-to-wealth benchmarks",
  "What CE credits am I missing?",
  "Generate a comprehensive financial plan PDF",
  "Review compliance flags from last week",
  "What are my top lead sources this month?",
];

const MANAGER_SUGGESTIONS = [
  "Show team performance dashboard",
  "Audit compliance across the team",
  "Review lead distribution metrics",
  "What's the pipeline conversion rate this quarter?",
  ...ADVISOR_SUGGESTIONS.slice(0, 4),
];

// ── Feature discovery cards ─────────────────────────────────────────
interface FeatureCard {
  icon: typeof Brain;
  title: string;
  description: string;
  prompt: string;
}

const GUEST_FEATURES: FeatureCard[] = [
  {
    icon: Brain,
    title: "AI-Powered Answers",
    description: "Ask any financial question and get an expert-level response.",
    prompt: "What can Stewardly help me with?",
  },
  {
    icon: Calculator,
    title: "Calculators",
    description: "Retirement, estate, tax, and insurance calculators built in.",
    prompt: "Show me the available calculators",
  },
  {
    icon: Shield,
    title: "Compliance-First",
    description: "Every response passes FINRA and regulatory guardrails.",
    prompt: "How does Stewardly handle compliance?",
  },
];

const USER_FEATURES: FeatureCard[] = [
  {
    icon: TrendingUp,
    title: "Financial Score",
    description: "See your 12-dimension financial protection score.",
    prompt: "Show me my financial protection score",
  },
  {
    icon: Calculator,
    title: "Run Projections",
    description: "Monte Carlo simulations and strategy comparisons.",
    prompt: "Run a retirement projection for me",
  },
  {
    icon: MessageSquare,
    title: "Ask Anything",
    description: "Multi-model consensus for complex financial questions.",
    prompt: "Help me understand my investment options",
  },
];

const ADVISOR_FEATURES: FeatureCard[] = [
  {
    icon: BarChart3,
    title: "Wealth Engine",
    description: "UWE, BIE, HE calculators with PDF report generation.",
    prompt: "Open the Wealth Engine dashboard",
  },
  {
    icon: Users,
    title: "Lead Pipeline",
    description: "Propensity scoring, enrichment, and Kanban management.",
    prompt: "Show me my lead pipeline",
  },
  {
    icon: GraduationCap,
    title: "Learning & Licensing",
    description: "SRS flashcards, quizzes, and CE credit tracking.",
    prompt: "What study content is recommended for me?",
  },
  {
    icon: Zap,
    title: "AI Agents",
    description: "Automated compliance, advisory, and carrier workflows.",
    prompt: "Show me available AI agents",
  },
];

// ── Animation variants ──────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

const noMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// ── Component ───────────────────────────────────────────────────────
export default function ChatGreetingV2({
  userName,
  isAuthenticated,
  onSuggestionClick,
  userRole = "user",
  aiHealthy = true,
}: ChatGreetingV2Props) {
  const reducedMotion = usePrefersReducedMotion();
  const variant = reducedMotion ? noMotionVariants : fadeUpVariants;

  // Pick the right suggestion pool based on role
  const suggestions = useMemo(() => {
    let pool: string[];
    if (!isAuthenticated) {
      pool = GUEST_SUGGESTIONS;
    } else if (userRole === "manager" || userRole === "steward") {
      pool = MANAGER_SUGGESTIONS;
    } else if (userRole === "advisor") {
      pool = ADVISOR_SUGGESTIONS;
    } else {
      pool = USER_SUGGESTIONS;
    }
    // Daily rotation with year-aware seed (bug fix 6)
    return seededShuffle(pool, dailySeed()).slice(0, 4);
  }, [isAuthenticated, userRole]);

  // Pick feature discovery cards
  const features = useMemo(() => {
    if (!isAuthenticated) return GUEST_FEATURES;
    if (userRole === "advisor" || userRole === "manager" || userRole === "steward") {
      return ADVISOR_FEATURES;
    }
    return USER_FEATURES;
  }, [isAuthenticated, userRole]);

  const greeting = getTimeGreeting();
  const displayName = userName ? `, ${userName}` : "";

  return (
    <div className="flex flex-col items-center justify-center gap-8 px-4 py-8 max-w-2xl mx-auto">
      {/* AI health warning */}
      {!aiHealthy && (
        <motion.div
          className="w-full flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          initial="hidden"
          animate="visible"
          variants={variant}
          custom={0}
        >
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">
            AI services are experiencing issues. Responses may be slower or
            unavailable.
          </span>
        </motion.div>
      )}

      {/* Greeting */}
      <motion.div
        className="text-center space-y-2"
        initial="hidden"
        animate="visible"
        variants={variant}
        custom={1}
      >
        <h2 className="font-heading text-2xl sm:text-3xl">
          {greeting}
          {displayName}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isAuthenticated
            ? "How can I help you today?"
            : "Ask me anything about financial planning, compliance, or calculators."}
        </p>
      </motion.div>

      {/* Suggestion chips */}
      <motion.div
        className="flex flex-wrap items-center justify-center gap-2 max-w-lg"
        initial="hidden"
        animate="visible"
        variants={variant}
        custom={2}
      >
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => onSuggestionClick(text)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground/80 hover:bg-accent/10 hover:border-accent/30 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Sparkles className="w-3 h-3 text-accent shrink-0" />
            {text}
          </button>
        ))}
      </motion.div>

      {/* Feature discovery cards */}
      <motion.div
        className="w-full grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        initial="hidden"
        animate="visible"
      >
        {features.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button
              key={card.title}
              type="button"
              onClick={() => onSuggestionClick(card.prompt)}
              className="flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md hover:shadow-accent/5 hover:border-accent/20 focus-visible:ring-2 focus-visible:ring-ring"
              variants={variant}
              custom={i + 3}
            >
              <div className="inline-flex items-center justify-center rounded-lg bg-accent/10 p-2">
                <Icon className="w-4 h-4 text-accent" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
