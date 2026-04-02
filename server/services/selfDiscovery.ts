/**
 * Self-Discovery Loop Service
 *
 * Generates personalized follow-up exploration queries after user inactivity.
 * Integrates with the 5-layer exponential engine to adapt discovery based on:
 * - User's current layer (Platform → Org → Manager → Professional → Client)
 * - Proficiency level and feature exploration history
 * - Undiscovered features that could benefit the user
 * - Discovery direction preference (deeper / broader / applied / auto)
 *
 * The service feeds back into the exponential engine, creating a continuous
 * improvement loop where each discovery interaction refines future suggestions.
 */

import { contextualLLM } from "../shared/stewardlyWiring";
import { getDb } from "../db";
import { selfDiscoveryHistory, userPreferences } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  assembleExponentialContext,
  detectUserLayer,
  FEATURE_CATALOG,
  trackEvent,
} from "./exponentialEngine";

// ── Types ────────────────────────────────────────────────────────────────

export type DiscoveryDirection = "deeper" | "broader" | "applied" | "auto";

export interface DiscoverySettings {
  enabled: boolean;          // autoFollowUp
  maxOccurrences: number;    // autoFollowUpCount
  idleThresholdMs: number;   // discoveryIdleThresholdMs
  direction: DiscoveryDirection; // discoveryDirection
  continuous: boolean;       // discoveryContinuous
}

export interface DiscoveryContext {
  lastUserQuery: string;
  lastAiResponse: string;
  conversationId: number;
  triggerMessageId?: number;
  userId: number;
  userRole: string;
}

export interface GeneratedDiscovery {
  query: string;
  direction: DiscoveryDirection;
  reasoning: string;
  relatedFeatures: string[];
  layerContext: string;
  proficiencyLevel: string;
}

// ── Settings CRUD ────────────────────────────────────────────────────────

export async function getDiscoverySettings(userId: number): Promise<DiscoverySettings> {
  const db = await getDb(); if (!db) return null as any;
  const prefs = await db.select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  const p = prefs[0];
  return {
    enabled: p?.autoFollowUp ?? false,
    maxOccurrences: p?.autoFollowUpCount ?? 1,
    idleThresholdMs: p?.discoveryIdleThresholdMs ?? 120000,
    direction: (p?.discoveryDirection as DiscoveryDirection) ?? "auto",
    continuous: p?.discoveryContinuous ?? false,
  };
}

export async function updateDiscoverySettings(
  userId: number,
  settings: Partial<DiscoverySettings>
): Promise<DiscoverySettings> {
  const db = await getDb(); if (!db) return null as any;
  const updateFields: Record<string, any> = {};
  if (settings.enabled !== undefined) updateFields.autoFollowUp = settings.enabled;
  if (settings.maxOccurrences !== undefined) updateFields.autoFollowUpCount = settings.maxOccurrences;
  if (settings.idleThresholdMs !== undefined) updateFields.discoveryIdleThresholdMs = settings.idleThresholdMs;
  if (settings.direction !== undefined) updateFields.discoveryDirection = settings.direction;
  if (settings.continuous !== undefined) updateFields.discoveryContinuous = settings.continuous;

  // Upsert
  const existing = await db.select({ id: userPreferences.id }).from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(userPreferences).set(updateFields).where(eq(userPreferences.userId, userId));
  } else {
    await db.insert(userPreferences).values({ userId, ...updateFields });
  }
  return getDiscoverySettings(userId);
}

// ── Auto Direction Selection ─────────────────────────────────────────────

function selectAutoDirection(
  proficiencyLevel: string,
  featuresExplored: number,
  featuresTotal: number,
  layerKey: string,
): DiscoveryDirection {
  const explorationRatio = featuresTotal > 0 ? featuresExplored / featuresTotal : 0;

  // New users → broader (discover more features)
  if (proficiencyLevel === "new_user" || explorationRatio < 0.3) return "broader";

  // Intermediate users → applied (practical next actions)
  if (proficiencyLevel === "beginner" || explorationRatio < 0.6) return "applied";

  // Advanced users → deeper (same topic, more detail)
  if (proficiencyLevel === "intermediate" || proficiencyLevel === "advanced") return "deeper";

  // Expert users → broader (cross-domain connections)
  if (proficiencyLevel === "expert") return "broader";

  // Layer-specific defaults
  if (layerKey === "client") return "applied";
  if (layerKey === "professional") return "deeper";
  if (layerKey === "manager" || layerKey === "organization") return "broader";

  return "deeper";
}

// ── LLM Query Generation ─────────────────────────────────────────────────

export async function generateDiscoveryQuery(
  context: DiscoveryContext,
  directionOverride?: DiscoveryDirection,
): Promise<GeneratedDiscovery> {
  // Assemble exponential engine context for this user
  const expCtx = await assembleExponentialContext(context.userId, context.userRole);
  const userLayer = await detectUserLayer(context.userId, context.userRole);

  // Determine direction
  let direction: DiscoveryDirection = directionOverride || "auto";
  if (direction === "auto") {
    // Check user settings first
    const settings = await getDiscoverySettings(context.userId);
    direction = settings.direction;
    if (direction === "auto") {
      direction = selectAutoDirection(
        expCtx.overallProficiency,
        expCtx.featuresExplored,
        expCtx.featuresTotal,
        userLayer.activeLayer,
      );
    }
  }

  // Build undiscovered features context
  const undiscoveredStr = expCtx.undiscoveredFeatures
    .slice(0, 8)
    .map(f => `- ${f.label}: ${f.description} (${f.layer})`)
    .join("\n");

  // Build recent activity context
  const recentStr = expCtx.recentActivity
    .slice(0, 5)
    .map(a => `- ${a.featureKey}: ${a.label} (${a.daysAgo}d ago)`)
    .join("\n");

  const directionInstructions: Record<string, string> = {
    deeper: "Go DEEPER into the same topic. Ask a more specific, nuanced, or advanced question that builds on the conversation. Explore underlying mechanisms, edge cases, or expert-level implications.",
    broader: "Go BROADER to related topics. Connect the conversation to adjacent domains, related features, or cross-disciplinary insights the user hasn't explored yet. Introduce new perspectives.",
    applied: "Go APPLIED with practical next actions. Generate a question about how to implement, use, or apply what was discussed. Focus on concrete steps, real-world scenarios, or hands-on exercises.",
  };

  const systemPrompt = `You are the Self-Discovery Engine for Stewardly, an AI-powered financial and general intelligence platform. Your role is to generate a single follow-up exploration query that continues the user's learning journey.

## User Context
- Layer: ${userLayer.activeLayer} (${userLayer.layerLabel})
- Proficiency: ${expCtx.overallProficiency} (${expCtx.featuresExplored}/${expCtx.featuresTotal} features explored)
- Streak: ${expCtx.streak} days

## Discovery Direction: ${direction.toUpperCase()}
${directionInstructions[direction]}

## Undiscovered Features (suggest exploring these when relevant)
${undiscoveredStr || "User has explored most features."}

## Recent Activity
${recentStr || "No recent activity tracked."}

## Rules
1. Generate ONE natural follow-up question (5-20 words) that feels like a curious continuation
2. The question should feel organic, not forced — like a thought that naturally follows
3. Adapt complexity to the user's proficiency level
4. When possible, subtly guide toward undiscovered features without being obvious
5. Never repeat the user's original question
6. Make it specific and actionable, not vague

Return a JSON object with:
- "query": the follow-up question string
- "reasoning": brief explanation of why this follow-up was chosen (1 sentence)
- "relatedFeatures": array of feature keys from the platform this connects to (max 3)`;

  const response = await contextualLLM({ userId: context.userId, contextType: "discovery",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Last user message: ${context.lastUserQuery.substring(0, 500)}` },
      { role: "assistant", content: `Last AI response: ${context.lastAiResponse.substring(0, 800)}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "discovery_query",
        strict: true,
        schema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The follow-up exploration question" },
            reasoning: { type: "string", description: "Why this follow-up was chosen" },
            relatedFeatures: {
              type: "array",
              items: { type: "string" },
              description: "Related platform feature keys",
            },
          },
          required: ["query", "reasoning", "relatedFeatures"],
          additionalProperties: false,
        },
      },
    },
  });

  const rawContent = response.choices[0]?.message?.content;
  const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}");

  return {
    query: parsed.query || "What else would you like to explore?",
    direction,
    reasoning: parsed.reasoning || "",
    relatedFeatures: Array.isArray(parsed.relatedFeatures) ? parsed.relatedFeatures.slice(0, 3) : [],
    layerContext: userLayer.activeLayer,
    proficiencyLevel: expCtx.overallProficiency,
  };
}

// ── History Management ───────────────────────────────────────────────────

export async function saveDiscoveryEntry(
  context: DiscoveryContext,
  discovery: GeneratedDiscovery,
  status: "generated" | "sent" | "dismissed" | "completed" = "generated",
): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const result = await db.insert(selfDiscoveryHistory).values({
    userId: context.userId,
    conversationId: context.conversationId,
    triggerMessageId: context.triggerMessageId || null,
    lastUserQuery: context.lastUserQuery.substring(0, 2000),
    lastAiResponse: context.lastAiResponse.substring(0, 2000),
    generatedQuery: discovery.query,
    direction: discovery.direction as "deeper" | "broader" | "applied",
    layerContext: discovery.layerContext,
    proficiencyLevel: discovery.proficiencyLevel,
    featureContext: discovery.relatedFeatures,
    status,
    userEngaged: false,
  });
  return Number(result[0].insertId);
}

export async function updateDiscoveryStatus(
  id: number,
  status: "generated" | "sent" | "dismissed" | "completed",
  userEngaged?: boolean,
): Promise<void> {
  const db = await getDb(); if (!db) return null as any;
  const updateFields: Record<string, any> = { status };
  if (userEngaged !== undefined) updateFields.userEngaged = userEngaged;
  await db.update(selfDiscoveryHistory).set(updateFields).where(eq(selfDiscoveryHistory.id, id));
}

export async function getDiscoveryHistory(
  userId: number,
  conversationId?: number,
  limit = 20,
): Promise<any[]> {
  const db = await getDb(); if (!db) return null as any;
  const conditions = [eq(selfDiscoveryHistory.userId, userId)];
  if (conversationId) conditions.push(eq(selfDiscoveryHistory.conversationId, conversationId));

  return db.select()
    .from(selfDiscoveryHistory)
    .where(and(...conditions))
    .orderBy(desc(selfDiscoveryHistory.createdAt))
    .limit(limit);
}

export async function getConversationDiscoveryCount(
  userId: number,
  conversationId: number,
): Promise<number> {
  const db = await getDb(); if (!db) return null as any;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(selfDiscoveryHistory)
    .where(and(
      eq(selfDiscoveryHistory.userId, userId),
      eq(selfDiscoveryHistory.conversationId, conversationId),
      sql`${selfDiscoveryHistory.status} IN ('sent', 'completed')`,
    ));
  return result[0]?.count ?? 0;
}

// ── Continuous Improvement Feedback ──────────────────────────────────────

/**
 * When a user engages with a self-discovery query (clicks it, responds to it),
 * this feeds back into the exponential engine to improve future suggestions.
 */
export async function recordDiscoveryEngagement(
  userId: number,
  discoveryId: number,
  engaged: boolean,
): Promise<void> {
  await updateDiscoveryStatus(discoveryId, engaged ? "completed" : "dismissed", engaged);

  // Get the discovery entry to extract feature context
  const db = await getDb(); if (!db) return null as any;
  const entries = await db.select()
    .from(selfDiscoveryHistory)
    .where(eq(selfDiscoveryHistory.id, discoveryId))
    .limit(1);

  if (entries.length > 0 && engaged) {
    const entry = entries[0];
    // Track as exponential engine event — discovery engagement
    await trackEvent({
      userId,
      eventType: "self_discovery_engaged",
      featureKey: "self_discovery",
      metadata: {
        direction: entry.direction,
        layerContext: entry.layerContext,
        relatedFeatures: entry.featureContext,
        proficiencyAtTime: entry.proficiencyLevel,
      },
    });

    // Also track related features as explored
    const relatedFeatures = Array.isArray(entry.featureContext) ? entry.featureContext : [];
    for (const featureKey of relatedFeatures) {
      const catalogEntry = FEATURE_CATALOG.find(f => f.key === featureKey);
      if (catalogEntry) {
        await trackEvent({
          userId,
          eventType: "feature_discovery",
          featureKey: featureKey as string,
          metadata: { source: "self_discovery", discoveryId },
        });
      }
    }
  } else if (!engaged) {
    // Track dismissal for future calibration
    await trackEvent({
      userId,
      eventType: "self_discovery_dismissed",
      featureKey: "self_discovery",
      metadata: { discoveryId },
    });
  }
}

// ── Main Trigger Function ────────────────────────────────────────────────

/**
 * Main entry point: checks settings, generates discovery query, saves to history.
 * Returns null if discovery should not be triggered (disabled, limit reached, etc.)
 */
export async function triggerSelfDiscovery(
  context: DiscoveryContext,
): Promise<{ id: number; discovery: GeneratedDiscovery } | null> {
  // Check user settings
  const settings = await getDiscoverySettings(context.userId);
  if (!settings.enabled) return null;

  // Check occurrence limit (unless continuous mode)
  if (!settings.continuous) {
    const sentCount = await getConversationDiscoveryCount(
      context.userId,
      context.conversationId,
    );
    if (sentCount >= settings.maxOccurrences) return null;
  }

  // Generate the discovery query
  const discovery = await generateDiscoveryQuery(context, settings.direction);

  // Save to history
  const id = await saveDiscoveryEntry(context, discovery, "generated");

  return { id, discovery };
}
