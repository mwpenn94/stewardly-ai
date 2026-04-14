/**
 * Business Income Engine (BIE) v1.0
 *
 * Multi-year income simulation across all roles, hierarchies, channels,
 * affiliates, strategic partners — with forward/back/roll-up/roll-down,
 * seasonality, frequency conversion, and unlimited planning horizon.
 *
 * Ported verbatim from the v7 WealthBridge HTML calculators
 * (Business-Calculator-v7, lines 2146-2930). The constants, helpers,
 * simulation loop, and presets are all kept in lock-step with the v7
 * reference so a downstream diff vs. v7 output returns zero mismatches.
 *
 * Step 4a: ROLES, GDC_BRACKETS, CHANNELS, SEASON_PROFILES, STREAM_TYPES,
 * FREQUENCIES and the 8 read-only helper functions. Steps 4b/4c/4d will
 * append createStrategy + simulate, backPlan + rollUp + rollDown +
 * calcEconomics, and the 7 presets + namespace export.
 */

import type {
  BIERole,
  BIERoleKey,
  GDCBracket,
  ChannelDefinition,
  SeasonProfile,
  SeasonProfileKey,
  StreamTypeMeta,
  BIEStrategy,
  BIEYearResult,
  BIEMonthlyDetail,
  BIEStreamResult,
  BIEBackPlanResult,
  BIETeamMember,
  AffAConfig,
  AffBConfig,
  AffCConfig,
  AffDConfig,
  BIECampaign,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// ROLE HIERARCHY
// 11 roles spanning WB producer levels (new → rvp) plus 4 affiliate tracks
// and a strategic partner. Each role declares its base GDC, ramp curve,
// growth rate, and who it manages / reports to.
// ═══════════════════════════════════════════════════════════════════════════

export const ROLES: Record<BIERoleKey, BIERole> = {
  new: {
    name: "New Associate",
    short: "New Assoc",
    level: 0,
    manages: [],
    reports: ["sa", "dir", "md", "rvp"],
    canProduce: true,
    baseGDC: 65000,
    rampMonths: 6,
    rampPct: 0.3,
    growthRate: 0.15,
  },
  exp: {
    name: "Experienced Professional",
    short: "Exp Pro",
    level: 1,
    manages: [],
    reports: ["sa", "dir", "md", "rvp"],
    canProduce: true,
    baseGDC: 150000,
    rampMonths: 3,
    rampPct: 0.5,
    growthRate: 0.1,
  },
  sa: {
    name: "Senior Associate",
    short: "Sr Assoc",
    level: 2,
    manages: ["new", "exp"],
    reports: ["dir", "md", "rvp"],
    canProduce: true,
    baseGDC: 180000,
    rampMonths: 0,
    rampPct: 1.0,
    growthRate: 0.08,
  },
  dir: {
    name: "Director",
    short: "Director",
    level: 3,
    manages: ["sa"],
    reports: ["md", "rvp"],
    canProduce: true,
    baseGDC: 220000,
    rampMonths: 0,
    rampPct: 1.0,
    growthRate: 0.07,
  },
  md: {
    name: "Managing Director",
    short: "MD",
    level: 4,
    manages: ["dir"],
    reports: ["rvp"],
    canProduce: true,
    baseGDC: 280000,
    rampMonths: 0,
    rampPct: 1.0,
    growthRate: 0.06,
  },
  rvp: {
    name: "Regional Vice President",
    short: "RVP",
    level: 5,
    manages: ["md"],
    reports: [],
    canProduce: true,
    baseGDC: 350000,
    rampMonths: 0,
    rampPct: 1.0,
    growthRate: 0.05,
  },
  affA: {
    name: "Affiliate Track A",
    short: "Aff A",
    level: 0,
    manages: [],
    reports: [],
    canProduce: false,
    baseGDC: 0,
    rampMonths: 0,
    rampPct: 0,
    growthRate: 0.05,
  },
  affB: {
    name: "Affiliate Track B",
    short: "Aff B",
    level: 0,
    manages: [],
    reports: [],
    canProduce: true,
    baseGDC: 50000,
    rampMonths: 2,
    rampPct: 0.6,
    growthRate: 0.1,
  },
  affC: {
    name: "Affiliate Track C",
    short: "Aff C",
    level: 0,
    manages: [],
    reports: [],
    canProduce: true,
    baseGDC: 80000,
    rampMonths: 2,
    rampPct: 0.6,
    growthRate: 0.08,
  },
  affD: {
    name: "Affiliate Track D",
    short: "Aff D",
    level: 0,
    manages: [],
    reports: [],
    canProduce: false,
    baseGDC: 0,
    rampMonths: 0,
    rampPct: 0,
    growthRate: 0.05,
  },
  partner: {
    name: "Strategic Partner",
    short: "Partner",
    level: 0,
    manages: [],
    reports: [],
    canProduce: false,
    baseGDC: 0,
    rampMonths: 0,
    rampPct: 0,
    growthRate: 0.03,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GDC BRACKETS
// Sliding payout rate by annual gross dealer concession.
// ═══════════════════════════════════════════════════════════════════════════

export const GDC_BRACKETS: GDCBracket[] = [
  { min: 0, max: 64999, rate: 0.55, label: "<$65K" },
  { min: 65000, max: 94999, rate: 0.65, label: "$65-95K" },
  { min: 95000, max: 149999, rate: 0.7, label: "$95-150K" },
  { min: 150000, max: 199999, rate: 0.75, label: "$150-200K" },
  { min: 200000, max: 239999, rate: 0.8, label: "$200-240K" },
  { min: 240000, max: 274999, rate: 0.825, label: "$240-275K" },
  { min: 275000, max: 299999, rate: 0.84, label: "$275-300K" },
  { min: 300000, max: Infinity, rate: 0.85, label: "$300K+" },
];

// ═══════════════════════════════════════════════════════════════════════════
// CHANNEL DEFAULTS
// Cost per lead, conversion rate, revenue per client, LTV, attribution,
// annual growth rate for 10 marketing channels.
// ═══════════════════════════════════════════════════════════════════════════

export const CHANNELS: Record<string, ChannelDefinition> = {
  referral: {
    name: "Referral Program",
    cpl: 50,
    cv: 0.25,
    revPerClient: 30000,
    ltv: 273342,
    attr: 0.6,
    growthRate: 0.08,
  },
  webinar: {
    name: "Webinars",
    cpl: 90,
    cv: 0.12,
    revPerClient: 12500,
    ltv: 83678,
    attr: 0.85,
    growthRate: 0.12,
  },
  roundtable: {
    name: "Roundtable Events",
    cpl: 120,
    cv: 0.15,
    revPerClient: 30000,
    ltv: 212439,
    attr: 0.7,
    growthRate: 0.1,
  },
  digital: {
    name: "Digital (Meta+Google)",
    cpl: 85,
    cv: 0.08,
    revPerClient: 15000,
    ltv: 89123,
    attr: 0.95,
    growthRate: 0.15,
  },
  community: {
    name: "Community Events",
    cpl: 75,
    cv: 0.1,
    revPerClient: 10000,
    ltv: 53189,
    attr: 0.8,
    growthRate: 0.06,
  },
  cpa: {
    name: "CPA/Attorney Partners",
    cpl: 180,
    cv: 0.2,
    revPerClient: 30000,
    ltv: 240318,
    attr: 0.4,
    growthRate: 0.05,
  },
  partnership: {
    name: "Strategic Partnerships",
    cpl: 150,
    cv: 0.12,
    revPerClient: 20000,
    ltv: 136381,
    attr: 0.45,
    growthRate: 0.07,
  },
  linkedin: {
    name: "LinkedIn B2B",
    cpl: 130,
    cv: 0.1,
    revPerClient: 35000,
    ltv: 280000,
    attr: 0.5,
    growthRate: 0.1,
  },
  affiliate: {
    name: "Affiliate Network",
    cpl: 60,
    cv: 0.15,
    revPerClient: 18000,
    ltv: 120000,
    attr: 0.55,
    growthRate: 0.12,
  },
  events: {
    name: "Industry Events/Conf",
    cpl: 200,
    cv: 0.18,
    revPerClient: 40000,
    ltv: 320000,
    attr: 0.3,
    growthRate: 0.04,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SEASONALITY PROFILES
// 12-month multipliers. Each profile must sum to roughly 12 so the annual
// total is conserved; v7 uses raw multipliers without normalization so we
// preserve the exact numbers.
// ═══════════════════════════════════════════════════════════════════════════

export const SEASON_PROFILES: Record<SeasonProfileKey, SeasonProfile> = {
  flat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  q4Heavy: [0.8, 0.8, 0.9, 0.9, 1.0, 0.8, 0.7, 0.8, 1.0, 1.3, 1.5, 1.5],
  summer: [1.0, 1.0, 1.1, 1.0, 0.8, 0.7, 0.6, 0.7, 0.9, 1.1, 1.2, 1.3],
  eventDriven: [0.6, 0.8, 1.5, 0.8, 0.6, 0.8, 1.5, 0.8, 0.6, 0.8, 1.5, 0.8],
  ramp: [0.3, 0.5, 0.7, 0.8, 0.9, 1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.3],
  custom: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

// ═══════════════════════════════════════════════════════════════════════════
// INCOME STREAM TYPES
// 13 streams categorized by production / leadership / advisory / affiliate
// / marketing / partner / residual / bonus.
// ═══════════════════════════════════════════════════════════════════════════

export const STREAM_TYPES: Record<string, StreamTypeMeta> = {
  personal: {
    label: "Personal WB Core",
    category: "production",
    requiresProduction: true,
  },
  expanded: {
    label: "Expanded Platform",
    category: "production",
    requiresProduction: true,
  },
  override: {
    label: "Team Override",
    category: "leadership",
    requiresProduction: false,
  },
  overrideG2: {
    label: "Gen 2 Override",
    category: "leadership",
    requiresProduction: false,
  },
  aum: {
    label: "AUM/Advisory Trail",
    category: "advisory",
    requiresProduction: false,
  },
  affA: {
    label: "Affiliate Track A (Fees)",
    category: "affiliate",
    requiresProduction: false,
  },
  affB: {
    label: "Affiliate Track B (Referral)",
    category: "affiliate",
    requiresProduction: true,
  },
  affC: {
    label: "Affiliate Track C (Co-Broker)",
    category: "affiliate",
    requiresProduction: true,
  },
  affD: {
    label: "Affiliate Track D (Wholesale)",
    category: "affiliate",
    requiresProduction: false,
  },
  channels: {
    label: "Channel Revenue",
    category: "marketing",
    requiresProduction: false,
  },
  partner: {
    label: "Strategic Partner",
    category: "partner",
    requiresProduction: false,
  },
  renewal: {
    label: "Renewal/Trail Income",
    category: "residual",
    requiresProduction: false,
  },
  bonus: {
    label: "Bonuses & Incentives",
    category: "bonus",
    requiresProduction: false,
  },
};

// Frequency labels used by `toFrequency` to convert annual income to other
// payout cadences.
export const FREQUENCIES = [
  "daily",
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "semiannual",
  "annual",
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// READ-ONLY HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Return the GDC payout rate for a given gross dealer concession amount. */
export function getBracketRate(gdc: number): number {
  for (let i = 0; i < GDC_BRACKETS.length; i++) {
    if (gdc >= GDC_BRACKETS[i].min && gdc <= GDC_BRACKETS[i].max)
      return GDC_BRACKETS[i].rate;
  }
  return GDC_BRACKETS[GDC_BRACKETS.length - 1].rate;
}

/** Return the human-readable label for a GDC bracket. */
export function getBracketLabel(gdc: number): string {
  for (let i = 0; i < GDC_BRACKETS.length; i++) {
    if (gdc >= GDC_BRACKETS[i].min && gdc <= GDC_BRACKETS[i].max)
      return GDC_BRACKETS[i].label;
  }
  return GDC_BRACKETS[GDC_BRACKETS.length - 1].label;
}

/**
 * Return the 12-month multiplier array for a strategy. If the caller
 * supplied a `customSeason` of length 12, use it verbatim. Otherwise look
 * up the named profile, falling back to `flat`.
 */
export function getSeasonMultipliers(strategy: BIEStrategy): SeasonProfile {
  if (strategy.customSeason && strategy.customSeason.length === 12)
    return strategy.customSeason;
  return SEASON_PROFILES[strategy.seasonality] || SEASON_PROFILES.flat;
}

/** Look up a role by key, falling back to `new` for unknown keys. */
export function getRoleInfo(roleKey: BIERoleKey | string): BIERole {
  return ROLES[roleKey as BIERoleKey] || ROLES.new;
}

/** List all roles in a UI-friendly shape. */
export function getAllRoles(): Array<{
  key: BIERoleKey;
  name: string;
  short: string;
  level: number;
}> {
  return (Object.keys(ROLES) as BIERoleKey[]).map((k) => ({
    key: k,
    name: ROLES[k].name,
    short: ROLES[k].short,
    level: ROLES[k].level,
  }));
}

/** List all channels in a UI-friendly shape. */
export function getAllChannels(): Array<{
  key: string;
  name: string;
  cpl: number;
  cv: number;
}> {
  return Object.keys(CHANNELS).map((k) => ({
    key: k,
    name: CHANNELS[k].name,
    cpl: CHANNELS[k].cpl,
    cv: CHANNELS[k].cv,
  }));
}

/** Return the full STREAM_TYPES map (used by downstream UIs). */
export function getStreamTypes(): Record<string, StreamTypeMeta> {
  return STREAM_TYPES;
}

/**
 * Convert an annual dollar figure to a different payout cadence.
 * Uses 252 trading days for "daily" to match v7.
 */
export function toFrequency(annualValue: number, freq: string): number {
  switch (freq) {
    case "daily":
      return Math.round(annualValue / 252);
    case "weekly":
      return Math.round(annualValue / 52);
    case "biweekly":
      return Math.round(annualValue / 26);
    case "monthly":
      return Math.round(annualValue / 12);
    case "quarterly":
      return Math.round(annualValue / 4);
    case "semiannual":
      return Math.round(annualValue / 2);
    case "annual":
      return annualValue;
    default:
      return annualValue;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STRATEGY BUILDER
// Fills defaults for every BIEStrategy field so downstream simulate()
// can read without null checks. Matches v7 createStrategy exactly.
// ═══════════════════════════════════════════════════════════════════════════

export interface BIEStrategyConfig {
  role?: BIERoleKey;
  streams?: Partial<Record<string, boolean>>;
  team?: BIETeamMember[];
  channelSpend?: Record<string, number>;
  seasonality?: SeasonProfileKey;
  customSeason?: number[] | null;
  personalGrowth?: number | null;
  teamGrowth?: number;
  aumGrowth?: number;
  channelGrowth?: number;
  hiringRate?: number;
  retentionRate?: number;
  affA?: AffAConfig;
  affB?: AffBConfig;
  affC?: AffCConfig;
  affD?: AffDConfig;
  partnerIncome?: number;
  partnerGrowth?: number;
  existingAUM?: number;
  newAUMAnnual?: number;
  aumFeeRate?: number;
  personalGDC?: number | null;
  wbPct?: number;
  bracketOverride?: number | null;
  overrideRate?: number;
  overrideBonusRate?: number;
  gen2Rate?: number;
  renewalRate?: number;
  renewalStartYear?: number;
  bonusPct?: number;
  campaigns?: BIECampaign[];
  notes?: string;
}

export function createStrategy(
  name: string,
  config: BIEStrategyConfig,
): BIEStrategy {
  return {
    name: name || "Untitled Strategy",
    role: config.role || "new",
    streams: config.streams || {},
    team: config.team || [],
    channelSpend: config.channelSpend || {},
    seasonality: config.seasonality || "flat",
    customSeason: config.customSeason || null,
    personalGrowth: config.personalGrowth != null ? config.personalGrowth : null,
    teamGrowth: config.teamGrowth != null ? config.teamGrowth : 0.1,
    aumGrowth: config.aumGrowth != null ? config.aumGrowth : 0.08,
    channelGrowth: config.channelGrowth != null ? config.channelGrowth : 0.1,
    hiringRate: config.hiringRate != null ? config.hiringRate : 0,
    retentionRate: config.retentionRate != null ? config.retentionRate : 0.8,
    affA: config.affA || { low: 0, med: 0, high: 0 },
    affB: config.affB || { referrals: 0, avgGDC: 0, commRate: 0 },
    affC: config.affC || { cases: 0, avgGDC: 0, splitRate: 0 },
    affD: config.affD || { subAgents: 0, avgGDC: 0, overrideRate: 0 },
    partnerIncome: config.partnerIncome || 0,
    partnerGrowth: config.partnerGrowth || 0.05,
    existingAUM: config.existingAUM || 0,
    newAUMAnnual: config.newAUMAnnual || 0,
    aumFeeRate: config.aumFeeRate || 0.01,
    personalGDC: config.personalGDC || null,
    wbPct: config.wbPct != null ? config.wbPct : 0.7,
    bracketOverride: config.bracketOverride || null,
    overrideRate: config.overrideRate != null ? config.overrideRate : 0.1,
    overrideBonusRate: config.overrideBonusRate || 0,
    gen2Rate: config.gen2Rate || 0,
    renewalRate: config.renewalRate || 0.04,
    renewalStartYear: config.renewalStartYear || 2,
    bonusPct: config.bonusPct || 0,
    campaigns: config.campaigns || [],
    notes: config.notes || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-YEAR SIMULATION
// Runs strategy year-by-year and returns an array of BIEYearResult. Each
// year aggregates across all enabled streams (personal, expanded,
// override, override G2, AUM, affiliate A-D, channels, partner, renewal,
// bonus) and tracks cumulative income/cost/placed GDC.
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(
  strategy: BIEStrategy,
  years?: number,
): BIEYearResult[] {
  const yearCount = !years || years < 1 ? 30 : years;
  const role = ROLES[strategy.role] || ROLES.new;
  const results: BIEYearResult[] = [];
  let cumCost = 0;
  let cumIncome = 0;
  let cumRenewal = 0;
  let currentAUM = strategy.existingAUM || 0;
  let currentTeamSize = strategy.team ? strategy.team.length : 0;
  let currentTeamFYC = 0;
  strategy.team.forEach((m) => {
    currentTeamFYC += m.fyc || m.f || 0;
  });
  let cumulativePlaced = 0;
  const seasonMults = getSeasonMultipliers(strategy);

  for (let yr = 1; yr <= yearCount; yr++) {
    const yearResult: BIEYearResult = {
      year: yr,
      streams: {},
      totalIncome: 0,
      totalCost: 0,
      netIncome: 0,
      cumulativeIncome: 0,
      cumulativeCost: 0,
      cumulativeNet: 0,
      teamSize: 0,
      aum: 0,
      monthly: [],
    };

    // ── PERSONAL PRODUCTION ──
    let personalInc = 0;
    let personalGDC = 0;
    if (strategy.streams.personal && role.canProduce) {
      const baseGDC = strategy.personalGDC || role.baseGDC;
      const growthR =
        strategy.personalGrowth != null
          ? strategy.personalGrowth
          : role.growthRate;
      if (yr === 1 && role.rampMonths > 0) {
        const fullMonths = 12 - role.rampMonths;
        const rampInc = (baseGDC / 12) * role.rampMonths * role.rampPct;
        const fullInc = (baseGDC / 12) * fullMonths;
        personalGDC = Math.round(rampInc + fullInc);
      } else {
        personalGDC = Math.round(baseGDC * Math.pow(1 + growthR, yr - 1));
      }
      const wbGDC = Math.round(personalGDC * strategy.wbPct);
      const expGDC = personalGDC - wbGDC;
      const bracketRate = strategy.bracketOverride || getBracketRate(wbGDC);
      const wbIncome = Math.round(wbGDC * bracketRate);
      personalInc = wbIncome;
      yearResult.streams.personal = {
        income: wbIncome,
        gdc: wbGDC,
        bracket: bracketRate,
        label: "Personal WB Core",
      };
      cumulativePlaced += personalGDC;

      if (strategy.streams.expanded && expGDC > 0) {
        const expIncome = Math.round(expGDC * 0.7);
        personalInc += expIncome;
        yearResult.streams.expanded = {
          income: expIncome,
          gdc: expGDC,
          label: "Expanded Platform",
        };
      }
    }

    // ── TEAM OVERRIDE ──
    let overrideInc = 0;
    if (strategy.streams.override && currentTeamSize > 0) {
      if (yr > 1) {
        const retained = Math.round(currentTeamSize * strategy.retentionRate);
        const newHires = strategy.hiringRate || 0;
        currentTeamSize = retained + newHires;
        currentTeamFYC =
          Math.round(
            currentTeamFYC * strategy.retentionRate * (1 + strategy.teamGrowth),
          ) + Math.round(newHires * (role.baseGDC * 0.5));
      }
      const gen1 = Math.round(
        currentTeamFYC * (strategy.overrideRate + strategy.overrideBonusRate),
      );
      overrideInc = gen1;
      yearResult.streams.override = {
        income: gen1,
        teamFYC: currentTeamFYC,
        teamSize: currentTeamSize,
        rate: strategy.overrideRate + strategy.overrideBonusRate,
        label: "Gen 1 Override",
      };

      if (strategy.streams.overrideG2 && strategy.gen2Rate > 0) {
        const gen2FYC = Math.round(currentTeamFYC * 0.7 * 2);
        const gen2 = Math.round(gen2FYC * strategy.gen2Rate);
        overrideInc += gen2;
        yearResult.streams.overrideG2 = {
          income: gen2,
          gen2FYC,
          rate: strategy.gen2Rate,
          label: "Gen 2 Override",
        };
      }
    }
    yearResult.teamSize = currentTeamSize;

    // ── AUM / ADVISORY ──
    let aumInc = 0;
    if (strategy.streams.aum) {
      if (yr === 1) {
        currentAUM =
          (strategy.existingAUM || 0) + (strategy.newAUMAnnual || 0) * 0.5;
      } else {
        currentAUM =
          currentAUM * (1 + strategy.aumGrowth) + (strategy.newAUMAnnual || 0);
      }
      aumInc = Math.round(currentAUM * strategy.aumFeeRate);
      yearResult.streams.aum = {
        income: aumInc,
        aum: currentAUM,
        feeRate: strategy.aumFeeRate,
        label: "AUM/Advisory Trail",
      };
      yearResult.aum = currentAUM;
    }

    // ── AFFILIATE TRACKS ──
    let affInc = 0;
    if (strategy.streams.affA) {
      const a = strategy.affA;
      const total = (a.low || 0) + (a.med || 0) + (a.high || 0);
      const base =
        (a.low || 0) * 250 + (a.med || 0) * 500 + (a.high || 0) * 1000;
      const bonus = total >= 10 ? Math.round(base * 0.25) : 0;
      const affAGrow = Math.pow(1.05, yr - 1);
      const affAInc = Math.round((base + bonus) * affAGrow);
      affInc += affAInc;
      yearResult.streams.affA = {
        income: affAInc,
        intros: Math.round(total * affAGrow),
        label: "Affiliate Track A",
      };
    }
    if (strategy.streams.affB) {
      const b = strategy.affB;
      const affBGrow = Math.pow(1.08, yr - 1);
      const affBInc = Math.round(
        (b.referrals || 0) * (b.avgGDC || 0) * (b.commRate || 0) * affBGrow,
      );
      affInc += affBInc;
      yearResult.streams.affB = { income: affBInc, label: "Affiliate Track B" };
    }
    if (strategy.streams.affC) {
      const c = strategy.affC;
      const affCGrow = Math.pow(1.06, yr - 1);
      const affCInc = Math.round(
        (c.cases || 0) * (c.avgGDC || 0) * (c.splitRate || 0) * affCGrow,
      );
      affInc += affCInc;
      yearResult.streams.affC = { income: affCInc, label: "Affiliate Track C" };
    }
    if (strategy.streams.affD) {
      const d = strategy.affD;
      const affDGrow = Math.pow(1.05, yr - 1);
      const affDInc = Math.round(
        (d.subAgents || 0) *
          (d.avgGDC || 0) *
          (d.overrideRate || 0) *
          affDGrow,
      );
      affInc += affDInc;
      yearResult.streams.affD = { income: affDInc, label: "Affiliate Track D" };
    }

    // ── CHANNEL REVENUE ──
    let channelInc = 0;
    let channelCost = 0;
    if (strategy.streams.channels) {
      const chKeys = Object.keys(strategy.channelSpend);
      chKeys.forEach((chKey) => {
        const monthlySpend = strategy.channelSpend[chKey] || 0;
        if (monthlySpend <= 0) return;
        const ch = CHANNELS[chKey];
        if (!ch) return;
        const chGrow = Math.pow(1 + (ch.growthRate || 0.1), yr - 1);
        let annualRev = 0;
        let annualSpend = 0;
        for (let m = 0; m < 12; m++) {
          const mSpend = monthlySpend * seasonMults[m] * chGrow;
          const mLeads = mSpend / ch.cpl;
          const mClients = mLeads * ch.cv;
          const mRev = mClients * ch.revPerClient;
          annualRev += mRev;
          annualSpend += mSpend;
        }
        channelInc += Math.round(annualRev);
        channelCost += Math.round(annualSpend);
      });
      if (channelInc > 0 || channelCost > 0) {
        yearResult.streams.channels = {
          income: channelInc,
          cost: channelCost,
          net: channelInc - channelCost,
          label: "Channel Revenue",
        };
      }
    }

    // ── STRATEGIC PARTNER ──
    let partnerInc = 0;
    if (strategy.streams.partner && strategy.partnerIncome > 0) {
      partnerInc = Math.round(
        strategy.partnerIncome * Math.pow(1 + strategy.partnerGrowth, yr - 1),
      );
      yearResult.streams.partner = { income: partnerInc, label: "Strategic Partner" };
    }

    // ── RENEWAL / TRAIL ──
    let renewalInc = 0;
    if (strategy.streams.renewal && yr >= strategy.renewalStartYear) {
      renewalInc = Math.round(cumulativePlaced * strategy.renewalRate);
      cumRenewal += renewalInc;
      yearResult.streams.renewal = {
        income: renewalInc,
        cumulativePlaced,
        rate: strategy.renewalRate,
        label: "Renewal/Trail",
      };
    }

    // ── BONUSES ──
    const subtotal =
      personalInc + overrideInc + aumInc + affInc + channelInc + partnerInc + renewalInc;
    let bonusInc = 0;
    if (strategy.streams.bonus && strategy.bonusPct > 0) {
      bonusInc = Math.round(subtotal * strategy.bonusPct);
      yearResult.streams.bonus = {
        income: bonusInc,
        pct: strategy.bonusPct,
        label: "Bonuses & Incentives",
      };
    }

    // ── TOTALS ──
    yearResult.totalIncome = subtotal + bonusInc;
    yearResult.totalCost = channelCost;
    yearResult.netIncome = yearResult.totalIncome - yearResult.totalCost;
    cumIncome += yearResult.totalIncome;
    cumCost += yearResult.totalCost;
    yearResult.cumulativeIncome = cumIncome;
    yearResult.cumulativeCost = cumCost;
    yearResult.cumulativeNet = cumIncome - cumCost;
    yearResult.cumulativePlaced = cumulativePlaced;

    // ── MONTHLY BREAKDOWN (first 3 years) ──
    if (yr <= 3) {
      yearResult.monthly = buildMonthlyDetail(strategy, yr, seasonMults, role);
    }

    results.push(yearResult);
  }

  // Reference cumRenewal for lint parity with v7 (the v7 IIFE tracks it
  // inside the loop and discards it; we preserve the variable so diffs
  // stay clean).
  void cumRenewal;

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// MONTHLY DETAIL BUILDER
// Fills in a month-by-month breakdown for the first 3 years. Applies
// seasonal multipliers, campaign boosts, and the year-1 ramp curve.
// ═══════════════════════════════════════════════════════════════════════════

export function buildMonthlyDetail(
  strategy: BIEStrategy,
  yr: number,
  seasonMults: SeasonProfile,
  role: BIERole,
): BIEMonthlyDetail[] {
  const months: BIEMonthlyDetail[] = [];
  const baseGDC = strategy.personalGDC || role.baseGDC;
  const growthR =
    strategy.personalGrowth != null
      ? strategy.personalGrowth
      : role.growthRate;
  const yearGDC =
    yr === 1 ? baseGDC : Math.round(baseGDC * Math.pow(1 + growthR, yr - 1));
  const monthlyGDC = yearGDC / 12;

  for (let m = 0; m < 12; m++) {
    let mult = seasonMults[m] || 1;
    (strategy.campaigns || []).forEach((camp) => {
      if (m + 1 >= camp.start && m + 1 <= camp.end) {
        mult *= 1 + (camp.boost || 0) / 100;
      }
    });

    let mGDC = Math.round(monthlyGDC * mult);
    if (yr === 1 && m < role.rampMonths) {
      mGDC = Math.round(mGDC * role.rampPct);
    }

    months.push({
      month: m + 1,
      multiplier: mult,
      personalGDC: strategy.streams.personal ? mGDC : 0,
      totalIncome: 0,
    });
  }
  return months;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORWARD/BACK PLANNING
// "What do I need to do to earn $X?" Computes required GDC, bracket rate,
// and a sales funnel back-plan with daily/weekly/monthly/annual cadence.
// ═══════════════════════════════════════════════════════════════════════════

export function backPlan(
  targetIncome: number,
  strategy: BIEStrategy,
): BIEBackPlanResult {
  const result: Partial<BIEBackPlanResult> = {};

  // Iterate bracket resolution 3 times to converge on the correct bracket.
  // v7 unrolls the loop to exactly three passes — keep that behaviour so
  // outputs match to the dollar.
  let bracketRate = strategy.bracketOverride || 0.7;
  let neededGDC = Math.round(targetIncome / bracketRate);
  bracketRate = getBracketRate(neededGDC);
  neededGDC = Math.round(targetIncome / bracketRate);
  bracketRate = getBracketRate(neededGDC);
  neededGDC = Math.round(targetIncome / bracketRate);

  result.neededGDC = neededGDC;
  result.bracketRate = bracketRate;
  result.bracketLabel = getBracketLabel(neededGDC);

  // Funnel back-plan
  const avgCase = 3000;
  const placed = Math.ceil(neededGDC / avgCase);
  const appRate = 0.8;
  const closeRate = 0.35;
  const showRate = 0.8;
  const approachRate = 0.18;
  const apps = Math.ceil(placed / appRate);
  const held = Math.ceil(apps / closeRate);
  const set = Math.ceil(held / showRate);
  const approaches = Math.ceil(set / approachRate);
  const months = 10;
  const monthlyApproaches = Math.ceil(approaches / months);
  const dailyApproaches = Math.ceil(monthlyApproaches / 21.5);
  const weeklyApproaches = Math.ceil(monthlyApproaches / 4.3);

  result.funnel = {
    approaches,
    set,
    held,
    apps,
    placed,
    avgCase,
    daily: { approaches: dailyApproaches },
    weekly: { approaches: weeklyApproaches },
    monthly: {
      approaches: monthlyApproaches,
      apps: Math.ceil(apps / months),
      gdc: Math.round(neededGDC / months),
    },
    annual: { approaches, apps, gdc: neededGDC },
  };

  if (strategy.streams.override && strategy.overrideRate > 0) {
    const overrideTarget = targetIncome * 0.3;
    const personalTarget = targetIncome - overrideTarget;
    const avgTeamFYC = 100000;
    const teamNeeded = Math.ceil(
      overrideTarget / (avgTeamFYC * strategy.overrideRate),
    );
    result.teamNeeded = teamNeeded;
    result.overrideTarget = overrideTarget;
    result.personalTarget = personalTarget;
  }

  return result as BIEBackPlanResult;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLL-UP: Aggregate team/org economics
// Takes an array of strategies (one per team member) and rolls totals
// by role and by income stream.
// ═══════════════════════════════════════════════════════════════════════════

export interface BIERollUpResult {
  totalGDC: number;
  totalIncome: number;
  totalOverride: number;
  totalAUM: number;
  totalChannelRev: number;
  totalCost: number;
  teamSize: number;
  avgGDC: number;
  avgIncome: number;
  byRole: Record<string, { count: number; income: number; gdc: number }>;
  byStream: Record<string, number>;
}

export function rollUp(strategies: BIEStrategy[]): BIERollUpResult {
  const totals: BIERollUpResult = {
    totalGDC: 0,
    totalIncome: 0,
    totalOverride: 0,
    totalAUM: 0,
    totalChannelRev: 0,
    totalCost: 0,
    teamSize: 0,
    avgGDC: 0,
    avgIncome: 0,
    byRole: {},
    byStream: {},
  };

  strategies.forEach((s) => {
    const sim = simulate(s, 1);
    if (!sim.length) return;
    const yr1 = sim[0];
    totals.totalIncome += yr1.totalIncome;
    totals.totalCost += yr1.totalCost;
    totals.teamSize++;

    // Accumulate GDC from personal + expanded streams
    const personalGDC = yr1.streams.personal?.gdc || 0;
    const expandedGDC = yr1.streams.expanded?.gdc || 0;
    totals.totalGDC += personalGDC + expandedGDC;

    // Accumulate override income (gen1 + gen2)
    totals.totalOverride += (yr1.streams.override?.income || 0) + (yr1.streams.overrideG2?.income || 0);

    // Accumulate AUM from the year result
    totals.totalAUM += yr1.aum || 0;

    // Accumulate channel revenue
    totals.totalChannelRev += yr1.streams.channels?.income || 0;

    const rKey = s.role || "new";
    if (!totals.byRole[rKey])
      totals.byRole[rKey] = { count: 0, income: 0, gdc: 0 };
    totals.byRole[rKey].count++;
    totals.byRole[rKey].income += yr1.totalIncome;
    totals.byRole[rKey].gdc += personalGDC + expandedGDC;

    Object.keys(yr1.streams).forEach((sk) => {
      if (!totals.byStream[sk]) totals.byStream[sk] = 0;
      totals.byStream[sk] += yr1.streams[sk].income || 0;
    });
  });

  if (totals.teamSize > 0) {
    totals.avgIncome = Math.round(totals.totalIncome / totals.teamSize);
    totals.avgGDC = Math.round(totals.totalGDC / totals.teamSize);
  }

  return totals;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLL-DOWN: Cascade targets from org level to individual
// Given an org-wide income target and team composition by role, returns
// per-role target + per-person target + a back-plan funnel for each role.
// ═══════════════════════════════════════════════════════════════════════════

export interface BIERollDownInput {
  role: BIERoleKey;
  count: number;
}

export interface BIERollDownResult {
  role: BIERoleKey;
  roleName: string;
  count: number;
  totalTarget: number;
  perPersonTarget: number;
  backPlan: BIEBackPlanResult;
}

export function rollDown(
  orgTarget: number,
  teamComposition: BIERollDownInput[],
): BIERollDownResult[] {
  let totalWeight = 0;
  teamComposition.forEach((tc) => {
    const r = ROLES[tc.role] || ROLES.new;
    totalWeight += r.baseGDC * tc.count;
  });
  if (totalWeight === 0) totalWeight = 1; // guard: prevent division by zero

  const targets: BIERollDownResult[] = [];
  teamComposition.forEach((tc) => {
    const r = ROLES[tc.role] || ROLES.new;
    const weight = (r.baseGDC * tc.count) / totalWeight;
    const roleTarget = Math.round(orgTarget * weight);
    const safeCount = Math.max(1, tc.count); // guard: prevent division by zero
    const perPerson = Math.round(roleTarget / safeCount);
    targets.push({
      role: tc.role,
      roleName: r.name,
      count: tc.count,
      totalTarget: roleTarget,
      perPersonTarget: perPerson,
      backPlan: backPlan(
        perPerson,
        createStrategy("", { role: tc.role, streams: { personal: true } }),
      ),
    });
  });

  return targets;
}

// ═══════════════════════════════════════════════════════════════════════════
// BUSINESS ECONOMICS: CAC, ROI, COGS, LTV, margin
// ═══════════════════════════════════════════════════════════════════════════

export interface BIEEconomicsResult {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  marketingCost: number;
  netProfit: number;
  netMarginPct: number;
  roi: number;
  cac: number;
  ltv: number;
  ltvCacRatio: number;
  yr1Income: number;
  yr5Income: number;
  totalYears: number;
  clientsAcquired: number;
}

export function calcEconomics(
  strategy: BIEStrategy,
  years?: number,
): BIEEconomicsResult {
  const yearCount = years || 5;
  const sim = simulate(strategy, yearCount);
  const yr1 = sim[0] || ({} as BIEYearResult);
  const yr5 = sim[Math.min(4, sim.length - 1)] || ({} as BIEYearResult);
  let totalIncome = 0;
  let totalCost = 0;
  sim.forEach((yr) => {
    totalIncome += yr.totalIncome;
    totalCost += yr.totalCost;
  });

  // COGS estimate: licensing, E&O, tech, office = ~15% of income
  const cogsRate = 0.15;
  const cogs = Math.round(totalIncome * cogsRate);
  const grossProfit = totalIncome - cogs;
  const grossMargin = totalIncome > 0 ? grossProfit / totalIncome : 0;
  const netProfit = grossProfit - totalCost;
  const netMargin = totalIncome > 0 ? netProfit / totalIncome : 0;

  let totalClients = 0;
  let totalMktgSpend = 0;
  Object.keys(strategy.channelSpend).forEach((chKey) => {
    const ch = CHANNELS[chKey];
    if (!ch) return;
    const spend = (strategy.channelSpend[chKey] || 0) * 12;
    const leads = spend / ch.cpl;
    const clients = leads * ch.cv;
    totalClients += clients;
    totalMktgSpend += spend;
  });
  const cac = totalClients > 0 ? Math.round(totalMktgSpend / totalClients) : 0;

  let avgLTV = 0;
  let chCount = 0;
  Object.keys(strategy.channelSpend).forEach((chKey) => {
    const ch = CHANNELS[chKey];
    if (ch && (strategy.channelSpend[chKey] || 0) > 0) {
      avgLTV += ch.ltv;
      chCount++;
    }
  });
  avgLTV = chCount > 0 ? Math.round(avgLTV / chCount) : 150000;

  return {
    revenue: totalIncome,
    cogs,
    grossProfit,
    grossMarginPct: grossMargin,
    marketingCost: totalCost,
    netProfit,
    netMarginPct: netMargin,
    roi: totalCost > 0 ? netProfit / totalCost : 0,
    cac,
    ltv: avgLTV,
    ltvCacRatio: cac > 0 ? avgLTV / cac : 0,
    yr1Income: yr1.totalIncome || 0,
    yr5Income: yr5.totalIncome || 0,
    totalYears: yearCount,
    clientsAcquired: Math.round(totalClients),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESET STRATEGIES
// Shortcuts for common role/stream combinations used by the quick-compare
// UI. Each preset calls createStrategy with a curated config matching
// the v7 defaults exactly.
// ═══════════════════════════════════════════════════════════════════════════

export function presetNewAssociate(): BIEStrategy {
  return createStrategy("New Associate — Personal Only", {
    role: "new",
    streams: { personal: true, expanded: true },
    team: [],
    channelSpend: {},
    seasonality: "ramp",
  });
}

export function presetExperiencedPro(): BIEStrategy {
  return createStrategy("Experienced Pro — Multi-Stream", {
    role: "exp",
    streams: { personal: true, expanded: true, aum: true, affB: true },
    team: [],
    channelSpend: { referral: 100, digital: 150 },
    existingAUM: 5000000,
    newAUMAnnual: 2000000,
    affB: { referrals: 5, avgGDC: 3000, commRate: 0.1 },
    seasonality: "flat",
  });
}

export function presetDirector(): BIEStrategy {
  return createStrategy("Director — Team Builder", {
    role: "dir",
    streams: {
      personal: true,
      override: true,
      overrideG2: true,
      aum: true,
      channels: true,
    },
    team: [
      { name: "Sr Assoc 1", role: "sa", fyc: 100000 },
      { name: "Sr Assoc 2", role: "sa", fyc: 80000 },
      { name: "New Assoc 1", role: "new", fyc: 65000 },
    ],
    channelSpend: { referral: 200, webinar: 150, digital: 300 },
    existingAUM: 10000000,
    newAUMAnnual: 3000000,
    overrideRate: 0.12,
    gen2Rate: 0.03,
    hiringRate: 2,
    seasonality: "q4Heavy",
  });
}

export function presetMD(): BIEStrategy {
  return createStrategy("Managing Director — Full Org", {
    role: "md",
    streams: {
      personal: true,
      override: true,
      overrideG2: true,
      aum: true,
      channels: true,
      affC: true,
      renewal: true,
      bonus: true,
    },
    team: [
      { name: "Director 1", role: "dir", fyc: 200000 },
      { name: "Director 2", role: "dir", fyc: 180000 },
      { name: "Sr Assoc 1", role: "sa", fyc: 120000 },
      { name: "Sr Assoc 2", role: "sa", fyc: 100000 },
    ],
    channelSpend: {
      referral: 300,
      webinar: 200,
      roundtable: 200,
      digital: 500,
      cpa: 200,
      linkedin: 300,
    },
    existingAUM: 25000000,
    newAUMAnnual: 5000000,
    overrideRate: 0.15,
    overrideBonusRate: 0.05,
    gen2Rate: 0.05,
    hiringRate: 4,
    affC: { cases: 10, avgGDC: 5000, splitRate: 0.3 },
    renewalRate: 0.04,
    bonusPct: 0.05,
    seasonality: "q4Heavy",
  });
}

export function presetRVP(): BIEStrategy {
  return createStrategy("RVP — Regional Organization", {
    role: "rvp",
    streams: {
      personal: true,
      override: true,
      overrideG2: true,
      aum: true,
      channels: true,
      affC: true,
      affD: true,
      partner: true,
      renewal: true,
      bonus: true,
    },
    team: [
      { name: "MD 1", role: "md", fyc: 280000 },
      { name: "MD 2", role: "md", fyc: 250000 },
      { name: "Director 1", role: "dir", fyc: 200000 },
    ],
    channelSpend: {
      referral: 500,
      webinar: 300,
      roundtable: 300,
      digital: 800,
      cpa: 300,
      partnership: 400,
      linkedin: 500,
      events: 500,
    },
    existingAUM: 50000000,
    newAUMAnnual: 10000000,
    overrideRate: 0.2,
    overrideBonusRate: 0.05,
    gen2Rate: 0.08,
    hiringRate: 6,
    affC: { cases: 20, avgGDC: 6000, splitRate: 0.25 },
    affD: { subAgents: 5, avgGDC: 80000, overrideRate: 0.08 },
    partnerIncome: 50000,
    partnerGrowth: 0.08,
    renewalRate: 0.04,
    bonusPct: 0.08,
    seasonality: "q4Heavy",
  });
}

export function presetAffiliateB(): BIEStrategy {
  return createStrategy("Affiliate Track B — Referral", {
    role: "affB",
    streams: { personal: true, affB: true },
    team: [],
    channelSpend: {},
    affB: { referrals: 10, avgGDC: 2500, commRate: 0.1 },
    seasonality: "flat",
  });
}

export function presetStrategicPartner(): BIEStrategy {
  return createStrategy("Strategic Partner", {
    role: "partner",
    streams: { partner: true, affA: true },
    team: [],
    channelSpend: {},
    partnerIncome: 30000,
    partnerGrowth: 0.1,
    affA: { low: 5, med: 3, high: 2 },
    seasonality: "flat",
  });
}

export const PRESETS = {
  newAssociate: presetNewAssociate,
  experiencedPro: presetExperiencedPro,
  director: presetDirector,
  md: presetMD,
  rvp: presetRVP,
  affiliateB: presetAffiliateB,
  strategicPartner: presetStrategicPartner,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// BIE NAMESPACE EXPORT
// Matches the v7 public surface so downstream callers can use `BIE.simulate`
// or `BIE.PRESETS` the same way they did in the HTML calculators.
// ═══════════════════════════════════════════════════════════════════════════

export const BIE = {
  ROLES,
  GDC_BRACKETS,
  CHANNELS,
  SEASON_PROFILES,
  STREAM_TYPES,
  PRESETS,
  FREQUENCIES,
  createStrategy,
  simulate,
  backPlan,
  rollUp,
  rollDown,
  calcEconomics,
  toFrequency,
  getBracketRate,
  getBracketLabel,
  getRoleInfo,
  getAllRoles,
  getAllChannels,
  getStreamTypes,
  getSeasonMultipliers,
} as const;

export default BIE;
