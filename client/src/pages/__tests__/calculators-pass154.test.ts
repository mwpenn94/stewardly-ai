/* ═══════════════════════════════════════════════════════════════
   Pass 154 — Unit tests for keyboard shortcuts + compare mode
   ═══════════════════════════════════════════════════════════════ */
import { describe, it, expect } from 'vitest';

/**
 * These tests validate the logic behind the Pass 154 features:
 * 1. Keyboard shortcut mapping (Cmd+K, number keys, Escape)
 * 2. Compare panel search/filter logic
 * 3. Split-view state transitions
 */

/* ─── Keyboard shortcut handler logic (extracted for testability) ─── */
function handleKeyboardShortcut(
  e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; target?: { tagName?: string } },
  state: { globalSearch: string; favorites: string[]; showComparePicker: boolean },
  actions: { focusSearch: () => void; clearSearch: () => void; closePicker: () => void; navigateToPanel: (id: string) => void }
): boolean {
  // Cmd/Ctrl+K → focus search
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    actions.focusSearch();
    return true;
  }
  // Escape → clear search and close compare picker
  if (e.key === 'Escape') {
    if (state.globalSearch) { actions.clearSearch(); return true; }
    if (state.showComparePicker) { actions.closePicker(); return true; }
    return false;
  }
  // Number keys 1-9 → navigate to favorites (only when not in an input)
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return false;
  if (e.key >= '1' && e.key <= '9' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const idx = parseInt(e.key) - 1;
    if (state.favorites[idx]) {
      actions.navigateToPanel(state.favorites[idx]);
      return true;
    }
  }
  return false;
}

describe('Keyboard Shortcuts (Pass 154)', () => {
  it('Cmd+K focuses search', () => {
    let focused = false;
    const result = handleKeyboardShortcut(
      { key: 'k', metaKey: true, ctrlKey: false, altKey: false },
      { globalSearch: '', favorites: [], showComparePicker: false },
      { focusSearch: () => { focused = true; }, clearSearch: () => {}, closePicker: () => {}, navigateToPanel: () => {} }
    );
    expect(result).toBe(true);
    expect(focused).toBe(true);
  });

  it('Ctrl+K focuses search (Windows/Linux)', () => {
    let focused = false;
    const result = handleKeyboardShortcut(
      { key: 'k', metaKey: false, ctrlKey: true, altKey: false },
      { globalSearch: '', favorites: [], showComparePicker: false },
      { focusSearch: () => { focused = true; }, clearSearch: () => {}, closePicker: () => {}, navigateToPanel: () => {} }
    );
    expect(result).toBe(true);
    expect(focused).toBe(true);
  });

  it('Escape clears search when active', () => {
    let cleared = false;
    const result = handleKeyboardShortcut(
      { key: 'Escape', metaKey: false, ctrlKey: false, altKey: false },
      { globalSearch: 'retirement', favorites: [], showComparePicker: false },
      { focusSearch: () => {}, clearSearch: () => { cleared = true; }, closePicker: () => {}, navigateToPanel: () => {} }
    );
    expect(result).toBe(true);
    expect(cleared).toBe(true);
  });

  it('Escape closes compare picker when open', () => {
    let closed = false;
    const result = handleKeyboardShortcut(
      { key: 'Escape', metaKey: false, ctrlKey: false, altKey: false },
      { globalSearch: '', favorites: [], showComparePicker: true },
      { focusSearch: () => {}, clearSearch: () => {}, closePicker: () => { closed = true; }, navigateToPanel: () => {} }
    );
    expect(result).toBe(true);
    expect(closed).toBe(true);
  });

  it('Number key navigates to favorite at that index', () => {
    let navigated = '';
    const result = handleKeyboardShortcut(
      { key: '3', metaKey: false, ctrlKey: false, altKey: false, target: { tagName: 'DIV' } },
      { globalSearch: '', favorites: ['profile', 'cash', 'protect', 'grow'], showComparePicker: false },
      { focusSearch: () => {}, clearSearch: () => {}, closePicker: () => {}, navigateToPanel: (id) => { navigated = id; } }
    );
    expect(result).toBe(true);
    expect(navigated).toBe('protect'); // index 2 (key '3' - 1)
  });

  it('Number key does nothing when in an input field', () => {
    let navigated = '';
    const result = handleKeyboardShortcut(
      { key: '1', metaKey: false, ctrlKey: false, altKey: false, target: { tagName: 'INPUT' } },
      { globalSearch: '', favorites: ['profile'], showComparePicker: false },
      { focusSearch: () => {}, clearSearch: () => {}, closePicker: () => {}, navigateToPanel: (id) => { navigated = id; } }
    );
    expect(result).toBe(false);
    expect(navigated).toBe('');
  });

  it('Number key beyond favorites length does nothing', () => {
    let navigated = '';
    const result = handleKeyboardShortcut(
      { key: '5', metaKey: false, ctrlKey: false, altKey: false, target: { tagName: 'DIV' } },
      { globalSearch: '', favorites: ['profile', 'cash'], showComparePicker: false },
      { focusSearch: () => {}, clearSearch: () => {}, closePicker: () => {}, navigateToPanel: (id) => { navigated = id; } }
    );
    expect(result).toBe(false);
    expect(navigated).toBe('');
  });
});

/* ─── Compare panel search/filter logic ─── */
function filterComparePanels(
  allPanels: { id: string; label: string; group: string }[],
  activePanel: string,
  searchQuery: string
): { id: string; label: string; group: string }[] {
  if (!searchQuery.trim()) {
    return allPanels.filter(i => i.id !== activePanel).slice(0, 12);
  }
  const q = searchQuery.toLowerCase();
  return allPanels.filter(i =>
    i.id !== activePanel &&
    (i.label.toLowerCase().includes(q) || i.group.toLowerCase().includes(q))
  ).slice(0, 12);
}

describe('Compare Panel Filter (Pass 154)', () => {
  const panels = [
    { id: 'profile', label: 'Client Profile', group: 'Client Hub' },
    { id: 'cash', label: 'Cash Flow', group: 'Client Hub' },
    { id: 'protect', label: 'Protection', group: 'Client Hub' },
    { id: 'grow', label: 'Growth', group: 'Client Hub' },
    { id: 'retire', label: 'Retirement', group: 'Client Hub' },
    { id: 'tax', label: 'Tax', group: 'Client Hub' },
    { id: 'estate', label: 'Estate', group: 'Client Hub' },
    { id: 'edu', label: 'Education', group: 'Client Hub' },
    { id: 'myplan', label: 'My Plan', group: 'Practice Planning' },
    { id: 'gdcbrackets', label: 'GDC Brackets', group: 'Practice Planning' },
    { id: 'dashboard', label: 'Dashboard', group: 'Practice Planning' },
    { id: 'pnl', label: 'P&L', group: 'Practice Planning' },
    { id: 'montecarlo', label: 'Monte Carlo', group: 'Advanced' },
  ];

  it('excludes the active panel from results', () => {
    const results = filterComparePanels(panels, 'profile', '');
    expect(results.find(r => r.id === 'profile')).toBeUndefined();
  });

  it('returns up to 12 panels when no search query', () => {
    const results = filterComparePanels(panels, 'profile', '');
    expect(results.length).toBeLessThanOrEqual(12);
    expect(results.length).toBe(12); // 13 panels - 1 active = 12
  });

  it('filters by label', () => {
    const results = filterComparePanels(panels, 'profile', 'cash');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('cash');
  });

  it('filters by group name', () => {
    const results = filterComparePanels(panels, 'profile', 'practice');
    expect(results.length).toBe(4);
    expect(results.every(r => r.group === 'Practice Planning')).toBe(true);
  });

  it('is case-insensitive', () => {
    const results = filterComparePanels(panels, 'profile', 'MONTE');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('montecarlo');
  });

  it('returns empty for non-matching query', () => {
    const results = filterComparePanels(panels, 'profile', 'xyz123');
    expect(results.length).toBe(0);
  });
});

/* ─── Split-view state transitions ─── */
describe('Split-View State Transitions (Pass 154)', () => {
  type State = { compareMode: boolean; comparePanel: string | null; showComparePicker: boolean };

  function toggleCompare(state: State): State {
    if (!state.compareMode) {
      // Turning ON
      return { compareMode: true, comparePanel: null, showComparePicker: true };
    } else {
      // Turning OFF
      return { compareMode: false, comparePanel: null, showComparePicker: false };
    }
  }

  function selectComparePanel(state: State, panelId: string): State {
    return { ...state, comparePanel: panelId, showComparePicker: false };
  }

  function changeComparePanel(state: State): State {
    return { ...state, showComparePicker: true };
  }

  it('toggling ON opens picker with no panel selected', () => {
    const result = toggleCompare({ compareMode: false, comparePanel: null, showComparePicker: false });
    expect(result.compareMode).toBe(true);
    expect(result.showComparePicker).toBe(true);
    expect(result.comparePanel).toBeNull();
  });

  it('toggling OFF clears everything', () => {
    const result = toggleCompare({ compareMode: true, comparePanel: 'cash', showComparePicker: false });
    expect(result.compareMode).toBe(false);
    expect(result.showComparePicker).toBe(false);
    expect(result.comparePanel).toBeNull();
  });

  it('selecting a panel closes picker and sets panel', () => {
    const result = selectComparePanel(
      { compareMode: true, comparePanel: null, showComparePicker: true },
      'protect'
    );
    expect(result.comparePanel).toBe('protect');
    expect(result.showComparePicker).toBe(false);
  });

  it('changing panel re-opens picker', () => {
    const result = changeComparePanel({ compareMode: true, comparePanel: 'cash', showComparePicker: false });
    expect(result.showComparePicker).toBe(true);
    expect(result.comparePanel).toBe('cash'); // keeps current until new selection
  });
});
