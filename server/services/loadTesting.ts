/**
 * Task #56 — Load Testing + Performance Monitoring Service
 * Synthetic load generation, performance metrics, and bottleneck detection
 */

export interface PerformanceMetric {
  endpoint: string;
  method: string;
  avgLatency: number; // ms
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  requestCount: number;
  errorRate: number;
  throughput: number; // req/s
  timestamp: string;
}

export interface LoadTestConfig {
  name: string;
  targetEndpoints: string[];
  concurrentUsers: number;
  duration: number; // seconds
  rampUpTime: number; // seconds
  thinkTime: number; // ms between requests
}

export interface LoadTestResult {
  id: string;
  config: LoadTestConfig;
  startedAt: string;
  completedAt: string;
  metrics: PerformanceMetric[];
  summary: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgLatency: number;
    maxLatency: number;
    throughput: number;
    errorRate: number;
  };
  bottlenecks: Array<{ endpoint: string; issue: string; severity: "low" | "medium" | "high" }>;
  passed: boolean;
}

// Performance metrics collection
const metricsHistory: PerformanceMetric[] = [];

export function recordMetric(metric: PerformanceMetric): void {
  metricsHistory.push(metric);
  // Keep last 1000 metrics
  if (metricsHistory.length > 1000) metricsHistory.splice(0, metricsHistory.length - 1000);
}

export function getRecentMetrics(endpoint?: string, limit = 100): PerformanceMetric[] {
  let filtered = endpoint ? metricsHistory.filter(m => m.endpoint === endpoint) : metricsHistory;
  return filtered.slice(-limit);
}

export function getPerformanceSummary(): {
  endpoints: Array<{ endpoint: string; avgLatency: number; errorRate: number; requestCount: number }>;
  overallHealth: "healthy" | "degraded" | "critical";
  avgResponseTime: number;
  totalRequests: number;
} {
  const byEndpoint = new Map<string, PerformanceMetric[]>();
  for (const m of metricsHistory) {
    const existing = byEndpoint.get(m.endpoint) ?? [];
    existing.push(m);
    byEndpoint.set(m.endpoint, existing);
  }

  const endpoints = Array.from(byEndpoint.entries()).map(([endpoint, metrics]) => ({
    endpoint,
    avgLatency: Math.round(metrics.reduce((s, m) => s + m.avgLatency, 0) / metrics.length),
    errorRate: Math.round(metrics.reduce((s, m) => s + m.errorRate, 0) / metrics.length * 100) / 100,
    requestCount: metrics.reduce((s, m) => s + m.requestCount, 0),
  }));

  const avgResponseTime = endpoints.length > 0
    ? Math.round(endpoints.reduce((s, e) => s + e.avgLatency, 0) / endpoints.length)
    : 0;

  const maxErrorRate = endpoints.length > 0 ? Math.max(...endpoints.map(e => e.errorRate)) : 0;
  const overallHealth = maxErrorRate > 0.1 ? "critical" : avgResponseTime > 2000 ? "degraded" : "healthy";

  return {
    endpoints,
    overallHealth,
    avgResponseTime,
    totalRequests: metricsHistory.reduce((s, m) => s + m.requestCount, 0),
  };
}

/**
 * Real HTTP-based load test — sends actual requests to the server endpoints
 * and measures real latency, error rates, and throughput.
 */
export async function simulateLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
  const startedAt = new Date().toISOString();
  const allLatencies: Map<string, number[]> = new Map();
  const allErrors: Map<string, number> = new Map();
  const baseUrl = `http://localhost:${process.env.PORT || 3000}`;

  // Initialize tracking
  for (const ep of config.targetEndpoints) {
    allLatencies.set(ep, []);
    allErrors.set(ep, 0);
  }

  // Run requests in batches (concurrentUsers at a time)
  const totalIterations = Math.max(1, Math.floor(config.duration * 1000 / config.thinkTime));
  const batchSize = Math.min(config.concurrentUsers, 50); // Cap at 50 concurrent to avoid self-DoS
  const iterationsToRun = Math.min(totalIterations, 100); // Cap total iterations for safety

  for (let i = 0; i < iterationsToRun; i++) {
    const batch: Promise<void>[] = [];
    for (let j = 0; j < batchSize; j++) {
      for (const endpoint of config.targetEndpoints) {
        batch.push((async () => {
          const start = Date.now();
          try {
            const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;
            const resp = await fetch(url, {
              method: endpoint.includes("trpc") ? "GET" : "GET",
              headers: { "Content-Type": "application/json" },
              signal: AbortSignal.timeout(10000),
            });
            const latency = Date.now() - start;
            allLatencies.get(endpoint)!.push(latency);
            if (!resp.ok && resp.status >= 500) {
              allErrors.set(endpoint, (allErrors.get(endpoint) ?? 0) + 1);
            }
          } catch {
            const latency = Date.now() - start;
            allLatencies.get(endpoint)!.push(latency);
            allErrors.set(endpoint, (allErrors.get(endpoint) ?? 0) + 1);
          }
        })());
      }
    }
    await Promise.all(batch);
    // Think time between batches
    if (i < iterationsToRun - 1) {
      await new Promise(r => setTimeout(r, Math.min(config.thinkTime, 500)));
    }
  }

  // Calculate metrics from real measurements
  const metrics: PerformanceMetric[] = config.targetEndpoints.map(endpoint => {
    const latencies = allLatencies.get(endpoint) ?? [];
    const errors = allErrors.get(endpoint) ?? 0;
    const sorted = [...latencies].sort((a, b) => a - b);
    const count = sorted.length;
    const avg = count > 0 ? Math.round(sorted.reduce((s, l) => s + l, 0) / count) : 0;
    const p50 = count > 0 ? sorted[Math.floor(count * 0.5)] ?? avg : 0;
    const p95 = count > 0 ? sorted[Math.floor(count * 0.95)] ?? avg : 0;
    const p99 = count > 0 ? sorted[Math.floor(count * 0.99)] ?? avg : 0;
    const durationSec = config.duration || 1;
    return {
      endpoint,
      method: "GET",
      avgLatency: avg,
      p50Latency: p50,
      p95Latency: p95,
      p99Latency: p99,
      requestCount: count,
      errorRate: count > 0 ? Math.round((errors / count) * 10000) / 10000 : 0,
      throughput: Math.round(count / durationSec * 10) / 10,
      timestamp: new Date().toISOString(),
    };
  });

  const totalRequests = metrics.reduce((s, m) => s + m.requestCount, 0);
  const failedRequests = metrics.reduce((s, m) => s + Math.round(m.requestCount * m.errorRate), 0);

  const bottlenecks: LoadTestResult["bottlenecks"] = [];
  for (const m of metrics) {
    if (m.p95Latency > 5000) {
      bottlenecks.push({ endpoint: m.endpoint, issue: `High p95 latency: ${m.p95Latency}ms`, severity: "high" });
    } else if (m.p95Latency > 2000) {
      bottlenecks.push({ endpoint: m.endpoint, issue: `Elevated p95 latency: ${m.p95Latency}ms`, severity: "medium" });
    }
    if (m.errorRate > 0.01) {
      bottlenecks.push({ endpoint: m.endpoint, issue: `Error rate: ${(m.errorRate * 100).toFixed(1)}%`, severity: m.errorRate > 0.05 ? "high" : "medium" });
    }
  }

  // Store metrics for history
  for (const m of metrics) recordMetric(m);

  return {
    id: `load_${Date.now()}`,
    config,
    startedAt,
    completedAt: new Date().toISOString(),
    metrics,
    summary: {
      totalRequests,
      successfulRequests: totalRequests - failedRequests,
      failedRequests,
      avgLatency: metrics.length > 0 ? Math.round(metrics.reduce((s, m) => s + m.avgLatency, 0) / metrics.length) : 0,
      maxLatency: metrics.length > 0 ? Math.max(...metrics.map(m => m.p99Latency)) : 0,
      throughput: Math.round(metrics.reduce((s, m) => s + m.throughput, 0) * 10) / 10,
      errorRate: totalRequests > 0 ? Math.round((failedRequests / totalRequests) * 10000) / 100 : 0,
    },
    bottlenecks,
    passed: bottlenecks.filter(b => b.severity === "high").length === 0,
  };
}

export function getLoadTestPresets(): LoadTestConfig[] {
  return [
    { name: "Smoke Test", targetEndpoints: ["/api/trpc/auth.me", "/api/trpc/chat.send"], concurrentUsers: 5, duration: 30, rampUpTime: 5, thinkTime: 1000 },
    { name: "Normal Load", targetEndpoints: ["/api/trpc/auth.me", "/api/trpc/chat.send", "/api/trpc/knowledge.search"], concurrentUsers: 50, duration: 300, rampUpTime: 60, thinkTime: 2000 },
    { name: "Peak Load", targetEndpoints: ["/api/trpc/auth.me", "/api/trpc/chat.send", "/api/trpc/knowledge.search", "/api/trpc/calculators.run"], concurrentUsers: 200, duration: 600, rampUpTime: 120, thinkTime: 1500 },
    { name: "Stress Test", targetEndpoints: ["/api/trpc/chat.send", "/api/trpc/knowledge.search"], concurrentUsers: 500, duration: 300, rampUpTime: 60, thinkTime: 500 },
  ];
}
