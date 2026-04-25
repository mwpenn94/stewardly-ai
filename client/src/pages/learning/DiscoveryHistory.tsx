/**
 * DiscoveryHistory.tsx — AI self-discovery follow-up questions log
 *
 * KE-inherited design: expandable discovery cards with 2px accent bars,
 * topic badges with discipline colors, inline AI responses,
 * font-display headings, font-mono metadata, motion animations.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Compass, ArrowLeft, Search, MessageCircle,
  Lightbulb, Clock, ChevronDown, ChevronUp,
  LogIn, Settings, Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const TOPIC_COLORS: Record<string, string> = {
  "Compliance": "#EF4444",
  "Investments": "#10B981",
  "Tax Planning": "#F59E0B",
  "Estate Planning": "#8B5CF6",
  "Insurance": "#EC4899",
  "Retirement": "#6366F1",
  "Risk Management": "#14B8A6",
};

export default function DiscoveryHistory() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // @ts-expect-error — property access on loosely typed object
  const historyQ = trpc.learningSocial.discoveryHistory.list.useQuery(
    { limit: 100 },
    { enabled: !!isAuthenticated }
  );

  const filteredHistory = useMemo(() => {
    const items = historyQ.data ?? [];
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter((h: any) =>
      (h.question ?? "").toLowerCase().includes(q) ||
      (h.answer ?? "").toLowerCase().includes(q) ||
      (h.topic ?? "").toLowerCase().includes(q)
    );
  }, [historyQ.data, searchTerm]);

  // Auth guard
  if (authLoading) {
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Discovery History" description="Your AI exploration journey" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Compass className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Discovery History
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to view your AI-guided exploration journey.
            </p>
            <a
              href={getLoginUrl("/learning/discovery")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const total = historyQ.data?.length ?? 0;

  return (
    <LearningShell>
      <SEOHead title="Discovery History" description="Your AI exploration journey" />
      <div className="min-h-screen px-6 lg:px-10 py-8">
        {/* Header — KE pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <Compass className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Discovery History
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {total} explorations
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search — KE pattern */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search discoveries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* List */}
        {historyQ.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : filteredHistory.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Compass className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              {searchTerm ? "No matches found" : "No discovery history yet"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              {searchTerm
                ? "Try adjusting your search criteria."
                : "Enable self-discovery in Settings to start exploring AI-guided follow-up questions."}
            </p>
            {!searchTerm && (
              <Link href="/settings">
                <motion.div
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-card text-sm font-medium hover:border-primary/30 transition-colors"
                >
                  <Settings className="w-3.5 h-3.5" /> Go to Settings
                </motion.div>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((item: any, i: number) => {
              const isExpanded = expandedId === item.id;
              const topicColor = TOPIC_COLORS[item.topic] || "var(--primary)";

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group relative bg-card border border-border rounded-xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  {/* Accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: topicColor }} />

                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Meta row */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${topicColor}20` }}>
                            <Lightbulb className="h-3 w-3" style={{ color: topicColor }} />
                          </div>
                          {item.topic && (
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded"
                              style={{ background: `${topicColor}15`, color: topicColor }}
                            >
                              {item.topic}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 ml-auto">
                            <Clock className="h-3 w-3" />
                            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}
                          </span>
                        </div>

                        {/* Question */}
                        <p className="text-sm font-medium" style={{ fontFamily: "var(--font-display)" }}>
                          {item.question}
                        </p>

                        {/* Expanded answer */}
                        <AnimatePresence>
                          {isExpanded && item.answer && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 p-3 rounded-lg bg-accent/30 border border-border/50">
                                <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground mb-2">
                                  <Sparkles className="h-3 w-3 text-primary" />
                                  AI Response
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                                  {item.answer}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      <button className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex-shrink-0">
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </LearningShell>
  );
}
