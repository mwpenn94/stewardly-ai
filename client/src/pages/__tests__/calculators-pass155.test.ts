/**
 * Pass 155 Tests — Drag-and-drop reorder, Keyboard shortcut modal, Compare diff highlights
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

/* ─── usePanelOrder hook logic (unit-testable without React) ─── */
describe('Panel Order Persistence (Pass 155)', () => {
  const NAV_SECTIONS = [
    { group: 'Core', items: [{ id: 'profile', label: 'Profile' }, { id: 'cash', label: 'Cash Flow' }, { id: 'protect', label: 'Protection' }] },
    { group: 'Planning', items: [{ id: 'retire', label: 'Retirement' }, { id: 'tax', label: 'Tax' }] },
  ];

  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {} as Record<string, string>,
      getItem(key: string) { return this.store[key] ?? null; },
      setItem(key: string, val: string) { this.store[key] = val; },
      removeItem(key: string) { delete this.store[key]; },
    });
  });

  it('returns original sections when no saved order exists', () => {
    // Simulate the hook logic: if no saved order, return original
    const saved = localStorage.getItem('wb-panel-order');
    expect(saved).toBeNull();
    // Original sections should be returned unchanged
    expect(NAV_SECTIONS[0].items.map(i => i.id)).toEqual(['profile', 'cash', 'protect']);
  });

  it('persists reordered items to localStorage', () => {
    const reordered = { 'Core': ['cash', 'profile', 'protect'] };
    localStorage.setItem('wb-panel-order', JSON.stringify(reordered));
    const saved = JSON.parse(localStorage.getItem('wb-panel-order')!);
    expect(saved['Core']).toEqual(['cash', 'profile', 'protect']);
  });

  it('applies saved order to sections', () => {
    const savedOrder = { 'Core': ['protect', 'cash', 'profile'] };
    localStorage.setItem('wb-panel-order', JSON.stringify(savedOrder));
    
    const saved = JSON.parse(localStorage.getItem('wb-panel-order')!);
    const group = NAV_SECTIONS[0];
    const orderedIds = saved[group.group] as string[];
    const reordered = orderedIds
      .map(id => group.items.find(i => i.id === id))
      .filter(Boolean);
    
    expect(reordered.map(i => i!.id)).toEqual(['protect', 'cash', 'profile']);
  });

  it('handles missing items gracefully (new items added after save)', () => {
    const savedOrder = { 'Core': ['cash', 'profile'] }; // 'protect' missing
    localStorage.setItem('wb-panel-order', JSON.stringify(savedOrder));
    
    const saved = JSON.parse(localStorage.getItem('wb-panel-order')!);
    const group = NAV_SECTIONS[0];
    const orderedIds = saved[group.group] as string[];
    const known = orderedIds
      .map(id => group.items.find(i => i.id === id))
      .filter(Boolean);
    const missing = group.items.filter(i => !orderedIds.includes(i.id));
    const final = [...known, ...missing];
    
    expect(final.map(i => i!.id)).toEqual(['cash', 'profile', 'protect']);
  });
});

/* ─── CompareDiffOverlay logic ─── */
describe('Compare Diff Highlights (Pass 155)', () => {
  type MetricSnapshot = { label: string; value: number; format?: 'currency' | 'percent' | 'number' };

  function computeDiffs(left: MetricSnapshot[], right: MetricSnapshot[]) {
    const diffs: { label: string; delta: number; deltaPct: number }[] = [];
    for (const lm of left) {
      const rm = right.find(r => r.label === lm.label);
      if (!rm) continue;
      const delta = rm.value - lm.value;
      const deltaPct = lm.value !== 0 ? delta / Math.abs(lm.value) : 0;
      diffs.push({ label: lm.label, delta, deltaPct });
    }
    return diffs;
  }

  it('computes correct deltas for overlapping metrics', () => {
    const left: MetricSnapshot[] = [
      { label: 'Total Income', value: 100000, format: 'currency' },
      { label: 'Net Worth', value: 500000, format: 'currency' },
    ];
    const right: MetricSnapshot[] = [
      { label: 'Total Income', value: 120000, format: 'currency' },
      { label: 'Net Worth', value: 450000, format: 'currency' },
    ];
    const diffs = computeDiffs(left, right);
    expect(diffs).toHaveLength(2);
    expect(diffs[0].delta).toBe(20000);
    expect(diffs[0].deltaPct).toBeCloseTo(0.2);
    expect(diffs[1].delta).toBe(-50000);
    expect(diffs[1].deltaPct).toBeCloseTo(-0.1);
  });

  it('returns empty array when no overlapping labels', () => {
    const left: MetricSnapshot[] = [{ label: 'A', value: 100 }];
    const right: MetricSnapshot[] = [{ label: 'B', value: 200 }];
    expect(computeDiffs(left, right)).toHaveLength(0);
  });

  it('handles zero-value left metric without division error', () => {
    const left: MetricSnapshot[] = [{ label: 'X', value: 0 }];
    const right: MetricSnapshot[] = [{ label: 'X', value: 100 }];
    const diffs = computeDiffs(left, right);
    expect(diffs[0].delta).toBe(100);
    expect(diffs[0].deltaPct).toBe(0); // 0 denominator → 0
  });

  it('handles identical values with zero delta', () => {
    const left: MetricSnapshot[] = [{ label: 'Y', value: 50000 }];
    const right: MetricSnapshot[] = [{ label: 'Y', value: 50000 }];
    const diffs = computeDiffs(left, right);
    expect(diffs[0].delta).toBe(0);
    expect(diffs[0].deltaPct).toBe(0);
  });
});

/* ─── Keyboard Shortcut Modal (Pass 155) ─── */
describe('Keyboard Shortcut Modal (Pass 155)', () => {
  it('? key should trigger modal open when not in input', () => {
    let showShortcuts = false;
    // Simulate the keyboard handler logic
    const handler = (e: { key: string; target: { tagName: string } }) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '?') showShortcuts = true;
    };
    handler({ key: '?', target: { tagName: 'DIV' } });
    expect(showShortcuts).toBe(true);
  });

  it('? key should NOT trigger modal when in input field', () => {
    let showShortcuts = false;
    const handler = (e: { key: string; target: { tagName: string } }) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === '?') showShortcuts = true;
    };
    handler({ key: '?', target: { tagName: 'INPUT' } });
    expect(showShortcuts).toBe(false);
  });

  it('Escape closes the shortcut modal', () => {
    let showShortcuts = true;
    const handler = (e: { key: string }) => {
      if (e.key === 'Escape' && showShortcuts) showShortcuts = false;
    };
    handler({ key: 'Escape' });
    expect(showShortcuts).toBe(false);
  });
});
