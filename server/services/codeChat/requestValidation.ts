/**
 * requestValidation.ts — Parity Pass 4.
 *
 * Pure validation for the `/api/codechat/stream` POST body. The SSE
 * endpoint previously accepted any shape: unbounded `message`,
 * arbitrary `maxIterations`, no ceiling on `enabledTools` length,
 * unchecked `memoryOverlay` byte size, free-form `model` strings.
 *
 * This module centralizes every invariant so:
 *   1. A careless paste can't blow the LLM's context window (message
 *      is hard-capped at 64KB by default, ~16k tokens).
 *   2. A malicious caller can't force a 1000-iteration loop that
 *      drains the user's budget.
 *   3. Bad types fail fast with a specific error code the UI can
 *      render usefully instead of a silent stream crash 30 steps in.
 *   4. The rules are unit-testable without spinning up an Express
 *      router.
 *
 * Every helper is pure. Integration is a thin adapter in
 * codeChatStream.ts that calls validateStreamRequest() early and
 * returns the first rejection as a 400.
 */

// ─── Config ────────────────────────────────────────────────────────────────

export const STREAM_REQUEST_LIMITS = {
  /** Hard cap on the user's message (bytes). 64KB ≈ 16k tokens. */
  maxMessageBytes: 64 * 1024,
  /** Minimum message length after trim (reject whitespace-only). */
  minMessageChars: 1,
  /** Lower/upper bound on the ReAct iteration budget. */
  minIterations: 1,
  maxIterations: 20,
  /** Max tools in the per-call allowlist (more than this is clearly abuse). */
  maxEnabledTools: 20,
  /** Max bytes for the memoryOverlay prompt snippet. */
  maxMemoryOverlayBytes: 16 * 1024,
  /** Max length of model id (protect against prompt injection via field). */
  maxModelIdLength: 128,
} as const;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface StreamRequestInput {
  message?: unknown;
  model?: unknown;
  allowMutations?: unknown;
  maxIterations?: unknown;
  enabledTools?: unknown;
  includeProjectInstructions?: unknown;
  memoryOverlay?: unknown;
}

export interface ValidatedStreamRequest {
  message: string;
  model: string | undefined;
  allowMutations: boolean;
  maxIterations: number;
  enabledTools: string[] | null;
  includeProjectInstructions: boolean;
  memoryOverlay: string;
}

export type ValidationErrorCode =
  | "MESSAGE_REQUIRED"
  | "MESSAGE_EMPTY"
  | "MESSAGE_TOO_LARGE"
  | "MESSAGE_INVALID_TYPE"
  | "MODEL_INVALID"
  | "MODEL_TOO_LONG"
  | "ITERATIONS_OUT_OF_RANGE"
  | "ITERATIONS_INVALID_TYPE"
  | "TOOLS_INVALID_TYPE"
  | "TOOLS_TOO_MANY"
  | "TOOLS_INVALID_ENTRY"
  | "MEMORY_INVALID_TYPE"
  | "MEMORY_TOO_LARGE";

export interface ValidationError {
  ok: false;
  code: ValidationErrorCode;
  message: string;
  field: keyof StreamRequestInput;
}

export type ValidationResult =
  | { ok: true; value: ValidatedStreamRequest }
  | ValidationError;

// ─── Main validator ───────────────────────────────────────────────────────

/**
 * Validate and normalize a stream request body. Returns either a
 * discriminated-union success value or an error with a field +
 * specific code so the caller can surface a precise UI error.
 *
 * Invariants:
 *   - message: non-empty string after trim, ≤ maxMessageBytes
 *   - model: optional string, ≤ maxModelIdLength, no control chars
 *   - allowMutations: coerced to boolean
 *   - maxIterations: integer in [1, 20], defaults to 5 if missing
 *   - enabledTools: null or string[] of size ≤ maxEnabledTools with
 *     no empty entries
 *   - includeProjectInstructions: coerced to boolean, defaults true
 *   - memoryOverlay: string ≤ maxMemoryOverlayBytes after trim
 */
export function validateStreamRequest(
  input: StreamRequestInput,
): ValidationResult {
  // ─── message ───────────────────────────────────────────────────
  if (input.message === undefined || input.message === null) {
    return {
      ok: false,
      code: "MESSAGE_REQUIRED",
      field: "message",
      message: "message is required",
    };
  }
  if (typeof input.message !== "string") {
    return {
      ok: false,
      code: "MESSAGE_INVALID_TYPE",
      field: "message",
      message: "message must be a string",
    };
  }
  const trimmedMessage = input.message.trim();
  if (trimmedMessage.length < STREAM_REQUEST_LIMITS.minMessageChars) {
    return {
      ok: false,
      code: "MESSAGE_EMPTY",
      field: "message",
      message: "message is empty after trimming whitespace",
    };
  }
  const messageBytes = byteLength(input.message);
  if (messageBytes > STREAM_REQUEST_LIMITS.maxMessageBytes) {
    return {
      ok: false,
      code: "MESSAGE_TOO_LARGE",
      field: "message",
      message: `message exceeds max size (${messageBytes}B > ${STREAM_REQUEST_LIMITS.maxMessageBytes}B)`,
    };
  }

  // ─── model ─────────────────────────────────────────────────────
  let model: string | undefined;
  if (input.model !== undefined && input.model !== null) {
    if (typeof input.model !== "string") {
      return {
        ok: false,
        code: "MODEL_INVALID",
        field: "model",
        message: "model must be a string",
      };
    }
    if (input.model.length > STREAM_REQUEST_LIMITS.maxModelIdLength) {
      return {
        ok: false,
        code: "MODEL_TOO_LONG",
        field: "model",
        message: `model id exceeds ${STREAM_REQUEST_LIMITS.maxModelIdLength} chars`,
      };
    }
    // Reject control chars / newlines — these would corrupt the
    // system prompt if echoed into a log line or error message.
    if (/[\x00-\x1f\x7f]/.test(input.model)) {
      return {
        ok: false,
        code: "MODEL_INVALID",
        field: "model",
        message: "model contains control characters",
      };
    }
    const t = input.model.trim();
    model = t.length > 0 ? t : undefined;
  }

  // ─── allowMutations ────────────────────────────────────────────
  const allowMutations = Boolean(input.allowMutations);

  // ─── maxIterations ─────────────────────────────────────────────
  let maxIterations = 5;
  if (input.maxIterations !== undefined && input.maxIterations !== null) {
    const n = Number(input.maxIterations);
    if (!Number.isFinite(n) || Number.isNaN(n)) {
      return {
        ok: false,
        code: "ITERATIONS_INVALID_TYPE",
        field: "maxIterations",
        message: "maxIterations must be a finite number",
      };
    }
    const asInt = Math.floor(n);
    if (
      asInt < STREAM_REQUEST_LIMITS.minIterations ||
      asInt > STREAM_REQUEST_LIMITS.maxIterations
    ) {
      return {
        ok: false,
        code: "ITERATIONS_OUT_OF_RANGE",
        field: "maxIterations",
        message: `maxIterations must be between ${STREAM_REQUEST_LIMITS.minIterations} and ${STREAM_REQUEST_LIMITS.maxIterations}`,
      };
    }
    maxIterations = asInt;
  }

  // ─── enabledTools ──────────────────────────────────────────────
  let enabledTools: string[] | null = null;
  if (input.enabledTools !== undefined && input.enabledTools !== null) {
    if (!Array.isArray(input.enabledTools)) {
      return {
        ok: false,
        code: "TOOLS_INVALID_TYPE",
        field: "enabledTools",
        message: "enabledTools must be an array of strings",
      };
    }
    if (input.enabledTools.length > STREAM_REQUEST_LIMITS.maxEnabledTools) {
      return {
        ok: false,
        code: "TOOLS_TOO_MANY",
        field: "enabledTools",
        message: `enabledTools exceeds max size (${input.enabledTools.length} > ${STREAM_REQUEST_LIMITS.maxEnabledTools})`,
      };
    }
    const cleaned: string[] = [];
    for (const entry of input.enabledTools) {
      if (typeof entry !== "string") {
        return {
          ok: false,
          code: "TOOLS_INVALID_ENTRY",
          field: "enabledTools",
          message: "enabledTools entries must all be strings",
        };
      }
      const t = entry.trim();
      if (t.length === 0) {
        // Silently drop empties rather than error out — the client
        // can accidentally send them when a toggle is mid-edit.
        continue;
      }
      // Reject patently bogus entries to avoid injection through a
      // random field that ends up in a log somewhere.
      if (t.length > 64 || /[\x00-\x1f\x7f]/.test(t)) {
        return {
          ok: false,
          code: "TOOLS_INVALID_ENTRY",
          field: "enabledTools",
          message: "enabledTools entry is too long or contains control characters",
        };
      }
      cleaned.push(t);
    }
    enabledTools = cleaned;
  }

  // ─── includeProjectInstructions ───────────────────────────────
  const includeProjectInstructions =
    input.includeProjectInstructions === undefined
      ? true
      : Boolean(input.includeProjectInstructions);

  // ─── memoryOverlay ────────────────────────────────────────────
  let memoryOverlay = "";
  if (input.memoryOverlay !== undefined && input.memoryOverlay !== null) {
    if (typeof input.memoryOverlay !== "string") {
      return {
        ok: false,
        code: "MEMORY_INVALID_TYPE",
        field: "memoryOverlay",
        message: "memoryOverlay must be a string",
      };
    }
    const overlayBytes = byteLength(input.memoryOverlay);
    if (overlayBytes > STREAM_REQUEST_LIMITS.maxMemoryOverlayBytes) {
      return {
        ok: false,
        code: "MEMORY_TOO_LARGE",
        field: "memoryOverlay",
        message: `memoryOverlay exceeds max size (${overlayBytes}B > ${STREAM_REQUEST_LIMITS.maxMemoryOverlayBytes}B)`,
      };
    }
    memoryOverlay = input.memoryOverlay.trim();
  }

  return {
    ok: true,
    value: {
      message: input.message, // keep original whitespace (user intent)
      model,
      allowMutations,
      maxIterations,
      enabledTools,
      includeProjectInstructions,
      memoryOverlay,
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Byte length of a UTF-8 string, without allocating a TextEncoder. */
export function byteLength(s: string): number {
  // Buffer is Node-only; TextEncoder is universal.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (typeof (globalThis as any).Buffer !== "undefined") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (globalThis as any).Buffer.byteLength(s, "utf8");
  }
  return new TextEncoder().encode(s).byteLength;
}
