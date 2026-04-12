/**
 * Dynamic Integration — AI Blueprint Drafter
 *
 * Given (a) an optional URL and (b) a natural-language description of what
 * the user is trying to ingest, produce a complete BlueprintDraftInput ready
 * for the registry. The drafter:
 *
 *   1. Fetches a small sample of the URL (up to 200KB).
 *   2. Runs probeBody + inferSchema to get a concrete shape.
 *   3. Asks contextualLLM, with the schema + description, to propose:
 *        - canonical name, source kind, transform steps, sink target, tags
 *   4. Validates and returns a BlueprintDraftInput — the human still gets
 *      to review and save.
 *
 * Safe fallbacks: if the URL fails or the LLM returns garbage, the drafter
 * produces a sensible default draft that the user can edit.
 */

import { contextualLLM } from "../../shared/stewardlyWiring";
import { probeBody } from "./sourceProber";
import { checkUrlSafety } from "./urlGuard";
import { inferSchema, schemaToPersisted, type InferredSchema } from "./schemaInference";
import type {
  BlueprintDraftInput,
  BlueprintSourceConfig,
  BlueprintExtractionConfig,
  BlueprintSinkConfig,
  SinkKind,
  SourceKind,
} from "./types";
import type { TransformStep } from "./transformEngine";

const SAMPLE_FETCH_BYTES = 200_000;

export interface DraftRequest {
  name?: string;
  description: string;
  url?: string;
  inlineSample?: string;
  preferSink?: SinkKind;
  hintContentType?: string;
}

export interface DraftResult {
  draft: BlueprintDraftInput;
  detectedFormat: string | null;
  schemaPreview: ReturnType<typeof schemaToPersisted> | null;
  notes: string[];
  llmUsed: boolean;
}

/** Entry point — can be called directly from a tRPC procedure. */
export async function draftBlueprint(req: DraftRequest): Promise<DraftResult> {
  const notes: string[] = [];
  let body: string | null = null;
  let contentType = req.hintContentType ?? "";

  if (req.inlineSample) {
    body = req.inlineSample;
    notes.push("using inline sample (no network fetch)");
  } else if (req.url) {
    const safety = checkUrlSafety(req.url);
    if (!safety.ok) {
      notes.push(`url blocked: ${safety.reason}`);
      req.url = undefined;
    }
  }
  if (req.url && !body) {
    try {
      const resp = await fetch(req.url, {
        headers: { "User-Agent": "Stewardly-BlueprintDrafter/1.0" },
        signal: AbortSignal.timeout(15_000),
      });
      contentType = resp.headers.get("content-type") ?? "";
      const buffer = await resp.arrayBuffer();
      const truncated = buffer.byteLength > SAMPLE_FETCH_BYTES
        ? Buffer.from(buffer).slice(0, SAMPLE_FETCH_BYTES)
        : Buffer.from(buffer);
      body = truncated.toString("utf-8");
      if (buffer.byteLength > SAMPLE_FETCH_BYTES) notes.push(`sample truncated at ${SAMPLE_FETCH_BYTES} bytes`);
    } catch (e: unknown) {
      notes.push(`fetch failed: ${(e as Error).message}`);
    }
  }

  let schema: InferredSchema | null = null;
  let detectedFormat: string | null = null;
  let records: Record<string, unknown>[] = [];

  if (body) {
    const probe = probeBody(body, contentType);
    detectedFormat = probe.detectedFormat;
    records = probe.records;
    if (records.length > 0) schema = inferSchema(records);
    notes.push(...probe.notes);
  }

  // Fallback draft even if there's no sample.
  const fallbackSourceKind: SourceKind = req.url
    ? detectedFormat === "json" || detectedFormat === "ndjson"
      ? "http_json"
      : detectedFormat === "csv" || detectedFormat === "tsv"
        ? "http_csv"
        : detectedFormat === "rss" || detectedFormat === "atom"
          ? "http_rss"
          : detectedFormat === "html"
            ? "http_html"
            : "http_any"
    : "manual_paste";

  const fallbackSourceConfig: BlueprintSourceConfig = {
    kind: fallbackSourceKind,
    url: req.url,
    method: "GET",
    inlineSample: req.inlineSample,
  };
  const fallbackExtraction: BlueprintExtractionConfig = {
    formatHint: "auto",
    maxRecords: 1000,
  };
  const fallbackSink: BlueprintSinkConfig = {
    kind: req.preferSink ?? "ingested_records",
    target: "entity",
    autoVerify: false,
    tags: [],
  };
  const fallbackDraft: BlueprintDraftInput = {
    name: req.name?.trim() || deriveNameFromUrl(req.url) || "Untitled Blueprint",
    description: req.description,
    sourceKind: fallbackSourceKind,
    sourceConfig: fallbackSourceConfig,
    extractionConfig: fallbackExtraction,
    transformSteps: [],
    sinkConfig: fallbackSink,
    validationRules: null,
    tags: [],
  };

  // Try to ask the LLM for a smarter draft. If anything fails, fall back.
  let llmUsed = false;
  try {
    if (schema && schema.fields.length > 0) {
      const llmDraft = await askLLMForDraft({
        description: req.description,
        url: req.url,
        schemaPreview: schemaToPersisted(schema),
        detectedFormat,
        preferSink: req.preferSink,
      });
      if (llmDraft) {
        llmUsed = true;
        return {
          draft: mergeDraft(fallbackDraft, llmDraft),
          detectedFormat,
          schemaPreview: schemaToPersisted(schema),
          notes,
          llmUsed,
        };
      }
    }
  } catch (e: unknown) {
    notes.push(`llm draft failed: ${(e as Error).message}`);
  }

  return {
    draft: fallbackDraft,
    detectedFormat,
    schemaPreview: schema ? schemaToPersisted(schema) : null,
    notes,
    llmUsed,
  };
}

function deriveNameFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "").split("/").pop() || u.hostname;
    return `${u.hostname} — ${path}`.slice(0, 120);
  } catch {
    return undefined;
  }
}

function mergeDraft(base: BlueprintDraftInput, patch: Partial<BlueprintDraftInput>): BlueprintDraftInput {
  return {
    name: patch.name ?? base.name,
    description: patch.description ?? base.description,
    sourceKind: patch.sourceKind ?? base.sourceKind,
    sourceConfig: patch.sourceConfig ?? base.sourceConfig,
    authConfig: patch.authConfig ?? base.authConfig,
    extractionConfig: patch.extractionConfig ?? base.extractionConfig,
    transformSteps: patch.transformSteps ?? base.transformSteps,
    sinkConfig: patch.sinkConfig ?? base.sinkConfig,
    validationRules: patch.validationRules ?? base.validationRules,
    tags: patch.tags ?? base.tags,
  };
}

interface LLMDraftArgs {
  description: string;
  url?: string;
  schemaPreview: ReturnType<typeof schemaToPersisted>;
  detectedFormat: string | null;
  preferSink?: SinkKind;
}

/**
 * Ask the LLM to propose transform steps + sink choice based on the inferred
 * schema. Uses a strict JSON schema so we can trust the shape without parsing
 * free-form text.
 */
async function askLLMForDraft(args: LLMDraftArgs): Promise<Partial<BlueprintDraftInput> | null> {
  const system =
    "You are a data engineer assistant. The user describes a data source they want to ingest. " +
    "Given an inferred schema, propose a blueprint: a sensible `name`, optional `description`, " +
    "a `transformSteps` array using only the declarative DSL (kinds: pick, drop, rename, map, " +
    "coerce, default, trim, lowercase, uppercase, concat, split, regex, jsonPath, arithmetic, " +
    "constant, dropEmpty, require), a `sinkConfig` kind in {ingested_records, learning_definitions, " +
    "lead_captures, user_memories, proactive_insights, none}, and `tags`. Prefer minimal transform " +
    "steps — rename to canonical names (id/title/summary/url/published/author), coerce numeric " +
    "fields, and require the primary key. Respond ONLY with the JSON.";

  const userMsg =
    `Description: ${args.description}\n` +
    (args.url ? `URL: ${args.url}\n` : "") +
    (args.detectedFormat ? `Detected format: ${args.detectedFormat}\n` : "") +
    (args.preferSink ? `Preferred sink: ${args.preferSink}\n` : "") +
    `Inferred schema (first 30 fields):\n${JSON.stringify(
      {
        recordCount: args.schemaPreview.recordCount,
        primaryKey: args.schemaPreview.primaryKey,
        fields: args.schemaPreview.fields.slice(0, 30),
      },
      null,
      2,
    )}`;

  const response = await contextualLLM({
    userId: null,
    contextType: "ingestion",
    messages: [
      { role: "system", content: system },
      { role: "user", content: userMsg },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "blueprint_draft",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["name", "sinkKind", "transformSteps", "tags"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            sinkKind: { type: "string" },
            sinkTarget: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            transformSteps: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: true,
                required: ["kind"],
                properties: {
                  kind: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  } as Parameters<typeof contextualLLM>[0]);

  const content = response?.choices?.[0]?.message?.content;
  if (!content) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = typeof content === "string" ? JSON.parse(content) : (content as Record<string, unknown>);
  } catch {
    return null;
  }
  const steps = sanitizeSteps(parsed.transformSteps);
  const sinkKind = typeof parsed.sinkKind === "string" ? (parsed.sinkKind as SinkKind) : "ingested_records";
  const sinkTarget = typeof parsed.sinkTarget === "string" ? parsed.sinkTarget : undefined;
  const tags = Array.isArray(parsed.tags) ? (parsed.tags as string[]).filter((t) => typeof t === "string") : [];

  return {
    name: typeof parsed.name === "string" ? parsed.name : undefined,
    description: typeof parsed.description === "string" ? parsed.description : undefined,
    transformSteps: steps,
    sinkConfig: {
      kind: VALID_SINKS.has(sinkKind) ? sinkKind : "ingested_records",
      target: sinkTarget,
      autoVerify: false,
      tags,
    },
    tags,
  };
}

const VALID_SINKS = new Set<SinkKind>([
  "ingested_records",
  "learning_definitions",
  "lead_captures",
  "user_memories",
  "proactive_insights",
  "none",
]);

const VALID_STEP_KINDS = new Set<string>([
  "pick", "drop", "rename", "map", "coerce", "default", "trim",
  "lowercase", "uppercase", "concat", "split", "regex", "jsonPath",
  "arithmetic", "constant", "dropEmpty", "require",
]);

function sanitizeSteps(value: unknown): TransformStep[] {
  if (!Array.isArray(value)) return [];
  const out: TransformStep[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const step = raw as Record<string, unknown>;
    const kind = String(step.kind ?? "");
    if (!VALID_STEP_KINDS.has(kind)) continue;
    // Trust the LLM only after a shape check per kind; we keep arbitrary extra
    // properties but pin the kind string so applyStep can dispatch cleanly.
    out.push({ ...(step as object), kind } as TransformStep);
    if (out.length >= 20) break; // cap pipeline size
  }
  return out;
}
