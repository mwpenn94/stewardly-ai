/**
 * Dynamic Integration — Blueprint Executor
 *
 * End-to-end runner for a BlueprintDefinition:
 *
 *   fetch → parse → extract records → transform → validate → sink → record run
 *
 * Wraps every phase in try/catch and records counters on integrationBlueprintRuns
 * so every run produces an auditable row. Supports dry-run (skips sink write).
 */

import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../../db";
import {
  integrationBlueprintRuns,
  integrationBlueprintSamples,
  integrationConnections,
} from "../../../drizzle/schema";
import { decryptCredentials } from "../encryption";
import {
  probeBody,
  parseDelimited,
  parseHtmlFirstTable,
  parseHtmlJsonLd,
  parseJson,
  parseNdjson,
  parseRssOrAtom,
  type RawFormat,
} from "./sourceProber";
import { inferSchema, schemaToPersisted } from "./schemaInference";
import { runPipeline, type Record_ } from "./transformEngine";
import { dispatchToSink, type SinkWriteResult } from "./sinkDispatcher";
import { recordRunStats } from "./blueprintRegistry";
import type { BlueprintDefinition, BlueprintRunSummary } from "./types";

const MAX_RESPONSE_BYTES = 5_000_000; // 5 MB ceiling on fetch body.

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db;
}

function nowMs(): number {
  return Date.now();
}

/**
 * Resolve credentials for a blueprint's auth config. Returns the decrypted
 * credential record or null if no auth is required / available.
 */
async function resolveCreds(blueprint: BlueprintDefinition): Promise<Record<string, unknown> | null> {
  const auth = blueprint.authConfig;
  if (!auth || auth.kind === "none") return null;
  if (!auth.connectionId) return null;

  const db = await requireDb();
  const [conn] = await db
    .select()
    .from(integrationConnections)
    .where(eq(integrationConnections.id, auth.connectionId))
    .limit(1);
  const row = conn as unknown as { credentialsEncrypted: string | null } | undefined;
  if (!row?.credentialsEncrypted) return null;
  try {
    return decryptCredentials(row.credentialsEncrypted);
  } catch {
    return null;
  }
}

/** Build the Fetch URL + options from source + auth config. */
function buildRequest(
  blueprint: BlueprintDefinition,
  creds: Record<string, unknown> | null,
): { url: string; init: RequestInit } | null {
  const source = blueprint.sourceConfig;
  if (!source.url) return null;
  const url = new URL(source.url);
  const headers = new Headers(source.headers ?? {});
  const queryParams = new URLSearchParams(source.queryParams ?? {});

  const auth = blueprint.authConfig;
  const credsObj = (creds ?? {}) as Record<string, string | undefined>;
  const apiKey = credsObj.api_key ?? credsObj.apiKey ?? credsObj.access_token ?? credsObj.token;

  if (auth) {
    switch (auth.kind) {
      case "api_key_query":
        if (auth.paramName && apiKey) queryParams.set(auth.paramName, String(apiKey));
        break;
      case "api_key_header":
        if (auth.paramName && apiKey) headers.set(auth.paramName, String(apiKey));
        break;
      case "bearer":
        if (apiKey) headers.set("Authorization", `Bearer ${apiKey}`);
        break;
      case "basic": {
        const user = credsObj[auth.usernameParam ?? "username"] ?? "";
        const pass = credsObj[auth.passwordParam ?? "password"] ?? "";
        if (user) {
          const encoded = Buffer.from(`${user}:${pass}`).toString("base64");
          headers.set("Authorization", `Basic ${encoded}`);
        }
        break;
      }
      default:
        break;
    }
  }

  queryParams.forEach((v, k) => url.searchParams.set(k, v));

  if (!headers.has("Accept")) headers.set("Accept", "application/json, */*;q=0.8");
  if (!headers.has("User-Agent")) headers.set("User-Agent", "Stewardly-Blueprint/1.0");

  const init: RequestInit = {
    method: source.method ?? "GET",
    headers,
    signal: AbortSignal.timeout(30_000),
  };
  if (init.method === "POST" && source.body) init.body = source.body;
  return { url: url.toString(), init };
}

/** Fetch the raw source body; returns null + warning on failure. */
async function fetchSource(
  blueprint: BlueprintDefinition,
): Promise<{ body: string; contentType: string; status: number } | { error: string }> {
  // Inline samples skip the network entirely.
  const inline = blueprint.sourceConfig.inlineSample;
  if (inline) {
    return { body: inline, contentType: "text/plain", status: 200 };
  }
  const creds = await resolveCreds(blueprint);
  const req = buildRequest(blueprint, creds);
  if (!req) return { error: "blueprint source URL is missing" };
  try {
    const response = await fetch(req.url, req.init);
    const contentType = response.headers.get("content-type") ?? "";
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      return { error: `response too large (${buffer.byteLength} bytes > ${MAX_RESPONSE_BYTES})` };
    }
    const body = Buffer.from(buffer).toString("utf-8");
    return { body, contentType, status: response.status };
  } catch (e: unknown) {
    return { error: (e as Error).message || "fetch failed" };
  }
}

/** Parse the raw body according to the blueprint's extraction config. */
function extractRecords(
  body: string,
  contentType: string,
  blueprint: BlueprintDefinition,
): { records: Record_[]; format: RawFormat; warnings: string[] } {
  const extraction = blueprint.extractionConfig;
  const hint = extraction.formatHint ?? "auto";

  let records: Record_[] = [];
  let warnings: string[] = [];
  let format: RawFormat = "unknown";

  if (hint === "auto") {
    const probe = probeBody(body, contentType);
    records = probe.records as Record_[];
    format = probe.detectedFormat;
    warnings = probe.notes;
  } else {
    switch (hint) {
      case "json": {
        const r = parseJson(body);
        records = r.records as Record_[];
        warnings = r.warnings;
        format = "json";
        break;
      }
      case "ndjson": {
        const r = parseNdjson(body);
        records = r.records as Record_[];
        warnings = r.warnings;
        format = "ndjson";
        break;
      }
      case "csv":
      case "tsv": {
        const r = parseDelimited(body, hint === "tsv" ? "\t" : undefined);
        records = r.records as Record_[];
        warnings = r.warnings;
        format = hint as RawFormat;
        break;
      }
      case "rss":
      case "atom": {
        const r = parseRssOrAtom(body);
        records = r.records as Record_[];
        warnings = r.warnings;
        format = hint as RawFormat;
        break;
      }
      case "html": {
        if (extraction.htmlStrategy === "jsonld") {
          const r = parseHtmlJsonLd(body);
          records = r.records as Record_[];
          warnings = r.warnings;
        } else if (extraction.htmlStrategy === "table") {
          const r = parseHtmlFirstTable(body);
          records = r.records as Record_[];
          warnings = r.warnings;
        } else {
          // auto: prefer JSON-LD, fall back to table
          const jsonLd = parseHtmlJsonLd(body);
          if (jsonLd.records.length > 0) {
            records = jsonLd.records as Record_[];
            warnings = jsonLd.warnings;
          } else {
            const table = parseHtmlFirstTable(body);
            records = table.records as Record_[];
            warnings = table.warnings;
          }
        }
        format = "html";
        break;
      }
    }
  }

  // Apply recordsPath dot-path if supplied.
  if (extraction.recordsPath && records.length === 1) {
    const only = records[0];
    const nested = readPath(only, extraction.recordsPath);
    if (Array.isArray(nested)) {
      records = nested.filter((r) => r && typeof r === "object" && !Array.isArray(r)) as Record_[];
    }
  }
  if (extraction.skipRows && extraction.skipRows > 0) {
    records = records.slice(extraction.skipRows);
  }
  const cap = Math.min(
    extraction.maxRecords ?? Number.POSITIVE_INFINITY,
    blueprint.maxRecordsPerRun ?? Number.POSITIVE_INFINITY,
  );
  if (Number.isFinite(cap) && records.length > cap) {
    warnings.push(`truncated to maxRecords=${cap}`);
    records = records.slice(0, cap);
  }
  return { records, format, warnings };
}

function readPath(obj: Record_, path: string): unknown {
  const segments = path.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (cur === null || cur === undefined) return undefined;
    if (typeof cur !== "object") return undefined;
    cur = (cur as Record_)[seg];
  }
  return cur;
}

/** Execute a single blueprint run end-to-end. */
export async function executeBlueprint(
  blueprint: BlueprintDefinition,
  options: {
    dryRun: boolean;
    triggeredBy?: number | null;
    triggerSource?: "manual" | "schedule" | "webhook" | "api";
  } = { dryRun: false },
): Promise<BlueprintRunSummary> {
  const runId = randomUUID();
  const startedAt = nowMs();
  const warnings: string[] = [];
  let status: BlueprintRunSummary["status"] = "running";
  let recordsFetched = 0;
  let recordsParsed = 0;
  let recordsTransformed = 0;
  let recordsValidated = 0;
  let recordsWritten = 0;
  let recordsSkipped = 0;
  let recordsErrored = 0;
  let errorMessage: string | null = null;
  let sinkResult: SinkWriteResult | null = null;
  let sampleOut: Record_[] = [];

  const db = await requireDb();
  await db.insert(integrationBlueprintRuns).values({
    id: runId,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.currentVersion,
    triggeredBy: options.triggeredBy ?? null,
    triggerSource: options.triggerSource ?? "manual",
    dryRun: options.dryRun,
    status: "running",
    startedAt,
  } as never);

  try {
    // 1. Fetch
    const fetched = await fetchSource(blueprint);
    if ("error" in fetched) {
      errorMessage = fetched.error;
      throw new Error(fetched.error);
    }
    recordsFetched = fetched.body.length;

    // 2. Extract
    const extracted = extractRecords(fetched.body, fetched.contentType, blueprint);
    recordsParsed = extracted.records.length;
    warnings.push(...extracted.warnings);

    // 3. Transform
    const { accepted, rejected } = runPipeline(extracted.records, blueprint.transformSteps ?? []);
    recordsTransformed = accepted.length;
    recordsSkipped += rejected.length;
    if (rejected.length > 0) {
      warnings.push(`${rejected.length} records rejected by transform pipeline`);
    }

    // 4. Validate
    const validated = accepted.filter((r) => passesValidation(r, blueprint));
    recordsSkipped += accepted.length - validated.length;
    recordsValidated = validated.length;

    // 5. Sink
    sinkResult = await dispatchToSink(blueprint, validated, {
      dryRun: options.dryRun,
      triggeredBy: options.triggeredBy,
    });
    recordsWritten = sinkResult.written;
    recordsSkipped += sinkResult.skipped;
    recordsErrored += sinkResult.errored;
    warnings.push(...sinkResult.warnings);

    // 6. Keep up to 5 sample records for the run row.
    sampleOut = validated.slice(0, 5);

    status =
      recordsErrored > 0 ? "partial" : recordsWritten + recordsSkipped === 0 && recordsParsed > 0 ? "partial" : "success";

    // Persist an inferred-schema sample snapshot so the UI can quickly preview the shape next time.
    try {
      const inferred = inferSchema(validated.slice(0, 200));
      await db.insert(integrationBlueprintSamples).values({
        id: randomUUID(),
        blueprintId: blueprint.id,
        version: blueprint.currentVersion,
        rawSample: JSON.stringify(validated.slice(0, 20)),
        rawFormat: extracted.format,
        inferredSchema: schemaToPersisted(inferred) as unknown,
        recordCount: validated.length,
        sourceHash: hashString(fetched.body),
        fetchedAt: nowMs(),
      } as never);
    } catch (e: unknown) {
      warnings.push(`sample snapshot skipped: ${(e as Error).message}`);
    }
  } catch (e: unknown) {
    status = "failed";
    errorMessage = errorMessage ?? (e as Error).message;
    warnings.push(`execution error: ${errorMessage}`);
  }

  const completedAt = nowMs();
  const durationMs = completedAt - startedAt;
  await db
    .update(integrationBlueprintRuns)
    .set({
      status,
      recordsFetched,
      recordsParsed,
      recordsTransformed,
      recordsValidated,
      recordsWritten,
      recordsSkipped,
      recordsErrored,
      errorLog: errorMessage,
      warnings: warnings as unknown,
      outputSummary: {
        sink: blueprint.sinkConfig.kind,
        sample: sampleOut,
      } as unknown,
      completedAt,
      durationMs,
    } as never)
    .where(eq(integrationBlueprintRuns.id, runId));

  if (!options.dryRun) {
    await recordRunStats(blueprint.id, {
      status: status === "success" ? "success" : status === "partial" ? "partial" : "failed",
      recordsWritten,
      error: errorMessage,
    });
  }

  return {
    runId,
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.currentVersion,
    status,
    recordsFetched,
    recordsParsed,
    recordsTransformed,
    recordsValidated,
    recordsWritten,
    recordsSkipped,
    recordsErrored,
    durationMs,
    error: errorMessage,
    warnings,
    sample: sampleOut,
    startedAt,
    completedAt,
  };
}

function passesValidation(record: Record_, blueprint: BlueprintDefinition): boolean {
  const rules = blueprint.validationRules;
  if (!rules) return true;
  if (rules.requiredFields) {
    for (const f of rules.requiredFields) {
      const v = readPath(record, f);
      if (v === undefined || v === null || v === "") return false;
    }
  }
  if (rules.dropIfAllEmpty) {
    const anyNonEmpty = rules.dropIfAllEmpty.some((f) => {
      const v = readPath(record, f);
      return v !== undefined && v !== null && v !== "";
    });
    if (!anyNonEmpty) return false;
  }
  return true;
}

function hashString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0");
}
