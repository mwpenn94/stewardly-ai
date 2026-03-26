import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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
import { getCSPHeaders } from "../services/mfaService";
import { validateRequiredEnvVars } from "./envValidation";

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

  // ─── Security Headers Middleware ──────────────────────────────────────
  app.use((req, res, next) => {
    const headers = getCSPHeaders();
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    next();
  });

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

  // ─── Rate Limiting ────────────────────────────────────────────────────
  const rateLimitWindow = new Map<string, { count: number; resetAt: number }>();
  const RATE_LIMIT_MAX = 200; // requests per window
  const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  const AUTH_RATE_LIMIT_MAX = 20; // stricter limit for auth endpoints

  app.use((req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const isAuthEndpoint = req.path.startsWith("/api/auth") || req.path.startsWith("/api/oauth");
    const maxRequests = isAuthEndpoint ? AUTH_RATE_LIMIT_MAX : RATE_LIMIT_MAX;
    const key = isAuthEndpoint ? `auth:${ip}` : ip;
    const now = Date.now();
    const entry = rateLimitWindow.get(key);

    if (!entry || now > entry.resetAt) {
      rateLimitWindow.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      next();
      return;
    }

    entry.count++;
    if (entry.count > maxRequests) {
      res.status(429).json({ error: "Too many requests, please try again later" });
      return;
    }
    next();
  });

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
  // tRPC API
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
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    // Initialize background scheduler for health checks and data pipelines
    initScheduler();
  });
}

startServer().catch(console.error);
