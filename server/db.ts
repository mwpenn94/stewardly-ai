import { eq, desc, and, sql, asc, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, conversations, messages, documents, documentChunks,
  products, auditTrail, reviewQueue, memories, feedback, qualityRatings,
  suitabilityAssessments
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
    if (user.globalRole !== undefined) { values.globalRole = user.globalRole; updateSet.globalRole = user.globalRole; }
    else if (user.openId === ENV.ownerOpenId) { values.globalRole = 'global_admin'; updateSet.globalRole = 'global_admin'; }
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

export async function getAuditTrail(userId?: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const conditions = userId ? [eq(auditTrail.userId, userId)] : [];
  return db.select().from(auditTrail).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(auditTrail.createdAt)).limit(limit);
}

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
