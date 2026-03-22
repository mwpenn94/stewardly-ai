import { eq, desc, and, or, sql, asc, inArray, like, gte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, conversations, messages, documents, documentChunks,
  products, auditTrail, reviewQueue, memories, feedback, qualityRatings,
  suitabilityAssessments, conversationFolders
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── USER HELPERS ─────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserSettings(userId: number, settings: Record<string, unknown>) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ settings: JSON.stringify(settings) }).where(eq(users.id, userId));
}

export async function updateUserStyleProfile(userId: number, profile: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ styleProfile: profile }).where(eq(users.id, userId));
}

export async function updateUserAvatar(userId: number, avatarUrl: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
}

export async function updateSuitabilityStatus(userId: number, completed: boolean, data?: unknown) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({
    suitabilityCompleted: completed,
    suitabilityData: data ? JSON.stringify(data) : undefined,
  }).where(eq(users.id, userId));
}

// ─── CONVERSATION HELPERS ─────────────────────────────────────────
export async function createConversation(userId: number, mode: "client" | "coach" | "manager" = "client", title?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(conversations).values({ userId, mode, title: title || "New Conversation" });
  return { id: result[0].insertId };
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
}

export async function getConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId))).limit(1);
  return result[0];
}

export async function deleteConversation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversations).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function updateConversationTitle(id: number, userId: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ title }).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function searchConversations(userId: number, query: string, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  const searchTerm = `%${query}%`;
  // Search by title match
  const titleMatches = await db.select({
    id: conversations.id,
    title: conversations.title,
    mode: conversations.mode,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    matchType: sql<string>`'title'`.as("matchType"),
    matchSnippet: conversations.title,
  }).from(conversations)
    .where(and(eq(conversations.userId, userId), like(conversations.title, searchTerm)))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);

  // Search by message content match
  const messageMatches = await db.select({
    id: conversations.id,
    title: conversations.title,
    mode: conversations.mode,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    matchType: sql<string>`'message'`.as("matchType"),
    matchSnippet: sql<string>`SUBSTRING(${messages.content}, 1, 150)`.as("matchSnippet"),
  }).from(messages)
    .innerJoin(conversations, eq(messages.conversationId, conversations.id))
    .where(and(eq(conversations.userId, userId), like(messages.content, searchTerm)))
    .orderBy(desc(conversations.updatedAt))
    .limit(limit);

  // Deduplicate by conversation id, preferring title matches
  const seen = new Set<number>();
  const results: typeof titleMatches = [];
  for (const r of [...titleMatches, ...messageMatches]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      results.push(r);
    }
  }
  return results.slice(0, limit);
}

export async function getConversationContext(userId: number, conversationIds: number[], maxMessages = 5) {
  const db = await getDb();
  if (!db) return [];
  // Get the most recent messages from specified conversations for AI context
  const results = [];
  for (const convId of conversationIds.slice(0, 5)) {
    const conv = await db.select().from(conversations)
      .where(and(eq(conversations.id, convId), eq(conversations.userId, userId)))
      .limit(1);
    if (!conv[0]) continue;
    const msgs = await db.select().from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(desc(messages.createdAt))
      .limit(maxMessages);
    results.push({
      conversationId: convId,
      title: conv[0].title,
      messages: msgs.reverse().map(m => ({ role: m.role, content: m.content.substring(0, 500) })),
    });
  }
  return results;
}

// ─── CONVERSATION PIN / FOLDER HELPERS ────────────────────────────
export async function toggleConversationPin(id: number, userId: number, pinned: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ pinned }).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function moveConversationToFolder(id: number, userId: number, folderId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ folderId }).where(and(eq(conversations.id, id), eq(conversations.userId, userId)));
}

export async function getUserFolders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(conversationFolders).where(eq(conversationFolders.userId, userId)).orderBy(conversationFolders.sortOrder);
}

export async function createFolder(userId: number, name: string, color?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(conversationFolders).values({ userId, name, color: color || "#6366f1" });
  return { id: result[0].insertId };
}

export async function updateFolder(id: number, userId: number, data: { name?: string; color?: string; sortOrder?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversationFolders).set(data).where(and(eq(conversationFolders.id, id), eq(conversationFolders.userId, userId)));
}

export async function deleteFolder(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  // Unassign conversations from this folder first
  await db.update(conversations).set({ folderId: null }).where(and(eq(conversations.userId, userId), eq(conversations.folderId, id)));
  await db.delete(conversationFolders).where(and(eq(conversationFolders.id, id), eq(conversationFolders.userId, userId)));
}

export async function reorderConversations(userId: number, updates: Array<{ id: number; sortOrder: number }>) {
  const db = await getDb();
  if (!db) return;
  for (const u of updates) {
    await db.update(conversations).set({ sortOrder: u.sortOrder }).where(and(eq(conversations.id, u.id), eq(conversations.userId, userId)));
  }
}

export async function exportConversation(conversationId: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [conv] = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)));
  if (!conv) return null;
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
  return { conversation: conv, messages: msgs };
}

// ─── MESSAGE HELPERS ──────────────────────────────────────────────
export async function addMessage(data: {
  conversationId: number; userId: number; role: "user" | "assistant" | "system";
  content: string; confidenceScore?: number; complianceStatus?: "pending" | "approved" | "flagged" | "rejected"; metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(messages).values({
    ...data,
    metadata: data.metadata ? JSON.stringify(data.metadata) : undefined,
  });
  return { id: result[0].insertId };
}

export async function getConversationMessages(conversationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

// ─── DOCUMENT HELPERS ─────────────────────────────────────────────
export async function addDocument(data: {
  userId: number; filename: string; fileUrl: string; fileKey: string;
  mimeType?: string; category?: "personal_docs" | "financial_products" | "regulations" | "training_materials" | "artifacts" | "skills";
  visibility?: "private" | "professional" | "management" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(documents).values({ ...data, status: "uploading" });
  return { id: result[0].insertId };
}

export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.userId, userId)).orderBy(desc(documents.createdAt));
}

export async function getAccessibleDocuments(visibilityLevels: string[]) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(inArray(documents.visibility, visibilityLevels as any)).orderBy(desc(documents.createdAt));
}

export async function updateDocumentVisibility(id: number, userId: number, visibility: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set({ visibility: visibility as any }).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

export async function updateDocumentStatus(id: number, status: "uploading" | "processing" | "ready" | "error", extractedText?: string, chunkCount?: number) {
  const db = await getDb();
  if (!db) return;
  const update: Record<string, unknown> = { status };
  if (extractedText !== undefined) update.extractedText = extractedText;
  if (chunkCount !== undefined) update.chunkCount = chunkCount;
  await db.update(documents).set(update).where(eq(documents.id, id));
}

export async function updateDocumentCategory(id: number, category: "personal_docs" | "financial_products" | "regulations" | "training_materials" | "artifacts" | "skills") {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set({ category }).where(eq(documents.id, id));
}

export async function addDocumentChunks(chunks: Array<{ documentId: number; userId: number; content: string; chunkIndex: number; category: "personal_docs" | "financial_products" | "regulations" | "training_materials" | "artifacts" | "skills" }>) {
  const db = await getDb();
  if (!db) return;
  if (chunks.length === 0) return;
  await db.insert(documentChunks).values(chunks);
}

export async function searchDocumentChunks(userId: number, query: string, category?: string, limit = 5) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(documentChunks.userId, userId)];
  if (category) conditions.push(eq(documentChunks.category, category as any));
  const allChunks = await db.select().from(documentChunks).where(and(...conditions)).limit(100);
  // Simple keyword-based retrieval (production would use embeddings)
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const scored = allChunks.map(chunk => {
    const text = chunk.content.toLowerCase();
    const score = queryWords.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
    return { ...chunk, score };
  }).filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
  return scored;
}

export async function deleteDocument(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentChunks).where(eq(documentChunks.documentId, id));
  await db.delete(documents).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

// ─── BULK DOCUMENT OPERATIONS ─────────────────────────────────────────
export async function bulkDeleteDocuments(ids: number[], userId: number) {
  const db = await getDb();
  if (!db || ids.length === 0) return { deleted: 0 };
  await db.delete(documentChunks).where(inArray(documentChunks.documentId, ids));
  await db.delete(documents).where(and(inArray(documents.id, ids), eq(documents.userId, userId)));
  return { deleted: ids.length };
}

export async function bulkUpdateDocumentVisibility(ids: number[], userId: number, visibility: string) {
  const db = await getDb();
  if (!db || ids.length === 0) return { updated: 0 };
  await db.update(documents).set({ visibility: visibility as any }).where(and(inArray(documents.id, ids), eq(documents.userId, userId)));
  return { updated: ids.length };
}

export async function bulkUpdateDocumentCategory(ids: number[], userId: number, category: string) {
  const db = await getDb();
  if (!db || ids.length === 0) return { updated: 0 };
  await db.update(documents).set({ category: category as any }).where(and(inArray(documents.id, ids), eq(documents.userId, userId)));
  await db.update(documentChunks).set({ category: category as any }).where(inArray(documentChunks.documentId, ids));
  return { updated: ids.length };
}

export async function renameDocument(id: number, userId: number, filename: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(documents).set({ filename }).where(and(eq(documents.id, id), eq(documents.userId, userId)));
}

// ─── PRODUCT HELPERS ──────────────────────────────────────────────
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).orderBy(products.company, products.name);
}

export async function getProductsByCategory(category: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.category, category as any));
}

export async function getProductsByCompany(company: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.company, company));
}

/** Get products visible to a user: platform products + their org's products */
export async function getVisibleProducts(organizationId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (organizationId) {
    return db.select().from(products)
      .where(or(eq(products.isPlatform, true), eq(products.organizationId, organizationId)))
      .orderBy(products.isPlatform, products.company, products.name);
  }
  return db.select().from(products)
    .where(eq(products.isPlatform, true))
    .orderBy(products.company, products.name);
}

/** Get only org-specific products */
export async function getOrgProducts(organizationId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products)
    .where(and(eq(products.organizationId, organizationId), eq(products.isPlatform, false)))
    .orderBy(products.company, products.name);
}

/** Create a product (org-level or platform) */
export async function createProduct(data: {
  organizationId?: number | null;
  company: string;
  name: string;
  category: "iul" | "term_life" | "disability" | "ltc" | "premium_finance" | "whole_life" | "variable_life";
  description?: string;
  features?: unknown;
  riskLevel?: "low" | "moderate" | "moderate_high" | "high";
  minPremium?: number;
  maxPremium?: number;
  targetAudience?: string;
  isPlatform?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values({
    ...data,
    isPlatform: data.isPlatform ?? false,
  });
  return { id: result[0].insertId };
}

/** Update a product */
export async function updateProduct(id: number, data: Partial<{
  company: string;
  name: string;
  category: "iul" | "term_life" | "disability" | "ltc" | "premium_finance" | "whole_life" | "variable_life";
  description: string;
  features: unknown;
  riskLevel: "low" | "moderate" | "moderate_high" | "high";
  minPremium: number;
  maxPremium: number;
  targetAudience: string;
}>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(products).set(data).where(eq(products.id, id));
  return { success: true };
}

/** Delete a product (only non-platform) */
export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Safety: only delete non-platform products
  await db.delete(products).where(and(eq(products.id, id), eq(products.isPlatform, false)));
  return { success: true };
}

// ─── AUDIT TRAIL HELPERS ──────────────────────────────────────────
export async function addAuditEntry(data: {
  userId: number; conversationId?: number; messageId?: number; action: string;
  details?: string; complianceFlags?: unknown; piiDetected?: boolean; disclaimerAppended?: boolean;
  reviewStatus?: "auto_approved" | "pending_review" | "approved" | "rejected" | "modified";
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditTrail).values({
    ...data,
    complianceFlags: data.complianceFlags ? JSON.stringify(data.complianceFlags) : undefined,
  });
}

export async function getAuditTrail(userId?: number, limit = 50, opts?: { action?: string; since?: Date }) {
  const db = await getDb();
  if (!db) return [];
  const conditions: any[] = [];
  if (userId) conditions.push(eq(auditTrail.userId, userId));
  if (opts?.action) conditions.push(eq(auditTrail.action, opts.action));
  if (opts?.since) conditions.push(gte(auditTrail.createdAt, opts.since));
  return db.select().from(auditTrail).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(auditTrail.createdAt)).limit(limit);
}

/** Standard audit event types for consistent logging */
export const AUDIT_EVENTS = {
  AI_RESPONSE: "ai_response",
  FILE_UPLOAD: "file_upload",
  DOCUMENT_DELETE: "document_delete",
  CONSENT_GRANTED: "consent_granted",
  CONSENT_REVOKED: "consent_revoked",
  REVIEW_ACTION: "review_action",
  SUITABILITY_COMPLETE: "suitability_complete",
  MODEL_EXECUTION: "model_execution",
  PDF_EXPORT: "pdf_export",
  PROFESSIONAL_MATCH: "professional_match",
  ROLE_CHANGE: "role_change",
  LOGIN: "login",
  SETTINGS_CHANGE: "settings_change",
} as const;

// ─── REVIEW QUEUE HELPERS ─────────────────────────────────────────
export async function addToReviewQueue(data: {
  userId: number; conversationId: number; messageId: number; confidenceScore: number;
  autonomyLevel: "high" | "medium" | "low"; aiReasoning?: string; aiRecommendation?: string; complianceNotes?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(reviewQueue).values(data);
}

export async function getPendingReviews() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reviewQueue).where(eq(reviewQueue.status, "pending")).orderBy(desc(reviewQueue.createdAt));
}

export async function updateReviewStatus(id: number, status: "approved" | "rejected" | "modified", reviewedBy: number, reviewerAction?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(reviewQueue).set({ status, reviewedBy, reviewerAction, reviewedAt: new Date() }).where(eq(reviewQueue.id, id));
}

// ─── MEMORY HELPERS ───────────────────────────────────────────────
export async function addMemory(data: {
  userId: number; category: "fact" | "preference" | "goal" | "relationship" | "financial" | "temporal";
  content: string; source?: string; confidence?: number; validFrom?: Date; validUntil?: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(memories).values(data);
}

export async function getUserMemories(userId: number, category?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(memories.userId, userId)];
  if (category) conditions.push(eq(memories.category, category as any));
  return db.select().from(memories).where(and(...conditions)).orderBy(desc(memories.updatedAt));
}

export async function deleteMemory(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(memories).where(and(eq(memories.id, id), eq(memories.userId, userId)));
}

// ─── FEEDBACK HELPERS ─────────────────────────────────────────────
export async function addFeedback(data: { userId: number; messageId: number; conversationId: number; rating: "up" | "down"; comment?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(feedback).values(data);
}

export async function getFeedbackStats(userId?: number) {
  const db = await getDb();
  if (!db) return { up: 0, down: 0, total: 0 };
  const conditions = userId ? [eq(feedback.userId, userId)] : [];
  const rows = await db.select().from(feedback).where(conditions.length ? and(...conditions) : undefined);
  const up = rows.filter(r => r.rating === "up").length;
  const down = rows.filter(r => r.rating === "down").length;
  return { up, down, total: rows.length };
}

// ─── QUALITY RATING HELPERS ───────────────────────────────────────
export async function addQualityRating(data: { messageId: number; conversationId: number; score: number; reasoning?: string; improvementSuggestions?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(qualityRatings).values(data);
}

// ─── SUITABILITY HELPERS ──────────────────────────────────────────
export async function saveSuitabilityAssessment(data: {
  userId: number; riskTolerance?: "conservative" | "moderate" | "aggressive";
  investmentHorizon?: string; annualIncome?: string; netWorth?: string;
  investmentExperience?: "none" | "limited" | "moderate" | "extensive";
  financialGoals?: unknown; insuranceNeeds?: unknown; responses?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(suitabilityAssessments).values({
    ...data,
    financialGoals: data.financialGoals ? JSON.stringify(data.financialGoals) : undefined,
    insuranceNeeds: data.insuranceNeeds ? JSON.stringify(data.insuranceNeeds) : undefined,
    responses: data.responses ? JSON.stringify(data.responses) : undefined,
    completedAt: new Date(),
  });
  await updateSuitabilityStatus(data.userId, true, data);
}

export async function getUserSuitability(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(suitabilityAssessments).where(eq(suitabilityAssessments.userId, userId)).orderBy(desc(suitabilityAssessments.createdAt)).limit(1);
  return result[0];
}
