/**
 * Sentry Error Tracking — Optional Integration
 *
 * Initializes Sentry if SENTRY_DSN is set. Provides captureException
 * and a request error handler for Express. No-ops gracefully when
 * Sentry is not configured or @sentry/node is not installed.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sentryInstance: any = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Dynamic import — @sentry/node is an optional peer dependency
    const Sentry = await (Function('return import("@sentry/node")')() as Promise<any>);
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || "development",
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      beforeSend(event: any) {
        if (event.request?.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
        return event;
      },
    });
    sentryInstance = Sentry;
    console.log("[Sentry] Initialized successfully");
  } catch {
    console.warn("[Sentry] @sentry/node not installed, skipping error tracking");
  }
}

export function captureException(err: unknown): void {
  sentryInstance?.captureException(err);
}

export function getSentry() {
  return sentryInstance;
}
