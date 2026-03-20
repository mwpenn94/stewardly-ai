import { getDb } from "../db";
import { fileUploads, fileChunks, fileDerivedEnrichments } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { storagePut } from "../storage";
import crypto from "crypto";

// ─── File Upload Pipeline (6-stage) ────────────────────────────────────────
// Stage 1: uploaded → Stage 2: validated → Stage 3: parsed →
// Stage 4: enriched → Stage 5: indexed → Stage 6: complete

type FileStage = "uploaded" | "validated" | "parsed" | "enriched" | "indexed" | "complete" | "failed";
type FileCategory = "personal_docs" | "financial_products" | "regulations" | "training" | "artifacts" | "skills" | "carrier_report" | "client_data" | "compliance";

// ─── Create File Upload Record ──────────────────────────────────────────────

export async function createFileUpload(params: {
  userId: number;
  organizationId?: number;
  connectionId?: string;
  filename: string;
  mimeType?: string;
  sizeBytes?: number;
  category?: FileCategory;
  visibility?: "private" | "professional" | "management" | "admin";
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const id = crypto.randomUUID();
  await db.insert(fileUploads).values({
    id,
    userId: params.userId,
    organizationId: params.organizationId ?? null,
    connectionId: params.connectionId ?? null,
    filename: params.filename,
    mimeType: params.mimeType ?? null,
    sizeBytes: params.sizeBytes ?? null,
    stage: "uploaded",
    category: params.category ?? "personal_docs",
    visibility: params.visibility ?? "private",
  });

  return id;
}

// ─── Upload File to S3 ─────────────────────────────────────────────────────

export async function uploadFileToStorage(
  fileId: string,
  userId: number,
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const suffix = crypto.randomBytes(4).toString("hex");
  const fileKey = `${userId}-files/${filename}-${suffix}`;

  const { url } = await storagePut(fileKey, fileBuffer, mimeType);

  await db.update(fileUploads)
    .set({
      storageUrl: url,
      storageKey: fileKey,
      stage: "uploaded",
    })
    .where(eq(fileUploads.id, fileId));

  return { url, fileKey };
}

// ─── Stage Transitions ─────────────────────────────────────────────────────

export async function advanceStage(fileId: string, toStage: FileStage, error?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(fileUploads)
    .set({
      stage: toStage,
      stageError: error ?? null,
    })
    .where(eq(fileUploads.id, fileId));
}

// ─── Validate File ──────────────────────────────────────────────────────────

export async function validateFile(fileId: string): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [file] = await db.select().from(fileUploads)
    .where(eq(fileUploads.id, fileId));

  if (!file) throw new Error("File not found");

  // Validation rules
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = [
    "application/pdf", "text/csv", "text/plain",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png", "image/jpeg",
  ];

  if (file.sizeBytes && file.sizeBytes > MAX_SIZE) {
    await advanceStage(fileId, "failed", "File exceeds 50MB limit");
    return false;
  }

  if (file.mimeType && !ALLOWED_TYPES.includes(file.mimeType)) {
    await advanceStage(fileId, "failed", `Unsupported file type: ${file.mimeType}`);
    return false;
  }

  await advanceStage(fileId, "validated");
  return true;
}

// ─── Parse File into Chunks ─────────────────────────────────────────────────

export async function parseFile(fileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [file] = await db.select().from(fileUploads)
    .where(eq(fileUploads.id, fileId));

  if (!file) throw new Error("File not found");

  // For now, create a placeholder chunk — real parsing would use PDF/CSV parsers
  const chunkId = crypto.randomUUID();
  await db.insert(fileChunks).values({
    id: chunkId,
    fileId,
    chunkIndex: 0,
    content: `[Parsed content from ${file.filename}]`,
    contentType: "text",
    tokenCount: 0,
    metadata: JSON.stringify({ filename: file.filename, mimeType: file.mimeType }),
  });

  await advanceStage(fileId, "parsed");
  return { chunks: 1 };
}

// ─── Enrich File (Extract insights) ────────────────────────────────────────

export async function enrichFile(fileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [file] = await db.select().from(fileUploads)
    .where(eq(fileUploads.id, fileId));

  if (!file) throw new Error("File not found");

  // Placeholder enrichment — real implementation would use LLM to extract insights
  const enrichmentId = crypto.randomUUID();
  await db.insert(fileDerivedEnrichments).values({
    id: enrichmentId,
    fileId,
    userId: file.userId,
    enrichmentType: "financial_metric",
    extractedValue: JSON.stringify({ type: "document_processed", filename: file.filename }),
    confidence: 0.5,
    appliedToProfile: false,
  });

  await advanceStage(fileId, "enriched");
  return { enrichments: 1 };
}

// ─── Process Full Pipeline ──────────────────────────────────────────────────

export async function processFilePipeline(fileId: string) {
  try {
    const valid = await validateFile(fileId);
    if (!valid) return { success: false, stage: "validation_failed" };

    await parseFile(fileId);
    await enrichFile(fileId);
    await advanceStage(fileId, "indexed");
    await advanceStage(fileId, "complete");

    return { success: true, stage: "complete" };
  } catch (error: any) {
    await advanceStage(fileId, "failed", error.message);
    return { success: false, stage: "failed", error: error.message };
  }
}

// ─── Query Files ────────────────────────────────────────────────────────────

export async function getUserFiles(userId: number, limit = 50) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(fileUploads)
    .where(eq(fileUploads.userId, userId))
    .orderBy(desc(fileUploads.createdAt))
    .limit(limit);
}

export async function getFileChunks(fileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(fileChunks)
    .where(eq(fileChunks.fileId, fileId))
    .orderBy(fileChunks.chunkIndex);
}

export async function getFileEnrichments(fileId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.select().from(fileDerivedEnrichments)
    .where(eq(fileDerivedEnrichments.fileId, fileId));
}
