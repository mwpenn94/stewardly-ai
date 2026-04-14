/* Panels C: Cost-Benefit (9), Strategy Compare (10), Summary (11), Action Plan (12), References (13) */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BarChart3, GitCompare, FileText, ListChecks, BookOpen, Layers, Building2
} from 'lucide-react';
import {
  fmt, fmtSm, pct,
  STRATEGIES, CALC_METHODS, DUE_DILIGENCE, buildActionPlan,
  computeScorecard, calcCashFlow, calcProtection, calcGrowth, calcRetirement, calcTax, calcEstate, calcEducation,
  getBracketRate, RATES,
  type HorizonData
} from './engine';
import { ResultBadge, KPI, RefTip, type PanelProps } from './shared';
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
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" /> Comprehensive Cost vs. Benefit Analysis
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Complete financial picture — what your client invests and what they receive across all products.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Multi-Horizon Analysis<RefTip text="NPV calculations use a 3% discount rate (inflation-adjusted). ROI includes both protection value and cash value accumulation." refId="costbenefit" /></CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
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
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <GitCompare className="w-5 h-5 text-primary" /> Strategy Comparison
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Compare 4 planning approaches to see which delivers the best outcome for this client.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <table className="w-full text-sm">
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
                <table className="w-full text-sm">
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
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" /> Executive Summary
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Complete financial snapshot for {p.clientName || 'the client'}.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Domain Summary</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
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
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <ListChecks className="w-5 h-5 text-primary" /> 12-Month Action Plan
      </h2>
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
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Phase</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Timeline</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Actions</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Priority</th>
              </tr>
            </thead>
            <tbody>
              {buildActionPlan(p.pace, p.recommendations, p.scores, p.prResult, p.cfResult, p.edResult).map((phase, i) => (
                <tr key={i} className="border-b border-border/50 align-top">
                  <td className="py-2 px-2 font-medium text-foreground/80">{phase.name}</td>
                  <td className="py-2 px-2 text-muted-foreground whitespace-nowrap">{phase.timeline}</td>
                  <td className="py-2 px-2">
                    <ul className="space-y-1">
                      {phase.actions.map((a, j) => (
                        <li key={j} className="text-xs text-muted-foreground flex items-start gap-1">
                          <span className="text-primary mt-0.5">•</span> {a}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="text-center py-2 px-2">
                    <Badge variant={phase.priority === 'Critical' ? 'destructive' : phase.priority === 'High' ? 'default' : 'secondary'}
                      className="text-[10px]">{phase.priority}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" /> References & Due Diligence
      </h2>
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
            <span className="ml-auto text-xs text-muted-foreground">{expandedCats.has('_funnel_table') ? '−' : '+'}</span>
          </CardTitle>
        </CardHeader>
        {expandedCats.has('_funnel_table') && (
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
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
            <table className="w-full text-sm">
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
