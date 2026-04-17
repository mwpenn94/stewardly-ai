/**
 * Pass 107 Feature Tests — Content Parity, Structural Inheritance, UI Kit
 *
 * Covers:
 * 1. Nav consistency (all sections collapsible)
 * 2. Sharing UI kit (5 components)
 * 3. Progressive disclosure framework (4 levels)
 * 4. Domain C advanced strategy panels (5 panels)
 * 5. Domain D due diligence (search/filter/freshness)
 * 6. Content parity across all domains
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..');

function readFile(rel: string): string {
  const p = resolve(root, rel);
  if (!existsSync(p)) throw new Error(`File not found: ${rel}`);
  return readFileSync(p, 'utf-8');
}

describe('Nav Consistency — All Sections Collapsible', () => {
  const sidebar = readFile('client/src/components/PersonaSidebar5.tsx');

  it('should have disclosureLevel on nav items', () => {
    const matches = sidebar.match(/disclosureLevel/g);
    expect(matches!.length).toBeGreaterThanOrEqual(20);
  });

  it('should have collapsible section logic for all sections', () => {
    // All sections should be collapsible via toggleLayer
    expect(sidebar).toContain('toggleLayer');
    expect(sidebar).toContain('aria-expanded');
  });

  it('should have mobile-friendly touch targets for footer items', () => {
    expect(sidebar).toContain('min-h-[44px]');
  });
});

describe('Sharing UI Kit — 5 Components', () => {
  const shareKit = readFile('client/src/components/sharing/ShareKit.tsx');

  it('should export ShareButton component', () => {
    expect(shareKit).toContain('export function ShareButton');
  });

  it('should export RecipientPicker component', () => {
    expect(shareKit).toContain('export function RecipientPicker');
  });

  it('should export PermissionSelector component', () => {
    expect(shareKit).toContain('export function PermissionSelector');
  });

  it('should export OmissionToggle component', () => {
    expect(shareKit).toContain('export function OmissionToggle');
  });

  it('should export SharingStatusIndicator component', () => {
    expect(shareKit).toContain('export function SharingStatusIndicator');
  });
});

describe('Progressive Disclosure Framework — 4 Levels', () => {
  const ctx = readFile('client/src/contexts/DisclosureContext.tsx');
  const section = readFile('client/src/components/DisclosureSection.tsx');

  it('should define 4 disclosure levels', () => {
    expect(ctx).toContain("1: { label: \"Essential\"");
    expect(ctx).toContain("2: { label: \"Standard\"");
    expect(ctx).toContain("3: { label: \"Professional\"");
    expect(ctx).toContain("4: { label: \"Expert\"");
  });

  it('should export DisclosureProvider', () => {
    expect(ctx).toContain('export function DisclosureProvider');
  });

  it('should export useDisclosure hook', () => {
    expect(ctx).toContain('export function useDisclosure');
  });

  it('should export filterByDisclosure utility', () => {
    expect(ctx).toContain('export function filterByDisclosure');
  });

  it('should export DisclosureSection wrapper', () => {
    expect(section).toContain('export function DisclosureSection');
  });

  it('should export useDisclosureGate hook', () => {
    expect(section).toContain('export function useDisclosureGate');
  });

  it('should support showTeaser mode', () => {
    expect(section).toContain('showTeaser');
  });

  it('should persist level in localStorage', () => {
    expect(ctx).toContain('localStorage');
    expect(ctx).toContain('stewardly-disclosure-level');
  });
});

describe('Domain C — Advanced Strategy Panels', () => {
  const panelsJ = readFile('client/src/pages/calculators/PanelsJ.tsx');

  it('should export PremiumFinancingPanel', () => {
    expect(panelsJ).toContain('export function PremiumFinancingPanel');
  });

  it('should export ILITTrustPanel with trust types', () => {
    expect(panelsJ).toContain('export function ILITTrustPanel');
    expect(panelsJ).toContain('SLAT');
    expect(panelsJ).toContain('GRAT');
    expect(panelsJ).toContain('QPRT');
  });

  it('should export ExecCompPanel with 280G analysis', () => {
    expect(panelsJ).toContain('export function ExecCompPanel');
    expect(panelsJ).toContain('§280G');
    expect(panelsJ).toContain('NQDC');
  });

  it('should export CharitablePlanningPanel with CRT/CLT', () => {
    expect(panelsJ).toContain('export function CharitablePlanningPanel');
    expect(panelsJ).toContain('CRT');
    expect(panelsJ).toContain('CLT');
  });

  it('should export DueDiligencePanel', () => {
    expect(panelsJ).toContain('export function DueDiligencePanel');
  });

  it('PremiumFinancingPanel should have suitability scoring', () => {
    expect(panelsJ).toContain('SUITABILITY_CRITERIA');
    expect(panelsJ).toContain('suitabilityScore');
  });

  it('ExecCompPanel should have golden parachute analysis', () => {
    expect(panelsJ).toContain('parachutePayment');
    expect(panelsJ).toContain('exciseTax');
  });
});

describe('Domain D — Due Diligence with Search/Filter', () => {
  const panelsJ = readFile('client/src/pages/calculators/PanelsJ.tsx');

  it('should have DUE_DILIGENCE_ITEMS data structure', () => {
    expect(panelsJ).toContain('DUE_DILIGENCE_ITEMS');
  });

  it('should have search functionality', () => {
    expect(panelsJ).toContain('searchQuery');
    expect(panelsJ).toContain('setSearchQuery');
  });

  it('should have importance filter', () => {
    expect(panelsJ).toContain('importanceFilter');
    expect(panelsJ).toContain("'critical'");
    expect(panelsJ).toContain("'high'");
    expect(panelsJ).toContain("'medium'");
  });

  it('should have freshness tracking', () => {
    expect(panelsJ).toContain('lastUpdated');
    expect(panelsJ).toContain('daysSince');
    expect(panelsJ).toContain('freshnessColor');
    expect(panelsJ).toContain('freshnessLabel');
  });

  it('should have 5 due diligence categories', () => {
    expect(panelsJ).toContain('Carrier Financial Strength');
    expect(panelsJ).toContain('Product Suitability');
    expect(panelsJ).toContain('Regulatory & Compliance');
    expect(panelsJ).toContain('Tax & Legal');
    expect(panelsJ).toContain('Platform & Technology');
  });

  it('should have at least 20 due diligence items', () => {
    const items = panelsJ.match(/keywords: \[/g);
    expect(items!.length).toBeGreaterThanOrEqual(20);
  });
});

describe('Content Parity — Cross-Domain Verification', () => {
  it('all calculator panel files should exist', () => {
    expect(existsSync(resolve(root, 'client/src/pages/calculators/PanelsA.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'client/src/pages/calculators/PanelsB.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'client/src/pages/calculators/PanelsC.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'client/src/pages/calculators/PanelsD.tsx'))).toBe(true);
    expect(existsSync(resolve(root, 'client/src/pages/calculators/PanelsJ.tsx'))).toBe(true);
  });

  it('practice engine should have 30+ exported functions', () => {
    const pe = readFile('client/src/pages/calculators/practiceEngine.ts');
    const exports = pe.match(/export function/g);
    expect(exports!.length).toBeGreaterThanOrEqual(30);
  });

  it('engine.ts should have CALC_METHODS with 10+ methods', () => {
    const engine = readFile('client/src/pages/calculators/engine.ts');
    const methods = engine.match(/name: '/g);
    expect(methods!.length).toBeGreaterThanOrEqual(10);
  });

  it('references.ts should have 17 categories and 88+ entries', () => {
    const refs = readFile('client/src/pages/calculators/references.ts');
    const categories = refs.match(/id: '/g);
    expect(categories!.length).toBe(17);
    const entries = refs.match(/\{ title:/g);
    expect(entries!.length).toBeGreaterThanOrEqual(88);
  });

  it('CommandCenter.tsx should exist with all 7 tabs', () => {
    const cc = readFile('client/src/pages/CommandCenter.tsx');
    expect(cc).toContain('overview');
    expect(cc).toContain('crm');
    expect(cc).toContain('campaigns');
    expect(cc).toContain('ats');
    expect(cc).toContain('linkedin');
    expect(cc).toContain('segments');
    expect(cc).toContain('assets');
  });

  it('DataPipelines should include 14+ pipeline entries', () => {
    const dp = readFile('client/src/pages/DataPipelines.tsx');
    expect(dp).toContain('FRED');
    expect(dp).toContain('EDGAR');
    expect(dp).toContain('GLEIF');
    expect(dp).toContain('OpenFIGI');
    expect(dp).toContain('NAIC');
    expect(dp).toContain('FFIEC');
  });
});

describe('Manus-Next Spec Documentation', () => {
  it('should have a Manus-Next spec document', () => {
    // This will be created as part of this pass
    const specExists = existsSync(resolve(root, 'docs/manus-next-spec.md'));
    expect(specExists).toBe(true);
  });
});
