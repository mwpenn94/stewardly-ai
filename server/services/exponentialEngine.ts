/**
 * Exponential Engine v2
 * 
 * 5-Layer Hierarchy-Aware Continuous Improvement Engine
 * Cascade: Platform (L1) → Organization (L2) → Manager (L3) → Professional (L4) → Client (L5)
 * 
 * Core capabilities:
 * 1. trackEvent() — record a user platform interaction
 * 2. recalculateProficiency() — update proficiency scores with decay & streaks
 * 3. assembleExponentialContext() — build the AI prompt injection (5-layer aware)
 * 4. generateAIInsights() — LLM-powered personalized recommendations per layer
 * 5. generateOnboardingChecklist() — AI-adaptive checklist based on role, layer, proficiency
 * 6. getChangelogFeed() — layer-filtered changelog with unread counts
 */

import { getDb } from "../db";
import { logger } from "../_core/logger";
import {
  userPlatformEvents,
  userFeatureProficiency,
  platformChangelog,
  userChangelogAwareness,
  userOrganizationRoles,
} from "../../drizzle/schema";
import { eq, and, desc, sql, gt, isNull, inArray } from "drizzle-orm";

// ─── 5-LAYER DEFINITIONS ──────────────────────────────────────────────────
export const LAYER_HIERARCHY = [
  { id: 1, key: "platform", label: "Platform", description: "Global platform-level features and settings" },
  { id: 2, key: "organization", label: "Organization", description: "Organization-scoped features, branding, and compliance" },
  { id: 3, key: "manager", label: "Manager", description: "Team management, oversight, and delegation tools" },
  { id: 4, key: "professional", label: "Professional", description: "Advisory tools, client management, and case design" },
  { id: 5, key: "client", label: "Client", description: "Personal financial tools, AI chat, and self-service features" },
] as const;

export type LayerKey = typeof LAYER_HIERARCHY[number]["key"];

// ─── FEATURE CATALOG (5-Layer Annotated) ──────────────────────────────────
export const FEATURE_CATALOG: FeatureDefinition[] = [
  // Core — available at all layers
  { key: "chat", label: "AI Chat", category: "core", layer: "client", description: "Conversational AI assistant for general and financial guidance", roles: ["user", "professional", "manager", "admin"] },
  { key: "voice_mode", label: "Voice Mode", category: "core", layer: "client", description: "Hands-free voice interaction with the AI using speech-to-text and text-to-speech", roles: ["user", "professional", "manager", "admin"] },
  { key: "focus_mode", label: "Focus Mode", category: "core", layer: "client", description: "Adjust AI focus between General, Financial, or Study expertise", roles: ["user", "professional", "manager", "admin"] },
  { key: "suitability", label: "Suitability Assessment", category: "core", layer: "client", description: "Conversational assessment to personalize financial recommendations", roles: ["user", "professional", "manager", "admin"] },
  { key: "style_profile", label: "Communication Style", category: "core", layer: "client", description: "Personalize how the AI communicates — tone, depth, format preferences", roles: ["user", "professional", "manager", "admin"] },

  // Tools / Hubs — professional layer and above
  { key: "intelligence_hub", label: "Intelligence Hub", category: "tools", layer: "professional", description: "Economic data, AI models, analytics, and market intelligence dashboard", roles: ["professional", "manager", "admin"] },
  { key: "advisory_hub", label: "Advisory Hub", category: "tools", layer: "professional", description: "Product catalog, case design, and recommendation management", roles: ["professional", "manager", "admin"] },
  { key: "relationships_hub", label: "Relationships Hub", category: "tools", layer: "professional", description: "Contact management, meetings, and outreach campaigns", roles: ["professional", "manager", "admin"] },
  { key: "operations_hub", label: "Operations Hub", category: "tools", layer: "professional", description: "Active work tracking, AI agents, compliance reviews, and history", roles: ["professional", "manager", "admin"] },
  { key: "documents", label: "Documents & Knowledge Base", category: "tools", layer: "client", description: "Upload documents, training materials, and knowledge base articles for AI context", roles: ["user", "professional", "manager", "admin"] },

  // AI Features — available at client layer
  { key: "calculators", label: "Financial Calculators", category: "ai_features", layer: "client", description: "IUL projection, premium finance ROI, retirement aggregator, product comparator — all accessible via chat", roles: ["user", "professional", "manager", "admin"] },
  { key: "image_generation", label: "AI Visual Generation", category: "ai_features", layer: "client", description: "Generate charts, diagrams, and infographics within chat conversations", roles: ["user", "professional", "manager", "admin"] },
  { key: "follow_up_suggestions", label: "Follow-up Suggestions", category: "ai_features", layer: "client", description: "Contextual follow-up prompt pills after each AI response", roles: ["user", "professional", "manager", "admin"] },
  { key: "rich_responses", label: "Rich Response Cards", category: "ai_features", layer: "client", description: "Interactive result cards, comparison views, timelines, charts, and quizzes in AI responses", roles: ["user", "professional", "manager", "admin"] },
  { key: "web_search", label: "AI Web Search", category: "ai_features", layer: "client", description: "AI can search the web for real-time information during conversations", roles: ["user", "professional", "manager", "admin"] },
  { key: "memory", label: "AI Memory", category: "ai_features", layer: "client", description: "AI remembers facts, preferences, and context from past conversations", roles: ["user", "professional", "manager", "admin"] },

  // Settings & Integrations — varies by layer
  { key: "integrations", label: "Data Integrations", category: "integrations", layer: "organization", description: "Connect external data sources (Plaid, CRMs, market data APIs) to enrich AI context", roles: ["user", "professional", "manager", "admin"] },
  { key: "ai_settings", label: "AI Configuration", category: "settings", layer: "professional", description: "Adjust AI temperature, creativity, context depth, and model behavior", roles: ["professional", "manager", "admin"] },
  { key: "ai_layers", label: "AI Layers", category: "settings", layer: "manager", description: "5-layer cascading AI configuration: Platform → Organization → Manager → Professional → User", roles: ["manager", "admin"] },
  { key: "knowledge_base", label: "Knowledge Base Management", category: "settings", layer: "organization", description: "Manage articles, FAQs, and training content that the AI references", roles: ["professional", "manager", "admin"] },

  // Admin — platform layer
  { key: "admin_users", label: "User Management", category: "admin", layer: "platform", description: "Manage users, roles, and permissions across the platform", roles: ["admin"] },
  { key: "admin_organizations", label: "Organization Management", category: "admin", layer: "platform", description: "Manage organizations, teams, and multi-tenant settings", roles: ["admin"] },
  { key: "admin_compliance", label: "Compliance Dashboard", category: "admin", layer: "manager", description: "Review audit trails, compliance logs, and privacy audits", roles: ["manager", "admin"] },

  // Manager layer
  { key: "improvement_engine", label: "Improvement Engine", category: "tools", layer: "manager", description: "AI-driven continuous improvement recommendations for each layer", roles: ["advisor", "manager", "admin"] },
  { key: "manager_dashboard", label: "Manager Dashboard", category: "tools", layer: "manager", description: "Team performance, oversight, and delegation dashboard", roles: ["manager", "admin"] },
  { key: "portal", label: "Advisor Portal", category: "tools", layer: "professional", description: "Professional workspace with client management and case tools", roles: ["advisor", "manager", "admin"] },
  { key: "market_data", label: "Market Data", category: "tools", layer: "professional", description: "Real-time market data, economic indicators, and trend analysis", roles: ["user", "professional", "manager", "admin"] },
  // Integration Health & Continuous Improvement
  { key: "integration_health", label: "Integration Health Dashboard", category: "tools", layer: "organization", description: "Monitor connected data source health, uptime, latency, and AI data awareness", roles: ["professional", "manager", "admin"] },
  { key: "integration_improvement", label: "Integration Improvement Agent", category: "ai_features", layer: "organization", description: "AI-driven monitoring that detects degraded connections, suggests fixes, and logs improvement actions", roles: ["manager", "admin"] },
  { key: "data_source_awareness", label: "AI Data Source Awareness", category: "ai_features", layer: "organization", description: "AI automatically knows which external data sources are live, degraded, or offline and adapts responses accordingly", roles: ["user", "professional", "manager", "admin"] },
];

export interface FeatureDefinition {
  key: string;
  label: string;
  category: string;
  layer: LayerKey;
  description: string;
  roles: string[];
}

// ─── EVENT TRACKING ─────────────────────────────────────────────────────────

export async function trackEvent(params: {
  userId: number;
  eventType: string;
  featureKey: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(userPlatformEvents).values({
      userId: params.userId,
      eventType: params.eventType,
      featureKey: params.featureKey,
      metadata: params.metadata || null,
      sessionId: params.sessionId || null,
    });
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] trackEvent error:", e);
  }
}

// ─── PROFICIENCY RECALCULATION (with Decay & Streaks) ───────────────────────

const PROFICIENCY_THRESHOLDS = {
  novice: 1,
  familiar: 5,
  proficient: 20,
  expert: 50,
};

const DECAY_HALF_LIFE_DAYS = 30; // Score decays by 50% every 30 days of inactivity

function calculateProficiencyLevel(score: number): "undiscovered" | "novice" | "familiar" | "proficient" | "expert" {
  if (score >= 80) return "expert";
  if (score >= 55) return "proficient";
  if (score >= 30) return "familiar";
  if (score >= 5) return "novice";
  return "undiscovered";
}

function calculateRawScore(interactions: number, durationMs: number): number {
  const interactionScore = Math.min(interactions / 50, 1) * 60;
  const durationScore = Math.min(durationMs / (30 * 60 * 1000), 1) * 40;
  return Math.round(interactionScore + durationScore);
}

function applyDecay(rawScore: number, lastUsedAt: Date | null): number {
  if (!lastUsedAt) return rawScore;
  const daysSinceUse = (Date.now() - lastUsedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (daysSinceUse <= 3) return rawScore; // No decay within 3 days
  const decayFactor = Math.pow(0.5, (daysSinceUse - 3) / DECAY_HALF_LIFE_DAYS);
  return Math.round(rawScore * decayFactor);
}

function calculateStreak(events: { createdAt: Date }[]): number {
  if (events.length === 0) return 0;
  const sorted = [...events].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  let streak = 1;
  let lastDate = new Date(sorted[0].createdAt);
  lastDate.setHours(0, 0, 0, 0);

  for (let i = 1; i < sorted.length; i++) {
    const eventDate = new Date(sorted[i].createdAt);
    eventDate.setHours(0, 0, 0, 0);
    const diffDays = (lastDate.getTime() - eventDate.getTime()) / (24 * 60 * 60 * 1000);
    if (diffDays <= 1) {
      streak++;
      lastDate = eventDate;
    } else {
      break;
    }
  }
  return streak;
}

export async function recalculateProficiency(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    const aggregates = await db
      .select({
        featureKey: userPlatformEvents.featureKey,
        totalInteractions: sql<number>`COUNT(*)`,
        totalDurationMs: sql<number>`COALESCE(SUM(JSON_EXTRACT(metadata, '$.duration_ms')), 0)`,
        firstUsedAt: sql<string>`MIN(created_at)`,
        lastUsedAt: sql<string>`MAX(created_at)`,
      })
      .from(userPlatformEvents)
      .where(eq(userPlatformEvents.userId, userId))
      .groupBy(userPlatformEvents.featureKey);

    for (const agg of aggregates) {
      const catalogEntry = FEATURE_CATALOG.find(f => f.key === agg.featureKey);
      const label = catalogEntry?.label || agg.featureKey;
      const category = catalogEntry?.category || "other";
      const interactions = Number(agg.totalInteractions) || 0;
      const durationMs = Number(agg.totalDurationMs) || 0;
      const lastUsedDate = agg.lastUsedAt ? new Date(agg.lastUsedAt) : null;

      const rawScore = calculateRawScore(interactions, durationMs);
      const decayedScore = applyDecay(rawScore, lastUsedDate);
      const level = calculateProficiencyLevel(decayedScore);

      await db.insert(userFeatureProficiency).values({
        userId,
        featureKey: agg.featureKey,
        featureLabel: label,
        category,
        totalInteractions: interactions,
        totalDurationMs: durationMs,
        proficiencyScore: decayedScore,
        proficiencyLevel: level,
        firstUsedAt: agg.firstUsedAt ? new Date(agg.firstUsedAt) : null,
        lastUsedAt: lastUsedDate,
      }).onDuplicateKeyUpdate({
        set: {
          featureLabel: label,
          category,
          totalInteractions: interactions,
          totalDurationMs: durationMs,
          proficiencyScore: decayedScore,
          proficiencyLevel: level,
          lastUsedAt: lastUsedDate || undefined,
        },
      });
    }
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] recalculateProficiency error:", e);
  }
}

// ─── USER LAYER DETECTION ───────────────────────────────────────────────────

export interface UserLayerContext {
  activeLayer: LayerKey;
  layerLabel: string;
  organizationId?: number;
  organizationRole?: string;
  managerId?: number;
  professionalId?: number;
  accessibleLayers: LayerKey[];
}

export async function detectUserLayer(userId: number, userRole: string): Promise<UserLayerContext> {
  const db = await getDb();

  // Default: client layer
  const defaultCtx: UserLayerContext = {
    activeLayer: "client",
    layerLabel: "Client",
    accessibleLayers: ["client"],
  };

  if (!db) return defaultCtx;

  try {
    // Check organization membership
    const orgRoles = await db
      .select()
      .from(userOrganizationRoles)
      .where(and(
        eq(userOrganizationRoles.userId, userId),
        eq(userOrganizationRoles.status, "active")
      ))
      .limit(1);

    const orgRole = orgRoles[0];

    if (userRole === "admin") {
      return {
        activeLayer: "platform",
        layerLabel: "Platform",
        organizationId: orgRole?.organizationId,
        organizationRole: orgRole?.organizationRole || undefined,
        accessibleLayers: ["platform", "organization", "manager", "professional", "client"],
      };
    }

    if (userRole === "manager") {
      return {
        activeLayer: "manager",
        layerLabel: "Manager",
        organizationId: orgRole?.organizationId,
        organizationRole: orgRole?.organizationRole || undefined,
        managerId: orgRole?.managerId || undefined,
        accessibleLayers: ["manager", "professional", "client"],
      };
    }

    if (userRole === "advisor") {
      return {
        activeLayer: "professional",
        layerLabel: "Professional",
        organizationId: orgRole?.organizationId,
        organizationRole: orgRole?.organizationRole || undefined,
        professionalId: orgRole?.professionalId || undefined,
        accessibleLayers: ["professional", "client"],
      };
    }

    // Regular user = client layer
    return {
      ...defaultCtx,
      organizationId: orgRole?.organizationId,
    };
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] detectUserLayer error:", e);
    return defaultCtx;
  }
}

// ─── CONTEXT ASSEMBLY (5-Layer Aware) ───────────────────────────────────────

export interface ExponentialContext {
  overallProficiency: string;
  totalInteractions: number;
  featuresExplored: number;
  featuresTotal: number;
  exploredFeatures: { key: string; label: string; level: string; score: number; layer: string }[];
  undiscoveredFeatures: { key: string; label: string; description: string; layer: string }[];
  recentActivity: { featureKey: string; label: string; daysAgo: number }[];
  newUpdates: { id: number; title: string; description: string; version: string; changeType: string }[];
  userLayer: UserLayerContext;
  streak: number;
  promptFragment: string;
}

export async function assembleExponentialContext(
  userId: number,
  userRole: string = "user"
): Promise<ExponentialContext> {
  const db = await getDb();
  const userLayer = await detectUserLayer(userId, userRole);

  const empty: ExponentialContext = {
    overallProficiency: "new_user",
    totalInteractions: 0,
    featuresExplored: 0,
    featuresTotal: 0,
    exploredFeatures: [],
    undiscoveredFeatures: [],
    recentActivity: [],
    newUpdates: [],
    userLayer,
    streak: 0,
    promptFragment: "",
  };
  if (!db) return empty;

  try {
    // 1. Get user's proficiency records
    const proficiencies = await db
      .select()
      .from(userFeatureProficiency)
      .where(eq(userFeatureProficiency.userId, userId));

    const profMap = new Map(proficiencies.map(p => [p.featureKey, p]));

    // 2. Filter catalog by user's role AND accessible layers
    const accessibleFeatures = FEATURE_CATALOG.filter(f =>
      f.roles.includes(userRole) || f.roles.includes("user")
    );
    const totalFeatures = accessibleFeatures.length;

    // 3. Categorize features with layer info
    const explored: ExponentialContext["exploredFeatures"] = [];
    const undiscovered: ExponentialContext["undiscoveredFeatures"] = [];
    let totalInteractions = 0;

    for (const feature of accessibleFeatures) {
      const prof = profMap.get(feature.key);
      if (prof && prof.totalInteractions > 0) {
        explored.push({
          key: feature.key,
          label: feature.label,
          level: prof.proficiencyLevel,
          score: prof.proficiencyScore,
          layer: feature.layer,
        });
        totalInteractions += prof.totalInteractions;
      } else {
        undiscovered.push({
          key: feature.key,
          label: feature.label,
          description: feature.description,
          layer: feature.layer,
        });
      }
    }

    // 4. Get recent activity (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentEvents = await db
      .select({
        featureKey: userPlatformEvents.featureKey,
        lastUsed: sql<string>`MAX(created_at)`,
      })
      .from(userPlatformEvents)
      .where(and(
        eq(userPlatformEvents.userId, userId),
        gt(userPlatformEvents.createdAt, sevenDaysAgo)
      ))
      .groupBy(userPlatformEvents.featureKey)
      .orderBy(desc(sql`MAX(created_at)`))
      .limit(10);

    const recentActivity = recentEvents.map(e => {
      const catalog = FEATURE_CATALOG.find(f => f.key === e.featureKey);
      const daysAgo = Math.floor((Date.now() - new Date(e.lastUsed).getTime()) / (24 * 60 * 60 * 1000));
      return { featureKey: e.featureKey, label: catalog?.label || e.featureKey, daysAgo };
    });

    // 5. Calculate streak
    const recentAllEvents = await db
      .select({ createdAt: userPlatformEvents.createdAt })
      .from(userPlatformEvents)
      .where(and(
        eq(userPlatformEvents.userId, userId),
        gt(userPlatformEvents.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(userPlatformEvents.createdAt))
      .limit(100);

    const streak = calculateStreak(recentAllEvents);

    // 6. Get unread changelog entries (filtered by layer)
    const unreadChanges = await db
      .select({
        id: platformChangelog.id,
        title: platformChangelog.title,
        description: platformChangelog.description,
        version: platformChangelog.version,
        changeType: platformChangelog.changeType,
      })
      .from(platformChangelog)
      .where(
        sql`${platformChangelog.id} NOT IN (
          SELECT changelog_id FROM user_changelog_awareness WHERE user_id = ${userId}
        )`
      )
      .orderBy(desc(platformChangelog.announcedAt))
      .limit(5);

    // 7. Calculate overall proficiency with layer weighting
    const exploredCount = explored.length;
    const avgScore = explored.length > 0
      ? explored.reduce((sum, e) => sum + e.score, 0) / explored.length
      : 0;

    // Boost score for users who explore features across multiple layers
    const layersExplored = new Set(explored.map(e => e.layer)).size;
    const layerBonus = Math.min(layersExplored * 3, 15);
    const streakBonus = Math.min(streak * 2, 10);
    const adjustedScore = Math.min(avgScore + layerBonus + streakBonus, 100);

    let overallProficiency = "new_user";
    if (exploredCount === 0) overallProficiency = "new_user";
    else if (adjustedScore < 15) overallProficiency = "beginner";
    else if (adjustedScore < 40) overallProficiency = "intermediate";
    else if (adjustedScore < 70) overallProficiency = "advanced";
    else overallProficiency = "power_user";

    // 8. Build the prompt fragment
    const promptFragment = buildExponentialPrompt({
      overallProficiency,
      totalInteractions,
      explored,
      undiscovered,
      recentActivity,
      newUpdates: unreadChanges,
      userRole,
      userLayer,
      streak,
    });

    return {
      overallProficiency,
      totalInteractions,
      featuresExplored: exploredCount,
      featuresTotal: totalFeatures,
      exploredFeatures: explored,
      undiscoveredFeatures: undiscovered,
      recentActivity,
      newUpdates: unreadChanges,
      userLayer,
      streak,
      promptFragment,
    };
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] assembleExponentialContext error:", e);
    return empty;
  }
}

// ─── PROMPT BUILDER (5-Layer Aware) ─────────────────────────────────────────

function buildExponentialPrompt(params: {
  overallProficiency: string;
  totalInteractions: number;
  explored: ExponentialContext["exploredFeatures"];
  undiscovered: ExponentialContext["undiscoveredFeatures"];
  recentActivity: ExponentialContext["recentActivity"];
  newUpdates: ExponentialContext["newUpdates"];
  userRole: string;
  userLayer: UserLayerContext;
  streak: number;
}): string {
  const { overallProficiency, totalInteractions, explored, undiscovered, recentActivity, newUpdates, userRole, userLayer, streak } = params;

  const sections: string[] = [];

  sections.push(`<exponential_engine>`);
  sections.push(`## User Platform Awareness (5-Layer Context)`);
  sections.push(`Overall proficiency: ${overallProficiency} | Total interactions: ${totalInteractions} | Features explored: ${explored.length}/${explored.length + undiscovered.length}`);
  sections.push(`Role: ${userRole} | Active Layer: ${userLayer.layerLabel} (L${LAYER_HIERARCHY.findIndex(l => l.key === userLayer.activeLayer) + 1}) | Accessible Layers: ${userLayer.accessibleLayers.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(" → ")}`);
  if (streak > 0) sections.push(`Usage streak: ${streak} consecutive days — acknowledge this naturally when appropriate`);

  // 5-Layer context for AI behavior
  sections.push(`\n### 5-Layer Hierarchy Context`);
  sections.push(`The platform operates on 5 cascading layers. This user operates at the **${userLayer.layerLabel}** layer.`);
  sections.push(`- **Platform (L1)**: Global settings, admin controls, platform-wide AI behavior`);
  sections.push(`- **Organization (L2)**: Org-specific branding, compliance, integrations, knowledge base`);
  sections.push(`- **Manager (L3)**: Team oversight, improvement engine, compliance dashboard, delegation`);
  sections.push(`- **Professional (L4)**: Advisory tools, client management, case design, hubs`);
  sections.push(`- **Client (L5)**: Personal AI chat, calculators, documents, voice mode, suitability`);
  sections.push(`When suggesting features, prioritize those at or below the user's active layer. Features above their layer should only be mentioned if they ask about team/org capabilities.`);

  // Onboarding behavior based on proficiency + layer
  if (overallProficiency === "new_user") {
    sections.push(`\n### Onboarding Mode: ACTIVE`);
    sections.push(`This is a new user at the ${userLayer.layerLabel} layer. Your priority is to:`);
    sections.push(`- Welcome them warmly and explain what Stewardly can do at their layer`);
    sections.push(`- For ${userLayer.activeLayer === "client" ? "clients" : userLayer.activeLayer === "professional" ? "advisors" : userLayer.activeLayer === "manager" ? "managers" : "administrators"}, highlight the most impactful features first`);
    sections.push(`- After answering their question, mention ONE undiscovered feature from their layer`);
    sections.push(`- Keep suggestions natural — weave them into your response`);
  } else if (overallProficiency === "beginner") {
    sections.push(`\n### Onboarding Mode: GUIDED`);
    sections.push(`This user is learning the ${userLayer.layerLabel} layer. Continue to:`);
    sections.push(`- Occasionally mention features they haven't tried at their layer`);
    sections.push(`- Provide tips about features they're using (e.g., "Did you know you can also use voice mode for this?")`);
    sections.push(`- When they've mastered their layer basics, introduce cross-layer features they can access`);
  } else if (overallProficiency === "intermediate") {
    sections.push(`\n### Onboarding Mode: CONTEXTUAL`);
    sections.push(`This user knows the ${userLayer.layerLabel} layer basics. Only suggest undiscovered features when directly relevant.`);
    sections.push(`- Start introducing advanced workflows that span multiple layers`);
    sections.push(`- Mention efficiency tips and power-user shortcuts`);
  } else {
    sections.push(`\n### Onboarding Mode: EXPERT`);
    sections.push(`This user is experienced at the ${userLayer.layerLabel} layer. Focus on depth, advanced tips, and cross-layer efficiency.`);
    sections.push(`- Only mention new platform updates and advanced integrations`);
    sections.push(`- Suggest ways to leverage features across layers for maximum impact`);
  }

  // Features grouped by layer
  if (explored.length > 0) {
    sections.push(`\n### Features This User Knows (by Layer)`);
    for (const layerDef of LAYER_HIERARCHY) {
      const layerFeatures = explored.filter(f => f.layer === layerDef.key);
      if (layerFeatures.length > 0) {
        const byLevel = { expert: [] as string[], proficient: [] as string[], familiar: [] as string[], novice: [] as string[] };
        for (const f of layerFeatures) {
          const level = f.level as keyof typeof byLevel;
          if (byLevel[level]) byLevel[level].push(f.label);
        }
        const parts: string[] = [];
        if (byLevel.expert.length) parts.push(`Expert: ${byLevel.expert.join(", ")}`);
        if (byLevel.proficient.length) parts.push(`Proficient: ${byLevel.proficient.join(", ")}`);
        if (byLevel.familiar.length) parts.push(`Familiar: ${byLevel.familiar.join(", ")}`);
        if (byLevel.novice.length) parts.push(`Novice: ${byLevel.novice.join(", ")}`);
        sections.push(`**${layerDef.label} Layer**: ${parts.join(" | ")}`);
      }
    }
  }

  // Undiscovered features grouped by layer (prioritize user's active layer)
  if (undiscovered.length > 0) {
    sections.push(`\n### Undiscovered Features (suggest when relevant)`);
    // Show user's layer first
    const userLayerFeatures = undiscovered.filter(f => f.layer === userLayer.activeLayer);
    const otherFeatures = undiscovered.filter(f => f.layer !== userLayer.activeLayer);

    if (userLayerFeatures.length > 0) {
      sections.push(`**At your layer (${userLayer.layerLabel}) — prioritize these:**`);
      for (const f of userLayerFeatures) {
        sections.push(`- **${f.label}**: ${f.description}`);
      }
    }
    if (otherFeatures.length > 0) {
      sections.push(`**Other accessible layers:**`);
      for (const f of otherFeatures.slice(0, 8)) {
        sections.push(`- **${f.label}** (${f.layer}): ${f.description}`);
      }
    }
  }

  // Recent activity
  if (recentActivity.length > 0) {
    sections.push(`\n### Recent Activity (last 7 days)`);
    for (const a of recentActivity) {
      sections.push(`- ${a.label}: ${a.daysAgo === 0 ? "today" : a.daysAgo === 1 ? "yesterday" : `${a.daysAgo} days ago`}`);
    }
  }

  // New platform updates
  if (newUpdates.length > 0) {
    sections.push(`\n### New Platform Updates (inform user when appropriate)`);
    sections.push(`These are new features or improvements the user hasn't been told about yet. Mention them naturally when relevant:`);
    for (const u of newUpdates) {
      sections.push(`- **${u.title}** (v${u.version}): ${u.description}`);
    }
  }

  // Self-Discovery Loop awareness
  sections.push(`\n### Self-Discovery Loop`);
  sections.push(`The platform has a Self-Discovery Loop that generates follow-up exploration queries when the user is idle.`);
  sections.push(`When a user sends a message that was generated by the Self-Discovery Loop, treat it as a natural continuation of the conversation.`);
  sections.push(`Your responses to discovery queries should:`);
  sections.push(`- Explore the topic at the appropriate depth for this user's proficiency level`);
  sections.push(`- Connect the exploration to features at their active layer (${userLayer.layerLabel})`);
  sections.push(`- If the discovery touches an undiscovered feature, naturally introduce it`);
  sections.push(`- End with a thought-provoking insight that could spark further curiosity`);

  sections.push(`</exponential_engine>`);
  return sections.join("\n");
}

// ─── AI-GENERATED INSIGHTS ──────────────────────────────────────────────────

export interface ProficiencyInsight {
  summary: string;
  strengths: string[];
  growthAreas: string[];
  nextSteps: { action: string; feature: string; layer: string; reason: string }[];
  layerProgress: { layer: string; explored: number; total: number; percentage: number }[];
}

export async function generateAIInsights(
  userId: number,
  userRole: string
): Promise<ProficiencyInsight> {
  const context = await assembleExponentialContext(userId, userRole);

  // Build layer progress
  const layerProgress = LAYER_HIERARCHY
    .filter(l => context.userLayer.accessibleLayers.includes(l.key))
    .map(l => {
      const layerFeatures = FEATURE_CATALOG.filter(f => f.layer === l.key && (f.roles.includes(userRole) || f.roles.includes("user")));
      const explored = context.exploredFeatures.filter(f => f.layer === l.key).length;
      return {
        layer: l.label,
        explored,
        total: layerFeatures.length,
        percentage: layerFeatures.length > 0 ? Math.round((explored / layerFeatures.length) * 100) : 0,
      };
    });

  // Determine strengths
  const strengths = context.exploredFeatures
    .filter(f => f.score >= 55)
    .map(f => f.label);

  // Determine growth areas (features with low scores or undiscovered at user's layer)
  const growthAreas = [
    ...context.exploredFeatures.filter(f => f.score < 30 && f.score > 0).map(f => `${f.label} (needs more practice)`),
    ...context.undiscoveredFeatures
      .filter(f => f.layer === context.userLayer.activeLayer)
      .slice(0, 3)
      .map(f => `${f.label} (not yet explored)`),
  ];

  // Generate next steps based on layer and proficiency
  const nextSteps: ProficiencyInsight["nextSteps"] = [];

  // Prioritize undiscovered features at user's active layer
  const layerUndiscovered = context.undiscoveredFeatures.filter(f => f.layer === context.userLayer.activeLayer);
  for (const f of layerUndiscovered.slice(0, 2)) {
    nextSteps.push({
      action: `Try ${f.label}`,
      feature: f.key,
      layer: f.layer,
      reason: f.description,
    });
  }

  // Suggest deepening skills for novice features
  const noviceFeatures = context.exploredFeatures.filter(f => f.level === "novice");
  for (const f of noviceFeatures.slice(0, 2)) {
    nextSteps.push({
      action: `Deepen your ${f.label} skills`,
      feature: f.key,
      layer: f.layer,
      reason: `You've just started using this — spend more time to unlock its full potential`,
    });
  }

  // Cross-layer suggestion if user has mastered their layer
  const userLayerExploration = layerProgress.find(l => l.layer === context.userLayer.layerLabel);
  if (userLayerExploration && userLayerExploration.percentage >= 80) {
    const nextLayerFeatures = context.undiscoveredFeatures.filter(f => f.layer !== context.userLayer.activeLayer);
    if (nextLayerFeatures.length > 0) {
      nextSteps.push({
        action: `Explore ${nextLayerFeatures[0].label} from the ${nextLayerFeatures[0].layer} layer`,
        feature: nextLayerFeatures[0].key,
        layer: nextLayerFeatures[0].layer,
        reason: `You've mastered most of your layer — time to expand your capabilities`,
      });
    }
  }

  // Summary
  const summary = context.overallProficiency === "new_user"
    ? `Welcome to Stewardly! You're at the ${context.userLayer.layerLabel} layer with ${context.featuresTotal} features to explore. Let's get started!`
    : `You've explored ${context.featuresExplored} of ${context.featuresTotal} features (${Math.round((context.featuresExplored / context.featuresTotal) * 100)}%). ${
        context.streak > 1 ? `You're on a ${context.streak}-day streak! ` : ""
      }${strengths.length > 0 ? `Strong in: ${strengths.slice(0, 3).join(", ")}. ` : ""}${
        growthAreas.length > 0 ? `Room to grow: ${growthAreas.slice(0, 2).join(", ")}.` : "Great coverage!"
      }`;

  return {
    summary,
    strengths: strengths.slice(0, 5),
    growthAreas: growthAreas.slice(0, 5),
    nextSteps: nextSteps.slice(0, 5),
    layerProgress,
  };
}

// ─── ONBOARDING CHECKLIST GENERATOR ─────────────────────────────────────────

export interface OnboardingItem {
  id: string;
  title: string;
  description: string;
  featureKey: string;
  layer: LayerKey;
  href: string;
  completed: boolean;
  priority: number; // 1 = highest
}

export async function generateOnboardingChecklist(
  userId: number,
  userRole: string
): Promise<OnboardingItem[]> {
  const context = await assembleExponentialContext(userId, userRole);
  const exploredKeys = new Set(context.exploredFeatures.map(f => f.key));

  // Define onboarding actions per layer
  const onboardingActions: Omit<OnboardingItem, "completed">[] = [
    // Client layer (everyone)
    { id: "ob-chat", title: "Have your first AI conversation", description: "Ask Stewardly anything to get started", featureKey: "chat", layer: "client", href: "/chat", priority: 1 },
    { id: "ob-suitability", title: "Complete your suitability profile", description: "Help the AI understand your financial situation and goals", featureKey: "suitability", layer: "client", href: "/suitability", priority: 2 },
    { id: "ob-style", title: "Set your communication style", description: "Tell the AI how you prefer to receive information", featureKey: "style_profile", layer: "client", href: "/settings/profile", priority: 3 },
    { id: "ob-voice", title: "Try voice mode", description: "Have a hands-free conversation with the AI", featureKey: "voice_mode", layer: "client", href: "/chat", priority: 4 },
    { id: "ob-docs", title: "Upload a document", description: "Give the AI context from your files", featureKey: "documents", layer: "client", href: "/documents", priority: 5 },
    { id: "ob-calc", title: "Run a financial calculator", description: "Try the IUL projection or retirement aggregator", featureKey: "calculators", layer: "client", href: "/calculators", priority: 6 },
    { id: "ob-focus", title: "Switch focus modes", description: "Try Financial, General, or Study focus", featureKey: "focus_mode", layer: "client", href: "/chat", priority: 7 },

    // Professional layer
    { id: "ob-advisory", title: "Explore the Advisory Hub", description: "Browse products, create cases, and manage recommendations", featureKey: "advisory_hub", layer: "professional", href: "/advisory", priority: 2 },
    { id: "ob-relationships", title: "Set up your Relationships Hub", description: "Import contacts and manage client relationships", featureKey: "relationships_hub", layer: "professional", href: "/relationships", priority: 3 },
    { id: "ob-intelligence", title: "Check the Intelligence Hub", description: "View market data, AI models, and analytics", featureKey: "intelligence_hub", layer: "professional", href: "/intelligence-hub", priority: 4 },
    { id: "ob-integrations", title: "Connect a data source", description: "Link your CRM, Plaid, or other data providers", featureKey: "integrations", layer: "organization", href: "/integrations", priority: 5 },
    { id: "ob-portal", title: "Visit the Advisor Portal", description: "Your professional workspace for client management", featureKey: "portal", layer: "professional", href: "/portal", priority: 6 },

    // Manager layer
    { id: "ob-manager", title: "Review your Manager Dashboard", description: "See team performance and oversight tools", featureKey: "manager_dashboard", layer: "manager", href: "/manager", priority: 2 },
    { id: "ob-improvement", title: "Run the Improvement Engine", description: "Get AI-driven recommendations for your team", featureKey: "improvement_engine", layer: "manager", href: "/improvement", priority: 3 },
    { id: "ob-compliance", title: "Check the Compliance Dashboard", description: "Review audit trails and compliance logs", featureKey: "admin_compliance", layer: "manager", href: "/operations", priority: 4 },
    { id: "ob-layers", title: "Configure AI Layers", description: "Set up cascading AI behavior for your team", featureKey: "ai_layers", layer: "manager", href: "/ai-settings", priority: 5 },

    // Platform/Admin layer
    { id: "ob-users", title: "Manage platform users", description: "Set up roles and permissions", featureKey: "admin_users", layer: "platform", href: "/admin", priority: 2 },
    { id: "ob-orgs", title: "Configure organizations", description: "Set up multi-tenant organization structure", featureKey: "admin_organizations", layer: "platform", href: "/organizations", priority: 3 },
  ];

  // Filter by accessible layers and role
  const accessible = onboardingActions.filter(item => {
    const feature = FEATURE_CATALOG.find(f => f.key === item.featureKey);
    if (!feature) return false;
    const layerAccessible = context.userLayer.accessibleLayers.includes(item.layer);
    const roleAccessible = feature.roles.includes(userRole) || feature.roles.includes("user");
    return layerAccessible && roleAccessible;
  });

  // Mark completed based on explored features
  const checklist: OnboardingItem[] = accessible.map(item => ({
    ...item,
    completed: exploredKeys.has(item.featureKey),
  }));

  // Sort: incomplete first, then by priority
  checklist.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.priority - b.priority;
  });

  return checklist;
}

// ─── CHANGELOG FEED ─────────────────────────────────────────────────────────

export interface ChangelogEntry {
  id: number;
  version: string;
  title: string;
  description: string;
  changeType: string;
  announcedAt: Date;
  isRead: boolean;
}

export async function getChangelogFeed(
  userId: number,
  limit: number = 20
): Promise<{ entries: ChangelogEntry[]; unreadCount: number }> {
  const db = await getDb();
  if (!db) return { entries: [], unreadCount: 0 };

  try {
    const allEntries = await db
      .select({
        id: platformChangelog.id,
        version: platformChangelog.version,
        title: platformChangelog.title,
        description: platformChangelog.description,
        changeType: platformChangelog.changeType,
        announcedAt: platformChangelog.announcedAt,
      })
      .from(platformChangelog)
      .orderBy(desc(platformChangelog.announcedAt))
      .limit(limit);

    // Get user's read changelog IDs
    const readEntries = await db
      .select({ changelogId: userChangelogAwareness.changelogId })
      .from(userChangelogAwareness)
      .where(eq(userChangelogAwareness.userId, userId));

    const readIds = new Set(readEntries.map(r => r.changelogId));

    const entries: ChangelogEntry[] = allEntries.map(e => ({
      ...e,
      isRead: readIds.has(e.id),
    }));

    const unreadCount = entries.filter(e => !e.isRead).length;

    return { entries, unreadCount };
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] getChangelogFeed error:", e);
    return { entries: [], unreadCount: 0 };
  }
}

// ─── CHANGELOG MANAGEMENT ───────────────────────────────────────────────────

export async function markChangelogInformed(
  userId: number,
  changelogId: number,
  via: "ai_chat" | "notification" | "changelog_page" | "onboarding" = "ai_chat"
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    await db.insert(userChangelogAwareness).values({
      userId,
      changelogId,
      informedVia: via,
    }).onDuplicateKeyUpdate({
      set: { informedVia: via },
    });
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] markChangelogInformed error:", e);
  }
}

// ─── GUEST-AWARE PROFICIENCY (Session-Based) ──────────────────────────────

/**
 * Build proficiency context for a guest user based on session data.
 * Session data is passed from the frontend (localStorage-based tracking).
 * No DB writes — purely computed from the provided session events.
 */
export function assembleGuestContext(sessionData: {
  events: { featureKey: string; eventType: string; count: number; durationMs: number; lastUsed: number }[];
}): ExponentialContext {
  const guestLayer: UserLayerContext = {
    activeLayer: "client",
    layerLabel: "Client",
    accessibleLayers: ["client"],
  };

  // Guest can only see features available to "user" role at client layer
  const accessibleFeatures = FEATURE_CATALOG.filter(f => f.roles.includes("user"));
  const totalFeatures = accessibleFeatures.length;

  const eventMap = new Map(sessionData.events.map(e => [e.featureKey, e]));

  const explored: ExponentialContext["exploredFeatures"] = [];
  const undiscovered: ExponentialContext["undiscoveredFeatures"] = [];
  let totalInteractions = 0;

  for (const feature of accessibleFeatures) {
    const event = eventMap.get(feature.key);
    if (event && event.count > 0) {
      const rawScore = calculateRawScore(event.count, event.durationMs);
      const level = calculateProficiencyLevel(rawScore);
      explored.push({
        key: feature.key,
        label: feature.label,
        level,
        score: rawScore,
        layer: feature.layer,
      });
      totalInteractions += event.count;
    } else {
      undiscovered.push({
        key: feature.key,
        label: feature.label,
        description: feature.description,
        layer: feature.layer,
      });
    }
  }

  // Recent activity from session
  const recentActivity = sessionData.events
    .filter(e => e.count > 0)
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, 10)
    .map(e => {
      const catalog = FEATURE_CATALOG.find(f => f.key === e.featureKey);
      const daysAgo = Math.floor((Date.now() - e.lastUsed) / (24 * 60 * 60 * 1000));
      return { featureKey: e.featureKey, label: catalog?.label || e.featureKey, daysAgo };
    });

  // Overall proficiency
  const avgScore = explored.length > 0
    ? explored.reduce((sum, e) => sum + e.score, 0) / explored.length
    : 0;
  let overallProficiency = "new_user";
  if (explored.length === 0) overallProficiency = "new_user";
  else if (avgScore < 15) overallProficiency = "beginner";
  else if (avgScore < 40) overallProficiency = "intermediate";
  else if (avgScore < 70) overallProficiency = "advanced";
  else overallProficiency = "power_user";

  const promptFragment = buildExponentialPrompt({
    overallProficiency,
    totalInteractions,
    explored,
    undiscovered,
    recentActivity,
    newUpdates: [],
    userRole: "user",
    userLayer: guestLayer,
    streak: 0,
  });

  return {
    overallProficiency,
    totalInteractions,
    featuresExplored: explored.length,
    featuresTotal: totalFeatures,
    exploredFeatures: explored,
    undiscoveredFeatures: undiscovered,
    recentActivity,
    newUpdates: [],
    userLayer: guestLayer,
    streak: 0,
    promptFragment,
  };
}

/**
 * Generate insights for a guest user based on session data.
 */
export function generateGuestInsights(sessionData: {
  events: { featureKey: string; eventType: string; count: number; durationMs: number; lastUsed: number }[];
}): ProficiencyInsight {
  const context = assembleGuestContext(sessionData);

  const layerProgress = LAYER_HIERARCHY
    .filter(l => l.key === "client")
    .map(l => {
      const layerFeatures = FEATURE_CATALOG.filter(f => f.layer === l.key && f.roles.includes("user"));
      const explored = context.exploredFeatures.filter(f => f.layer === l.key).length;
      return {
        layer: l.label,
        explored,
        total: layerFeatures.length,
        percentage: layerFeatures.length > 0 ? Math.round((explored / layerFeatures.length) * 100) : 0,
      };
    });

  const strengths = context.exploredFeatures.filter(f => f.score >= 55).map(f => f.label);
  const growthAreas = [
    ...context.exploredFeatures.filter(f => f.score < 30 && f.score > 0).map(f => `${f.label} (needs more practice)`),
    ...context.undiscoveredFeatures.filter(f => f.layer === "client").slice(0, 3).map(f => `${f.label} (not yet explored)`),
  ];

  const nextSteps: ProficiencyInsight["nextSteps"] = [];
  const clientUndiscovered = context.undiscoveredFeatures.filter(f => f.layer === "client");
  for (const f of clientUndiscovered.slice(0, 3)) {
    nextSteps.push({ action: `Try ${f.label}`, feature: f.key, layer: f.layer, reason: f.description });
  }

  // Always suggest signing in as a next step for guests
  nextSteps.push({
    action: "Create an account to save your progress",
    feature: "chat",
    layer: "client",
    reason: "Sign in to persist your proficiency data, unlock personalized AI recommendations, and access all 5 layers",
  });

  const summary = context.overallProficiency === "new_user"
    ? `Welcome to Stewardly! Explore the platform as a guest — sign in anytime to save your progress.`
    : `You've explored ${context.featuresExplored} of ${context.featuresTotal} features as a guest. Sign in to persist your progress and unlock all layers!`;

  return {
    summary,
    strengths: strengths.slice(0, 5),
    growthAreas: growthAreas.slice(0, 5),
    nextSteps: nextSteps.slice(0, 5),
    layerProgress,
  };
}

/**
 * Generate onboarding checklist for a guest user based on session data.
 */
export function generateGuestOnboardingChecklist(sessionData: {
  events: { featureKey: string; eventType: string; count: number; durationMs: number; lastUsed: number }[];
}): OnboardingItem[] {
  const exploredKeys = new Set(sessionData.events.filter(e => e.count > 0).map(e => e.featureKey));

  // Guest only gets client-layer onboarding actions
  const guestActions: Omit<OnboardingItem, "completed">[] = [
    { id: "ob-chat", title: "Have your first AI conversation", description: "Ask Stewardly anything to get started", featureKey: "chat", layer: "client", href: "/chat", priority: 1 },
    { id: "ob-suitability", title: "Complete your suitability profile", description: "Help the AI understand your financial situation and goals", featureKey: "suitability", layer: "client", href: "/suitability", priority: 2 },
    { id: "ob-voice", title: "Try voice mode", description: "Have a hands-free conversation with the AI", featureKey: "voice_mode", layer: "client", href: "/chat", priority: 3 },
    { id: "ob-docs", title: "Upload a document", description: "Give the AI context from your files", featureKey: "documents", layer: "client", href: "/documents", priority: 4 },
    { id: "ob-calc", title: "Run a financial calculator", description: "Try the IUL projection or retirement aggregator", featureKey: "calculators", layer: "client", href: "/calculators", priority: 5 },
    { id: "ob-focus", title: "Switch focus modes", description: "Try Financial, General, or Study focus", featureKey: "focus_mode", layer: "client", href: "/chat", priority: 6 },
    { id: "ob-signin", title: "Create an account", description: "Save your progress and unlock all 5 layers", featureKey: "chat", layer: "client", href: "/signin", priority: 7 },
  ];

  const checklist: OnboardingItem[] = guestActions.map(item => ({
    ...item,
    completed: item.id === "ob-signin" ? false : exploredKeys.has(item.featureKey),
  }));

  checklist.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.priority - b.priority;
  });

  return checklist;
}

/**
 * Get changelog feed for guests (no read tracking, all entries are "unread")
 */
export async function getGuestChangelogFeed(limit: number = 20): Promise<{ entries: ChangelogEntry[]; unreadCount: number }> {
  const db = await getDb();
  if (!db) return { entries: [], unreadCount: 0 };

  try {
    const allEntries = await db
      .select({
        id: platformChangelog.id,
        version: platformChangelog.version,
        title: platformChangelog.title,
        description: platformChangelog.description,
        changeType: platformChangelog.changeType,
        announcedAt: platformChangelog.announcedAt,
      })
      .from(platformChangelog)
      .orderBy(desc(platformChangelog.announcedAt))
      .limit(limit);

    const entries: ChangelogEntry[] = allEntries.map(e => ({ ...e, isRead: false }));
    return { entries, unreadCount: entries.length };
  } catch (e) {
    logger.error( { operation: "exponentialEngine", err: e },"[ExponentialEngine] getGuestChangelogFeed error:", e);
    return { entries: [], unreadCount: 0 };
  }
}

export async function addChangelogEntry(params: {
  version: string;
  title: string;
  description: string;
  featureKeys?: string[];
  changeType: "new_feature" | "improvement" | "fix" | "removal";
  impactedRoles?: string[];
}): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(platformChangelog).values({
    version: params.version,
    title: params.title,
    description: params.description,
    featureKeys: params.featureKeys || null,
    changeType: params.changeType,
    impactedRoles: params.impactedRoles || null,
  });
}
