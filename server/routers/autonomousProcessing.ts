/**
 * Autonomous Processing Router — Diverge/converge exploration loops
 */
import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";

export const autonomousProcessingRouter = router({
  start: protectedProcedure
    .input(z.object({
      topic: z.string().min(1).max(2000),
      focus: z.enum(["discovery", "apply", "connect", "critique", "general"]).default("general"),
      foci: z.array(z.enum(["discovery", "apply", "connect", "critique"])).optional(),
      mode: z.enum(["diverge", "converge"]),
      maxIterations: z.number().min(0).max(100).default(5),
      maxBudget: z.number().min(0.01).max(50).default(1.0),
      model: z.string().optional(),
      context: z.string().optional(),
      promptType: z.string().max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { startSession } = await import("../services/autonomousProcessing");
      const sessionId = await startSession({ userId: ctx.user!.id, ...input });
      return { sessionId };
    }),

  stop: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      const { stopSession } = await import("../services/autonomousProcessing");
      return { stopped: stopSession(input.sessionId) };
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      const { getSession } = await import("../services/autonomousProcessing");
      return getSession(input.sessionId);
    }),

  listSessions: protectedProcedure.query(async ({ ctx }) => {
    const { getUserSessions } = await import("../services/autonomousProcessing");
    return getUserSessions(ctx.user!.id);
  }),

  activeCount: protectedProcedure.query(async () => {
    const { getActiveSessionCount } = await import("../services/autonomousProcessing");
    return { active: getActiveSessionCount() };
  }),
});
