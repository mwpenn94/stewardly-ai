import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
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
 * Fast pre-check: rejects obviously malformed IDs (wrong length, illegal chars)
 * before the more expensive uuid.validate() call.
 */
const UUID_FAST_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Request ID middleware with injection rejection.
 *
 * Accepts a client-provided X-Request-Id only if it passes UUID v4 validation.
 * Non-UUID values are rejected and replaced with a server-generated UUID to
 * prevent log-forging attacks (e.g., injecting newlines, JSON payloads, or
 * excessively long strings into structured logs).
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers["x-request-id"] as string | undefined;
  let requestId: string;

  if (incoming && UUID_FAST_RE.test(incoming) && uuidValidate(incoming)) {
    requestId = incoming;
  } else {
    if (incoming) {
      logger.warn(
        { operation: "requestIdRejected", rejected: incoming.slice(0, 72), ip: req.ip },
        "Rejected malformed X-Request-Id header"
      );
    }
    requestId = uuidv4();
  }

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  logger.info(
    { operation: "incomingRequest", requestId, method: req.method, path: req.path },
    `${req.method} ${req.path}`
  );

  next();
}
