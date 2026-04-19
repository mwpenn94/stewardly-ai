import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const clientDir = path.resolve(__dirname, '../client/src/pages/calculators');

describe('Pass 88 — Wealth Engine Domain A-D Panels', () => {
  describe('Domain A: Practice Management Surfaces (PanelsH)', () => {
    const content = fs.readFileSync(path.join(clientDir, 'PanelsH.tsx'), 'utf-8');

    it('exports ProductionOptPanel', () => {
      expect(content).toContain('export function ProductionOptPanel');
    });
    it('exports ChannelDiversPanel', () => {
      expect(content).toContain('export function ChannelDiversPanel');
    });
    it('exports MarketingROIPanel', () => {
      expect(content).toContain('export function MarketingROIPanel');
    });
    it('includes efficiency metrics (efficiency score, revenue mix)', () => {
      expect(content).toContain('Efficiency Score');
      expect(content).toContain('Revenue Mix');
    });
    it('includes channel diversification with Herfindahl index', () => {
      expect(content).toContain('Herfindahl');
    });
    it('includes marketing ROI calculations (CAC, LTV, ROI)', () => {
      expect(content).toContain('CAC');
      expect(content).toContain('LTV');
      expect(content).toContain('ROI');
    });
  });

  describe('Domain B: Client Planning P0 Surfaces (PanelsI)', () => {
    const content = fs.readFileSync(path.join(clientDir, 'PanelsI.tsx'), 'utf-8');

    it('exports BalanceSheetPanel', () => {
      expect(content).toContain('export function BalanceSheetPanel');
    });
    it('exports DebtManagementPanel', () => {
      expect(content).toContain('export function DebtManagementPanel');
    });
    it('exports TrustEngineeringPanel', () => {
      expect(content).toContain('export function TrustEngineeringPanel');
    });
    it('exports GovernanceIPSPanel', () => {
      expect(content).toContain('export function GovernanceIPSPanel');
    });
    it('exports MonteCarloPanel', () => {
      expect(content).toContain('export function MonteCarloPanel');
    });
    it('exports StockCompPanel', () => {
      expect(content).toContain('export function StockCompPanel');
    });
    it('Balance Sheet includes net worth calculation', () => {
      expect(content).toContain('Net Worth');
      expect(content).toContain('Debt-to-Asset');
    });
    it('Debt Management includes avalanche and snowball strategies', () => {
      expect(content).toContain('avalanche');
      expect(content).toContain('snowball');
    });
    it('Trust Engineering includes 7 trust types (SLAT, IDGT, GRAT, CRT, QPRT, Dynasty, ILIT)', () => {
      expect(content).toContain("'slat'");
      expect(content).toContain("'idgt'");
      expect(content).toContain("'grat'");
      expect(content).toContain("'crt'");
      expect(content).toContain("'qprt'");
      expect(content).toContain("'dynasty'");
      expect(content).toContain("'ilit'");
    });
    it('Monte Carlo includes success rate and percentile distribution', () => {
      expect(content).toContain('successRate');
      expect(content).toContain('Probability of Success');
      expect(content).toContain('p10');
      expect(content).toContain('p90');
    });
    it('Stock Comp includes RSU, ISO, NSO, ESPP types', () => {
      expect(content).toContain("'rsu'");
      expect(content).toContain("'iso'");
      expect(content).toContain("'nso'");
      expect(content).toContain("'espp'");
    });
    it('IPS panel includes asset allocation with visual bar', () => {
      expect(content).toContain('equityMax');
      expect(content).toContain('fixedIncomeMin');
      expect(content).toContain('Alternatives');
    });
  });

  describe('Domain C: Advanced Strategy Surfaces (PanelsJ)', () => {
    const content = fs.readFileSync(path.join(clientDir, 'PanelsJ.tsx'), 'utf-8');

    it('exports PremiumFinancingPanel', () => {
      expect(content).toContain('export function PremiumFinancingPanel');
    });
    it('exports ILITTrustPanel', () => {
      expect(content).toContain('export function ILITTrustPanel');
    });
    it('exports ExecCompPanel', () => {
      expect(content).toContain('export function ExecCompPanel');
    });
    it('exports CharitablePlanningPanel', () => {
      expect(content).toContain('export function CharitablePlanningPanel');
    });
    it('Premium Financing includes crossover point and projection table', () => {
      expect(content).toContain('crossoverYear');
      expect(content).toContain('Loan Balance');
      expect(content).toContain('Cash Value');
      expect(content).toContain('Net Equity');
    });
    it('ILIT includes Crummey capacity and implementation checklist', () => {
      expect(content).toContain('Crummey');
      expect(content).toContain('Implementation Checklist');
    });
    it('Exec Comp includes compensation breakdown visualization', () => {
      expect(content).toContain('Total Compensation');
      expect(content).toContain('Deferral Tax Savings');
    });
    it('Charitable Planning includes 5 strategies (direct, DAF, CRT, CLAT, PF)', () => {
      expect(content).toContain("'direct'");
      expect(content).toContain("'daf'");
      expect(content).toContain("'crt'");
      expect(content).toContain("'clat'");
      expect(content).toContain("'pf'");
    });
  });

  describe('Domain D: Due Diligence (PanelsJ)', () => {
    const content = fs.readFileSync(path.join(clientDir, 'PanelsJ.tsx'), 'utf-8');

    it('exports DueDiligencePanel', () => {
      expect(content).toContain('export function DueDiligencePanel');
    });
    it('includes 5 due diligence categories', () => {
      expect(content).toContain('Carrier Financial Strength');
      expect(content).toContain('Product Suitability');
      expect(content).toContain('Regulatory & Compliance');
      expect(content).toContain('Tax & Legal');
      expect(content).toContain('Platform & Technology');
    });
    it('includes importance levels (critical, high, medium)', () => {
      expect(content).toContain("importance: 'critical'");
      expect(content).toContain("importance: 'high'");
      expect(content).toContain("importance: 'medium'");
    });
    it('includes source references for each item', () => {
      expect(content).toContain('ambest.com');
      expect(content).toContain('brokercheck.finra.org');
      expect(content).toContain('sec.gov/edgar');
      expect(content).toContain('IRC §7702');
    });
    it('has at least 20 due diligence items total', () => {
      const itemCount = (content.match(/title: '/g) || []).length;
      expect(itemCount).toBeGreaterThanOrEqual(20);
    });
  });

  describe('AUM Engine (aumEngine.ts)', () => {
    const content = fs.readFileSync(path.join(clientDir, 'aumEngine.ts'), 'utf-8');

    it('exports DEFAULT_OVERRIDE_RATE from p²+p−1/3=0 formula (26.375%)', () => {
      expect(content).toContain('DEFAULT_OVERRIDE_RATE');
      expect(content).toContain('26.375');
    });
    it('exports AUM pipeline stages', () => {
      expect(content).toContain('prospect');
      expect(content).toContain('discovery');
      expect(content).toContain('proposal');
      expect(content).toContain('onboarded');
    });
    it('exports affiliate pipeline stages', () => {
      expect(content).toContain('identified');
      expect(content).toContain('outreach');
      expect(content).toContain('exploratory');
    });
    it('includes activity metrics calculations', () => {
      expect(content).toContain('calls');
      expect(content).toContain('meetings');
    });
  });

  describe('Calculators.tsx Navigation Integration', () => {
    const content = fs.readFileSync(path.resolve(__dirname, '../client/src/pages/Calculators.tsx'), 'utf-8');

    it('imports PanelsH (Domain A)', () => {
      expect(content).toContain("from './calculators/PanelsH'");
    });
    it('imports PanelsI (Domain B)', () => {
      expect(content).toContain("from './calculators/PanelsI'");
    });
    it('imports PanelsJ (Domain C+D)', () => {
      expect(content).toContain("from './calculators/PanelsJ'");
    });
    it('has all 14 new panel IDs in PanelId type', () => {
      const newIds = ['prodopt', 'chandivers', 'mktgroi', 'balancesheet', 'debtmgmt', 'trusteng', 'governance', 'montecarlo', 'stockcomp', 'premfin', 'ilitrust', 'execcomp', 'charitable', 'duediligence'];
      for (const id of newIds) {
        expect(content).toContain(`'${id}'`);
      }
    });
    it('renders all 14 new panels in the panel switch', () => {
      expect(content).toContain('ProductionOptPanel');
      expect(content).toContain('ChannelDiversPanel');
      expect(content).toContain('MarketingROIPanel');
      expect(content).toContain('BalanceSheetPanel');
      expect(content).toContain('DebtManagementPanel');
      expect(content).toContain('TrustEngineeringPanel');
      expect(content).toContain('GovernanceIPSPanel');
      expect(content).toContain('MonteCarloPanel');
      expect(content).toContain('StockCompPanel');
      expect(content).toContain('PremiumFinancingPanel');
      expect(content).toContain('ILITTrustPanel');
      expect(content).toContain('ExecCompPanel');
      expect(content).toContain('CharitablePlanningPanel');
      expect(content).toContain('DueDiligencePanel');
    });
    it('stock ticker is removed', () => {
      expect(content).not.toContain('MarketTicker');
    });
    it('Client Profile is under Foundation group', () => {
      // Client Profile should appear after "Foundation" group header
      const foundationIdx = content.indexOf("group: '① Foundation'");
      const profileIdx = content.indexOf("'profile'", foundationIdx);
      expect(foundationIdx).toBeGreaterThan(-1);
      expect(profileIdx).toBeGreaterThan(foundationIdx);
    });
  });
});
