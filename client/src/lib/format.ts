/**
 * format.ts — Shared formatting utilities for the entire application.
 *
 * CANONICAL location: `@/lib/format`
 * Import as: `import { fmt, fmtSm, pct } from '@/lib/format';`
 *
 * This module has ZERO imports to prevent circular/diamond dependency
 * issues in production Rollup builds.
 *
 * All formatting functions handle null, undefined, NaN, and Infinity
 * gracefully by returning an em-dash "—".
 */

/** Format a number as a dollar string, e.g. $1,234 or $1.2M */
export function fmt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(0) + 'K';
  return s + '$' + Math.round(a).toLocaleString();
}

/** Format a number as a compact dollar string, e.g. $1.2B, $45M, $12K */
export function fmtSm(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) { const m = a / 1e6; return s + '$' + (m >= 10 ? Math.round(m) : m.toFixed(1)) + 'M'; }
  if (a >= 10000) { const k = Math.round(a / 1e3); return s + '$' + k + 'K'; }
  if (a >= 1000) { const k = a / 1e3; return s + '$' + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + 'K'; }
  return s + '$' + Math.round(a);
}

/** Format a decimal as a percentage string, e.g. 0.123 → "12.3%" */
export function pct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—';
  return (n * 100).toFixed(1) + '%';
}
