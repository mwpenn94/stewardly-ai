import crypto from "crypto";
import { eq, desc, and, or, sql, asc, inArray, like, gte, gt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { logger } from "./_core/logger";
import {
  InsertUser, users, conversations, messages, documents, documentChunks,
  products, auditTrail, reviewQueue, memories, feedback, qualityRatings,
  suitabilityAssessments, conversationFolders, documentVersions,
  documentTags, documentTagMap, knowledgeGapFeedback,
  documentAnnotations,
  aiToolExecutions, aiResponseQuality,
  type InsertAiToolExecution, type InsertAiResponseQualityEntry,
  calculatorScenarios,
} from "../drizzle/schema";
import { normalizeQualityScore } from './shared/intelligence/types';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      logger.warn( { operation: "database" },"[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/**
 * Like getDb() but throws if DB is unavailable.
 * Use in service functions that cannot meaningfully proceed without a database,
 * replacing the `return null as any` anti-pattern.
 */
export async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
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
  } catch (error) { logger.error( { operation: "database", err: error },"[Database] Failed to upsert user:", error); throw error; }
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
  // Server-side dedup: if user has a conversation created in the last 3 seconds with no messages, reuse it
  const recentEmpty = await db.select({ id: conversations.id })
    .from(conversations)
    .where(and(
      eq(conversations.userId, userId),
      gt(conversations.createdAt, new Date(Date.now() - 3000))
    ))
    .orderBy(desc(conversations.createdAt))
    .limit(1);
  if (recentEmpty.length > 0) {
    // Check if it has zero messages
    const msgCount = await db.select({ count: sql<number>`count(*)` })
      .from(messages)
      .where(eq(messages.conversationId, recentEmpty[0].id));
    if (msgCount[0]?.count === 0) {
      return { id: recentEmpty[0].id };
    }
  }
  const result = await db.insert(conversations).values({ userId, mode, title: title || "New Conversation" });
  return { id: result[0].insertId };
}

export async function getUserConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: conversations.id,
    userId: conversations.userId,
    title: conversations.title,
    mode: conversations.mode,
    pinned: conversations.pinned,
    folderId: conversations.folderId,
    createdAt: conversations.createdAt,
    updatedAt: conversations.updatedAt,
    messageCount: sql<number>`(SELECT COUNT(*) FROM \`messages\` WHERE \`messages\`.\`conversationId\` = \`conversations\`.\`id\`)`.as('messageCount'),
  }).from(conversations).where(eq(conversations.userId, userId)).orderBy(desc(conversations.updatedAt));
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
  content: string; confidenceScore?: number; complianceStatus?: "pending" | "approved" | "flagged" | "rejected"; modelVersion?: string; metadata?: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(messages).values({
    ...data,
    confidenceScore: data.confidenceScore != null ? normalizeQualityScore(data.confidenceScore) : undefined,
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
  const allChunks = await db.select().from(documentChunks).where(and(...conditions)).limit(200);

  // ── TF-IDF scoring ──────────────────────────────────────────────────
  const STOP_WORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with',
    'by','from','is','it','this','that','are','was','were','be','been',
    'has','have','had','not','no','can','will','do','does','did','may',
    'should','would','could','about','into','through','during','before',
    'after','above','below','between','out','off','over','under','again',
    'further','then','once','here','there','when','where','why','how',
    'all','each','every','both','few','more','most','other','some','such',
    'than','too','very','just','also','now','so','if','its','my','your',
  ]);

  const queryWords = query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (queryWords.length === 0) return [];

  // Build document-frequency map (how many chunks contain each word)
  const docFreq: Record<string, number> = {};
  const N = allChunks.length || 1;
  const chunkTexts = allChunks.map(c => c.content.toLowerCase());

  for (const word of queryWords) {
    docFreq[word] = chunkTexts.filter(t => t.includes(word)).length;
  }

  // Score each chunk with TF-IDF
  const scored = allChunks.map((chunk, idx) => {
    const text = chunkTexts[idx];
    const words = text.split(/\s+/);
    const totalWords = words.length || 1;

    let tfidfScore = 0;
    let exactPhraseBonus = 0;

    for (const qw of queryWords) {
      // Term frequency: count of word / total words in chunk
      const tf = words.filter(w => w.includes(qw)).length / totalWords;
      // Inverse document frequency: log(N / (df + 1))
      const idf = Math.log((N + 1) / ((docFreq[qw] || 0) + 1)) + 1;
      tfidfScore += tf * idf;
    }

    // Exact phrase match bonus (query appears as substring)
    const queryLower = query.toLowerCase();
    if (text.includes(queryLower)) {
      exactPhraseBonus = 2.0;
    } else {
      // Check for bigram matches (consecutive query words)
      for (let i = 0; i < queryWords.length - 1; i++) {
        if (text.includes(`${queryWords[i]} ${queryWords[i + 1]}`)) {
          exactPhraseBonus += 0.5;
        }
      }
    }

    // Position bonus: chunks near the beginning of a document score slightly higher
    const positionBonus = chunk.chunkIndex !== undefined && chunk.chunkIndex !== null
      ? 0.1 / (1 + (chunk.chunkIndex as number))
      : 0;

    const score = tfidfScore + exactPhraseBonus + positionBonus;
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

export async function reorderDocuments(userId: number, orderedIds: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db || orderedIds.length === 0) return { updated: 0 };
  let updated = 0;
  for (const item of orderedIds) {
    const result = await db.update(documents)
      .set({ sortOrder: item.sortOrder })
      .where(and(eq(documents.id, item.id), eq(documents.userId, userId)));
    if (result[0]?.affectedRows) updated += result[0].affectedRows;
  }
  return { updated };
}

// ─── DOCUMENT VERSION HELPERS ────────────────────────────────────
export async function addDocumentVersion(data: {
  documentId: number; userId: number; versionNumber: number;
  filename: string; fileUrl: string; fileKey: string;
  mimeType?: string; extractedText?: string; chunkCount?: number; sizeBytes?: number;
}) {
  const db = await getDb();
  if (!db) return { id: 0 };
  const [result] = await db.insert(documentVersions).values(data as any);
  return { id: result.insertId };
}

export async function getDocumentVersions(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentVersions)
    .where(and(eq(documentVersions.documentId, documentId), eq(documentVersions.userId, userId)))
    .orderBy(desc(documentVersions.versionNumber));
}

export async function getLatestVersionNumber(documentId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ maxVer: sql<number>`COALESCE(MAX(${documentVersions.versionNumber}), 0)` })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId));
  return rows[0]?.maxVer || 0;
}

export async function getDocumentProcessingStats(userId: number) {
  const db = await getDb();
  if (!db) return { total: 0, ready: 0, processing: 0, error: 0, uploading: 0, totalChunks: 0, recentUploads: 0 };
  const allDocs = await db.select({
    status: documents.status,
    chunkCount: documents.chunkCount,
    createdAt: documents.createdAt,
  }).from(documents).where(eq(documents.userId, userId));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    total: allDocs.length,
    ready: allDocs.filter(d => d.status === "ready").length,
    processing: allDocs.filter(d => d.status === "processing").length,
    error: allDocs.filter(d => d.status === "error").length,
    uploading: allDocs.filter(d => d.status === "uploading").length,
    totalChunks: allDocs.reduce((sum, d) => sum + (d.chunkCount || 0), 0),
    recentUploads: allDocs.filter(d => new Date(d.createdAt).getTime() > sevenDaysAgo).length,
  };
}

// ─── DOCUMENT TAG HELPERS ──────────────────────────────────────────────
export async function getUserTags(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentTags).where(eq(documentTags.userId, userId)).orderBy(documentTags.name);
}

export async function createTag(userId: number, name: string, color?: string, isAiGenerated = false) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentTags).values({ userId, name, color: color || "#6366f1", isAiGenerated }).$returningId();
  return result;
}

export async function deleteTag(tagId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentTagMap).where(eq(documentTagMap.tagId, tagId));
  await db.delete(documentTags).where(and(eq(documentTags.id, tagId), eq(documentTags.userId, userId)));
}

export async function updateTag(tagId: number, userId: number, data: { name?: string; color?: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentTags).set(data).where(and(eq(documentTags.id, tagId), eq(documentTags.userId, userId)));
}

export async function addTagToDocument(documentId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(documentTagMap).where(and(eq(documentTagMap.documentId, documentId), eq(documentTagMap.tagId, tagId)));
  if (existing.length > 0) return;
  await db.insert(documentTagMap).values({ documentId, tagId });
}

export async function removeTagFromDocument(documentId: number, tagId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentTagMap).where(and(eq(documentTagMap.documentId, documentId), eq(documentTagMap.tagId, tagId)));
}

export async function getDocumentTags(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  const maps = await db.select().from(documentTagMap).where(eq(documentTagMap.documentId, documentId));
  if (maps.length === 0) return [];
  const tagIds = maps.map(m => m.tagId);
  return db.select().from(documentTags).where(inArray(documentTags.id, tagIds));
}

export async function getDocumentsForTag(tagId: number) {
  const db = await getDb();
  if (!db) return [];
  const maps = await db.select().from(documentTagMap).where(eq(documentTagMap.tagId, tagId));
  return maps.map(m => m.documentId);
}

export async function bulkAddTagsToDocument(documentId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) return;
  for (const tagId of tagIds) {
    await addTagToDocument(documentId, tagId);
  }
}

// ─── KNOWLEDGE GAP FEEDBACK HELPERS ────────────────────────────────────
export async function addGapFeedback(data: { userId: number; gapId: string; gapTitle: string; gapCategory?: string; action: "dismiss" | "acknowledge" | "resolved" | "not_applicable"; userNote?: string }) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(knowledgeGapFeedback).values(data).$returningId();
  return result;
}

export async function getUserGapFeedback(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(knowledgeGapFeedback).where(eq(knowledgeGapFeedback.userId, userId)).orderBy(knowledgeGapFeedback.createdAt);
}

export async function getGapFeedbackByGapId(userId: number, gapId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(knowledgeGapFeedback).where(and(eq(knowledgeGapFeedback.userId, userId), eq(knowledgeGapFeedback.gapId, gapId)));
  return rows[0] || null;
}

// ─── PRODUCT HELPERS ─────────────────────────────────────────────────
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

function computeAuditHash(data: Record<string, unknown>, previousHash: string | null): string {
  const payload = JSON.stringify({ ...data, previousHash: previousHash || "GENESIS" });
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export async function addAuditEntry(data: {
  userId: number; conversationId?: number; messageId?: number; action: string;
  details?: string; complianceFlags?: unknown; piiDetected?: boolean; disclaimerAppended?: boolean;
  reviewStatus?: "auto_approved" | "pending_review" | "approved" | "rejected" | "modified";
}) {
  const db = await getDb();
  if (!db) return;

  // Get the hash of the most recent audit entry for chain continuity
  const [lastEntry] = await db
    .select({ entryHash: auditTrail.entryHash })
    .from(auditTrail)
    .orderBy(desc(auditTrail.id))
    .limit(1);

  const previousHash = lastEntry?.entryHash ?? null;
  const entryHash = computeAuditHash(
    { ...data, complianceFlags: data.complianceFlags ? JSON.stringify(data.complianceFlags) : undefined },
    previousHash
  );

  await db.insert(auditTrail).values({
    ...data,
    complianceFlags: data.complianceFlags ? JSON.stringify(data.complianceFlags) : undefined,
    entryHash,
    previousHash,
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
  await db.insert(reviewQueue).values({
    ...data,
    confidenceScore: normalizeQualityScore(data.confidenceScore),
  });
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
  await db.insert(memories).values({
    ...data,
    confidence: data.confidence != null ? normalizeQualityScore(data.confidence) : undefined,
  });
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
  const normalized = { ...data };
  if (normalized.score != null) normalized.score = normalizeQualityScore(normalized.score);
  await db.insert(qualityRatings).values(normalized);
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

// ─── DOCUMENT ANNOTATIONS (collaborative) ──────────────────────────────────
export async function getDocumentAnnotations(documentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documentAnnotations)
    .where(eq(documentAnnotations.documentId, documentId))
    .orderBy(asc(documentAnnotations.createdAt));
}

export async function createAnnotation(data: {
  documentId: number; userId: number; content: string;
  highlightText?: string; highlightStart?: number; highlightEnd?: number;
  annotationType?: "comment" | "highlight" | "question" | "action_item" | "ai_insight";
  parentId?: number;
}) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(documentAnnotations).values(data).$returningId();
  return result;
}

export async function resolveAnnotation(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(documentAnnotations)
    .set({ resolved: true, resolvedBy: userId, resolvedAt: new Date() })
    .where(eq(documentAnnotations.id, id));
}

export async function deleteAnnotation(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(documentAnnotations).where(eq(documentAnnotations.id, id));
}


// ─── AI TOOL EXECUTION LOGGING ─────────────────────────────────────
export async function logAiToolExecution(data: InsertAiToolExecution) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(aiToolExecutions).values(data).$returningId();
  return result;
}

export async function getAiToolExecutions(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiToolExecutions)
    .where(eq(aiToolExecutions.userId, userId))
    .orderBy(desc(aiToolExecutions.createdAt))
    .limit(limit);
}

// ─── AI RESPONSE QUALITY LOGGING ───────────────────────────────────
export async function logAiResponseQuality(data: InsertAiResponseQualityEntry) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(aiResponseQuality).values(data).$returningId();
  return result;
}

export async function getAiResponseQualityStats(userId: number, days = 30) {
  const db = await getDb();
  if (!db) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(aiResponseQuality)
    .where(and(
      eq(aiResponseQuality.userId, userId),
      gte(aiResponseQuality.createdAt, since),
    ))
    .orderBy(desc(aiResponseQuality.createdAt));
  
  const total = rows.length;
  const emptyResponses = rows.filter(r => r.responseEmpty).length;
  const avgRetries = total > 0 ? rows.reduce((sum, r) => sum + (r.retryCount || 0), 0) / total : 0;
  const avgLatency = total > 0 ? rows.reduce((sum, r) => sum + (r.latencyMs || 0), 0) / total : 0;
  const avgDisclaimers = total > 0 ? rows.reduce((sum, r) => sum + (r.disclaimerCount || 0), 0) / total : 0;

  return {
    total,
    emptyResponses,
    emptyRate: total > 0 ? emptyResponses / total : 0,
    avgRetries: Math.round(avgRetries * 100) / 100,
    avgLatencyMs: Math.round(avgLatency),
    avgDisclaimers: Math.round(avgDisclaimers * 100) / 100,
  };
}

// ─── MODEL PRESET CRUD ──────────────────────────────────────────────────────
export async function listUserModelPresets(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const { aiConfigLayers } = await import("../drizzle/schema");
  return db.select().from(aiConfigLayers)
    .where(and(eq(aiConfigLayers.layerType, "client"), eq(aiConfigLayers.entityId, userId)))
    .orderBy(desc(aiConfigLayers.updatedAt));
}

export async function createModelPreset(userId: number, preset: {
  name: string;
  description?: string;
  perspectives: string[];
  weights: Record<string, number>;
  modelPreferences?: { primary?: string; fallback?: string; synthesis?: string };
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { aiConfigLayers } = await import("../drizzle/schema");
  const config = { type: "model_preset", ...preset, createdAt: Date.now() };
  const [result] = await db.insert(aiConfigLayers).values({
    layerType: "client",
    entityId: userId,
    config,
  }).$returningId();
  return { id: result.id, ...config };
}

export async function updateModelPreset(id: number, userId: number, updates: {
  name?: string;
  description?: string;
  perspectives?: string[];
  weights?: Record<string, number>;
  modelPreferences?: { primary?: string; fallback?: string; synthesis?: string };
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const { aiConfigLayers } = await import("../drizzle/schema");
  const [existing] = await db.select().from(aiConfigLayers)
    .where(and(eq(aiConfigLayers.id, id), eq(aiConfigLayers.entityId, userId)))
    .limit(1);
  if (!existing) throw new Error("Preset not found");
  const currentConfig = (existing.config as any) || {};
  const merged = { ...currentConfig, ...updates, updatedAt: Date.now() };
  await db.update(aiConfigLayers).set({ config: merged }).where(eq(aiConfigLayers.id, id));
  return { id, ...merged };
}

export async function deleteModelPreset(id: number, userId: number) {
  const db = await getDb();
  if (!db) return { success: false };
  const { aiConfigLayers } = await import("../drizzle/schema");
  await db.delete(aiConfigLayers)
    .where(and(eq(aiConfigLayers.id, id), eq(aiConfigLayers.entityId, userId)));
  return { success: true };
}

// ─── MODEL ANALYTICS QUERIES ────────────────────────────────────────────────
export async function getModelUsageStats(userId?: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const { usageTracking } = await import("../drizzle/schema");
  const since = new Date(Date.now() - days * 86400000);
  const conditions: any[] = [gte(usageTracking.createdAt, since)];
  if (userId) conditions.push(eq(usageTracking.userId, userId));
  return db.select({
    model: usageTracking.model,
    totalQueries: sql<number>`COUNT(*)`.as("totalQueries"),
    totalInputTokens: sql<number>`COALESCE(SUM(${usageTracking.inputTokens}), 0)`.as("totalInputTokens"),
    totalOutputTokens: sql<number>`COALESCE(SUM(${usageTracking.outputTokens}), 0)`.as("totalOutputTokens"),
    totalCost: sql<string>`COALESCE(SUM(${usageTracking.estimatedCost}), 0)`.as("totalCost"),
    avgInputTokens: sql<number>`COALESCE(AVG(${usageTracking.inputTokens}), 0)`.as("avgInputTokens"),
    avgOutputTokens: sql<number>`COALESCE(AVG(${usageTracking.outputTokens}), 0)`.as("avgOutputTokens"),
  }).from(usageTracking)
    .where(and(...conditions))
    .groupBy(usageTracking.model);
}

export async function getModelUsageTimeline(userId?: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const { usageTracking } = await import("../drizzle/schema");
  const since = new Date(Date.now() - days * 86400000);
  const conditions: any[] = [gte(usageTracking.createdAt, since)];
  if (userId) conditions.push(eq(usageTracking.userId, userId));
  return db.select({
    date: sql<string>`DATE(${usageTracking.createdAt})`.as("date"),
    model: usageTracking.model,
    queries: sql<number>`COUNT(*)`.as("queries"),
    cost: sql<string>`COALESCE(SUM(${usageTracking.estimatedCost}), 0)`.as("cost"),
  }).from(usageTracking)
    .where(and(...conditions))
    .groupBy(sql`DATE(${usageTracking.createdAt})`, usageTracking.model)
    .orderBy(sql`DATE(${usageTracking.createdAt})`);
}

export async function getModelRatingSummary(userId?: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const { responseRatings } = await import("../drizzle/schema");
  const since = new Date(Date.now() - days * 86400000);
  const conditions: any[] = [gte(responseRatings.createdAt, since)];
  if (userId) conditions.push(eq(responseRatings.userId, userId));
  return db.select({
    model: responseRatings.model,
    thumbsUp: sql<number>`SUM(CASE WHEN ${responseRatings.rating} = 'thumbs_up' THEN 1 ELSE 0 END)`.as("thumbsUp"),
    thumbsDown: sql<number>`SUM(CASE WHEN ${responseRatings.rating} = 'thumbs_down' THEN 1 ELSE 0 END)`.as("thumbsDown"),
    total: sql<number>`COUNT(*)`.as("total"),
  }).from(responseRatings)
    .where(and(...conditions))
    .groupBy(responseRatings.model);
}

export async function getOperationTypeBreakdown(userId?: number, days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const { usageTracking } = await import("../drizzle/schema");
  const since = new Date(Date.now() - days * 86400000);
  const conditions: any[] = [gte(usageTracking.createdAt, since)];
  if (userId) conditions.push(eq(usageTracking.userId, userId));
  return db.select({
    operationType: usageTracking.operationType,
    count: sql<number>`COUNT(*)`.as("count"),
    totalCost: sql<string>`COALESCE(SUM(${usageTracking.estimatedCost}), 0)`.as("totalCost"),
  }).from(usageTracking)
    .where(and(...conditions))
    .groupBy(usageTracking.operationType)
    .orderBy(sql`COUNT(*) DESC`);
}


// ─── Calculator Session Persistence ──────────────────────────────────────

export async function listCalculatorSessions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: calculatorScenarios.id,
    name: calculatorScenarios.name,
    calculatorType: calculatorScenarios.calculatorType,
    createdAt: calculatorScenarios.createdAt,
    updatedAt: calculatorScenarios.updatedAt,
  }).from(calculatorScenarios)
    .where(eq(calculatorScenarios.userId, userId))
    .orderBy(desc(calculatorScenarios.updatedAt))
    .limit(50);
}

export async function getCalculatorSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(calculatorScenarios)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function saveCalculatorSession(userId: number, data: {
  name: string;
  calculatorType: string;
  inputsJson: unknown;
  resultsJson: unknown;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(calculatorScenarios).values({
    userId,
    name: data.name,
    calculatorType: data.calculatorType,
    inputsJson: data.inputsJson,
    resultsJson: data.resultsJson,
  });
  return { id: Number(result[0].insertId) };
}

export async function updateCalculatorSession(id: number, userId: number, data: {
  name?: string;
  inputsJson?: unknown;
  resultsJson?: unknown;
}) {
  const db = await getDb();
  if (!db) return;
  await db.update(calculatorScenarios)
    .set(data)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId)));
}

export async function deleteCalculatorSession(id: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(calculatorScenarios)
    .where(and(eq(calculatorScenarios.id, id), eq(calculatorScenarios.userId, userId)));
}
