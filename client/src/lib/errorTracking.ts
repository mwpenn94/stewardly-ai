/**
 * errorTracking — Client-side error tracking service.
 *
 * Captures unhandled errors, promise rejections, and tRPC errors,
 * batches them, and sends to the backend for admin monitoring.
 * Includes deduplication, rate limiting, and context enrichment.
 */

interface ErrorReport {
  message: string;
  stack?: string;
  source: "unhandled" | "promise" | "trpc" | "manual";
  url: string;
  timestamp: number;
  userAgent: string;
  fingerprint: string;
  metadata?: Record<string, unknown>;
}

const MAX_QUEUE_SIZE = 50;
const FLUSH_INTERVAL_MS = 10_000; // 10 seconds
const DEDUP_WINDOW_MS = 60_000; // 1 minute

let errorQueue: ErrorReport[] = [];
let recentFingerprints = new Map<string, number>();
let flushTimer: ReturnType<typeof setInterval> | null = null;

function generateFingerprint(message: string, stack?: string): string {
  const key = `${message}:${(stack || "").split("\n")[1] || ""}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

function isDuplicate(fingerprint: string): boolean {
  const now = Date.now();
  const lastSeen = recentFingerprints.get(fingerprint);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }
  recentFingerprints.set(fingerprint, now);
  // Clean old entries
  if (recentFingerprints.size > 100) {
    for (const [key, time] of recentFingerprints) {
      if (now - time > DEDUP_WINDOW_MS) recentFingerprints.delete(key);
    }
  }
  return false;
}

function enqueue(report: ErrorReport) {
  if (isDuplicate(report.fingerprint)) return;
  errorQueue.push(report);
  if (errorQueue.length > MAX_QUEUE_SIZE) {
    errorQueue = errorQueue.slice(-MAX_QUEUE_SIZE);
  }
}

async function flush() {
  if (errorQueue.length === 0) return;
  const batch = [...errorQueue];
  errorQueue = [];

  try {
    await fetch("/api/trpc/system.logClientErrors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        json: { errors: batch },
      }),
    });
  } catch {
    // Re-enqueue on failure (but don't grow unbounded)
    errorQueue.push(...batch.slice(0, 10));
  }
}

/**
 * Initialize global error tracking. Call once in main.tsx.
 */
export function initErrorTracking() {
  // Unhandled errors
  window.addEventListener("error", (event) => {
    const fingerprint = generateFingerprint(event.message, event.error?.stack);
    enqueue({
      message: event.message,
      stack: event.error?.stack,
      source: "unhandled",
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      fingerprint,
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const message = event.reason?.message || String(event.reason);
    const stack = event.reason?.stack;
    const fingerprint = generateFingerprint(message, stack);
    enqueue({
      message,
      stack,
      source: "promise",
      url: window.location.href,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      fingerprint,
    });
  });

  // Periodic flush
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);

  // Flush on page unload
  window.addEventListener("beforeunload", () => {
    flush();
  });
}

/**
 * Manually track an error (e.g., from a catch block).
 */
export function trackError(
  error: Error | string,
  metadata?: Record<string, unknown>
) {
  const message = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;
  const fingerprint = generateFingerprint(message, stack);
  enqueue({
    message,
    stack,
    source: "manual",
    url: window.location.href,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    fingerprint,
    metadata,
  });
}

/**
 * Track a tRPC error with procedure context.
 */
export function trackTRPCError(
  procedurePath: string,
  error: any
) {
  const message = error?.message || "Unknown tRPC error";
  const fingerprint = generateFingerprint(`trpc:${procedurePath}:${message}`);
  enqueue({
    message: `[tRPC ${procedurePath}] ${message}`,
    stack: error?.stack,
    source: "trpc",
    url: window.location.href,
    timestamp: Date.now(),
    userAgent: navigator.userAgent,
    fingerprint,
    metadata: {
      procedurePath,
      code: error?.data?.code,
      httpStatus: error?.data?.httpStatus,
    },
  });
}
