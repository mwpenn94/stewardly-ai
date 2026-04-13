/* Panels C: Cost-Benefit (9), Strategy Compare (10), Summary (11), Action Plan (12), References (13) */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  BarChart3, GitCompare, FileText, ListChecks, BookOpen
} from 'lucide-react';
import {
  fmt, fmtSm, pct,
  STRATEGIES, CALC_METHODS, DUE_DILIGENCE, buildActionPlan,
  type HorizonData
} from './engine';
import { ResultBadge, type PanelProps } from './shared';

export function CostBenefitPanel(p: PanelProps & { horizonData: HorizonData[] }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-primary" /> Comprehensive Cost vs. Benefit Analysis
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Complete financial picture — what your client invests and what they receive across all products.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Multi-Horizon Analysis</CardTitle></CardHeader>
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

export function StrategyComparePanel(p: PanelProps) {
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
      <div className="bg-gradient-to-r from-primary/10 to-primary/15 border border-primary/30 rounded-xl p-4">
        <h3 className="text-sm font-bold text-primary mb-2">Recommendation</h3>
        <p className="text-sm text-primary">
          Based on the client profile, the <strong>Hybrid IUL + FIA</strong> strategy provides the best balance of
          tax-free growth, death benefit protection, market downside protection, and LTC coverage.
          This aligns with the client's {p.riskTolerance} risk tolerance and {p.isBiz ? 'business owner' : 'employee'} status.
        </p>
      </div>
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
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" /> References & Due Diligence
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Calculation methodology, data sources, and compliance checklist.</p>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Calculation Methods</CardTitle></CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Due Diligence Checklist</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Item</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Notes</th>
              </tr>
            </thead>
            <tbody>
              {DUE_DILIGENCE.map((d, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-foreground/80">{d.item}</td>
                  <td className="text-center px-2">
                    <Badge variant={d.status === 'Complete' ? 'default' : d.status === 'Pending' ? 'secondary' : 'destructive'}
                      className="text-[10px]">{d.status}</Badge>
                  </td>
                  <td className="px-2 text-xs text-muted-foreground">{d.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="bg-muted/50 rounded-lg p-4 text-xs text-muted-foreground">
        <p className="font-bold mb-1">Disclaimer</p>
        <p>This analysis is for educational and planning purposes only. All projections use historical averages and standard actuarial assumptions.
        Actual results will vary. Tax laws change frequently — consult a qualified tax professional. Insurance product availability and pricing
        subject to underwriting. Past performance does not guarantee future results. Securities offered through properly licensed representatives.</p>
      </div>
    </section>
  );
}
