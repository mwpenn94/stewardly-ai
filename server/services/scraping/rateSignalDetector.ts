/**
 * Rate Signal Detector — Identify rate changes from provider data
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "rateSignalDetector" });

export interface RateSignal {
  provider: string;
  product: string;
  previousRate: number | null;
  currentRate: number;
  changePercent: number | null;
  direction: "up" | "down" | "unchanged" | "new";
  detectedAt: number;
  confidence: number;
}

export function detectSignals(
  currentRates: Array<{ provider: string; product: string; rate: number }>,
  historicalRates: Map<string, number>
): RateSignal[] {
  const signals: RateSignal[] = [];
  const now = Date.now();

  for (const { provider, product, rate } of currentRates) {
    const key = `${provider}:${product}`;
    const prev = historicalRates.get(key);

    if (prev === undefined) {
      signals.push({ provider, product, previousRate: null, currentRate: rate, changePercent: null, direction: "new", detectedAt: now, confidence: 0.7 });
    } else if (Math.abs(rate - prev) < 0.001) {
      // No change — skip
    } else {
      const changePct = ((rate - prev) / prev) * 100;
      signals.push({
        provider, product, previousRate: prev, currentRate: rate,
        changePercent: Math.round(changePct * 100) / 100,
        direction: rate > prev ? "up" : "down",
        detectedAt: now,
        confidence: Math.abs(changePct) > 10 ? 0.6 : 0.9, // Large changes may be errors
      });
    }
  }

  log.info({ signalCount: signals.length }, "Rate signals detected");
  return signals;
}

export function filterSignificant(signals: RateSignal[], minChangePct = 0.5): RateSignal[] {
  return signals.filter(
    (s) => s.direction === "new" || (s.changePercent !== null && Math.abs(s.changePercent) >= minChangePct)
  );
}
