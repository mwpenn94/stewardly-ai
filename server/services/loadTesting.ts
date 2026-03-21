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

export function simulateLoadTest(config: LoadTestConfig): LoadTestResult {
  const metrics: PerformanceMetric[] = config.targetEndpoints.map(endpoint => {
    const baseLatency = endpoint.includes("chat") ? 800 : endpoint.includes("llm") ? 2000 : 150;
    const load = config.concurrentUsers;
    const latencyMultiplier = 1 + (load / 100) * 0.5; // Latency increases with load

    return {
      endpoint,
      method: "POST",
      avgLatency: Math.round(baseLatency * latencyMultiplier),
      p50Latency: Math.round(baseLatency * latencyMultiplier * 0.8),
      p95Latency: Math.round(baseLatency * latencyMultiplier * 2.5),
      p99Latency: Math.round(baseLatency * latencyMultiplier * 4),
      requestCount: Math.round(config.concurrentUsers * config.duration / (config.thinkTime / 1000)),
      errorRate: load > 200 ? 0.05 : load > 100 ? 0.01 : 0,
      throughput: Math.round(config.concurrentUsers / (baseLatency * latencyMultiplier / 1000)),
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

  return {
    id: `load_${Date.now()}`,
    config,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    metrics,
    summary: {
      totalRequests,
      successfulRequests: totalRequests - failedRequests,
      failedRequests,
      avgLatency: Math.round(metrics.reduce((s, m) => s + m.avgLatency, 0) / metrics.length),
      maxLatency: Math.max(...metrics.map(m => m.p99Latency)),
      throughput: Math.round(metrics.reduce((s, m) => s + m.throughput, 0)),
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
