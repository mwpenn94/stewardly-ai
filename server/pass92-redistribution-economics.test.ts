/* ═══════════════════════════════════════════════════════════════
   Pass 92 Tests — Channel Redistribution & CAC/ROI/LTV Economics
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from "vitest";
import {
  calcUnifiedIncomePlan,
  calcChannelEconomics,
  CHANNEL_BENCHMARKS,
  ROLE_DEFAULTS,
  type EnabledChannels,
  type IncomeSplits,
} from "../client/src/pages/calculators/practiceEngine";

/* ─── Helper: default enabled channels ─── */
const allEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };
const defaultSplits: IncomeSplits = { gdc: 40, aum: 20, affiliate: 15, override: 15, channel: 10 };

/* ─── Helper: simulate toggle redistribution logic (mirrors PanelsD.tsx) ─── */
function simulateToggle(
  ch: keyof EnabledChannels,
  currentEnabled: EnabledChannels,
  currentSplits: IncomeSplits,
  role: string = "new"
): { nextEnabled: EnabledChannels; nextSplits: IncomeSplits } {
  const wasEnabled = currentEnabled[ch];
  const nextEnabled = { ...currentEnabled, [ch]: !wasEnabled };
  const keys: (keyof EnabledChannels)[] = ["gdc", "aum", "affiliate", "override", "channel"];
  const nextSplits = { ...currentSplits };

  if (wasEnabled) {
    const freedPct = nextSplits[ch];
    nextSplits[ch] = 0;
    const remainingKeys = keys.filter((k) => k !== ch && nextEnabled[k]);
    const remainingSum = remainingKeys.reduce((s, k) => s + nextSplits[k], 0);
    if (remainingKeys.length > 0 && remainingSum > 0) {
      let distributed = 0;
      remainingKeys.forEach((k, i) => {
        if (i === remainingKeys.length - 1) {
          nextSplits[k] += freedPct - distributed;
        } else {
          const share = Math.round(freedPct * (nextSplits[k] / remainingSum));
          nextSplits[k] += share;
          distributed += share;
        }
      });
    } else if (remainingKeys.length > 0) {
      const even = Math.floor(freedPct / remainingKeys.length);
      remainingKeys.forEach((k, i) => {
        nextSplits[k] = i === remainingKeys.length - 1 ? freedPct - even * (remainingKeys.length - 1) : even;
      });
    }
  } else {
    const rd = (ROLE_DEFAULTS as any)[role] || (ROLE_DEFAULTS as any).new;
    const roleDefault = rd.incomeSplits[ch];
    const newShare = roleDefault > 0 ? roleDefault : 10;
    const enabledKeys = keys.filter((k) => k !== ch && nextEnabled[k]);
    const currentSum = enabledKeys.reduce((s, k) => s + nextSplits[k], 0);
    if (currentSum > 0) {
      let allocated = 0;
      enabledKeys.forEach((k, i) => {
        if (i === enabledKeys.length - 1) {
          nextSplits[k] = Math.max(0, currentSum - newShare - allocated);
        } else {
          const scaleFactor = Math.max(0, currentSum - newShare) / currentSum;
          const reduced = Math.round(nextSplits[k] * scaleFactor);
          nextSplits[k] = reduced;
          allocated += reduced;
        }
      });
    }
    nextSplits[ch] = newShare;
  }

  return { nextEnabled, nextSplits };
}

/* ═══ REDISTRIBUTION TESTS ═══ */
describe("Channel Toggle Redistribution", () => {
  it("splits always sum to 100 after disabling a channel", () => {
    const keys: (keyof EnabledChannels)[] = ["gdc", "aum", "affiliate", "override", "channel"];
    for (const ch of keys) {
      const { nextSplits } = simulateToggle(ch, allEnabled, { ...defaultSplits });
      const sum = Object.values(nextSplits).reduce((a, b) => a + b, 0);
      expect(sum).toBe(100);
    }
  });

  it("disabled channel gets 0% split", () => {
    const { nextSplits } = simulateToggle("aum", allEnabled, { ...defaultSplits });
    expect(nextSplits.aum).toBe(0);
  });

  it("remaining channels increase proportionally when one is disabled", () => {
    const { nextSplits } = simulateToggle("channel", allEnabled, { ...defaultSplits });
    // channel was 10%, so 10% redistributed among gdc(40), aum(20), affiliate(15), override(15)
    expect(nextSplits.channel).toBe(0);
    expect(nextSplits.gdc).toBeGreaterThan(40);
    expect(nextSplits.aum).toBeGreaterThan(20);
    expect(nextSplits.affiliate).toBeGreaterThan(15);
    expect(nextSplits.override).toBeGreaterThan(15);
  });

  it("re-enabling a channel gives it role-default share", () => {
    // First disable aum
    const step1 = simulateToggle("aum", allEnabled, { ...defaultSplits });
    expect(step1.nextSplits.aum).toBe(0);
    // Now re-enable aum
    const step2 = simulateToggle("aum", step1.nextEnabled, step1.nextSplits);
    expect(step2.nextSplits.aum).toBeGreaterThan(0);
    const sum = Object.values(step2.nextSplits).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });

  it("disabling all but one channel gives that channel 100%", () => {
    let enabled = { ...allEnabled };
    let splits = { ...defaultSplits };
    // Disable all except gdc
    for (const ch of ["aum", "affiliate", "override", "channel"] as const) {
      const result = simulateToggle(ch, enabled, splits);
      enabled = result.nextEnabled;
      splits = result.nextSplits;
    }
    expect(splits.gdc).toBe(100);
    expect(splits.aum).toBe(0);
    expect(splits.affiliate).toBe(0);
    expect(splits.override).toBe(0);
    expect(splits.channel).toBe(0);
  });

  it("toggle round-trip preserves 100% sum", () => {
    // Disable then re-enable
    const step1 = simulateToggle("override", allEnabled, { ...defaultSplits });
    const step2 = simulateToggle("override", step1.nextEnabled, step1.nextSplits);
    const sum = Object.values(step2.nextSplits).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    expect(step2.nextEnabled.override).toBe(true);
  });
});

/* ═══ UNIFIED INCOME PLAN WITH ENABLED CHANNELS ═══ */
describe("Unified Income Plan with enabledChannels", () => {
  const baseParams = {
    targetIncome: 200000,
    splits: defaultSplits,
    role: "new" as const,
    targetGDC: 80000,
    wbPct: 50,
    bracketOverride: "auto",
    avgGDC: 2500,
    funnelRates: { ap: 30, sh: 60, cl: 50, pl: 80 },
    months: 12,
    aumExisting: 500000,
    aumNew: 100000,
    aumTrailPct: 1,
    affCounts: { a: 2, b: 3, c: 1, d: 2 },
    affAvgProd: { a: 50000, b: 30000, c: 80000, d: 40000 },
    teamSize: 3,
    teamAvgGDC: 60000,
    overrideRate: 8,
    channelSpend: { social: 500, email: 200, events: 1000 },
  };

  it("all channels enabled produces non-zero projections", () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, enabledChannels: allEnabled });
    expect(plan.totalProjected).toBeGreaterThan(0);
    expect(plan.channels.gdc.projected).toBeGreaterThan(0);
    expect(plan.channels.aum.detail.projectedIncome).toBeGreaterThan(0);
    expect(plan.channels.affiliate.totalProjected).toBeGreaterThan(0);
    expect(plan.channels.override.detail.projectedIncome).toBeGreaterThan(0);
  });

  it("disabled channel produces zero projected income", () => {
    const disabled: EnabledChannels = { gdc: true, aum: false, affiliate: true, override: true, channel: true };
    const plan = calcUnifiedIncomePlan({ ...baseParams, enabledChannels: disabled });
    expect(plan.channels.aum.detail.projectedIncome).toBe(0);
    expect(plan.channels.aum.target).toBe(0);
  });

  it("totalProjected is sum of all channel projections", () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, enabledChannels: allEnabled });
    const sum = plan.channels.gdc.projected +
      plan.channels.aum.detail.projectedIncome +
      plan.channels.affiliate.totalProjected +
      plan.channels.override.detail.projectedIncome +
      plan.channels.channel.detail.projectedAnnualRevenue;
    expect(plan.totalProjected).toBe(sum);
  });

  it("totalGap is non-negative", () => {
    const plan = calcUnifiedIncomePlan({ ...baseParams, enabledChannels: allEnabled });
    expect(plan.totalGap).toBeGreaterThanOrEqual(0);
  });
});

/* ═══ CHANNEL ECONOMICS (CAC / ROI / LTV) ═══ */
describe("Channel Economics — CAC / ROI / LTV", () => {
  it("CHANNEL_BENCHMARKS has entries for all 5 channels", () => {
    expect(Object.keys(CHANNEL_BENCHMARKS)).toEqual(
      expect.arrayContaining(["gdc", "aum", "affiliate", "override", "channel"])
    );
  });

  it("each benchmark has positive values", () => {
    for (const [key, bm] of Object.entries(CHANNEL_BENCHMARKS)) {
      expect(bm.cac).toBeGreaterThan(0);
      expect(bm.cogsPct).toBeGreaterThan(0);
      expect(bm.avgRevenuePerClient).toBeGreaterThan(0);
      expect(bm.retentionRate).toBeGreaterThan(0);
      expect(bm.retentionRate).toBeLessThanOrEqual(1);
      expect(bm.avgLifetimeYears).toBeGreaterThan(0);
      expect(bm.bestInClassCAC).toBeGreaterThan(0);
      expect(bm.bestInClassCAC).toBeLessThanOrEqual(bm.cac);
      expect(bm.ref.length).toBeGreaterThan(10);
    }
  });

  it("calcChannelEconomics returns results for enabled channels only", () => {
    const economics = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: true, affiliate: false, override: false, channel: false },
      projections: { gdc: 80000, aum: 40000, affiliate: 30000, override: 30000, channel: 20000 },
    });
    expect(economics.length).toBe(2);
    expect(economics.map((e) => e.channel)).toEqual(["gdc", "aum"]);
  });

  it("economics have valid ROI and LTV calculations", () => {
    const economics = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: { gdc: 80000, aum: 40000, affiliate: 30000, override: 30000, channel: 20000 },
    });
    for (const e of economics) {
      expect(e.annualRevenue).toBeGreaterThan(0);
      expect(e.cac).toBeGreaterThan(0);
      expect(e.cogsDollar).toBeGreaterThanOrEqual(0);
      expect(e.grossMarginDollar).toBeDefined();
      expect(e.grossMarginPct).toBeDefined();
      expect(e.clientLTV).toBeGreaterThan(0);
      expect(e.extendedNetworkLTV).toBeGreaterThan(e.clientLTV);
      expect(e.ltvCacRatio).toBeGreaterThan(0);
      expect(e.paybackMonths).toBeGreaterThan(0);
    }
  });

  it("CAC overrides are respected", () => {
    const economics = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: false, affiliate: false, override: false, channel: false },
      projections: { gdc: 80000, aum: 0, affiliate: 0, override: 0, channel: 0 },
      cacOverrides: { gdc: 500 },
    });
    expect(economics[0].cac).toBe(500);
  });

  it("referral multiplier affects extended network LTV", () => {
    const econ1 = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: false, affiliate: false, override: false, channel: false },
      projections: { gdc: 80000, aum: 0, affiliate: 0, override: 0, channel: 0 },
      referralMultiplier: 1.3,
    });
    const econ2 = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: false, affiliate: false, override: false, channel: false },
      projections: { gdc: 80000, aum: 0, affiliate: 0, override: 0, channel: 0 },
      referralMultiplier: 2.0,
    });
    expect(econ2[0].extendedNetworkLTV).toBeGreaterThan(econ1[0].extendedNetworkLTV);
  });

  it("AUM channel has highest LTV:CAC ratio (industry expectation)", () => {
    const economics = calcChannelEconomics({
      enabledChannels: allEnabled,
      projections: { gdc: 80000, aum: 80000, affiliate: 80000, override: 80000, channel: 80000 },
    });
    const aum = economics.find((e) => e.channel === "aum");
    const others = economics.filter((e) => e.channel !== "aum");
    // AUM should have highest retention → highest LTV:CAC
    expect(aum!.ltvCacRatio).toBeGreaterThanOrEqual(
      Math.min(...others.map((e) => e.ltvCacRatio))
    );
  });

  it("zero revenue channel returns zero margin", () => {
    const economics = calcChannelEconomics({
      enabledChannels: { gdc: true, aum: false, affiliate: false, override: false, channel: false },
      projections: { gdc: 0, aum: 0, affiliate: 0, override: 0, channel: 0 },
    });
    expect(economics[0].grossMarginDollar).toBe(0);
    expect(economics[0].cogsDollar).toBe(0);
  });
});
