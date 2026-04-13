import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { contextualLLM, executeReActLoop } from "./shared/stewardlyWiring";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { nanoid } from "nanoid";
import { extractDocumentText } from "./services/documentExtractor";
import { generateSpeech, getVoiceCatalog } from "./edgeTTS";
import { callDataApi } from "./_core/dataApi";
import { SEARCH_TOOLS, executeSearchTool } from "./webSearch";
import { ALL_AI_TOOLS, executeAITool } from "./aiToolCalling";
import { logger } from "./_core/logger";
import {
  createConversation, getUserConversations, getConversation, deleteConversation,
  updateConversationTitle, searchConversations, getConversationContext,
  addMessage, getConversationMessages,
  addDocument, getUserDocuments, getAccessibleDocuments, updateDocumentVisibility,
  updateDocumentStatus, addDocumentChunks,
  searchDocumentChunks, deleteDocument, bulkDeleteDocuments, bulkUpdateDocumentVisibility,
  bulkUpdateDocumentCategory, renameDocument, reorderDocuments,
  addDocumentVersion, getDocumentVersions, getLatestVersionNumber, getDocumentProcessingStats,
  getAllProducts, getProductsByCategory,
  getVisibleProducts, getOrgProducts, createProduct, updateProduct, deleteProduct,
  addAuditEntry, getAuditTrail, addToReviewQueue, getPendingReviews, updateUserAvatar,
  updateReviewStatus, addMemory, getUserMemories, deleteMemory,
  addFeedback, getFeedbackStats, addQualityRating,
  saveSuitabilityAssessment, getUserSuitability,
  updateUserStyleProfile, updateUserSettings,
  toggleConversationPin, moveConversationToFolder,
  getUserFolders, createFolder, updateFolder, deleteFolder,
  reorderConversations, exportConversation,
  getUserTags, createTag, deleteTag, updateTag,
  addTagToDocument, removeTagFromDocument, getDocumentTags, getDocumentsForTag, bulkAddTagsToDocument,
  addGapFeedback, getUserGapFeedback, getGapFeedbackByGapId,
  getDocumentAnnotations, createAnnotation, resolveAnnotation, deleteAnnotation,
  logAiToolExecution, logAiResponseQuality,
} from "./db";
import { buildInsightContext, invalidateInsightCache } from "./insightCollectors";
import {
  buildSystemPrompt, FINANCIAL_DISCLAIMER, needsFinancialDisclaimer,
  detectPII, stripPII, calculateConfidence, getTopicDisclaimer, maskPIIForLLM,
  selectBestDisclaimer, deduplicateDisclaimers,
} from "./prompts";
import { extractMemoriesFromMessage, saveExtractedMemories, generateEpisodeSummary, saveEpisodeSummary, assembleMemoryContext } from "./memoryEngine";
import { assembleGraphContext } from "./knowledgeGraph";
import { assembleDeepContext, getStructuredIntegrationData, getPipelineRates } from "./services/deepContextAssembler";
import { classifyContent, applyModifications, logComplianceAudit, logPrivacyAudit } from "./complianceCopilot";
import { trackEvent, recalculateProficiency, assembleExponentialContext } from "./services/exponentialEngine";
import type { FocusMode, AdvisoryMode } from "@shared/types";
import { eq, and } from "drizzle-orm";
import { integrationConnections, integrationProviders } from "../drizzle/schema";
import { getDb } from "./db";
import { aiLayersRouter } from "./routers/aiLayers";
import { esignatureRouter, pdfRouter, creditBureauRouter, crmRouter } from "./routers/serviceRouters";
import { leadPipelineRouter } from "./routers/leadPipeline";
import { premiumFinanceRouter as pfRatesRouter } from "./routers/premiumFinanceRouter";
import { reportsBusinessRouter } from "./routers/reportsRouter";
import { contentRouter as contentCmsRouter } from "./routers/contentRouter";
import { leadCaptureRouter } from "./routers/leadCapture";
import { referralsRouter } from "./routers/referrals";
import { embedsRouter } from "./routers/embeds";
import { propensityRouter } from "./routers/propensity";
import { importRouter } from "./routers/importRouter";
import { planningRouter } from "./routers/planning";
import { communityRouter as communityForumRouter } from "./routers/community";
import AdmZip from "adm-zip";
import { exportsRouter } from "./routers/exports";
import { resolveAIConfig, buildLayerOverlayPrompt } from "./aiConfigResolver";
import { learningRouter } from "./routers/learning";
import { ghlWebhookRouter } from "./routers/ghlWebhook";
import { dripifyWebhookRouter } from "./routers/dripifyWebhook";
import { smsitWebhookRouter } from "./routers/smsitWebhook";
import { audioRouter } from "./routers/audio";
import { clientRouter } from "./routers/client";
import { comparablesRouter } from "./routers/comparables";
import { rebalancingRouter } from "./routers/rebalancing";
import { taxRouter } from "./routers/tax";
import { portfolioLedgerRouter } from "./routers/portfolioLedger";
import { estateRouter } from "./routers/estate";
import { reportsFiduciaryRouter } from "./routers/reportsFiduciary";
import { dynamicIntegrationsRouter } from "./routers/dynamicIntegrations";

// ─── CHAT ROUTER ──────────────────────────────────────────────────
const chatRouter = router({
  /**
   * Persist a streamed response — saves user + assistant messages without
   * regenerating the AI response. Used by the SSE streaming path so the
   * streamed content is saved to the database exactly as the user saw it.
   */
  persistStreamed: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      userContent: z.string().min(1).max(50000),
      assistantContent: z.string().min(1),
      mode: z.enum(["client", "coach", "manager"]).default("client"),
      focus: z.string().default("general,financial"),
    }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await getConversation(input.conversationId, ctx.user.id);
      if (!conversation) throw new TRPCError({ code: "NOT_FOUND", message: "Conversation not found" });

      // Save user message
      await addMessage({
        conversationId: input.conversationId,
        userId: ctx.user.id,
        role: "user",
        content: input.userContent,
      });

      // Parse focus for confidence calculation
      const focusModes = input.focus.split(",").filter(Boolean);
      const primaryFocus = (focusModes[0] || "general") as FocusMode;
      const isFinancial = needsFinancialDisclaimer(input.assistantContent, primaryFocus);

      // Calculate confidence
      const confidence = calculateConfidence({
        hasRAGContext: false,
        hasSuitability: ctx.user.suitabilityCompleted || false,
        focus: primaryFocus,
        isFinancialAdvice: isFinancial,
        responseLength: input.assistantContent.length,
      });

      let complianceStatus: "approved" | "pending" | "flagged" = "approved";
      if (isFinancial && confidence < 0.6) complianceStatus = "flagged";
      else if (isFinancial && confidence < 0.85) complianceStatus = "pending";

      // Save assistant message (the streamed content)
      const assistantMsg = await addMessage({
        conversationId: input.conversationId,
        userId: ctx.user.id,
        role: "assistant",
        content: input.assistantContent,
        confidenceScore: confidence,
        complianceStatus,
        metadata: { focus: input.focus, mode: input.mode, streamed: true },
      });

      // Extract + persist rich media embeds referenced in the response (non-blocking)
      (async () => {
        try {
          const { extractMediaFromResponse, storeMediaEmbeds } = await import("./services/richMediaService");
          const embeds = extractMediaFromResponse(input.assistantContent);
          if (embeds.length > 0) await storeMediaEmbeds(assistantMsg.id, embeds);
        } catch { /* rich media persistence is optional */ }
      })();

      // Track event (non-blocking)
      trackEvent({
        userId: ctx.user.id,
        eventType: "chat_message",
        featureKey: "chat",
        metadata: { focus: input.focus, mode: input.mode, streamed: true },
      }).catch(() => {});

      // Auto-generate title for new conversations (non-blocking)
      const history = await getConversationMessages(input.conversationId);
      if (history.length <= 2) {
        (async () => {
          try {
            const titleResp = await contextualLLM({
              userId: ctx.user.id,
              contextType: "chat",
              messages: [
                { role: "system", content: "Generate a short title (max 6 words) for this conversation. Return ONLY the title, nothing else." },
                { role: "user", content: input.userContent.substring(0, 500) },
              ],
            });
            const title = typeof titleResp.choices[0]?.message?.content === "string"
              ? titleResp.choices[0].message.content.replace(/["']/g, "").substring(0, 100)
              : "New Conversation";
            await updateConversationTitle(input.conversationId, ctx.user.id, title);
          } catch { /* title generation is optional */ }
        })();
      }

      // Memory extraction (non-blocking)
      (async () => {
        try {
          const extracted = await extractMemoriesFromMessage(ctx.user.id, input.userContent, input.assistantContent);
          if (extracted.length > 0) await saveExtractedMemories(ctx.user.id, extracted);
        } catch { /* memory extraction is optional */ }
      })();

      // Generate follow-up suggestions
      let followUpSuggestions: string[] = [];
      try {
        const sugResp = await contextualLLM({
          userId: ctx.user.id,
          contextType: "chat",
          messages: [
            { role: "system", content: "Based on this conversation, generate exactly 3 short follow-up questions the user might want to ask next. Each should be 5-12 words. Return ONLY a JSON object with a \"suggestions\" key containing an array of 3 strings." },
            { role: "user", content: input.userContent.substring(0, 300) },
            { role: "assistant", content: input.assistantContent.substring(0, 500) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "follow_up_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 follow-up question suggestions",
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = sugResp.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}");
        if (Array.isArray(parsed.suggestions)) {
          followUpSuggestions = parsed.suggestions.slice(0, 3);
        }
      } catch { /* follow-up suggestions are optional */ }

      return {
        id: assistantMsg.id,
        content: input.assistantContent,
        confidenceScore: confidence,
        complianceStatus,
        followUpSuggestions,
      };
    }),

  send: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1).max(50000),
      mode: z.enum(["client", "coach", "manager"]).default("client"),
      focus: z.string().default("general,financial"),
      model: z.string().optional(),
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

      // ── UNIFIED DEEP CONTEXT ASSEMBLY ──────────────────────────────
      // Assembles ALL data sources in parallel: document chunks (enhanced TF-IDF),
      // knowledge base articles, user profile, suitability, memories, knowledge graph,
      // pipeline data, conversation history, integrations, calculators, insights,
      // client relationships, activity log, tags, and gap feedback.
      let deepContext: Awaited<ReturnType<typeof assembleDeepContext>> | null = null;
      try {
        deepContext = await assembleDeepContext({
          userId: ctx.user.id,
          query: input.content,
          contextType: "chat",
          conversationId: input.conversationId,
        });
      } catch (e) { /* deep context is optional, degrade gracefully */ }

      const ragContext = deepContext?.documentContext || "";
      const memoriesStr = [deepContext?.memoryContext, deepContext?.graphContext].filter(Boolean).join("\n\n");
      const insightContext = deepContext?.insightContext || "";

      // ── EXPONENTIAL ENGINE CONTEXT ────────────────────────────────
      let exponentialPrompt = "";
      try {
        const expCtx = await assembleExponentialContext(
          ctx.user.id,
          ctx.user.role || "user"
        );
        exponentialPrompt = expCtx.promptFragment;
      } catch (e) { /* exponential context is optional */ }

      // Track this chat interaction as a platform event (non-blocking)
      trackEvent({
        userId: ctx.user.id,
        eventType: "chat_message",
        featureKey: "chat",
        metadata: { focus: input.focus, mode: input.mode },
      }).catch(() => {});

      // Parse multi-select focus modes
      const focusModes = input.focus.split(",").filter(Boolean);
      const hasFinancial = focusModes.includes("financial");
      const hasGeneral = focusModes.includes("general");
      const hasStudy = focusModes.includes("study");
      // Primary focus for single-mode functions: first selected mode
      const primaryFocus = (focusModes[0] || "general") as FocusMode;

      // Get product context for financial mode
      let productContext = "";
      if (hasFinancial) {
        try {
          const products = await getAllProducts();
          if (products.length > 0) {
            productContext = products.slice(0, 20).map(p =>
              `${p.company} — ${p.name} (${p.category}): ${p.description || "No description"}`
            ).join("\n");
          }
        } catch (e) { /* products are optional */ }
      }

      // ── 5-LAYER AI CONFIG RESOLUTION ──────────────────────────────────
      // Resolve cascading config: Platform → Org → Manager → Professional → User
      let resolvedConfig;
      try {
        resolvedConfig = await resolveAIConfig({
          userId: ctx.user.id,
          organizationId: ctx.user.affiliateOrgId ?? undefined,
        });
      } catch (e) {
        resolvedConfig = null;
      }

      // Build the layer overlay prompt (injected alongside existing system prompt)
      const layerOverlay = resolvedConfig ? buildLayerOverlayPrompt(resolvedConfig) : "";

      // Integration context from deep assembler
      const integrationContext = deepContext?.integrationContext || "";

      // Build system prompt (existing logic + new context params)
      const systemPrompt = buildSystemPrompt({
        userName: ctx.user.name || "User",
        mode: input.mode as AdvisoryMode,
        focus: primaryFocus,
        focusModes,
        userRole: ctx.user.role || "user",
        styleProfile: ctx.user.styleProfile,
        ragContext: ragContext || undefined,
        memories: memoriesStr || undefined,
        suitabilityCompleted: ctx.user.suitabilityCompleted || false,
        productContext: productContext || undefined,
        integrationContext: integrationContext || undefined,
        insightContext: insightContext || undefined,
      });

      // Combine: system prompt + layer overlays + exponential engine + deep context
      let fullSystemPrompt = layerOverlay
        ? `${systemPrompt}\n\n${layerOverlay}`
        : systemPrompt;

      // Inject exponential engine context (user proficiency & platform awareness)
      if (exponentialPrompt) {
        fullSystemPrompt += `\n\n${exponentialPrompt}`;
      }

      // ── INTEGRATION HEALTH AWARENESS ──────────────────────────────
      try {
        const { assembleIntegrationHealthContext } = await import("./services/integrationHealth");
        const healthCtx = await assembleIntegrationHealthContext();
        if (healthCtx.promptFragment) {
          fullSystemPrompt += `\n\n${healthCtx.promptFragment}`;
        }
      } catch { /* integration health context is optional */ }

      // ── UNIFIED DEEP CONTEXT INJECTION ─────────────────────────────
      // Injects ALL data sources: documents, KB, pipeline data, integrations,
      // calculators, insights, client data, activity log, tags, gap feedback,
      // conversation history — with citation instructions.
      if (deepContext?.fullContextPrompt) {
        fullSystemPrompt += `\n\n${deepContext.fullContextPrompt}`;
      }

      // Use resolved temperature/maxTokens if available
      // Creativity slider overrides temperature when set
      const llmTemperature = resolvedConfig?.creativity ?? resolvedConfig?.temperature ?? 0.7;
      const llmMaxTokens = resolvedConfig?.maxTokens ?? 4096;

      // Context depth controls how much history to include
      const contextDepth = resolvedConfig?.contextDepth ?? "moderate";
      const historySliceSize = contextDepth === "recent" ? 8 : contextDepth === "full" ? 50 : 20;

      // Build messages for LLM
      const llmMessages = [
        { role: "system" as const, content: fullSystemPrompt },
        ...history.slice(-historySliceSize).map(m => ({
          role: m.role as "user" | "assistant" | "system",
          content: m.content,
        })),
      ];

      // ── AUTO-POPULATE TOOL ARGS (Fix 3) ──────────────────────────
      // Fetch structured integration data and pipeline rates for auto-populating tool arguments
      let userFinancialSnapshot: Awaited<ReturnType<typeof getStructuredIntegrationData>> | null = null;
      let pipelineRates: Record<string, number> = {};
      try {
        const [snapshot, rates] = await Promise.all([
          getStructuredIntegrationData(ctx.user.id),
          getPipelineRates(),
        ]);
        userFinancialSnapshot = snapshot;
        pipelineRates = rates;
      } catch { /* auto-populate data is optional */ }

      // Inject auto-populate context into system prompt
      if (userFinancialSnapshot && (userFinancialSnapshot.holdings.length > 0 || userFinancialSnapshot.accounts.length > 0)) {
        const autoPopCtx = `\n\n<auto_populate_data>\nWhen calling financial tools, auto-populate these defaults from the user's connected accounts:\n- Total invested assets: $${userFinancialSnapshot.totalInvestedAssets.toLocaleString()}\n- Total liquid assets: $${userFinancialSnapshot.totalLiquidAssets.toLocaleString()}\n- Holdings: ${userFinancialSnapshot.holdings.slice(0, 10).map(h => `${h.symbol}: $${h.value.toLocaleString()}`).join(", ")}\n- Accounts: ${userFinancialSnapshot.accounts.map(a => `${a.name} (${a.type}): $${a.balance.toLocaleString()}`).join(", ")}\n${userFinancialSnapshot.lastSyncTimestamp ? `- Data as of: ${userFinancialSnapshot.lastSyncTimestamp}` : ""}\n</auto_populate_data>`;
        fullSystemPrompt += autoPopCtx;
      }
      if (Object.keys(pipelineRates).length > 0) {
        const rateCtx = `\n\n<current_rates>\nCurrent market rates for calculations (prefer these over training data):\n${Object.entries(pipelineRates).slice(0, 10).map(([k, v]) => `- ${k}: ${v}%`).join("\n")}\n</current_rates>`;
        fullSystemPrompt += rateCtx;
      }

      // Invoke LLM with search + calculator/model tools
      const contentLower = input.content.toLowerCase();
      // Always enable search tools — the LLM decides when to use them based on the query.
      // Previously this was gated by a narrow regex that missed many valid search queries
      // (e.g., "credit union", "savings account", "home buyer", "Ramsey", "alternatives").
      const useSearchTools = true;
      const useCalcTools = contentLower.match(/\b(calculat|project|estimat|iul|premium finance|retirement|debt|tax|estate|student loan|portfolio|insurance|suitab|behavioral)\b/);
      const activeTools = [
        ...(useSearchTools ? SEARCH_TOOLS : []),
        ...(useCalcTools ? ALL_AI_TOOLS : []),
      ];
      // ── ReAct Multi-Turn Tool Calling Loop ─────────────────────
      // Uses the shared ReAct loop for structured reasoning + tool execution.
      // Replaces the inline compound tool call loop with trace logging,
      // escape hatch for duplicate responses, and empty response guard.
      const reactResult = await executeReActLoop({
        messages: llmMessages,
        userId: ctx.user.id,
        sessionId: input.conversationId,
        tools: activeTools.length > 0 ? activeTools : undefined,
        maxIterations: 5,
        model: input.model || (resolvedConfig?.modelPreferences?.primary && resolvedConfig.modelPreferences.primary !== "default" ? resolvedConfig.modelPreferences.primary : undefined),
        contextualLLM,
        executeTool: async (toolName: string, args: any) => {
          return toolName.startsWith("calc_") || toolName.startsWith("model_")
            ? await executeAITool(toolName, args)
            : await executeSearchTool(toolName, args);
        },
        db: await getDb(),
      });

      let aiContent = reactResult.response;

      // ── URL HALLUCINATION GUARD ─────────────────────────────────
      // Strip fabricated URLs from AI responses before they reach the user.
      // Uses the trusted domain allowlist (IRS, SEC, FINRA, YouTube, etc.)
      try {
        const { stripHallucinatedURLs } = await import("./shared/guardrails/urlHallucination");
        const sourceContext = fullSystemPrompt.slice(0, 2000);
        const { cleaned, strippedCount } = stripHallucinatedURLs(aiContent, sourceContext);
        if (strippedCount > 0) {
          logger.warn({ strippedCount, userId: ctx.user.id }, "Stripped hallucinated URLs from AI response");
          aiContent = cleaned;
        }
      } catch { /* guardrail failure is non-fatal */ }

      let response = { model: reactResult.model, choices: [{ message: { content: aiContent } }] } as any;

      // ── EMPTY RESPONSE GUARD ────────────────────────────────────
      if (!aiContent || aiContent.trim().length === 0) {
        aiContent = "I apologize, but I wasn't able to generate a complete response. Could you please rephrase your question or try again?";
      }

      // ── DISCLAIMER DEDUPLICATION (Fix 5) ────────────────────────
      // Use smart disclaimer selection instead of stacking multiple disclaimers
      const isFinancial = needsFinancialDisclaimer(aiContent, primaryFocus);
      const bestDisclaimer = selectBestDisclaimer(aiContent, primaryFocus);
      if (bestDisclaimer) {
        aiContent = deduplicateDisclaimers(aiContent, bestDisclaimer);
      }

      // Calculate confidence
      const confidence = calculateConfidence({
        hasRAGContext: ragContext.length > 0,
        hasSuitability: ctx.user.suitabilityCompleted || false,
        focus: primaryFocus,
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
        modelVersion: response.model || undefined,
        metadata: { model: response.model, focus: input.focus, mode: input.mode, hasRAG: ragContext.length > 0 },
      });

      // Extract + persist rich media embeds referenced in the response (non-blocking)
      (async () => {
        try {
          const { extractMediaFromResponse, storeMediaEmbeds } = await import("./services/richMediaService");
          const embeds = extractMediaFromResponse(aiContent);
          if (embeds.length > 0) await storeMediaEmbeds(assistantMsg.id, embeds);
        } catch { /* rich media persistence is optional */ }
      })();

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

      // ── RESPONSE QUALITY LOGGING (Improvement F) ──────────────
      // Log tool execution and response quality metrics
      const disclaimerCount = bestDisclaimer ? 1 : 0;
      const wasEmpty = !aiContent || aiContent.trim().length === 0 || aiContent.includes("I apologize, but I wasn't able to generate");
      logAiResponseQuality({
        userId: ctx.user.id,
        conversationId: input.conversationId,
        messageId: assistantMsg.id,
        responseEmpty: wasEmpty,
        disclaimerCount,
        toolCallsAttempted: reactResult.toolCallCount,
        toolCallsCompleted: reactResult.toolCallCount, // ReAct loop handles errors internally
        retryCount: wasEmpty ? 1 : 0,
      }).catch(() => {}); // non-blocking

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
          const titleResp = await contextualLLM({
            userId: ctx.user.id,
            contextType: "chat",
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

      // ── MEMORY AUTO-EXTRACTION (async, non-blocking) ──────────
      (async () => {
        try {
          const extracted = await extractMemoriesFromMessage(ctx.user.id, input.content, aiContent);
          if (extracted.length > 0) await saveExtractedMemories(ctx.user.id, extracted);
        } catch { /* memory extraction is optional */ }
        // Episode summary every 10 messages
        if (history.length > 0 && history.length % 10 === 0) {
          try {
            const episode = await generateEpisodeSummary(history);
            if (episode) await saveEpisodeSummary(ctx.user.id, input.conversationId, episode);
          } catch { /* episode summary is optional */ }
        }
      })();

      // ── COMPLIANCE COPILOT (async, non-blocking) ───────────────
      (async () => {
        try {
          const classification = await classifyContent(aiContent, {
            hasSuitability: ctx.user.suitabilityCompleted || false,
            focus: input.focus,
          });
          await logComplianceAudit({
            messageId: assistantMsg.id,
            userId: ctx.user.id,
            conversationId: input.conversationId,
            result: classification,
            modelVersion: response.model,
          });
          await logPrivacyAudit({
            userId: ctx.user.id,
            apiCallPurpose: "chat_response",
            dataCategories: [input.focus],
            piiMasked: piiCheck.hasPII,
            modelUsed: response.model,
          });
        } catch { /* compliance logging is optional */ }
      })();

      // Generate follow-up suggestions (non-blocking, best-effort)
      let followUpSuggestions: string[] = [];
      try {
        const sugResp = await contextualLLM({
          userId: ctx.user.id,
          contextType: "chat",
          messages: [
            { role: "system", content: "Based on this conversation, generate exactly 3 short follow-up questions the user might want to ask next. Each should be 5-12 words. Return ONLY a JSON object with a \"suggestions\" key containing an array of 3 strings." },
            { role: "user", content: (typeof input.content === 'string' ? input.content : '').substring(0, 300) },
            { role: "assistant", content: aiContent.substring(0, 500) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "follow_up_suggestions",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    description: "3 follow-up question suggestions",
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        });
        const rawContent = sugResp.choices[0]?.message?.content;
        const parsed = JSON.parse(typeof rawContent === "string" ? rawContent : "{}");
        if (Array.isArray(parsed.suggestions)) {
          followUpSuggestions = parsed.suggestions.slice(0, 3);
        }
      } catch { /* follow-up suggestions are optional */ }

      return {
        id: assistantMsg.id,
        content: aiContent,
        confidenceScore: confidence,
        complianceStatus,
        model: response.model,
        followUpSuggestions,
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
    .query(async ({ input }) => {
      const msgs = await getConversationMessages(input.conversationId);
      // Hydrate rich media embeds for assistant messages (non-blocking per-message failures)
      try {
        const { getMediaEmbeds } = await import("./services/richMediaService");
        const assistantIds = msgs.filter(m => m.role === "assistant").map(m => m.id);
        const embedsById: Record<number, any[]> = {};
        await Promise.all(
          assistantIds.map(async (id) => {
            try {
              const embeds = await getMediaEmbeds(id);
              if (embeds.length > 0) embedsById[id] = embeds;
            } catch { /* per-message optional */ }
          })
        );
        return msgs.map(m => {
          if (m.role === "assistant" && embedsById[m.id]) {
            return { ...m, metadata: { ...((m.metadata as any) || {}), mediaEmbeds: embedsById[m.id] } };
          }
          return m;
        });
      } catch {
        return msgs;
      }
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteConversation(input.id, ctx.user.id)),
  updateTitle: protectedProcedure
    .input(z.object({ id: z.number(), title: z.string().min(1).max(255) }))
    .mutation(({ ctx, input }) => updateConversationTitle(input.id, ctx.user.id, input.title)),
  search: protectedProcedure
    .input(z.object({ query: z.string().min(1).max(500), limit: z.number().min(1).max(50).default(20) }))
    .query(({ ctx, input }) => searchConversations(ctx.user.id, input.query, input.limit)),
  getContext: protectedProcedure
    .input(z.object({ conversationIds: z.array(z.number()).max(5), maxMessages: z.number().min(1).max(10).default(5) }))
    .query(({ ctx, input }) => getConversationContext(ctx.user.id, input.conversationIds, input.maxMessages)),
  regenerateTitle: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const conv = await getConversation(input.id, ctx.user.id);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND" });
      const msgs = await getConversationMessages(input.id);
      const userMsgs = msgs.filter(m => m.role === "user").slice(0, 3);
      if (userMsgs.length === 0) return { title: conv.title };
      const titleResp = await contextualLLM({
        userId: ctx.user.id,
        contextType: "chat",
        messages: [
          { role: "system", content: "Generate a concise, descriptive title (max 8 words) for this conversation based on the user's messages. Return ONLY the title text, nothing else. Do not use quotes." },
          ...userMsgs.map(m => ({ role: "user" as const, content: m.content.substring(0, 300) })),
        ],
      });
      const title = typeof titleResp.choices[0]?.message?.content === "string"
        ? titleResp.choices[0].message.content.replace(/["']/g, "").substring(0, 100).trim()
        : conv.title || "New Conversation";
      await updateConversationTitle(input.id, ctx.user.id, title);
      return { title };
    }),
  // Pin / Unpin
  togglePin: protectedProcedure
    .input(z.object({ id: z.number(), pinned: z.boolean() }))
    .mutation(({ ctx, input }) => toggleConversationPin(input.id, ctx.user.id, input.pinned)),
  // Move to folder
  moveToFolder: protectedProcedure
    .input(z.object({ id: z.number(), folderId: z.number().nullable() }))
    .mutation(({ ctx, input }) => moveConversationToFolder(input.id, ctx.user.id, input.folderId)),
  // Folder CRUD
  folders: protectedProcedure.query(({ ctx }) => getUserFolders(ctx.user.id)),
  createFolder: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(128), color: z.string().max(32).optional() }))
    .mutation(({ ctx, input }) => createFolder(ctx.user.id, input.name, input.color)),
  updateFolder: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1).max(128).optional(), color: z.string().max(32).optional(), sortOrder: z.number().optional() }))
    .mutation(({ ctx, input }) => updateFolder(input.id, ctx.user.id, { name: input.name, color: input.color, sortOrder: input.sortOrder })),
  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteFolder(input.id, ctx.user.id)),

  // Reorder conversations (drag-and-drop)
  reorder: protectedProcedure
    .input(z.object({ updates: z.array(z.object({ id: z.number(), sortOrder: z.number() })) }))
    .mutation(({ ctx, input }) => reorderConversations(ctx.user.id, input.updates)),

  // Export conversation as Markdown
  export: protectedProcedure
    .input(z.object({ id: z.number(), format: z.enum(["markdown", "json"]).default("markdown") }))
    .query(async ({ ctx, input }) => {
      const data = await exportConversation(input.id, ctx.user.id);
      if (!data) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.format === "json") return { content: JSON.stringify(data, null, 2), filename: `${data.conversation.title || "conversation"}.json` };
      // Markdown format
      const title = data.conversation.title || "Conversation";
      const date = data.conversation.createdAt ? new Date(data.conversation.createdAt).toLocaleDateString() : "";
      let md = `# ${title}\n\n_Exported from Stewardly on ${date}_\n\n---\n\n`;
      for (const msg of data.messages) {
        const role = msg.role === "user" ? "**You**" : msg.role === "assistant" ? "**Stewardly AI**" : "_System_";
        const ts = msg.createdAt ? new Date(msg.createdAt).toLocaleString() : "";
        md += `### ${role} ${ts ? `— ${ts}` : ""}\n\n${msg.content}\n\n---\n\n`;
      }
      md += `\n_This conversation contained ${data.messages.length} messages._\n`;
      return { content: md, filename: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.md` };
    }),
});

// ─── DOCUMENTS ROUTER ─────────────────────────────────────────────
const documentsRouter = router({
  list: protectedProcedure.query(({ ctx }) => getUserDocuments(ctx.user.id)),
  listAccessible: protectedProcedure.query(async ({ ctx }) => {
    // Admins see all documents; others see only their own
    if (ctx.user.role === "admin") {
      return getAccessibleDocuments(["private", "professional", "management", "admin"]);
    }
    // If user has an org, check org role for expanded visibility
    const orgId = ctx.user.affiliateOrgId;
    if (orgId) {
      const { getUserOrgRole, hasMinimumOrgRole } = await import("./services/orgRoleHelper");
      const orgRole = await getUserOrgRole(ctx.user.id, orgId);
      if (hasMinimumOrgRole(orgRole, "manager")) {
        return getAccessibleDocuments(["private", "professional", "management"]);
      }
      if (hasMinimumOrgRole(orgRole, "professional")) {
        return getAccessibleDocuments(["private", "professional"]);
      }
    }
    return getUserDocuments(ctx.user.id);
  }),
  updateVisibility: protectedProcedure
    .input(z.object({ id: z.number(), visibility: z.enum(["private", "professional", "management", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      await updateDocumentVisibility(input.id, ctx.user.id, input.visibility);
      return { success: true };
    }),
  upload: protectedProcedure
    .input(z.object({
      filename: z.string(),
      content: z.string(), // base64 encoded
      mimeType: z.string().optional(),
      category: z.enum(["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]).optional(),
      visibility: z.enum(["private", "professional", "management", "admin"]).default("professional"),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      // Enforce 31MB raw file limit (base64 is ~33% larger)
      if (buffer.length > 31 * 1024 * 1024) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds 31MB limit" });
      }
      const fileKey = `docs/${ctx.user.id}/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/octet-stream");

      // Extract text FIRST so we can use it for both categorization and chunking
      let extraction: Awaited<ReturnType<typeof extractDocumentText>> | null = null;
      try {
        extraction = await extractDocumentText(buffer, input.filename, input.mimeType);
      } catch (e) {
        logger.error( { operation: "documentUpload", err: e },"[DocumentUpload] Pre-extraction failed:", e);
      }

      // AI auto-categorization: use extracted text (not raw buffer) for binary files
      let resolvedCategory = input.category || "personal_docs";
      if (!input.category) {
        try {
          const preview = extraction?.text
            ? extraction.text.substring(0, 2000)
            : buffer.toString("utf-8").substring(0, 2000);
          const catResult = await contextualLLM({
            userId: ctx.user.id,
            contextType: "analysis",
            messages: [
              { role: "system", content: `You classify documents into exactly one of these categories. Respond with ONLY the category key, nothing else.\nCategories:\n- personal_docs: Personal documents (tax returns, IDs, wills, trusts, bank statements, pay stubs, personal letters)\n- financial_products: Financial product guides, brochures, prospectuses, fund fact sheets, insurance illustrations\n- regulations: Regulatory documents, compliance guides, SEC filings, DOL rules, state regulations\n- training_materials: Training courses, certifications, CE credits, study guides, exam prep\n- artifacts: Reports, analyses, spreadsheets, presentations, meeting notes, proposals\n- skills: Domain knowledge files, playbooks, scripts, templates, checklists` },
              { role: "user", content: `Filename: ${input.filename}\nMIME type: ${input.mimeType || "unknown"}\nContent preview:\n${preview}` },
            ],
          });
          const rawContent = catResult?.choices?.[0]?.message?.content;
          const raw = (typeof rawContent === "string" ? rawContent : "").trim().toLowerCase();
          const validCats = ["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"];
          if (validCats.includes(raw)) resolvedCategory = raw as any;
        } catch {
          // fallback to personal_docs on LLM failure
        }
      }

      const doc = await addDocument({
        userId: ctx.user.id,
        filename: input.filename,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        category: resolvedCategory as any,
        visibility: input.visibility,
      });

      // Process document for RAG (extract text and chunk)
      try {
        await updateDocumentStatus(doc.id, "processing");
        // Reuse pre-extracted text, or extract now if pre-extraction failed
        if (!extraction) {
          extraction = await extractDocumentText(buffer, input.filename, input.mimeType);
        }
        const text = extraction.text;
        if (!text || text.length < 10 || extraction.method === "unsupported") {
          // File type not supported for text extraction — store metadata only
          await updateDocumentStatus(doc.id, "ready", `[${input.filename}: ${input.mimeType || "unknown"} — binary file, no text extracted]`, 0);
        } else {
          // Chunk the extracted text
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
            category: resolvedCategory as any,
          })));
          await updateDocumentStatus(doc.id, "ready", text.substring(0, 5000), chunks.length);
        }
      } catch (e) {
        logger.error( { operation: "documentUpload", err: e },"[DocumentUpload] Text extraction failed:", e);
        await updateDocumentStatus(doc.id, "error");
      }

      return { id: doc.id, url, category: resolvedCategory, wasAutoClassified: !input.category, suggestedCategory: resolvedCategory };
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteDocument(input.id, ctx.user.id)),
  // ─── Rename ────────────────────────────────────────────────────
  rename: protectedProcedure
    .input(z.object({ id: z.number(), filename: z.string().min(1).max(512) }))
    .mutation(async ({ ctx, input }) => {
      await renameDocument(input.id, ctx.user.id, input.filename);
      return { success: true };
    }),
  // ─── Update Category ───────────────────────────────────────────
  updateCategory: protectedProcedure
    .input(z.object({ id: z.number(), category: z.enum(["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]) }))
    .mutation(async ({ ctx, input }) => {
      await bulkUpdateDocumentCategory([input.id], ctx.user.id, input.category);
      return { success: true };
    }),
  // ─── Bulk Operations ───────────────────────────────────────────
  bulkDelete: protectedProcedure
    .input(z.object({ ids: z.array(z.number()).min(1).max(500) }))
    .mutation(async ({ ctx, input }) => bulkDeleteDocuments(input.ids, ctx.user.id)),
  bulkUpdateVisibility: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1).max(500),
      visibility: z.enum(["private", "professional", "management", "admin"]),
    }))
    .mutation(async ({ ctx, input }) => bulkUpdateDocumentVisibility(input.ids, ctx.user.id, input.visibility)),
  bulkUpdateCategory: protectedProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1).max(500),
      category: z.enum(["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]),
    }))
    .mutation(async ({ ctx, input }) => bulkUpdateDocumentCategory(input.ids, ctx.user.id, input.category)),
  reorder: protectedProcedure
    .input(z.object({
      updates: z.array(z.object({ id: z.number(), sortOrder: z.number() })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => reorderDocuments(ctx.user.id, input.updates)),

  // ─── Processing Stats ─────────────────────────────────────────
  processingStats: protectedProcedure
    .query(({ ctx }) => getDocumentProcessingStats(ctx.user.id)),

  // ─── Version History ──────────────────────────────────────────
  versions: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(({ ctx, input }) => getDocumentVersions(input.documentId, ctx.user.id)),

  uploadNewVersion: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      filename: z.string(),
      content: z.string(), // base64
      mimeType: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      if (buffer.length > 31 * 1024 * 1024) {
        throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "File exceeds 31MB limit" });
      }
      // Get current document to snapshot as a version
      const userDocs = await getUserDocuments(ctx.user.id);
      const currentDoc = userDocs.find((d: any) => d.id === input.documentId);
      if (!currentDoc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      const nextVersion = (await getLatestVersionNumber(input.documentId)) + 1;

      // Save current state as a version before overwriting
      await addDocumentVersion({
        documentId: input.documentId,
        userId: ctx.user.id,
        versionNumber: nextVersion - 1 || 1,
        filename: currentDoc.filename,
        fileUrl: currentDoc.fileUrl,
        fileKey: currentDoc.fileKey || "",
        mimeType: currentDoc.mimeType || undefined,
        extractedText: currentDoc.extractedText || undefined,
        chunkCount: currentDoc.chunkCount || 0,
        sizeBytes: undefined,
      });

      // Upload new file to S3
      const fileKey = `docs/${ctx.user.id}/${nanoid()}-${input.filename}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType || "application/octet-stream");

      // Update the main document record
      const db = await getDb();
      if (db) {
        const { documents: docsTable } = await import("../drizzle/schema");
        await db.update(docsTable).set({
          filename: input.filename,
          fileUrl: url,
          fileKey,
          mimeType: input.mimeType || null,
          status: "processing" as const,
        }).where(eq(docsTable.id, input.documentId));
      }

      // Re-process for RAG
      try {
        const extraction = await extractDocumentText(buffer, input.filename, input.mimeType);
        const text = extraction.text;
        if (!text || text.length < 10 || extraction.method === "unsupported") {
          await updateDocumentStatus(input.documentId, "ready", `[${input.filename}: ${input.mimeType || "unknown"} \u2014 binary file]`, 0);
        } else {
          // Delete old chunks and re-chunk
          if (db) {
            const { documentChunks: chunksTable } = await import("../drizzle/schema");
            await db.delete(chunksTable).where(eq(chunksTable.documentId, input.documentId));
          }
          const chunkSize = 1000;
          const overlap = 200;
          const chunks: string[] = [];
          for (let i = 0; i < text.length; i += chunkSize - overlap) {
            chunks.push(text.substring(i, i + chunkSize));
          }
          await addDocumentChunks(chunks.map((content, index) => ({
            documentId: input.documentId,
            userId: ctx.user.id,
            content,
            chunkIndex: index,
            category: currentDoc.category as any,
          })));
          await updateDocumentStatus(input.documentId, "ready", text.substring(0, 5000), chunks.length);
        }
      } catch (e) {
        logger.error( { operation: "versionUpload", err: e },"[VersionUpload] Text extraction failed:", e);
        await updateDocumentStatus(input.documentId, "error");
      }

      return { success: true, version: nextVersion, url };
    }),

  // ─── Re-process failed document ──────────────────────────────
  reprocess: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userDocs = await getUserDocuments(ctx.user.id);
      const doc = userDocs.find((d: any) => d.id === input.id);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      if (doc.status !== "error") throw new TRPCError({ code: "BAD_REQUEST", message: "Only failed documents can be reprocessed" });

      await updateDocumentStatus(input.id, "processing");
      try {
        // Re-fetch file from S3 and re-process
        const response = await fetch(doc.fileUrl);
        if (!response.ok) throw new Error("Failed to fetch file from storage");
        const buffer = Buffer.from(await response.arrayBuffer());
        const extraction = await extractDocumentText(buffer, doc.filename, doc.mimeType || undefined);
        const text = extraction.text;
        if (!text || text.length < 10 || extraction.method === "unsupported") {
          await updateDocumentStatus(input.id, "ready", `[${doc.filename}: binary file]`, 0);
        } else {
          const db = await getDb();
          if (db) {
            const { documentChunks: chunksTable } = await import("../drizzle/schema");
            await db.delete(chunksTable).where(eq(chunksTable.documentId, input.id));
          }
          const chunkSize = 1000;
          const overlap = 200;
          const chunks: string[] = [];
          for (let i = 0; i < text.length; i += chunkSize - overlap) {
            chunks.push(text.substring(i, i + chunkSize));
          }
          await addDocumentChunks(chunks.map((content, index) => ({
            documentId: input.id,
            userId: ctx.user.id,
            content,
            chunkIndex: index,
            category: doc.category as any,
          })));
          await updateDocumentStatus(input.id, "ready", text.substring(0, 5000), chunks.length);
        }
        return { success: true };
      } catch (e) {
        logger.error( { operation: "reprocess", err: e },"[Reprocess] Failed:", e);
        await updateDocumentStatus(input.id, "error");
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Reprocessing failed" });
      }
    }),

  // ─── DOCUMENT TAGS ────────────────────────────────────────────────────
  listTags: protectedProcedure
    .query(({ ctx }) => getUserTags(ctx.user.id)),
  createTag: protectedProcedure
    .input(z.object({ name: z.string().min(1).max(128), color: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await createTag(ctx.user.id, input.name, input.color);
      return result;
    }),
  deleteTagById: protectedProcedure
    .input(z.object({ tagId: z.number() }))
    .mutation(({ ctx, input }) => deleteTag(input.tagId, ctx.user.id)),
  updateTagById: protectedProcedure
    .input(z.object({ tagId: z.number(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(({ ctx, input }) => updateTag(input.tagId, ctx.user.id, { name: input.name, color: input.color })),
  addTagToDoc: protectedProcedure
    .input(z.object({ documentId: z.number(), tagId: z.number() }))
    .mutation(({ input }) => addTagToDocument(input.documentId, input.tagId)),
  removeTagFromDoc: protectedProcedure
    .input(z.object({ documentId: z.number(), tagId: z.number() }))
    .mutation(({ input }) => removeTagFromDocument(input.documentId, input.tagId)),
  getDocTags: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(({ input }) => getDocumentTags(input.documentId)),
  docsForTag: protectedProcedure
    .input(z.object({ tagId: z.number() }))
    .query(({ input }) => getDocumentsForTag(input.tagId)),
  autoTag: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const userDocs = await getUserDocuments(ctx.user.id);
      const doc = userDocs.find((d: any) => d.id === input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      const existingTags = await getUserTags(ctx.user.id);
      const existingTagNames = existingTags.map(t => t.name);
      const response = await contextualLLM({
        userId: ctx.user.id,
        contextType: "analysis",
        messages: [
          { role: "system", content: `You are a document tagging assistant for a financial services knowledge base. Analyze the document and suggest 2-5 concise tags. Return JSON: { "tags": [{ "name": "tag name", "isNew": true/false }] }. Existing tags the user already has: [${existingTagNames.join(", ")}]. Prefer existing tags when relevant. Tags should be specific and useful for filtering (e.g., "retirement planning", "IUL illustration", "client onboarding", "compliance", "tax strategy").` },
          { role: "user", content: `Document: "${doc.filename}" (category: ${doc.category})\nContent preview: ${(doc.extractedText || "").substring(0, 2000)}` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "tags", strict: true, schema: { type: "object", properties: { tags: { type: "array", items: { type: "object", properties: { name: { type: "string" }, isNew: { type: "boolean" } }, required: ["name", "isNew"], additionalProperties: false } } }, required: ["tags"], additionalProperties: false } } },
      });
      const parsed = JSON.parse((response.choices[0].message.content as string) || "{}");
      const suggestedTags = parsed.tags || [];
      const appliedTagIds: number[] = [];
      for (const tag of suggestedTags) {
        const existing = existingTags.find(t => t.name.toLowerCase() === tag.name.toLowerCase());
        if (existing) {
          await addTagToDocument(input.documentId, existing.id);
          appliedTagIds.push(existing.id);
        } else {
          const created = await createTag(ctx.user.id, tag.name, undefined, true);
          if (created) {
            await addTagToDocument(input.documentId, created.id);
            appliedTagIds.push(created.id);
          }
        }
      }
      return { suggestedTags, appliedTagIds };
    }),

  // ─── KNOWLEDGE GAP ANALYSIS ─────────────────────────────────────────
  analyzeGaps: protectedProcedure
    .mutation(async ({ ctx }) => {
      const docs = await getUserDocuments(ctx.user.id);
      const feedback = await getUserGapFeedback(ctx.user.id);
      const dismissedGapIds = feedback.filter(f => f.action === "dismiss" || f.action === "not_applicable").map(f => f.gapId);
      const resolvedGapIds = feedback.filter(f => f.action === "resolved").map(f => f.gapId);
      const acknowledgedFeedback = feedback.filter(f => f.action === "acknowledge");
      const docSummary = docs.map(d => `- ${d.filename} (category: ${d.category}, status: ${d.status})`).join("\n");
      const feedbackContext = acknowledgedFeedback.length > 0
        ? `\n\nUser feedback on previous analyses (incorporate this to improve accuracy):\n${acknowledgedFeedback.map(f => `- Gap "${f.gapTitle}": user note: "${f.userNote || 'acknowledged as important'}"`).join("\n")}`
        : "";
      const response = await contextualLLM({
        userId: ctx.user.id,
        contextType: "analysis",
        messages: [
          { role: "system", content: `You are a knowledge base analyst for a financial services platform. Analyze the user's document collection and identify gaps — missing document types that would improve their AI assistant's ability to serve clients. Consider: compliance documents, product illustrations, client templates, training materials, market research, estate planning, tax strategies, insurance policies, investment guidelines, and regulatory filings. Return JSON with gaps array. Each gap has: id (unique slug), title, category, priority (high/medium/low), description, suggestedAction.${feedbackContext}` },
          { role: "user", content: `My knowledge base has ${docs.length} documents:\n${docSummary || "(empty knowledge base)"}\n\nAlready dismissed/not-applicable gap IDs to exclude: [${dismissedGapIds.join(", ")}]\nAlready resolved gap IDs to exclude: [${resolvedGapIds.join(", ")}]` },
        ],
        response_format: { type: "json_schema", json_schema: { name: "gaps", strict: true, schema: { type: "object", properties: { gaps: { type: "array", items: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, category: { type: "string" }, priority: { type: "string" }, description: { type: "string" }, suggestedAction: { type: "string" } }, required: ["id", "title", "category", "priority", "description", "suggestedAction"], additionalProperties: false } }, summary: { type: "string" } }, required: ["gaps", "summary"], additionalProperties: false } } },
      });
      const parsed = JSON.parse((response.choices[0].message.content as string) || "{}");
      return { gaps: parsed.gaps || [], summary: parsed.summary || "", feedbackCount: feedback.length };
    }),
  submitGapFeedback: protectedProcedure
    .input(z.object({
      gapId: z.string(),
      gapTitle: z.string(),
      gapCategory: z.string().optional(),
      action: z.enum(["dismiss", "acknowledge", "resolved", "not_applicable"]),
      userNote: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addGapFeedback({ userId: ctx.user.id, ...input })),
  getGapFeedback: protectedProcedure
    .query(({ ctx }) => getUserGapFeedback(ctx.user.id)),

  // ─── BATCH URL IMPORT ──────────────────────────────────────────────
  importFromUrls: protectedProcedure
    .input(z.object({ urls: z.array(z.string().url()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      // CBL17: lazy-import SSRF guard from automation module
      const { isPrivateHost } = await import("./shared/automation/webNavigator");
      const results: { url: string; success: boolean; documentId?: number; filename?: string; error?: string }[] = [];
      for (const url of input.urls) {
        try {
          // CBL17 security hardening: block SSRF to private/internal networks
          const parsed = new URL(url);
          if (!["http:", "https:"].includes(parsed.protocol)) {
            results.push({ url, success: false, error: "Only HTTP(S) URLs allowed" }); continue;
          }
          if (isPrivateHost(parsed.hostname)) {
            results.push({ url, success: false, error: "Private/internal hosts are blocked" }); continue;
          }
          const response = await fetch(url, { headers: { "User-Agent": "Stewardly-KnowledgeBot/1.0" }, signal: AbortSignal.timeout(30000) });
          if (!response.ok) { results.push({ url, success: false, error: `HTTP ${response.status}` }); continue; }
          const contentType = response.headers.get("content-type") || "text/html";
          const buffer = Buffer.from(await response.arrayBuffer());
          if (buffer.length > 31 * 1024 * 1024) { results.push({ url, success: false, error: "File exceeds 31MB" }); continue; }
          let filename = url.split("/").pop()?.split("?")[0] || "imported-page";
          if (!filename.includes(".")) filename += contentType.includes("pdf") ? ".pdf" : ".html";
          const fileKey = `docs/${ctx.user.id}/${nanoid()}-${filename}`;
          const { url: fileUrl } = await storagePut(fileKey, buffer, contentType);
          const doc = await addDocument({ userId: ctx.user.id, filename, fileUrl, fileKey, mimeType: contentType, category: "personal_docs", visibility: "private" });
          if (!doc) { results.push({ url, success: false, error: "DB insert failed" }); continue; }
          // Extract text and chunk
          try {
            const extraction = await extractDocumentText(buffer, filename, contentType);
            const text = extraction.text;
            if (text && text.length >= 10 && extraction.method !== "unsupported") {
              const chunkSize = 1000; const overlap = 200; const chunks: string[] = [];
              for (let i = 0; i < text.length; i += chunkSize - overlap) chunks.push(text.substring(i, i + chunkSize));
              await addDocumentChunks(chunks.map((content, index) => ({ documentId: doc.id, userId: ctx.user.id, content, chunkIndex: index, category: "personal_docs" as any })));
              await updateDocumentStatus(doc.id, "ready", text.substring(0, 5000), chunks.length);
            } else {
              await updateDocumentStatus(doc.id, "ready", `[${filename}: ${contentType}]`, 0);
            }
          } catch { await updateDocumentStatus(doc.id, "error"); }
          results.push({ url, success: true, documentId: doc.id, filename });
        } catch (e: any) {
          results.push({ url, success: false, error: e.message || "Fetch failed" });
        }
      }
      return { results, imported: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
    }),

  // ─── ARCHIVE UPLOAD (ZIP/TAR/GZIP) ────────────────────────────────
  uploadArchive: protectedProcedure
    .input(z.object({
      filename: z.string(),
      content: z.string(), // base64
      mimeType: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.content, "base64");
      if (buffer.length > 100 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Archive exceeds 100MB limit" });
      const results: { filename: string; success: boolean; documentId?: number; error?: string }[] = [];
      const SUPPORTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".md", ".csv", ".xls", ".xlsx", ".json", ".html", ".htm", ".rtf", ".pptx", ".ppt", ".png", ".jpg", ".jpeg", ".gif", ".webp"];
      try {
        const zip = new AdmZip(buffer);
        const entries = zip.getEntries();
        for (const entry of entries) {
          if (entry.isDirectory) continue;
          const entryName = entry.entryName.split("/").pop() || entry.entryName;
          if (entryName.startsWith(".") || entryName.startsWith("__MACOSX")) continue;
          const ext = "." + entryName.split(".").pop()?.toLowerCase();
          if (!SUPPORTED_EXTENSIONS.includes(ext)) { results.push({ filename: entryName, success: false, error: `Unsupported file type: ${ext}` }); continue; }
          const fileBuffer = entry.getData();
          if (fileBuffer.length > 31 * 1024 * 1024) { results.push({ filename: entryName, success: false, error: "File exceeds 31MB" }); continue; }
          const mimeMap: Record<string, string> = { ".pdf": "application/pdf", ".doc": "application/msword", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv", ".xls": "application/vnd.ms-excel", ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ".json": "application/json", ".html": "text/html", ".htm": "text/html", ".rtf": "application/rtf", ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".ppt": "application/vnd.ms-powerpoint", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };
          const mime = mimeMap[ext] || "application/octet-stream";
          const fileKey = `docs/${ctx.user.id}/${nanoid()}-${entryName}`;
          try {
            const { url: fileUrl } = await storagePut(fileKey, fileBuffer, mime);
            const category = (input.category || "personal_docs") as any;
            const doc = await addDocument({ userId: ctx.user.id, filename: entryName, fileUrl, fileKey, mimeType: mime, category, visibility: "private" });
            if (!doc) { results.push({ filename: entryName, success: false, error: "DB insert failed" }); continue; }
            try {
              const extraction = await extractDocumentText(fileBuffer, entryName, mime);
              const text = extraction.text;
              if (text && text.length >= 10 && extraction.method !== "unsupported") {
                const chunkSize = 1000; const overlap = 200; const chunks: string[] = [];
                for (let i = 0; i < text.length; i += chunkSize - overlap) chunks.push(text.substring(i, i + chunkSize));
                await addDocumentChunks(chunks.map((content, index) => ({ documentId: doc.id, userId: ctx.user.id, content, chunkIndex: index, category })));
                await updateDocumentStatus(doc.id, "ready", text.substring(0, 5000), chunks.length);
              } else {
                await updateDocumentStatus(doc.id, "ready", `[${entryName}: binary]`, 0);
              }
            } catch { await updateDocumentStatus(doc.id, "error"); }
            results.push({ filename: entryName, success: true, documentId: doc.id });
          } catch (e: any) {
            results.push({ filename: entryName, success: false, error: e.message });
          }
        }
      } catch (e: any) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `Failed to extract archive: ${e.message}` });
      }
      return { results, extracted: results.length, imported: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length };
    }),

  // ─── COLLABORATIVE ANNOTATIONS ─────────────────────────────────────────────────
  listAnnotations: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      return getDocumentAnnotations(input.documentId);
    }),

  addAnnotation: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      content: z.string().min(1),
      highlightText: z.string().optional(),
      highlightStart: z.number().optional(),
      highlightEnd: z.number().optional(),
      annotationType: z.enum(["comment", "highlight", "question", "action_item", "ai_insight"]).default("comment"),
      parentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await createAnnotation({ ...input, userId: ctx.user.id });
      return result;
    }),

  resolveAnnotation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await resolveAnnotation(input.id, ctx.user.id);
      return { success: true };
    }),

  deleteAnnotation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAnnotation(input.id);
      return { success: true };
    }),
});

// ─── PRODUCTS ROUTER ──────────────────────────────────────────────
const productsRouter = router({
  /** List all products visible to the user (platform + their org's) */
  list: protectedProcedure
    .input(z.object({ organizationId: z.number().optional() }).optional())
    .query(({ input }) => getVisibleProducts(input?.organizationId)),

  /** List only org-specific products */
  orgProducts: protectedProcedure
    .input(z.object({ organizationId: z.number() }))
    .query(({ input }) => getOrgProducts(input.organizationId)),

  byCategory: protectedProcedure
    .input(z.object({ category: z.string() }))
    .query(({ input }) => getProductsByCategory(input.category)),

  /** Create a product (org admins for their org, platform admins for platform) */
  create: protectedProcedure
    .input(z.object({
      organizationId: z.number().optional(),
      company: z.string().min(1).max(128),
      name: z.string().min(1).max(256),
      category: z.enum(["iul", "term_life", "disability", "ltc", "premium_finance", "whole_life", "variable_life"]),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      riskLevel: z.enum(["low", "moderate", "moderate_high", "high"]).optional(),
      minPremium: z.number().optional(),
      maxPremium: z.number().optional(),
      targetAudience: z.string().optional(),
      isPlatform: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Platform products require admin role
      if (input.isPlatform && ctx.user.role !== "admin") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only platform admins can create platform products" });
      }
      return createProduct({
        ...input,
        organizationId: input.organizationId ?? null,
        features: input.features,
      });
    }),

  /** Update a product */
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      company: z.string().min(1).max(128).optional(),
      name: z.string().min(1).max(256).optional(),
      category: z.enum(["iul", "term_life", "disability", "ltc", "premium_finance", "whole_life", "variable_life"]).optional(),
      description: z.string().optional(),
      features: z.array(z.string()).optional(),
      riskLevel: z.enum(["low", "moderate", "moderate_high", "high"]).optional(),
      minPremium: z.number().optional(),
      maxPremium: z.number().optional(),
      targetAudience: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return updateProduct(id, data as any);
    }),

  /** Delete a product (non-platform only) */
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return deleteProduct(input.id);
    }),
});

// ─── SUITABILITY ROUTER ──────────────────────────────────────────
const suitabilityRouter = router({
  get: protectedProcedure.query(({ ctx }) => getUserSuitability(ctx.user.id)),
  submit: protectedProcedure
    .input(z.object({
      riskTolerance: z.enum(["conservative", "moderate", "aggressive"]).optional(),
      investmentHorizon: z.string().optional(),
      annualIncome: z.string().optional(),
      netWorth: z.string().optional(),
      investmentExperience: z.enum(["none", "limited", "moderate", "extensive"]).optional(),
      financialGoals: z.array(z.string()).optional(),
      insuranceNeeds: z.array(z.string()).optional(),
      freeformNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await saveSuitabilityAssessment({
        userId: ctx.user.id,
        riskTolerance: input.riskTolerance || "moderate",
        investmentHorizon: input.investmentHorizon || "",
        annualIncome: input.annualIncome || "",
        netWorth: input.netWorth || "",
        investmentExperience: input.investmentExperience || "none",
        financialGoals: input.financialGoals || [],
        insuranceNeeds: input.insuranceNeeds || [],
        responses: { ...input },
      });
      return { success: true };
    }),
  // Conversational suitability — AI asks questions, user responds with buttons or freeform
  chat: protectedProcedure
    .input(z.object({
      history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
      userMessage: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const systemPrompt = `You are a friendly financial profile assistant. Your job is to learn about the user through natural conversation.

Ask ONE question at a time. After each answer, acknowledge it warmly and ask the next question.

Topics to cover (in order, but adapt naturally):
1. What are your main financial goals? (retirement, wealth building, education, estate planning, etc.)
2. How would you describe your comfort with investment risk? (conservative, moderate, aggressive)
3. What's your investment time horizon? (short-term, 5-10 years, 10-20 years, 20+ years)
4. Could you share a general range for your annual income?
5. How about your approximate net worth range?
6. How much experience do you have with investments and financial products?
7. Are there any specific insurance or protection needs you're thinking about?
8. Anything else about your financial situation you'd like to share?

Rules:
- Be conversational and warm, not clinical
- If the user gives a vague answer, that's fine — accept it and move on
- If the user says "that's enough" or "skip" or similar, wrap up gracefully
- After covering enough topics (at least 3), offer to wrap up
- When wrapping up, summarize what you learned in a brief paragraph

For each response, also return suggested quick-reply buttons as a JSON block at the very end of your message, on its own line, formatted exactly like:
[BUTTONS: "Option 1", "Option 2", "Option 3"]

If no buttons are appropriate, omit the BUTTONS line.
The user's name is ${ctx.user.name || "there"}.`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...input.history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        { role: "user" as const, content: input.userMessage },
      ];

      const response = await contextualLLM({ userId: ctx.user.id, contextType: "chat", messages });
      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content : "";

      // Parse buttons from response
      const buttonMatch = content.match(/\[BUTTONS:\s*(.+?)\]/);
      let buttons: string[] = [];
      let cleanContent = content;
      if (buttonMatch) {
        cleanContent = content.replace(/\[BUTTONS:\s*.+?\]/, "").trim();
        buttons = buttonMatch[1].split(",").map((b: string) => b.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
      }

      // Check if the AI is wrapping up (summary detected)
      const isComplete = cleanContent.toLowerCase().includes("summary") ||
        cleanContent.toLowerCase().includes("that covers") ||
        cleanContent.toLowerCase().includes("profile is ready") ||
        cleanContent.toLowerCase().includes("all set") ||
        input.history.length >= 16; // 8 Q&A pairs max

      return { content: cleanContent, buttons, isComplete };
    }),
  // Extract structured data from conversation and save
  saveFromChat: protectedProcedure
    .input(z.object({
      conversationHistory: z.array(z.object({ role: z.string(), content: z.string() })),
    }))
    .mutation(async ({ ctx, input }) => {
      // Use LLM to extract structured suitability data from the conversation
      const extractPrompt = `Extract a financial suitability profile from this conversation. Return ONLY valid JSON with these fields (use null for unknown):
{
  "riskTolerance": "conservative" | "moderate" | "aggressive" | null,
  "investmentHorizon": string | null,
  "annualIncome": string | null,
  "netWorth": string | null,
  "investmentExperience": "none" | "limited" | "moderate" | "extensive" | null,
  "financialGoals": string[],
  "insuranceNeeds": string[],
  "freeformNotes": string
}`;
      const resp = await contextualLLM({
        userId: ctx.user.id,
        contextType: "analysis",
        messages: [
          { role: "system", content: extractPrompt },
          ...input.conversationHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
      });
      let extracted: any = {};
      try {
        const raw = typeof resp.choices[0]?.message?.content === "string" ? resp.choices[0].message.content : "{}";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        extracted = JSON.parse(jsonMatch ? jsonMatch[0] : "{}");
      } catch { extracted = {}; }

      await saveSuitabilityAssessment({
        userId: ctx.user.id,
        riskTolerance: extracted.riskTolerance || "moderate",
        investmentHorizon: extracted.investmentHorizon || "",
        annualIncome: extracted.annualIncome || "",
        netWorth: extracted.netWorth || "",
        investmentExperience: extracted.investmentExperience || "none",
        financialGoals: extracted.financialGoals || [],
        insuranceNeeds: extracted.insuranceNeeds || [],
        responses: { conversational: true, ...extracted },
      });
      return { success: true, extracted };
    }),
  // Access chain: professionals can view their clients' suitability
  getClientSuitability: protectedProcedure
    .input(z.object({ userId: z.number() }))
    .query(async ({ ctx, input }) => {
      // Admins always have access; professionals/managers need org role check
      if (ctx.user.role !== "admin") {
        let hasAccess = false;
        if (ctx.user.affiliateOrgId) {
          const { getUserOrgRole, hasMinimumOrgRole } = await import("./services/orgRoleHelper");
          const orgRole = await getUserOrgRole(ctx.user.id, ctx.user.affiliateOrgId);
          hasAccess = hasMinimumOrgRole(orgRole, "professional");
        }
        if (!hasAccess) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions to view client suitability" });
        }
      }
      return getUserSuitability(input.userId);
    }),
  // Access chain: managers/admins can list all suitability assessments
  listAll: protectedProcedure.query(async ({ ctx }) => {
    // Admins and org managers can list all assessments
    if (ctx.user.role !== "admin") {
      let hasAccess = false;
      if (ctx.user.affiliateOrgId) {
        const { getUserOrgRole, hasMinimumOrgRole } = await import("./services/orgRoleHelper");
        const orgRole = await getUserOrgRole(ctx.user.id, ctx.user.affiliateOrgId);
        hasAccess = hasMinimumOrgRole(orgRole, "manager");
      }
      if (!hasAccess) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient permissions to list assessments" });
      }
    }
    const db = await (await import("./db")).getDb();
    if (!db) return [];
    const { suitabilityAssessments: sa } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    const all = await db!.select().from(sa).orderBy(sa.createdAt);
    return all;
  }),
});

// ─── VISUAL GENERATION ROUTER ────────────────────────────────────
const visualRouter = router({
  generate: protectedProcedure
    .input(z.object({ prompt: z.string().min(1).max(2000) }))
    .mutation(async ({ input }) => {
      const result = await generateImage({ prompt: input.prompt });
      return { url: result.url || null };
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
  /** Edge TTS — high-quality neural speech synthesis */
  speak: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(5000),
      voice: z.string().default("en-US-GuyNeural"),
      rate: z.string().default("+0%"),
      pitch: z.string().default("+0Hz"),
    }))
    .mutation(async ({ input }) => {
      try {
        const audioBuffer = await generateSpeech(
          input.text,
          input.voice,
          input.rate,
          input.pitch
        );
        return {
          audio: audioBuffer.toString("base64"),
          mimeType: "audio/mpeg",
          voice: input.voice,
        };
      } catch (err: any) {
        logger.error( { operation: "edgeTTS", err: err },"[EdgeTTS] Error:", err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Speech generation failed. Falling back to browser TTS.",
        });
      }
    }),
  /** List available Edge TTS voices with metadata */
  voices: protectedProcedure.query(() => getVoiceCatalog()),
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
  acceptTos: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await (await import("./db")).getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const { users } = await import("../drizzle/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(users).set({ tosAcceptedAt: new Date() }).where(eq(users.id, ctx.user.id));
    return { accepted: true, acceptedAt: new Date() };
  }),
  getTosStatus: protectedProcedure.query(async ({ ctx }) => {
    return { accepted: !!(ctx.user as any).tosAcceptedAt, acceptedAt: (ctx.user as any).tosAcceptedAt };
  }),

  // ─── KEYBOARD SHORTCUTS (server-side persistence) ─────────────────
  getShortcuts: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
    const { userPreferences } = await import("../drizzle/schema");
    const [row] = await db
      .select({ customShortcuts: userPreferences.customShortcuts })
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);
    return { shortcuts: (row?.customShortcuts as any[] | null) ?? null };
  }),

  saveShortcuts: protectedProcedure
    .input(z.object({
      shortcuts: z.array(z.object({
        key: z.string().min(1).max(1),
        route: z.string().min(1),
        label: z.string().min(1),
      })).max(26),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb(); if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const { userPreferences } = await import("../drizzle/schema");
      const [existing] = await db
        .select({ id: userPreferences.id })
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);
      if (existing) {
        await db.update(userPreferences)
          .set({ customShortcuts: input.shortcuts })
          .where(eq(userPreferences.userId, ctx.user.id));
      } else {
        await db.insert(userPreferences).values({
          userId: ctx.user.id,
          customShortcuts: input.shortcuts,
        });
      }
      return { success: true };
    }),
});

// ─── CALCULATORS ROUTER ──────────────────────────────────────────
// Wired to the real UWE engine (v7 parity) instead of simplified stubs.
// Each procedure creates a single-product strategy, runs UWE.simulate(),
// and maps the rich engine output to the UI's expected shape.
import { UWE } from "./engines/uwe";
import type { StrategyConfig as UWEStrategyConfig, ProductConfig as UWEProductConfig, CompanyFeatures } from "./engines/types";

const DEFAULT_FEATURES: CompanyFeatures = { holistic: true, taxFree: true, livingBen: true, advisor: true, estate: false, group: false, fiduciary: true, lowFees: false, insurance: true };

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
      const product: UWEProductConfig = {
        type: "iul",
        face: input.deathBenefit,
        annualPremium: input.annualPremium,
        fundingYears: input.years,
        livingBenPct: 0.90,
      };
      const strategy: UWEStrategyConfig = {
        company: "wealthbridge",
        companyName: "WealthBridge",
        color: "#16A34A",
        profile: { age: input.age, income: 120000, savings: 0, monthlySavings: 0, equitiesReturn: 0 },
        products: [product],
        features: DEFAULT_FEATURES,
        notes: "",
      };
      const snapshots = UWE.simulate(strategy, input.years);
      const projections = snapshots.map((s) => {
        const detail = s.productDetails[0];
        const cv = detail ? detail.cashValue : s.productCashValue;
        const db = detail ? detail.deathBenefit : s.productDeathBenefit;
        return {
          year: s.year,
          age: s.age,
          premium: s.year <= input.years ? input.annualPremium : 0,
          cashValue: cv,
          surrenderValue: Math.round(cv * (s.year < 10 ? 0.85 + s.year * 0.015 : 1)),
          deathBenefit: db,
          taxSaving: detail ? detail.taxSaving : s.productTaxSaving,
          livingBenefit: detail ? detail.livingBenefit : s.productLivingBenefit,
        };
      });
      return { projections, totalPremiums: input.annualPremium * input.years };
    }),

  premiumFinance: protectedProcedure
    .input(z.object({
      faceAmount: z.number().min(100000),
      annualPremium: z.number().min(1000),
      loanRate: z.number().min(0).max(20),
      creditingRate: z.number().min(0).max(15).optional(),
      years: z.number().min(1).max(30),
      projectionYears: z.number().min(1).max(40).optional(),
      collateralRate: z.number().min(0).max(20),
      cashOutlay: z.number().min(0).optional(),
    }))
    .mutation(({ input }) => {
      const creditRate = (input.creditingRate ?? 6.5) / 100;
      const projYears = input.projectionYears ?? input.years;
      const cashOut = input.cashOutlay ?? input.annualPremium;
      const product: UWEProductConfig = {
        type: "premfin",
        face: input.faceAmount,
        cashOutlay: cashOut,
        annualPremium: input.annualPremium,
        loanRate: input.loanRate / 100,
        creditingRate: creditRate,
        fundingYears: input.years,
      };
      const strategy: UWEStrategyConfig = {
        company: "wealthbridge",
        companyName: "WealthBridge",
        color: "#16A34A",
        profile: { age: 45, income: 500000, netWorth: 5000000, savings: 0, monthlySavings: 0, equitiesReturn: 0 },
        products: [product],
        features: { ...DEFAULT_FEATURES, premFinance: true },
        notes: "",
      };
      const snapshots = UWE.simulate(strategy, projYears);
      let breakevenYear: number | null = null;
      const projections = snapshots.map((s) => {
        const detail = s.productDetails[0];
        const details = detail?.details as Record<string, number> | undefined;
        const loanBal = details?.loanBalance ?? 0;
        const csv = details?.grossCSV ?? details?.csv ?? 0;
        const netEq = details?.netEquity ?? detail?.cashValue ?? 0;
        const collateralCost = Math.round(loanBal * (input.collateralRate / 100));
        const db = detail ? detail.deathBenefit : s.productDeathBenefit;
        const cumulativeCashOutlay = Math.min(s.year, input.years) * cashOut;
        const leverageRatio = cumulativeCashOutlay > 0 ? Math.round((db / cumulativeCashOutlay) * 10) / 10 : 0;
        if (breakevenYear === null && netEq > 0) breakevenYear = s.year;
        return {
          year: s.year,
          premium: s.year <= input.years ? input.annualPremium : 0,
          cashOutlayThisYear: s.year <= input.years ? cashOut : 0,
          cumulativeCashOutlay,
          loanBalance: loanBal,
          policyValue: csv,
          collateralCost,
          netEquity: netEq,
          deathBenefit: db,
          leverageRatio,
          spread: Math.round((creditRate - input.loanRate / 100) * 10000) / 100,
        };
      });
      const totalCollateralCost = projections.reduce((sum, p) => sum + p.collateralCost, 0);
      const totalCashOutlay = projections.reduce((sum, p) => sum + p.cashOutlayThisYear, 0);
      const lastP = projections[projections.length - 1];
      const finalNetEquity = lastP?.netEquity ?? 0;
      const finalDB = lastP?.deathBenefit ?? 0;
      const roi = totalCashOutlay > 0 ? Math.round((finalNetEquity / totalCashOutlay) * 10000) / 100 : 0;
      const dbLeverage = totalCashOutlay > 0 ? Math.round((finalDB / totalCashOutlay) * 10) / 10 : 0;
      const spreadPct = Math.round((creditRate - input.loanRate / 100) * 10000) / 100;
      return {
        projections,
        totalCollateralCost,
        totalCashOutlay,
        roi,
        breakevenYear,
        finalNetEquity,
        finalDeathBenefit: finalDB,
        deathBenefitLeverage: dbLeverage,
        spreadPct,
        creditingRate: Math.round(creditRate * 10000) / 100,
        loanRate: input.loanRate,
      };
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
      const annualContrib = input.monthlyContribution * 12;
      const product: UWEProductConfig = {
        type: "401k",
        initialBalance: input.currentSavings,
        annualContrib,
        employerMatch: 0,
        grossReturn: input.expectedReturn / 100,
      };
      const strategy: UWEStrategyConfig = {
        company: "wealthbridge",
        companyName: "WealthBridge",
        color: "#16A34A",
        profile: {
          age: input.currentAge,
          income: annualContrib * 4,
          savings: input.currentSavings,
          monthlySavings: input.monthlyContribution,
          equitiesReturn: input.expectedReturn / 100,
        },
        products: [product],
        features: DEFAULT_FEATURES,
        notes: "",
      };
      const snapshots = UWE.simulate(strategy, years);
      const projections = snapshots.map((s) => {
        const nominalBalance = s.totalWealth;
        const realBalance = Math.round(nominalBalance / Math.pow(1 + input.inflationRate / 100, s.year));
        return {
          year: s.year,
          age: s.age,
          nominalBalance,
          realBalance,
          totalContributed: Math.round(input.currentSavings + annualContrib * s.year),
        };
      });
      const finalBalance = projections[projections.length - 1]?.nominalBalance ?? 0;
      const monthlyIncome = Math.round(finalBalance * 0.04 / 12);
      return { projections, estimatedMonthlyIncome: monthlyIncome, finalBalance };
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
        logger.error( { operation: "routers", err: e },"Market data error:", e);
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
import { organizationsRouter } from "./routers/organizations";
import { emailAuthRouter } from "./routers/emailAuth";
import { relationshipsRouter } from "./routers/relationships";
import { orgBrandingRouter } from "./routers/orgBranding";
import { anonymousChatRouter } from "./routers/anonymousChat";
import { meetingsRouter } from "./routers/meetings";
import { insightsRouter } from "./routers/insights";
import { complianceRouter } from "./routers/compliance";
import { portalRouter } from "./routers/portal";
import { featureFlagsRouter } from "./routers/featureFlags";
import { workflowRouter } from "./routers/workflow";
import { matchingRouter } from "./routers/matching";
import {
  knowledgeGraphRouter, educationRouter, studentLoansRouter,
  equityCompRouter, digitalAssetsRouter, coiRouter,
  complianceCopilotRouter, memoryEpisodesRouter,
} from "./routers/v4Features";
import {
  planAdherenceRouter, ltcPlannerRouter, financialHealthRouter,
  clientSegmentationRouter, practiceIntelligenceRouter, businessExitRouter,
  constitutionalRouter, ambientRouter, workflowOrchestratorRouter,
  annualReviewRouter, portalOptimizerRouter,
} from "./routers/v5Features";
import {
  taxProjectorRouter, ssOptimizerRouter, hsaOptimizerRouter,
  medicareRouter as medicareNavRouter, charitableRouter as charitableGivingRouter,
  divorceRouter, educationPlannerRouter, taskEngineRouter,
  commsRouter, feeBillingRouter,
} from "./routers/v6Features";
import { multiModelRouter } from "./routers/multiModel";
import { dataIngestionRouter } from "./routers/dataIngestion";
import { dataIngestionEnhancedRouter } from "./routers/dataIngestionEnhanced";
import { scheduledIngestionRouter } from "./routers/scheduledIngestion";
import { agenticRouter } from "./routers/agenticExecution";
import { searchEnhancedRouter } from "./routers/searchEnhanced";
import { multiModalProcessingRouter } from "./routers/multiModalProcessing";
import { recommendationRouter } from "./routers/recommendation";
import { webhookIngestionRouter } from "./routers/webhookIngestion";
import { analyticsRouter } from "./routers/analytics";
import { emailCampaignRouter } from "./routers/emailCampaign";
import { consentRouter } from "./routers/consent";
import { professionalsRouter } from "./routers/professionals";
import { fairnessRouter } from "./routers/fairness";
import { improvementEngineRouter } from "./routers/improvementEngine";
import { kbAccessRouter } from "./routers/kbAccess";
import { integrationsRouter } from "./routers/integrations";
import { suitabilityEngineRouter } from "./routers/suitabilityEngine";
import { modelEngineRouter } from "./routers/modelEngine";
import { propagationRouter } from "./routers/propagation";
import { fileProcessingRouter } from "./routers/fileProcessing";
import { authEnrichmentRouter } from "./routers/authEnrichment";
import { notificationsRouter } from "./routers/notifications";
import { reportsRouter } from "./routers/reports";
import { knowledgeBaseRouter } from "./routers/knowledgeBase";
import { aiPlatformRouter } from "./routers/aiPlatform";
import { operationsRouter } from "./routers/operations";
import { addendumFeaturesRouter } from "./routers/addendumFeatures";
import { maxScoresRouter } from "./routers/maxScores";
import { exponentialEngineRouter } from "./routers/exponentialEngine";
import { selfDiscoveryRouter } from "./routers/selfDiscovery";
import { verificationRouter } from "./routers/verification";
import { dataSeedRouter } from "./routers/dataSeed";
import { productIntelligenceRouter } from "./routers/productIntelligence";
import { adminIntelligenceRouter } from "./routers/adminIntelligence";
import { passiveActionsRouter } from "./routers/passiveActions";
import { advancedIntelligenceRouter } from "./routers/advancedIntelligence";
import { autonomousProcessingRouter } from "./routers/autonomousProcessing";
import { openClawRouter } from "./routers/openClaw";
import { wealthEngineRouter } from "./routers/wealthEngine";
import { codeChatRouter } from "./routers/codeChat";
import { calculatorEngineRouter } from "./routers/calculatorEngine";
import { financialProfileRouter } from "./routers/financialProfile";

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
  visual: visualRouter,
  organizations: organizationsRouter,
  emailAuth: emailAuthRouter,
  relationships: relationshipsRouter,
  orgBranding: orgBrandingRouter,
  aiLayers: aiLayersRouter,
  anonymousChat: anonymousChatRouter,
  meetings: meetingsRouter,
  insights: insightsRouter,
  compliance: complianceRouter,
  portal: portalRouter,
  featureFlags: featureFlagsRouter,
  workflow: workflowRouter,
  matching: matchingRouter,
  knowledgeGraph: knowledgeGraphRouter,
  education: educationRouter,
  studentLoans: studentLoansRouter,
  equityComp: equityCompRouter,
  digitalAssets: digitalAssetsRouter,
  coi: coiRouter,
  complianceCopilot: complianceCopilotRouter,
  memoryEpisodes: memoryEpisodesRouter,
  planAdherence: planAdherenceRouter,
  ltcPlanner: ltcPlannerRouter,
  financialHealth: financialHealthRouter,
  clientSegmentation: clientSegmentationRouter,
  practiceIntelligence: practiceIntelligenceRouter,
  businessExit: businessExitRouter,
  constitutional: constitutionalRouter,
  ambient: ambientRouter,
  workflowOrchestrator: workflowOrchestratorRouter,
  annualReview: annualReviewRouter,
  portalOptimizer: portalOptimizerRouter,
  taxProjector: taxProjectorRouter,
  ssOptimizer: ssOptimizerRouter,
  hsaOptimizer: hsaOptimizerRouter,
  medicareNav: medicareNavRouter,
  charitableGiving: charitableGivingRouter,
  divorce: divorceRouter,
  educationPlanner: educationPlannerRouter,
  taskEngine: taskEngineRouter,
  comms: commsRouter,
  feeBilling: feeBillingRouter,
  multiModel: multiModelRouter,
  dataIngestion: dataIngestionRouter,
  dataIngestionEnhanced: dataIngestionEnhancedRouter,
  scheduledIngestion: scheduledIngestionRouter,
  agentic: agenticRouter,
  searchEnhanced: searchEnhancedRouter,
  webhooks: webhookIngestionRouter,
  multiModalProcessing: multiModalProcessingRouter,
  recommendation: recommendationRouter,
  analytics: analyticsRouter,
  emailCampaign: emailCampaignRouter,
  consent: consentRouter,
  professionals: professionalsRouter,
  fairness: fairnessRouter,
  improvementEngine: improvementEngineRouter,
  kbAccess: kbAccessRouter,
  integrations: integrationsRouter,
  suitabilityEngine: suitabilityEngineRouter,
  modelEngine: modelEngineRouter,
  propagation: propagationRouter,
  fileProcessing: fileProcessingRouter,
  authEnrichment: authEnrichmentRouter,
  notifications: notificationsRouter,
  reports: reportsRouter,
  exports: exportsRouter,
  knowledgeBase: knowledgeBaseRouter,
  aiPlatform: aiPlatformRouter,
  operations: operationsRouter,
  addendum: addendumFeaturesRouter,
  maxScores: maxScoresRouter,
  exponentialEngine: exponentialEngineRouter,
  selfDiscovery: selfDiscoveryRouter,
  verification: verificationRouter,
  dataSeed: dataSeedRouter,
  productIntelligence: productIntelligenceRouter,
  adminIntelligence: adminIntelligenceRouter,
  passiveActions: passiveActionsRouter,
  esignature: esignatureRouter,
  pdf: pdfRouter,
  creditBureau: creditBureauRouter,
  crm: crmRouter,
  leadPipeline: leadPipelineRouter,
  propensityScoring: propensityRouter,
  dataImport: importRouter,
  businessPlanning: planningRouter,
  communityForum: communityForumRouter,
  premiumFinanceRates: pfRatesRouter,
  businessReports: reportsBusinessRouter,
  contentCms: contentCmsRouter,
  leadCapture: leadCaptureRouter,
  referrals: referralsRouter,
  embeds: embedsRouter,
  advancedIntelligence: advancedIntelligenceRouter,
  autonomousProcessing: autonomousProcessingRouter,
  openClaw: openClawRouter,
  wealthEngine: wealthEngineRouter,
  codeChat: codeChatRouter,
  calculatorEngine: calculatorEngineRouter,
  financialProfile: financialProfileRouter,
  learning: learningRouter,
  ghlWebhook: ghlWebhookRouter,
  dripifyWebhook: dripifyWebhookRouter,
  smsitWebhook: smsitWebhookRouter,
  audio: audioRouter,
  clientPortal: clientRouter,
  comparables: comparablesRouter,
  rebalancing: rebalancingRouter,
  tax: taxRouter,
  portfolioLedger: portfolioLedgerRouter,
  estate: estateRouter,
  reportsFiduciary: reportsFiduciaryRouter,
  dynamicIntegrations: dynamicIntegrationsRouter,
});

export type AppRouter = typeof appRouter;
