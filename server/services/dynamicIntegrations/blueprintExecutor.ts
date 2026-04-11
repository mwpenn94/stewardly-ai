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
  return fetchUrl(req.url, req.init);
}

async function fetchUrl(
  url: string,
  init: RequestInit,
): Promise<{ body: string; contentType: string; status: number } | { error: string }> {
  try {
    const response = await fetch(url, init);
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

/**
 * Iterate a paginated source. Supports three pagination kinds:
 *   - cursor:  after each page, pull `{cursorField}` from the parsed JSON envelope
 *              and send it as `{pageParam}`.
 *   - page:    numeric page counter (1..maxPages), sent as `{pageParam}`.
 *   - offset:  offset counter (0, pageSize, 2*pageSize, ...), sent as `{pageParam}`.
 * Max pages is capped by `pagination.maxPages` (hard ceiling: 50).
 * Each page runs through extractRecords; records are concatenated up to
 * the blueprint's `maxRecordsPerRun`.
 */
async function fetchPaginated(
  blueprint: BlueprintDefinition,
): Promise<
  | { pages: Array<{ body: string; contentType: string; status: number }>; warnings: string[] }
  | { error: string; warnings: string[] }
> {
  const pagination = blueprint.sourceConfig.pagination;
  const warnings: string[] = [];

  // No pagination → single-page fetch.
  if (!pagination || pagination.kind === "none") {
    const first = await fetchSource(blueprint);
    if ("error" in first) return { error: first.error, warnings };
    return { pages: [first], warnings };
  }

  // Inline samples don't paginate.
  if (blueprint.sourceConfig.inlineSample) {
    const first = await fetchSource(blueprint);
    if ("error" in first) return { error: first.error, warnings };
    warnings.push("pagination skipped for inline sample");
    return { pages: [first], warnings };
  }

  const creds = await resolveCreds(blueprint);
  const maxPages = Math.min(pagination.maxPages ?? 10, 50);
  const pageSize = pagination.pageSize ?? 100;
  const pageParam = pagination.pageParam ?? (pagination.kind === "offset" ? "offset" : "page");
  const cursorField = pagination.cursorField ?? "next_cursor";
  const pages: Array<{ body: string; contentType: string; status: number }> = [];

  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const req = buildRequest(blueprint, creds);
    if (!req) return { error: "blueprint source URL is missing", warnings };
    const url = new URL(req.url);
    if (pagination.kind === "page") {
      url.searchParams.set(pageParam, String(i + 1));
      if (pagination.pageSize) url.searchParams.set("page_size", String(pagination.pageSize));
    } else if (pagination.kind === "offset") {
      url.searchParams.set(pageParam, String(i * pageSize));
      url.searchParams.set("limit", String(pageSize));
    } else if (pagination.kind === "cursor") {
      if (cursor) url.searchParams.set(pageParam, cursor);
    }
    const result = await fetchUrl(url.toString(), req.init);
    if ("error" in result) {
      warnings.push(`page ${i + 1} failed: ${result.error}`);
      if (pages.length === 0) return { error: result.error, warnings };
      break;
    }
    pages.push(result);

    // Cursor mode: pull next cursor from the body.
    if (pagination.kind === "cursor") {
      try {
        const parsed = JSON.parse(result.body);
        const next = readNestedCursor(parsed, cursorField);
        if (!next) break;
        if (next === cursor) {
          warnings.push("cursor did not advance — stopping");
          break;
        }
        cursor = String(next);
      } catch {
        warnings.push(`page ${i + 1}: cursor body not parseable — stopping`);
        break;
      }
    }
  }

  return { pages, warnings };
}

function readNestedCursor(obj: unknown, field: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const segments = field.split(".");
  let cur: unknown = obj;
  for (const seg of segments) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
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
    // 1. Fetch (possibly paginated)
    const fetched = await fetchPaginated(blueprint);
    if ("error" in fetched) {
      errorMessage = fetched.error;
      warnings.push(...fetched.warnings);
      throw new Error(fetched.error);
    }
    warnings.push(...fetched.warnings);
    recordsFetched = fetched.pages.reduce((acc, p) => acc + p.body.length, 0);

    // 2. Extract (concatenate records across pages)
    let allRecords: Record_[] = [];
    let format: RawFormat = "unknown";
    const cap = blueprint.maxRecordsPerRun ?? 10000;
    for (const page of fetched.pages) {
      const extracted = extractRecords(page.body, page.contentType, blueprint);
      if (extracted.format !== "unknown") format = extracted.format;
      warnings.push(...extracted.warnings);
      for (const rec of extracted.records) {
        if (allRecords.length >= cap) break;
        allRecords.push(rec);
      }
      if (allRecords.length >= cap) {
        warnings.push(`stopped at maxRecordsPerRun=${cap}`);
        break;
      }
    }
    const extracted = { records: allRecords, format, warnings: [] as string[] };
    recordsParsed = extracted.records.length;

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
        sourceHash: hashString(fetched.pages.map((p) => p.body).join("\n")),
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
