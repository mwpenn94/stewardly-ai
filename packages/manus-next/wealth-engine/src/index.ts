/**
 * @manus-next/wealth-engine
 * Calculator engine (pure math) — 46 methods
 *
 * This package contains the core calculation engine extracted from the
 * Stewardly Wealth Engine. All functions are pure TypeScript with no
 * external dependencies.
 */

export const PACKAGE_NAME = "@manus-next/wealth-engine" as const;
export const PACKAGE_VERSION = "0.1.0" as const;

export {
  // Rate tables
  RATES,
  // Formatting utilities
  fmt, fmtSm, pct,
  // Core math
  fv, interpRate, estPrem, sc, getBracketRate,
  // Product models
  modelTerm, modelIUL, modelWL, modelDI, modelLTC, modelFIA,
  // Scorecard & recommendations
  computeScorecard, buildRecommendations,
  // Domain calculators
  calcCashFlow, calcProtection, calcGrowth, calcRetirement,
  calcTax, calcEstate, calcEducation,
  // Horizon analysis
  buildHorizonData,
  // Action planning
  buildActionPlan,
  // Advanced calculators
  calcAdvanced, calcBizClient, calcPartner,
  calcIncomeStreams, calcBucketStrategy,
  calcFloorUpside, calcGuytonKlinger, calcRothLadder,
  // Configuration
  CONFIGURABLE_DEFAULTS, getConfig,
  // Constants
  STRATEGIES, CALC_METHODS, DUE_DILIGENCE,
} from "./engine";

// Re-export types
export type {
  ProductResult, DomainScore, Pillar, Recommendation,
  CFResult, PRResult, GRResult, RTResult, TXResult, ESResult, EDResult,
  HorizonData, ActionPhase, AdvResult,
  BizClientResult, PartnerResult,
  IncomeStream, IncomeStreamResult,
  BucketAllocation, BucketResult,
  FloorUpsideResult, GuytonKlingerResult,
  RothLadderYear, RothLadderResult,
  ConfigurableDefaults,
} from "./engine";
