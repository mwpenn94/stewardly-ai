/**
 * Rate Calibrator — Normalize and calibrate rates across providers for consistency
 */
import { logger } from "../../_core/logger";

const log = logger.child({ module: "rateCalibrator" });

export interface RawRate {
  provider: string;
  product: string;
  rawValue: string | number;
  unit: string; // "percent", "bps", "decimal", "dollars"
  asOfDate: number;
}

export interface CalibratedRate {
  provider: string;
  product: string;
  annualPercent: number;
  monthlyPercent: number;
  basisPoints: number;
  confidence: number;
  source: string;
  calibratedAt: number;
}

/** Convert any rate format to standardized annual percentage */
function normalizeToAnnualPercent(value: number, unit: string): number {
  switch (unit) {
    case "percent": return value;
    case "bps": return value / 100;
    case "decimal": return value * 100;
    case "monthly_percent": return value * 12;
    case "daily_percent": return value * 365;
    default: return value;
  }
}

export function calibrate(rates: RawRate[]): CalibratedRate[] {
  const results: CalibratedRate[] = [];
  const now = Date.now();

  for (const rate of rates) {
    try {
      const numValue = typeof rate.rawValue === "string" ? parseFloat(rate.rawValue.replace(/[%,]/g, "")) : rate.rawValue;
      if (isNaN(numValue)) {
        log.warn({ provider: rate.provider, product: rate.product, raw: rate.rawValue }, "Unparseable rate value");
        continue;
      }

      const annual = normalizeToAnnualPercent(numValue, rate.unit);
      // Sanity check: rates should be between -5% and 50%
      const confidence = annual >= -5 && annual <= 50 ? 0.95 : 0.4;

      results.push({
        provider: rate.provider,
        product: rate.product,
        annualPercent: Math.round(annual * 10000) / 10000,
        monthlyPercent: Math.round((annual / 12) * 10000) / 10000,
        basisPoints: Math.round(annual * 100),
        confidence,
        source: rate.provider,
        calibratedAt: now,
      });
    } catch (e: any) {
      log.error({ provider: rate.provider, error: e.message }, "Rate calibration failed");
    }
  }

  log.info({ input: rates.length, output: results.length }, "Rates calibrated");
  return results;
}

/** Cross-validate rates from multiple providers for the same product */
export function crossValidate(rates: CalibratedRate[]): Map<string, { median: number; spread: number; outliers: string[] }> {
  const byProduct = new Map<string, CalibratedRate[]>();
  for (const r of rates) {
    const existing = byProduct.get(r.product) || [];
    existing.push(r);
    byProduct.set(r.product, existing);
  }

  const results = new Map<string, { median: number; spread: number; outliers: string[] }>();
  const entries = Array.from(byProduct.entries());
  for (const entry of entries) {
    const product = entry[0];
    const productRates = entry[1];
    const sorted = productRates.map((r: CalibratedRate) => r.annualPercent).sort((a: number, b: number) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const spread = sorted[sorted.length - 1] - sorted[0];
    const outliers = productRates
      .filter((r: CalibratedRate) => Math.abs(r.annualPercent - median) > spread * 0.5)
      .map((r: CalibratedRate) => r.provider);
    results.set(product, { median, spread, outliers });
  }

  return results;
}
