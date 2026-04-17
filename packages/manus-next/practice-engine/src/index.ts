/**
 * @manus-next/practice-engine
 * Practice management (pure math) — 38+ functions
 *
 * This package contains the practice management calculation engine
 * extracted from the Stewardly monolith. Pure TypeScript, no external deps.
 */

export const PACKAGE_NAME = "@manus-next/practice-engine" as const;
export const PACKAGE_VERSION = "0.1.0" as const;

export {
  PRODUCTS, GDC_BRACKETS, getBracket,
  CHANNELS,
  HIER_ORDER, HIER_NAMES, HIER_SHORT, HIER_DOWN, HIER_UP,
  ROLE_DEFAULTS, RECRUIT_DEFAULTS, RECRUIT_LABELS, RECRUIT_SOURCES,
  calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  blendSources, calcTrackFunnel, calcAllTracksSummary,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard,
  calcCumOvrPerHire, calcYr2OvrPerHire, calcFunnelYield,
  SEASON_PROFILES, SEASON_LABELS, buildMonthlyProduction,
  calcGoalProgress, calcScenarioDiff, dragRebalanceSplit,
  calcClientPracticeOpportunity,
  buildCascadeChain,
  calcPlanningHorizon,
  calcUnifiedPnL, calcRollUpChartData,
  DEFAULT_ENGINE_CONFIG, mergeEngineConfig,
  fmt, fmtSm, pct,
} from "./practiceEngine";

export type {
  Product, GDCBracket, Channel, RoleId,
  RoleDefaults, RecruitDefaults, RecruitSource, TeamMember, RecruitTrack,
  IncomeSplits, ScenarioDiffResult, ClientPracticeInputs, ClientPracticeOpportunity,
  CascadeNode, CascadeEdge, CascadeChainData,
  PlanningHorizonPoint, UnifiedPnL, RollUpChartData, EngineConfig,
} from "./practiceEngine";
