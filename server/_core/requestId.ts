import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import { logger } from "./logger";

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

/**
 * UUID v4 pattern for fast regex pre-check.
 * Catches obvious injection attempts (HTML, SQL, newlines, etc.)
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Safe ID pattern: alphanumeric strings with hyphens/underscores (max 128 chars).
 * Allows non-UUID correlation IDs from upstream services.
 */
const SAFE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/**
 * Validates that an incoming request ID is safe to propagate.
 * Accepts UUIDs and alphanumeric strings up to 128 chars.
 * Rejects anything that could be used for header/log injection.
 */
function isValidRequestId(id: string): boolean {
  return UUID_PATTERN.test(id) || SAFE_ID_PATTERN.test(id);
}

/**
 * Middleware that generates a UUID v4 per request and attaches it to req.requestId.
 * Also sets the X-Request-ID response header for traceability.
 *
 * Security:
 * - Client-provided X-Request-Id is validated against safe character sets.
 * - Malformed or oversized IDs are rejected and replaced with a fresh UUID.
 * - Prevents log injection via crafted request IDs containing newlines or control chars.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"] as string | undefined;
  const requestId = (incoming && isValidRequestId(incoming)) ? incoming : uuidv4();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  logger.info(
    { operation: "incomingRequest", requestId, method: req.method, path: req.path },
    `${req.method} ${req.path}`
  );

  next();
}
