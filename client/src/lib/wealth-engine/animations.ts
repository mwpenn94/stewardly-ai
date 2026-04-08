/**
 * WealthBridge wealth-engine animation presets.
 *
 * Pure helpers + React hooks that wealth-engine components use to
 * animate numbers, morph lines, celebrate milestones, and ripple
 * interactions. Every helper honors `prefers-reduced-motion` via the
 * `useReducedMotion` hook, so users who disable animations get
 * immediate static values instead of timed transitions.
 */

import { useEffect, useRef, useState } from "react";
import { chartTokens } from "./tokens";

// ─── Reduced motion hook ───────────────────────────────────────────────────

/**
 * Returns true when the user has OS-level "reduce motion" set.
 * Components should short-circuit their animation timelines when true.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

// ─── Count-up hook ─────────────────────────────────────────────────────────
// Animates a numeric value from a previous target to a new target over
// `durationMs`. Useful for big dollar headlines ("Total Value: $2.4M").

export function useCountUp(
  target: number,
  opts?: { durationMs?: number; enabled?: boolean },
): number {
  const duration = opts?.durationMs ?? chartTokens.animation.countUp;
  const enabled = opts?.enabled ?? true;
  const reduced = useReducedMotion();
  const [value, setValue] = useState(target);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(target);

  useEffect(() => {
    if (!enabled || reduced) {
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;
    const startTs =
      typeof performance !== "undefined" ? performance.now() : Date.now();

    const tick = (now: number) => {
      const elapsed = now - startTs;
      const t = Math.min(elapsed / duration, 1);
      // Ease out cubic — quick start, gentle landing
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + delta * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, enabled, reduced]);

  return value;
}

// ─── Number formatting helpers used throughout ────────────────────────────

export function formatCurrency(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatCurrencyPrecise(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPercent(n: number, digits = 1): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

// ─── Spring presets re-exported for Framer Motion ─────────────────────────

export const springs = chartTokens.animation.spring;
export const durations = {
  fast: chartTokens.animation.fast,
  medium: chartTokens.animation.medium,
  slow: chartTokens.animation.slow,
  countUp: chartTokens.animation.countUp,
};

// ─── Stagger variants for Framer Motion list containers ───────────────────

export const listVariants = {
  container: (stagger = chartTokens.animation.stagger.medium) => ({
    hidden: {},
    visible: {
      transition: { staggerChildren: stagger },
    },
  }),
  item: {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
  },
};

// ─── Tiny pure helpers (used by SVG chart components) ─────────────────────

/**
 * Map a domain value to a screen coordinate given [min, max] domain
 * and [0, size] range. Used by line/area path generators.
 */
export function linearScale(
  value: number,
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): number {
  if (domainMax === domainMin) return rangeMin;
  const t = (value - domainMin) / (domainMax - domainMin);
  return rangeMin + t * (rangeMax - rangeMin);
}

/**
 * Build an SVG `d` attribute for a line path from a series of (x, y)
 * points. Pure so it can be unit-tested; used by ProjectionChart.
 */
export function buildLinePath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
}

/**
 * Smooth a line path into a Catmull-Rom spline. Optional: used for the
 * projection fan chart where we want the line to feel more organic.
 */
export function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return buildLinePath(points);
  let d = `M${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}
