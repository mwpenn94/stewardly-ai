/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sovereign Context Sources — ContextSourceRegistry Implementation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Registers ALL existing AEGIS data sources (the 15 from Stewardly) PLUS
 * 6 Sovereign-specific intelligence sources into the platform-agnostic
 * ContextSourceRegistry interface.
 *
 * AEGIS Sources (inherited from Stewardly — 15 total):
 *   1.  documents             — Enhanced TF-IDF document chunk retrieval
 *   2.  knowledgeBase         — Knowledge base article search
 *   3.  userProfile           — User profile & demographics
 *   4.  suitability           — Suitability assessment data
 *   5.  memory                — 3-tier memory engine (facts, preferences, episodes)
 *   6.  graph                 — Knowledge graph entities & relationships
 *   7.  pipelineData          — Government data pipelines (FRED, BLS, SEC, etc.)
 *   8.  conversationHistory   — Cross-conversation context
 *   9.  integrations          — Plaid, SnapTrade financial data
 *   10. calculators           — Calculator scenarios & financial models
 *   11. insights              — Proactive insights & engagement scores
 *   12. clientRelationships   — Advisor-client relationship data
 *   13. activityLog           — Notifications & recent activity
 *   14. tags                  — Document tag organization
 *   15. gapFeedback           — Knowledge gap analysis feedback
 *
 * Sovereign-Specific Sources (6 new):
 *   16. routingDecisions      — Task type, provider selections, quality scores
 *   17. goalsPlansAndTasks    — ATLAS agent kernel state (goals, plans, tasks)
 *   18. reflections           — Goal completion analysis & retrospectives
 *   19. providerUsageLogs     — Cost + latency per provider per call
 *   20. budgets               — Spending limits, alerts, and budget status
 *   21. autonomyState         — Graduated autonomy level, trust score, history
 */

import type { ContextSourceRegistry, SourceFetchOptions } from "./types";

// ── Import ALL AEGIS sources from Stewardly ─────────────────────────────────
import { stewardlyContextSources } from "./stewardlyContextSources";

// ── Sovereign-specific DB imports (lazy-loaded for resilience) ───────────────
import { getDb } from "../../db";
import { eq, desc, and, gte } from "drizzle-orm";

// Schema cache to avoid repeated dynamic imports on every source fetch
let _schemaCache: Awaited<typeof import("../../../drizzle/schema")> | null = null;
async function getSchema() {
  if (_schemaCache) return _schemaCache;
  try {
    _schemaCache = await import("../../../drizzle/schema");
    return _schemaCache;
  } catch {
    return null;
  }
}

// Autonomy module cache to avoid repeated dynamic imports
let _autonomyModCache: typeof import("../../services/graduatedAutonomy") | null = null;
async function getAutonomyMod() {
  if (_autonomyModCache) return _autonomyModCache;
  try {
    _autonomyModCache = await import("../../services/graduatedAutonomy");
    return _autonomyModCache;
  } catch {
    return null;
  }
}

// ─── SOVEREIGN SOURCE IMPLEMENTATIONS ──────────────────────────────────────

/**
 * Source 16: routingDecisions
 * Fetches recent AI routing decisions — which task type was detected,
 * which provider was selected, and the quality score of the result.
 * This gives the Sovereign layer visibility into its own decision history.
 */
async function fetchRoutingDecisions(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    // Query the sovereign_routing_decisions table
    const schema = await getSchema();
    const sovereignRoutingDecisions = schema?.sovereignRoutingDecisions ?? null;
    if (!sovereignRoutingDecisions) {
      // Fallback: assemble from available data
      return assembleFallbackRoutingContext(userId);
    }

    const decisions = await db
      .select()
      .from(sovereignRoutingDecisions)
      .where(eq(sovereignRoutingDecisions.userId, userId))
      .orderBy(desc(sovereignRoutingDecisions.createdAt))
      .limit(20);

    if (decisions.length === 0) return "";

    const parts: string[] = ["Recent Routing Decisions:"];
    for (const d of decisions) {
      const quality = d.qualityScore != null ? ` (quality: ${(d.qualityScore as number).toFixed(2)})` : "";
      parts.push(`  [${d.taskType}] → ${d.provider}${quality} | ${d.createdAt}`);
    }

    return parts.join("\n");
  } catch {
    return assembleFallbackRoutingContext(userId);
  }
}

/**
 * Fallback routing context when the dedicated table doesn't exist yet.
 * Assembles routing intelligence from existing platform data.
 */
async function assembleFallbackRoutingContext(_userId: number): Promise<string> {
  return "Routing decisions: No dedicated routing table available. Using default provider selection.";
}

/**
 * Source 17: goalsPlansAndTasks
 * Fetches the ATLAS agent kernel state — active goals, plans, and tasks.
 * This is the Sovereign layer's understanding of what the user is trying
 * to accomplish and what the AI system is working on.
 */
async function fetchGoalsPlansAndTasks(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    // Try to load from sovereign-specific tables first
    const schema = await getSchema();
    if (!schema) return "";

    const parts: string[] = ["ATLAS Agent Kernel State:"];

    // Goals from user profile goals + suitability financial goals
    if (schema.userProfiles) {
      const [profile] = await db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId))
        .limit(1);

      if (profile?.goals) {
        const goals = Array.isArray(profile.goals) ? profile.goals : [];
        if (goals.length > 0) {
          parts.push("  Active Goals:");
          goals.forEach((g: any, i: number) => parts.push(`    ${i + 1}. ${typeof g === "string" ? g : JSON.stringify(g)}`));
        }
      }
    }

    // Tasks from calculator scenarios (active financial plans)
    if (schema.calculatorScenarios) {
      const scenarios = await db
        .select()
        .from(schema.calculatorScenarios)
        .where(eq(schema.calculatorScenarios.userId, userId))
        .orderBy(desc(schema.calculatorScenarios.createdAt))
        .limit(5);

      if (scenarios.length > 0) {
        parts.push("  Active Plans/Tasks:");
        for (const s of scenarios) {
          parts.push(`    [${s.calculatorType}] ${s.name || "Unnamed"}`);
        }
      }
    }

    // Proactive insights as pending tasks
    if (schema.proactiveInsights) {
      const insights = await db
        .select()
        .from(schema.proactiveInsights)
        .where(
          and(
            eq(schema.proactiveInsights.userId, userId),
            eq(schema.proactiveInsights.status, "pending"),
          ),
        )
        .limit(5);

      if (insights.length > 0) {
        parts.push("  Pending Action Items:");
        for (const i of insights) {
          parts.push(`    [${i.category}] ${i.title}`);
        }
      }
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

/**
 * Source 18: reflections
 * Fetches goal completion analysis — how well did the AI perform on
 * previous goals, what was learned, and what should be adjusted.
 */
async function fetchReflections(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const schema = await getSchema();
    if (!schema) return "";

    const parts: string[] = ["Reflections & Completion Analysis:"];

    // Memory episodes serve as reflections on past interactions
    if (schema.memoryEpisodes) {
      const episodes = await db
        .select()
        .from(schema.memoryEpisodes)
        .where(eq(schema.memoryEpisodes.userId, userId))
        .orderBy(desc(schema.memoryEpisodes.createdAt))
        .limit(5);

      if (episodes.length > 0) {
        parts.push("  Recent Interaction Reflections:");
        for (const e of episodes) {
          const topics = Array.isArray(e.keyTopics) ? (e.keyTopics as string[]).join(", ") : "";
          parts.push(`    [${e.emotionalTone || "neutral"}] ${e.summary?.substring(0, 200) || "No summary"} (topics: ${topics})`);
        }
      }
    }

    // Knowledge gap feedback as reflection on what the AI couldn't handle
    if (schema.knowledgeGapFeedback) {
      const gaps = await db
        .select()
        .from(schema.knowledgeGapFeedback)
        .where(eq(schema.knowledgeGapFeedback.userId, userId))
        .orderBy(desc(schema.knowledgeGapFeedback.createdAt))
        .limit(5);

      if (gaps.length > 0) {
        parts.push("  Knowledge Gap Reflections:");
        for (const g of gaps) {
          parts.push(`    [${g.gapCategory || "general"}] ${g.gapTitle}: ${g.action}`);
        }
      }
    }

    return parts.length > 1 ? parts.join("\n") : "";
  } catch {
    return "";
  }
}

/**
 * Source 19: providerUsageLogs
 * Fetches cost and latency data per LLM provider per call.
 * Enables the Sovereign layer to make cost-aware routing decisions.
 */
async function fetchProviderUsageLogs(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    // Try sovereign-specific provider usage table
    const schema = await getSchema();
    if (!schema) return "";

    // Check for dedicated provider usage log table
    if (schema.sovereignProviderUsageLogs) {
      const logs = await db
        .select()
        .from(schema.sovereignProviderUsageLogs)
        .where(eq(schema.sovereignProviderUsageLogs.userId, userId))
        .orderBy(desc(schema.sovereignProviderUsageLogs.createdAt))
        .limit(20);

      if (logs.length > 0) {
        const parts: string[] = ["Provider Usage (recent):"];

        // Aggregate by provider
        const byProvider = new Map<string, { count: number; totalCost: number; avgLatency: number }>();
        for (const log of logs) {
          const key = log.provider as string;
          const existing = byProvider.get(key) || { count: 0, totalCost: 0, avgLatency: 0 };
          existing.count++;
          existing.totalCost += (log.costUsd as number) || 0;
          existing.avgLatency = (existing.avgLatency * (existing.count - 1) + ((log.latencyMs as number) || 0)) / existing.count;
          byProvider.set(key, existing);
        }

        for (const [provider, stats] of byProvider) {
          parts.push(`  ${provider}: ${stats.count} calls, $${stats.totalCost.toFixed(4)} total, ${Math.round(stats.avgLatency)}ms avg latency`);
        }

        return parts.join("\n");
      }
    }

    return "Provider usage: No usage logs available yet.";
  } catch {
    return "";
  }
}

/**
 * Source 20: budgets
 * Fetches spending limits, current spend, and alert thresholds.
 * Enables the Sovereign layer to respect cost constraints.
 */
async function fetchBudgets(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const schema = await getSchema();
    if (!schema) return "";

    // Check for sovereign budget table
    if (schema.sovereignBudgets) {
      const [budget] = await db
        .select()
        .from(schema.sovereignBudgets)
        .where(eq(schema.sovereignBudgets.userId, userId))
        .limit(1);

      if (budget) {
        const parts: string[] = ["Budget Status:"];
        parts.push(`  Monthly limit: $${(budget.monthlyLimitUsd as number)?.toFixed(2) || "unlimited"}`);
        parts.push(`  Current spend: $${(budget.currentSpendUsd as number)?.toFixed(4) || "0.00"}`);
        parts.push(`  Alert threshold: ${((budget.alertThresholdPct as number) || 80)}%`);
        const remaining = ((budget.monthlyLimitUsd as number) || 0) - ((budget.currentSpendUsd as number) || 0);
        parts.push(`  Remaining: $${remaining.toFixed(4)}`);
        if (budget.alertTriggered) {
          parts.push(`  ⚠ Budget alert triggered`);
        }
        return parts.join("\n");
      }
    }

    // Default: no budget constraints
    return "Budget: No spending limits configured.";
  } catch {
    return "";
  }
}

/**
 * Source 21: autonomyState
 * Fetches the graduated autonomy state — current level, trust score,
 * and level transition history. This is critical for the Sovereign
 * layer to understand what actions it can take autonomously.
 */
async function fetchAutonomyState(userId: number, _query: string): Promise<string> {
  try {
    const db = await getDb();
    if (!db) return "";

    const schema = await getSchema();
    if (!schema) return "";

    // Check for sovereign autonomy state table
    if (schema.sovereignAutonomyState) {
      const [state] = await db
        .select()
        .from(schema.sovereignAutonomyState)
        .where(eq(schema.sovereignAutonomyState.userId, userId))
        .limit(1);

      if (state) {
        const parts: string[] = ["Graduated Autonomy State:"];
        parts.push(`  Level: ${state.level}`);
        parts.push(`  Trust score: ${state.trustScore}`);
        parts.push(`  Total interactions: ${state.totalInteractions}`);
        parts.push(`  Successful actions: ${state.successfulActions}`);
        parts.push(`  Escalations: ${state.escalations}`);
        if (state.lastEscalation) {
          parts.push(`  Last escalation: ${state.lastEscalation}`);
        }
        return parts.join("\n");
      }
    }

    // Fallback: try DB-backed graduated autonomy service
    try {
      const autonomyMod = await getAutonomyMod();
      if (!autonomyMod) return "Autonomy: supervised (default)";
      const profile = await autonomyMod.getProfile(userId);
      const parts: string[] = ["Graduated Autonomy State:"];
      parts.push(`  Level: ${profile.level}`);
      parts.push(`  Trust score: ${profile.trustScore}`);
      parts.push(`  Total interactions: ${profile.totalInteractions}`);
      return parts.join("\n");
    } catch {
      return "Autonomy: supervised (default)";
    }
  } catch {
    return "";
  }
}

// ─── REGISTRY ASSEMBLY ──────────────────────────────────────────────────────

/**
 * The complete Sovereign context source registry.
 * ALL 15 AEGIS sources + 6 Sovereign-specific sources = 21 total.
 *
 * AEGIS Sources (1-15): Inherited from stewardlyContextSources
 * Sovereign Sources (16-21): New intelligence layer
 */
export const sovereignContextSources: ContextSourceRegistry = {
  // ── AEGIS Sources (all 15 inherited) ──────────────────────────────────────
  ...stewardlyContextSources,

  // ── Sovereign-Specific Sources (6 new) ────────────────────────────────────
  routingDecisions: fetchRoutingDecisions,
  goalsPlansAndTasks: fetchGoalsPlansAndTasks,
  reflections: fetchReflections,
  providerUsageLogs: fetchProviderUsageLogs,
  budgets: fetchBudgets,
  autonomyState: fetchAutonomyState,
};

export default sovereignContextSources;
