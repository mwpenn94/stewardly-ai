/**
 * format.ts — Re-export shim for backward compatibility.
 *
 * The canonical implementation now lives at `@/lib/format`.
 * This file re-exports everything so existing imports from
 * `./format` or `../calculators/format` continue to work.
 */
export { fmt, fmtSm, pct } from '@/lib/format';
