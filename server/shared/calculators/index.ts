/**
 * WealthBridge shared calculator engines.
 *
 * Barrel module re-exporting the v7 public surface of UWE (Unified Wealth
 * Engine), BIE (Business Income Engine), HE (Holistic Engine), the
 * Monte Carlo simulator, and the benchmark / guardrail / reference
 * bundle. Downstream services can import either the namespaces or the
 * individual functions directly:
 *
 *   import { UWE, BIE, HE, MonteCarlo, Benchmarks } from "@shared/calculators";
 *   import { simulate, buildStrategy, type UWEStrategy } from "@shared/calculators";
 */

// Types
export type {
  // Client
  ClientProfile,
  // UWE
  ProductType,
  ProductConfig,
  ProductYearResult,
  CompanyFeatures,
  CompanyStrategyInfo,
  CompanyDefinition,
  UWEStrategy,
  ProductDetailRow,
  SimulationSnapshot,
  // Monte Carlo
  MonteCarloPercentile,
  // BIE
  BIERoleKey,
  BIERole,
  GDCBracket,
  ChannelDefinition,
  SeasonProfileKey,
  SeasonProfile,
  StreamTypeMeta,
  BIETeamMember,
  AffAConfig,
  AffBConfig,
  AffCConfig,
  AffDConfig,
  BIECampaign,
  BIEStrategy,
  BIEStreamResult,
  BIEMonthlyDetail,
  BIEYearResult,
  BIEBackPlanResult,
  // HE
  HolisticStrategy,
  HolisticSnapshot,
  ComparisonRow,
  WinnerEntry,
  WinnersMap,
  MilestoneRow,
  ChartSeriesResult,
  // Benchmarks
  ProductReference,
  IndustryBenchmark,
  GuardrailRule,
  GuardrailCheck,
  // SCUI
  StressScenario,
  BacktestResult,
  BacktestSummary,
  MethodologyDisclosure,
  GuardrailWarning,
} from "./types";

// UWE
export {
  UWE,
  simulate as uweSimulate,
  buildStrategy as uweBuildStrategy,
  generateBestOverall,
  autoSelectProducts,
  COMPANIES,
  PRODUCT_MODELS,
  RATES,
  estPrem,
  interpRate,
  modelTerm,
  modelIUL,
  modelWL,
  modelDI,
  modelLTC,
  modelFIA,
  modelAUM,
  model401k,
  model529,
  modelEstate,
  modelPremFin,
  modelSplitDollar,
  modelDeferredComp,
  type ProductModel,
} from "./uwe";

// BIE
export {
  BIE,
  ROLES,
  GDC_BRACKETS,
  CHANNELS,
  SEASON_PROFILES,
  STREAM_TYPES,
  FREQUENCIES,
  createStrategy as bieCreateStrategy,
  simulate as bieSimulate,
  buildMonthlyDetail,
  backPlan,
  rollUp,
  rollDown,
  calcEconomics,
  toFrequency,
  getBracketRate,
  getBracketLabel,
  getSeasonMultipliers,
  getRoleInfo,
  getAllRoles,
  getAllChannels,
  getStreamTypes,
  presetNewAssociate,
  presetExperiencedPro,
  presetDirector,
  presetMD,
  presetRVP,
  presetAffiliateB,
  presetStrategicPartner,
  PRESETS as BIE_PRESETS,
  type BIEStrategyConfig,
  type BIERollUpResult,
  type BIERollDownInput,
  type BIERollDownResult,
  type BIEEconomicsResult,
} from "./bie";

// HE
export {
  HE,
  createHolisticStrategy,
  simulate as heSimulate,
  addStrategy,
  removeStrategy,
  clearStrategies,
  setHorizon,
  getHorizon,
  getStrategies,
  getSnapshot,
  compareAt,
  findWinners,
  milestoneCompare,
  getChartSeries,
  backPlanHolistic,
  exportState,
  importState,
  presetWealthBridgeClient,
  presetWealthBridgePro,
  presetDoNothing,
  presetDIY,
  presetWirehouse,
  presetRIA,
  presetCaptiveMutual,
  presetCommunityBD,
  presetWBPremFinance,
  PRESETS as HE_PRESETS,
  type HolisticStrategyConfig,
  type HEBackPlanResult,
} from "./he";

// Monte Carlo
export * as MonteCarlo from "./monteCarlo";
export {
  simulate as monteCarloSimulate,
  simulateWithVolatility,
} from "./monteCarlo";

// Benchmarks / guardrails / references / methodology
export * as Benchmarks from "./benchmarks";
export {
  GUARDRAILS,
  checkGuardrail,
  PRODUCT_REFERENCES,
  INDUSTRY_BENCHMARKS,
  METHODOLOGY_DISCLOSURE,
} from "./benchmarks";

// SCUI — Stress Testing, Compliance, Historical Data
export * as SCUIModule from "./scui";
export {
  SCUI,
  SP500_HISTORY,
  STRESS_SCENARIOS,
  historicalBacktest,
  stressTest,
  checkGuardrails,
} from "./scui";
