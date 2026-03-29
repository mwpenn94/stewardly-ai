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
 * Middleware that generates a UUID v4 per request and attaches it to req.requestId.
 * Also sets the X-Request-ID response header for traceability.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string) || uuidv4();
  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  logger.info(
    { operation: "incomingRequest", requestId, method: req.method, path: req.path },
    `${req.method} ${req.path}`
  );

  next();
}
