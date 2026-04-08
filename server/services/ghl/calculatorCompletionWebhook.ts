/**
 * Calculator completion webhook — Phase 3C.
 *
 * Invoked whenever a wealth-engine computation completes for a user
 * that is linked to a GHL contact. Builds the custom-field payload
 * from the engine result, upserts the GHL contact, and hands off to
 * the automation-trigger layer (Phase 3D).
 *
 * The caller can be either:
 *  - a tRPC procedure (user finished a calculator in the UI)
 *  - the agent orchestrator (engine ran via a ReAct chain)
 *  - a scheduled job (monthly recomputation)
 *
 * All three paths converge here so there is exactly one place where
 * the Stewardly → GHL mapping lives.
 */

import { logger } from "../../_core/logger";
import {
  upsertContact,
  loadGHLConfig,
  validateContactPayload,
  type GHLContactPayload,
} from "./ghlClient";
import { getFieldMap } from "./fieldProvisioning";

export interface CalculatorCompletionInput {
  connectionId: string; // integration_connections.id for the GHL location
  locationId: string;
  contact: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string; // E.164
  };
  computation: {
    id: string; // Stewardly runId (e.g. modelRuns.id)
    tool: string; // e.g. "he.simulate"
    timestamp: string; // ISO 8601
    hasBizIncome: boolean;
    input: Record<string, unknown>;
    result: {
      totalValueAt30?: number;
      roiAt30?: number;
      recommendedStrategy?: string;
      bizAnnualIncome?: number;
      savingsRate?: number;
      returnRate?: number;
      planType?: string;
    };
  };
  runCount: number; // total calculator runs for this contact
}

/**
 * Derive the GHL planType dropdown value from the engine result.
 * Falls back to "basic" if the engine didn't classify.
 */
export function derivePlanType(
  result: CalculatorCompletionInput["computation"]["result"],
): "basic" | "growth" | "premium" | "custom" {
  if (result.planType === "basic" || result.planType === "growth" || result.planType === "premium" || result.planType === "custom") {
    return result.planType;
  }
  const total = result.totalValueAt30 ?? 0;
  if (total >= 5_000_000) return "premium";
  if (total >= 1_000_000) return "growth";
  if (total > 0) return "basic";
  return "custom";
}

/**
 * Build the GHL contact payload from a completion input + field map.
 * Pure function so it's unit-testable without hitting the network.
 */
export function buildCompletionPayload(
  input: CalculatorCompletionInput,
  fieldIds: Record<string, string>,
): GHLContactPayload {
  const { contact, computation } = input;
  const tags = [
    "calculator-completed",
    computation.result.recommendedStrategy
      ? `strategy-${computation.result.recommendedStrategy}`
      : "strategy-unspecified",
    computation.hasBizIncome ? "business-owner" : "client-only",
  ];

  const customField: Record<string, string | number | null | undefined> = {};
  const set = (slug: string, value: string | number | null | undefined) => {
    const ghlId = fieldIds[slug];
    if (ghlId && value !== undefined) customField[ghlId] = value;
  };

  set("calculatorCompletedDate", computation.timestamp);
  set("calculatorLastRunDate", computation.timestamp);
  set("planType", derivePlanType(computation.result));
  set("totalValue30yr", computation.result.totalValueAt30);
  set(
    "roi30yr",
    computation.result.roiAt30 != null
      ? `${Math.round(computation.result.roiAt30 * 10) / 10}:1`
      : undefined,
  );
  set("strategyRecommended", computation.result.recommendedStrategy);
  set("bizIncomeProjection", computation.result.bizAnnualIncome);
  set("savingsRate", computation.result.savingsRate);
  set("returnRate", computation.result.returnRate);
  set("calculatorRunCount", input.runCount);

  return {
    locationId: input.locationId,
    email: contact.email,
    firstName: contact.firstName,
    lastName: contact.lastName,
    phone: contact.phone,
    tags,
    customField,
  };
}

/**
 * Full send pipeline. Validates → loads field map → builds payload →
 * upserts contact → returns the GHL contact id for Phase 3D trigger
 * evaluation.
 */
export async function onCalculatorCompletion(
  input: CalculatorCompletionInput,
): Promise<{
  contactId: string;
  status: "created" | "updated" | "skipped" | "error";
  error?: string;
}> {
  try {
    const cfg = await loadGHLConfig(input.connectionId);
    if (!cfg) {
      logger.warn(
        { connectionId: input.connectionId },
        "GHL connection not found — skipping calculator completion webhook",
      );
      return { contactId: "", status: "skipped", error: "no_connection" };
    }
    const fieldIds = await getFieldMap(input.connectionId);
    const payload = buildCompletionPayload(input, fieldIds);

    const validation = validateContactPayload(payload);
    if (!validation.ok) {
      logger.warn(
        { errors: validation.errors, input: input.computation.id },
        "GHL payload validation failed",
      );
      return {
        contactId: "",
        status: "error",
        error: validation.errors.join("; "),
      };
    }

    const idempotencyKey = `${input.computation.id}-${input.computation.timestamp}`;
    const res = await upsertContact(cfg, payload, idempotencyKey);
    return { contactId: res.contactId, status: res.status };
  } catch (err) {
    logger.error(
      { err, input: input.computation.id },
      "onCalculatorCompletion failed",
    );
    return {
      contactId: "",
      status: "error",
      error: err instanceof Error ? err.message : "unknown",
    };
  }
}

// ─── Run counter helper ────────────────────────────────────────────────────
// The spec wants an incrementing calculatorRunCount custom field. We
// derive this in-memory by counting persisted runs for the given user
// via the orchestrator's persistence layer. This helper lets the
// caller compute the count without tightly coupling to modelRuns.

import { getDb } from "../../db";
import { modelOutputRecords, analyticalModels } from "../../../drizzle/schema";
import { and, eq, like } from "drizzle-orm";

export async function getRunCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const models = await db
    .select({ id: analyticalModels.id })
    .from(analyticalModels)
    .where(like(analyticalModels.slug, "wealth-engine.%"));
  if (models.length === 0) return 0;
  const modelIds = models.map((m) => m.id);

  let total = 0;
  for (const modelId of modelIds) {
    const rows = await db
      .select({ id: modelOutputRecords.id })
      .from(modelOutputRecords)
      .where(
        and(
          eq(modelOutputRecords.modelId, modelId),
          eq(modelOutputRecords.entityId, userId),
        ),
      );
    total += rows.length;
  }
  return total;
}
