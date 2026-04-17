/**
 * @manus-next/references
 * Citation library + RefTips — 17 categories, 101 entries
 *
 * This package contains the reference library and citation data
 * extracted from the Stewardly monolith. Pure TypeScript, no external deps.
 */

export const PACKAGE_NAME = "@manus-next/references" as const;
export const PACKAGE_VERSION = "0.1.0" as const;

export {
  REF_CATEGORY_TIPS,
  REFERENCE_CATEGORIES,
  FUNNEL_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
} from "./references";

export type {
  RefEntry,
  RefCategory,
} from "./references";
