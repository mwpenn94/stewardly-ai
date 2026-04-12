/**
 * /api/v1 — outbound webhook signer + dispatch state machine.
 *
 * Shipped by Pass 12 of the hybrid build loop — PARITY-API-0002
 * (discovered gap during Pass 6 build — the public API was
 * read-only and couldn't push events).
 *
 * This module is split in two halves:
 *
 *   1. Pure helpers: HMAC-SHA256 payload signing using the Web
 *      Crypto API's subtle interface (works in Node 20+ and the
 *      browser), signature verification, timestamp freshness
 *      checks, and a pure retry-backoff scheduler.
 *
 *   2. Dispatch state machine: A reducer-style
 *      `stepDispatchState(state, event)` that progresses a single
 *      webhook delivery through its lifecycle
 *      (pending → in_flight → delivered | failed_retry | abandoned).
 *      The actual HTTP fetch is INJECTED by the caller so tests
 *      run without network and production can swap in any fetch
 *      implementation.
 *
 * No DB, no persistent queue. Callers (production services) wire
 * this to their own storage + cron. The primitive is the state
 * transition function; the harness is caller's choice.
 */

// ─── Types ─────────────────────────────────────────────────────────────────

export type DispatchStatus =
  | "pending"
  | "in_flight"
  | "delivered"
  | "failed_retry"
  | "abandoned";

export interface WebhookEndpoint {
  /** Target URL. */
  url: string;
  /** Shared secret used to HMAC-sign the body. */
  secret: string;
  /** Seconds of clock skew the receiver will tolerate. */
  maxSkewSec?: number;
}

export interface WebhookEvent {
  /** Event ID — callers use this for dedup on the receive side. */
  id: string;
  /** Event type, e.g. "rebalancing.drift.exceeded". */
  type: string;
  /** Timestamp in ISO 8601. */
  createdAt: string;
  /** Opaque event-specific payload. */
  data: unknown;
}

export interface DispatchState {
  event: WebhookEvent;
  endpoint: WebhookEndpoint;
  status: DispatchStatus;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  lastError: string | null;
  /** Responses we've seen, most recent first (capped at 10). */
  history: Array<{
    attempt: number;
    timestamp: string;
    status: "success" | "error";
    httpStatus?: number;
    errorMessage?: string;
  }>;
}

export interface DispatchEvent {
  kind: "begin" | "http_success" | "http_error" | "transport_error";
  /** Current clock in ms since epoch. */
  nowMs: number;
  /** HTTP status code on http_success / http_error. */
  httpStatus?: number;
  errorMessage?: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 5_000; // 5s
const MAX_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes
const HISTORY_CAP = 10;

// ─── HMAC signing ──────────────────────────────────────────────────────────

/**
 * Compute an HMAC-SHA256 hex signature of `timestamp + '.' + body`
 * — matches the "Stripe-Signature" convention. Caller is expected
 * to base64/hex-encode the result themselves if they want a
 * different format.
 */
export async function signWebhookBody(
  secret: string,
  body: string,
  timestampSec: number,
): Promise<string> {
  const msg = `${timestampSec}.${body}`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(msg);
  // Use the Web Crypto subtle interface which Node 20+ exposes.
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (!subtle) {
    throw new Error("SubtleCrypto is not available in this runtime.");
  }
  const key = await subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await subtle.sign("HMAC", key, msgData);
  return bufferToHex(sigBuf);
}

/**
 * Build the header value callers attach to the outgoing HTTP
 * request — `t=<timestamp>,v1=<hex signature>`. Mirrors Stripe's
 * header format so receivers can reuse existing middleware.
 */
export function buildSignatureHeader(
  signature: string,
  timestampSec: number,
): string {
  return `t=${timestampSec},v1=${signature}`;
}

/**
 * Verify a webhook body against a signature header. PURE — takes
 * the parsed header parts + the body + the shared secret.
 *
 * Returns `true` when:
 *   - The v1 signature computed from (t, body) matches the header's v1
 *   - The timestamp is within `maxSkewSec` of `nowSec`
 */
export async function verifyWebhookSignature(
  secret: string,
  body: string,
  signatureHeader: string,
  nowSec: number,
  maxSkewSec = 300,
): Promise<boolean> {
  const parts = parseSignatureHeader(signatureHeader);
  if (!parts) return false;
  if (Math.abs(nowSec - parts.timestamp) > maxSkewSec) return false;
  const expected = await signWebhookBody(secret, body, parts.timestamp);
  return constantTimeEqual(expected, parts.signature);
}

export function parseSignatureHeader(
  header: string,
): { timestamp: number; signature: string } | null {
  if (!header || typeof header !== "string") return null;
  const parts = header.split(",").reduce((acc, entry) => {
    const [k, v] = entry.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {} as Record<string, string>);
  const t = parseInt(parts.t ?? "", 10);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return null;
  return { timestamp: t, signature: v1 };
}

/** Constant-time string comparison — resist timing attacks. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

// ─── Retry / backoff ───────────────────────────────────────────────────────

/**
 * Exponential backoff with jitter. Pure — returns the next
 * delay in ms given the attempt count (1-indexed).
 */
export function backoffMs(attempt: number, seed = 0.5): number {
  if (attempt <= 0) return 0;
  const raw = BASE_BACKOFF_MS * Math.pow(2, attempt - 1);
  const capped = Math.min(raw, MAX_BACKOFF_MS);
  // Deterministic "jitter" tied to seed so tests are stable.
  const jitter = 1 + (seed - 0.5) * 0.2; // ±10%
  return Math.floor(capped * jitter);
}

// ─── Dispatch state machine ───────────────────────────────────────────────

export function initDispatchState(
  event: WebhookEvent,
  endpoint: WebhookEndpoint,
): DispatchState {
  return {
    event,
    endpoint,
    status: "pending",
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: null,
    history: [],
  };
}

/**
 * Pure state transition. Callers drive the machine by dispatching
 * events in response to their HTTP interactions:
 *
 *   { kind: "begin", nowMs }            → pending → in_flight
 *   { kind: "http_success", nowMs, httpStatus } → in_flight → delivered
 *   { kind: "http_error", nowMs, httpStatus }   → in_flight → failed_retry | abandoned
 *   { kind: "transport_error", nowMs, errorMessage } → in_flight → failed_retry | abandoned
 */
export function stepDispatchState(
  state: DispatchState,
  ev: DispatchEvent,
): DispatchState {
  const nowIso = new Date(ev.nowMs).toISOString();

  switch (ev.kind) {
    case "begin": {
      if (state.status !== "pending" && state.status !== "failed_retry") {
        return state;
      }
      return {
        ...state,
        status: "in_flight",
        attempts: state.attempts + 1,
        lastAttemptAt: nowIso,
        nextAttemptAt: null,
      };
    }
    case "http_success": {
      const httpStatus = ev.httpStatus ?? 200;
      const ok = httpStatus >= 200 && httpStatus < 300;
      if (!ok) {
        // 2xx expected — anything else flows through the error branch.
        return stepDispatchState(state, {
          kind: "http_error",
          nowMs: ev.nowMs,
          httpStatus,
        });
      }
      return {
        ...state,
        status: "delivered",
        nextAttemptAt: null,
        history: appendHistory(state.history, {
          attempt: state.attempts,
          timestamp: nowIso,
          status: "success",
          httpStatus,
        }),
      };
    }
    case "http_error":
    case "transport_error": {
      const httpStatus = ev.httpStatus;
      const message = ev.errorMessage ?? `HTTP ${httpStatus ?? "?"}`;
      const retriable = shouldRetry(state.attempts, httpStatus);
      const nextStatus: DispatchStatus = retriable ? "failed_retry" : "abandoned";
      const nextMs = retriable
        ? ev.nowMs + backoffMs(state.attempts)
        : null;
      return {
        ...state,
        status: nextStatus,
        lastError: message,
        nextAttemptAt: nextMs ? new Date(nextMs).toISOString() : null,
        history: appendHistory(state.history, {
          attempt: state.attempts,
          timestamp: nowIso,
          status: "error",
          httpStatus,
          errorMessage: message,
        }),
      };
    }
  }
}

function appendHistory(
  history: DispatchState["history"],
  entry: DispatchState["history"][number],
): DispatchState["history"] {
  const next = [entry, ...history];
  return next.slice(0, HISTORY_CAP);
}

/** 4xx → no retry (client error). 5xx or transport → retry up to MAX_ATTEMPTS. */
export function shouldRetry(
  attempts: number,
  httpStatus: number | undefined,
): boolean {
  if (attempts >= MAX_ATTEMPTS) return false;
  if (httpStatus === undefined) return true; // transport error
  if (httpStatus >= 400 && httpStatus < 500) return false;
  return true;
}

/** Has the dispatch reached a terminal state? */
export function isTerminal(state: DispatchState): boolean {
  return state.status === "delivered" || state.status === "abandoned";
}

/** Is this dispatch ready to run right now? */
export function isReadyNow(state: DispatchState, nowMs: number): boolean {
  if (state.status === "pending") return true;
  if (state.status === "failed_retry" && state.nextAttemptAt) {
    return new Date(state.nextAttemptAt).getTime() <= nowMs;
  }
  return false;
}
