/* ═══════════════════════════════════════════════════════════════
   Pass 142 — Cascade Sankey, Plan Sharing, Scenario Comparison,
              Complexity Toggle
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';
import {
  isSectionVisible,
  COMPLEXITY_SECTIONS,
  type ComplexityLevel,
} from '../client/src/pages/calculators/practiceEngine';

/* ─── 1. Complexity Toggle (isSectionVisible) ─── */
describe('Complexity Toggle — isSectionVisible', () => {
  it('simple level shows only core sections', () => {
    const simpleSections = ['target', 'role', 'summary', 'splits-pie'];
    for (const s of simpleSections) {
      expect(isSectionVisible(s, 'simple')).toBe(true);
    }
    // Should NOT show detailed/expert sections
    expect(isSectionVisible('splits-sliders', 'simple')).toBe(false);
    expect(isSectionVisible('channel-details', 'simple')).toBe(false);
    expect(isSectionVisible('economics', 'simple')).toBe(false);
    expect(isSectionVisible('sensitivity', 'simple')).toBe(false);
    expect(isSectionVisible('time-phased', 'simple')).toBe(false);
    expect(isSectionVisible('scenarios', 'simple')).toBe(false);
  });

  it('detailed level shows core + detailed sections', () => {
    const detailedSections = ['target', 'role', 'summary', 'splits-pie', 'splits-sliders', 'channel-details', 'roll-up-table', 'economics'];
    for (const s of detailedSections) {
      expect(isSectionVisible(s, 'detailed')).toBe(true);
    }
    // Should NOT show expert-only sections
    expect(isSectionVisible('sensitivity', 'detailed')).toBe(false);
    expect(isSectionVisible('time-phased', 'detailed')).toBe(false);
    expect(isSectionVisible('scenarios', 'detailed')).toBe(false);
  });

  it('expert level shows all sections', () => {
    const expertSections = ['target', 'role', 'summary', 'splits-pie', 'splits-sliders', 'channel-details', 'roll-up-table', 'economics', 'cross-cascade', 'audit-trail', 'sensitivity', 'time-phased', 'scenarios', 'export'];
    for (const s of expertSections) {
      expect(isSectionVisible(s, 'expert')).toBe(true);
    }
  });

  it('COMPLEXITY_SECTIONS has correct hierarchy (simple ⊂ detailed ⊂ expert)', () => {
    const simple = COMPLEXITY_SECTIONS.simple;
    const detailed = COMPLEXITY_SECTIONS.detailed;
    const expert = COMPLEXITY_SECTIONS.expert;
    // Every simple section should be in detailed
    for (const s of simple) {
      expect(detailed.has(s)).toBe(true);
    }
    // Every detailed section should be in expert
    for (const s of detailed) {
      expect(expert.has(s)).toBe(true);
    }
    // Expert should have more than detailed
    expect(expert.size).toBeGreaterThan(detailed.size);
    expect(detailed.size).toBeGreaterThan(simple.size);
  });

  it('unknown section returns false for all levels', () => {
    expect(isSectionVisible('nonexistent-section', 'simple')).toBe(false);
    expect(isSectionVisible('nonexistent-section', 'detailed')).toBe(false);
    expect(isSectionVisible('nonexistent-section', 'expert')).toBe(false);
  });
});

/* ─── 2. Plan Sharing Router Structure ─── */
describe('Plan Sharing Router', () => {
  it('planSharing router file exists and exports a router', async () => {
    const mod = await import('../server/routers/planSharing');
    expect(mod.planSharingRouter).toBeDefined();
    expect(typeof mod.planSharingRouter).toBe('object');
  });
});

/* ─── 3. Scenarios Router Structure ─── */
describe('Scenarios Router', () => {
  it('scenarios router file exists and exports a router', async () => {
    const mod = await import('../server/routers/scenarios');
    expect(mod.scenariosRouter).toBeDefined();
    expect(typeof mod.scenariosRouter).toBe('object');
  });
});

/* ─── 4. CascadeSankey Component Structure ─── */
describe('CascadeSankey Component', () => {
  it('CascadeSankey module exports a named component', async () => {
    const mod = await import('../client/src/pages/calculators/CascadeSankey');
    expect(mod.CascadeSankey).toBeDefined();
    expect(typeof mod.CascadeSankey).toBe('function');
  });
});

/* ─── 5. ScenarioComparison Component Structure ─── */
describe('ScenarioComparison Component', () => {
  it('ScenarioComparison module has a default export', async () => {
    const mod = await import('../client/src/pages/calculators/ScenarioComparison');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

/* ─── 6. SharedPlanView Component Structure ─── */
describe('SharedPlanView Component', () => {
  it('SharedPlanView module has a default export', async () => {
    const mod = await import('../client/src/pages/SharedPlanView');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

/* ─── 7. Complexity Level Types ─── */
describe('ComplexityLevel type coverage', () => {
  it('all three levels are valid keys in COMPLEXITY_SECTIONS', () => {
    const levels: ComplexityLevel[] = ['simple', 'detailed', 'expert'];
    for (const lvl of levels) {
      expect(COMPLEXITY_SECTIONS[lvl]).toBeInstanceOf(Set);
      expect(COMPLEXITY_SECTIONS[lvl].size).toBeGreaterThan(0);
    }
  });
});
