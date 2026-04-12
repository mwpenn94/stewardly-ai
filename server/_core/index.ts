import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomBytes } from "crypto";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGuestSessionRoutes } from "./guestSession";
import { registerSocialAuthRoutes } from "../services/socialOAuth";
import { registerWebhookRoutes } from "../routers/webhookIngestion";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initWebSocket } from "../services/websocketNotifications";
import { initScheduler } from "../services/scheduler";
import { bootstrapLearning } from "../services/learning/bootstrap";
import { startBlueprintScheduler } from "../services/dynamicIntegrations/blueprintScheduler";
import { validateRequiredEnvVars } from "./envValidation";
import { validateDatabaseSchema } from "./schemaValidation";
import { logger } from "./logger";
import { requestIdMiddleware } from "./requestId";
import { generalLimiter, authLimiter, sensitiveTrpcGuard } from "./rateLimiter";
import { createSSEStreamHandler } from "../shared/streaming";
import { contextualLLM } from "../shared/stewardlyWiring";
import { SEARCH_TOOLS, executeSearchTool } from "../webSearch";
import { sdk } from "./sdk";
import { initSentry, captureException } from "./sentry";
import { initOTel } from "../shared/telemetry/otel";
import { registerMCPEndpoint } from "../mcp/stewardlyServer";
import { runWithTenant } from "../shared/tenantContext";
import { sseConnectionLimiter } from "../shared/sseConnectionLimiter";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  // Initialize Sentry error tracking (no-ops if SENTRY_DSN not set)
  await initSentry();

  // Initialize OpenTelemetry (no-ops if OTEL_EXPORTER_OTLP_ENDPOINT not set)
  await initOTel();

  // Validate required environment variables (fails fast in production)
  validateRequiredEnvVars();

  // Validate database schema matches Drizzle definitions (non-blocking, logs warnings)
  validateDatabaseSchema().catch((err) =>
    logger.error({ operation: "schemaValidation", error: String(err) }, "Schema validation failed")
  );

  const app = express();
  const server = createServer(app);
  // Initialize WebSocket notifications
  initWebSocket(server);

  // ─── Trust Proxy (required for correct IP behind reverse proxy) ────────
  app.set("trust proxy", 1);

  // ─── Request ID Middleware (must be first) ──────────────────────────────
  app.use(requestIdMiddleware);

  // ─── Request + Response logging with duration ──────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const durationMs = Date.now() - start;
      logger.info(
        {
          operation: "requestComplete",
          requestId: req.requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs,
        },
        `${req.method} ${req.path} ${res.statusCode} ${durationMs}ms`
      );
    });
    next();
  });

  // ─── CSP Nonce Middleware ────────────────────────────────────────────────
  app.use((_req, res, next) => {
    res.locals.cspNonce = randomBytes(16).toString("base64");
    next();
  });

  // ─── Helmet Security Headers ───────────────────────────────────────────
  const isDev = process.env.NODE_ENV === 'development';
  app.use(
    helmet({
      // Disable CSP in dev — Vite injects an inline React Refresh preamble that
      // conflicts with nonce-based CSP. Full CSP is enforced in production only.
      contentSecurityPolicy: isDev
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
              styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "https://api.fontshare.com", (_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`],
              fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https://cdn.fontshare.com"],
              imgSrc: ["'self'", "data:", "https:", "blob:"],
              connectSrc: ["'self'", "https:", "wss:"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          },
      crossOriginEmbedderPolicy: false, // Allow CDN resources
    })
  );

  // ─── CORS Middleware ──────────────────────────────────────────────────
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
    : [];
  if (allowedOrigins.length > 0) {
    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        res.setHeader("Access-Control-Allow-Credentials", "true");
      }
      if (req.method === "OPTIONS") {
        res.sendStatus(204);
        return;
      }
      next();
    });
  }

  // ─── General Rate Limiting (100 req / 15 min) ────────────────────────
  app.use(generalLimiter);

  // ─── Auth Rate Limiting (5 req / 15 min) ─────────────────────────────
  app.use("/api/auth", authLimiter);
  app.use("/api/oauth", authLimiter);
  app.use("/auth", authLimiter);

  // Configure body parser with size limits
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // ─── Tenant Context Middleware (AsyncLocalStorage for non-tRPC routes) ──
  app.use(async (req, _res, next) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user?.affiliateOrgId) {
        return runWithTenant({ tenantId: user.affiliateOrgId, userId: user.id }, () => next());
      }
    } catch { /* Auth is optional — proceed without tenant context */ }
    next();
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Guest session auto-provisioning
  registerGuestSessionRoutes(app);
  // Social OAuth (Google + LinkedIn)
  registerSocialAuthRoutes(app);
  // Public webhook ingestion endpoints
  registerWebhookRoutes(app);

  // ─── Health / Readiness Probes (plain HTTP, no auth) ─────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
  app.get("/ready", async (_req, res) => {
    try {
      const { getDb } = await import("../db");
      const db = await getDb();
      if (!db) {
        res.status(503).json({ status: "not_ready", reason: "database_unavailable" });
        return;
      }
      res.json({ status: "ready" });
    } catch {
      res.status(503).json({ status: "not_ready", reason: "database_error" });
    }
  });

  // ─── MCP Server (Model Context Protocol) ────────────────────────────
  await registerMCPEndpoint(app);

  // ─── TTS Audio endpoint (Edge TTS for AudioCompanion) ──────────────
  const ttsRouter = (await import("../routes/tts")).default;

  // ─── Code Chat SSE streaming endpoint ─────────────────────────────
  const codeChatStreamRouter = (await import("../routes/codeChatStream")).default;
  // ─── Automation telemetry SSE stream (pass 6) ────────────────────
  const automationTelemetryStreamRouter = (await import("../routes/automationTelemetryStream")).default;

  // ─── Auth middleware for TTS, MCP, CodeChat, Automation SSE ──────
  // CBL17 security hardening: TTS + MCP were previously unauthenticated
  app.use(async (req, res, next) => {
    const needsAuth =
      (req.path === "/api/codechat/stream" && req.method === "POST") ||
      (req.path === "/api/automation/telemetry/stream" && req.method === "GET") ||
      (req.path === "/api/tts" && req.method === "POST") ||
      (req.path === "/api/tts/voices" && req.method === "GET") ||
      (req.path === "/mcp/sse" && req.method === "GET") ||
      (req.path === "/mcp/call" && req.method === "POST");
    if (needsAuth) {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
        (req as any).__user = user;
        next();
      } catch { res.status(401).json({ error: "Unauthorized" }); }
    } else { next(); }
  });
  app.use(ttsRouter);
  app.use(codeChatStreamRouter);
  app.use(automationTelemetryStreamRouter);

  // ─── SSE Streaming endpoint ──────────────────────────────────────────
  app.post("/api/chat/stream", generalLimiter, async (req, res) => {
    try {
      // Authenticate using same session mechanism as tRPC
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // CBL17: per-user SSE connection limit
      const connId = sseConnectionLimiter.acquire(user.id, "chat");
      if (!connId) {
        res.status(429).json({ error: "Too many concurrent chat streams" });
        return;
      }
      req.on("close", () => sseConnectionLimiter.release(connId));

      const { messages, sessionId, contextType, model } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      // Validate individual message objects have required shape
      const invalidMsg = messages.find(
        (m: any) => !m || typeof m !== "object" || typeof m.role !== "string" || (m.content !== undefined && m.content !== null && typeof m.content !== "string"),
      );
      if (invalidMsg) {
        res.status(400).json({ error: "each message must have a string role and optional string content" });
        return;
      }

      // Validate sessionId is a number if provided
      const validSessionId = sessionId != null ? Number(sessionId) : undefined;
      if (sessionId != null && (isNaN(validSessionId!) || validSessionId! <= 0)) {
        res.status(400).json({ error: "sessionId must be a positive number" });
        return;
      }

      // CBL17: validate contextType against whitelist
      const VALID_CONTEXT_TYPES = new Set(["chat", "document", "financial", "legal", "learning", "code"]);
      const safeContextType = VALID_CONTEXT_TYPES.has(contextType) ? contextType : "chat";

      await createSSEStreamHandler(req, res, {
        contextualLLM,
        userId: user.id,
        sessionId: validSessionId,
        contextType: safeContextType,
        messages,
        model: model || undefined,
        tools: SEARCH_TOOLS as Array<Record<string, unknown>>,
        executeSearchTool,
      });
    } catch (err: any) {
      if (!res.headersSent) {
        if (err.message?.includes("session") || err.message?.includes("Forbidden")) {
          res.status(401).json({ error: "Unauthorized" });
        } else {
          logger.error({ operation: "sseStream.routeError", error: err.message }, "[SSE] Route error");
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  });

  // ─── Round D1 — Multi-model consensus SSE endpoint ───────────────────
  // True streaming version of wealthEngine.consensusStream. Drives the
  // streamConsensus core (server/services/consensusStream.ts) and writes
  // each ConsensusEvent to the response with the canonical encodeSseEvent
  // wire format. Same auth + rate limiter as the chat stream endpoint.
  app.post("/api/consensus/stream", generalLimiter, async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      // CBL17: per-user SSE connection limit
      const connId = sseConnectionLimiter.acquire(user.id, "consensus");
      if (!connId) {
        res.status(429).json({ error: "Too many concurrent consensus streams" });
        return;
      }
      req.on("close", () => sseConnectionLimiter.release(connId));

      const {
        question,
        selectedModels: rawSelectedModels,
        modelWeights: rawModelWeights,
        timeBudgetMs: rawTimeBudgetMs,
        maxModels: rawMaxModels,
        domain: rawDomain,
      } = req.body ?? {};
      if (!question || typeof question !== "string") {
        res.status(400).json({ error: "question (string) is required" });
        return;
      }
      if (question.length > 10_000) {
        res.status(400).json({ error: "question exceeds 10000 character limit" });
        return;
      }

      // CBL17: strict input validation — bound arrays and numbers
      const selectedModels = Array.isArray(rawSelectedModels)
        ? rawSelectedModels.filter((m: unknown) => typeof m === "string").slice(0, 10) as string[]
        : undefined;
      const modelWeights = (typeof rawModelWeights === "object" && rawModelWeights !== null && !Array.isArray(rawModelWeights))
        ? Object.fromEntries(
            Object.entries(rawModelWeights as Record<string, unknown>)
              .filter(([k, v]) => typeof k === "string" && typeof v === "number" && v >= 0 && v <= 10)
              .slice(0, 10),
          ) as Record<string, number>
        : undefined;
      const timeBudgetMs = typeof rawTimeBudgetMs === "number" && rawTimeBudgetMs > 0 && rawTimeBudgetMs <= 300_000
        ? rawTimeBudgetMs
        : undefined;
      const maxModels = typeof rawMaxModels === "number" && rawMaxModels > 0 && rawMaxModels <= 10
        ? rawMaxModels
        : undefined;
      const domain = typeof rawDomain === "string" && rawDomain.length <= 100
        ? rawDomain
        : undefined;

      // Lazy-import so we don't pull the consensus core into the cold-start path
      const { streamConsensus, encodeSseEvent } = await import(
        "../services/consensusStream"
      );

      // SSE headers — match the chat stream handler
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      // Heartbeat every 15s so the connection stays open through proxies
      const heartbeat = setInterval(() => {
        try {
          res.write(": heartbeat\n\n");
        } catch {
          /* ignore */
        }
      }, 15_000);

      const cleanup = () => clearInterval(heartbeat);

      try {
        await streamConsensus(
          {
            question,
            selectedModels: Array.isArray(selectedModels) ? selectedModels : undefined,
            modelWeights: typeof modelWeights === "object" && modelWeights !== null ? modelWeights : undefined,
            timeBudgetMs: typeof timeBudgetMs === "number" ? timeBudgetMs : undefined,
            maxModels: typeof maxModels === "number" ? maxModels : undefined,
            domain: typeof domain === "string" ? domain : undefined,
            userId: user.id,
          },
          (event) => {
            try {
              res.write(encodeSseEvent(event));
            } catch (writeErr) {
              logger.warn({ writeErr }, "[ConsensusSSE] write failed");
            }
          },
        );
      } catch (streamErr) {
        const message = streamErr instanceof Error ? streamErr.message : "stream failed";
        try {
          res.write(
            encodeSseEvent({ type: "error", ts: Date.now(), error: message }),
          );
        } catch {
          /* ignore */
        }
      } finally {
        cleanup();
        try {
          res.end();
        } catch {
          /* ignore */
        }
      }
    } catch (err: any) {
      if (!res.headersSent) {
        if (err.message?.includes("session") || err.message?.includes("Forbidden")) {
          res.status(401).json({ error: "Unauthorized" });
        } else {
          logger.error(
            { operation: "consensusSSE.routeError", error: err.message },
            "[ConsensusSSE] Route error",
          );
          res.status(500).json({ error: "Internal server error" });
        }
      }
    }
  });

  // ─── Public API v1 — PARITY-API-0001 (hybrid build loop pass 6) ─────
  // Mounts BEFORE /api/trpc so /api/v1/* is not accidentally caught by
  // the tRPC catch-all middleware. Bearer-auth gated via an env-backed
  // validator; set STWLY_API_KEYS env var to a JSON array of
  // `{token, record}` pairs to enable keys in production.
  const { buildApiV1Router, defaultEnvValidator } = await import("../api/v1/router");
  app.use(
    "/api/v1",
    buildApiV1Router({ validate: defaultEnvValidator() }),
  );

  // ─── tRPC API with sensitive route rate limiting ─────────────────────
  app.use("/api/trpc", sensitiveTrpcGuard);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    logger.info({ operation: "portFallback", preferredPort, actualPort: port }, `Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    logger.info({ operation: "startServer", port }, `Server running on http://localhost:${port}/`);
    // Initialize background scheduler for health checks and data pipelines
    initScheduler();

    // CBL19: Activate cron manager for fine-grained data pipeline scheduling
    // This complements initScheduler — cronManager handles per-provider timing
    // and connection-level syncs that the general scheduler doesn't cover
    import("../services/cronManager").then(({ startCronManager, registerPlatformJobs }) => {
      registerPlatformJobs({
        fred: process.env.FRED_API_KEY,
        bls: process.env.BLS_API_KEY,
        census: process.env.CENSUS_API_KEY,
        bea: process.env.BEA_API_KEY,
      });
      startCronManager();
      logger.info({ operation: "cronManager" }, "Cron manager started with platform jobs");
    }).catch((err) =>
      logger.warn({ operation: "cronManager", err: String(err) }, "Cron manager startup failed (non-fatal)"),
    );

    // Bootstrap EMBA Learning: seed catalog + register ReAct agent tools (idempotent, non-blocking)
    bootstrapLearning().catch((err) =>
      logger.warn({ operation: "bootstrapLearning", err: String(err) }, "bootstrapLearning failed"),
    );
    // Dynamic-integration blueprint scheduler — 60s tick, runs active blueprints
    // whose scheduleCron matches the current minute.
    try {
      startBlueprintScheduler();
    } catch (err) {
      logger.warn({ operation: "startBlueprintScheduler", err: String(err) }, "blueprint scheduler failed to start");
    }
  });

  // ── Graceful shutdown ─────────────────────────────────────────────
  const shutdown = () => {
    logger.info({ operation: "server.shutdown" }, "Received shutdown signal, closing server...");
    server.close(() => {
      logger.info({ operation: "server.shutdown" }, "Server closed gracefully");
      logger.flush();
      setTimeout(() => process.exit(0), 100);
    });
    // Force exit after 10s if connections don't close
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // ── Crash handlers ────────────────────────────────────────────────
  process.on("uncaughtException", (err) => {
    captureException(err);
    logger.error({ operation: "uncaughtException", err }, "Uncaught exception");
    logger.flush();
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    captureException(reason);
    logger.error({ operation: "unhandledRejection", err: reason }, "Unhandled rejection");
  });
}

startServer().catch((err) => {
  logger.error({ operation: "startServer", err }, "Failed to start server");
  process.exit(1);
});
