/**
 * Task #51 — Agent Replay + Debugging Service
 * Record and replay AI agent decision chains for debugging and training
 */

export interface ReplayStep {
  stepIndex: number;
  timestamp: string;
  type: "input" | "reasoning" | "tool_call" | "tool_result" | "output" | "error" | "escalation";
  content: string;
  metadata?: Record<string, any>;
  duration?: number; // ms
}

export interface AgentReplaySession {
  id: string;
  conversationId: number;
  messageId?: number;
  userId?: number;
  agentType: string;
  startedAt: string;
  completedAt?: string;
  status: "recording" | "completed" | "error";
  steps: ReplayStep[];
  totalDuration?: number;
  toolsUsed: string[];
  knowledgeArticlesUsed: number[];
  capabilityMode: string;
  outcome: "success" | "partial" | "failure" | "escalated" | "pending";
  errorMessage?: string;
}

// In-memory replay store
const replaySessions = new Map<string, AgentReplaySession>();

export function startReplaySession(data: {
  conversationId: number; messageId?: number; userId?: number;
  agentType: string; capabilityMode: string;
}): AgentReplaySession {
  const session: AgentReplaySession = {
    id: `replay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    conversationId: data.conversationId,
    messageId: data.messageId,
    userId: data.userId,
    agentType: data.agentType,
    startedAt: new Date().toISOString(),
    status: "recording",
    steps: [],
    toolsUsed: [],
    knowledgeArticlesUsed: [],
    capabilityMode: data.capabilityMode,
    outcome: "pending",
  };
  replaySessions.set(session.id, session);
  return session;
}

export function addReplayStep(sessionId: string, step: Omit<ReplayStep, "stepIndex" | "timestamp">): ReplayStep | null {
  const session = replaySessions.get(sessionId);
  if (!session || session.status !== "recording") return null;

  const fullStep: ReplayStep = {
    ...step,
    stepIndex: session.steps.length,
    timestamp: new Date().toISOString(),
  };
  session.steps.push(fullStep);

  if (step.type === "tool_call" && step.metadata?.toolName) {
    if (!session.toolsUsed.includes(step.metadata.toolName)) {
      session.toolsUsed.push(step.metadata.toolName);
    }
  }

  return fullStep;
}

export function completeReplaySession(sessionId: string, outcome: AgentReplaySession["outcome"], errorMessage?: string): AgentReplaySession | null {
  const session = replaySessions.get(sessionId);
  if (!session) return null;

  session.status = outcome === "failure" || outcome === "escalated" ? "error" : "completed";
  session.completedAt = new Date().toISOString();
  session.outcome = outcome;
  session.errorMessage = errorMessage;
  session.totalDuration = new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime();

  return session;
}

export function getReplaySession(sessionId: string): AgentReplaySession | null {
  return replaySessions.get(sessionId) ?? null;
}

export function listReplaySessions(opts?: {
  conversationId?: number; userId?: number; outcome?: string; limit?: number;
}): AgentReplaySession[] {
  let sessions = Array.from(replaySessions.values());
  if (opts?.conversationId) sessions = sessions.filter(s => s.conversationId === opts.conversationId);
  if (opts?.userId) sessions = sessions.filter(s => s.userId === opts.userId);
  if (opts?.outcome) sessions = sessions.filter(s => s.outcome === opts.outcome);
  return sessions.sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, opts?.limit ?? 50);
}

export function getReplayStats(): {
  totalSessions: number;
  byOutcome: Record<string, number>;
  avgDuration: number;
  topTools: Array<{ tool: string; count: number }>;
} {
  const sessions = Array.from(replaySessions.values());
  const byOutcome: Record<string, number> = {};
  const toolCounts: Record<string, number> = {};

  for (const s of sessions) {
    byOutcome[s.outcome] = (byOutcome[s.outcome] ?? 0) + 1;
    for (const t of s.toolsUsed) {
      toolCounts[t] = (toolCounts[t] ?? 0) + 1;
    }
  }

  const completedSessions = sessions.filter(s => s.totalDuration);
  const avgDuration = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((s, sess) => s + (sess.totalDuration ?? 0), 0) / completedSessions.length)
    : 0;

  return {
    totalSessions: sessions.length,
    byOutcome,
    avgDuration,
    topTools: Object.entries(toolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tool, count]) => ({ tool, count })),
  };
}
