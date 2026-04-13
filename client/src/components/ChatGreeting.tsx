/**
 * ChatGreetingV2 -- enhanced chat empty-state greeting with:
 * - Time-based greeting
 * - "Resume where you left off" card for returning users (Pass 3)
 * - Proactive insight card surfacing top actionable insight (Pass 3)
 * - Active context sources indicator (Pass 3)
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
  BarChart3,
  Users,
  AlertTriangle,
  MessageSquare,
  Zap,
  GraduationCap,
  TrendingUp,
  Clock,
  ArrowRight,
  Lightbulb,
  FileText,
  Database,
  Fingerprint,
} from "lucide-react";

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
function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function dailySeed(): number {
  const now = new Date();
  return now.getFullYear() * 1000 + Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000
  );
}

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

function formatRelativeTime(date: string | Date | null): string {
  if (!date) return "";
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
  { icon: Brain, title: "AI-Powered Answers", description: "Ask any financial question and get an expert-level response.", prompt: "What can Stewardly help me with?" },
  { icon: Calculator, title: "Calculators", description: "Retirement, estate, tax, and insurance calculators built in.", prompt: "Show me the available calculators" },
  { icon: Shield, title: "Compliance-First", description: "Every response passes FINRA and regulatory guardrails.", prompt: "How does Stewardly handle compliance?" },
];

const USER_FEATURES: FeatureCard[] = [
  { icon: TrendingUp, title: "Financial Score", description: "See your 12-dimension financial protection score.", prompt: "Show me my financial protection score" },
  { icon: Calculator, title: "Run Projections", description: "Monte Carlo simulations and strategy comparisons.", prompt: "Run a retirement projection for me" },
  { icon: MessageSquare, title: "Ask Anything", description: "Multi-model consensus for complex financial questions.", prompt: "Help me understand my investment options" },
];

const ADVISOR_FEATURES: FeatureCard[] = [
  { icon: BarChart3, title: "Wealth Engine", description: "UWE, BIE, HE calculators with PDF report generation.", prompt: "Open the Wealth Engine dashboard" },
  { icon: Users, title: "Lead Pipeline", description: "Propensity scoring, enrichment, and Kanban management.", prompt: "Show me my lead pipeline" },
  { icon: GraduationCap, title: "Learning & Licensing", description: "SRS flashcards, quizzes, and CE credit tracking.", prompt: "What study content is recommended for me?" },
  { icon: Zap, title: "AI Agents", description: "Automated compliance, advisory, and carrier workflows.", prompt: "Show me available AI agents" },
];

// ── Animation variants ──────────────────────────────────────────────
import type { Variants } from "framer-motion";

const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: "easeOut" as const },
  }),
};

const noMotionVariants: Variants = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
};

// ── Component ───────────────────────────────────────────────────────
export default function ChatGreetingV2({
  userName, isAuthenticated, onSuggestionClick, onResumeConversation,
  userRole = "user", aiHealthy = true, recentConversations, topInsight, activeContextSources,
}: ChatGreetingV2Props) {
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

  const features = useMemo(() => {
    if (!isAuthenticated) return GUEST_FEATURES;
    if (userRole === "advisor" || userRole === "manager" || userRole === "steward") return ADVISOR_FEATURES;
    return USER_FEATURES;
  }, [isAuthenticated, userRole]);

  const greeting = getTimeGreeting();
  const displayName = userName ? `, ${userName}` : "";

  const resumeConversations = useMemo(() => {
    if (!recentConversations || !isAuthenticated) return [];
    return recentConversations
      .filter((c) => (c.messageCount ?? 0) > 0 && c.title && c.title !== "New Conversation")
      .slice(0, 3);
  }, [recentConversations, isAuthenticated]);

  const contextSourceCount = useMemo(() => {
    if (!activeContextSources) return 0;
    let count = 0;
    if (activeContextSources.documents && activeContextSources.documents > 0) count++;
    if (activeContextSources.memories && activeContextSources.memories > 0) count++;
    if (activeContextSources.financialProfile) count++;
    if (activeContextSources.integrations && activeContextSources.integrations > 0) count++;
    return count;
  }, [activeContextSources]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-4 py-8 max-w-2xl mx-auto">
      {!aiHealthy && (
        <motion.div className="w-full flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm" initial="hidden" animate="visible" variants={variant} custom={0}>
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-destructive">AI services are experiencing issues. Responses may be slower or unavailable.</span>
        </motion.div>
      )}

      <motion.div className="text-center space-y-2" initial="hidden" animate="visible" variants={variant} custom={1}>
        <h2 className="font-heading text-2xl sm:text-3xl">{greeting}{displayName}</h2>
        <p className="text-muted-foreground text-sm">
          {isAuthenticated ? "How can I help you today?" : "Ask me anything about financial planning, compliance, or calculators."}
        </p>
      </motion.div>

      {/* Pass 3: Active Context Sources Indicator */}
      {isAuthenticated && contextSourceCount > 0 && (
        <motion.div className="flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-2.5 text-xs text-muted-foreground" initial="hidden" animate="visible" variants={variant} custom={1.5}>
          <span className="font-medium text-foreground/70">AI Context Active:</span>
          <div className="flex items-center gap-2.5 flex-wrap">
            {activeContextSources?.documents && activeContextSources.documents > 0 && (
              <span className="inline-flex items-center gap-1 text-blue-400/80"><FileText className="w-3 h-3" />{activeContextSources.documents} doc{activeContextSources.documents > 1 ? "s" : ""}</span>
            )}
            {activeContextSources?.memories && activeContextSources.memories > 0 && (
              <span className="inline-flex items-center gap-1 text-purple-400/80"><Database className="w-3 h-3" />{activeContextSources.memories} memor{activeContextSources.memories > 1 ? "ies" : "y"}</span>
            )}
            {activeContextSources?.financialProfile && (
              <span className="inline-flex items-center gap-1 text-emerald-400/80"><Fingerprint className="w-3 h-3" />Financial profile</span>
            )}
            {activeContextSources?.integrations && activeContextSources.integrations > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-400/80"><Zap className="w-3 h-3" />{activeContextSources.integrations} integration{activeContextSources.integrations > 1 ? "s" : ""}</span>
            )}
          </div>
        </motion.div>
      )}

      {/* Pass 3: Resume Where You Left Off */}
      {resumeConversations.length > 0 && onResumeConversation && (
        <motion.div className="w-full space-y-2" initial="hidden" animate="visible" variants={variant} custom={2}>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            <Clock className="w-3 h-3" />Resume where you left off
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {resumeConversations.map((conv) => (
              <button key={conv.id} type="button" onClick={() => onResumeConversation(conv.id)}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all hover:shadow-md hover:shadow-accent/5 hover:border-accent/20 focus-visible:ring-2 focus-visible:ring-ring">
                <div className="shrink-0 mt-0.5 rounded-lg bg-accent/10 p-1.5"><MessageSquare className="w-3.5 h-3.5 text-accent" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate group-hover:text-accent transition-colors">{conv.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatRelativeTime(conv.updatedAt)}{conv.messageCount ? ` \u00b7 ${conv.messageCount} messages` : ""}
                  </p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-accent shrink-0 mt-1 transition-colors" />
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Pass 3: Proactive Insight Card */}
      {topInsight && isAuthenticated && (
        <motion.div className="w-full" initial="hidden" animate="visible" variants={variant} custom={2.5}>
          <button type="button"
            onClick={() => onSuggestionClick(topInsight.title ? `Tell me more about: ${topInsight.title}` : `Explain this insight: ${topInsight.content.substring(0, 100)}`)}
            className="w-full flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left transition-all hover:bg-amber-500/10 hover:border-amber-500/30 focus-visible:ring-2 focus-visible:ring-ring">
            <div className="shrink-0 rounded-lg bg-amber-500/10 p-2"><Lightbulb className="w-4 h-4 text-amber-500" /></div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500/70">Proactive Insight</span>
                {topInsight.priority === "critical" && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">Urgent</span>
                )}
              </div>
              {topInsight.title && <p className="text-sm font-medium mt-1">{topInsight.title}</p>}
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{topInsight.content}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-amber-500/40 shrink-0 mt-1" />
          </button>
        </motion.div>
      )}

      {/* Suggestion chips */}
      <motion.div className="flex flex-wrap items-center justify-center gap-2 max-w-lg" initial="hidden" animate="visible" variants={variant} custom={3}>
        {suggestions.map((text) => (
          <button key={text} type="button" onClick={() => onSuggestionClick(text)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm text-foreground/80 hover:bg-accent/10 hover:border-accent/30 hover:text-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring">
            <Sparkles className="w-3 h-3 text-accent shrink-0" />{text}
          </button>
        ))}
      </motion.div>

      {/* Feature discovery cards */}
      <motion.div className="w-full grid gap-3 sm:grid-cols-2 lg:grid-cols-3" initial="hidden" animate="visible">
        {features.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.button key={card.title} type="button" onClick={() => onSuggestionClick(card.prompt)}
              className="card-lift flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-shadow hover:shadow-md hover:shadow-accent/5 hover:border-accent/20 focus-visible:ring-2 focus-visible:ring-ring"
              variants={variant} custom={i + 4}>
              <div className="inline-flex items-center justify-center rounded-lg bg-accent/10 p-2"><Icon className="w-4 h-4 text-accent" /></div>
              <div>
                <h3 className="font-semibold text-sm">{card.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{card.description}</p>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
