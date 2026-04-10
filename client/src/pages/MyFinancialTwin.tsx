/**
 * MyFinancialTwin.tsx — The client's AI-built financial profile
 *
 * Pass 111. Centerpiece of the CLIENT persona layer.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint, Shield, Brain, ChevronRight, ChevronDown,
  Eye, EyeOff, Download, Trash2, Volume2, MessageSquare,
  AlertCircle, CheckCircle2, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import AppShell from "@/components/AppShell";

/* ── types ─────────────────────────────────────────────────────── */

interface FinancialTwinData {
  profile: {
    name: string;
    lifeStage: string;
    riskProfile: string;
    riskScore: number;
    lastUpdated: string;
  };
  goals: {
    id: string;
    title: string;
    category: "retirement" | "protection" | "estate" | "education" | "debt" | "growth";
    status: "on-track" | "needs-attention" | "not-started";
    confidence: number;
    lastDiscussed?: string;
    summary?: string;
  }[];
  financialSnapshot: {
    incomeRange?: string;
    netWorthRange?: string;
    taxBracket?: string;
    insuranceSummary?: string;
    investmentSummary?: string;
  };
  insights: {
    id: string;
    text: string;
    source: "conversation" | "document" | "assessment";
    date: string;
    actionable: boolean;
  }[];
  visibility: "private" | "professional" | "management" | "admin";
}

const GOAL_STATUS = {
  "on-track": { label: "On Track", icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  "needs-attention": { label: "Needs Attention", icon: AlertCircle, color: "text-amber-400", bg: "bg-amber-500/10" },
  "not-started": { label: "Not Started", icon: Clock, color: "text-muted-foreground", bg: "bg-muted/20" },
};

const RISK_LABELS = [
  "", "Very Conservative", "Conservative", "Moderately Conservative",
  "Moderate", "Moderate", "Moderately Aggressive", "Moderately Aggressive",
  "Aggressive", "Very Aggressive", "Very Aggressive",
];

interface Props {
  data?: FinancialTwinData;
  isLoading?: boolean;
  onVisibilityChange?: (v: FinancialTwinData["visibility"]) => void;
  onDeleteInsight?: (id: string) => void;
  onExport?: () => void;
  onAskAbout?: (context: string) => void;
}

function MyFinancialTwinView({
  data, isLoading, onVisibilityChange, onDeleteInsight, onExport, onAskAbout,
}: Props) {
  const audio = useAudioCompanion();
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [visibilityExpanded, setVisibilityExpanded] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 skeleton rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const readSummary = () => {
    const goalSummary = data.goals
      .filter(g => g.status !== "not-started")
      .map(g => `${g.title}: ${GOAL_STATUS[g.status].label}`)
      .join(". ");

    const script = `Your Financial Twin summary. Life stage: ${data.profile.lifeStage}. ` +
      `Risk profile: ${RISK_LABELS[data.profile.riskScore]}. ` +
      `You have ${data.goals.length} financial goals. ${goalSummary}. ` +
      `${data.insights.filter(i => i.actionable).length} actionable insights from recent conversations.`;

    audio.play({
      id: "financial-twin-summary",
      type: "page_narration",
      title: "Financial Twin Summary",
      script,
    });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-20 md:pb-6">
      {/* Hero */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Fingerprint className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold">Your Financial Twin</h1>
              <p className="text-sm text-muted-foreground">
                {data.profile.lifeStage} · {RISK_LABELS[data.profile.riskScore]} ·
                Updated {new Date(data.profile.lastUpdated).toLocaleDateString()}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-lg mt-2">
            Your twin learns from every conversation and document you share with Steward.
            The more you interact, the better it understands your financial picture.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={readSummary} className="gap-1.5 cursor-pointer">
            <Volume2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Listen</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onExport} className="gap-1.5 cursor-pointer">
            <Download className="w-3.5 h-3.5" /><span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </div>

      {/* Risk Profile */}
      <div className="p-4 rounded-xl border border-border bg-card/60 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Risk Profile</span>
          <span className="text-sm font-medium text-primary">{RISK_LABELS[data.profile.riskScore]}</span>
        </div>
        <div className="relative h-3 rounded-full bg-gradient-to-r from-emerald-500/30 via-amber-500/30 to-rose-500/30 overflow-hidden">
          <div className="absolute top-0 bottom-0 w-3 rounded-full bg-primary border-2 border-background shadow-md transition-all"
            style={{ left: `${(data.profile.riskScore - 1) * 11.1}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] text-muted-foreground/50">
          <span>Conservative</span><span>Moderate</span><span>Aggressive</span>
        </div>
      </div>

      {/* Goals */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 px-1">Goals & Priorities</h2>
        <div className="space-y-2">
          {data.goals.map(goal => {
            const status = GOAL_STATUS[goal.status];
            return (
              <div key={goal.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card/40">
                <div className={`w-8 h-8 rounded-lg ${status.bg} flex items-center justify-center flex-none`}>
                  <status.icon className={`w-4 h-4 ${status.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{goal.title}</div>
                  {goal.summary && <div className="text-xs text-muted-foreground mt-0.5 truncate">{goal.summary}</div>}
                </div>
                <div className="flex items-center gap-2 flex-none">
                  {goal.confidence > 0 && <div className="w-12"><Progress value={goal.confidence} className="h-1" /></div>}
                  <Button variant="ghost" size="sm" className="w-7 h-7 p-0 cursor-pointer"
                    onClick={() => onAskAbout?.(`Tell me about my ${goal.title.toLowerCase()} goal`)}>
                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Financial Snapshot */}
      <div className="mb-6">
        <button onClick={() => setShowSnapshot(!showSnapshot)}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-2 px-1 cursor-pointer hover:text-foreground transition-colors w-full">
          {showSnapshot ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          Financial Snapshot
          <ChevronDown className={`w-3 h-3 transition-transform ml-auto ${showSnapshot ? "" : "-rotate-90"}`} />
        </button>
        {showSnapshot && data.financialSnapshot && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="grid grid-cols-2 gap-2">
            {Object.entries(data.financialSnapshot).filter(([, v]) => v).map(([key, value]) => (
              <div key={key} className="px-3 py-2 rounded-lg border border-border bg-card/30">
                <div className="text-[10px] text-muted-foreground/50 capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</div>
                <div className="text-sm text-foreground">{value}</div>
              </div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Insights */}
      <div className="mb-6">
        <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3 px-1">Insights from Conversations</h2>
        <div className="space-y-2">
          {data.insights.slice(0, 6).map(insight => (
            <div key={insight.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${insight.actionable ? "border-primary/20 bg-primary/5" : "border-border bg-card/30"}`}>
              <Brain className="w-4 h-4 text-primary mt-0.5 flex-none" />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground">{insight.text}</div>
                <div className="text-[10px] text-muted-foreground mt-1">From {insight.source} · {new Date(insight.date).toLocaleDateString()}</div>
              </div>
              <button onClick={() => onDeleteInsight?.(insight.id)}
                className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-destructive cursor-pointer transition-colors flex-none">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy Controls */}
      <div className="p-4 rounded-xl border border-border bg-card/40">
        <button onClick={() => setVisibilityExpanded(!visibilityExpanded)} className="flex items-center justify-between w-full cursor-pointer">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Privacy: {data.visibility}</span>
          </div>
          <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${visibilityExpanded ? "rotate-90" : ""}`} />
        </button>
        {visibilityExpanded && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 space-y-2">
            {(["private", "professional", "management", "admin"] as const).map(level => (
              <button key={level} onClick={() => onVisibilityChange?.(level)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-left
                  ${data.visibility === level ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"}`}>
                <div className="flex-1">
                  <div className="text-sm font-medium capitalize">{level}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {level === "private" && "Only you can see this data"}
                    {level === "professional" && "You and your assigned advisor"}
                    {level === "management" && "You, your advisor, and their management"}
                    {level === "admin" && "All authorized personnel"}
                  </div>
                </div>
                {data.visibility === level && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ── Standalone route wrapper — fetches data from clientPortal ── */
const STATUS_MAP: Record<string, "on-track" | "needs-attention" | "not-started"> = {
  on_track: "on-track", needs_attention: "needs-attention", at_risk: "needs-attention",
};

export default function MyFinancialTwin() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  const twinQ = trpc.clientPortal.getFinancialTwin.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  if (!isAuthenticated) {
    return (
      <AppShell title="My Financial Twin">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Fingerprint className="w-12 h-12 mx-auto mb-4 text-accent/60" />
          <h2 className="text-lg font-heading font-semibold mb-2">Sign in to view your Financial Twin</h2>
          <p className="text-sm text-muted-foreground mb-4">Your AI-built financial profile assembles itself from your conversations, assessments, and goals.</p>
          <Button onClick={() => navigate("/signin")} className="bg-accent hover:bg-accent/90">Sign In</Button>
        </div>
      </AppShell>
    );
  }

  // Map server shape to component shape
  const mapped: FinancialTwinData | undefined = twinQ.data ? {
    profile: twinQ.data.profile,
    goals: twinQ.data.goals.map((g: any) => ({
      ...g,
      status: STATUS_MAP[g.status] ?? "not-started",
      category: g.category as any,
    })),
    financialSnapshot: {
      incomeRange: twinQ.data.financialSnapshot.annualIncome ?? undefined,
      netWorthRange: twinQ.data.financialSnapshot.netWorth ?? undefined,
    },
    insights: twinQ.data.insights.map((i: any) => ({
      id: i.id,
      text: i.text,
      source: "conversation" as const,
      date: i.createdAt,
      actionable: i.actionable,
    })),
    visibility: twinQ.data.visibility,
  } : undefined;

  return (
    <AppShell title="My Financial Twin">
      <MyFinancialTwinView data={mapped} isLoading={twinQ.isLoading} onAskAbout={(ctx) => navigate(`/chat?prompt=${encodeURIComponent(ctx)}`)} />
    </AppShell>
  );
}
