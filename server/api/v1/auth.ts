/**
 * /api/v1 — bearer token authentication.
 *
 * Shipped by Pass 6 of the hybrid build loop — PARITY-API-0001.
 *
 * Design choices:
 *
 *   - Tokens are format-validated with the `stwly_` prefix
 *     (matching the `sk_live_` / `sk_test_` convention Stripe and
 *     other financial APIs use). This lets us key-rotate and spot
 *     leaked credentials with a simple regex scan.
 *   - Tokens are read from the `Authorization: Bearer <token>`
 *     header OR as a query param `?api_key=<token>` for quick
 *     cURL debugging. Header wins when both are present.
 *   - Validation is done by a caller-supplied validator function
 *     — this keeps the middleware pure (no DB lookup) and lets
 *     tests run offline. Production wires it to the api_keys
 *     table; tests wire it to an in-memory map.
 *   - When validation succeeds, the key payload (id + scopes) is
 *     attached to `req.apiKey` for downstream handlers.
 *   - A constant-time string comparison in `isValidFormat` would
 *     be overkill here — the regex already short-circuits on
 *     length mismatch and format, and the downstream validator
 *     is where the real secret check happens.
 *
 * All functions here are PURE (no DB, no process.env) so they can
 * be unit-tested offline.
 */

import type { Request, Response, NextFunction } from "express";

export interface ApiKeyRecord {
  /** Caller-chosen key id (UUID / slug / email etc). */
  id: string;
  /** Human label for audit logs. */
  label: string;
  /** Authorized scope list; wildcard "*" allows everything. */
  scopes: string[];
  /** Caller's user id for tenant scoping (when applicable). */
  userId?: number;
  /** Optional owning org id. */
  orgId?: number;
}

export type ApiKeyValidator = (token: string) => Promise<ApiKeyRecord | null>;

/**
 * Attached to `req` under this symbol after a successful bearer auth.
 * Downstream handlers read via `getRequestApiKey(req)` to avoid the
 * global module augmentation dance.
 */
export const API_KEY_REQ_PROP = Symbol("stewardly.apiKey");

export function setRequestApiKey(
  req: unknown,
  key: ApiKeyRecord | undefined,
): void {
  (req as Record<symbol, unknown>)[API_KEY_REQ_PROP] = key;
}

export function getRequestApiKey(req: unknown): ApiKeyRecord | undefined {
  return (req as Record<symbol, ApiKeyRecord | undefined>)[API_KEY_REQ_PROP];
}

const TOKEN_FORMAT = /^stwly_(live|test)_[A-Za-z0-9]{24,128}$/;

/** Pure format check — doesn't touch secrets. */
export function isValidFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  return TOKEN_FORMAT.test(token);
}

/** Pure extractor — reads Authorization header or ?api_key query. */
export function extractToken(req: Pick<Request, "headers" | "query">): string | null {
  const header = req.headers?.authorization;
  if (typeof header === "string") {
    const match = header.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1].trim();
  }
  const q = (req.query as Record<string, unknown> | undefined)?.api_key;
  if (typeof q === "string" && q.length > 0) return q;
  return null;
}

/** Pure scope check — wildcard * allows everything. */
export function hasScope(key: ApiKeyRecord, needed: string): boolean {
  if (!key || !Array.isArray(key.scopes)) return false;
  if (key.scopes.includes("*")) return true;
  if (key.scopes.includes(needed)) return true;
  // Hierarchical scopes: "read" matches "read.portfolio" via prefix.
  for (const scope of key.scopes) {
    if (needed.startsWith(`${scope}.`)) return true;
  }
  return false;
}

export interface AuthError {
  status: number;
  code: string;
  message: string;
}

/** Pure auth resolver — returns an AuthError or the validated key. */
export async function resolveAuth(
  req: Pick<Request, "headers" | "query">,
  validate: ApiKeyValidator,
): Promise<{ key?: ApiKeyRecord; error?: AuthError }> {
  const token = extractToken(req);
  if (!token) {
    return {
      error: {
        status: 401,
        code: "missing_credentials",
        message:
          "Missing bearer token. Use `Authorization: Bearer stwly_live_...` header or `?api_key=...` query param.",
      },
    };
  }
  if (!isValidFormat(token)) {
    return {
      error: {
        status: 401,
        code: "invalid_format",
        message:
          "Token does not match `stwly_(live|test)_<24-128 chars>` format.",
      },
    };
  }
  const record = await validate(token);
  if (!record) {
    return {
      error: {
        status: 401,
        code: "invalid_credentials",
        message: "Token not recognized or has been revoked.",
      },
    };
  }
  return { key: record };
}

/**
 * Express middleware factory. Pass in a validator (in-memory map
 * for tests, DB lookup for production) and an optional required
 * scope. Handlers can also check scopes themselves via `hasScope`.
 */
export function bearerAuthMiddleware(
  validate: ApiKeyValidator,
  requiredScope?: string,
) {
  return async function bearerAuth(
    req: Request,
    res: Response,
    next: NextFunction,
  ) {
    const { key, error } = await resolveAuth(req, validate);
    if (error) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    if (requiredScope && key && !hasScope(key, requiredScope)) {
      res.status(403).json({
        error: {
          code: "insufficient_scope",
          message: `Token lacks required scope '${requiredScope}'.`,
        },
      });
      return;
    }
    setRequestApiKey(req, key);
    next();
  };
}
