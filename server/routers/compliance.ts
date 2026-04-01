import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { contextualLLM } from "../shared/stewardlyWiring";
import { complianceReviews, complianceFlags } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";

async function db() {
  return (await import("../db")).getDb();
}

// ─── FINRA 2210 + SEC Compliance Rules ─────────────────────────────────
const COMPLIANCE_RULES = [
  { code: "FINRA_2210_FAIR", name: "Fair & Balanced", description: "Content must be fair, balanced, and not misleading" },
  { code: "FINRA_2210_GUARANTEE", name: "No Performance Guarantees", description: "Cannot guarantee future performance or returns" },
  { code: "FINRA_2210_COMPARISON", name: "Fair Comparisons", description: "Product comparisons must be balanced and include material differences" },
  { code: "SEC_DISCLAIMER", name: "Investment Disclaimer", description: "Investment advice must include appropriate disclaimers" },
  { code: "SEC_SUITABILITY", name: "Suitability Statement", description: "Recommendations must reference suitability considerations" },
  { code: "FINRA_2111_BASIS", name: "Reasonable Basis", description: "Recommendations must have a reasonable basis" },
  { code: "REG_BI", name: "Reg BI Best Interest", description: "Must act in client's best interest" },
  { code: "MISLEADING_LANGUAGE", name: "Misleading Language", description: "Avoid superlatives, absolute claims, or misleading statistics" },
];

function generateReviewId(): string {
  return "cr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateFlagId(): string {
  return "cf_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const complianceRouter = router({
  // ─── Review content for compliance ─────────────────────────────────
  reviewContent: protectedProcedure
    .input(z.object({
      content: z.string().min(1),
      contentType: z.enum(["chat_response", "email", "report", "marketing", "recommendation"]).default("chat_response"),
      organizationId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const d = (await db())!;
      // Assemble deep context for compliance-aware review
      let platformContext = "";
      try {
        const { getQuickContext } = await import("../services/deepContextAssembler");
        if (ctx.user?.id) {
          platformContext = await getQuickContext(ctx.user.id, `compliance review: ${input.content.slice(0, 200)}`, "compliance");
        }
      } catch { /* best-effort */ }
      // Use LLM to analyze content for compliance issues
      const analysisResponse = await contextualLLM({
        userId: ctx.user.id,
        contextType: "analysis",
        messages: [
          {
            role: "system",
            content: `You are a financial compliance reviewer specializing in FINRA Rule 2210, SEC regulations, and Reg BI.
${platformContext ? `\n<platform_context>\n${platformContext}\n</platform_context>\nUse the above context about the client and organization to provide more specific compliance guidance.\n` : ""}.
Analyze the following content for compliance issues. Check for:
1. Performance guarantees or promises of returns
2. Misleading comparisons or statistics
3. Missing disclaimers on investment topics
4. Superlatives or absolute claims ("best", "guaranteed", "risk-free")
5. Suitability concerns (generic advice without qualification)
6. Unfair or unbalanced product presentations
7. Missing risk disclosures

Return a JSON response with this exact schema:
{
  "flags": [
    {
      "rule_code": "FINRA_2210_GUARANTEE",
      "severity": "critical|warning|info",
      "description": "specific issue found",
      "suggested_fix": "how to fix it",
      "original_text": "the problematic text snippet"
    }
  ],
  "overall_severity": "clean|low|medium|high|critical",
  "corrected_content": "the content with compliance fixes applied (or original if clean)",
  "summary": "brief summary of findings"
}`
          },
          { role: "user", content: `Content type: ${input.contentType}\n\nContent to review:\n${input.content}` }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "compliance_review",
            strict: true,
            schema: {
              type: "object",
              properties: {
                flags: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      rule_code: { type: "string" },
                      severity: { type: "string" },
                      description: { type: "string" },
                      suggested_fix: { type: "string" },
                      original_text: { type: "string" },
                    },
                    required: ["rule_code", "severity", "description", "suggested_fix", "original_text"],
                    additionalProperties: false,
                  },
                },
                overall_severity: { type: "string" },
                corrected_content: { type: "string" },
                summary: { type: "string" },
              },
              required: ["flags", "overall_severity", "corrected_content", "summary"],
              additionalProperties: false,
            },
          },
        },
      });

      const analysis = JSON.parse(analysisResponse.choices[0].message.content as string);

      // Store review
      const reviewId = generateReviewId();
      await d.insert(complianceReviews).values({
        id: reviewId,
        userId: String(ctx.user.id),
        organizationId: input.organizationId || null,
        reviewType: input.contentType,
        status: analysis.flags.length > 0 ? "flagged" : "clean",
        originalContent: input.content,
        flaggedIssues: JSON.stringify(analysis.flags),
        appliedFixes: analysis.corrected_content !== input.content ? analysis.corrected_content : null,
        severity: analysis.overall_severity,
        createdAt: Date.now(),
      });

      // Store individual flags
      if (analysis.flags.length > 0) {
        for (const flag of analysis.flags) {
          const matchedRule = COMPLIANCE_RULES.find(r => r.code === flag.rule_code);
          await d.insert(complianceFlags).values({
            id: generateFlagId(),
            reviewId,
            ruleCode: flag.rule_code,
            ruleName: matchedRule?.name || flag.rule_code,
            description: flag.description,
            severity: flag.severity,
            autoFixed: analysis.corrected_content !== input.content,
            fixApplied: flag.suggested_fix,
            createdAt: Date.now(),
          });
        }
      }

      return {
        reviewId,
        flags: analysis.flags,
        overallSeverity: analysis.overall_severity,
        correctedContent: analysis.corrected_content,
        summary: analysis.summary,
        isClean: analysis.flags.length === 0,
      };
    }),

  // ─── Generate Reg BI Best Interest documentation ───────────────────
  generateRegBIDoc: protectedProcedure
    .input(z.object({
      clientProfile: z.string(),
      recommendation: z.string(),
      alternatives: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Assemble deep context for Reg BI documentation
      let platformContext = "";
      try {
        const { getQuickContext } = await import("../services/deepContextAssembler");
        if (ctx.user?.id) {
          platformContext = await getQuickContext(ctx.user.id, `Reg BI documentation for: ${input.recommendation.slice(0, 200)}`, "compliance");
        }
      } catch { /* best-effort */ }
      const response = await contextualLLM({
        userId: ctx.user.id,
        contextType: "analysis",
        messages: [
          {
            role: "system",
            content: `You are a compliance documentation specialist. Generate a Regulation Best Interest (Reg BI) documentation package.
${platformContext ? `\n<platform_context>\n${platformContext}\n</platform_context>\nUse the above context to enrich the documentation with specific client and organizational details.\n` : ""}

Include these sections:
1. **Client Profile Summary** — risk tolerance, investment objectives, time horizon, financial situation
2. **Recommendation** — what is being recommended and why
3. **Reasonable Basis** — why this recommendation is suitable
4. **Alternatives Considered** — other options evaluated and why they were not selected
5. **Cost/Benefit Analysis** — fees, expenses, and expected benefits
6. **Material Conflicts of Interest** — any conflicts and how they are mitigated
7. **Suitability Determination** — final suitability assessment

Format as a professional compliance document in Markdown.`
          },
          {
            role: "user",
            content: `Client Profile:\n${input.clientProfile}\n\nRecommendation:\n${input.recommendation}\n\nAlternatives:\n${input.alternatives || "Not specified"}`
          }
        ],
      });

      return {
        document: response.choices[0].message.content as string,
        generatedAt: Date.now(),
        generatedBy: ctx.user.id,
      };
    }),

  // ─── Get compliance review history ─────────────────────────────────
  getReviews: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      status: z.enum(["all", "clean", "flagged", "pending", "reviewed"]).default("all"),
    }))
    .query(async ({ ctx, input }) => {
      const d = (await db())!;

      const conditions = [eq(complianceReviews.userId, String(ctx.user.id))];
      if (input.status !== "all") {
        conditions.push(eq(complianceReviews.status, input.status));
      }

      const reviews = await d
        .select()
        .from(complianceReviews)
        .where(and(...conditions))
        .orderBy(desc(complianceReviews.createdAt))
        .limit(input.limit);

      return reviews.map(r => ({
        ...r,
        flaggedIssues: r.flaggedIssues ? JSON.parse(r.flaggedIssues) : [],
      }));
    }),

  // ─── Get compliance dashboard stats ────────────────────────────────
  getDashboardStats: protectedProcedure.query(async ({ ctx }) => {
    const d = (await db())!;

    const [totalResult] = await d
      .select({ count: sql<number>`COUNT(*)` })
      .from(complianceReviews)
      .where(eq(complianceReviews.userId, String(ctx.user.id)));

    const [flaggedResult] = await d
      .select({ count: sql<number>`COUNT(*)` })
      .from(complianceReviews)
      .where(and(
        eq(complianceReviews.userId, String(ctx.user.id)),
        eq(complianceReviews.status, "flagged")
      ));

    const [cleanResult] = await d
      .select({ count: sql<number>`COUNT(*)` })
      .from(complianceReviews)
      .where(and(
        eq(complianceReviews.userId, String(ctx.user.id)),
        eq(complianceReviews.status, "clean")
      ));

    const [criticalResult] = await d
      .select({ count: sql<number>`COUNT(*)` })
      .from(complianceReviews)
      .where(and(
        eq(complianceReviews.userId, String(ctx.user.id)),
        eq(complianceReviews.severity, "critical")
      ));

    return {
      totalReviews: totalResult?.count || 0,
      flaggedReviews: flaggedResult?.count || 0,
      cleanReviews: cleanResult?.count || 0,
      criticalIssues: criticalResult?.count || 0,
      complianceRate: totalResult?.count ? Math.round(((cleanResult?.count || 0) / totalResult.count) * 100) : 100,
    };
  }),

  // ─── Get flags for a specific review ───────────────────────────────
  getReviewFlags: protectedProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ input }) => {
      const d = (await db())!;

      return d
        .select()
        .from(complianceFlags)
        .where(eq(complianceFlags.reviewId, input.reviewId))
        .orderBy(desc(complianceFlags.createdAt));
    }),

  // ─── Get available compliance rules ────────────────────────────────
  getRules: protectedProcedure.query(() => COMPLIANCE_RULES),
});
