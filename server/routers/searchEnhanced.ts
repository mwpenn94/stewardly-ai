/**
 * Enhanced Search Router
 * Endpoints for: search caching, cited responses, product research mode
 */
import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { searchCacheService, productResearchService } from "../services/searchEnhanced";

export const searchEnhancedRouter = router({
  // Product research with caching and citations
  researchProduct: protectedProcedure
    .input(z.object({
      query: z.string().min(1),
      category: z.string().default("general"),
    }))
    .mutation(async ({ input }) => {
      return productResearchService.researchProduct(input.query, input.category);
    }),

  // Compare multiple products
  compareProducts: protectedProcedure
    .input(z.object({
      products: z.array(z.string()).min(2).max(5),
      criteria: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      return productResearchService.compareProducts(input.products, input.criteria);
    }),

  // Proactive research suggestions based on user context
  proactiveResearch: protectedProcedure
    .input(z.object({ userContext: z.string().min(1) }))
    .mutation(async ({ input }) => {
      return productResearchService.proactiveResearch(input.userContext);
    }),

  // Cache stats
  cacheStats: protectedProcedure.query(async () => {
    return searchCacheService.getStats();
  }),

  // Cleanup expired cache
  cleanupCache: protectedProcedure.mutation(async () => {
    const removed = await searchCacheService.cleanup();
    return { removed };
  }),
});
