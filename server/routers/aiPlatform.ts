/**
 * AI Platform Router — C6/C7 + Tasks #40-42, #48, #50-51
 * AI tools registry, capability modes, badges, boundaries, command palette,
 * agent templates, graduated autonomy, agent replay
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import * as tools from "../services/aiToolsRegistry";
import * as modes from "../services/capabilityModes";
import * as badge from "../services/aiBadge";
import * as boundaries from "../services/aiBoundaries";
import * as palette from "../services/commandPalette";
import * as templates from "../services/agentTemplates";
import * as autonomy from "../services/graduatedAutonomy";
import * as replay from "../services/agentReplay";

export const aiPlatformRouter = router({
  // ─── AI Tools Registry ─────────────────────────────────────────────
  tools: router({
    discover: protectedProcedure
      .input(z.object({ toolType: z.string().optional(), query: z.string().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input }) => tools.discoverTools(input ?? undefined)),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => tools.getTool(input.id)),

    getByName: protectedProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => tools.getToolByName(input.name)),

    register: protectedProcedure
      .input(z.object({
        toolName: z.string(),
        toolType: z.enum(["calculator", "model", "action", "query", "report"]),
        description: z.string(),
        inputSchema: z.any(),
        outputSchema: z.any().optional(),
        trpcProcedure: z.string(),
        requiresAuth: z.boolean().optional(),
        requiresConfirmation: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => tools.registerTool(input)),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        description: z.string().optional(),
        inputSchema: z.any().optional(),
        outputSchema: z.any().optional(),
        trpcProcedure: z.string().optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return tools.updateTool(id, data);
      }),

    logCall: protectedProcedure
      .input(z.object({
        toolId: z.number(),
        conversationId: z.number().optional(),
        messageId: z.number().optional(),
        inputJson: z.any(),
        outputJson: z.any(),
        success: z.boolean(),
        latencyMs: z.number(),
        userModifiedInput: z.boolean().optional(),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => tools.logToolCall({ ...input, userId: ctx.user.id })),

    callHistory: protectedProcedure
      .input(z.object({ toolId: z.number().optional(), conversationId: z.number().optional(), limit: z.number().optional() }).optional())
      .query(async ({ input, ctx }) => tools.getToolCallHistory({ ...input, userId: ctx.user.id })),

    definitions: protectedProcedure
      .input(z.object({ toolTypes: z.array(z.string()).optional() }).optional())
      .query(async ({ input }) => tools.getToolDefinitionsForLLM(input?.toolTypes)),

    stats: protectedProcedure
      .query(async () => tools.getToolStats()),
  }),

  // ─── Capability Modes ──────────────────────────────────────────────
  modes: router({
    list: publicProcedure
      .input(z.object({ activeOnly: z.boolean().optional() }).optional())
      .query(async ({ input }) => modes.listModes(input?.activeOnly ?? true)),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => modes.getMode(input.id)),

    getByName: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => modes.getModeByName(input.name)),

    suggest: publicProcedure
      .input(z.object({ query: z.string(), userRole: z.string().optional() }))
      .query(async ({ input }) => ({
        suggestedMode: modes.suggestMode(input.query, input.userRole ?? "user"),
      })),

    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        description: z.string().optional(),
        icon: z.string().optional(),
        systemPromptAdditions: z.string().optional(),
        requiredKnowledgeCategories: z.array(z.string()).optional(),
        availableTools: z.array(z.string()).optional(),
        availableModels: z.array(z.string()).optional(),
        defaultForRoles: z.array(z.string()).optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => modes.createMode(input)),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        systemPromptAdditions: z.string().optional(),
        active: z.boolean().optional(),
        sortOrder: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        return modes.updateMode(id, data);
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => modes.deleteMode(input.id)),

    forRole: protectedProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => modes.getModesForRole(input.role)),

    promptAdditions: protectedProcedure
      .input(z.object({ modeName: z.string() }))
      .query(async ({ input }) => modes.getModePromptAdditions(input.modeName)),
  }),

  // ─── AI Badge / Watermark ──────────────────────────────────────────
  badge: router({
    create: publicProcedure
      .input(z.object({
        content: z.string(),
        modelUsed: z.string().optional(),
        confidenceScore: z.number().optional(),
        humanReviewed: z.boolean().optional(),
        reviewedBy: z.string().optional(),
        disclaimers: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => badge.createAIBadge(input.content, input)),

    markReviewed: protectedProcedure
      .input(z.object({ metadata: z.any(), reviewerName: z.string() }))
      .mutation(async ({ input }) => badge.markAsReviewed(input.metadata, input.reviewerName)),

    validate: publicProcedure
      .input(z.object({ content: z.string(), metadata: z.any() }))
      .query(async ({ input }) => ({ valid: badge.validateContentIntegrity(input.content, input.metadata) })),
  }),

  // ─── AI Boundaries ─────────────────────────────────────────────────
  boundaries: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => boundaries.getBoundaries(input?.category)),

    check: publicProcedure
      .input(z.object({ content: z.string(), action: z.string().optional() }))
      .query(async ({ input }) => boundaries.checkBoundaries(input.content, input.action)),

    update: protectedProcedure
      .input(z.object({ id: z.string(), enabled: z.boolean().optional(), severity: z.enum(["block", "warn", "escalate"]).optional() }))
      .mutation(async ({ input }) => {
        const { id, ...updates } = input;
        return boundaries.updateBoundary(id, updates);
      }),

    add: protectedProcedure
      .input(z.object({
        category: z.enum(["topic", "action", "data", "compliance", "safety"]),
        rule: z.string(),
        severity: z.enum(["block", "warn", "escalate"]),
        enabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => boundaries.addBoundary({ ...input, enabled: input.enabled ?? true })),

    promptInstructions: protectedProcedure
      .query(async () => boundaries.getBoundaryPromptInstructions()),
  }),

  // ─── Command Palette ───────────────────────────────────────────────
  commands: router({
    search: publicProcedure
      .input(z.object({ query: z.string(), userRole: z.string().optional() }))
      .query(async ({ input }) => palette.searchCommands(input.query, input.userRole)),

    byCategory: publicProcedure
      .input(z.object({ category: z.string(), userRole: z.string().optional() }))
      .query(async ({ input }) => palette.getCommandsByCategory(input.category, input.userRole)),

    shortcuts: publicProcedure
      .input(z.object({ userRole: z.string().optional() }).optional())
      .query(async ({ input }) => palette.getAllShortcuts(input?.userRole)),
  }),

  // ─── Agent Templates ───────────────────────────────────────────────
  templates: router({
    list: publicProcedure
      .input(z.object({ category: z.string().optional() }).optional())
      .query(async ({ input }) => templates.listTemplates(input?.category)),

    get: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => templates.getTemplate(input.id)),

    forRole: protectedProcedure
      .input(z.object({ role: z.string() }))
      .query(async ({ input }) => templates.getTemplatesForRole(input.role)),

    suggest: protectedProcedure
      .input(z.object({ query: z.string(), role: z.string() }))
      .query(async ({ input }) => templates.suggestTemplate(input.query, input.role)),
  }),

  // ─── Graduated Autonomy ────────────────────────────────────────────
  autonomy: router({
    profile: protectedProcedure
      .query(async ({ ctx }) => autonomy.getProfile(ctx.user.id)),

    recordInteraction: protectedProcedure
      .input(z.object({ success: z.boolean(), overridden: z.boolean(), escalated: z.boolean() }))
      .mutation(async ({ input, ctx }) => autonomy.recordInteraction(ctx.user.id, input.success, input.overridden, input.escalated)),

    canPerform: protectedProcedure
      .input(z.object({ action: z.string() }))
      .query(async ({ input, ctx }) => autonomy.canPerformAction(ctx.user.id, input.action)),

    availableActions: protectedProcedure
      .query(async ({ ctx }) => autonomy.getAvailableActions(ctx.user.id)),

    levelProgress: protectedProcedure
      .query(async ({ ctx }) => autonomy.getLevelProgress(ctx.user.id)),
  }),

  // ─── Agent Replay ──────────────────────────────────────────────────
  replay: router({
    start: protectedProcedure
      .input(z.object({
        conversationId: z.number(),
        messageId: z.number().optional(),
        agentType: z.string(),
        capabilityMode: z.string(),
      }))
      .mutation(async ({ input, ctx }) => replay.startReplaySession({ ...input, userId: ctx.user.id })),

    addStep: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        type: z.enum(["input", "reasoning", "tool_call", "tool_result", "output", "error", "escalation"]),
        content: z.string(),
        metadata: z.any().optional(),
        duration: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const { sessionId, ...step } = input;
        return replay.addReplayStep(sessionId, step);
      }),

    complete: protectedProcedure
      .input(z.object({
        sessionId: z.string(),
        outcome: z.enum(["success", "partial", "failure", "escalated"]),
        errorMessage: z.string().optional(),
      }))
      .mutation(async ({ input }) => replay.completeReplaySession(input.sessionId, input.outcome, input.errorMessage)),

    get: protectedProcedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => replay.getReplaySession(input.sessionId)),

    list: protectedProcedure
      .input(z.object({
        conversationId: z.number().optional(),
        outcome: z.string().optional(),
        limit: z.number().optional(),
      }).optional())
      .query(async ({ input, ctx }) => replay.listReplaySessions({ ...input, userId: ctx.user.id })),

    stats: protectedProcedure
      .query(async () => replay.getReplayStats()),
  }),
});
