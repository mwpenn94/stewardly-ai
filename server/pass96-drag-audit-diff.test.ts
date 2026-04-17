/**
 * Pass 96 — Drag-to-Rebalance, Cross-Cascade Audit Trail, Scenario Diff
 * Tests for dragRebalanceSplit, createAuditEntry, calcScenarioDiff
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  dragRebalanceSplit,
  createAuditEntry,
  resetAuditCounter,
  calcScenarioDiff,
  type IncomeSplits,
  type EnabledChannels,
  type CascadeInputSnapshot,
  type CascadeDirection,
} from '../client/src/pages/calculators/practiceEngine';

/* ═══ SHARED FIXTURES ═══ */
const baseSplits: IncomeSplits = { gdc: 40, aum: 20, affiliate: 15, override: 15, channel: 10 };
const allEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: true, override: true, channel: true };
const baseSnapshot: CascadeInputSnapshot = {
  targetIncome: 200000,
  incomeSplits: { ...baseSplits },
  enabledChannels: { ...allEnabled },
  targetGDC: 80000,
  aumExisting: 500000,
  aumNew: 50000,
  affCounts: { a: 5, b: 3, c: 2, d: 1 },
  teamAvgGDC: 60000,
  channelSpend: { social: 500, email: 300, events: 200 },
};

/* ═══════════════════════════════════════════════════════════════
   SECTION A: dragRebalanceSplit
   ═══════════════════════════════════════════════════════════════ */
describe('dragRebalanceSplit', () => {
  it('should redistribute proportionally when dragging a channel up', () => {
    // Drag GDC from 40% to 60%
    const result = dragRebalanceSplit('gdc', 60, baseSplits, allEnabled);
    expect(result.gdc).toBe(60);
    // Other channels should decrease proportionally, total should be 100
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
    // Other channels should all be less than before
    expect(result.aum).toBeLessThan(baseSplits.aum);
    expect(result.affiliate).toBeLessThan(baseSplits.affiliate);
    expect(result.override).toBeLessThan(baseSplits.override);
    expect(result.channel).toBeLessThan(baseSplits.channel);
  });

  it('should redistribute proportionally when dragging a channel down', () => {
    // Drag GDC from 40% to 20%
    const result = dragRebalanceSplit('gdc', 20, baseSplits, allEnabled);
    expect(result.gdc).toBe(20);
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
    // Other channels should increase
    expect(result.aum).toBeGreaterThan(baseSplits.aum);
  });

  it('should clamp to 0 when dragging below zero', () => {
    const result = dragRebalanceSplit('gdc', -10, baseSplits, allEnabled);
    expect(result.gdc).toBe(0);
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
  });

  it('should clamp to 100 when dragging above 100', () => {
    const result = dragRebalanceSplit('gdc', 120, baseSplits, allEnabled);
    expect(result.gdc).toBe(100);
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
  });

  it('should handle disabled channels correctly', () => {
    const partialEnabled: EnabledChannels = { gdc: true, aum: true, affiliate: false, override: false, channel: true };
    const partialSplits: IncomeSplits = { gdc: 50, aum: 30, affiliate: 0, override: 0, channel: 20 };
    const result = dragRebalanceSplit('gdc', 70, partialSplits, partialEnabled);
    expect(result.gdc).toBe(70);
    expect(result.affiliate).toBe(0); // disabled stays at 0
    expect(result.override).toBe(0); // disabled stays at 0
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
  });

  it('should not change splits when dragging to same value', () => {
    const result = dragRebalanceSplit('gdc', 40, baseSplits, allEnabled);
    expect(result.gdc).toBe(40);
    expect(result.aum).toBe(20);
    expect(result.affiliate).toBe(15);
    expect(result.override).toBe(15);
    expect(result.channel).toBe(10);
  });

  it('should handle dragging a non-GDC channel', () => {
    const result = dragRebalanceSplit('aum', 50, baseSplits, allEnabled);
    expect(result.aum).toBe(50);
    const total = result.gdc + result.aum + result.affiliate + result.override + result.channel;
    expect(total).toBe(100);
    // GDC should decrease since AUM increased
    expect(result.gdc).toBeLessThan(baseSplits.gdc);
  });

  it('should maintain proportional ratios among other channels', () => {
    // When dragging GDC up by 20 (40→60), the remaining 40 should be split proportionally
    // Original remaining: aum=20, affiliate=15, override=15, channel=10 (total=60)
    // New remaining: 40, so each should be scaled by 40/60 = 0.667
    const result = dragRebalanceSplit('gdc', 60, baseSplits, allEnabled);
    const remainingOld = baseSplits.aum + baseSplits.affiliate + baseSplits.override + baseSplits.channel;
    const remainingNew = result.aum + result.affiliate + result.override + result.channel;
    expect(remainingNew).toBe(40);
    // Ratios should be approximately preserved
    const aumRatioOld = baseSplits.aum / remainingOld;
    const aumRatioNew = result.aum / remainingNew;
    expect(Math.abs(aumRatioOld - aumRatioNew)).toBeLessThan(0.05);
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION B: createAuditEntry
   ═══════════════════════════════════════════════════════════════ */
describe('createAuditEntry', () => {
  beforeEach(() => {
    resetAuditCounter();
  });

  it('should create an audit entry with incrementing IDs', () => {
    const entry1 = createAuditEntry('roll-down', 'Changed target income', 'all', [], baseSplits, baseSnapshot);
    const entry2 = createAuditEntry('roll-up', 'Edited GDC projected', 'gdc', [], baseSplits, baseSnapshot);
    expect(entry1.id).toBe(1);
    expect(entry2.id).toBe(2);
  });

  it('should store direction and trigger correctly', () => {
    const entry = createAuditEntry('split-drag', 'Dragged GDC split from 40% to 60%', 'gdc',
      [{ field: 'split', from: 40, to: 60, channel: 'gdc' }],
      baseSplits, baseSnapshot);
    expect(entry.direction).toBe('split-drag');
    expect(entry.trigger).toBe('Dragged GDC split from 40% to 60%');
    expect(entry.channel).toBe('gdc');
    expect(entry.changes).toHaveLength(1);
    expect(entry.changes[0].from).toBe(40);
    expect(entry.changes[0].to).toBe(60);
  });

  it('should store previous splits and inputs for undo', () => {
    const entry = createAuditEntry('auto-balance', 'Auto-balanced all splits', 'all', [], baseSplits, baseSnapshot);
    expect(entry.prevSplits).toEqual(baseSplits);
    expect(entry.prevInputs.targetIncome).toBe(200000);
    expect(entry.prevInputs.targetGDC).toBe(80000);
  });

  it('should have a valid timestamp', () => {
    const before = Date.now();
    const entry = createAuditEntry('sync', 'Synced target to projected', 'all', [], baseSplits, baseSnapshot);
    const after = Date.now();
    expect(entry.timestamp).toBeGreaterThanOrEqual(before);
    expect(entry.timestamp).toBeLessThanOrEqual(after);
  });

  it('should support all cascade directions', () => {
    const directions: CascadeDirection[] = ['roll-down', 'roll-up', 'auto-balance', 'sync', 'toggle', 'split-drag'];
    directions.forEach((dir, i) => {
      const entry = createAuditEntry(dir, `Action ${i}`, 'all', [], baseSplits, baseSnapshot);
      expect(entry.direction).toBe(dir);
    });
  });

  it('should reset counter correctly', () => {
    createAuditEntry('roll-down', 'test', 'all', [], baseSplits, baseSnapshot);
    createAuditEntry('roll-down', 'test', 'all', [], baseSplits, baseSnapshot);
    resetAuditCounter();
    const entry = createAuditEntry('roll-down', 'test', 'all', [], baseSplits, baseSnapshot);
    expect(entry.id).toBe(1);
  });

  it('should store multiple changes', () => {
    const changes = [
      { field: 'gdc_split', from: 40, to: 60, channel: 'gdc' as const },
      { field: 'aum_split', from: 20, to: 13, channel: 'aum' as const },
      { field: 'affiliate_split', from: 15, to: 10, channel: 'affiliate' as const },
    ];
    const entry = createAuditEntry('split-drag', 'Dragged GDC', 'gdc', changes, baseSplits, baseSnapshot);
    expect(entry.changes).toHaveLength(3);
    expect(entry.changes[0].channel).toBe('gdc');
    expect(entry.changes[1].channel).toBe('aum');
  });
});

/* ═══════════════════════════════════════════════════════════════
   SECTION C: calcScenarioDiff
   ═══════════════════════════════════════════════════════════════ */
describe('calcScenarioDiff', () => {
  const scenarioA = {
    name: 'Conservative',
    targetIncome: 150000,
    incomeSplits: { gdc: 50, aum: 20, affiliate: 10, override: 10, channel: 10 },
    enabledChannels: allEnabled,
    role: 'new' as const,
    targetGDC: 75000,
    aumExisting: 400000,
    aumNew: 30000,
    aumTrailPct: 1,
    overrideRate: 8,
    totalProjected: 145000,
    totalGap: 5000,
    channelProjections: { gdc: 70000, aum: 30000, affiliate: 15000, override: 12000, channel: 18000 },
  };

  const scenarioB = {
    name: 'Aggressive',
    targetIncome: 250000,
    incomeSplits: { gdc: 30, aum: 30, affiliate: 15, override: 15, channel: 10 },
    enabledChannels: allEnabled,
    role: 'fa' as const,
    targetGDC: 75000,
    aumExisting: 800000,
    aumNew: 100000,
    aumTrailPct: 1.2,
    overrideRate: 10,
    totalProjected: 260000,
    totalGap: 0,
    channelProjections: { gdc: 80000, aum: 75000, affiliate: 40000, override: 35000, channel: 30000 },
  };

  const scenarioC = {
    ...scenarioA,
    name: 'Clone',
  };

  it('should return empty result for fewer than 2 scenarios', () => {
    const result = calcScenarioDiff([scenarioA]);
    expect(result.fields).toHaveLength(0);
    expect(result.similarityScore).toBe(100);
  });

  it('should detect divergent fields between two different scenarios', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    expect(result.divergentCount).toBeGreaterThan(0);
    expect(result.fields.length).toBeGreaterThan(0);
    // Target income differs
    const targetField = result.fields.find(f => f.field === 'targetIncome');
    expect(targetField?.divergent).toBe(true);
    expect(targetField?.divergenceType).toBe('input');
  });

  it('should detect cascade-driven divergence', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    // Split fields are cascade-driven
    const gdcSplit = result.fields.find(f => f.field === 'gdc_split');
    expect(gdcSplit?.divergent).toBe(true);
    expect(gdcSplit?.divergenceType).toBe('cascade');
    // Projected fields are cascade-driven
    const gdcProj = result.fields.find(f => f.field === 'gdc_projected');
    expect(gdcProj?.divergent).toBe(true);
    expect(gdcProj?.divergenceType).toBe('cascade');
  });

  it('should report cascadeDrivenCount correctly', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    expect(result.cascadeDrivenCount).toBeGreaterThan(0);
    // All split and projected fields that diverge should be cascade-driven
    const cascadeFields = result.fields.filter(f => f.divergenceType === 'cascade');
    expect(cascadeFields.length).toBe(result.cascadeDrivenCount);
  });

  it('should show 100% similarity for identical scenarios', () => {
    const result = calcScenarioDiff([scenarioA, scenarioC]);
    expect(result.divergentCount).toBe(0);
    expect(result.similarityScore).toBe(100);
  });

  it('should calculate divergence magnitude correctly', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    const targetField = result.fields.find(f => f.field === 'targetIncome');
    // 150000 vs 250000 → range=100000, max=250000, magnitude=40%
    expect(targetField?.divergenceMagnitude).toBe(40);
  });

  it('should handle three scenarios', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB, scenarioC]);
    expect(result.fields.length).toBeGreaterThan(0);
    // Each field should have 3 values
    result.fields.forEach(f => {
      expect(f.values).toHaveLength(3);
    });
  });

  it('should tag channel fields with correct channel identifier', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    const gdcSplit = result.fields.find(f => f.field === 'gdc_split');
    expect(gdcSplit?.channel).toBe('gdc');
    const aumProj = result.fields.find(f => f.field === 'aum_projected');
    expect(aumProj?.channel).toBe('aum');
    // Non-channel fields should not have channel
    const targetField = result.fields.find(f => f.field === 'targetIncome');
    expect(targetField?.channel).toBeUndefined();
  });

  it('should detect when only cascade fields diverge (same inputs, different cascade paths)', () => {
    // Same target income and inputs, but different splits
    const scenarioX = {
      ...scenarioA,
      name: 'X',
      incomeSplits: { gdc: 60, aum: 10, affiliate: 10, override: 10, channel: 10 },
      channelProjections: { gdc: 90000, aum: 15000, affiliate: 15000, override: 12000, channel: 18000 },
    };
    const scenarioY = {
      ...scenarioA,
      name: 'Y',
      incomeSplits: { gdc: 20, aum: 40, affiliate: 15, override: 15, channel: 10 },
      channelProjections: { gdc: 30000, aum: 60000, affiliate: 15000, override: 12000, channel: 18000 },
    };
    const result = calcScenarioDiff([scenarioX, scenarioY]);
    // Input fields (targetIncome, role, etc.) should be identical
    const inputDivergent = result.fields.filter(f => f.divergenceType === 'input' && f.divergent);
    // Cascade fields should diverge
    const cascadeDivergent = result.fields.filter(f => f.divergenceType === 'cascade' && f.divergent);
    expect(cascadeDivergent.length).toBeGreaterThan(0);
  });

  it('should calculate similarity score proportionally', () => {
    const result = calcScenarioDiff([scenarioA, scenarioB]);
    // Similarity = (total - divergent) / total * 100
    const expected = Math.round((1 - result.divergentCount / result.fields.length) * 100);
    expect(result.similarityScore).toBe(expected);
  });
});
