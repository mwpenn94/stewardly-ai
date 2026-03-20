/**
 * Contextual AI Insights Collectors
 * 
 * Gathers real usage data per user/layer across 3 audit directions:
 * - people_performance: How well people at this layer serve users below
 * - system_infrastructure: How well the system config/setup supports users
 * - usage_optimization: How the user can better leverage their layer's tools
 * 
 * Insights are cached with TTL (15 min active, 1 hour standard) and injected
 * into the system prompt when audit-direction prompts are detected.
 */

import { eq, and, sql, desc, count, gte } from "drizzle-orm";
import { getDb } from "./db";
import {
  users, conversations, messages, documents, feedback,
  userProfiles, workflowChecklist, clientAssociations,
  reviewQueue, userOrganizationRoles, organizations,
  platformAISettings, organizationAISettings, managerAISettings,
  professionalAISettings, userPreferences, userInsightsCache,
  professionalContext, memories, products, auditTrail,
} from "../drizzle/schema";

// ─── TYPES ────────────────────────────────────────────────────────
type AuditDirection = "people_performance" | "system_infrastructure" | "usage_optimization";
type Layer = "platform" | "organization" | "manager" | "professional" | "user";

interface InsightData {
  metrics: Record<string, number | string | boolean>;
  strengths: string[];
  gaps: string[];
  recommendations: string[];
}

interface CachedInsight {
  insightType: AuditDirection;
  layer: Layer;
  data: InsightData;
  summary: string;
  computedAt: number;
  expiresAt: number;
}

// ─── CACHE MANAGEMENT ─────────────────────────────────────────────
const ACTIVE_TTL = 15 * 60 * 1000;   // 15 minutes for active sessions
const STANDARD_TTL = 60 * 60 * 1000; // 1 hour standard

async function getCachedInsight(userId: number, direction: AuditDirection, layer: Layer): Promise<CachedInsight | null> {
  const db = await getDb();
  if (!db) return null;
  
  const now = Date.now();
  const rows = await db.select().from(userInsightsCache)
    .where(and(
      eq(userInsightsCache.userId, userId),
      eq(userInsightsCache.insightType, direction),
      eq(userInsightsCache.layer, layer),
      gte(userInsightsCache.expiresAt, now),
    ))
    .limit(1);
  
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    insightType: row.insightType,
    layer: row.layer,
    data: row.data as InsightData,
    summary: row.summary,
    computedAt: Number(row.computedAt),
    expiresAt: Number(row.expiresAt),
  };
}

async function setCachedInsight(userId: number, insight: CachedInsight): Promise<void> {
  const db = await getDb();
  if (!db) return;
  
  // Upsert: delete old, insert new
  await db.delete(userInsightsCache).where(and(
    eq(userInsightsCache.userId, userId),
    eq(userInsightsCache.insightType, insight.insightType),
    eq(userInsightsCache.layer, insight.layer),
  ));
  
  await db.insert(userInsightsCache).values({
    userId,
    insightType: insight.insightType,
    layer: insight.layer,
    data: insight.data,
    summary: insight.summary,
    computedAt: insight.computedAt,
    expiresAt: insight.expiresAt,
  });
}

// ─── FEATURE CATALOG ──────────────────────────────────────────────
// All features available per role, used to calculate adoption rates
const PLATFORM_FEATURES = {
  user: [
    "conversations", "document_upload", "voice_chat", "suitability_assessment",
    "financial_profile", "knowledge_base", "marketplace", "memories",
    "focus_modes", "professional_directory",
  ],
  advisor: [
    "conversations", "document_upload", "voice_chat", "suitability_assessment",
    "financial_profile", "knowledge_base", "marketplace", "memories",
    "focus_modes", "professional_directory", "client_management",
    "agent_operations", "insurance_quotes", "estate_planning",
    "premium_finance", "email_campaigns", "portal",
  ],
  manager: [
    "conversations", "document_upload", "voice_chat", "suitability_assessment",
    "financial_profile", "knowledge_base", "marketplace", "memories",
    "focus_modes", "professional_directory", "client_management",
    "agent_operations", "insurance_quotes", "estate_planning",
    "premium_finance", "email_campaigns", "portal", "organizations",
    "manager_dashboard", "review_queue",
  ],
  admin: [
    "conversations", "document_upload", "voice_chat", "suitability_assessment",
    "financial_profile", "knowledge_base", "marketplace", "memories",
    "focus_modes", "professional_directory", "client_management",
    "agent_operations", "insurance_quotes", "estate_planning",
    "premium_finance", "email_campaigns", "portal", "organizations",
    "manager_dashboard", "review_queue", "global_admin",
    "improvement_engine", "platform_settings",
  ],
};

// ─── INSIGHT COLLECTORS ───────────────────────────────────────────

/**
 * Collect usage optimization insights for any role.
 * Answers: "What features/tools am I not using that I should be?"
 */
async function collectUsageOptimization(userId: number, role: string): Promise<InsightData> {
  const db = await getDb();
  if (!db) return { metrics: {}, strengths: [], gaps: [], recommendations: [] };
  
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  // Gather actual usage data
  const [convCount] = await db.select({ count: count() }).from(conversations)
    .where(eq(conversations.userId, userId));
  
  const [recentConvCount] = await db.select({ count: count() }).from(conversations)
    .where(and(eq(conversations.userId, userId), gte(conversations.createdAt, new Date(sevenDaysAgo))));
  
  const [docCount] = await db.select({ count: count() }).from(documents)
    .where(eq(documents.userId, userId));
  
  const [memoryCount] = await db.select({ count: count() }).from(memories)
    .where(eq(memories.userId, userId));
  
  const [feedbackCount] = await db.select({ count: count() }).from(feedback)
    .where(eq(feedback.userId, userId));
  
  // Check profile completeness
  const profileRows = await db.select().from(userProfiles)
    .where(eq(userProfiles.userId, userId)).limit(1);
  const profile = profileRows[0];
  const profileFields = profile ? ["age", "zipCode", "jobTitle", "incomeRange", "savingsRange", "familySituation", "lifeStage", "goals"] : [];
  const filledFields = profile ? profileFields.filter(f => (profile as any)[f] != null && (profile as any)[f] !== "") : [];
  const profileCompleteness = profileFields.length > 0 ? Math.round((filledFields.length / profileFields.length) * 100) : 0;
  
  // Check suitability
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  const suitabilityDone = user?.suitabilityCompleted || false;
  
  // Check checklist progress
  const checklistRows = await db.select().from(workflowChecklist)
    .where(eq(workflowChecklist.userId, userId)).limit(1);
  const checklist = checklistRows[0];
  const checklistSteps = checklist?.steps as any[] || [];
  const completedSteps = checklistSteps.filter((s: any) => s.completed).length;
  
  // Check preferences
  const prefRows = await db.select().from(userPreferences)
    .where(eq(userPreferences.userId, userId)).limit(1);
  const hasPreferences = prefRows.length > 0;
  
  // Determine which features have been used
  const featuresAvailable = PLATFORM_FEATURES[role as keyof typeof PLATFORM_FEATURES] || PLATFORM_FEATURES.user;
  const featuresUsed: string[] = [];
  const featuresNotUsed: string[] = [];
  
  if (convCount.count > 0) featuresUsed.push("conversations"); else featuresNotUsed.push("conversations");
  if (docCount.count > 0) featuresUsed.push("document_upload"); else featuresNotUsed.push("document_upload");
  if (memoryCount.count > 0) featuresUsed.push("memories"); else featuresNotUsed.push("memories");
  if (suitabilityDone) featuresUsed.push("suitability_assessment"); else featuresNotUsed.push("suitability_assessment");
  if (profileCompleteness > 50) featuresUsed.push("financial_profile"); else featuresNotUsed.push("financial_profile");
  if (feedbackCount.count > 0) featuresUsed.push("focus_modes"); // proxy
  
  // Check advisor-specific features
  if (role === "advisor" || role === "manager" || role === "admin") {
    const [clientCount] = await db.select({ count: count() }).from(clientAssociations)
      .where(eq(clientAssociations.professionalId, userId));
    if (clientCount.count > 0) featuresUsed.push("client_management"); else featuresNotUsed.push("client_management");
    
    const [profCtx] = await db.select({ count: count() }).from(professionalContext)
      .where(eq(professionalContext.userId, userId));
    if (profCtx.count > 0) featuresUsed.push("portal"); else featuresNotUsed.push("portal");
  }
  
  // Check manager features
  if (role === "manager" || role === "admin") {
    const [reviewCount] = await db.select({ count: count() }).from(reviewQueue);
    if (reviewCount.count > 0) featuresUsed.push("review_queue"); else featuresNotUsed.push("review_queue");
  }
  
  const adoptionRate = featuresAvailable.length > 0
    ? Math.round((featuresUsed.length / featuresAvailable.length) * 100)
    : 0;
  
  // Build insights
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];
  
  if (convCount.count > 10) strengths.push(`Active conversationalist with ${convCount.count} total conversations`);
  if (docCount.count > 0) strengths.push(`${docCount.count} documents uploaded to knowledge base`);
  if (suitabilityDone) strengths.push("Suitability assessment completed");
  if (profileCompleteness >= 80) strengths.push(`Financial profile ${profileCompleteness}% complete`);
  if (memoryCount.count > 5) strengths.push(`${memoryCount.count} memories saved for personalization`);
  
  if (!suitabilityDone) {
    gaps.push("Suitability assessment not completed");
    recommendations.push("Complete your suitability assessment to get more personalized financial advice tailored to your risk tolerance and goals");
  }
  if (profileCompleteness < 50) {
    gaps.push(`Financial profile only ${profileCompleteness}% complete`);
    recommendations.push("Fill in your financial profile (income, savings, goals) so the AI can provide specific, actionable recommendations instead of generic advice");
  }
  if (docCount.count === 0) {
    gaps.push("No documents uploaded to knowledge base");
    recommendations.push("Upload financial documents (statements, policies, tax returns) to your knowledge base so the AI can reference your actual data when answering questions");
  }
  if (memoryCount.count === 0) {
    gaps.push("No memories saved");
    recommendations.push("As you chat, the AI learns your preferences and context. Rate responses (thumbs up/down) to help it remember what matters to you");
  }
  if (convCount.count === 0) {
    gaps.push("No conversations started yet");
    recommendations.push("Start a conversation to explore financial planning, insurance analysis, or investment strategies");
  }
  if (recentConvCount.count === 0 && convCount.count > 0) {
    gaps.push("No conversations in the past 7 days");
    recommendations.push("You haven't chatted recently — check in to review your financial progress or explore new topics");
  }
  if (!hasPreferences) {
    gaps.push("AI preferences not customized");
    recommendations.push("Visit Settings > AI Preferences to customize response style, depth, and focus areas");
  }
  if (featuresNotUsed.includes("client_management") && (role === "advisor" || role === "manager")) {
    gaps.push("Client management not set up");
    recommendations.push("Set up client associations to manage your client book and provide personalized service");
  }
  if (featuresNotUsed.includes("portal") && (role === "advisor" || role === "manager")) {
    gaps.push("Professional portal not configured");
    recommendations.push("Configure your professional portal with your credentials, specializations, and practice details");
  }
  
  return {
    metrics: {
      totalConversations: convCount.count,
      recentConversations7d: recentConvCount.count,
      documentsUploaded: docCount.count,
      memoriesSaved: memoryCount.count,
      feedbackGiven: feedbackCount.count,
      profileCompleteness,
      suitabilityCompleted: suitabilityDone,
      featureAdoptionRate: adoptionRate,
      featuresUsedCount: featuresUsed.length,
      featuresAvailableCount: featuresAvailable.length,
      checklistProgress: `${completedSteps}/${checklistSteps.length}`,
    },
    strengths,
    gaps,
    recommendations,
  };
}

/**
 * Collect people performance insights.
 * For advisors: How well am I serving my clients?
 * For managers: How is my team performing?
 * For admins: How are all advisors performing?
 */
async function collectPeoplePerformance(userId: number, role: string): Promise<InsightData> {
  const db = await getDb();
  if (!db) return { metrics: {}, strengths: [], gaps: [], recommendations: [] };
  
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];
  const metrics: Record<string, number | string | boolean> = {};
  
  if (role === "advisor") {
    // How well am I serving my clients?
    const [clientCount] = await db.select({ count: count() }).from(clientAssociations)
      .where(and(eq(clientAssociations.professionalId, userId), eq(clientAssociations.status, "active")));
    metrics.activeClients = clientCount.count;
    
    // Feedback from my conversations
    const [positiveFb] = await db.select({ count: count() }).from(feedback)
      .where(and(eq(feedback.userId, userId), eq(feedback.rating, "up")));
    const [negativeFb] = await db.select({ count: count() }).from(feedback)
      .where(and(eq(feedback.userId, userId), eq(feedback.rating, "down")));
    const totalFb = positiveFb.count + negativeFb.count;
    metrics.totalFeedback = totalFb;
    metrics.positiveRate = totalFb > 0 ? Math.round((positiveFb.count / totalFb) * 100) : 0;
    
    // Recent activity
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [recentMsgs] = await db.select({ count: count() }).from(messages)
      .where(and(eq(messages.userId, userId), gte(messages.createdAt, sevenDaysAgo)));
    metrics.messagesLast7d = recentMsgs.count;
    
    if (clientCount.count > 0) strengths.push(`Managing ${clientCount.count} active client relationships`);
    if (metrics.positiveRate > 80) strengths.push(`${metrics.positiveRate}% positive feedback rate`);
    if (recentMsgs.count > 20) strengths.push(`Highly active with ${recentMsgs.count} messages in the past week`);
    
    if (clientCount.count === 0) {
      gaps.push("No active client associations");
      recommendations.push("Set up client associations to track and manage your client relationships");
    }
    if (totalFb > 5 && (metrics.positiveRate as number) < 70) {
      gaps.push(`Feedback satisfaction at ${metrics.positiveRate}% (below 70% target)`);
      recommendations.push("Review recent negative feedback to identify patterns and improve response quality");
    }
    if (recentMsgs.count < 5) {
      gaps.push("Low activity in the past 7 days");
      recommendations.push("Increase engagement with clients — proactive check-ins improve satisfaction");
    }
    
  } else if (role === "manager") {
    // How is my team performing?
    // Count advisors in the org
    const userOrgs = await db.select().from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.userId, userId)).limit(1);
    const orgId = userOrgs[0]?.organizationId;
    
    if (orgId) {
      const teamMembers = await db.select().from(userOrganizationRoles)
        .where(eq(userOrganizationRoles.organizationId, orgId));
      metrics.teamSize = teamMembers.length;
      
      // Pending reviews
      const [pendingReviews] = await db.select({ count: count() }).from(reviewQueue)
        .where(eq(reviewQueue.status, "pending"));
      metrics.pendingReviews = pendingReviews.count;
      
      if (teamMembers.length > 0) strengths.push(`Managing a team of ${teamMembers.length} members`);
      if (pendingReviews.count === 0) strengths.push("Review queue is clear — all items processed");
      
      if (pendingReviews.count > 10) {
        gaps.push(`${pendingReviews.count} items pending in review queue`);
        recommendations.push("Clear the review queue — pending items may delay client service");
      }
    } else {
      gaps.push("Not associated with any organization");
      recommendations.push("Join or create an organization to manage team members");
    }
    
  } else if (role === "admin") {
    // Platform-wide people performance
    const [totalUsers] = await db.select({ count: count() }).from(users);
    const [totalAdvisors] = await db.select({ count: count() }).from(users)
      .where(eq(users.role, "advisor"));
    const [activeUsers7d] = await db.select({ count: count() }).from(users)
      .where(gte(users.lastSignedIn, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    
    metrics.totalUsers = totalUsers.count;
    metrics.totalAdvisors = totalAdvisors.count;
    metrics.activeUsersLast7d = activeUsers7d.count;
    metrics.activeRate = totalUsers.count > 0 ? Math.round((activeUsers7d.count / totalUsers.count) * 100) : 0;
    
    // Feedback across platform
    const [totalPositive] = await db.select({ count: count() }).from(feedback)
      .where(eq(feedback.rating, "up"));
    const [totalNegative] = await db.select({ count: count() }).from(feedback)
      .where(eq(feedback.rating, "down"));
    const totalFb = totalPositive.count + totalNegative.count;
    metrics.platformSatisfaction = totalFb > 0 ? Math.round((totalPositive.count / totalFb) * 100) : 0;
    
    // Pending reviews
    const [pendingReviews] = await db.select({ count: count() }).from(reviewQueue)
      .where(eq(reviewQueue.status, "pending"));
    metrics.pendingReviews = pendingReviews.count;
    
    if (activeUsers7d.count > 0) strengths.push(`${activeUsers7d.count} active users in the past 7 days (${metrics.activeRate}% of total)`);
    if (totalAdvisors.count > 0) strengths.push(`${totalAdvisors.count} advisors on the platform`);
    if ((metrics.platformSatisfaction as number) > 80) strengths.push(`Platform satisfaction at ${metrics.platformSatisfaction}%`);
    
    if ((metrics.activeRate as number) < 30) {
      gaps.push(`Only ${metrics.activeRate}% of users active in the past 7 days`);
      recommendations.push("Consider engagement campaigns or onboarding improvements to increase user activity");
    }
    if (pendingReviews.count > 20) {
      gaps.push(`${pendingReviews.count} items pending review across the platform`);
      recommendations.push("Assign additional reviewers or adjust autonomy levels to reduce the review backlog");
    }
  }
  
  return { metrics, strengths, gaps, recommendations };
}

/**
 * Collect system/infrastructure insights.
 * For advisors: Is my practice setup optimized?
 * For managers: Is my team's configuration helping them?
 * For admins: Is the platform configuration optimal?
 */
async function collectSystemInfrastructure(userId: number, role: string): Promise<InsightData> {
  const db = await getDb();
  if (!db) return { metrics: {}, strengths: [], gaps: [], recommendations: [] };
  
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];
  const metrics: Record<string, number | string | boolean> = {};
  
  if (role === "advisor") {
    // Check professional AI settings
    const profSettings = await db.select().from(professionalAISettings)
      .where(eq(professionalAISettings.professionalId, userId)).limit(1);
    const hasAISettings = profSettings.length > 0;
    metrics.aiSettingsConfigured = hasAISettings;
    
    // Check professional context
    const profCtx = await db.select().from(professionalContext)
      .where(eq(professionalContext.userId, userId)).limit(1);
    const hasContext = profCtx.length > 0;
    metrics.professionalContextSet = hasContext;
    
    // Check user preferences
    const prefs = await db.select().from(userPreferences)
      .where(eq(userPreferences.userId, userId)).limit(1);
    const hasPrefs = prefs.length > 0;
    metrics.preferencesConfigured = hasPrefs;
    
    // Check org membership
    const orgRoles = await db.select().from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.userId, userId));
    metrics.organizationMemberships = orgRoles.length;
    
    if (hasAISettings) strengths.push("AI settings customized for your practice");
    if (hasContext) strengths.push("Professional context configured (specializations, credentials)");
    if (hasPrefs) strengths.push("User preferences set for personalized experience");
    if (orgRoles.length > 0) strengths.push(`Member of ${orgRoles.length} organization(s)`);
    
    if (!hasAISettings) {
      gaps.push("AI settings not customized");
      recommendations.push("Configure your AI settings (tone, response depth, creativity) in Settings to get responses tailored to your practice style");
    }
    if (!hasContext) {
      gaps.push("Professional context not set up");
      recommendations.push("Set up your professional context with your credentials, specializations, and practice focus so the AI can reference your expertise");
    }
    if (!hasPrefs) {
      gaps.push("Preferences not configured");
      recommendations.push("Visit Settings to configure your preferences for response format, focus areas, and notification settings");
    }
    
  } else if (role === "manager") {
    // Check org-level settings
    const userOrgs = await db.select().from(userOrganizationRoles)
      .where(eq(userOrganizationRoles.userId, userId)).limit(1);
    const orgId = userOrgs[0]?.organizationId;
    
    if (orgId) {
      const orgSettings = await db.select().from(organizationAISettings)
        .where(eq(organizationAISettings.organizationId, orgId)).limit(1);
      const hasOrgSettings = orgSettings.length > 0;
      metrics.orgAISettingsConfigured = hasOrgSettings;
      
      const mgrSettings = await db.select().from(managerAISettings)
        .where(eq(managerAISettings.managerId, userId)).limit(1);
      const hasMgrSettings = mgrSettings.length > 0;
      metrics.managerSettingsConfigured = hasMgrSettings;
      
      if (hasOrgSettings) strengths.push("Organization AI settings configured");
      if (hasMgrSettings) strengths.push("Manager-level AI overrides configured");
      
      if (!hasOrgSettings) {
        gaps.push("Organization AI settings not configured");
        recommendations.push("Configure organization-level AI settings to ensure consistent compliance language and response standards across your team");
      }
      if (!hasMgrSettings) {
        gaps.push("Manager AI settings not customized");
        recommendations.push("Set up manager-level AI overrides to fine-tune how the AI supports your specific team's workflows");
      }
    } else {
      gaps.push("Not associated with an organization");
      recommendations.push("Create or join an organization to manage team-level settings and compliance");
    }
    
  } else if (role === "admin") {
    // Platform-level configuration audit
    const platformSettings = await db.select().from(platformAISettings).limit(1);
    const hasPlatformSettings = platformSettings.length > 0;
    metrics.platformSettingsConfigured = hasPlatformSettings;
    
    // Count orgs with settings
    const [orgCount] = await db.select({ count: count() }).from(organizations);
    const [orgWithSettings] = await db.select({ count: count() }).from(organizationAISettings);
    metrics.totalOrganizations = orgCount.count;
    metrics.orgsWithAISettings = orgWithSettings.count;
    metrics.orgConfigRate = orgCount.count > 0 ? Math.round((orgWithSettings.count / orgCount.count) * 100) : 0;
    
    // Product catalog health
    const [productCount] = await db.select({ count: count() }).from(products);
    metrics.productsInCatalog = productCount.count;
    
    if (hasPlatformSettings) strengths.push("Platform AI settings configured");
    if (productCount.count > 0) strengths.push(`${productCount.count} products in the marketplace catalog`);
    if ((metrics.orgConfigRate as number) > 80) strengths.push(`${metrics.orgConfigRate}% of organizations have AI settings configured`);
    
    if (!hasPlatformSettings) {
      gaps.push("Platform AI settings not configured");
      recommendations.push("Configure platform-level AI settings (base prompt, default tone, model preferences) to establish baseline behavior");
    }
    if (orgCount.count > 0 && (metrics.orgConfigRate as number) < 50) {
      gaps.push(`Only ${metrics.orgConfigRate}% of organizations have configured AI settings`);
      recommendations.push("Reach out to organization admins to complete their AI configuration for consistent compliance");
    }
    if (productCount.count === 0) {
      gaps.push("No products in the marketplace catalog");
      recommendations.push("Add financial products to the marketplace so advisors can reference them in client conversations");
    }
  }
  
  return { metrics, strengths, gaps, recommendations };
}

// ─── MAIN INSIGHT BUILDER ─────────────────────────────────────────

/**
 * Get or compute insights for a specific user, direction, and layer.
 * Returns cached data if fresh, otherwise recomputes.
 */
export async function getInsight(userId: number, direction: AuditDirection, role: string): Promise<CachedInsight | null> {
  // Map role to layer
  const layerMap: Record<string, Layer> = {
    admin: "platform",
    manager: "manager",
    advisor: "professional",
    user: "user",
  };
  const layer = layerMap[role] || "user";
  
  // Check cache first
  const cached = await getCachedInsight(userId, direction, layer);
  if (cached) return cached;
  
  // Compute fresh insights
  let data: InsightData;
  switch (direction) {
    case "usage_optimization":
      data = await collectUsageOptimization(userId, role);
      break;
    case "people_performance":
      data = await collectPeoplePerformance(userId, role);
      break;
    case "system_infrastructure":
      data = await collectSystemInfrastructure(userId, role);
      break;
    default:
      return null;
  }
  
  // Build human-readable summary
  const summary = buildInsightSummary(direction, layer, role, data);
  
  const now = Date.now();
  const insight: CachedInsight = {
    insightType: direction,
    layer,
    data,
    summary,
    computedAt: now,
    expiresAt: now + ACTIVE_TTL,
  };
  
  // Cache it
  await setCachedInsight(userId, insight);
  
  return insight;
}

/**
 * Build all relevant insights for a user based on their role.
 * Returns a combined context string ready for system prompt injection.
 */
export async function buildInsightContext(userId: number, role: string): Promise<string> {
  const directions: AuditDirection[] = ["people_performance", "system_infrastructure", "usage_optimization"];
  
  // For regular users, only collect usage_optimization
  const relevantDirections = (role === "user" || role === "anonymous")
    ? ["usage_optimization" as AuditDirection]
    : directions;
  
  const insights = await Promise.all(
    relevantDirections.map(d => getInsight(userId, d, role))
  );
  
  const validInsights = insights.filter(Boolean) as CachedInsight[];
  if (validInsights.length === 0) return "";
  
  const sections = validInsights.map(i => {
    const dirLabel = i.insightType === "people_performance" ? "People Performance"
      : i.insightType === "system_infrastructure" ? "System & Infrastructure"
      : "Usage Optimization";
    return `<${dirLabel.toLowerCase().replace(/ /g, "_")}>\n${i.summary}\n</${dirLabel.toLowerCase().replace(/ /g, "_")}>`;
  });
  
  return `<contextual_insights>\nThe following are real-time insights about this user's actual platform usage, configuration, and performance. Reference these specific data points when answering audit-direction questions. Do NOT ask the user for information that is already provided here.\n\n${sections.join("\n\n")}\n</contextual_insights>`;
}

/**
 * Invalidate all cached insights for a user (called after significant actions).
 */
export async function invalidateInsightCache(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(userInsightsCache).where(eq(userInsightsCache.userId, userId));
}

// ─── SUMMARY BUILDER ──────────────────────────────────────────────

function buildInsightSummary(direction: AuditDirection, layer: Layer, role: string, data: InsightData): string {
  const lines: string[] = [];
  
  // Metrics section
  if (Object.keys(data.metrics).length > 0) {
    lines.push("Current Metrics:");
    for (const [key, value] of Object.entries(data.metrics)) {
      const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
      lines.push(`  - ${label}: ${value}`);
    }
  }
  
  // Strengths
  if (data.strengths.length > 0) {
    lines.push("\nStrengths:");
    data.strengths.forEach(s => lines.push(`  + ${s}`));
  }
  
  // Gaps
  if (data.gaps.length > 0) {
    lines.push("\nGaps Identified:");
    data.gaps.forEach(g => lines.push(`  ! ${g}`));
  }
  
  // Recommendations
  if (data.recommendations.length > 0) {
    lines.push("\nSpecific Recommendations:");
    data.recommendations.forEach((r, i) => lines.push(`  ${i + 1}. ${r}`));
  }
  
  return lines.join("\n");
}
