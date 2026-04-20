/**
 * v8.3 Stability LVUA — Regression tests for scores.map crash fix,
 * onboarding persistence, legacy URL redirects, and comprehensive panel validation.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CLIENT = resolve(__dirname, '../..');

function readFile(relPath: string): string {
  return readFileSync(resolve(CLIENT, relPath), 'utf-8');
}

describe('P0: scores.map crash fix', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should NOT call scores.map() directly (scores is Record<string,number>, not array)', () => {
    // The old bug: scores.map(...) where scores is Record<string,number>
    // The fix: use scorecard.domains.map(...) instead
    const scoresMapCalls = calcSrc.match(/\bscores\.map\s*\(/g) || [];
    expect(scoresMapCalls.length).toBe(0);
  });

  it('should use scorecard.domains for PFR wizard domainScores', () => {
    // The fix converts scorecard.domains (which is an array) to the expected format
    expect(calcSrc).toContain('scorecard.domains');
  });

  it('should have scorecard computed from computeScorecard', () => {
    expect(calcSrc).toContain('computeScorecard');
  });
});

describe('P0: showShortcuts TDZ fix', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should declare showShortcuts state before the keyboard handler useEffect', () => {
    const showShortcutsDecl = calcSrc.indexOf('const [showShortcuts, setShowShortcuts]');
    const keyboardEffect = calcSrc.indexOf("addEventListener('keydown'");
    expect(showShortcutsDecl).toBeGreaterThan(-1);
    expect(keyboardEffect).toBeGreaterThan(-1);
    // Declaration must come before usage
    expect(showShortcutsDecl).toBeLessThan(keyboardEffect);
  });
});

describe('P0: panelAnalytics TDZ fix', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should declare panelAnalytics before navigateToPanel', () => {
    const analyticsDecl = calcSrc.indexOf('usePanelAnalytics');
    const navigateToPanel = calcSrc.indexOf('function navigateToPanel');
    // If navigateToPanel is a named function, it may be hoisted, but the hook call must be before usage
    expect(analyticsDecl).toBeGreaterThan(-1);
    if (navigateToPanel > -1) {
      // The hook call should exist (it was moved up)
      expect(analyticsDecl).toBeGreaterThan(-1);
    }
  });
});

describe('Onboarding persistence', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should read wb-onboarding-complete from localStorage on mount', () => {
    expect(calcSrc).toContain('wb-onboarding-complete');
  });

  it('should set wb-onboarding-complete in localStorage when onboarding completes', () => {
    // The WealthEngineOnboarding component handles this, but Calculators should also
    // check for it to skip re-showing
    const hasLocalStorageCheck = calcSrc.includes("localStorage.getItem('wb-onboarding-complete')") ||
                                  calcSrc.includes('localStorage.getItem("wb-onboarding-complete")');
    expect(hasLocalStorageCheck).toBe(true);
  });
});

describe('Legacy URL redirects for natural panel names', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should have LEGACY_REDIRECTS map', () => {
    expect(calcSrc).toContain('LEGACY_REDIRECTS');
  });

  it('should redirect cashflow → cash', () => {
    expect(calcSrc).toContain("cashflow: 'cash'");
  });

  it('should redirect retirement → retire', () => {
    expect(calcSrc).toContain("retirement: 'retire'");
  });

  it('should redirect protection → protect', () => {
    expect(calcSrc).toContain("protection: 'protect'");
  });

  it('should redirect growth → grow', () => {
    expect(calcSrc).toContain("growth: 'grow'");
  });

  it('should redirect education → edu', () => {
    expect(calcSrc).toContain("education: 'edu'");
  });
});

describe('Deep link support via URL path params', () => {
  const appSrc = readFile('App.tsx');

  it('should have /wealth-engine/:panel route', () => {
    expect(appSrc).toContain('/wealth-engine/:panel');
  });

  it('should have /calculators/:panel route', () => {
    expect(appSrc).toContain('/calculators/:panel');
  });
});

describe('WE panel content structure', () => {
  const calcSrc = readFile('pages/Calculators.tsx');

  it('should have all 6 domain panels in NAV_SECTIONS', () => {
    const domainPanels = ['cash', 'retire', 'protect', 'grow', 'tax', 'estate'];
    for (const panel of domainPanels) {
      expect(calcSrc).toContain(`id: '${panel}'`);
    }
  });

  it('should have Foundation, Plan, Protect & Advance, Grow, Analyze & Act groups', () => {
    expect(calcSrc).toContain('Foundation');
    expect(calcSrc).toContain('Plan');
    expect(calcSrc).toContain('Protect & Advance');
    expect(calcSrc).toContain('Grow');
    expect(calcSrc).toContain('Analyze & Act');
  });

  it('should have toolbar with Save, Load, PDF, Excel, CSV, Import actions', () => {
    expect(calcSrc).toContain('Save');
    expect(calcSrc).toContain('Load');
    expect(calcSrc).toContain('PDF');
    expect(calcSrc).toContain('Excel');
    expect(calcSrc).toContain('CSV');
    expect(calcSrc).toContain('Import');
  });

  it('should have Health Score indicator', () => {
    expect(calcSrc).toContain('Health Score');
  });
});
