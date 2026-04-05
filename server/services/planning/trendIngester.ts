/**
 * Trend Ingester — Ingest and analyze industry/market trends for planning context
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "trendIngester" });

export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  metric: string;
  value: number;
  source: string;
}

export interface TrendAnalysis {
  metric: string;
  direction: "up" | "down" | "flat";
  changePercent: number;
  periodMonths: number;
  latestValue: number;
  movingAverage: number;
  volatility: number;
}

export function analyzeTrend(points: TrendDataPoint[]): TrendAnalysis | null {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = sorted.map((p) => p.value);
  const latest = values[values.length - 1];
  const earliest = values[0];

  const changePercent = earliest !== 0 ? ((latest - earliest) / Math.abs(earliest)) * 100 : 0;
  const direction: TrendAnalysis["direction"] = changePercent > 1 ? "up" : changePercent < -1 ? "down" : "flat";

  // Simple moving average (last 3 points)
  const maWindow = Math.min(3, values.length);
  const movingAverage = values.slice(-maWindow).reduce((s, v) => s + v, 0) / maWindow;

  // Volatility (standard deviation)
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
  const volatility = Math.sqrt(variance);

  // Period in months
  const startDate = new Date(sorted[0].date);
  const endDate = new Date(sorted[sorted.length - 1].date);
  const periodMonths = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (30 * 24 * 60 * 60 * 1000)));

  return { metric: sorted[0].metric, direction, changePercent: Math.round(changePercent * 100) / 100, periodMonths, latestValue: latest, movingAverage: Math.round(movingAverage * 100) / 100, volatility: Math.round(volatility * 100) / 100 };
}

export function detectAnomalies(points: TrendDataPoint[], threshold = 2): TrendDataPoint[] {
  if (points.length < 5) return [];

  const values = points.map((p) => p.value);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const stdDev = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);

  if (stdDev === 0) return [];

  return points.filter((p) => Math.abs(p.value - mean) > threshold * stdDev);
}

export function forecastLinear(points: TrendDataPoint[], periodsAhead: number): number[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const xs = sorted.map((_, i) => i);
  const ys = sorted.map((p) => p.value);

  const sumX = xs.reduce((s, x) => s + x, 0);
  const sumY = ys.reduce((s, y) => s + y, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const forecasts: number[] = [];
  for (let i = 1; i <= periodsAhead; i++) {
    forecasts.push(Math.round((slope * (n + i - 1) + intercept) * 100) / 100);
  }

  log.info({ metric: sorted[0].metric, periodsAhead, slope: Math.round(slope * 100) / 100 }, "Linear forecast generated");
  return forecasts;
}
