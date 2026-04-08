/**
 * BIE — Business Income Engine v7
 * Faithfully extracted from WealthBridge-Business-Calculator-v7.html
 *
 * 13 income streams, roles, GDC brackets, channels, seasonality,
 * simulate, backPlan, rollUp, rollDown, calcEconomics.
 */

import type {
  RoleKey, RoleProfile, GDCBracket, ChannelProfile, SeasonalityKey,
  BIEStrategy, BIEStreamResult, BIEYearResult, BIEMonthlyDetail,
  BackPlanResult, RollUpResult, EconomicsResult, FrequencyKey,
  TeamMember, AffiliateA, AffiliateB, AffiliateC, AffiliateD,
} from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export const ROLES: Record<RoleKey, RoleProfile> = {
  new:  { name: "New Associate", short: "New Assoc", level: 0, manages: [], reports: ["sa", "dir", "md", "rvp"], canProduce: true, baseGDC: 65000, rampMonths: 6, rampPct: 0.30, growthRate: 0.15 },
  exp:  { name: "Experienced Professional", short: "Exp Pro", level: 1, manages: [], reports: ["sa", "dir", "md", "rvp"], canProduce: true, baseGDC: 150000, rampMonths: 3, rampPct: 0.50, growthRate: 0.10 },
  sa:   { name: "Senior Associate", short: "Sr Assoc", level: 2, manages: ["new", "exp"], reports: ["dir", "md", "rvp"], canProduce: true, baseGDC: 180000, rampMonths: 0, rampPct: 1.0, growthRate: 0.08 },
  dir:  { name: "Director", short: "Director", level: 3, manages: ["sa"], reports: ["md", "rvp"], canProduce: true, baseGDC: 220000, rampMonths: 0, rampPct: 1.0, growthRate: 0.07 },
  md:   { name: "Managing Director", short: "MD", level: 4, manages: ["dir"], reports: ["rvp"], canProduce: true, baseGDC: 280000, rampMonths: 0, rampPct: 1.0, growthRate: 0.06 },
  rvp:  { name: "Regional Vice President", short: "RVP", level: 5, manages: ["md"], reports: [], canProduce: true, baseGDC: 350000, rampMonths: 0, rampPct: 1.0, growthRate: 0.05 },
  affA: { name: "Affiliate Track A", short: "Aff A", level: 0, manages: [], reports: [], canProduce: false, baseGDC: 0, rampMonths: 0, rampPct: 0, growthRate: 0.05 },
  affB: { name: "Affiliate Track B", short: "Aff B", level: 0, manages: [], reports: [], canProduce: true, baseGDC: 50000, rampMonths: 2, rampPct: 0.60, growthRate: 0.10 },
  affC: { name: "Affiliate Track C", short: "Aff C", level: 0, manages: [], reports: [], canProduce: true, baseGDC: 80000, rampMonths: 2, rampPct: 0.60, growthRate: 0.08 },
  affD: { name: "Affiliate Track D", short: "Aff D", level: 0, manages: [], reports: [], canProduce: false, baseGDC: 0, rampMonths: 0, rampPct: 0, growthRate: 0.05 },
  partner: { name: "Strategic Partner", short: "Partner", level: 0, manages: [], reports: [], canProduce: false, baseGDC: 0, rampMonths: 0, rampPct: 0, growthRate: 0.03 },
};

export const GDC_BRACKETS: GDCBracket[] = [
  { min: 0, max: 64999, rate: 0.55, label: "<$65K" },
  { min: 65000, max: 94999, rate: 0.65, label: "$65-95K" },
  { min: 95000, max: 149999, rate: 0.70, label: "$95-150K" },
  { min: 150000, max: 199999, rate: 0.75, label: "$150-200K" },
  { min: 200000, max: 239999, rate: 0.80, label: "$200-240K" },
  { min: 240000, max: 274999, rate: 0.825, label: "$240-275K" },
  { min: 275000, max: 299999, rate: 0.84, label: "$275-300K" },
  { min: 300000, max: Infinity, rate: 0.85, label: "$300K+" },
];

export const CHANNELS: Record<string, ChannelProfile> = {
  referral:    { name: "Referral Program", cpl: 50, cv: 0.25, revPerClient: 30000, ltv: 273342, attr: 0.60, growthRate: 0.08 },
  webinar:     { name: "Webinars", cpl: 90, cv: 0.12, revPerClient: 12500, ltv: 83678, attr: 0.85, growthRate: 0.12 },
  roundtable:  { name: "Roundtable Events", cpl: 120, cv: 0.15, revPerClient: 30000, ltv: 212439, attr: 0.70, growthRate: 0.10 },
  digital:     { name: "Digital (Meta+Google)", cpl: 85, cv: 0.08, revPerClient: 15000, ltv: 89123, attr: 0.95, growthRate: 0.15 },
  community:   { name: "Community Events", cpl: 75, cv: 0.10, revPerClient: 10000, ltv: 53189, attr: 0.80, growthRate: 0.06 },
  cpa:         { name: "CPA/Attorney Partners", cpl: 180, cv: 0.20, revPerClient: 30000, ltv: 240318, attr: 0.40, growthRate: 0.05 },
  partnership: { name: "Strategic Partnerships", cpl: 150, cv: 0.12, revPerClient: 20000, ltv: 136381, attr: 0.45, growthRate: 0.07 },
  linkedin:    { name: "LinkedIn B2B", cpl: 130, cv: 0.10, revPerClient: 35000, ltv: 280000, attr: 0.50, growthRate: 0.10 },
  affiliate:   { name: "Affiliate Network", cpl: 60, cv: 0.15, revPerClient: 18000, ltv: 120000, attr: 0.55, growthRate: 0.12 },
  events:      { name: "Industry Events/Conf", cpl: 200, cv: 0.18, revPerClient: 40000, ltv: 320000, attr: 0.30, growthRate: 0.04 },
};

export const SEASON_PROFILES: Record<SeasonalityKey, number[]> = {
  flat:         [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  q4Heavy:      [0.7, 0.7, 0.8, 0.8, 0.9, 0.9, 0.8, 0.8, 1.0, 1.2, 1.4, 1.7],
  summer:       [0.8, 0.8, 0.9, 1.0, 1.1, 1.3, 1.3, 1.2, 1.0, 0.9, 0.8, 0.7],
  eventDriven:  [0.6, 0.6, 1.2, 0.6, 0.6, 1.2, 0.6, 0.6, 1.2, 0.6, 0.6, 1.8],
  ramp:         [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5],
  custom:       [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};

export const STREAM_TYPES = [
  "personal", "expanded", "override", "overrideG2", "aum",
  "affA", "affB", "affC", "affD", "channels", "partner", "renewal", "bonus",
] as const;

export const FREQUENCIES: Record<FrequencyKey, number> = {
  daily: 365, weekly: 52, biweekly: 26, monthly: 12, quarterly: 4, semiannual: 2, annual: 1,
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export function getBracketRate(gdc: number): number {
  for (const b of GDC_BRACKETS) {
    if (gdc >= b.min && gdc <= b.max) return b.rate;
  }
  return GDC_BRACKETS[GDC_BRACKETS.length - 1].rate;
}

export function getBracketLabel(gdc: number): string {
  for (const b of GDC_BRACKETS) {
    if (gdc >= b.min && gdc <= b.max) return b.label;
  }
  return GDC_BRACKETS[GDC_BRACKETS.length - 1].label;
}

export function getRoleInfo(role: RoleKey): RoleProfile {
  return ROLES[role] || ROLES.new;
}

export function toFrequency(annual: number, freq: FrequencyKey): number {
  return Math.round(annual / FREQUENCIES[freq]);
}

export function getSeasonMultipliers(key: SeasonalityKey, custom?: number[] | null): number[] {
  if (key === "custom" && custom && custom.length === 12) return custom;
  return SEASON_PROFILES[key] || SEASON_PROFILES.flat;
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

export function createStrategy(name: string, config: Partial<BIEStrategy>): BIEStrategy {
  const role = config.role || "new";
  const roleInfo = ROLES[role] || ROLES.new;
  return {
    name: name || "Untitled Strategy",
    role,
    streams: config.streams || { personal: true },
    team: config.team || [],
    channelSpend: config.channelSpend || {},
    seasonality: config.seasonality || "flat",
    customSeason: config.customSeason || null,
    personalGrowth: config.personalGrowth ?? roleInfo.growthRate,
    teamGrowth: config.teamGrowth ?? 0.08,
    aumGrowth: config.aumGrowth ?? 0.10,
    channelGrowth: config.channelGrowth ?? 0.10,
    hiringRate: config.hiringRate ?? 2,
    retentionRate: config.retentionRate ?? 0.85,
    affA: config.affA,
    affB: config.affB,
    affC: config.affC,
    affD: config.affD,
    partnerIncome: config.partnerIncome ?? 0,
    partnerGrowth: config.partnerGrowth ?? 0.05,
    existingAUM: config.existingAUM ?? 0,
    newAUMAnnual: config.newAUMAnnual ?? 0,
    aumFeeRate: config.aumFeeRate ?? 0.01,
    personalGDC: config.personalGDC ?? null,
    wbPct: config.wbPct ?? 0.08,
    bracketOverride: config.bracketOverride ?? null,
    overrideRate: config.overrideRate ?? 0.15,
    overrideBonusRate: config.overrideBonusRate ?? 0.05,
    gen2Rate: config.gen2Rate ?? 0.06,
    renewalRate: config.renewalRate ?? 0.04,
    renewalStartYear: config.renewalStartYear ?? 3,
    bonusPct: config.bonusPct ?? 0.05,
    campaigns: config.campaigns || [],
    notes: config.notes || "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SIMULATE (year-by-year BIE simulation)
// ═══════════════════════════════════════════════════════════════════════════

export function simulate(strategy: BIEStrategy, years: number = 30): BIEYearResult[] {
  if (!strategy) throw new Error("BIE.simulate: strategy is required");
  if (years < 1 || years > 200) throw new Error("BIE.simulate: years must be 1-200");
  const s = strategy;
  const roleInfo = ROLES[s.role] || ROLES.new;
  const seasonMult = getSeasonMultipliers(s.seasonality, s.customSeason);

  const results: BIEYearResult[] = [];
  let cumIncome = 0, cumCost = 0, cumNet = 0, cumPlaced = 0;
  let teamSize = s.team.length;
  let aumBalance = s.existingAUM || 0;

  for (let yr = 1; yr <= years; yr++) {
    const streams: Record<string, BIEStreamResult> = {};
    let totalIncome = 0;
    let totalCost = 0;

    // ── PERSONAL PRODUCTION ──
    if (s.streams.personal && roleInfo.canProduce) {
      const baseGDC = s.personalGDC ?? roleInfo.baseGDC;
      const rampFactor = yr === 1 && roleInfo.rampMonths > 0
        ? roleInfo.rampPct + (1 - roleInfo.rampPct) * (12 - roleInfo.rampMonths) / 12
        : 1;
      const growthFactor = Math.pow(1 + (s.personalGrowth ?? roleInfo.growthRate), yr - 1);
      const gdc = Math.round(baseGDC * rampFactor * growthFactor);
      const bracket = s.bracketOverride ?? getBracketRate(gdc);
      const income = Math.round(gdc * bracket);

      streams.personal = { income, label: "Personal Production", gdc, bracket };
      totalIncome += income;

      // WealthBridge practice income
      if (s.wbPct && s.wbPct > 0) {
        const wbIncome = Math.round(income * s.wbPct);
        streams.expanded = { income: wbIncome, label: "WB Practice Income", pct: s.wbPct } as any;
        totalIncome += wbIncome;
      }
    }

    // ── TEAM OVERRIDES (Gen 1) ──
    if (s.streams.override && s.team.length > 0) {
      const teamGrowth = Math.pow(1 + (s.teamGrowth || 0.08), yr - 1);
      let teamFYC = 0;
      for (const m of s.team) {
        teamFYC += Math.round((m.fyc || m.f || 0) * teamGrowth);
      }
      // Add new hires
      const newHires = Math.round((s.hiringRate || 2) * (yr - 1));
      const retained = Math.round(newHires * (s.retentionRate || 0.85));
      teamSize = s.team.length + retained;
      teamFYC += retained * Math.round(65000 * teamGrowth);

      const overrideIncome = Math.round(teamFYC * (s.overrideRate || 0.15));
      const bonusIncome = Math.round(teamFYC * (s.overrideBonusRate || 0.05));
      streams.override = { income: overrideIncome + bonusIncome, label: "Team Overrides (Gen 1)", teamFYC, teamSize, rate: s.overrideRate || 0.15 };
      totalIncome += overrideIncome + bonusIncome;
    }

    // ── GEN 2 OVERRIDES ──
    if (s.streams.overrideG2 && yr >= 3) {
      const gen2FYC = Math.round(teamSize * 50000 * Math.pow(1.05, yr - 3));
      const gen2Income = Math.round(gen2FYC * (s.gen2Rate || 0.06));
      streams.overrideG2 = { income: gen2Income, label: "Gen 2 Overrides", gen2FYC, rate: s.gen2Rate || 0.06 };
      totalIncome += gen2Income;
    }

    // ── AUM TRAIL ──
    if (s.streams.aum && (s.existingAUM || s.newAUMAnnual)) {
      aumBalance = aumBalance * (1 + (s.aumGrowth || 0.10)) + (s.newAUMAnnual || 0);
      const feeRate = s.aumFeeRate || 0.01;
      const aumIncome = Math.round(aumBalance * feeRate);
      streams.aum = { income: aumIncome, label: "AUM Trail", aum: Math.round(aumBalance), feeRate };
      totalIncome += aumIncome;
    }

    // ── AFFILIATE TRACK A (intro-based) ──
    if (s.streams.affA && s.affA) {
      const a = s.affA;
      const intros = Math.round((a.low * 2000 + a.med * 5000 + a.high * 12000) * Math.pow(1.05, yr - 1));
      streams.affA = { income: intros, label: "Affiliate Track A", intros: a.low + a.med + a.high };
      totalIncome += intros;
    }

    // ── AFFILIATE TRACK B (referral) ──
    if (s.streams.affB && s.affB) {
      const b = s.affB;
      const refs = Math.round(b.referrals * Math.pow(1.08, yr - 1));
      const income = Math.round(refs * b.avgGDC * b.commRate);
      streams.affB = { income, label: "Affiliate Track B", gdc: refs * b.avgGDC, rate: b.commRate };
      totalIncome += income;
    }

    // ── AFFILIATE TRACK C (case splits) ──
    if (s.streams.affC && s.affC) {
      const c = s.affC;
      const cases = Math.round(c.cases * Math.pow(1.05, yr - 1));
      const income = Math.round(cases * c.avgGDC * c.splitRate);
      streams.affC = { income, label: "Affiliate Track C", gdc: cases * c.avgGDC, rate: c.splitRate };
      totalIncome += income;
    }

    // ── AFFILIATE TRACK D (sub-agent override) ──
    if (s.streams.affD && s.affD) {
      const d = s.affD;
      const agents = Math.round(d.subAgents * Math.pow(1.10, yr - 1));
      const income = Math.round(agents * d.avgGDC * d.overrideRate);
      streams.affD = { income, label: "Affiliate Track D", gdc: agents * d.avgGDC, rate: d.overrideRate };
      totalIncome += income;
    }

    // ── CHANNEL MARKETING ──
    if (s.streams.channels && Object.keys(s.channelSpend).length > 0) {
      let channelIncome = 0;
      let channelCost = 0;
      for (const [chKey, spend] of Object.entries(s.channelSpend)) {
        const ch = CHANNELS[chKey];
        if (!ch || spend <= 0) continue;
        const growthFactor = Math.pow(1 + (s.channelGrowth || ch.growthRate), yr - 1);
        const monthlySpend = spend * growthFactor;
        const leads = monthlySpend / ch.cpl;
        const clients = leads * ch.cv;
        const revenue = clients * ch.revPerClient * 12;
        channelIncome += Math.round(revenue);
        channelCost += Math.round(monthlySpend * 12);
      }
      streams.channels = { income: channelIncome, label: "Channel Marketing", cost: channelCost, net: channelIncome - channelCost };
      totalIncome += channelIncome;
      totalCost += channelCost;
    }

    // ── PARTNER INCOME ──
    if (s.streams.partner && s.partnerIncome) {
      const partnerGrowth = Math.pow(1 + (s.partnerGrowth || 0.05), yr - 1);
      const income = Math.round((s.partnerIncome || 0) * partnerGrowth);
      streams.partner = { income, label: "Strategic Partner Income" };
      totalIncome += income;
    }

    // ── RENEWAL INCOME ──
    if (s.streams.renewal && yr >= (s.renewalStartYear || 3)) {
      const renewalBase = cumIncome * (s.renewalRate || 0.04);
      const income = Math.round(renewalBase);
      streams.renewal = { income, label: "Renewal Income", rate: s.renewalRate || 0.04 };
      totalIncome += income;
    }

    // ── BONUS ──
    if (s.streams.bonus) {
      const income = Math.round(totalIncome * (s.bonusPct || 0.05));
      streams.bonus = { income, label: "Performance Bonus", pct: s.bonusPct || 0.05 };
      totalIncome += income;
    }

    // ── MONTHLY BREAKDOWN ──
    const monthly: BIEMonthlyDetail[] = [];
    for (let m = 0; m < 12; m++) {
      const mult = seasonMult[m] || 1;
      monthly.push({
        month: m + 1,
        multiplier: mult,
        personalGDC: Math.round((streams.personal?.gdc || 0) / 12 * mult),
        totalIncome: Math.round(totalIncome / 12 * mult),
      });
    }

    // ── CAMPAIGN BOOSTS ──
    if (s.campaigns && s.campaigns.length > 0) {
      for (const camp of s.campaigns) {
        for (let m = (camp.start || 1) - 1; m < (camp.end || 12); m++) {
          if (monthly[m]) {
            monthly[m].totalIncome = Math.round(monthly[m].totalIncome * (1 + (camp.boost || 0)));
          }
        }
      }
    }

    const netIncome = totalIncome - totalCost;
    cumIncome += totalIncome;
    cumCost += totalCost;
    cumNet += netIncome;

    results.push({
      year: yr,
      streams,
      totalIncome: Math.round(totalIncome),
      totalCost: Math.round(totalCost),
      netIncome: Math.round(netIncome),
      cumulativeIncome: Math.round(cumIncome),
      cumulativeCost: Math.round(cumCost),
      cumulativeNet: Math.round(cumNet),
      teamSize,
      aum: Math.round(aumBalance),
      monthly,
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// BACK PLAN (reverse engineering: target income → required GDC)
// ═══════════════════════════════════════════════════════════════════════════

export function backPlan(targetIncome: number, role: RoleKey = "new"): BackPlanResult {
  if (targetIncome <= 0) throw new Error("BIE.backPlan: targetIncome must be positive");
  const roleInfo = ROLES[role] || ROLES.new;

  // Find bracket that achieves target
  let neededGDC = 0;
  let bracketRate = 0.55;
  for (const b of GDC_BRACKETS) {
    const maxIncome = b.max === Infinity ? Infinity : b.max * b.rate;
    if (targetIncome <= maxIncome || b.max === Infinity) {
      neededGDC = Math.round(targetIncome / b.rate);
      bracketRate = b.rate;
      break;
    }
  }

  // Funnel metrics
  const avgCase = 8000;
  const placed = Math.ceil(neededGDC / avgCase);
  const apps = Math.ceil(placed / 0.85);
  const held = Math.ceil(apps / 0.70);
  const set = Math.ceil(held / 0.60);
  const approaches = Math.ceil(set / 0.25);

  return {
    neededGDC,
    bracketRate,
    bracketLabel: getBracketLabel(neededGDC),
    funnel: {
      approaches,
      set,
      held,
      apps,
      placed,
      avgCase,
      daily: { approaches: Math.ceil(approaches / 250) },
      weekly: { approaches: Math.ceil(approaches / 50) },
      monthly: {
        approaches: Math.ceil(approaches / 12),
        apps: Math.ceil(apps / 12),
        gdc: Math.round(neededGDC / 12),
      },
      annual: { approaches, apps, gdc: neededGDC },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ROLL UP / ROLL DOWN
// ═══════════════════════════════════════════════════════════════════════════

export function rollUp(strategies: BIEStrategy[], year: number = 1): RollUpResult {
  if (!strategies || strategies.length === 0) throw new Error("BIE.rollUp: at least one strategy required");
  let totalGDC = 0, totalIncome = 0, totalOverride = 0, totalAUM = 0;
  let totalChannelRev = 0, totalCost = 0, totalTeam = 0;
  const byRole: Record<string, { count: number; income: number; gdc: number }> = {};
  const byStream: Record<string, number> = {};

  for (const strat of strategies) {
    const results = simulate(strat, Math.max(year, 1));
    const yr = results[Math.min(year - 1, results.length - 1)];
    if (!yr) continue;

    totalIncome += yr.totalIncome;
    totalCost += yr.totalCost;
    totalTeam += yr.teamSize;
    totalAUM += yr.aum;

    for (const [key, stream] of Object.entries(yr.streams)) {
      byStream[key] = (byStream[key] || 0) + stream.income;
      if (key === "personal") {
        totalGDC += stream.gdc || 0;
      }
      if (key === "override" || key === "overrideG2") {
        totalOverride += stream.income;
      }
      if (key === "channels") {
        totalChannelRev += stream.income;
      }
    }

    const role = strat.role;
    if (!byRole[role]) byRole[role] = { count: 0, income: 0, gdc: 0 };
    byRole[role].count++;
    byRole[role].income += yr.totalIncome;
    byRole[role].gdc += yr.streams.personal?.gdc || 0;
  }

  return {
    totalGDC,
    totalIncome,
    totalOverride,
    totalAUM,
    totalChannelRev,
    totalCost,
    teamSize: totalTeam,
    avgGDC: strategies.length > 0 ? Math.round(totalGDC / strategies.length) : 0,
    avgIncome: strategies.length > 0 ? Math.round(totalIncome / strategies.length) : 0,
    byRole,
    byStream,
  };
}

export function rollDown(strategy: BIEStrategy, year: number = 1): Record<string, BIEStreamResult> {
  const results = simulate(strategy, Math.max(year, 1));
  const yr = results[Math.min(year - 1, results.length - 1)];
  return yr?.streams || {};
}

// ═══════════════════════════════════════════════════════════════════════════
// ECONOMICS CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════

export function calcEconomics(strategy: BIEStrategy, years: number = 5): EconomicsResult {
  const results = simulate(strategy, years);
  const yr1 = results[0];
  const yr5 = results[Math.min(years - 1, results.length - 1)];

  const totalRevenue = results.reduce((s, r) => s + r.totalIncome, 0);
  const totalCost = results.reduce((s, r) => s + r.totalCost, 0);
  const cogs = Math.round(totalRevenue * 0.15);
  const grossProfit = totalRevenue - cogs;
  const netProfit = grossProfit - totalCost;

  // Channel-based client acquisition
  let totalClients = 0;
  for (const [chKey, spend] of Object.entries(strategy.channelSpend)) {
    const ch = CHANNELS[chKey];
    if (!ch || spend <= 0) continue;
    const leads = (spend * 12 * years) / ch.cpl;
    totalClients += Math.round(leads * ch.cv);
  }
  totalClients = Math.max(totalClients, 1);

  const cac = Math.round(totalCost / totalClients);
  const ltv = Math.round(totalRevenue / totalClients);

  return {
    revenue: totalRevenue,
    cogs,
    grossProfit,
    grossMarginPct: totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) / 100 : 0,
    marketingCost: totalCost,
    netProfit,
    netMarginPct: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) / 100 : 0,
    roi: totalCost > 0 ? Math.round((netProfit / totalCost) * 100) / 100 : 0,
    cac,
    ltv,
    ltvCacRatio: cac > 0 ? Math.round((ltv / cac) * 100) / 100 : 0,
    yr1Income: yr1?.totalIncome || 0,
    yr5Income: yr5?.totalIncome || 0,
    totalYears: years,
    clientsAcquired: totalClients,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS (exact from v7)
// ═══════════════════════════════════════════════════════════════════════════

export function presetNewAssociate(): BIEStrategy {
  return createStrategy("New Associate — Year 1", {
    role: "new",
    streams: { personal: true },
    team: [],
    channelSpend: {},
    seasonality: "ramp",
  });
}

export function presetExperiencedPro(): BIEStrategy {
  return createStrategy("Experienced Professional", {
    role: "exp",
    streams: { personal: true, channels: true },
    team: [],
    channelSpend: { referral: 200, digital: 500 },
    seasonality: "flat",
  });
}

export function presetDirector(): BIEStrategy {
  return createStrategy("Director — Team Builder", {
    role: "dir",
    streams: { personal: true, override: true, aum: true, channels: true, renewal: true, bonus: true },
    team: [
      { name: "SA 1", role: "sa", fyc: 150000 },
      { name: "Exp 1", role: "exp", fyc: 120000 },
      { name: "New 1", role: "new", fyc: 65000 },
    ],
    channelSpend: { referral: 300, webinar: 200, digital: 500 },
    existingAUM: 10000000,
    newAUMAnnual: 3000000,
    overrideRate: 0.15,
    hiringRate: 3,
    renewalRate: 0.04,
    bonusPct: 0.05,
    seasonality: "q4Heavy",
  });
}

export function presetMD(): BIEStrategy {
  return createStrategy("Managing Director — Growth", {
    role: "md",
    streams: { personal: true, override: true, overrideG2: true, aum: true, channels: true, affA: true, renewal: true, bonus: true },
    team: [
      { name: "Dir 1", role: "dir", fyc: 200000 },
      { name: "Dir 2", role: "dir", fyc: 180000 },
      { name: "SA 1", role: "sa", fyc: 150000 },
      { name: "SA 2", role: "sa", fyc: 140000 },
    ],
    channelSpend: { referral: 400, webinar: 300, roundtable: 200, digital: 600, cpa: 200 },
    existingAUM: 25000000,
    newAUMAnnual: 5000000,
    overrideRate: 0.18,
    overrideBonusRate: 0.05,
    gen2Rate: 0.06,
    hiringRate: 4,
    affA: { low: 8, med: 4, high: 2 },
    renewalRate: 0.04,
    bonusPct: 0.06,
    seasonality: "q4Heavy",
  });
}

export function presetRVP(): BIEStrategy {
  return createStrategy("RVP — Regional Leader", {
    role: "rvp",
    streams: { personal: true, override: true, overrideG2: true, aum: true, channels: true, affC: true, affD: true, partner: true, renewal: true, bonus: true },
    team: [
      { name: "MD 1", role: "md", fyc: 280000 },
      { name: "MD 2", role: "md", fyc: 250000 },
      { name: "Director 1", role: "dir", fyc: 200000 },
    ],
    channelSpend: { referral: 500, webinar: 300, roundtable: 300, digital: 800, cpa: 300, partnership: 400, linkedin: 500, events: 500 },
    existingAUM: 50000000,
    newAUMAnnual: 10000000,
    overrideRate: 0.20,
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
    affB: { referrals: 10, avgGDC: 2500, commRate: 0.10 },
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
    partnerGrowth: 0.10,
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
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
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
  getSeasonMultipliers,
  getAllRoles: (): RoleKey[] => Object.keys(ROLES) as RoleKey[],
  getAllChannels: () => CHANNELS,
  getStreamTypes: () => STREAM_TYPES,
};

export default BIE;
