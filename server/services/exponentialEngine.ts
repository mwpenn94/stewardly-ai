/**
 * Exponential Engine
 * 
 * Tracks user platform interactions, calculates feature proficiency,
 * and assembles progressively richer AI context so the AI becomes
 * increasingly aware and personalized over time.
 * 
 * Three core functions:
 * 1. trackEvent() — record a user platform interaction
 * 2. recalculateProficiency() — update proficiency scores from event history
 * 3. assembleExponentialContext() — build the AI prompt injection
 */

import { getDb } from "../db";
import {
  userPlatformEvents,
  userFeatureProficiency,
  platformChangelog,
  userChangelogAwareness,
} from "../../drizzle/schema";
import { eq, and, desc, sql, gt, isNull } from "drizzle-orm";

// ─── FEATURE CATALOG ────────────────────────────────────────────────────────
// Master list of all platform features the AI should know about.
// This is the "curriculum" — the AI uses it to guide users toward undiscovered features.
export const FEATURE_CATALOG: FeatureDefinition[] = [
  // Navigation / Core
  { key: "chat", label: "AI Chat", category: "core", description: "Conversational AI assistant for general and financial guidance", roles: ["user", "professional", "manager", "admin"] },
  { key: "voice_mode", label: "Voice Mode", category: "core", description: "Hands-free voice interaction with the AI using speech-to-text and text-to-speech", roles: ["user", "professional", "manager", "admin"] },
  { key: "focus_mode", label: "Focus Mode", category: "core", description: "Adjust AI focus between General, Financial, or Study expertise", roles: ["user", "professional", "manager", "admin"] },
  { key: "suitability", label: "Suitability Assessment", category: "core", description: "Conversational assessment to personalize financial recommendations", roles: ["user", "professional", "manager", "admin"] },
  { key: "style_profile", label: "Communication Style", category: "core", description: "Personalize how the AI communicates — tone, depth, format preferences", roles: ["user", "professional", "manager", "admin"] },

  // Tools / Hubs
  { key: "intelligence_hub", label: "Intelligence Hub", category: "tools", description: "Economic data, AI models, analytics, and market intelligence dashboard", roles: ["professional", "manager", "admin"] },
  { key: "advisory_hub", label: "Advisory Hub", category: "tools", description: "Product catalog, case design, and recommendation management", roles: ["professional", "manager", "admin"] },
  { key: "relationships_hub", label: "Relationships Hub", category: "tools", description: "Contact management, meetings, and outreach campaigns", roles: ["professional", "manager", "admin"] },
  { key: "operations_hub", label: "Operations Hub", category: "tools", description: "Active work tracking, AI agents, compliance reviews, and history", roles: ["professional", "manager", "admin"] },
  { key: "documents", label: "Documents & Knowledge Base", category: "tools", description: "Upload documents, training materials, and knowledge base articles for AI context", roles: ["user", "professional", "manager", "admin"] },

  // AI Features
  { key: "calculators", label: "Financial Calculators", category: "ai_features", description: "IUL projection, premium finance ROI, retirement aggregator, product comparator — all accessible via chat", roles: ["user", "professional", "manager", "admin"] },
  { key: "image_generation", label: "AI Visual Generation", category: "ai_features", description: "Generate charts, diagrams, and infographics within chat conversations", roles: ["user", "professional", "manager", "admin"] },
  { key: "follow_up_suggestions", label: "Follow-up Suggestions", category: "ai_features", description: "Contextual follow-up prompt pills after each AI response", roles: ["user", "professional", "manager", "admin"] },
  { key: "rich_responses", label: "Rich Response Cards", category: "ai_features", description: "Interactive result cards, comparison views, timelines, charts, and quizzes in AI responses", roles: ["user", "professional", "manager", "admin"] },
  { key: "web_search", label: "AI Web Search", category: "ai_features", description: "AI can search the web for real-time information during conversations", roles: ["user", "professional", "manager", "admin"] },
  { key: "memory", label: "AI Memory", category: "ai_features", description: "AI remembers facts, preferences, and context from past conversations", roles: ["user", "professional", "manager", "admin"] },

  // Settings & Integrations
  { key: "integrations", label: "Data Integrations", category: "integrations", description: "Connect external data sources (Plaid, CRMs, market data APIs) to enrich AI context", roles: ["user", "professional", "manager", "admin"] },
  { key: "ai_settings", label: "AI Configuration", category: "settings", description: "Adjust AI temperature, creativity, context depth, and model behavior", roles: ["professional", "manager", "admin"] },
  { key: "ai_layers", label: "AI Layers", category: "settings", description: "5-layer cascading AI configuration: Platform → Organization → Manager → Professional → User", roles: ["manager", "admin"] },
  { key: "knowledge_base", label: "Knowledge Base Management", category: "settings", description: "Manage articles, FAQs, and training content that the AI references", roles: ["professional", "manager", "admin"] },

  // Admin
  { key: "admin_users", label: "User Management", category: "admin", description: "Manage users, roles, and permissions across the platform", roles: ["admin"] },
  { key: "admin_organizations", label: "Organization Management", category: "admin", description: "Manage organizations, teams, and multi-tenant settings", roles: ["admin"] },
  { key: "admin_compliance", label: "Compliance Dashboard", category: "admin", description: "Review audit trails, compliance logs, and privacy audits", roles: ["manager", "admin"] },
];

export interface FeatureDefinition {
  key: string;
  label: string;
  category: string;
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
    // Non-critical — don't break the user's flow
    console.error("[ExponentialEngine] trackEvent error:", e);
  }
}

// ─── PROFICIENCY RECALCULATION ──────────────────────────────────────────────

const PROFICIENCY_THRESHOLDS = {
  novice: 1,       // 1+ interactions
  familiar: 5,     // 5+ interactions
  proficient: 20,  // 20+ interactions
  expert: 50,      // 50+ interactions
};

function calculateProficiencyLevel(interactions: number): "undiscovered" | "novice" | "familiar" | "proficient" | "expert" {
  if (interactions >= PROFICIENCY_THRESHOLDS.expert) return "expert";
  if (interactions >= PROFICIENCY_THRESHOLDS.proficient) return "proficient";
  if (interactions >= PROFICIENCY_THRESHOLDS.familiar) return "familiar";
  if (interactions >= PROFICIENCY_THRESHOLDS.novice) return "novice";
  return "undiscovered";
}

function calculateProficiencyScore(interactions: number, durationMs: number): number {
  // Score 0-100 based on interactions (60%) and time spent (40%)
  const interactionScore = Math.min(interactions / 50, 1) * 60;
  const durationScore = Math.min(durationMs / (30 * 60 * 1000), 1) * 40; // 30 min max
  return Math.round(interactionScore + durationScore);
}

export async function recalculateProficiency(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  try {
    // Aggregate events per feature
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

      const level = calculateProficiencyLevel(interactions);
      const score = calculateProficiencyScore(interactions, durationMs);

      // Upsert proficiency record
      await db.insert(userFeatureProficiency).values({
        userId,
        featureKey: agg.featureKey,
        featureLabel: label,
        category,
        totalInteractions: interactions,
        totalDurationMs: durationMs,
        proficiencyScore: score,
        proficiencyLevel: level,
        firstUsedAt: agg.firstUsedAt ? new Date(agg.firstUsedAt) : null,
        lastUsedAt: agg.lastUsedAt ? new Date(agg.lastUsedAt) : null,
      }).onDuplicateKeyUpdate({
        set: {
          featureLabel: label,
          category,
          totalInteractions: interactions,
          totalDurationMs: durationMs,
          proficiencyScore: score,
          proficiencyLevel: level,
          lastUsedAt: agg.lastUsedAt ? new Date(agg.lastUsedAt) : undefined,
        },
      });
    }
  } catch (e) {
    console.error("[ExponentialEngine] recalculateProficiency error:", e);
  }
}

// ─── CONTEXT ASSEMBLY ───────────────────────────────────────────────────────

export interface ExponentialContext {
  overallProficiency: string;
  totalInteractions: number;
  featuresExplored: number;
  featuresTotal: number;
  exploredFeatures: { key: string; label: string; level: string; score: number }[];
  undiscoveredFeatures: { key: string; label: string; description: string }[];
  recentActivity: { featureKey: string; label: string; daysAgo: number }[];
  newUpdates: { title: string; description: string; version: string }[];
  promptFragment: string;
}

export async function assembleExponentialContext(
  userId: number,
  userRole: string = "user"
): Promise<ExponentialContext> {
  const db = await getDb();
  const empty: ExponentialContext = {
    overallProficiency: "new_user",
    totalInteractions: 0,
    featuresExplored: 0,
    featuresTotal: 0,
    exploredFeatures: [],
    undiscoveredFeatures: [],
    recentActivity: [],
    newUpdates: [],
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

    // 2. Filter catalog by user's role
    const accessibleFeatures = FEATURE_CATALOG.filter(f => f.roles.includes(userRole));
    const totalFeatures = accessibleFeatures.length;

    // 3. Categorize features
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
        });
        totalInteractions += prof.totalInteractions;
      } else {
        undiscovered.push({
          key: feature.key,
          label: feature.label,
          description: feature.description,
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

    // 5. Get unread changelog entries
    const unreadChanges = await db
      .select({
        id: platformChangelog.id,
        title: platformChangelog.title,
        description: platformChangelog.description,
        version: platformChangelog.version,
      })
      .from(platformChangelog)
      .where(
        sql`${platformChangelog.id} NOT IN (
          SELECT changelog_id FROM user_changelog_awareness WHERE user_id = ${userId}
        )`
      )
      .orderBy(desc(platformChangelog.announcedAt))
      .limit(5);

    // 6. Calculate overall proficiency
    const exploredCount = explored.length;
    const avgScore = explored.length > 0
      ? explored.reduce((sum, e) => sum + e.score, 0) / explored.length
      : 0;

    let overallProficiency = "new_user";
    if (exploredCount === 0) overallProficiency = "new_user";
    else if (avgScore < 15) overallProficiency = "beginner";
    else if (avgScore < 40) overallProficiency = "intermediate";
    else if (avgScore < 70) overallProficiency = "advanced";
    else overallProficiency = "power_user";

    // 7. Build the prompt fragment
    const promptFragment = buildExponentialPrompt({
      overallProficiency,
      totalInteractions,
      explored,
      undiscovered,
      recentActivity,
      newUpdates: unreadChanges,
      userRole,
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
      promptFragment,
    };
  } catch (e) {
    console.error("[ExponentialEngine] assembleExponentialContext error:", e);
    return empty;
  }
}

// ─── PROMPT BUILDER ─────────────────────────────────────────────────────────

function buildExponentialPrompt(params: {
  overallProficiency: string;
  totalInteractions: number;
  explored: ExponentialContext["exploredFeatures"];
  undiscovered: ExponentialContext["undiscoveredFeatures"];
  recentActivity: ExponentialContext["recentActivity"];
  newUpdates: ExponentialContext["newUpdates"];
  userRole: string;
}): string {
  const { overallProficiency, totalInteractions, explored, undiscovered, recentActivity, newUpdates, userRole } = params;

  const sections: string[] = [];

  sections.push(`<exponential_engine>`);
  sections.push(`## User Platform Awareness`);
  sections.push(`Overall proficiency: ${overallProficiency} | Total interactions: ${totalInteractions} | Features explored: ${explored.length}/${explored.length + undiscovered.length} | Role: ${userRole}`);

  // Onboarding behavior based on proficiency
  if (overallProficiency === "new_user") {
    sections.push(`\n### Onboarding Mode: ACTIVE`);
    sections.push(`This is a new user who hasn't explored the platform yet. Your priority is to:`);
    sections.push(`- Welcome them warmly and explain what Stewardly can do for them`);
    sections.push(`- Proactively suggest features relevant to their question`);
    sections.push(`- After answering their question, mention ONE undiscovered feature that relates to their topic`);
    sections.push(`- Keep suggestions natural — weave them into your response, don't list features mechanically`);
  } else if (overallProficiency === "beginner") {
    sections.push(`\n### Onboarding Mode: GUIDED`);
    sections.push(`This user is still learning the platform. Continue to:`);
    sections.push(`- Occasionally mention features they haven't tried when relevant to the conversation`);
    sections.push(`- Provide brief tips about features they're using (e.g., "Did you know you can also use voice mode for this?")`);
    sections.push(`- Celebrate their progress naturally (e.g., "Great that you're using the Intelligence Hub!")`);
  } else if (overallProficiency === "intermediate") {
    sections.push(`\n### Onboarding Mode: CONTEXTUAL`);
    sections.push(`This user knows the basics. Only suggest undiscovered features when directly relevant to their query.`);
  } else {
    sections.push(`\n### Onboarding Mode: EXPERT`);
    sections.push(`This user is experienced. Focus on depth, advanced tips, and efficiency. Only mention new platform updates.`);
  }

  // Features they've used (so AI can reference them naturally)
  if (explored.length > 0) {
    sections.push(`\n### Features This User Knows`);
    const byLevel = { expert: [] as string[], proficient: [] as string[], familiar: [] as string[], novice: [] as string[] };
    for (const f of explored) {
      const level = f.level as keyof typeof byLevel;
      if (byLevel[level]) byLevel[level].push(f.label);
    }
    if (byLevel.expert.length) sections.push(`Expert at: ${byLevel.expert.join(", ")}`);
    if (byLevel.proficient.length) sections.push(`Proficient with: ${byLevel.proficient.join(", ")}`);
    if (byLevel.familiar.length) sections.push(`Familiar with: ${byLevel.familiar.join(", ")}`);
    if (byLevel.novice.length) sections.push(`Just started using: ${byLevel.novice.join(", ")}`);
  }

  // Features they haven't discovered yet
  if (undiscovered.length > 0) {
    sections.push(`\n### Undiscovered Features (suggest when relevant)`);
    // Group by category for cleaner presentation
    const byCategory = new Map<string, typeof undiscovered>();
    for (const f of undiscovered) {
      const cat = f.key;
      if (!byCategory.has(cat)) byCategory.set(cat, []);
    }
    for (const f of undiscovered) {
      sections.push(`- **${f.label}**: ${f.description}`);
    }
  }

  // Recent activity (so AI can reference what they were doing)
  if (recentActivity.length > 0) {
    sections.push(`\n### Recent Activity (last 7 days)`);
    for (const a of recentActivity) {
      sections.push(`- ${a.label}: ${a.daysAgo === 0 ? "today" : a.daysAgo === 1 ? "yesterday" : `${a.daysAgo} days ago`}`);
    }
  }

  // New platform updates the user hasn't been told about
  if (newUpdates.length > 0) {
    sections.push(`\n### New Platform Updates (inform user when appropriate)`);
    sections.push(`These are new features or improvements the user hasn't been told about yet. Mention them naturally when relevant:`);
    for (const u of newUpdates) {
      sections.push(`- **${u.title}** (v${u.version}): ${u.description}`);
    }
  }

  sections.push(`</exponential_engine>`);
  return sections.join("\n");
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
    console.error("[ExponentialEngine] markChangelogInformed error:", e);
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
