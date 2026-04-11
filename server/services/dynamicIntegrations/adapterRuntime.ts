/**
 * Dynamic CRUD Adapter Runtime
 *
 * Executes an AdapterSpec (from adapterGenerator.ts) against a live HTTP
 * endpoint. Handles auth header injection, pagination iteration,
 * rate-limit backoff, field transforms, and response unwrapping.
 *
 * Pure of global state — every call receives its own `fetchImpl` so tests
 * can inject a mock without monkey-patching. No singletons. Every operation
 * is idempotent-safe where possible.
 */

import type {
  AdapterSpec,
  AdapterAuthSpec,
  AdapterEndpointSpec,
  AdapterPaginationSpec,
  AdapterFieldMapping,
} from "./adapterGenerator";

// ─── Types ─────────────────────────────────────────────────────────────────

export type FetchImpl = (
  url: string,
  init?: RequestInit
) => Promise<{
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}>;

export interface AdapterCredentials {
  token?: string;       // bearer / oauth2
  apiKey?: string;      // api_key_header / api_key_query
  username?: string;    // basic
  password?: string;    // basic
}

export interface RuntimeOptions {
  fetchImpl?: FetchImpl;
  credentials: AdapterCredentials;
  userHeaders?: Record<string, string>;
  maxRetries?: number;    // override spec rateLimit.maxRetries
  pageLimit?: number;     // safety cap on total pages (default 100)
  maxPageSize?: number;   // override pagination.maxPageSize
  onPage?: (records: unknown[], pageIndex: number) => void;
}

export interface ListResult {
  records: unknown[];
  pages: number;
  retries: number;
  truncated: boolean;     // hit pageLimit before exhausting
}

export interface MutationResult {
  record: unknown;
  status: number;
}

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

// ─── Auth header injection ─────────────────────────────────────────────────

export function buildAuthHeaders(auth: AdapterAuthSpec, creds: AdapterCredentials): Record<string, string> {
  const headers: Record<string, string> = {};
  switch (auth.type) {
    case "bearer":
    case "oauth2":
      if (creds.token) headers["Authorization"] = `Bearer ${creds.token}`;
      break;
    case "api_key_header": {
      const name = auth.headerName || "X-API-Key";
      if (creds.apiKey) headers[name] = creds.apiKey;
      break;
    }
    case "basic": {
      if (creds.username && creds.password) {
        const buf = Buffer.from(`${creds.username}:${creds.password}`, "utf8");
        headers["Authorization"] = `Basic ${buf.toString("base64")}`;
      }
      break;
    }
    case "none":
    case "unknown":
    case "api_key_query":
      break;
  }
  return headers;
}

export function injectAuthQueryParam(
  url: string,
  auth: AdapterAuthSpec,
  creds: AdapterCredentials
): string {
  if (auth.type !== "api_key_query" || !creds.apiKey) return url;
  const param = auth.queryParam || "api_key";
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${encodeURIComponent(param)}=${encodeURIComponent(creds.apiKey)}`;
}

// ─── Response unwrapping ───────────────────────────────────────────────────

export function unwrapRecords(body: unknown, path: string | undefined): unknown[] {
  if (Array.isArray(body)) return body;
  if (!path || !body || typeof body !== "object") return [];
  const obj = body as Record<string, unknown>;
  // Support dot-separated paths: "data.items"
  const segments = path.split(".");
  let cursor: unknown = obj;
  for (const s of segments) {
    if (!cursor || typeof cursor !== "object") return [];
    cursor = (cursor as Record<string, unknown>)[s];
  }
  return Array.isArray(cursor) ? cursor : [];
}

export function readCursor(body: unknown, path: string | undefined): string | null {
  if (!path || !body || typeof body !== "object") return null;
  const segments = path.split(".");
  let cursor: unknown = body;
  for (const s of segments) {
    if (!cursor || typeof cursor !== "object") return null;
    cursor = (cursor as Record<string, unknown>)[s];
  }
  if (cursor === null || cursor === undefined || cursor === "") return null;
  return String(cursor);
}

// ─── Link header parsing ───────────────────────────────────────────────────

export function parseLinkHeader(linkHeader: string | undefined): Record<string, string> {
  if (!linkHeader) return {};
  const rels: Record<string, string> = {};
  // Format: <url>; rel="next", <url>; rel="last"
  const parts = linkHeader.split(",");
  for (const part of parts) {
    const m = part.trim().match(/^<([^>]+)>;\s*rel="([^"]+)"$/);
    if (m) rels[m[2]] = m[1];
  }
  return rels;
}

// ─── Field transforms ──────────────────────────────────────────────────────

function parseCurrency(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parsePercent(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const cleaned = v.replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  // If input contained %, divide by 100 to get a proper ratio
  return v.includes("%") ? n / 100 : n;
}

function parseDate(v: unknown): number | null {
  if (typeof v === "number") {
    // Epoch seconds → ms
    if (v < 10_000_000_000) return v * 1000;
    return v;
  }
  if (typeof v !== "string") return null;
  const parsed = Date.parse(v);
  return Number.isNaN(parsed) ? null : parsed;
}

export function applyReadTransform(
  record: Record<string, unknown>,
  mappings: AdapterFieldMapping[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.direction === "skip") continue;
    const raw = record[m.sourceName];
    if (raw === undefined || raw === null) {
      out[m.canonicalName] = null;
      continue;
    }
    switch (m.transform) {
      case "parse_currency":
        out[m.canonicalName] = parseCurrency(raw);
        break;
      case "parse_percent":
        out[m.canonicalName] = parsePercent(raw);
        break;
      case "parse_date":
        out[m.canonicalName] = parseDate(raw);
        break;
      case "number":
        out[m.canonicalName] = typeof raw === "string" ? parseFloat(raw) : Number(raw);
        break;
      case "boolean":
        out[m.canonicalName] =
          raw === true || raw === "true" || raw === 1 || raw === "1" || raw === "yes";
        break;
      case "json_stringify":
        out[m.canonicalName] = typeof raw === "string" ? raw : JSON.stringify(raw);
        break;
      case "string":
      default:
        out[m.canonicalName] = typeof raw === "string" ? raw : String(raw);
        break;
    }
  }
  return out;
}

export function applyWriteTransform(
  canonicalRecord: Record<string, unknown>,
  mappings: AdapterFieldMapping[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const m of mappings) {
    if (m.direction === "skip" || m.direction === "read" || m.direction === "derived") continue;
    const raw = canonicalRecord[m.canonicalName];
    if (raw === undefined) continue;
    // Writable + identifier both pass through as-is (stewardly canonical → source name)
    out[m.sourceName] = raw;
  }
  return out;
}

// ─── Sleep + backoff helpers ──────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function computeBackoffMs(
  attempt: number,
  strategy: "exponential" | "linear" | "fixed"
): number {
  switch (strategy) {
    case "exponential":
      return Math.min(30_000, 500 * Math.pow(2, attempt)); // 500, 1000, 2000, 4000…
    case "linear":
      return Math.min(10_000, 500 * (attempt + 1));
    case "fixed":
      return 1000;
  }
}

// ─── Core fetch with retries ──────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  spec: AdapterSpec,
  opts: RuntimeOptions,
  runtimeState: { retries: number }
): Promise<{ body: unknown; status: number; headers: Record<string, string> }> {
  const maxRetries = opts.maxRetries ?? spec.rateLimit.maxRetries;
  const fetchImpl = opts.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchImpl(url, init);
      const status = response.status;
      const headers: Record<string, string> = { ...(response.headers || {}) };

      if (response.ok) {
        let body: unknown;
        try {
          body = await response.json();
        } catch {
          body = await response.text();
        }
        return { body, status, headers };
      }

      // Rate-limit or server error → retry
      if (status === 429 || status >= 500) {
        runtimeState.retries++;
        if (attempt === maxRetries) {
          throw new AdapterError(`HTTP ${status} after ${attempt} retries`, status);
        }
        const retryAfterHeader = headers[(spec.rateLimit.retryAfterHeader || "Retry-After").toLowerCase()];
        const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : null;
        const backoff = retryAfterMs && Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : computeBackoffMs(attempt, spec.rateLimit.backoffStrategy);
        await sleep(backoff);
        continue;
      }

      // 4xx (not 429) → fail fast
      let body: unknown = null;
      try { body = await response.json(); } catch { body = null; }
      throw new AdapterError(`HTTP ${status}`, status, body);
    } catch (err) {
      lastError = err;
      if (err instanceof AdapterError && err.status && err.status < 500 && err.status !== 429) {
        throw err;
      }
      if (attempt === maxRetries) break;
      runtimeState.retries++;
      await sleep(computeBackoffMs(attempt, spec.rateLimit.backoffStrategy));
    }
  }
  throw lastError instanceof Error ? lastError : new AdapterError("Unknown fetch error");
}

// ─── Endpoint request building ─────────────────────────────────────────────

function buildUrl(baseUrl: string, pathTemplate: string, pathParams?: Record<string, unknown>): string {
  const trimmedBase = baseUrl.replace(/\/$/, "");
  const trimmedPath = pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`;
  let filled = `${trimmedBase}${trimmedPath}`;
  if (pathParams) {
    for (const [key, value] of Object.entries(pathParams)) {
      filled = filled.replace(`{${key}}`, encodeURIComponent(String(value)));
    }
  }
  return filled;
}

function appendQuery(url: string, params: Record<string, unknown>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  if (!qs) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${qs}`;
}

// ─── LIST operation with pagination ───────────────────────────────────────

export async function listRecords(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  filter?: Record<string, unknown>
): Promise<ListResult> {
  if (!spec.baseUrl) throw new AdapterError("AdapterSpec has no baseUrl — cannot execute");
  const list = spec.endpoints.list;
  if (!list) throw new AdapterError("AdapterSpec has no list endpoint");

  const pageLimit = opts.pageLimit ?? 100;
  const pageSize = Math.max(1, opts.maxPageSize ?? list.pagination?.maxPageSize ?? 50);
  const authHeaders = buildAuthHeaders(spec.auth, opts.credentials);

  let records: unknown[] = [];
  let page = 0;
  let stopRequested = false;
  const state = { retries: 0 };
  let truncated = false;

  // Pagination state
  let cursor: string | null = null;
  let offset = 0;
  let pageNumber = 1;
  let nextUrl: string | null = null;

  while (page < pageLimit && !stopRequested) {
    let url: string;
    if (nextUrl) {
      url = nextUrl;
    } else {
      url = buildUrl(spec.baseUrl, list.pathTemplate);
      const qp: Record<string, unknown> = { ...(list.queryParams || {}), ...(filter || {}) };
      const pagination: AdapterPaginationSpec | undefined = list.pagination;
      if (pagination) {
        switch (pagination.style) {
          case "cursor":
            if (cursor) qp[pagination.cursorParam || "cursor"] = cursor;
            if (pagination.limitParam) qp[pagination.limitParam] = pageSize;
            break;
          case "offset":
            qp[pagination.offsetParam || "offset"] = offset;
            qp[pagination.limitParam || "limit"] = pageSize;
            break;
          case "page":
            qp[pagination.pageParam || "page"] = pageNumber;
            qp[pagination.limitParam || "per_page"] = pageSize;
            break;
          case "link_header":
          case "none":
            break;
        }
      }
      url = appendQuery(url, qp);
      url = injectAuthQueryParam(url, spec.auth, opts.credentials);
    }

    const { body, headers } = await fetchWithRetry(
      url,
      {
        method: "GET",
        headers: { ...authHeaders, Accept: "application/json", ...(opts.userHeaders || {}) },
      },
      spec,
      opts,
      state
    );

    const pageRecords = unwrapRecords(body, list.responseRecordPath);
    records = records.concat(pageRecords);
    page++;
    opts.onPage?.(pageRecords, page);

    // Decide whether to continue
    const pagination = list.pagination;
    if (!pagination || pagination.style === "none" || pageRecords.length === 0) break;

    switch (pagination.style) {
      case "cursor": {
        cursor = readCursor(body, pagination.cursorPath);
        nextUrl = null;
        if (!cursor) {
          stopRequested = true;
        }
        break;
      }
      case "offset": {
        if (pageRecords.length < pageSize) {
          stopRequested = true;
        } else {
          offset += pageSize;
          nextUrl = null;
        }
        break;
      }
      case "page": {
        if (pageRecords.length < pageSize) {
          stopRequested = true;
        } else {
          pageNumber++;
          nextUrl = null;
        }
        break;
      }
      case "link_header": {
        const links = parseLinkHeader(headers["link"]);
        nextUrl = links.next || null;
        if (!nextUrl) page = pageLimit;
        break;
      }
    }
  }

  if (page >= pageLimit && !stopRequested) truncated = true;

  // Apply read transforms
  const transformed = records.map((r) =>
    r && typeof r === "object"
      ? applyReadTransform(r as Record<string, unknown>, spec.fieldMappings)
      : r
  );

  return { records: transformed, pages: page, retries: state.retries, truncated };
}

// ─── GET operation ────────────────────────────────────────────────────────

export async function getRecord(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  id: string | number
): Promise<unknown> {
  if (!spec.baseUrl) throw new AdapterError("AdapterSpec has no baseUrl");
  const get = spec.endpoints.get;
  if (!get) throw new AdapterError("AdapterSpec has no get endpoint — primary key may be missing");
  if (!spec.primaryKey) throw new AdapterError("AdapterSpec has no primary key defined");

  const url = injectAuthQueryParam(
    buildUrl(spec.baseUrl, get.pathTemplate, { [spec.primaryKey]: id }),
    spec.auth,
    opts.credentials
  );
  const authHeaders = buildAuthHeaders(spec.auth, opts.credentials);
  const state = { retries: 0 };

  const { body } = await fetchWithRetry(
    url,
    { method: "GET", headers: { ...authHeaders, Accept: "application/json", ...(opts.userHeaders || {}) } },
    spec,
    opts,
    state
  );
  // Single-record endpoints may or may not be wrapped
  const record = Array.isArray(body) ? body[0] : body;
  if (record && typeof record === "object") {
    return applyReadTransform(record as Record<string, unknown>, spec.fieldMappings);
  }
  return record;
}

// ─── CREATE operation ─────────────────────────────────────────────────────

export async function createRecord(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  canonicalRecord: Record<string, unknown>
): Promise<MutationResult> {
  if (!spec.baseUrl) throw new AdapterError("AdapterSpec has no baseUrl");
  const create = spec.endpoints.create;
  if (!create) throw new AdapterError("AdapterSpec has no create endpoint");

  const payload = applyWriteTransform(canonicalRecord, spec.fieldMappings);
  const url = injectAuthQueryParam(buildUrl(spec.baseUrl, create.pathTemplate), spec.auth, opts.credentials);
  const authHeaders = buildAuthHeaders(spec.auth, opts.credentials);
  const state = { retries: 0 };

  const { body, status } = await fetchWithRetry(
    url,
    {
      method: "POST",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts.userHeaders || {}),
      },
      body: JSON.stringify(payload),
    },
    spec,
    opts,
    state
  );
  return { record: body, status };
}

// ─── UPDATE operation ─────────────────────────────────────────────────────

export async function updateRecord(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  id: string | number,
  canonicalPatch: Record<string, unknown>
): Promise<MutationResult> {
  if (!spec.baseUrl) throw new AdapterError("AdapterSpec has no baseUrl");
  const update = spec.endpoints.update;
  if (!update) throw new AdapterError("AdapterSpec has no update endpoint — primary key may be missing");
  if (!spec.primaryKey) throw new AdapterError("AdapterSpec has no primary key defined");

  const payload = applyWriteTransform(canonicalPatch, spec.fieldMappings);
  const url = injectAuthQueryParam(
    buildUrl(spec.baseUrl, update.pathTemplate, { [spec.primaryKey]: id }),
    spec.auth,
    opts.credentials
  );
  const authHeaders = buildAuthHeaders(spec.auth, opts.credentials);
  const state = { retries: 0 };

  const { body, status } = await fetchWithRetry(
    url,
    {
      method: update.method || "PATCH",
      headers: {
        ...authHeaders,
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(opts.userHeaders || {}),
      },
      body: JSON.stringify(payload),
    },
    spec,
    opts,
    state
  );
  return { record: body, status };
}

// ─── DELETE operation ─────────────────────────────────────────────────────

export async function deleteRecord(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  id: string | number
): Promise<{ status: number }> {
  if (!spec.baseUrl) throw new AdapterError("AdapterSpec has no baseUrl");
  const del = spec.endpoints.delete;
  if (!del) throw new AdapterError("AdapterSpec has no delete endpoint — primary key may be missing");
  if (!spec.primaryKey) throw new AdapterError("AdapterSpec has no primary key defined");

  const url = injectAuthQueryParam(
    buildUrl(spec.baseUrl, del.pathTemplate, { [spec.primaryKey]: id }),
    spec.auth,
    opts.credentials
  );
  const authHeaders = buildAuthHeaders(spec.auth, opts.credentials);
  const state = { retries: 0 };

  const { status } = await fetchWithRetry(
    url,
    { method: "DELETE", headers: { ...authHeaders, ...(opts.userHeaders || {}) } },
    spec,
    opts,
    state
  );
  return { status };
}

// ─── Idempotent upsert ────────────────────────────────────────────────────

/**
 * Upsert by primary key: try GET first; if 404, CREATE; otherwise PATCH.
 * Useful for pipelines that need exactly-once semantics against a source
 * that doesn't have a native upsert endpoint.
 */
export async function upsertRecord(
  spec: AdapterSpec,
  opts: RuntimeOptions,
  canonicalRecord: Record<string, unknown>
): Promise<{ result: "created" | "updated"; record: unknown }> {
  if (!spec.primaryKey) throw new AdapterError("Upsert requires a primary key in AdapterSpec");
  const id = canonicalRecord[spec.primaryKey];
  if (id === undefined || id === null) {
    const { record } = await createRecord(spec, opts, canonicalRecord);
    return { result: "created", record };
  }
  try {
    await getRecord(spec, opts, id as string | number);
    const { record } = await updateRecord(spec, opts, id as string | number, canonicalRecord);
    return { result: "updated", record };
  } catch (err) {
    if (err instanceof AdapterError && err.status === 404) {
      const { record } = await createRecord(spec, opts, canonicalRecord);
      return { result: "created", record };
    }
    throw err;
  }
}
