/**
 * Import Orchestrator — Parse → validate → normalize PII → dedupe → import
 */
import { getDb } from "../../db";
import { logger } from "../../_core/logger";
import { hashEmail, hashPhone } from "../pii/piiHasher";

const log = logger.child({ module: "importOrchestrator" });

export interface ImportResult {
  jobId: number;
  totalRecords: number;
  imported: number;
  skipped: number;
  failed: number;
  updated: number;
}

export async function startImport(params: {
  importSource: string;
  fileName: string;
  records: Array<Record<string, string>>;
  fieldMapping: Record<string, string>;
  importedBy: number;
  options?: { enrichAfter?: boolean; scoreAfter?: boolean; syncToGhl?: boolean };
}): Promise<ImportResult> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const { importJobs, leadPipeline } = await import("../../../drizzle/schema");

  // Create import job
  const [job] = await db.insert(importJobs).values({
    importSource: params.importSource as any,
    fileName: params.fileName,
    totalRecords: params.records.length,
    status: "importing" as any,
    importedBy: params.importedBy,
    fieldMapping: params.fieldMapping as any,
    startedAt: new Date(),
  }).$returningId();

  let imported = 0, skipped = 0, failed = 0, updated = 0;

  for (const record of params.records) {
    try {
      const mapped = applyMapping(record, params.fieldMapping);
      if (!mapped.email) { skipped++; continue; }

      // Validate + sanitize (CSV injection protection)
      const sanitized = sanitizeRecord(mapped);
      const emailH = hashEmail(sanitized.email);
      const phoneH = sanitized.phone ? hashPhone(sanitized.phone) : null;

      // Dedupe check
      const { eq } = await import("drizzle-orm");
      const existing = await db.select().from(leadPipeline).where(eq(leadPipeline.emailHash, emailH)).limit(1);

      if (existing.length > 0) {
        updated++;
      } else {
        await db.insert(leadPipeline).values({
          leadSourceId: null,
          firstName: sanitized.firstName || null,
          lastName: sanitized.lastName || null,
          emailHash: emailH,
          phoneHash: phoneH,
          linkedinUrl: sanitized.linkedinUrl || null,
          company: sanitized.company || null,
          title: sanitized.title || null,
          city: sanitized.city || null,
          state: sanitized.state || null,
          zip: sanitized.zip || null,
        });
        imported++;
      }
    } catch (e: any) {
      failed++;
      log.warn({ error: e.message }, "Record import failed");
    }
  }

  // Update job
  await db.update(importJobs)
    .set({ recordsImported: imported, recordsSkipped: skipped, recordsFailed: failed, recordsUpdated: updated, status: "complete" as any, completedAt: new Date() })
    .where((await import("drizzle-orm")).eq(importJobs.id, job.id));

  log.info({ jobId: job.id, imported, skipped, failed, updated }, "Import completed");

  return { jobId: job.id, totalRecords: params.records.length, imported, skipped, failed, updated };
}

function applyMapping(record: Record<string, string>, mapping: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [source, target] of Object.entries(mapping)) {
    if (record[source]) result[target] = record[source];
  }
  return result;
}

function sanitizeRecord(record: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    // CSV injection protection: strip leading =, +, -, @, |, \t, \r
    let clean = value;
    if (/^[=+\-@|\t\r]/.test(clean)) clean = "'" + clean;
    sanitized[key] = clean.trim();
  }
  return sanitized;
}
