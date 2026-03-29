import rateLimit from "express-rate-limit";
import { logger } from "./logger";

/**
 * General rate limiter: 100 requests per 15-minute window.
 */
export const generalLimiter = rateLimit({
  windowMs: 900_000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: { error: "Too many requests, please try again later" },
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
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: { error: "Too many sensitive operation requests, please try again later" },
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
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, default: true },
  message: { error: "Too many authentication attempts, please try again later" },
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
