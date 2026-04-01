import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test" || process.env.VITEST === "true";

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
  level: isTest ? "silent" : (process.env.LOG_LEVEL || (isProduction ? "info" : "debug")),
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

/**
 * Create a child logger with operation context.
 * Every log entry from the child includes the operation name and timestamp.
 */
export function createOperationLogger(operation: string) {
  return logger.child({ operation });
}

export type Logger = typeof logger;
export default logger;
