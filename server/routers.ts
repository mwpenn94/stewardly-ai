import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { transcribeAudio } from "./_core/voiceTranscription";
import { storagePut } from "./storage";
import { generateImage } from "./_core/imageGeneration";
import { nanoid } from "nanoid";
import { generateSpeech, getVoiceCatalog } from "./edgeTTS";
import { callDataApi } from "./_core/dataApi";
import { SEARCH_TOOLS, executeSearchTool } from "./webSearch";
import {
  createConversation, getUserConversations, getConversation, deleteConversation,
  updateConversationTitle, searchConversations, getConversationContext,
  addMessage, getConversationMessages,
  addDocument, getUserDocuments, getAccessibleDocuments, updateDocumentVisibility,
  updateDocumentStatus, addDocumentChunks,
  searchDocumentChunks, deleteDocument, getAllProducts, getProductsByCategory,
  getVisibleProducts, getOrgProducts, createProduct, updateProduct, deleteProduct,
  addAuditEntry, getAuditTrail, addToReviewQueue, getPendingReviews, updateUserAvatar,
  updateReviewStatus, addMemory, getUserMemories, deleteMemory,
  addFeedback, getFeedbackStats, addQualityRating,
  saveSuitabilityAssessment, getUserSuitability,
  updateUserStyleProfile, updateUserSettings,
  toggleConversationPin, moveConversationToFolder,
  getUserFolders, createFolder, updateFolder, deleteFolder,
  reorderConversations, exportConversation,
} from "./db";
import { buildInsightContext, invalidateInsightCache } from "./insightCollectors";
import {
  buildSystemPrompt, FINANCIAL_DISCLAIMER, needsFinancialDisclaimer,
  detectPII, stripPII, calculateConfidence, getTopicDisclaimer, maskPIIForLLM,
} from "./prompts";
import { extractMemoriesFromMessage, saveExtractedMemories, generateEpisodeSummary, saveEpisodeSummary, assembleMemoryContext } from "./memoryEngine";
import { assembleGraphContext } from "./knowledgeGraph";
import { classifyContent, applyModifications, logComplianceAudit, logPrivacyAudit } from "./complianceCopilot";
import type { FocusMode, AdvisoryMode } from "@shared/types";
import { eq, and } from "drizzle-orm";
import { integrationConnections, integrationProviders } from "../drizzle/schema";
import { getDb } from "./db";
import { aiLayersRouter } from "./routers/aiLayers";
import { resolveAIConfig, buildLayerOverlayPrompt } from "./aiConfigResolver";

// ─── CHAT ROUTER ──────────────────────────────────────────────────
const chatRouter = router({
  send: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      content: z.string().min(1).max(50000),
      mode: z.enum(["client", "coach", "manager"]).default("client"),
      focus: z.string().default("general,financial"),
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

      // Get user memories (3-tier Memory Engine + Knowledge Graph)
      let memoriesStr = "";
      try {
        const [memCtx, graphCtx] = await Promise.all([
          assembleMemoryContext(ctx.user.id),
          assembleGraphContext(ctx.user.id),
        ]);
        memoriesStr = [memCtx, graphCtx].filter(Boolean).join("\n\n");
      } catch (e) { /* memories are optional */ }

      // ── CONTEXTUAL INSIGHTS (audit-direction prompts) ──────────────
      // Always collect insights so the AI has real data about the user's
      // platform usage, configuration, and performance.
      let insightContext = "";
      try {
        const userRole = ctx.user.role || "user";
        insightContext = await buildInsightContext(ctx.user.id, userRole);
      } catch (e) { /* insights are optional, degrade gracefully */ }

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
          organizationId: undefined, // TODO: pass user's active org when org context is available
        });
      } catch (e) {
        resolvedConfig = null;
      }

      // Build the layer overlay prompt (injected alongside existing system prompt)
      const layerOverlay = resolvedConfig ? buildLayerOverlayPrompt(resolvedConfig) : "";

      // ── INTEGRATION DATA CONTEXT ──────────────────────────────────
      // Assemble data from user's connected integrations (Plaid, etc.)
      let integrationContext = "";
      try {
        const db = (await getDb())!;
        const connections = await db.select()
          .from(integrationConnections)
          .where(and(
            eq(integrationConnections.ownerId, String(ctx.user.id)),
            eq(integrationConnections.status, "connected")
          ));
        if (connections.length > 0) {
          const summaries: string[] = [];
          for (const conn of connections) {
            const provider = await db.select()
              .from(integrationProviders)
              .where(eq(integrationProviders.id, conn.providerId))
              .limit(1);
            const providerName = provider[0]?.name || "Unknown";
            summaries.push(`- ${providerName}: ${conn.recordsSynced || 0} records synced, last sync ${conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleDateString() : "never"}, status: ${conn.lastSyncStatus || "unknown"}`);
          }
          integrationContext = `Connected integrations (${connections.length}):\n${summaries.join("\n")}`;
        }
      } catch (e) { /* integration context is optional */ }

      // Build system prompt (existing logic + new context params)
      const systemPrompt = buildSystemPrompt({
        userName: ctx.user.name || "User",
        mode: input.mode as AdvisoryMode,
        focus: primaryFocus,
        focusModes,
        styleProfile: ctx.user.styleProfile,
        ragContext: ragContext || undefined,
        memories: memoriesStr || undefined,
        suitabilityCompleted: ctx.user.suitabilityCompleted || false,
        productContext: productContext || undefined,
        integrationContext: integrationContext || undefined,
        insightContext: insightContext || undefined,
      });

      // Combine: existing system prompt + layer overlays
      let fullSystemPrompt = layerOverlay
        ? `${systemPrompt}\n\n${layerOverlay}`
        : systemPrompt;

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

      // Invoke LLM with search tools enabled for financial research
      const useTools = hasFinancial || input.content.toLowerCase().match(/\b(compare|lookup|research|price|rate|stock|etf|fund|carrier|product|provider)\b/);
      const response = await invokeLLM({
        messages: llmMessages,
        ...(useTools ? { tools: SEARCH_TOOLS, tool_choice: "auto" as const } : {}),
      });

      let aiContent = "";
      const firstChoice = response.choices[0]?.message;

      // Handle tool calls — execute them and feed results back to the LLM
      if (firstChoice?.tool_calls && firstChoice.tool_calls.length > 0) {
        // Build tool result messages
        const toolMessages: Array<{ role: "assistant" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string }> = [
          { role: "assistant", content: (typeof firstChoice.content === "string" ? firstChoice.content : "") || "", tool_calls: firstChoice.tool_calls },
        ];

        for (const toolCall of firstChoice.tool_calls) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            const result = await executeSearchTool(toolCall.function.name, args);
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: result,
            });
          } catch (err: any) {
            toolMessages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ error: err.message }),
            });
          }
        }

        // Second LLM call with tool results
        const followUp = await invokeLLM({
          messages: [...llmMessages, ...toolMessages] as any,
        });
        aiContent = typeof followUp.choices[0]?.message?.content === "string"
          ? followUp.choices[0].message.content
          : "";
      } else {
        aiContent = typeof firstChoice?.content === "string"
          ? firstChoice.content
          : "";
      }

      // Check for financial disclaimer
      const isFinancial = needsFinancialDisclaimer(aiContent, primaryFocus);
      if (isFinancial) {
        aiContent += FINANCIAL_DISCLAIMER;
      }

      // Topic-specific disclaimers (3B) — investment, insurance, tax
      const topicDisclaimer = getTopicDisclaimer(aiContent);
      if (topicDisclaimer) {
        aiContent += topicDisclaimer;
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
      const titleResp = await invokeLLM({
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
      let md = `# ${title}\n\n_Exported from Stewardry on ${date}_\n\n---\n\n`;
      for (const msg of data.messages) {
        const role = msg.role === "user" ? "**You**" : msg.role === "assistant" ? "**Stewardry AI**" : "_System_";
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
    // Professionals see docs with visibility >= professional; managers >= management; admins see all
    // TODO: Check org-specific roles from user_organization_roles table
    // For now, global_admin sees all; others see only their own
    // TODO: Implement role-based access control
    // TODO: Check user_organization_roles for role-based document access
    // TODO: Add org role checks for manager/professional visibility
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
      category: z.enum(["personal_docs", "financial_products", "regulations", "training_materials", "artifacts", "skills"]).default("personal_docs"),
      visibility: z.enum(["private", "professional", "management", "admin"]).default("professional"),
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
        visibility: input.visibility,
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

      const response = await invokeLLM({ messages });
      const content = typeof response.choices[0]?.message?.content === "string"
        ? response.choices[0].message.content : "";

      // Parse buttons from response
      const buttonMatch = content.match(/\[BUTTONS:\s*(.+?)\]/);
      let buttons: string[] = [];
      let cleanContent = content;
      if (buttonMatch) {
        cleanContent = content.replace(/\[BUTTONS:\s*.+?\]/, "").trim();
        buttons = buttonMatch[1].split(",").map(b => b.trim().replace(/^"|"$/g, "").replace(/^'|'$/g, ""));
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
      const resp = await invokeLLM({
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
      // TODO: Check org-specific roles from user_organization_roles table
      // For now, only global_admin can view client suitability
      // TODO: Implement role-based access control
      if (true) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can view client suitability" });
      }
      return getUserSuitability(input.userId);
    }),
  // Access chain: managers/admins can list all suitability assessments
  listAll: protectedProcedure.query(async ({ ctx }) => {
    // TODO: Check org-specific roles from user_organization_roles table
    // For now, only global_admin can list all assessments
    // TODO: Implement role-based access control
    if (true) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can list all assessments" });
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
  speak: publicProcedure
    .input(z.object({
      text: z.string().min(1).max(5000),
      voice: z.string().default("aria"),
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
          mimeType: "audio/webm",
          voice: input.voice,
        };
      } catch (err: any) {
        console.error("[EdgeTTS] Error:", err.message);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Speech generation failed. Falling back to browser TTS.",
        });
      }
    }),
  /** List available Edge TTS voices with metadata */
  voices: publicProcedure.query(() => getVoiceCatalog()),
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
});

export type AppRouter = typeof appRouter;
