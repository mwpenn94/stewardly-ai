import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";
import { callDataApi } from "./_core/dataApi";
import {
  createConversation, getUserConversations, getConversation, deleteConversation,
  updateConversationTitle, addMessage, getConversationMessages,
  addDocument, getUserDocuments, updateDocumentStatus, addDocumentChunks,
  searchDocumentChunks, deleteDocument, getAllProducts, getProductsByCategory,
  addAuditEntry, getAuditTrail, addToReviewQueue, getPendingReviews, updateUserAvatar,
  updateReviewStatus, addMemory, getUserMemories, deleteMemory,
  addFeedback, getFeedbackStats, addQualityRating,
  saveSuitabilityAssessment, getUserSuitability,
  updateUserStyleProfile, updateUserSettings,
} from "./db";
import {
  buildSystemPrompt, FINANCIAL_DISCLAIMER, needsFinancialDisclaimer,
  detectPII, stripPII, calculateConfidence,
} from "./prompts";
import type { FocusMode, AdvisoryMode } from "@shared/types";

// ─── CHAT ROUTER ──────────────────────────────────────────────────
const chatRouter = router({
  send: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1).max(50000),
      mode: z.enum(["client", "coach", "manager"]).default("client"),
      focus: z.enum(["general", "financial", "both"]).default("both"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await getConversation(input.conversationId, ctx.user.id);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      // Save user message
      const userMsg = await addMessage({
        conversationId: input.conversationId,
        userId: ctx.user.id,
        role: "user",
        content: input.content,
      });

      // Get conversation history
      const history = await getConversationMessages(input.conversationId);

      // Get RAG context if available
      let ragContext = "";
      try {
        const chunks = await searchDocumentChunks(ctx.user.id, input.content, undefined, 5);
        if (chunks.length > 0) {
          ragContext = chunks.map((c, i) => `[Doc ${i + 1}]: ${c.content}`).join("\n\n");
        }
      } catch (e) { /* RAG is optional */ }

      // Get user memories
      let memoriesStr = "";
      try {
        const mems = await getUserMemories(ctx.user.id);
        if (mems.length > 0) {
          memoriesStr = mems.slice(0, 10).map(m => `- [${m.category}] ${m.content}`).join("\n");
        }
      } catch (e) { /* memories are optional */ }

      // Get product context for financial mode
      let productContext = "";
      if (input.focus === "financial" || input.focus === "both") {
        try {
          const products = await getAllProducts();
          if (products.length > 0) {
            productContext = products.slice(0, 20).map(p =>
              `${p.company} — ${p.name} (${p.category}): ${p.description || "No description"}`
            ).join("\n");
          }
        } catch (e) { /* products are optional */ }
      }

      // Build system prompt
      const systemPrompt = buildSystemPrompt({
        userName: ctx.user.name || "User",
        mode: input.mode as AdvisoryMode,
        focus: input.focus as FocusMode,
        styleProfile: ctx.user.styleProfile,
        ragContext: ragContext || undefined,
        memories: memoriesStr || undefined,
        suitabilityCompleted: ctx.user.suitabilityCompleted || false,
        productContext: productContext || undefined,
      });

      // Build messages for LLM
      const llmMessages = [
        { role: "system" as const, content: systemPrompt },
        ...history.slice(-20).map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      // Invoke LLM
      const response = await invokeLLM({ messages: llmMessages });
      let aiContent = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content
        : "";

      // Check for financial disclaimer
      const isFinancial = needsFinancialDisclaimer(aiContent, input.focus as FocusMode);
      if (isFinancial) {
        aiContent += FINANCIAL_DISCLAIMER;
      }

      // Calculate confidence
      const confidence = calculateConfidence({
        hasRAGContext: ragContext.length > 0,
        hasSuitability: ctx.user.suitabilityCompleted || false,
        focus: input.focus as FocusMode,
        isFinancialAdvice: isFinancial,
        responseLength: aiContent.length,
      });

      // Determine compliance status
      let complianceStatus: "approved" | "pending" | "flagged" = "approved";
      if (isFinancial && confidence < 0.6) {
        complianceStatus = "flagged";
      } else if (isFinancial && confidence < 0.85) {
        complianceStatus = "pending";
      }

      // Save assistant message
      const assistantMsg = await addMessage({
        conversationId: input.conversationId,
        userId: ctx.user.id,
        role: "assistant",
        content: aiContent,
        confidenceScore: confidence,
        complianceStatus,
        metadata: { model: response.model, focus: input.focus, mode: input.mode, hasRAG: ragContext.length > 0 },
      });

      // PII detection for audit
      const piiCheck = detectPII(input.content);

      // Add audit entry
      await addAuditEntry({
        userId: ctx.user.id,
        conversationId: input.conversationId,
        messageId: assistantMsg.id,
        action: "ai_response",
        details: stripPII(`User asked: ${input.content.substring(0, 200)}...`),
        piiDetected: piiCheck.hasPII,
        disclaimerAppended: isFinancial,
        reviewStatus: complianceStatus === "approved" ? "auto_approved" : "pending_review",
        complianceFlags: piiCheck.hasPII ? { piiTypes: piiCheck.types } : undefined,
      });

      // Add to review queue if needed
      if (complianceStatus !== "approved" && isFinancial) {
        await addToReviewQueue({
          userId: ctx.user.id,
          conversationId: input.conversationId,
          messageId: assistantMsg.id,
          confidenceScore: confidence,
          autonomyLevel: confidence >= 0.6 ? "medium" : "low",
          aiReasoning: `Focus: ${input.focus}, Mode: ${input.mode}, Confidence: ${confidence.toFixed(2)}`,
          aiRecommendation: aiContent.substring(0, 500),
          complianceNotes: isFinancial ? "Contains financial advice" : undefined,
        });
      }

      // Auto-generate title for new conversations
      if (history.length <= 1) {
        try {
          const titleResp = await invokeLLM({
            messages: [
              { role: "system", content: "Generate a short title (max 6 words) for this conversation. Return ONLY the title, nothing else." },
              { role: "user", content: input.content.substring(0, 500) },
            ],
          });
          const title = typeof titleResp.choices[0]?.message?.content === "string"
            ? titleResp.choices[0].message.content.replace(/["']/g, "").substring(0, 100)
            : "New Conversation";
          await updateConversationTitle(input.conversationId, ctx.user.id, title);
        } catch (e) { /* title generation is optional */ }
      }

      return {
        id: assistantMsg.id,
        content: aiContent,
        confidenceScore: confidence,
        complianceStatus,
        model: response.model,
      };
    }),
});

// ─── CONVERSATIONS ROUTER ─────────────────────────────────────────
const conversationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getUserConversations(ctx.user.id)),
  create: protectedProcedure
    .input(z.object({
      mode: z.enum(["client", "coach", "manager"]).default("client"),
      title: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => createConversation(ctx.user.id, input.mode, input.title)),
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const conv = await getConversation(input.id, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      return conv;
    }),
  messages: protectedProcedure
    .input(z.object({ conversationId: z.number() }))
    .query(({ input }) => getConversationMessages(input.conversationId)),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteConversation(input.id, ctx.user.id)),
  updateTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(({ ctx, input }) => updateConversationTitle(input.id, ctx.user.id, input.title)),
});

// ─── DOCUMENTS ROUTER ─────────────────────────────────────────────
const documentsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getUserDocuments(ctx.user.id)),
  upload: protectedProcedure
    .input(z.object({
      filename: z.string(),
      content: z.string(), // base64 encoded
      mimeType: z.string().optional(),
      category: z.enum(["personal_docs", "financial_products", "regulations"]).default("personal_docs"),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      const fileKey = `docs/${ctx.user.id}/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/octet-stream");

      const doc = await addDocument({
        userId: ctx.user.id,
        filename: input.filename,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        category: input.category,
      });

      // Process document for RAG (extract text and chunk)
      try {
        await updateDocumentStatus(doc.id, "processing");
        // Simple text extraction (for text-based files)
        const text = buffer.toString("utf-8").substring(0, 100000);
        // Chunk the text
        const chunkSize = 1000;
        const overlap = 200;
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += chunkSize - overlap) {
          chunks.push(text.substring(i, i + chunkSize));
        }
        await addDocumentChunks(chunks.map((content, index) => ({
          documentId: doc.id,
          userId: ctx.user.id,
          content,
          chunkIndex: index,
          category: input.category,
        })));
        await updateDocumentStatus(doc.id, "ready", text.substring(0, 5000), chunks.length);
      } catch (e) {
        await updateDocumentStatus(doc.id, "error");
      }

      return { id: doc.id, url };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDocument(input.id, ctx.user.id)),
});

// ─── PRODUCTS ROUTER ──────────────────────────────────────────────
const productsRouter = router({
  list: protectedProcedure.query(() => getAllProducts()),
  byCategory: protectedProcedure
    .input(z.object({ category: z.string() }))
    .query(({ input }) => getProductsByCategory(input.category)),
});

// ─── SUITABILITY ROUTER ──────────────────────────────────────────
const suitabilityRouter = router({
  get: protectedProcedure.query(({ ctx }) => getUserSuitability(ctx.user.id)),
  submit: protectedProcedure
    .input(z.object({
      riskTolerance: z.enum(["conservative", "moderate", "aggressive"]),
      investmentHorizon: z.string(),
      annualIncome: z.string(),
      netWorth: z.string(),
      investmentExperience: z.enum(["none", "limited", "moderate", "extensive"]),
      financialGoals: z.array(z.string()),
      insuranceNeeds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      await saveSuitabilityAssessment({
        userId: ctx.user.id,
        ...input,
        responses: input,
      });
      return { success: true };
    }),
});

// ─── REVIEW QUEUE ROUTER ─────────────────────────────────────────
const reviewRouter = router({
  pending: adminProcedure.query(() => getPendingReviews()),
  audit: adminProcedure
    .input(z.object({ userId: z.number().optional(), limit: z.number().default(50) }))
    .query(({ input }) => getAuditTrail(input.userId, input.limit)),
  approve: adminProcedure
    .input(z.object({ id: z.number(), action: z.string().optional() }))
    .mutation(({ ctx, input }) => updateReviewStatus(input.id, "approved", ctx.user.id, input.action)),
  reject: adminProcedure
    .input(z.object({ id: z.number(), action: z.string().optional() }))
    .mutation(({ ctx, input }) => updateReviewStatus(input.id, "rejected", ctx.user.id, input.action)),
  modify: adminProcedure
    .input(z.object({ id: z.number(), action: z.string() }))
    .mutation(({ ctx, input }) => updateReviewStatus(input.id, "modified", ctx.user.id, input.action)),
});

// ─── MEMORIES ROUTER ──────────────────────────────────────────────
const memoriesRouter = router({
  list: protectedProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(({ ctx, input }) => getUserMemories(ctx.user.id, input?.category)),
  add: protectedProcedure
    .input(z.object({
      category: z.enum(["fact", "preference", "goal", "relationship", "financial", "temporal"]),
      content: z.string().min(1),
      source: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addMemory({ userId: ctx.user.id, ...input })),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteMemory(input.id, ctx.user.id)),
});

// ─── FEEDBACK ROUTER ──────────────────────────────────────────────
const feedbackRouter = router({
  submit: protectedProcedure
    .input(z.object({
      messageId: z.number(),
      conversationId: z.number(),
      rating: z.enum(["up", "down"]),
      comment: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addFeedback({ userId: ctx.user.id, ...input })),
  stats: protectedProcedure.query(({ ctx }) => getFeedbackStats(ctx.user.id)),
});

// ─── VOICE ROUTER ─────────────────────────────────────────────────
const voiceRouter = router({
  transcribe: protectedProcedure
    .input(z.object({
      audioUrl: z.string(),
      language: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const result = await transcribeAudio({ audioUrl: input.audioUrl, language: input.language });
      if ("error" in result) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result;
    }),
  uploadAudio: protectedProcedure
    .input(z.object({ content: z.string(), mimeType: z.string().default("audio/webm") }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      const fileKey = `audio/${ctx.user.id}/${nanoid()}.webm`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      return { url };
    }),
});

// ─── SETTINGS ROUTER ──────────────────────────────────────────────
const settingsRouter = router({
  get: protectedProcedure.query(({ ctx }) => ({
    settings: ctx.user.settings,
    styleProfile: ctx.user.styleProfile,
    suitabilityCompleted: ctx.user.suitabilityCompleted,
    avatarUrl: (ctx.user as any).avatarUrl || null,
  })),
  update: protectedProcedure
    .input(z.object({ settings: z.record(z.string(), z.unknown()) }))
    .mutation(({ ctx, input }) => updateUserSettings(ctx.user.id, input.settings)),
  updateStyleProfile: protectedProcedure
    .input(z.object({ profile: z.string() }))
    .mutation(({ ctx, input }) => updateUserStyleProfile(ctx.user.id, input.profile)),
  uploadAvatar: protectedProcedure
    .input(z.object({ content: z.string(), mimeType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      if (buffer.length > 5 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Image must be under 5MB" });
      const ext = input.mimeType.includes("png") ? "png" : input.mimeType.includes("gif") ? "gif" : "jpg";
      const key = `avatars/${ctx.user.id}-${nanoid(8)}.${ext}`;
      const { url } = await storagePut(key, buffer, input.mimeType);
      await updateUserAvatar(ctx.user.id, url);
      return { url };
    }),
  removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
    await updateUserAvatar(ctx.user.id, null);
    return { success: true };
  }),
});

// ─── CALCULATORS ROUTER ──────────────────────────────────────────
const calculatorsRouter = router({
  iulProjection: protectedProcedure
    .input(z.object({
      age: z.number().min(18).max(80),
      annualPremium: z.number().min(100),
      years: z.number().min(1).max(50),
      illustratedRate: z.number().min(0).max(20),
      deathBenefit: z.number().min(10000),
    }))
    .mutation(({ input }) => {
      const projections = [];
      let cashValue = 0;
      const costOfInsurance = input.deathBenefit * 0.005; // simplified COI
      for (let year = 1; year <= input.years; year++) {
        cashValue = (cashValue + input.annualPremium - costOfInsurance) * (1 + input.illustratedRate / 100);
        const surrenderValue = Math.max(0, cashValue * (year < 10 ? 0.85 + year * 0.015 : 1));
        projections.push({
          year,
          age: input.age + year,
          premium: input.annualPremium,
          cashValue: Math.round(cashValue),
          surrenderValue: Math.round(surrenderValue),
          deathBenefit: Math.max(input.deathBenefit, Math.round(cashValue * 1.1)),
        });
      }
      return { projections, totalPremiums: input.annualPremium * input.years };
    }),

  premiumFinance: protectedProcedure
    .input(z.object({
      faceAmount: z.number().min(100000),
      annualPremium: z.number().min(1000),
      loanRate: z.number().min(0).max(20),
      years: z.number().min(1).max(30),
      collateralRate: z.number().min(0).max(20),
    }))
    .mutation(({ input }) => {
      const projections = [];
      let loanBalance = 0;
      let policyValue = 0;
      const policyGrowthRate = 0.065; // assumed illustrated rate
      for (let year = 1; year <= input.years; year++) {
        loanBalance = (loanBalance + input.annualPremium) * (1 + input.loanRate / 100);
        policyValue = (policyValue + input.annualPremium) * (1 + policyGrowthRate);
        const collateralCost = loanBalance * (input.collateralRate / 100);
        const netEquity = policyValue - loanBalance;
        projections.push({
          year,
          premium: input.annualPremium,
          loanBalance: Math.round(loanBalance),
          policyValue: Math.round(policyValue),
          collateralCost: Math.round(collateralCost),
          netEquity: Math.round(netEquity),
          deathBenefit: Math.max(input.faceAmount, Math.round(policyValue * 1.1)),
        });
      }
      const totalCost = projections.reduce((sum, p) => sum + p.collateralCost, 0);
      const roi = policyValue > 0 ? ((policyValue - loanBalance) / totalCost * 100) : 0;
      return { projections, totalCollateralCost: totalCost, roi: Math.round(roi * 100) / 100 };
    }),

  retirement: protectedProcedure
    .input(z.object({
      currentAge: z.number().min(18).max(80),
      retirementAge: z.number().min(50).max(90),
      currentSavings: z.number().min(0),
      monthlyContribution: z.number().min(0),
      expectedReturn: z.number().min(0).max(20),
      inflationRate: z.number().min(0).max(10),
    }))
    .mutation(({ input }) => {
      const years = input.retirementAge - input.currentAge;
      const monthlyRate = input.expectedReturn / 100 / 12;
      const inflationMonthly = input.inflationRate / 100 / 12;
      const projections = [];
      let balance = input.currentSavings;
      for (let year = 1; year <= years; year++) {
        for (let month = 0; month < 12; month++) {
          balance = (balance + input.monthlyContribution) * (1 + monthlyRate);
        }
        const realBalance = balance / Math.pow(1 + input.inflationRate / 100, year);
        projections.push({
          year,
          age: input.currentAge + year,
          nominalBalance: Math.round(balance),
          realBalance: Math.round(realBalance),
          totalContributed: Math.round(input.currentSavings + input.monthlyContribution * 12 * year),
        });
      }
      const monthlyIncome = Math.round(balance * 0.04 / 12); // 4% rule
      return { projections, estimatedMonthlyIncome: monthlyIncome, finalBalance: Math.round(balance) };
    }),
});

// ─── MARKET DATA ROUTER ──────────────────────────────────────────
const marketRouter = router({
  getQuote: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const data: any = await callDataApi("YahooFinance/get_stock_chart", {
          query: { symbol: input.symbol, region: "US", interval: "1d", range: "5d", includeAdjustedClose: true },
        });
        const result = data?.chart?.result?.[0];
        if (!result) return { symbol: input.symbol, price: null, change: null, changePercent: null, volume: null, marketCap: null, name: null };
        const meta = result.meta || {};
        return {
          symbol: meta.symbol || input.symbol,
          name: meta.longName || meta.shortName || input.symbol,
          price: meta.regularMarketPrice ?? null,
          change: meta.regularMarketPrice && meta.chartPreviousClose ? meta.regularMarketPrice - meta.chartPreviousClose : null,
          changePercent: meta.regularMarketPrice && meta.chartPreviousClose ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : null,
          volume: meta.regularMarketVolume ?? null,
          marketCap: meta.marketCap ?? null,
          dayHigh: meta.regularMarketDayHigh ?? null,
          dayLow: meta.regularMarketDayLow ?? null,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
        };
      } catch (e) {
        console.error("Market data error:", e);
        return { symbol: input.symbol, price: null, change: null, changePercent: null, volume: null, marketCap: null, name: null };
      }
    }),
  getQuotes: protectedProcedure
    .input(z.object({ symbols: z.array(z.string()) }))
    .query(async ({ input }) => {
      const results = await Promise.allSettled(
        input.symbols.map(async (symbol) => {
          try {
            const data: any = await callDataApi("YahooFinance/get_stock_chart", {
              query: { symbol, region: "US", interval: "1d", range: "5d", includeAdjustedClose: true },
            });
            const result = data?.chart?.result?.[0];
            const meta = result?.meta || {};
            return {
              symbol: meta.symbol || symbol,
              name: meta.longName || meta.shortName || symbol,
              price: meta.regularMarketPrice ?? null,
              change: meta.regularMarketPrice && meta.chartPreviousClose ? meta.regularMarketPrice - meta.chartPreviousClose : null,
              changePercent: meta.regularMarketPrice && meta.chartPreviousClose ? ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100 : null,
              volume: meta.regularMarketVolume ?? null,
              marketCap: meta.marketCap ?? null,
            };
          } catch { return { symbol, name: symbol, price: null, change: null, changePercent: null, volume: null, marketCap: null }; }
        })
      );
      return results.map(r => r.status === "fulfilled" ? r.value : { symbol: "?", name: "?", price: null, change: null, changePercent: null, volume: null, marketCap: null });
    }),
  getInsights: protectedProcedure
    .input(z.object({ symbol: z.string() }))
    .query(async ({ input }) => {
      try {
        const data: any = await callDataApi("YahooFinance/get_stock_insights", { query: { symbol: input.symbol } });
        return data?.finance?.result ?? null;
      } catch { return null; }
    }),
});

// ─── MAIN ROUTER ──────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  chat: chatRouter,
  conversations: conversationsRouter,
  documents: documentsRouter,
  products: productsRouter,
  suitability: suitabilityRouter,
  review: reviewRouter,
  memories: memoriesRouter,
  feedback: feedbackRouter,
  voice: voiceRouter,
  settings: settingsRouter,
  calculators: calculatorsRouter,
  market: marketRouter,
});

export type AppRouter = typeof appRouter;
