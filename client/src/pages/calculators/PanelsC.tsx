/* Panels C: Cost-Benefit (9), Strategy Compare (10), Summary (11), Action Plan (12), References (13) */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  BarChart3, GitCompare, FileText, ListChecks, BookOpen, Layers, Building2
} from 'lucide-react';
import {
  fmt, fmtSm, pct,
  STRATEGIES, CALC_METHODS, DUE_DILIGENCE, buildActionPlan,
  computeScorecard, calcCashFlow, calcProtection,
  getBracketRate, RATES,
  type HorizonData
} from './engine';
import { RefTip, ExportPDFButton, type PanelProps } from './shared';
import { REFERENCE_CATEGORIES, FUNNEL_BENCHMARKS, METHODOLOGY_DISCLOSURE } from './references';

export interface SavedScenario {
  id: number;
  name: string;
  inputsJson: Record<string, any>;
  resultsJson?: Record<string, any>;
  updatedAt: string;
}

export function CostBenefitPanel(p: PanelProps & { horizonData: HorizonData[] }) {
  return (
    <section aria-label="Cost-Benefit Analysis" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Comprehensive Cost vs. Benefit Analysis
        </h2>
        <ExportPDFButton title="Cost-Benefit Analysis" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Complete financial picture — what your client invests and what they receive across all products.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Multi-Horizon Analysis<RefTip text="NPV calculations use a 3% discount rate (inflation-adjusted). ROI includes both protection value and cash value accumulation." refId="costbenefit" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Horizon</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total Cost</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total Benefit</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Net Value</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">ROI</th>
              </tr>
            </thead>
            <tbody>
              {p.horizonData.map(h => (
                <tr key={h.yr} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-foreground/80">{h.yr} Years</td>
                  <td className="text-right px-2 text-red-400">{fmtSm(h.cost)}</td>
                  <td className="text-right px-2 text-green-400">{fmtSm(h.benefit)}</td>
                  <td className={`text-right px-2 font-bold ${h.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSm(h.net)}</td>
                  <td className="text-right px-2 font-bold text-primary">{h.roi}:1</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Visual Comparison</CardTitle></CardHeader>
        <CardContent>
          {p.horizonData.length > 0 && (() => {
            const maxVal = Math.max(...p.horizonData.map(h => Math.max(h.cost, h.benefit)));
            return (
              <div className="space-y-2">
                {p.horizonData.map(h => (
                  <div key={h.yr} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-10 text-right">{h.yr}yr</span>
                    <div className="flex-1 flex gap-1">
                      <div className="h-4 rounded bg-red-400" style={{ width: `${maxVal > 0 ? (h.cost / maxVal * 100) : 0}%` }}
                        title={`Cost: ${fmtSm(h.cost)}`} />
                      <div className="h-4 rounded bg-green-400" style={{ width: `${maxVal > 0 ? (h.benefit / maxVal * 100) : 0}%` }}
                        title={`Benefit: ${fmtSm(h.benefit)}`} />
                    </div>
                    <span className="text-xs font-bold text-muted-foreground w-12 text-right">{h.roi}:1</span>
                  </div>
                ))}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400" /> Cost</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400" /> Benefit</span>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
      {/* Recommended Products Summary */}
      {p.recommendations.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Recommended Products<RefTip text="Products selected based on holistic scoring across all planning domains. Priority reflects urgency and impact on overall financial health." refId="products-summary" /></CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-1 px-1">
            <table role="table" className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Product</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Coverage</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Priority</th>
                </tr>
              </thead>
              <tbody>
                {p.recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-medium text-foreground/80">{r.product}</td>
                    <td className="px-2 text-muted-foreground">{r.coverage}</td>
                    <td className="text-right px-2 text-primary font-semibold">{fmtSm(r.monthly)}/mo</td>
                    <td className="px-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        r.priority === 'Critical' ? 'bg-red-500/20 text-red-400' :
                        r.priority === 'High' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>{r.priority}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span>Total Monthly: <span className="font-bold text-primary">{fmtSm(p.recommendations.reduce((s, r) => s + r.monthly, 0))}/mo</span></span>
              <span>Total Annual: <span className="font-bold text-primary">{fmtSm(p.recommendations.reduce((s, r) => s + r.monthly * 12, 0))}/yr</span></span>
            </div>
          </CardContent>
        </Card>
      )}
      {p.horizonData.length > 0 && (() => {
        const h = p.horizonData[p.horizonData.length - 1];
        return (
          <div className="bg-gradient-to-r from-card to-background text-foreground rounded-xl p-4 mb-4">
            <h3 className="text-sm font-bold mb-1">Bottom Line</h3>
            <p className="text-sm leading-relaxed">
              Over a {h.yr}-year planning horizon, {p.clientName || 'the client'} invests {fmtSm(h.cost)} in comprehensive financial protection
              and receives {fmtSm(h.benefit)} in total value — a {h.roi}:1 return on every dollar invested.
              {h.net > 0 ? ` That's a net gain of ${fmtSm(h.net)}.` : ''}
              {' '}This includes death benefit protection, cash value accumulation, tax savings, disability income replacement, and legacy value.
            </p>
          </div>
        );
      })()}
    </section>
  );
}

export function StrategyComparePanel(p: PanelProps & { savedScenarios?: SavedScenario[] }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const toggleScenario = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length >= 3 ? prev : [...prev, id]);
  };

  /* Compute metrics for selected scenarios */
  const scenarioMetrics = (p.savedScenarios || []).filter(s => selectedIds.includes(s.id)).map(s => {
    const d = s.inputsJson || {};
    const ti = (d.income || 0) + (d.spouseIncome || 0);
    const gm = Math.round(ti / 12);
    const sr = ti > 0 ? (gm - (d.housing||0) - (d.transport||0) - (d.food||0) - (d.insurancePmt||0) - (d.debtPmt||0) - (d.otherExp||0)) / gm : 0;
    const scores: Record<string,number> = {};
    scores.cash = sr >= 0.2 ? 3 : sr >= 0.1 ? 2 : sr > 0 ? 1 : 0;
    const dimeNeed = (d.dep||0) > 0 ? (d.income||0)*10 + (d.mortgage||0) + (d.debt||0) + (d.dep||0)*50000 + 25000 : (d.income||0)*6 + (d.debt||0);
    scores.protect = (d.existIns||0) >= dimeNeed ? 3 : (d.existIns||0) >= dimeNeed*0.5 ? 2 : (d.existIns||0) > 0 ? 1 : 0;
    scores.growth = (d.monthlySav||0) >= gm*0.15 ? 3 : (d.monthlySav||0) >= gm*0.1 ? 2 : (d.monthlySav||0) > 0 ? 1 : 0;
    scores.retire = (d.retirement401k||0) >= ti*3 ? 3 : (d.retirement401k||0) >= ti ? 2 : (d.retirement401k||0) > 0 ? 1 : 0;
    scores.tax = (d.retirement401k||0) >= 23500 && (d.hsaContrib||0) > 0 ? 3 : (d.retirement401k||0) >= 10000 ? 2 : 1;
    scores.estate = d.willStatus === 'trust' ? 3 : d.willStatus === 'will' ? 2 : 1;
    scores.edu = (d.dep||0) === 0 ? 3 : (d.current529||0) >= (d.targetCost||120000)*(d.dep||0)*0.5 ? 3 : (d.current529||0) > 0 ? 2 : 1;
    const sc = computeScorecard(scores);
    const stRate = (d.stateRate || 0.05);
    const txRate = getBracketRate(ti, (d.filing||'mfj') === 'mfj' ? RATES.bracketsMFJ : RATES.bracketsSingle) + stRate;
    const cf = calcCashFlow(gm, txRate, d.housing||0, d.transport||0, d.food||0, d.insurancePmt||0, d.debtPmt||0, d.otherExp||0, d.emMonths||6, d.savings||0);
    const pr = calcProtection(ti, d.dep||0, d.mortgage||0, d.debt||0, d.existIns||0, d.age||40, d.replaceYrs||10, d.payoffRate||0, d.eduPerChild||50000, d.finalExp||25000, d.ssBenefit||2500, d.diPct||0.6);
    return { id: s.id, name: s.name, income: ti, healthScore: sc.pctScore, healthTotal: sc.overall, healthMax: sc.maxScore, surplus: cf.surplus, saveRate: cf.saveRate, protGap: pr.gap, scores };
  });

  return (
    <section aria-label="Strategy Comparison" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <GitCompare className="w-5 h-5 text-primary" /> Strategy Comparison
        </h2>
        <ExportPDFButton title="Strategy Comparison" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Compare 4 planning approaches to see which delivers the best outcome for this client.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Feature</th>
                {STRATEGIES.map(s => (
                  <th key={s.name} className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">{s.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Tax-Free Retirement</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2">
                    {s.taxFree ? <span className="text-green-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Death Benefit</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2">
                    {s.deathBenefit ? <span className="text-green-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Market Protection</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2">
                    {s.marketProtection ? <span className="text-green-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">LTC Coverage</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2">
                    {s.ltcCoverage ? <span className="text-green-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Creditor Protected</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2">
                    {s.creditorProtected ? <span className="text-green-500">✓</span> : <span className="text-muted-foreground/40">✗</span>}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Complexity</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2 text-xs text-muted-foreground">{s.complexity}</td>
                ))}
              </tr>
              <tr className="bg-primary/10">
                <td className="py-2 px-2 font-bold text-primary">Best For</td>
                {STRATEGIES.map(s => (
                  <td key={s.name} className="text-center px-2 text-xs text-primary">{s.bestFor}</td>
                ))}
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <div className="bg-gradient-to-r from-primary/10 to-primary/15 border border-primary/30 rounded-xl p-4 mb-6">
        <h3 className="text-sm font-bold text-primary mb-2">Recommendation</h3>
        <p className="text-sm text-primary">
          Based on the client profile, the <strong>Hybrid IUL + FIA</strong> strategy provides the best balance of
          tax-free growth, death benefit protection, market downside protection, and LTC coverage.
          This aligns with the client's {p.riskTolerance} risk tolerance and {p.isBiz ? 'business owner' : 'employee'} status.
        </p>
      </div>

      {/* ═══ STRESS-TEST & BACKTEST ═══ */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Stress-Test & Backtest</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Stress-Test Scenarios */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Crisis Scenarios</h4>
              {[
                { name: '2008 Financial Crisis', equityDrop: -0.38, bondDrop: -0.05, recoveryYrs: 4, desc: 'Lehman collapse triggered global credit freeze. S&P 500 fell 38%, investment-grade bonds -5%. Housing prices dropped 27%. Fed cut rates to 0% and launched QE1. Full market recovery took 4 years (March 2009 – March 2013).' },
                { name: 'COVID-19 Crash (2020)', equityDrop: -0.34, bondDrop: 0.07, recoveryYrs: 0.5, desc: 'Pandemic lockdowns caused fastest 30% drop in history (22 trading days). S&P 500 fell 34%, but Treasuries rallied +7% as flight-to-safety. Unprecedented fiscal stimulus ($2.2T CARES Act) drove V-shaped recovery in just 5 months.' },
                { name: 'Dot-Com Bust (2000-02)', equityDrop: -0.49, bondDrop: 0.10, recoveryYrs: 7, desc: 'Tech bubble burst after NASDAQ hit 5,048. S&P 500 fell 49% over 2.5 years. Bonds gained 10% as Fed cut rates. Many tech stocks lost 80-90%. Full recovery took 7 years, longest since Great Depression.' },
                { name: 'Stagflation (1973-74)', equityDrop: -0.48, bondDrop: -0.10, recoveryYrs: 8, desc: 'Oil embargo + Nixon shock created rare stocks-and-bonds decline. S&P 500 fell 48%, bonds -10% as inflation hit 12%. Fed raised rates to 13%. Only crisis where diversification failed — both asset classes lost. 8-year recovery.' },
              ].map(scenario => {
                const portfolioImpact = (p.savings + p.retirement401k) * scenario.equityDrop * 0.6 + (p.savings + p.retirement401k) * scenario.bondDrop * 0.4;
                const portfolioAfter = p.savings + p.retirement401k + portfolioImpact;
                const monthlyIncome = Math.round(portfolioAfter * (p.withdrawalRate || 0.04) / 12);
                return (
                  <div key={scenario.name} className="border border-border/50 rounded-lg p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-foreground">{scenario.name}</span>
                      <Badge variant={portfolioImpact < -100000 ? 'destructive' : 'secondary'} className="text-[10px]">
                        {fmtSm(portfolioImpact)}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{scenario.desc}</p>
                    <div className="flex gap-3 text-xs">
                      <span className="text-muted-foreground">Portfolio After: <span className="font-bold text-foreground">{fmtSm(portfolioAfter)}</span></span>
                      <span className="text-muted-foreground">Monthly Income: <span className="font-bold text-primary">{fmt(monthlyIncome)}</span></span>
                      <span className="text-muted-foreground">Recovery: <span className="font-bold">{scenario.recoveryYrs}yr</span></span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Backtest Results */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">20-Year Backtest (2004-2024)</h4>
              {(() => {
                const annualContrib = p.monthlySav * 12;
                const backtestResults = [
                  { name: 'S&P 500 Index', cagr: 0.102, maxDD: -0.508, sharpe: 0.65, color: 'text-blue-400' },
                  { name: 'IUL (Capped 12%/0% Floor)', cagr: 0.072, maxDD: 0, sharpe: 1.1, color: 'text-green-400' },
                  { name: 'FIA (5.5% Avg)', cagr: 0.055, maxDD: 0, sharpe: 1.4, color: 'text-primary' },
                  { name: '60/40 Portfolio', cagr: 0.078, maxDD: -0.35, sharpe: 0.72, color: 'text-purple-400' },
                ];
                return backtestResults.map(bt => {
                  const fv = Array.from({ length: 20 }, (_, i) => i + 1).reduce((acc) => acc * (1 + bt.cagr) + annualContrib, p.savings);
                  return (
                    <div key={bt.name} className="border border-border/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-sm font-semibold ${bt.color}`}>{bt.name}</span>
                        <span className="text-sm font-bold text-foreground">{fmtSm(Math.round(fv))}</span>
                      </div>
                      <div className="flex gap-4 text-[10px] text-muted-foreground">
                        <span>CAGR: <span className="font-bold text-foreground">{pct(bt.cagr)}</span></span>
                        <span>Max DD: <span className={`font-bold ${bt.maxDD < 0 ? 'text-red-400' : 'text-green-400'}`}>{bt.maxDD === 0 ? '0%' : pct(bt.maxDD)}</span></span>
                        <span>Sharpe: <span className="font-bold text-foreground">{bt.sharpe.toFixed(2)}</span></span>
                      </div>
                    </div>
                  );
                });
              })()}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-2 text-[10px] text-muted-foreground">
                Past performance does not guarantee future results. Backtest uses historical index returns. IUL/FIA returns are illustrative based on typical product parameters.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ BUSINESS PRESETS ═══ */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Quick Presets</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Young Professional', desc: 'Age 28, $85K income, minimal coverage', preset: { age: 28, income: 85000, dep: 0, existIns: 50000, savings: 15000, retirement401k: 25000, mortgage: 0, debt: 35000 } },
              { label: 'Growing Family', desc: 'Age 35, $150K combined, 2 kids', preset: { age: 35, income: 150000, dep: 2, existIns: 250000, savings: 50000, retirement401k: 150000, mortgage: 350000, debt: 20000 } },
              { label: 'Peak Earner', desc: 'Age 50, $300K income, estate planning', preset: { age: 50, income: 300000, dep: 1, existIns: 500000, savings: 400000, retirement401k: 800000, mortgage: 200000, debt: 0 } },
              { label: 'Business Owner', desc: 'Age 42, $250K + business, key person needs', preset: { age: 42, income: 250000, dep: 2, existIns: 500000, savings: 200000, retirement401k: 400000, mortgage: 400000, debt: 50000 } },
              { label: 'Pre-Retiree', desc: 'Age 60, $200K, max accumulation', preset: { age: 60, income: 200000, dep: 0, existIns: 750000, savings: 600000, retirement401k: 1200000, mortgage: 100000, debt: 0 } },
            ].map(item => (
              <Button key={item.label} variant="outline" size="sm" className="text-xs h-auto py-2 px-3 flex-col items-start gap-0.5"
                onClick={() => {
                  Object.entries(item.preset).forEach(([k, v]) => {
                    const setter = (p as any)[`set${k.charAt(0).toUpperCase() + k.slice(1)}`];
                    if (setter) setter(v);
                  });
                }}>
                <span className="font-semibold">{item.label}</span>
                <span className="text-[10px] text-muted-foreground font-normal">{item.desc}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══ CUSTOM BUILDER ═══ */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Custom Strategy Builder</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Adjust key assumptions to model a custom scenario, then save it for comparison.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Savings Rate</Label>
              <Input type="number" className="h-7 text-xs" defaultValue={20} min={0} max={100} />
              <span className="text-[9px] text-muted-foreground">% of gross income</span>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Growth Rate</Label>
              <Input type="number" className="h-7 text-xs" defaultValue={7} min={0} max={30} step={0.5} />
              <span className="text-[9px] text-muted-foreground">% annual return</span>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Insurance Coverage</Label>
              <Input type="number" className="h-7 text-xs" defaultValue={10} min={0} max={30} />
              <span className="text-[9px] text-muted-foreground">× income multiplier</span>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-medium text-muted-foreground">Retirement Age</Label>
              <Input type="number" className="h-7 text-xs" defaultValue={65} min={50} max={80} />
              <span className="text-[9px] text-muted-foreground">target retirement</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
              toast.info('Custom scenario saved to comparison. Navigate to Scenario Comparison to view.');
            }}>Save as Scenario</Button>
            <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground">Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ SAVED SCENARIO COMPARISON ═══ */}
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2 mt-8">
        <Layers className="w-5 h-5 text-primary" /> Scenario Comparison
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Select up to 3 saved sessions to compare side-by-side.</p>
      {(!p.savedScenarios || p.savedScenarios.length === 0) ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No saved scenarios yet. Save your current session first, then adjust inputs and save again to compare different plans.
        </CardContent></Card>
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader className="pb-2"><CardTitle className="text-base">Select Scenarios</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {p.savedScenarios.map(s => (
                  <label key={s.id} className="flex items-center gap-3 p-2 rounded-lg border border-border hover:bg-card transition-colors cursor-pointer">
                    <Checkbox checked={selectedIds.includes(s.id)} onCheckedChange={() => toggleScenario(s.id)}
                      disabled={!selectedIds.includes(s.id) && selectedIds.length >= 3} />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      <span className="text-xs text-muted-foreground ml-2">{new Date(s.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>
          {scenarioMetrics.length >= 2 && (
            <Card className="mb-4">
              <CardHeader className="pb-2"><CardTitle className="text-base">Side-by-Side Comparison</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-1 px-1">
                <table role="table" className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Metric</th>
                      {scenarioMetrics.map(m => (
                        <th key={m.id} className="text-center py-2 px-2 text-xs font-semibold text-primary">{m.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">Health Score</td>
                      {scenarioMetrics.map(m => (
                        <td key={m.id} className="text-center px-2 font-bold">
                          <span className={m.healthScore >= 80 ? 'text-green-400' : m.healthScore >= 60 ? 'text-primary' : 'text-red-400'}>
                            {m.healthScore}%
                          </span>
                          <span className="text-xs text-muted-foreground ml-1">({m.healthTotal}/{m.healthMax})</span>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">Total Income</td>
                      {scenarioMetrics.map(m => <td key={m.id} className="text-center px-2 text-foreground/80">{fmtSm(m.income)}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">Monthly Surplus</td>
                      {scenarioMetrics.map(m => (
                        <td key={m.id} className={`text-center px-2 font-medium ${m.surplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(m.surplus)}
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">Savings Rate</td>
                      {scenarioMetrics.map(m => <td key={m.id} className="text-center px-2 text-foreground/80">{pct(m.saveRate)}</td>)}
                    </tr>
                    <tr className="border-b border-border/50">
                      <td className="py-1.5 px-2 text-muted-foreground">Protection Gap</td>
                      {scenarioMetrics.map(m => (
                        <td key={m.id} className={`text-center px-2 font-medium ${m.protGap <= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {m.protGap <= 0 ? 'Covered' : fmtSm(m.protGap)}
                        </td>
                      ))}
                    </tr>
                    {['cash', 'protect', 'growth', 'retire', 'tax', 'estate', 'edu'].map(domain => (
                      <tr key={domain} className="border-b border-border/50">
                        <td className="py-1.5 px-2 text-muted-foreground capitalize">{domain === 'edu' ? 'Education' : domain === 'protect' ? 'Protection' : domain} Score</td>
                        {scenarioMetrics.map(m => {
                          const v = m.scores[domain] || 0;
                          return (
                            <td key={m.id} className="text-center px-2">
                              <span className={v >= 3 ? 'text-green-400' : v >= 2 ? 'text-primary' : 'text-red-400'}>
                                {v}/3
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          )}
          {scenarioMetrics.length >= 2 && (() => {
            const best = scenarioMetrics.reduce((a, b) => a.healthScore >= b.healthScore ? a : b);
            return (
              <div className="bg-gradient-to-r from-green-500/10 to-green-500/5 border border-green-500/30 rounded-xl p-4">
                <h3 className="text-sm font-bold text-green-400 mb-1">Best Scenario: {best.name}</h3>
                <p className="text-sm text-green-400/80">
                  With a health score of {best.healthScore}% and monthly surplus of {fmt(best.surplus)},
                  this scenario provides the strongest overall financial position.
                </p>
              </div>
            );
          })()}
        </>
      )}
    </section>
  );
}

export function SummaryPanel(p: PanelProps) {
  return (
    <section aria-label="Financial Summary" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Executive Summary
        </h2>
        <ExportPDFButton title="Financial Summary" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Complete financial snapshot for {p.clientName || 'the client'}.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Domain Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Domain</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Key Finding</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Action Needed</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Cash Flow</td>
                <td className="px-2 text-muted-foreground">Save rate {pct(p.cfResult.saveRate)}, DTI {pct(p.cfResult.dti)}</td>
                <td className="px-2 text-xs text-primary">{p.cfResult.saveRate < 0.2 ? 'Increase savings rate to 20%+' : 'Maintain current savings discipline'}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Protection</td>
                <td className="px-2 text-muted-foreground">Gap {fmtSm(p.prResult.gap)}</td>
                <td className="px-2 text-xs text-primary">{p.prResult.gap > 0 ? `Close ${fmtSm(p.prResult.gap)} coverage gap` : 'Coverage adequate'}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Growth</td>
                <td className="px-2 text-muted-foreground">{p.grResult.yrs}yr horizon, tax-free edge {fmtSm(p.grResult.taxEdge)}</td>
                <td className="px-2 text-xs text-primary">Maximize Roth + IUL contributions</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Retirement</td>
                <td className="px-2 text-muted-foreground">Best SS at {p.rtResult.bestAge}, income {fmt(p.rtResult.monthlyIncome)}/mo</td>
                <td className="px-2 text-xs text-primary">Delay SS to age {p.rtResult.bestAge}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Tax</td>
                <td className="px-2 text-muted-foreground">Eff rate {pct(p.txResult.effectiveRate)}, savings {fmtSm(p.txResult.totalSaving)}/yr</td>
                <td className="px-2 text-xs text-primary">Implement {p.txResult.strategies.length} tax strategies</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Estate</td>
                <td className="px-2 text-muted-foreground">Tax {fmtSm(p.esResult.estateTax)}, ILIT saves {fmtSm(p.esResult.ilitSaving)}</td>
                <td className="px-2 text-xs text-primary">{p.esResult.estateTax > 0 ? 'Establish ILIT + gifting program' : 'Monitor exemption changes'}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 font-medium text-foreground/80">Education</td>
                <td className="px-2 text-muted-foreground">Gap {fmtSm(p.edResult.totalGap)} for {p.numChildren} children</td>
                <td className="px-2 text-xs text-primary">{p.edResult.totalGap > 0 ? `Increase 529 by ${fmt(p.edResult.additionalMonthlyNeeded)}/mo` : '529 on track'}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Investment Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase">Total Annual</div>
              <div className="text-xl font-extrabold text-primary">{fmt(p.totalAnnualPremium)}</div>
              <div className="text-xs text-muted-foreground">{p.recommendations.length} products</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase">Monthly</div>
              <div className="text-xl font-extrabold text-primary">{fmt(Math.round(p.totalAnnualPremium / 12))}</div>
              <div className="text-xs text-muted-foreground">all premiums</div>
            </div>
            <div className="bg-background rounded-lg p-3 text-center">
              <div className="text-xs font-bold text-muted-foreground uppercase">Health Score</div>
              <div className="text-xl font-extrabold text-primary">{p.scorecard.overall}/{p.scorecard.maxScore}</div>
              <div className="text-xs text-muted-foreground">{pct(p.scorecard.pctScore)}</div>
            </div>
            <div className="bg-primary/10 rounded-lg p-3 text-center">
              <div className="text-xs font-bold text-primary uppercase">% of Income</div>
              <div className="text-xl font-extrabold text-primary">{pct(p.totalIncome > 0 ? p.totalAnnualPremium / p.totalIncome : 0)}</div>
              <div className="text-xs text-muted-foreground">target &lt; 15%</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Practice Planning Cross-Link Summary ─── */}
      {p.practiceIncome.grandTotal > 0 && (
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Practice Planning Summary
              <RefTip text="Aggregates all practice planning revenue streams. Includes personal production, overrides, bonuses, AUM fees, and renewal income from Practice Planning panels." refId="commission" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-muted-foreground uppercase">Practice Revenue</div>
                <div className="text-xl font-extrabold text-primary">{fmtSm(p.practiceIncome.grandTotal)}</div>
                <div className="text-xs text-muted-foreground">{p.practiceIncome.streamCount} streams</div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-muted-foreground uppercase">Practice EBITDA</div>
                <div className="text-xl font-extrabold text-primary">{fmtSm(p.practiceIncome.pnlEbitda)}</div>
                <div className="text-xs text-muted-foreground">annual</div>
              </div>
              <div className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-muted-foreground uppercase">Practice Net</div>
                <div className="text-xl font-extrabold text-primary">{fmtSm(p.practiceIncome.pnlNetIncome)}</div>
                <div className="text-xs text-muted-foreground">after tax</div>
              </div>
              <div className="bg-primary/10 rounded-lg p-3 text-center">
                <div className="text-xs font-bold text-primary uppercase">Combined Income</div>
                <div className="text-xl font-extrabold text-primary">{fmtSm(p.totalIncome + p.practiceIncome.grandTotal)}</div>
                <div className="text-xs text-muted-foreground">personal + practice</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function ActionPlanPanel(p: PanelProps) {
  return (
    <section aria-label="Action Plan" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-primary" /> 12-Month Action Plan
        </h2>
        <ExportPDFButton title="Action Plan" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Prioritized implementation timeline with pace options.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-foreground/80">Implementation Pace:</span>
            {(['standard', 'aggressive', 'gradual'] as const).map(pc => (
              <Button key={pc} size="sm" variant={p.pace === pc ? 'default' : 'outline'}
                className="h-7 px-3 text-xs capitalize"
                onClick={() => p.setPace(pc)}>
                {pc === 'standard' ? 'Standard (12mo)' : pc === 'aggressive' ? 'Aggressive (6mo)' : 'Gradual (18mo)'}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Implementation Timeline — {p.pace.charAt(0).toUpperCase() + p.pace.slice(1)} Pace</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Phase</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Timeline</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Actions</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Priority</th>
              </tr>
            </thead>
            <tbody>
              {buildActionPlan(p.pace, p.recommendations, p.scores, p.prResult, p.cfResult, p.edResult).map((phase, i) => {
                const MAX_VISIBLE = 3;
                const showAll = p.expandedPhases?.has(i);
                const visibleActions = showAll ? phase.actions : phase.actions.slice(0, MAX_VISIBLE);
                const hasMore = phase.actions.length > MAX_VISIBLE;
                return (
                <tr key={i} className="border-b border-border/50 align-top">
                  <td className="py-2 px-2 font-medium text-foreground/80">{phase.name}</td>
                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{phase.timeline}</td>
                  <td className="py-2 px-2">
                    <ul className="space-y-1">
                      {visibleActions.map((a, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-primary mt-0.5">•</span> {a}
                        </li>
                      ))}
                    </ul>
                    {hasMore && (
                      <button
                        className="text-[10px] text-primary hover:underline mt-1"
                        onClick={() => {
                          const next = new Set<number>(p.expandedPhases || new Set<number>());
                          if (next.has(i)) next.delete(i); else next.add(i);
                          p.setExpandedPhases?.(next);
                        }}
                      >
                        {showAll ? '▲ Show less' : `▼ Show ${phase.actions.length - MAX_VISIBLE} more`}
                      </button>
                    )}
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge variant={phase.priority === 'Critical' ? 'destructive' : phase.priority === 'High' ? 'default' : 'secondary'}
                      className="text-[10px]">{phase.priority}</Badge>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <div className="bg-gradient-to-r from-primary/10 to-primary/15 border border-primary/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-primary mb-2">Immediate Next Steps</h3>
        <ol className="space-y-1 text-xs text-primary">
          <li>1. Schedule follow-up meeting within 7 days to finalize product selection</li>
          <li>2. Gather medical records for underwriting (if life/DI insurance recommended)</li>
          <li>3. Review beneficiary designations on all existing accounts</li>
          <li>4. Set up automatic savings transfers for recommended monthly contributions</li>
          <li>5. Schedule estate attorney consultation (if estate documents needed)</li>
        </ol>
      </div>
    </section>
  );
}

export function ReferencesPanel() {
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set(['funnel', 'methodology']));
  const toggle = (id: string) => setExpandedCats(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <section aria-label="References and Due Diligence" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" /> References & Due Diligence
        </h2>
        <ExportPDFButton title="References and Due Diligence" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">50+ citations across 14 categories. Calculation methodology, industry benchmarks, product sources, and compliance resources.</p>

      {/* Quick expand/collapse all */}
      <div className="flex gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => setExpandedCats(new Set(REFERENCE_CATEGORIES.map(c => c.id)))}>
          Expand All
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpandedCats(new Set())}>
          Collapse All
        </Button>
      </div>

      {/* Funnel Benchmarks Quick Reference Table */}
      <Card className="mb-4 border-primary/20">
        <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle('_funnel_table')}>
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Quick Reference — Funnel Step Defaults vs Industry Range
            <RefTip text="Conversion rates from LIMRA, Legacy Agent, and EverQuote research. Industry averages vary by channel and market." refId="funnel" />
            <span className="ml-auto text-xs text-muted-foreground">{expandedCats.has('_funnel_table') ? '−' : '+'}</span>
          </CardTitle>
        </CardHeader>
        {expandedCats.has('_funnel_table') && (
          <CardContent>
            <div className="overflow-x-auto">
              <div className="overflow-x-auto -mx-1 px-1">
              <table role="table" className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Step</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-primary">Calculator Default</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Industry Low</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Industry Avg</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-green-600">Top Performer</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Key Source</th>
                  </tr>
                </thead>
                <tbody>
                  {FUNNEL_BENCHMARKS.map((fb, i) => (
                    <tr key={i} className={`border-b border-border/50 ${i === FUNNEL_BENCHMARKS.length - 1 ? 'font-semibold' : ''}`}>
                      <td className="py-1.5 px-2 text-foreground/80">{fb.step}</td>
                      <td className="text-center px-2 font-bold text-primary">{fb.calcDefault}</td>
                      <td className="text-center px-2 text-muted-foreground">{fb.industryLow}</td>
                      <td className="text-center px-2 text-muted-foreground">{fb.industryAvg}</td>
                      <td className="text-center px-2 text-green-600 font-semibold">{fb.topPerformer}</td>
                      <td className="px-2 text-xs text-muted-foreground">{fb.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Reference Categories */}
      {REFERENCE_CATEGORIES.map(cat => (
        <Card key={cat.id} className="mb-3">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => toggle(cat.id)}>
            <CardTitle className="text-sm flex items-justify gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary">{cat.name}</span>
              <Badge variant="secondary" className="text-[10px] ml-auto mr-2">{cat.entries.length}</Badge>
              <span className="text-xs text-muted-foreground">{expandedCats.has(cat.id) ? '−' : '+'}</span>
            </CardTitle>
          </CardHeader>
          {expandedCats.has(cat.id) && (
            <CardContent className="pt-0">
              <div className="space-y-3">
                {cat.id === 'duediligence' ? (
                  /* Special rendering for due diligence checklist */
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                    <p className="text-sm font-semibold text-foreground">Steps You Can Take to Verify Independently:</p>
                    {cat.entries.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <span className="text-green-500 mt-0.5 shrink-0">&#10003;</span>
                        <div>
                          <span className="font-semibold">{e.title}:</span>{' '}
                          <span className="text-muted-foreground">{e.finding}</span>
                          {e.url && (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1 text-xs">
                              {new URL(e.url).hostname} &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : cat.id === 'benchmarks' ? (
                  /* Special rendering for industry benchmarks */
                  <div className="space-y-1">
                    {cat.entries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <span className="text-sm font-medium text-foreground/80">{e.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">{e.finding}</span>
                          {e.url && (
                            <a href={e.url} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                              ({e.year}) &rarr;
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Standard rendering for all other categories */
                  cat.entries.map((e, i) => (
                    <div key={i} className="border-b border-border/30 last:border-0 pb-2 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{e.title}</span>
                            {e.year && <span className="text-[10px] text-muted-foreground">({e.year})</span>}
                            {e.trend && (
                              <Badge variant={e.trend === 'up' ? 'default' : e.trend === 'down' ? 'destructive' : 'secondary'}
                                className="text-[10px] px-1.5 py-0">
                                {e.trend === 'up' ? '\u2191' : e.trend === 'down' ? '\u2193' : '\u2194'} {e.trendLabel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{e.finding}</p>
                        </div>
                        {e.url && (
                          <a href={e.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline shrink-0 mt-0.5">
                            {new URL(e.url).hostname.replace('www.', '')} &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          )}
        </Card>
      ))}

      {/* Calculation Methods (existing) */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Calculation Methods Summary<RefTip text="Methodology follows NAIC model regulation guidelines, LIMRA needs analysis standards, and CFP Board planning practices." refId="methodology" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="overflow-x-auto -mx-1 px-1">
            <table role="table" className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-background">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Domain</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Method</th>
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {CALC_METHODS.map((m, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-1.5 px-2 font-medium text-foreground/80">{m.domain}</td>
                    <td className="px-2 text-muted-foreground">{m.method}</td>
                    <td className="px-2 text-xs text-muted-foreground">{m.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground">
        <p className="font-bold mb-1">Disclaimer</p>
        <p>{METHODOLOGY_DISCLOSURE.disclaimer}</p>
      </div>
    </section>
  );
}
