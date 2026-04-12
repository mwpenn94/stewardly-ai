/**
 * /api/v1 — Express sub-router that mounts the public API surface.
 *
 * Shipped by Pass 6 of the hybrid build loop — PARITY-API-0001.
 *
 * This module owns:
 *   - Public `/health` and `/openapi.json` endpoints
 *   - Bearer auth middleware gate for everything else
 *   - Rate limiter
 *   - Read-only handlers that wrap the Pass-1..5 pure services
 *
 * None of the handlers touch the database directly — they all
 * delegate to pure functions in `server/services/*`. This keeps the
 * public surface stable even if the internal tRPC routers change.
 *
 * The default key validator in production should query the existing
 * api_keys table. For now we ship a simple env-backed validator that
 * reads `STWLY_API_KEYS` (newline-separated JSON records) so we can
 * dogfood the endpoint without a migration. Tests supply their own
 * in-memory validator via `buildApiV1Router(validateKey)`.
 */

import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { bearerAuthMiddleware, type ApiKeyValidator } from "./auth";
import { rateLimitMiddleware, type RateLimitConfig } from "./rateLimit";
import { buildOpenApiDoc } from "./openapi";
import {
  overallSummary as comparablesSummary,
  buildGapMatrix as comparablesGapMatrix,
  priorityRecommendations as comparablesPriorities,
} from "../../services/comparables/scoring";
import {
  computeDrift,
  type Holding,
  type TargetAllocation,
  type RebalanceOptions,
} from "../../services/portfolio/rebalancing";
import {
  projectYear as taxProjectYear,
  type YearContext,
} from "../../services/tax/projector";
import {
  runLedger as ledgerRun,
  type Transaction,
  type CostBasisMethod,
} from "../../services/portfolio/ledger";
import {
  buildFiduciaryReport,
  type FiduciaryReportInput,
} from "../../services/reports/fiduciaryReport";

export interface ApiV1Options {
  validate: ApiKeyValidator;
  rateLimit?: RateLimitConfig;
  version?: string;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  capacity: 60, // 60 request burst
  refillPerSec: 1, // 60 rpm steady state
};

/**
 * Build the public API v1 Express router.
 *
 * Splitting this behind a factory (rather than a module-level
 * singleton) keeps tests clean — each test can spin up a fresh
 * router with a stubbed validator and isolated rate-limit state.
 */
export function buildApiV1Router(options: ApiV1Options): Router {
  const router = Router();
  const version = options.version ?? "1.0.0";
  const rateLimit = options.rateLimit ?? DEFAULT_RATE_LIMIT;

  // ── Public endpoints ───────────────────────────────────────────

  router.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "ok",
      version,
      serverTime: new Date().toISOString(),
    });
  });

  router.get("/openapi.json", (_req: Request, res: Response) => {
    res.status(200).json(buildOpenApiDoc({ version }));
  });

  // ── Authed endpoints ───────────────────────────────────────────

  const auth = bearerAuthMiddleware(options.validate);
  const limit = rateLimitMiddleware(rateLimit);
  router.use(auth);
  router.use(limit);

  router.get("/comparables/summary", (_req: Request, res: Response) => {
    try {
      res.json(comparablesSummary());
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/comparables/gaps", (_req: Request, res: Response) => {
    try {
      res.json(comparablesGapMatrix());
    } catch (err) {
      handleError(res, err);
    }
  });

  router.get("/comparables/priorities", (req: Request, res: Response) => {
    try {
      const limitParam = req.query.limit;
      const n =
        typeof limitParam === "string" ? parseInt(limitParam, 10) : 5;
      const finalLimit = Number.isFinite(n) && n > 0 && n <= 50 ? n : 5;
      res.json(comparablesPriorities(finalLimit));
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/rebalancing/simulate", (req: Request, res: Response) => {
    const body = req.body as {
      holdings?: unknown;
      targets?: unknown;
      options?: RebalanceOptions;
    };
    if (!Array.isArray(body?.holdings) || !Array.isArray(body?.targets)) {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: "`holdings` and `targets` must be arrays.",
        },
      });
      return;
    }
    try {
      const result = computeDrift(
        body.holdings as Holding[],
        body.targets as TargetAllocation[],
        body.options,
      );
      res.json(result);
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/tax/project-year", (req: Request, res: Response) => {
    const body = req.body as YearContext;
    if (!body || typeof body !== "object" || typeof body.year !== "number") {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: "Request must be a YearContext object with a numeric `year`.",
        },
      });
      return;
    }
    try {
      res.json(taxProjectYear(body));
    } catch (err) {
      handleError(res, err);
    }
  });

  router.post("/portfolio-ledger/run", (req: Request, res: Response) => {
    const body = req.body as {
      transactions?: unknown;
      method?: CostBasisMethod;
    };
    if (!Array.isArray(body?.transactions)) {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message: "`transactions` must be an array.",
        },
      });
      return;
    }
    try {
      res.json(ledgerRun(body.transactions as Transaction[], body.method));
    } catch (err) {
      handleError(res, err);
    }
  });

  // Pass 15 — cross-module fiduciary report via the public surface.
  router.post("/reports/fiduciary", (req: Request, res: Response) => {
    const body = req.body as Partial<FiduciaryReportInput>;
    if (
      !body ||
      typeof body !== "object" ||
      typeof body.clientName !== "string" ||
      typeof body.advisorName !== "string" ||
      typeof body.generatedAt !== "string"
    ) {
      res.status(400).json({
        error: {
          code: "invalid_request",
          message:
            "`clientName`, `advisorName`, and `generatedAt` (ISO string) are required.",
        },
      });
      return;
    }
    try {
      res.json(buildFiduciaryReport(body as FiduciaryReportInput));
    } catch (err) {
      handleError(res, err);
    }
  });

  // 404 handler for anything else under /api/v1
  router.use((_req: Request, res: Response, _next: NextFunction) => {
    res.status(404).json({
      error: {
        code: "not_found",
        message: "Unknown endpoint. See /api/v1/openapi.json for available routes.",
      },
    });
  });

  return router;
}

function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(500).json({
    error: {
      code: "internal_error",
      message,
    },
  });
}

// ─── Default production validator ──────────────────────────────────────────

/**
 * Env-backed validator that reads `STWLY_API_KEYS` as a JSON array
 * of `ApiKeyRecord`. Empty / unset env returns a validator that
 * rejects everything. This lets the public API ship safely with
 * zero keys configured by default.
 *
 * In a real production setup this would query the api_keys table
 * via Drizzle — but that requires a DB connection in tests. Doing
 * env-backed keeps the Pass-6 surface shippable today.
 */
export function defaultEnvValidator(): ApiKeyValidator {
  const raw = process.env.STWLY_API_KEYS;
  if (!raw) return async () => null;
  let records: Array<{ token: string; record: import("./auth").ApiKeyRecord }>;
  try {
    records = JSON.parse(raw);
  } catch {
    return async () => null;
  }
  const byToken = new Map(records.map((r) => [r.token, r.record]));
  return async (token: string) => byToken.get(token) ?? null;
}
