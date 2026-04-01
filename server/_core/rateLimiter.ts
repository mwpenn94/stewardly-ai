import rateLimit from "express-rate-limit";
import { logger } from "./logger";

// ─── Rate Limit Messages (DRY constants) ──────────────────────
const MESSAGES = {
  general: "Too many requests, please try again later.",
  sensitive: "Too many sensitive operation requests, please try again later.",
  auth: "Too many authentication attempts, please try again later.",
} as const;

// ─── Skip static assets from rate limiting ────────────────────
const STATIC_EXTENSIONS = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot|map)$/;
function skipStatic(req: { path: string }): boolean {
  return STATIC_EXTENSIONS.test(req.path);
}

/**
 * General rate limiter: 100 requests per 15-minute window.
 * Skips static asset requests to avoid penalizing normal page loads.
 */
export const generalLimiter = rateLimit({
  windowMs: 900_000, // 15 minutes
  max: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipStatic,
  message: { error: MESSAGES.general },
  handler: (req, res, _next, options) => {
    logger.warn(
      { operation: "rateLimitExceeded", requestId: (req as any).requestId, ip: req.ip, path: req.path, limiter: "general" },
      `Rate limit exceeded: ${req.ip} on ${req.path}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Sensitive tRPC route limiter: 20 requests per 15-minute window.
 * Applies to tRPC routes containing send/execute/invoke/analyze.
 */
export const sensitiveTrpcLimiter = rateLimit({
  windowMs: 900_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: { error: MESSAGES.sensitive },
  handler: (req, res, _next, options) => {
    logger.warn(
      { operation: "rateLimitExceeded", requestId: (req as any).requestId, ip: req.ip, path: req.path, limiter: "sensitiveTrpc" },
      `Sensitive tRPC rate limit exceeded: ${req.ip} on ${req.path}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Auth route limiter: 5 requests per 15-minute window.
 */
export const authLimiter = rateLimit({
  windowMs: 900_000,
  max: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: { error: MESSAGES.auth },
  handler: (req, res, _next, options) => {
    logger.warn(
      { operation: "rateLimitExceeded", requestId: (req as any).requestId, ip: req.ip, path: req.path, limiter: "auth" },
      `Auth rate limit exceeded: ${req.ip} on ${req.path}`
    );
    res.status(options.statusCode).json(options.message);
  },
});

/**
 * Middleware that applies the sensitive tRPC limiter only to routes
 * containing send/execute/invoke/analyze in the path.
 */
export function sensitiveTrpcGuard(req: any, res: any, next: any): void {
  const sensitivePattern = /\b(send|execute|invoke|analyze)\b/i;
  if (sensitivePattern.test(req.path)) {
    sensitiveTrpcLimiter(req, res, next);
  } else {
    next();
  }
}
