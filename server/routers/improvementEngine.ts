import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { eq, and, desc, gte, count } from "drizzle-orm";
import {
  layerAudits, improvementActions, layerMetrics, improvementFeedback,
  users, conversations, messages, auditTrail, feedback as feedbackTable,
  userOrganizationRoles, organizations, platformAISettings,
  organizationAISettings, managerAISettings, professionalAISettings,
  userConsents, documents, userProfiles, suitabilityAssessments,
  conversationFolders, memories,
} from "../../drizzle/schema";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

const LAYERS = ["platform", "organization", "manager", "professional", "user"] as const;
const DIRECTIONS = ["people_performance", "system_infrastructure", "usage_optimization"] as const;

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION 1A: PEOPLE PERFORMANCE — How well are people at this layer
// serving the users below them?
// ═══════════════════════════════════════════════════════════════════════════

async function collectPeopleMetrics(db: any, layer: string, targetId?: number) {
  const now = Date.now();
  const weekAgo = now - 604800000;

  switch (layer) {
    case "platform": {
      // Platform admins: Are they maintaining the system for all users?
      const totalUsers = await db.select({ count: count() }).from(users);
      const activeUsers = await db.select({ count: count() }).from(users)
        .where(gte(users.lastSignedIn, new Date(now - 86400000)));
      const totalFb = await db.select({ count: count() }).from(feedbackTable);
      const positiveFb = await db.select({ count: count() }).from(feedbackTable)
        .where(eq(feedbackTable.rating, "up" as any));
      const totalOrgs = await db.select({ count: count() }).from(organizations);
      return {
        totalUsers: totalUsers[0]?.count || 0,
        activeUsersLast24h: activeUsers[0]?.count || 0,
        retentionRate: totalUsers[0]?.count > 0 ? (activeUsers[0]?.count || 0) / totalUsers[0]?.count : 0,
        totalOrganizations: totalOrgs[0]?.count || 0,
        userSatisfactionRate: (totalFb[0]?.count || 0) > 0 ? (positiveFb[0]?.count || 0) / totalFb[0]?.count : 0,
        totalFeedbackCount: totalFb[0]?.count || 0,
        description: "How well platform administrators are serving all organizations and users",
      };
    }
    case "organization": {
      // Org admins: Are they supporting their professionals and end-users?
      const members = await db.select({ count: count() }).from(userOrganizationRoles)
        .where(targetId ? eq(userOrganizationRoles.organizationId, targetId) : undefined);
      const activePros = await db.select({ count: count() }).from(userOrganizationRoles)
        .where(targetId ? and(
          eq(userOrganizationRoles.organizationId, targetId),
          eq(userOrganizationRoles.organizationRole, "professional"),
          eq(userOrganizationRoles.status, "active"),
        ) : eq(userOrganizationRoles.organizationRole, "professional"));
      return {
        totalMembers: members[0]?.count || 0,
        activeProfessionals: activePros[0]?.count || 0,
        professionalToMemberRatio: (members[0]?.count || 0) > 0 ? (activePros[0]?.count || 0) / members[0]?.count : 0,
        description: "How well organization administrators are supporting their professionals and users",
      };
    }
    case "manager": {
      // Managers: Are they coaching professionals effectively?
      return {
        teamSize: 0,
        reviewsCompletedThisWeek: 0,
        averageReviewTurnaround: 0,
        escalationsHandled: 0,
        description: "How well managers are coaching and supporting their professional teams",
      };
    }
    case "professional": {
      // Professionals: Are they serving their clients well?
      return {
        clientCount: 0,
        averageResponseTime: 0,
        clientSatisfactionRate: 0,
        conversationsHandled: 0,
        description: "How well professionals are serving their assigned clients",
      };
    }
    case "user": {
      // Users don't serve anyone below — return engagement with the system
      return {
        engagementLevel: "N/A — users are the end consumers",
        description: "Users are the end consumers; people performance is measured at higher layers",
      };
    }
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION 1B: SYSTEM/INFRASTRUCTURE — How well is the system config
// and setup at this layer supporting users?
// ═══════════════════════════════════════════════════════════════════════════

async function collectSystemMetrics(db: any, layer: string, targetId?: number) {
  switch (layer) {
    case "platform": {
      const platformSettings = await db.select().from(platformAISettings).limit(1);
      const hasSettings = platformSettings.length > 0;
      const s = platformSettings[0];
      const totalConvos = await db.select({ count: count() }).from(conversations);
      const totalMsgs = await db.select({ count: count() }).from(messages);
      const auditEntries = await db.select({ count: count() }).from(auditTrail);
      return {
        hasBaseSystemPrompt: !!s?.baseSystemPrompt,
        hasGlobalGuardrails: !!s?.globalGuardrails,
        hasProhibitedTopics: !!s?.prohibitedTopics,
        hasPlatformDisclaimer: !!s?.platformDisclaimer,
        hasModelPreferences: !!s?.modelPreferences,
        hasEnsembleWeights: !!s?.ensembleWeights,
        maxTokensConfigured: s?.maxTokensDefault || 0,
        temperatureConfigured: s?.temperatureDefault || 0,
        totalConversations: totalConvos[0]?.count || 0,
        totalMessages: totalMsgs[0]?.count || 0,
        auditTrailEntries: auditEntries[0]?.count || 0,
        configCompleteness: hasSettings ? [
          !!s?.baseSystemPrompt, !!s?.globalGuardrails, !!s?.prohibitedTopics,
          !!s?.platformDisclaimer, !!s?.modelPreferences,
        ].filter(Boolean).length / 5 * 100 : 0,
        description: "Platform system configuration, AI settings, guardrails, and infrastructure health",
      };
    }
    case "organization": {
      const orgSettings = targetId
        ? await db.select().from(organizationAISettings).where(eq(organizationAISettings.organizationId, targetId)).limit(1)
        : await db.select().from(organizationAISettings).limit(1);
      const s = orgSettings[0];
      return {
        hasBrandVoice: !!s?.brandVoice,
        hasComplianceLanguage: !!s?.complianceLanguage,
        hasCustomDisclaimers: !!s?.customDisclaimers,
        hasPromptOverlay: !!s?.promptOverlay,
        hasApprovedProductCategories: !!s?.approvedProductCategories,
        hasProhibitedTopics: !!s?.prohibitedTopics,
        toneConfigured: !!s?.toneStyle,
        modelPreferencesSet: !!s?.modelPreferences,
        configCompleteness: s ? [
          !!s.brandVoice, !!s.complianceLanguage, !!s.customDisclaimers,
          !!s.promptOverlay, !!s.approvedProductCategories, !!s.prohibitedTopics,
        ].filter(Boolean).length / 6 * 100 : 0,
        description: "Organization AI configuration, branding, compliance settings, and policy setup",
      };
    }
    case "manager": {
      const mgrSettings = targetId
        ? await db.select().from(managerAISettings).where(eq(managerAISettings.managerId, targetId)).limit(1)
        : await db.select().from(managerAISettings).limit(1);
      const s = mgrSettings[0];
      return {
        hasTeamFocusAreas: !!s?.teamFocusAreas,
        hasClientSegmentTargeting: !!s?.clientSegmentTargeting,
        hasReportingRequirements: !!s?.reportingRequirements,
        hasPromptOverlay: !!s?.promptOverlay,
        configCompleteness: s ? [
          !!s.teamFocusAreas, !!s.clientSegmentTargeting,
          !!s.reportingRequirements, !!s.promptOverlay,
        ].filter(Boolean).length / 4 * 100 : 0,
        description: "Manager layer configuration, team focus areas, and reporting setup",
      };
    }
    case "professional": {
      const proSettings = targetId
        ? await db.select().from(professionalAISettings).where(eq(professionalAISettings.professionalId, targetId)).limit(1)
        : await db.select().from(professionalAISettings).limit(1);
      const s = proSettings[0];
      return {
        hasSpecializations: !!s?.specializations,
        hasClientApproach: !!s?.clientApproach,
        hasPromptOverlay: !!s?.promptOverlay,
        hasCertifications: !!s?.certifications,
        configCompleteness: s ? [
          !!s.specializations, !!s.clientApproach,
          !!s.promptOverlay, !!s.certifications,
        ].filter(Boolean).length / 4 * 100 : 0,
        description: "Professional layer configuration, specializations, and client approach setup",
      };
    }
    case "user": {
      // User-level system: how well is the system configured for this specific user?
      if (!targetId) return { description: "No target user specified" };
      const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetId)).limit(1);
      const suitability = await db.select().from(suitabilityAssessments).where(eq(suitabilityAssessments.userId, targetId)).limit(1);
      const consents = await db.select().from(userConsents).where(eq(userConsents.userId, targetId));
      const p = profile[0];
      return {
        hasProfile: !!p,
        hasAge: !!p?.age,
        hasIncomeRange: !!p?.incomeRange,
        hasGoals: !!p?.goals,
        hasSuitabilityAssessment: suitability.length > 0,
        consentCount: consents.filter((c: any) => c.granted).length,
        profileCompleteness: p ? [
          !!p.age, !!p.zipCode, !!p.jobTitle, !!p.incomeRange,
          !!p.savingsRange, !!p.familySituation, !!p.goals,
        ].filter(Boolean).length / 7 * 100 : 0,
        description: "How well the system is configured to serve this specific user's needs",
      };
    }
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTION 2: USAGE OPTIMIZATION — How can the user better leverage
// the tools and features available at their layer?
// ═══════════════════════════════════════════════════════════════════════════

async function collectUsageMetrics(db: any, layer: string, targetId?: number) {
  switch (layer) {
    case "platform": {
      // Platform admin: Are they using all admin features?
      const platformSettings = await db.select().from(platformAISettings).limit(1);
      const orgs = await db.select({ count: count() }).from(organizations);
      const totalAudits = await db.select({ count: count() }).from(layerAudits);
      return {
        platformSettingsConfigured: platformSettings.length > 0,
        organizationsCreated: orgs[0]?.count || 0,
        auditsRun: totalAudits[0]?.count || 0,
        featuresUsed: {
          aiSettings: platformSettings.length > 0,
          organizations: (orgs[0]?.count || 0) > 0,
          auditEngine: (totalAudits[0]?.count || 0) > 0,
        },
        description: "How effectively platform admins are using available platform management tools",
      };
    }
    case "organization": {
      const orgSettings = targetId
        ? await db.select().from(organizationAISettings).where(eq(organizationAISettings.organizationId, targetId)).limit(1)
        : [];
      return {
        aiSettingsConfigured: orgSettings.length > 0,
        brandingSetUp: !!orgSettings[0]?.brandVoice,
        complianceConfigured: !!orgSettings[0]?.complianceLanguage,
        productCategoriesSet: !!orgSettings[0]?.approvedProductCategories,
        featuresUsed: {
          branding: !!orgSettings[0]?.brandVoice,
          compliance: !!orgSettings[0]?.complianceLanguage,
          products: !!orgSettings[0]?.approvedProductCategories,
          promptOverlay: !!orgSettings[0]?.promptOverlay,
        },
        description: "How effectively org admins are using organization management features",
      };
    }
    case "manager": {
      return {
        teamConfigured: false,
        reviewQueueActive: false,
        reportingSetUp: false,
        featuresUsed: {
          teamManagement: false,
          reviewQueue: false,
          reporting: false,
          coaching: false,
        },
        description: "How effectively managers are using team management and coaching tools",
      };
    }
    case "professional": {
      return {
        profileComplete: false,
        clientsAssigned: 0,
        aiSettingsCustomized: false,
        featuresUsed: {
          clientManagement: false,
          aiCustomization: false,
          knowledgeBase: false,
          marketplace: false,
        },
        description: "How effectively professionals are using client management and advisory tools",
      };
    }
    case "user": {
      if (!targetId) return { description: "No target user specified" };
      const convos = await db.select({ count: count() }).from(conversations)
        .where(eq(conversations.userId, targetId));
      const docs = await db.select({ count: count() }).from(documents)
        .where(eq(documents.userId, targetId));
      const mems = await db.select({ count: count() }).from(memories)
        .where(eq(memories.userId, targetId));
      const folders = await db.select({ count: count() }).from(conversationFolders)
        .where(eq(conversationFolders.userId, targetId));
      const profile = await db.select().from(userProfiles).where(eq(userProfiles.userId, targetId)).limit(1);
      const suitability = await db.select().from(suitabilityAssessments).where(eq(suitabilityAssessments.userId, targetId)).limit(1);
      const consents = await db.select().from(userConsents).where(eq(userConsents.userId, targetId));

      const featuresUsed = {
        chat: (convos[0]?.count || 0) > 0,
        documents: (docs[0]?.count || 0) > 0,
        memories: (mems[0]?.count || 0) > 0,
        folders: (folders[0]?.count || 0) > 0,
        profile: !!profile[0],
        suitability: suitability.length > 0,
        consents: consents.filter((c: any) => c.granted).length > 0,
      };
      const adoptionRate = Object.values(featuresUsed).filter(Boolean).length / Object.keys(featuresUsed).length * 100;

      return {
        conversationCount: convos[0]?.count || 0,
        documentCount: docs[0]?.count || 0,
        memoryCount: mems[0]?.count || 0,
        folderCount: folders[0]?.count || 0,
        profileComplete: !!profile[0],
        suitabilityDone: suitability.length > 0,
        consentsGranted: consents.filter((c: any) => c.granted).length,
        featureAdoptionRate: adoptionRate,
        featuresUsed,
        description: "How effectively the user is leveraging available platform features",
      };
    }
    default:
      return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AI ANALYSIS ENGINE — Generates direction-specific recommendations
// ═══════════════════════════════════════════════════════════════════════════

const DIRECTION_PROMPTS: Record<string, Record<string, string>> = {
  people_performance: {
    platform: "Analyze how well platform administrators are serving all organizations and end-users. Look at user retention, satisfaction, support responsiveness, and whether admins are proactively maintaining the system.",
    organization: "Analyze how well organization administrators are supporting their professionals and end-users. Look at member engagement, professional-to-member ratios, and whether org admins are actively managing their teams.",
    manager: "Analyze how well managers are coaching and supporting their professional teams. Look at review turnaround, escalation handling, and coaching effectiveness.",
    professional: "Analyze how well professionals are serving their assigned clients. Look at response times, client satisfaction, conversation quality, and proactive outreach.",
    user: "Users are end consumers. Analyze their engagement patterns to identify if they're being well-served by the layers above them.",
  },
  system_infrastructure: {
    platform: "Analyze the platform's system configuration and infrastructure health. Check AI settings completeness, guardrails, disclaimers, model configuration, and whether all critical system settings are properly configured.",
    organization: "Analyze the organization's system configuration. Check branding, compliance language, disclaimers, product categories, prompt overlays, and whether all org-level AI settings are properly configured.",
    manager: "Analyze the manager layer's system configuration. Check team focus areas, client segment targeting, reporting requirements, and prompt overlay configuration.",
    professional: "Analyze the professional layer's system configuration. Check specializations, client approach settings, certifications, and prompt overlay configuration.",
    user: "Analyze how well the system is configured for this specific user. Check profile completeness, suitability assessment, consent settings, and personalization configuration.",
  },
  usage_optimization: {
    platform: "Analyze how effectively platform admins are using available management tools. Identify underused features like audit engine, organization management, AI settings, and monitoring tools. Suggest specific actions to improve platform utilization.",
    organization: "Analyze how effectively org admins are using organization features. Identify underused capabilities like branding, compliance configuration, product management, and team tools. Suggest specific actions.",
    manager: "Analyze how effectively managers are using team management tools. Identify underused features like review queues, reporting, coaching tools, and performance tracking. Suggest specific actions.",
    professional: "Analyze how effectively professionals are using advisory tools. Identify underused features like client management, AI customization, knowledge base, and marketplace. Suggest specific actions.",
    user: "Analyze how effectively the user is leveraging platform features. Identify underused capabilities like document upload, memory system, folders, suitability assessment, and AI chat modes. Suggest specific actions to get more value from the platform.",
  },
};

async function generateDirectionalAnalysis(
  layer: string, direction: string, metrics: any, targetId?: number
) {
  const directionPrompt = DIRECTION_PROMPTS[direction]?.[layer] || `Analyze ${layer} layer ${direction} metrics.`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are an AI improvement engine for Stewardry, a financial advisory platform with 5 layers: Platform → Organization → Manager → Professional → User.

You are auditing the "${layer}" layer in the "${direction}" direction.

Direction meanings:
- people_performance: How well are the PEOPLE at this layer serving users below them?
- system_infrastructure: How well is the SYSTEM CONFIGURATION at this layer supporting users?
- usage_optimization: How can users at this layer better LEVERAGE the tools available to them?

${directionPrompt}

Return JSON only.`,
      },
      {
        role: "user",
        content: `Metrics for ${layer} layer (${direction}):\n${JSON.stringify(metrics, null, 2)}\n${targetId ? `Target ID: ${targetId}` : ""}\n\nProvide:\n- healthScore (0-100)\n- findings: [{category, severity: "low"|"medium"|"high"|"critical", description, evidence}]\n- recommendations: [{priority: "low"|"medium"|"high"|"critical", title, description, autoImplementable: boolean, estimatedImpact, category, actionType: "auto_implement"|"recommend"|"escalate"|"monitor"}]`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "directional_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            healthScore: { type: "number" },
            findings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  category: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  evidence: { type: "string" },
                },
                required: ["category", "severity", "description", "evidence"],
                additionalProperties: false,
              },
            },
            recommendations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  priority: { type: "string" },
                  title: { type: "string" },
                  description: { type: "string" },
                  autoImplementable: { type: "boolean" },
                  estimatedImpact: { type: "string" },
                  category: { type: "string" },
                  actionType: { type: "string" },
                },
                required: ["priority", "title", "description", "autoImplementable", "estimatedImpact", "category", "actionType"],
                additionalProperties: false,
              },
            },
          },
          required: ["healthScore", "findings", "recommendations"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = response.choices?.[0]?.message?.content;
  try {
    return JSON.parse(typeof raw === "string" ? raw : "{}");
  } catch {
    return { healthScore: 50, findings: [], recommendations: [] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTO-IMPLEMENTATION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

async function tryAutoImplement(db: any, action: any, layer: string, targetId?: number) {
  const safeCategories = ["monitoring", "notification", "metric_tracking", "documentation"];
  if (!safeCategories.includes(action.category)) {
    return { implemented: false, reason: "Category requires manual review" };
  }
  const now = Date.now();
  await db.insert(layerMetrics).values({
    layer,
    targetId,
    metricName: `auto_improvement_${action.category}`,
    metricValue: 1,
    metricUnit: "count",
    context: JSON.stringify({ actionTitle: action.title }),
    period: "daily",
    recordedAt: now,
    createdAt: now,
  });
  return { implemented: true, reason: "Auto-implemented monitoring improvement" };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER
// ═══════════════════════════════════════════════════════════════════════════

export const improvementEngineRouter = router({
  // ─── RUN DIRECTIONAL AUDIT ──────────────────────────────────────────
  runAudit: protectedProcedure
    .input(z.object({
      layer: z.enum(LAYERS),
      direction: z.enum(DIRECTIONS),
      targetId: z.number().optional(),
      auditType: z.enum(["scheduled", "manual", "triggered", "continuous"]).default("manual"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      // Collect metrics based on direction
      let metrics: any = {};
      switch (input.direction) {
        case "people_performance":
          metrics = await collectPeopleMetrics(db, input.layer, input.targetId);
          break;
        case "system_infrastructure":
          metrics = await collectSystemMetrics(db, input.layer, input.targetId);
          break;
        case "usage_optimization":
          metrics = await collectUsageMetrics(db, input.layer, input.targetId);
          break;
      }

      // Create audit record
      await db.insert(layerAudits).values({
        layer: input.layer,
        auditType: input.auditType,
        auditDirection: input.direction,
        targetId: input.targetId,
        status: "running",
        runBy: ctx.user.id,
        startedAt: now,
        createdAt: now,
      });

      const audits = await db.select().from(layerAudits)
        .where(eq(layerAudits.runBy, ctx.user.id))
        .orderBy(desc(layerAudits.id))
        .limit(1);
      const audit = audits[0];

      // Run directional AI analysis
      const analysis = await generateDirectionalAnalysis(
        input.layer, input.direction, metrics, input.targetId
      );

      // Store metrics snapshot
      for (const [key, value] of Object.entries(metrics)) {
        if (typeof value === "number") {
          await db.insert(layerMetrics).values({
            layer: input.layer,
            targetId: input.targetId,
            metricName: `${input.direction}_${key}`,
            metricValue: value,
            period: "snapshot",
            recordedAt: now,
            createdAt: now,
          });
        }
      }

      // Create improvement actions from recommendations
      for (const rec of (analysis.recommendations || [])) {
        await db.insert(improvementActions).values({
          auditId: audit.id,
          layer: input.layer,
          direction: input.direction,
          actionType: rec.actionType || "recommend",
          category: rec.category || "general",
          title: rec.title,
          description: rec.description,
          implementationPlan: rec.description,
          priority: rec.priority || "medium",
          estimatedImpact: rec.estimatedImpact,
          status: rec.autoImplementable ? "implementing" : "proposed",
          createdAt: now,
          updatedAt: now,
        });
      }

      // Try auto-implementing safe actions
      const actions = await db.select().from(improvementActions)
        .where(and(
          eq(improvementActions.auditId, audit.id),
          eq(improvementActions.status, "implementing"),
        ));

      for (const action of actions) {
        const result = await tryAutoImplement(db, action, input.layer, input.targetId);
        await db.update(improvementActions).set({
          status: result.implemented ? "implemented" : "proposed",
          implementedAt: result.implemented ? Date.now() : null,
          implementedBy: result.implemented ? "ai_engine" : null,
          actualImpact: result.reason,
          updatedAt: Date.now(),
        }).where(eq(improvementActions.id, action.id));
      }

      // Update audit with results
      await db.update(layerAudits).set({
        status: "completed",
        findings: JSON.stringify(analysis.findings),
        overallHealthScore: analysis.healthScore,
        metricsSnapshot: JSON.stringify(metrics),
        aiAnalysis: JSON.stringify(analysis),
        recommendations: JSON.stringify(analysis.recommendations),
        completedAt: Date.now(),
      }).where(eq(layerAudits.id, audit.id));

      return {
        auditId: audit.id,
        direction: input.direction,
        healthScore: analysis.healthScore,
        findingsCount: (analysis.findings || []).length,
        recommendationsCount: (analysis.recommendations || []).length,
        autoImplemented: actions.filter((a: any) => a.status === "implemented").length,
      };
    }),

  // ─── RUN FULL LAYER AUDIT (all 3 directions) ───────────────────────
  runFullAudit: protectedProcedure
    .input(z.object({
      layer: z.enum(LAYERS),
      targetId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const results: any[] = [];
      // We'll call runAudit internally for each direction
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      for (const direction of DIRECTIONS) {
        let metrics: any = {};
        switch (direction) {
          case "people_performance":
            metrics = await collectPeopleMetrics(db, input.layer, input.targetId);
            break;
          case "system_infrastructure":
            metrics = await collectSystemMetrics(db, input.layer, input.targetId);
            break;
          case "usage_optimization":
            metrics = await collectUsageMetrics(db, input.layer, input.targetId);
            break;
        }

        await db.insert(layerAudits).values({
          layer: input.layer,
          auditType: "manual",
          auditDirection: direction,
          targetId: input.targetId,
          status: "running",
          runBy: ctx.user.id,
          startedAt: now,
          createdAt: now,
        });

        const audits = await db.select().from(layerAudits)
          .where(eq(layerAudits.runBy, ctx.user.id))
          .orderBy(desc(layerAudits.id))
          .limit(1);
        const audit = audits[0];

        const analysis = await generateDirectionalAnalysis(
          input.layer, direction, metrics, input.targetId
        );

        for (const rec of (analysis.recommendations || [])) {
          await db.insert(improvementActions).values({
            auditId: audit.id,
            layer: input.layer,
            direction,
            actionType: rec.actionType || "recommend",
            category: rec.category || "general",
            title: rec.title,
            description: rec.description,
            implementationPlan: rec.description,
            priority: rec.priority || "medium",
            estimatedImpact: rec.estimatedImpact,
            status: rec.autoImplementable ? "implementing" : "proposed",
            createdAt: now,
            updatedAt: now,
          });
        }

        await db.update(layerAudits).set({
          status: "completed",
          findings: JSON.stringify(analysis.findings),
          overallHealthScore: analysis.healthScore,
          metricsSnapshot: JSON.stringify(metrics),
          aiAnalysis: JSON.stringify(analysis),
          recommendations: JSON.stringify(analysis.recommendations),
          completedAt: Date.now(),
        }).where(eq(layerAudits.id, audit.id));

        results.push({
          direction,
          auditId: audit.id,
          healthScore: analysis.healthScore,
          findingsCount: (analysis.findings || []).length,
          recommendationsCount: (analysis.recommendations || []).length,
        });
      }

      return { layer: input.layer, results };
    }),

  // ─── LAYER OVERVIEW (with direction breakdown) ──────────────────────
  layerOverview: protectedProcedure.query(async ({ ctx }) => {
    const db = await (await import("../db")).getDb();
    if (!db) return [];

    const overview = [];
    for (const layer of LAYERS) {
      const directionScores: Record<string, any> = {};

      for (const direction of DIRECTIONS) {
        const latestAudit = await db.select().from(layerAudits)
          .where(and(
            eq(layerAudits.layer, layer),
            eq(layerAudits.auditDirection, direction),
            eq(layerAudits.status, "completed"),
          ))
          .orderBy(desc(layerAudits.createdAt))
          .limit(1);

        const pendingActions = await db.select({ count: count() }).from(improvementActions)
          .where(and(
            eq(improvementActions.layer, layer),
            eq(improvementActions.direction, direction),
            eq(improvementActions.status, "proposed"),
          ));

        directionScores[direction] = {
          healthScore: latestAudit[0]?.overallHealthScore || null,
          lastAuditAt: latestAudit[0]?.completedAt || null,
          pendingActions: pendingActions[0]?.count || 0,
          findings: latestAudit[0]?.findings || null,
        };
      }

      // Overall layer stats
      const totalPending = await db.select({ count: count() }).from(improvementActions)
        .where(and(
          eq(improvementActions.layer, layer),
          eq(improvementActions.status, "proposed"),
        ));
      const totalImplemented = await db.select({ count: count() }).from(improvementActions)
        .where(and(
          eq(improvementActions.layer, layer),
          eq(improvementActions.status, "implemented"),
        ));

      // Calculate composite health score
      const scores = Object.values(directionScores)
        .map((d: any) => d.healthScore)
        .filter((s: any) => s !== null) as number[];
      const compositeScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

      overview.push({
        layer,
        compositeHealthScore: compositeScore,
        directions: directionScores,
        totalPendingActions: totalPending[0]?.count || 0,
        totalImplementedActions: totalImplemented[0]?.count || 0,
      });
    }
    return overview;
  }),

  // ─── GET AUDIT HISTORY ──────────────────────────────────────────────
  listAudits: protectedProcedure
    .input(z.object({
      layer: z.enum(LAYERS).optional(),
      direction: z.enum(DIRECTIONS).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const conditions = [];
      if (input.layer) conditions.push(eq(layerAudits.layer, input.layer));
      if (input.direction) conditions.push(eq(layerAudits.auditDirection, input.direction));

      const audits = conditions.length > 0
        ? await db.select().from(layerAudits).where(and(...conditions)).orderBy(desc(layerAudits.createdAt)).limit(input.limit)
        : await db.select().from(layerAudits).orderBy(desc(layerAudits.createdAt)).limit(input.limit);

      return audits;
    }),

  // ─── GET AUDIT DETAILS ──────────────────────────────────────────────
  getAuditDetails: protectedProcedure
    .input(z.object({ auditId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return null;

      const audits = await db.select().from(layerAudits)
        .where(eq(layerAudits.id, input.auditId)).limit(1);
      if (audits.length === 0) return null;

      const actions = await db.select().from(improvementActions)
        .where(eq(improvementActions.auditId, input.auditId))
        .orderBy(desc(improvementActions.priority));

      return { audit: audits[0], actions };
    }),

  // ─── APPROVE/REJECT IMPROVEMENT ACTION ──────────────────────────────
  updateAction: protectedProcedure
    .input(z.object({
      actionId: z.number(),
      status: z.enum(["approved", "rejected", "rolled_back"]),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const now = Date.now();

      const updateData: any = { status: input.status, updatedAt: now };
      if (input.status === "approved") {
        updateData.approvedBy = ctx.user.id;
        updateData.approvedAt = now;
        updateData.status = "implemented";
        updateData.implementedAt = now;
        updateData.implementedBy = String(ctx.user.id);
      } else if (input.status === "rejected") {
        updateData.rejectedBy = ctx.user.id;
        updateData.rejectedAt = now;
        updateData.rejectionReason = input.reason;
      } else if (input.status === "rolled_back") {
        updateData.rolledBackAt = now;
      }

      await db.update(improvementActions).set(updateData)
        .where(eq(improvementActions.id, input.actionId));
      return { success: true };
    }),

  // ─── LIST PENDING ACTIONS (with direction filter) ───────────────────
  listPendingActions: protectedProcedure
    .input(z.object({
      layer: z.enum(LAYERS).optional(),
      direction: z.enum(DIRECTIONS).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return [];

      const conditions = [eq(improvementActions.status, "proposed")];
      if (input.layer) conditions.push(eq(improvementActions.layer, input.layer));
      if (input.direction) conditions.push(eq(improvementActions.direction, input.direction));

      return db.select().from(improvementActions)
        .where(and(...conditions))
        .orderBy(desc(improvementActions.priority))
        .limit(50);
    }),

  // ─── METRICS TIMELINE ───────────────────────────────────────────────
  metricsTimeline: protectedProcedure
    .input(z.object({
      layer: z.enum(LAYERS),
      metricName: z.string(),
      days: z.number().int().min(1).max(90).default(30),
    }))
    .query(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) return [];
      const since = Date.now() - input.days * 86400000;

      return db.select().from(layerMetrics)
        .where(and(
          eq(layerMetrics.layer, input.layer),
          eq(layerMetrics.metricName, input.metricName),
          gte(layerMetrics.recordedAt, since),
        ))
        .orderBy(layerMetrics.recordedAt)
        .limit(500);
    }),

  // ─── SUBMIT FEEDBACK ON IMPROVEMENT ─────────────────────────────────
  submitFeedback: protectedProcedure
    .input(z.object({
      actionId: z.number(),
      rating: z.number().int().min(1).max(5),
      helpful: z.boolean().default(true),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      await db.insert(improvementFeedback).values({
        actionId: input.actionId,
        userId: ctx.user.id,
        rating: input.rating,
        helpful: input.helpful,
        notes: input.notes,
        createdAt: Date.now(),
      });
      return { success: true };
    }),
});
