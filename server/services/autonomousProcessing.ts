/**
 * Autonomous Processing Loop — Divergence/Convergence exploration
 * Inspired by multi-model-ai-synthesizer's Discoveries feature
 *
 * Users can set AI on a loop (n iterations or endless until stopped)
 * with budget constraints. Supports 4 foci:
 *   - Discovery: explore new angles, find what's unknown
 *   - Apply: take findings and generate actionable steps
 *   - Connect: find relationships between disparate findings
 *   - Critique: challenge assumptions, find weaknesses
 *
 * Modes:
 *   - Diverge: broaden exploration, generate novel ideas
 *   - Converge: narrow toward optimized result
 */
import { getDb } from "../db";
import { logger } from "../_core/logger";

const log = logger.child({ module: "autonomousProcessing" });

export type ProcessingFocus = "discovery" | "apply" | "connect" | "critique" | "general";
export type ProcessingMode = "diverge" | "converge";

export interface ProcessingConfig {
  userId: number;
  topic: string;
  focus: ProcessingFocus; // primary focus (for single-focus runs, or 'general' for no specific focus)
  foci?: ProcessingFocus[]; // optional: cycle across these foci per iteration (empty = general mode)
  mode: ProcessingMode;
  maxIterations: number; // 0 = endless until stopped
  maxBudget: number; // max $ to spend
  model?: string;
  context?: string; // additional context from prior iterations
  promptType?: string; // optional: prompt category/type for loop-by-type runs
}

export interface ProcessingIteration {
  iteration: number;
  focus: ProcessingFocus;
  mode: ProcessingMode;
  content: string;
  model: string;
  tokensUsed: number;
  costEstimate: number;
  timestamp: Date;
}

export interface ProcessingSession {
  sessionId: string;
  userId: number;
  topic: string;
  status: "running" | "paused" | "completed" | "budget_exceeded" | "stopped";
  iterations: ProcessingIteration[];
  totalCost: number;
  startedAt: Date;
  stoppedAt?: Date;
}

// Active sessions (in-memory for fast access, persisted to DB)
const activeSessions = new Map<string, ProcessingSession>();

const FOCUS_PROMPTS: Record<ProcessingFocus, string> = {
  discovery: `You are exploring new territory. Find what's unknown, unasked, or overlooked about this topic. Generate novel angles, surprising connections, and questions nobody has asked yet. Push beyond the obvious. Be creative and expansive.`,
  apply: `Take the findings so far and generate concrete, actionable next steps. What should the user DO with this information? Create specific, implementable recommendations with timelines and expected outcomes.`,
  connect: `Find hidden relationships and patterns between the findings gathered so far. What connects seemingly unrelated data points? What patterns emerge? What does the synthesis reveal that individual findings don't?`,
  critique: `Challenge every assumption. Find weaknesses, blind spots, and potential failures in the current analysis. What could go wrong? What's being overlooked? Where might the reasoning be flawed? Be rigorous and adversarial.`,
  general: `You are a thorough analyst. Continue exploring this topic in depth. Build on previous findings, go deeper where warranted, and surface any new insights. Balance breadth and depth. Be comprehensive and insightful.`,
};

const MODE_MODIFIERS: Record<ProcessingMode, string> = {
  diverge: `DIVERGE: Generate multiple different perspectives. Breadth over depth. Explore alternative framings. What if the opposite were true? Consider adjacent domains. Quantity of ideas matters more than quality at this stage.`,
  converge: `CONVERGE: Synthesize and refine. Depth over breadth. Narrow to the strongest findings. Eliminate weak ideas. Optimize the remaining ones. Move toward a definitive, actionable conclusion.`,
};

export async function startSession(config: ProcessingConfig): Promise<string> {
  const sessionId = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const session: ProcessingSession = {
    sessionId,
    userId: config.userId,
    topic: config.topic,
    status: "running",
    iterations: [],
    totalCost: 0,
    startedAt: new Date(),
  };

  activeSessions.set(sessionId, session);
  log.info({ sessionId, topic: config.topic, focus: config.focus, mode: config.mode, maxIterations: config.maxIterations }, "Autonomous processing session started");

  // Run iterations asynchronously
  runIterations(sessionId, config).catch(e => {
    log.error({ sessionId, error: e.message }, "Processing session failed");
    session.status = "stopped";
  });

  return sessionId;
}

async function runIterations(sessionId: string, config: ProcessingConfig): Promise<void> {
  const session = activeSessions.get(sessionId);
  if (!session) return;

  const { contextualLLM } = await import("../shared/stewardlyWiring");
  let iteration = 0;
  let accumulatedContext = config.context || "";
  const fociCycle: ProcessingFocus[] = (config.foci && config.foci.length > 0) ? config.foci : [config.focus];

  while (session.status === "running") {
    iteration++;

    // Check iteration limit
    if (config.maxIterations > 0 && iteration > config.maxIterations) {
      session.status = "completed";
      break;
    }

    // Check budget
    if (session.totalCost >= config.maxBudget) {
      session.status = "budget_exceeded";
      log.warn({ sessionId, totalCost: session.totalCost, budget: config.maxBudget }, "Budget exceeded");
      break;
    }

    // Cycle foci across iterations — iteration 1 uses foci[0], iteration 2 uses foci[1], etc.
    const currentFocus: ProcessingFocus = fociCycle[(iteration - 1) % fociCycle.length];

    try {
      const typeHint = config.promptType ? `\n\nPrompt type: ${config.promptType}` : "";
      const prompt = `${FOCUS_PROMPTS[currentFocus]}\n\n${MODE_MODIFIERS[config.mode]}\n\nTopic: ${config.topic}${typeHint}\n\n${accumulatedContext ? `Previous findings:\n${accumulatedContext.slice(-2000)}\n\n` : ""}Iteration ${iteration}: Go deeper.`;

      const response = await contextualLLM({
        userId: config.userId,
        contextType: "analysis" as any,
        model: config.model,
        messages: [{ role: "user", content: prompt }],
      });

      const content = response.choices?.[0]?.message?.content || "";
      const tokens = (response.usage?.prompt_tokens || 0) + (response.usage?.completion_tokens || 0);
      const cost = tokens * 0.00001; // Rough estimate

      const iter: ProcessingIteration = {
        iteration,
        focus: currentFocus,
        mode: config.mode,
        content,
        model: response.model || config.model || "auto",
        tokensUsed: tokens,
        costEstimate: cost,
        timestamp: new Date(),
      };

      session.iterations.push(iter);
      session.totalCost += cost;
      accumulatedContext += `\n\n[Iteration ${iteration} - ${currentFocus}/${config.mode}]: ${content.slice(0, 500)}`;

      // Store in user_memories for RAG
      try {
        const { learn } = await import("./ragTrainer");
        await learn({ userId: config.userId, query: config.topic, response: content, model: iter.model });
      } catch { /* non-critical */ }

      log.debug({ sessionId, iteration, tokens, cost: cost.toFixed(4) }, "Iteration completed");

      // Brief pause between iterations to avoid rate limits
      await new Promise(r => setTimeout(r, 2000));
    } catch (e: any) {
      log.error({ sessionId, iteration, error: e.message }, "Iteration failed");
      // Continue on error — don't stop the whole session
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  session.stoppedAt = new Date();
  log.info({ sessionId, iterations: session.iterations.length, totalCost: session.totalCost.toFixed(4) }, "Processing session ended");
}

export function stopSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  if (!session || session.status !== "running") return false;
  session.status = "stopped";
  session.stoppedAt = new Date();
  return true;
}

export function getSession(sessionId: string): ProcessingSession | null {
  return activeSessions.get(sessionId) || null;
}

export function getUserSessions(userId: number): ProcessingSession[] {
  return Array.from(activeSessions.values()).filter(s => s.userId === userId);
}

export function getActiveSessionCount(): number {
  return Array.from(activeSessions.values()).filter(s => s.status === "running").length;
}
