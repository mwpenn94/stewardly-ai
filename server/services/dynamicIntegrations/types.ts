/**
 * Dynamic Integration — shared type definitions.
 *
 * A Blueprint is the full JSON-serializable description of a dynamic
 * integration. It moves between DB rows, the HTTP layer, and the AI drafter
 * unchanged so the same type can power CRUD, execution, and UI preview.
 */

import type { TransformStep } from "./transformEngine";

export type SourceKind =
  | "http_json"
  | "http_csv"
  | "http_html"
  | "http_rss"
  | "http_any"
  | "webhook"
  | "manual_paste"
  | "email_fwd"
  | "file_upload";

export type AuthKind =
  | "none"
  | "api_key_query"
  | "api_key_header"
  | "bearer"
  | "basic"
  | "hmac";

export interface BlueprintSourceConfig {
  kind: SourceKind;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  body?: string;
  /** Pagination hint for future multi-page runs. */
  pagination?: {
    kind: "none" | "cursor" | "page" | "offset";
    cursorField?: string;
    pageParam?: string;
    pageSize?: number;
    maxPages?: number;
  };
  /** When source kind is a direct paste/upload, the raw sample lives here. */
  inlineSample?: string;
}

export interface BlueprintAuthConfig {
  kind: AuthKind;
  /** Reference into integration_connections.credentialsEncrypted (preferred). */
  connectionId?: string;
  /** For api_key_query/header */
  paramName?: string;
  /** For hmac */
  secretRef?: string;
  signatureHeader?: string;
  /** For basic */
  usernameParam?: string;
  passwordParam?: string;
}

export interface BlueprintExtractionConfig {
  /** Tells the prober which format hint to use (override auto-detection). */
  formatHint?: "json" | "ndjson" | "csv" | "tsv" | "rss" | "atom" | "html" | "auto";
  /** Optional dot-path into the body where the records array lives. */
  recordsPath?: string;
  /** For HTML: "table" | "jsonld" | "text" */
  htmlStrategy?: "auto" | "table" | "jsonld" | "text";
  /** Skip the first N records (header rows, etc). */
  skipRows?: number;
  /** Hard cap on records extracted per run. */
  maxRecords?: number;
}

export type SinkKind =
  | "ingested_records"
  | "learning_definitions"
  | "lead_captures"
  | "user_memories"
  | "proactive_insights"
  | "none";

export interface BlueprintSinkConfig {
  kind: SinkKind;
  /**
   * For ingested_records: the recordType enum (e.g. "entity", "regulatory_update").
   * For learning_definitions: the discipline slug.
   * For lead_captures: optional campaign / source tag.
   */
  target?: string;
  /** Ingested_records: auto-verify or leave for human review. */
  autoVerify?: boolean;
  /** Fields mapping: canonical blueprint field → sink field name. */
  fieldMap?: Record<string, string>;
  /** Tags to apply to every row written. */
  tags?: string[];
}

export interface BlueprintValidationRules {
  requiredFields?: string[];
  uniqueFields?: string[];
  maxStringLength?: number;
  dropIfAllEmpty?: string[];
}

export interface BlueprintDefinition {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  ownerId: number | null;
  organizationId: number | null;
  ownershipTier: "platform" | "organization" | "professional" | "client";
  visibility: "private" | "org" | "public";
  status: "draft" | "active" | "paused" | "error" | "archived";
  sourceKind: SourceKind;
  sourceConfig: BlueprintSourceConfig;
  authConfig: BlueprintAuthConfig | null;
  extractionConfig: BlueprintExtractionConfig;
  transformSteps: TransformStep[];
  validationRules: BlueprintValidationRules | null;
  sinkConfig: BlueprintSinkConfig;
  scheduleCron: string | null;
  rateLimitPerMin: number;
  maxRecordsPerRun: number;
  currentVersion: number;
  aiDrafted: boolean;
  aiDraftedBy: string | null;
  tags: string[];
  lastRunAt: number | null;
  lastRunStatus: string | null;
  lastRunError: string | null;
  totalRuns: number;
  totalRecordsIngested: number;
  createdBy: number | null;
  createdAt: number;
  updatedAt: number;
}

export type BlueprintDraftInput = Partial<
  Pick<
    BlueprintDefinition,
    | "name"
    | "description"
    | "sourceKind"
    | "sourceConfig"
    | "authConfig"
    | "extractionConfig"
    | "transformSteps"
    | "validationRules"
    | "sinkConfig"
    | "scheduleCron"
    | "rateLimitPerMin"
    | "maxRecordsPerRun"
    | "visibility"
    | "tags"
  >
>;

export interface BlueprintRunSummary {
  runId: string;
  blueprintId: string;
  blueprintVersion: number;
  status: "queued" | "running" | "success" | "partial" | "failed" | "cancelled";
  recordsFetched: number;
  recordsParsed: number;
  recordsTransformed: number;
  recordsValidated: number;
  recordsWritten: number;
  recordsSkipped: number;
  recordsErrored: number;
  durationMs?: number;
  error?: string | null;
  warnings?: string[];
  sample?: Array<Record<string, unknown>>;
  startedAt: number;
  completedAt?: number;
}
