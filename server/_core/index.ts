import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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
import { validateRequiredEnvVars } from "./envValidation";
import { logger } from "./logger";
import { requestIdMiddleware } from "./requestId";
import { generalLimiter, authLimiter, sensitiveTrpcGuard } from "./rateLimiter";
import { createSSEStreamHandler } from "../shared/streaming";
import { contextualLLM } from "../shared/stewardlyWiring";
import { sdk } from "./sdk";

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
  // Validate required environment variables (fails fast in production)
  validateRequiredEnvVars();

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

  // ─── Helmet Security Headers ───────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "'unsafe-inline'"],
          styleSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
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
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Guest session auto-provisioning
  registerGuestSessionRoutes(app);
  // Social OAuth (Google + LinkedIn)
  registerSocialAuthRoutes(app);
  // Public webhook ingestion endpoints
  registerWebhookRoutes(app);

  // ─── SSE Streaming endpoint ──────────────────────────────────────────
  app.post("/api/chat/stream", async (req, res) => {
    try {
      // Authenticate using same session mechanism as tRPC
      const user = await sdk.authenticateRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const { messages, sessionId, contextType } = req.body;
      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      await createSSEStreamHandler(req, res, {
        contextualLLM,
        userId: user.id,
        sessionId: sessionId || undefined,
        contextType: contextType || "chat",
        messages,
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
}

startServer().catch((err) => {
  logger.error({ operation: "startServer", err }, "Failed to start server");
  process.exit(1);
});
