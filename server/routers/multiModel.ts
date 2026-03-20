import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getAvailablePerspectives, getBuiltInPresets } from "../multiModel";

export const multiModelRouter = router({
  perspectives: protectedProcedure.query(() => getAvailablePerspectives()),
  presets: protectedProcedure.query(() => getBuiltInPresets()),
  saveCustomPreset: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      perspectives: z.array(z.string()).min(1),
      weights: z.record(z.string(), z.number().min(0).max(2)),
    }))
    .mutation(async ({ input }) => {
      return {
        id: `custom_${Date.now()}`,
        ...input,
        isBuiltIn: false,
      };
    }),
});
