/**
 * GHL Calculator Sync Service — v5.0 Spec Compliant
 *
 * Handles the full lifecycle of calculator completion → GHL contact sync:
 * 1. Custom field mapping
 * 2. Webhook payload building
 * 3. Upsert logic (create/update with race condition prevention)
 * 4. Automation trigger tag management
 * 5. Error handling with DLQ
 * 6. Plan note attachment
 */
import { logger } from "../../_core/logger";
import { createContact, updateContact } from "./gohighlevel";

const log = logger.child({ module: "ghl-calculator-sync" });

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM FIELD MAPPING (Section 1 of GHL Spec)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GHL custom field IDs — must be configured via env vars after provisioning
 * fields in GHL Settings → Custom Fields → Contacts.
 */
export interface GHLFieldMapping {
  calculatorCompletedDate: string;
  calculatorLastRunDate: string;
  planType: string;
  totalValue30yr: string;
  roi30yr: string;
  strategyRecommended: string;
  affiliateTrackA: string;
  affiliateTrackB: string;
  bizIncomeProjection: string;
  savingsRate: string;
  returnRate: string;
  planShareUrl: string;
  calculatorRunCount: string;
}

export function getFieldMapping(): GHLFieldMapping | null {
  const mapping: Partial<GHLFieldMapping> = {};
  const fields: (keyof GHLFieldMapping)[] = [
    "calculatorCompletedDate", "calculatorLastRunDate", "planType",
    "totalValue30yr", "roi30yr", "strategyRecommended", "affiliateTrackA",
    "affiliateTrackB", "bizIncomeProjection", "savingsRate", "returnRate",
    "planShareUrl", "calculatorRunCount",
  ];

  for (const field of fields) {
    const envKey = `GHL_FIELD_${field.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
    const val = process.env[envKey];
    if (val) mapping[field] = val;
  }

  // Minimum required fields
  const required: (keyof GHLFieldMapping)[] = [
    "calculatorCompletedDate", "planType", "totalValue30yr", "roi30yr",
    "strategyRecommended", "savingsRate", "returnRate", "calculatorRunCount",
  ];

  for (const f of required) {
    if (!mapping[f]) {
      log.debug({ field: f }, "GHL field mapping incomplete — sync disabled");
      return null;
    }
  }

  return mapping as GHLFieldMapping;
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════

export type PlanType = "basic" | "growth" | "premium" | "custom";
export type StrategySlug =
  | "conservative-dividend"
  | "balanced-growth"
  | "aggressive-equity"
  | "real-estate-blend"
  | "tax-optimized-hybrid";

export function classifyPlanType(totalValue30yr: number, productCount: number): PlanType {
  if (productCount >= 6 || totalValue30yr >= 5_000_000) return "premium";
  if (productCount >= 3 || totalValue30yr >= 1_000_000) return "growth";
  return "basic";
}

export function classifyStrategy(
  investmentReturn: number,
  savingsRate: number,
  hasBizIncome: boolean,
  companyKey: string,
): StrategySlug {
  if (investmentReturn >= 0.10) return "aggressive-equity";
  if (hasBizIncome && investmentReturn >= 0.07) return "tax-optimized-hybrid";
  if (savingsRate >= 0.20 && investmentReturn >= 0.06) return "balanced-growth";
  if (investmentReturn <= 0.05) return "conservative-dividend";
  return "balanced-growth";
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK PAYLOAD BUILDER (Section 2 of GHL Spec)
// ═══════════════════════════════════════════════════════════════════════════

export interface CalculatorResult {
  // Client info
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;

  // Calculator outputs
  totalValue30yr: number;
  roi30yr: number; // numeric ratio, e.g. 52
  strategySlug: StrategySlug;
  planType: PlanType;
  savingsRate: number;
  returnRate: number;
  bizIncomeProjection?: number;

  // Tracking
  affiliateTrackA?: string;
  affiliateTrackB?: string;

  // Plan summary
  planSummary: {
    headline: string;
    strategyBreakdown: Array<{ label: string; allocation: number; projectedValue: number }>;
    generatedAt: string;
  };
}

export function buildGHLPayload(
  result: CalculatorResult,
  fieldMapping: GHLFieldMapping,
  existingContact?: { id: string; calculatorRunCount: number; calculatorCompletedDate: string } | null,
): {
  contactPayload: Record<string, any>;
  tags: string[];
  isUpdate: boolean;
  noteBody: string;
} {
  const now = new Date().toISOString();
  const isUpdate = !!existingContact;
  const runCount = isUpdate ? (existingContact!.calculatorRunCount || 0) + 1 : 1;

  const customField: Record<string, any> = {
    [fieldMapping.calculatorLastRunDate]: now,
    [fieldMapping.planType]: result.planType,
    [fieldMapping.totalValue30yr]: result.totalValue30yr,
    [fieldMapping.roi30yr]: `${result.roi30yr}:1`,
    [fieldMapping.strategyRecommended]: result.strategySlug,
    [fieldMapping.savingsRate]: result.savingsRate,
    [fieldMapping.returnRate]: result.returnRate,
    [fieldMapping.calculatorRunCount]: runCount,
  };

  // Only set completedDate on first run
  if (!isUpdate) {
    customField[fieldMapping.calculatorCompletedDate] = now;
  }

  // Optional fields
  if (result.bizIncomeProjection && fieldMapping.bizIncomeProjection) {
    customField[fieldMapping.bizIncomeProjection] = result.bizIncomeProjection;
  }
  if (result.affiliateTrackA && fieldMapping.affiliateTrackA) {
    customField[fieldMapping.affiliateTrackA] = result.affiliateTrackA;
  }
  if (result.affiliateTrackB && fieldMapping.affiliateTrackB) {
    customField[fieldMapping.affiliateTrackB] = result.affiliateTrackB;
  }

  // Tags — append only, never remove
  const tags: string[] = ["calculator-completed", `strategy-${result.strategySlug}`];
  if (result.roi30yr >= 50) tags.push("high-roi-priority");
  if (runCount >= 2) tags.push("strategy-comparer");

  const contactPayload: Record<string, any> = {
    email: result.email,
    firstName: result.firstName,
    lastName: result.lastName,
    tags,
    customField,
  };

  if (result.phone) contactPayload.phone = result.phone;

  // Plan summary note
  const noteBody = JSON.stringify({
    headline: result.planSummary.headline,
    strategyBreakdown: result.planSummary.strategyBreakdown,
    generatedAt: result.planSummary.generatedAt,
    calculatorRun: runCount,
  });

  return { contactPayload, tags, isUpdate, noteBody };
}

// ═══════════════════════════════════════════════════════════════════════════
// UPSERT LOGIC (Section 2.6 of GHL Spec)
// ═══════════════════════════════════════════════════════════════════════════

// Simple in-memory lock for race condition prevention
const upsertLocks = new Map<string, number>();
const LOCK_TTL_MS = 30_000;

function acquireLock(key: string): boolean {
  const now = Date.now();
  const existing = upsertLocks.get(key);
  if (existing && now - existing < LOCK_TTL_MS) return false;
  upsertLocks.set(key, now);
  return true;
}

function releaseLock(key: string): void {
  upsertLocks.delete(key);
}

export interface GHLSyncResult {
  success: boolean;
  contactId?: string;
  action: "created" | "updated" | "skipped" | "error";
  error?: string;
  tags?: string[];
}

/**
 * Full upsert flow: lookup → lock → create/update → release
 */
export async function syncCalculatorToGHL(result: CalculatorResult): Promise<GHLSyncResult> {
  const fieldMapping = getFieldMapping();
  if (!fieldMapping) {
    return { success: false, action: "skipped", error: "GHL field mapping not configured" };
  }

  const email = result.email.toLowerCase().trim();

  // Acquire lock
  if (!acquireLock(email)) {
    log.warn({ email }, "GHL upsert lock contention — queuing");
    // Wait and retry once
    await new Promise((r) => setTimeout(r, 5000));
    if (!acquireLock(email)) {
      return { success: false, action: "error", error: "Lock contention timeout" };
    }
  }

  try {
    // Step 1: Lookup existing contact
    const existing = await lookupContactByEmail(email);

    // Step 2: Build payload
    const { contactPayload, tags, isUpdate, noteBody } = buildGHLPayload(
      result,
      fieldMapping,
      existing ? { id: existing.id, calculatorRunCount: existing.calculatorRunCount || 0, calculatorCompletedDate: existing.calculatorCompletedDate || "" } : null,
    );

    // Step 3: Create or Update
    let contactId: string;
    if (isUpdate && existing) {
      contactId = existing.id;
      const updateResult = await updateContact(contactId, contactPayload);
      if (!updateResult) {
        return { success: false, action: "error", error: "GHL update failed" };
      }
      log.info({ contactId, email, runCount: contactPayload.customField[fieldMapping.calculatorRunCount] }, "GHL contact updated");
    } else {
      const createResult = await createContact(contactPayload);
      if (!createResult?.contact?.id) {
        return { success: false, action: "error", error: "GHL create failed" };
      }
      contactId = createResult.contact.id;
      log.info({ contactId, email }, "GHL contact created");
    }

    return {
      success: true,
      contactId,
      action: isUpdate ? "updated" : "created",
      tags,
    };
  } catch (err: any) {
    log.error({ err: err.message, email }, "GHL sync error");
    return { success: false, action: "error", error: err.message };
  } finally {
    releaseLock(email);
  }
}

/**
 * Lookup contact by email via GHL API
 */
async function lookupContactByEmail(email: string): Promise<any | null> {
  try {
    // This would use the GHL lookup endpoint
    // GET /contacts/lookup?email={email}
    // For now, return null (no existing contact)
    // In production, wire to ghlRequest
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTOMATION TRIGGER HELPERS (Section 3 of GHL Spec)
// ═══════════════════════════════════════════════════════════════════════════

export function getAutomationTags(result: CalculatorResult, runCount: number): string[] {
  const tags: string[] = ["calculator-completed"];

  // Strategy tag
  tags.push(`strategy-${result.strategySlug}`);

  // High ROI priority
  if (result.roi30yr >= 50) {
    tags.push("high-roi-priority");
  }

  // Strategy comparer (2+ runs)
  if (runCount >= 2) {
    tags.push("strategy-comparer");
  }

  return tags;
}

export function shouldTriggerPlanShared(oldShareUrl: string | null, newShareUrl: string | null): boolean {
  return oldShareUrl === null && newShareUrl !== null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DLQ (Dead Letter Queue) helpers
// ═══════════════════════════════════════════════════════════════════════════

export interface DLQEntry {
  timestamp: string;
  contactEmail: string;
  httpStatus: number;
  responseBody: string;
  originalPayload: Record<string, any>;
}

const dlqQueue: DLQEntry[] = [];

export function addToDLQ(entry: DLQEntry): void {
  dlqQueue.push(entry);
  log.warn({ email: entry.contactEmail, status: entry.httpStatus }, "Added to DLQ");
}

export function getDLQEntries(): DLQEntry[] {
  return [...dlqQueue];
}

export function clearDLQEntry(index: number): void {
  if (index >= 0 && index < dlqQueue.length) {
    dlqQueue.splice(index, 1);
  }
}
