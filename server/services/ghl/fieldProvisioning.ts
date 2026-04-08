/**
 * GHL custom field provisioning — Phase 3B of the integration spec.
 *
 * Provisions all 12 required fields on a GHL location and stores the
 * returned field IDs in the existing `integration_field_mappings` table
 * so downstream webhook payloads can look up the live GHL field IDs
 * without re-calling the API on every completion.
 *
 * Field definitions per spec Section 1.1:
 *
 *  | Field                    | Type     | Required |
 *  |--------------------------|----------|----------|
 *  | calculatorCompletedDate  | Date     | Yes      |
 *  | calculatorLastRunDate    | Date     | Yes      |
 *  | planType                 | Dropdown | Yes      |
 *  | totalValue30yr           | Number   | Yes      |
 *  | roi30yr                  | Text     | Yes      |
 *  | strategyRecommended      | Dropdown | Yes      |
 *  | affiliateTrackA          | Text     | No       |
 *  | affiliateTrackB          | Text     | No       |
 *  | bizIncomeProjection      | Number   | No       |
 *  | savingsRate              | Number   | Yes      |
 *  | returnRate               | Number   | Yes      |
 *  | planShareUrl             | Text     | Cond.    |
 *  | calculatorRunCount       | Number   | Yes      |
 *
 * The spec lists 12 fields in the body but 13 rows including the
 * conditional `planShareUrl`. We provision all 13 so the mapping is
 * complete.
 */

import { getDb } from "../../db";
import { integrationFieldMappings } from "../../../drizzle/schema";
import { and, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { loadGHLConfig, ensureFreshToken, buildHeaders } from "./ghlClient";
import { logger } from "../../_core/logger";

export type FieldType = "DATE" | "TEXT" | "NUMERICAL" | "DROPDOWN";

export interface RequiredField {
  slug: string; // camelCase identifier used in payloads
  label: string; // human readable label shown in GHL UI
  type: FieldType;
  required: boolean;
  options?: string[]; // for DROPDOWN types
}

export const REQUIRED_FIELDS: RequiredField[] = [
  { slug: "calculatorCompletedDate", label: "Calculator Completed Date", type: "DATE", required: true },
  { slug: "calculatorLastRunDate", label: "Calculator Last Run Date", type: "DATE", required: true },
  {
    slug: "planType",
    label: "Plan Type",
    type: "DROPDOWN",
    required: true,
    options: ["basic", "growth", "premium", "custom"],
  },
  { slug: "totalValue30yr", label: "Total Value 30yr", type: "NUMERICAL", required: true },
  { slug: "roi30yr", label: "ROI 30yr", type: "TEXT", required: true },
  {
    slug: "strategyRecommended",
    label: "Strategy Recommended",
    type: "DROPDOWN",
    required: true,
    options: [
      "conservative-dividend",
      "balanced-growth",
      "aggressive-equity",
      "real-estate-blend",
      "tax-optimized-hybrid",
    ],
  },
  { slug: "affiliateTrackA", label: "Affiliate Track A", type: "TEXT", required: false },
  { slug: "affiliateTrackB", label: "Affiliate Track B", type: "TEXT", required: false },
  { slug: "bizIncomeProjection", label: "Biz Income Projection", type: "NUMERICAL", required: false },
  { slug: "savingsRate", label: "Savings Rate", type: "NUMERICAL", required: true },
  { slug: "returnRate", label: "Return Rate", type: "NUMERICAL", required: true },
  { slug: "planShareUrl", label: "Plan Share URL", type: "TEXT", required: false },
  { slug: "calculatorRunCount", label: "Calculator Run Count", type: "NUMERICAL", required: true },
];

export type FieldIdMap = Record<string, string>;

// ─── Provisioning ──────────────────────────────────────────────────────────

const GHL_V2_CUSTOM_FIELDS_URL =
  "https://services.leadconnectorhq.com/locations/"; // + {locationId}/customFields

/**
 * Provision every required field on the given GHL location. Idempotent:
 * if a field with a matching slug already exists in the field-mapping
 * table we skip the API call and reuse the stored ID. Returns the full
 * slug → GHL field-id map so the caller can stash it wherever it needs.
 */
export async function provisionFields(
  connectionId: string,
  locationId: string,
): Promise<FieldIdMap> {
  const cfg = await loadGHLConfig(connectionId);
  if (!cfg) throw new Error(`GHL connection ${connectionId} not found`);
  const fresh = await ensureFreshToken(cfg);
  const headers = buildHeaders(fresh, `provision-${connectionId}-${Date.now()}`);

  const db = await getDb();
  const existingMap: FieldIdMap = {};
  if (db) {
    const existingRows = await db
      .select()
      .from(integrationFieldMappings)
      .where(eq(integrationFieldMappings.connectionId, connectionId));
    for (const row of existingRows) {
      existingMap[row.externalField] = row.internalField;
    }
  }

  const result: FieldIdMap = { ...existingMap };

  for (const field of REQUIRED_FIELDS) {
    if (result[field.slug]) continue; // already provisioned

    const body = {
      name: field.label,
      dataType: field.type,
      position: 0,
      options: field.options,
    };
    const url = `${GHL_V2_CUSTOM_FIELDS_URL}${locationId}/customFields`;
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      logger.error(
        { field: field.slug, status: resp.status, text },
        "GHL field provisioning failed",
      );
      continue;
    }
    const json = (await resp.json()) as { id?: string; customField?: { id: string } };
    const id = json.customField?.id || json.id;
    if (!id) {
      logger.warn({ field: field.slug, json }, "GHL field provisioning returned no id");
      continue;
    }
    result[field.slug] = id;

    // Persist the mapping so subsequent calls don't re-provision.
    if (db) {
      await db.insert(integrationFieldMappings).values({
        id: randomUUID(),
        connectionId,
        externalField: field.slug,
        internalTable: "wealth_engine_payload",
        internalField: id, // abusing internalField to hold the GHL id
        transform: "direct",
        isActive: true,
      });
    }
  }

  return result;
}

/**
 * Read the current field-id map for a connection from the DB without
 * hitting GHL. Used by the calculator completion webhook to look up the
 * live field IDs at send time.
 */
export async function getFieldMap(
  connectionId: string,
): Promise<FieldIdMap> {
  const db = await getDb();
  if (!db) return {};
  const rows = await db
    .select()
    .from(integrationFieldMappings)
    .where(
      and(
        eq(integrationFieldMappings.connectionId, connectionId),
        eq(integrationFieldMappings.isActive, true),
      ),
    );
  const map: FieldIdMap = {};
  for (const r of rows) map[r.externalField] = r.internalField;
  return map;
}

/**
 * Health check: return the subset of required fields that are NOT yet
 * mapped. The admin monitoring dashboard (Phase 3E) uses this to flag
 * provisioning drift.
 */
export async function getUnmappedFields(
  connectionId: string,
): Promise<RequiredField[]> {
  const map = await getFieldMap(connectionId);
  return REQUIRED_FIELDS.filter((f) => !map[f.slug]);
}
