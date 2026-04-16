/**
 * Performance Monitor — Web Vitals tracking and reporting
 *
 * Tracks Core Web Vitals (LCP, FID, CLS, INP, TTFB) and custom metrics.
 * Reports to the backend for admin monitoring.
 * Uses PerformanceObserver API (no external dependencies).
 */

interface PerformanceMetric {
  name: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor";
  timestamp: number;
}

interface PerformanceReport {
  url: string;
  metrics: PerformanceMetric[];
  navigationTiming: {
    domContentLoaded: number;
    loadComplete: number;
    firstPaint: number;
    firstContentfulPaint: number;
  };
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
  };
}

const metrics: PerformanceMetric[] = [];
let reportCallback: ((report: PerformanceReport) => void) | null = null;

// ─── Thresholds (based on Google's Web Vitals) ───────────────────────────

const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
} as const;

function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = THRESHOLDS[name as keyof typeof THRESHOLDS];
  if (!threshold) return "good";
  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

// ─── Observers ────────────────────────────────────────────────────────────

function observeLCP() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        const value = lastEntry.startTime;
        metrics.push({
          name: "LCP",
          value,
          rating: getRating("LCP", value),
          timestamp: Date.now(),
        });
      }
    });
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch { /* Observer not supported */ }
}

function observeFID() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const fidEntry = entry as PerformanceEventTiming;
        const value = fidEntry.processingStart - fidEntry.startTime;
        metrics.push({
          name: "FID",
          value,
          rating: getRating("FID", value),
          timestamp: Date.now(),
        });
      }
    });
    observer.observe({ type: "first-input", buffered: true });
  } catch { /* Observer not supported */ }
}

function observeCLS() {
  if (typeof PerformanceObserver === "undefined") return;
  try {
    let clsValue = 0;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      // Update the CLS metric
      const existing = metrics.find((m) => m.name === "CLS");
      if (existing) {
        existing.value = clsValue;
        existing.rating = getRating("CLS", clsValue);
      } else {
        metrics.push({
          name: "CLS",
          value: clsValue,
          rating: getRating("CLS", clsValue),
          timestamp: Date.now(),
        });
      }
    });
    observer.observe({ type: "layout-shift", buffered: true });
  } catch { /* Observer not supported */ }
}

function observeNavigationTiming(): {
  domContentLoaded: number;
  loadComplete: number;
  firstPaint: number;
  firstContentfulPaint: number;
} {
  const result = { domContentLoaded: 0, loadComplete: 0, firstPaint: 0, firstContentfulPaint: 0 };

  if (typeof performance === "undefined") return result;

  const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
  if (navEntries.length > 0) {
    const nav = navEntries[0];
    result.domContentLoaded = nav.domContentLoadedEventEnd - nav.fetchStart;
    result.loadComplete = nav.loadEventEnd - nav.fetchStart;

    // TTFB
    const ttfb = nav.responseStart - nav.fetchStart;
    metrics.push({
      name: "TTFB",
      value: ttfb,
      rating: getRating("TTFB", ttfb),
      timestamp: Date.now(),
    });
  }

  const paintEntries = performance.getEntriesByType("paint");
  for (const entry of paintEntries) {
    if (entry.name === "first-paint") result.firstPaint = entry.startTime;
    if (entry.name === "first-contentful-paint") result.firstContentfulPaint = entry.startTime;
  }

  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Initialize performance monitoring. Call once at app startup.
 */
export function initPerformanceMonitor(callback?: (report: PerformanceReport) => void) {
  reportCallback = callback || null;

  observeLCP();
  observeFID();
  observeCLS();

  // Report after page load
  if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
      setTimeout(() => {
        const report = generateReport();
        reportCallback?.(report);
      }, 3000); // Wait 3s after load for metrics to settle
    });
  }
}

/**
 * Generate a performance report.
 */
export function generateReport(): PerformanceReport {
  const navigationTiming = observeNavigationTiming();

  const report: PerformanceReport = {
    url: typeof window !== "undefined" ? window.location.pathname : "",
    metrics: [...metrics],
    navigationTiming,
  };

  // Memory usage (Chrome only)
  if (typeof performance !== "undefined" && (performance as any).memory) {
    const mem = (performance as any).memory;
    report.memoryUsage = {
      usedJSHeapSize: mem.usedJSHeapSize,
      totalJSHeapSize: mem.totalJSHeapSize,
    };
  }

  return report;
}

/**
 * Get the current metrics.
 */
export function getMetrics(): PerformanceMetric[] {
  return [...metrics];
}

/**
 * Get a summary of all metrics as a formatted string.
 */
export function getMetricsSummary(): string {
  if (metrics.length === 0) return "No metrics collected yet";
  return metrics
    .map((m) => `${m.name}: ${m.value.toFixed(1)}ms (${m.rating})`)
    .join(", ");
}
