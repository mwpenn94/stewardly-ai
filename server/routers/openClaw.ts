/**
 * OpenClaw Agent Router — CRUD, launch, stop agent instances
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const openClawRouter = router({
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      type: z.enum(["compliance_monitor", "lead_processor", "report_generator", "plan_analyzer", "custom"]),
      description: z.string().max(1000).default(""),
      instructions: z.string().min(10).max(5000),
      model: z.string().optional(),
      schedule: z.string().optional(),
      maxBudgetPerRun: z.number().min(0.01).max(10).default(0.50),
      complianceAware: z.boolean().default(true),
      dataSources: z.array(z.string()).default([]),
      outputTargets: z.array(z.string()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const { createAgent } = await import("../services/openClawManager");
      const id = await createAgent(ctx.user!.id, input);
      return { id };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const { listAgents } = await import("../services/openClawManager");
    return listAgents(ctx.user!.id);
  }),

  launch: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { launchAgent } = await import("../services/openClawManager");
      return { launched: await launchAgent(input.agentId, ctx.user!.id) };
    }),

  stop: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { stopAgent } = await import("../services/openClawManager");
      return { stopped: await stopAgent(input.agentId, ctx.user!.id) };
    }),

  delete: protectedProcedure
    .input(z.object({ agentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const { deleteAgent } = await import("../services/openClawManager");
      return { deleted: await deleteAgent(input.agentId, ctx.user!.id) };
    }),

  /** Recent action log for an agent the caller owns. Pass 58. */
  listActions: protectedProcedure
    .input(z.object({ agentId: z.number(), limit: z.number().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const { listAgentActions } = await import("../services/openClawManager");
      return listAgentActions(input.agentId, ctx.user!.id, input.limit);
    }),
});
