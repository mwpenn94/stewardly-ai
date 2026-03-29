import pino from "pino";

/**
 * Production-grade structured logger using pino.
 * Every log entry includes a timestamp (ISO 8601) and operation name.
 *
 * Usage:
 *   import { logger } from "./logger";
 *   logger.info({ operation: "startServer" }, "Server started on port 3000");
 *   logger.error({ operation: "dbConnect", err }, "Database connection failed");
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

export type Logger = typeof logger;
