/* Panels B: Retirement (5), Tax (6), Estate (7), Education (8) */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Clock, Building2, Scale, GraduationCap, CheckCircle2
} from 'lucide-react';
import { fmt, fmtSm, pct } from './engine';
import { FormInput, ResultBadge, KPI, type PanelProps } from './shared';

export function RetirementPanel(p: PanelProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <Clock className="w-5 h-5 text-primary" /> Retirement Readiness
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Social Security claiming comparison + portfolio withdrawal analysis. Sources: SSA 2024, Trinity Study, Bengen Rule.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="ss62" label="SS at 62 (monthly)" value={p.ss62} onChange={v => p.setSs62(+v)} prefix="$" />
            <FormInput id="ss67" label="SS at 67 (monthly)" value={p.ss67} onChange={v => p.setSs67(+v)} prefix="$" />
            <FormInput id="ss70" label="SS at 70 (monthly)" value={p.ss70} onChange={v => p.setSs70(+v)} prefix="$" />
            <FormInput id="pension" label="Pension (monthly)" value={p.pension} onChange={v => p.setPension(+v)} prefix="$" />
            <FormInput id="withdrawalRate" label="Withdrawal Rate" value={(p.withdrawalRate * 100).toFixed(1)} onChange={v => p.setWithdrawalRate(+v / 100)} suffix="%" />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Social Security Claiming Comparison</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Claim Age</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Annual</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Cum. at 80</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Cum. at 85</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Cum. at 90</th>
              </tr>
            </thead>
            <tbody>
              {p.rtResult.ssComparison.map(s => (
                <tr key={s.age} className={`border-b border-border/50 ${s.age === p.rtResult.bestAge ? 'bg-green-500/10' : ''}`}>
                  <td className="py-1.5 px-2 font-medium text-foreground/80">
                    Age {s.age} {s.age === p.rtResult.bestAge && <Badge className="ml-1 text-[10px]" variant="default">Best</Badge>}
                  </td>
                  <td className="text-right px-2">{fmt(s.monthly)}</td>
                  <td className="text-right px-2">{fmt(s.annual)}</td>
                  <td className="text-right px-2">{fmtSm(s.cumAt80)}</td>
                  <td className="text-right px-2 font-medium">{fmtSm(s.cumAt85)}</td>
                  <td className="text-right px-2">{fmtSm(s.cumAt90)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Optimal claiming age: {p.rtResult.bestAge}</strong> — maximizes cumulative benefits to age 85.
            Delaying from 62 to 70 increases monthly benefit by ~77%.
          </p>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Portfolio Withdrawal Analysis</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Portfolio at Retirement</td>
                <td className="text-right font-bold">{fmtSm(p.rtResult.portfolioAtRetire)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Annual Withdrawal ({pct(p.withdrawalRate)})</td>
                <td className="text-right font-medium">{fmt(p.rtResult.withdrawal)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Monthly Retirement Income</td>
                <td className="text-right font-bold text-green-400">{fmt(p.rtResult.monthlyIncome)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">RMD at 72 (estimated)</td>
                <td className="text-right">{fmt(p.rtResult.rmd72)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Best SS Age" value={String(p.rtResult.bestAge)} variant="grn" />
        <ResultBadge label="Portfolio" value={fmtSm(p.rtResult.portfolioAtRetire)} variant="blu" />
        <ResultBadge label="Monthly Income" value={fmt(p.rtResult.monthlyIncome)} variant="grn" />
        <ResultBadge label="RMD at 72" value={fmt(p.rtResult.rmd72)} variant="gld" />
      </div>

      {/* ─── Practice Income Impact on Retirement ─── */}
      {p.practiceIncome.grandTotal > 0 && (
        <Card className="mt-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Practice Income → Retirement Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Your practice income from Practice Planning adds to your retirement income sources.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Practice Net/mo" value={fmtSm(p.practiceIncome.monthlyNet)} sub="After tax & OpEx" />
              <KPI label="Retirement Income + Practice" value={fmtSm(p.rtResult.monthlyIncome + p.practiceIncome.monthlyNet)} sub="Combined monthly" />
              <KPI label="Practice ARR" value={fmtSm(p.practiceIncome.annualAUM + p.practiceIncome.annualOverride)} sub="Recurring streams" />
              <KPI label="Income Gap" value={p.rtResult.incomeGap > p.practiceIncome.monthlyNet ? fmtSm(p.rtResult.incomeGap - p.practiceIncome.monthlyNet) : '$0'} sub={p.rtResult.incomeGap <= p.practiceIncome.monthlyNet ? 'Covered by practice' : 'Remaining gap'} />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function TaxPanel(p: PanelProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-primary" /> Tax Optimization
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Marginal bracket analysis + deduction strategies. Sources: IRS 2024, IRC §199A/§408A.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="hsaContrib" label="HSA Contribution" value={p.hsaContrib} onChange={v => p.setHsaContrib(+v)} prefix="$" suffix="/yr" />
            <FormInput id="charitableGiving" label="Charitable Giving" value={p.charitableGiving} onChange={v => p.setCharitableGiving(+v)} prefix="$" suffix="/yr" />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Tax Reduction Strategies</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Strategy</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Annual Saving</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Details</th>
              </tr>
            </thead>
            <tbody>
              {p.txResult.strategies.map((s, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-foreground/80">{s.name}</td>
                  <td className="text-right px-2 font-bold text-green-400">{fmt(s.saving)}</td>
                  <td className="px-2 text-xs text-muted-foreground">{s.note}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-green-500/10 font-bold">
                <td className="py-2 px-2 text-green-400">TOTAL POTENTIAL SAVINGS</td>
                <td className="text-right px-2 text-green-400">{fmt(p.txResult.totalSaving)}/yr</td>
                <td className="px-2 text-xs text-green-400">{fmt(Math.round(p.txResult.totalSaving / 12))}/mo</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Roth Conversion Analysis</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Conversion Amount</td>
                <td className="text-right font-medium">{fmt(p.txResult.rothConversion.amount)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Tax Cost Now</td>
                <td className="text-right text-red-400">{fmt(p.txResult.rothConversion.taxNow)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Tax-Free Future Value (20yr)</td>
                <td className="text-right text-green-400">{fmtSm(p.txResult.rothConversion.taxFreeFuture)}</td>
              </tr>
              <tr className="bg-green-500/10 font-bold">
                <td className="py-2 text-green-400">Net Tax Benefit</td>
                <td className="text-right text-green-400">{fmtSm(p.txResult.rothConversion.netBenefit)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Effective Rate" value={pct(p.txResult.effectiveRate)} variant="gld" />
        <ResultBadge label="Marginal Rate" value={pct(p.txResult.marginalRate)} variant="red" />
        <ResultBadge label="Total Savings" value={fmtSm(p.txResult.totalSaving)} variant="grn" />
        <ResultBadge label="Roth Benefit" value={fmtSm(p.txResult.rothConversion.netBenefit)} variant="grn" />
      </div>

      {/* ─── Practice Income Tax Impact ─── */}
      {p.practiceIncome.grandTotal > 0 && (
        <Card className="mt-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Practice Income → Tax Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Your practice revenue affects your total taxable income and available deductions.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Practice Revenue" value={fmtSm(p.practiceIncome.pnlRevenue)} sub="Annual gross" />
              <KPI label="Practice Tax Est." value={fmtSm(Math.round(p.practiceIncome.pnlRevenue * p.txResult.effectiveRate))} sub={`At ${pct(p.txResult.effectiveRate)} eff. rate`} />
              <KPI label="Combined Income" value={fmtSm(p.totalIncome + p.practiceIncome.grandTotal)} sub="Personal + Practice" />
              <KPI label="QBI Deduction (est.)" value={fmtSm(Math.round(Math.min(p.practiceIncome.pnlRevenue * 0.2, 182100) * p.txResult.marginalRate))} sub="§199A if qualified" />
            </div>
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export function EstatePanel(p: PanelProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <Scale className="w-5 h-5 text-primary" /> Estate Planning
      </h2>
      <p className="text-sm text-muted-foreground mb-4">Estate tax analysis + ILIT strategy + document checklist. Sources: IRS 2024 exemption, IRC §2010.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="grossEstate" label="Gross Estate Value" value={p.grossEstate} onChange={v => p.setGrossEstate(+v)} prefix="$" />
            <FormInput id="exemption" label="Federal Exemption" value={p.exemption} onChange={v => p.setExemption(+v)} prefix="$" />
            <FormInput id="estateGrowth" label="Growth Rate" value={(p.estateGrowth * 100).toFixed(1)} onChange={v => p.setEstateGrowth(+v / 100)} suffix="%" />
            <FormInput id="giftingAnnual" label="Annual Gifting" value={p.giftingAnnual} onChange={v => p.setGiftingAnnual(+v)} prefix="$" />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Estate Documents</Label>
              <Select value={p.willStatus} onValueChange={p.setWillStatus}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Will/Trust</SelectItem>
                  <SelectItem value="will">Will Only</SelectItem>
                  <SelectItem value="trust">Revocable Trust</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Estate Tax Analysis</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Gross Estate</td>
                <td className="text-right font-medium">{fmt(p.esResult.grossEstate)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Federal Exemption (2024)</td>
                <td className="text-right text-green-400">−{fmt(p.esResult.exemption)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Taxable Estate</td>
                <td className="text-right font-medium">{fmt(p.esResult.taxable)}</td>
              </tr>
              <tr className="border-b border-border bg-red-500/10">
                <td className="py-1.5 font-medium text-red-400">Estate Tax (40%)</td>
                <td className="text-right font-bold text-red-400">{fmt(p.esResult.estateTax)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Net to Heirs (without planning)</td>
                <td className="text-right">{fmt(p.esResult.netToHeirs)}</td>
              </tr>
              <tr className="bg-green-500/10">
                <td className="py-1.5 font-medium text-green-400">Net to Heirs (with ILIT + gifting)</td>
                <td className="text-right font-bold text-green-400">{fmt(p.esResult.withPlanning)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Estate Document Checklist</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Document</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Priority</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {p.esResult.documents.map((d, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-foreground/80">{d.name}</td>
                  <td className="text-center px-2">
                    <Badge variant={d.status === 'Complete' ? 'default' : d.status === 'Missing' ? 'destructive' : 'secondary'}
                      className="text-[10px]">{d.status}</Badge>
                  </td>
                  <td className="text-center px-2">
                    <Badge variant={d.priority === 'High' ? 'destructive' : d.priority === 'Medium' ? 'default' : 'secondary'}
                      className="text-[10px]">{d.priority}</Badge>
                  </td>
                  <td className="px-2 text-xs text-muted-foreground">
                    {d.status === 'Missing' ? 'Schedule with estate attorney' : d.status === 'Complete' ? 'Review annually' : 'Verify status'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Estate Tax" value={fmtSm(p.esResult.estateTax)} variant={p.esResult.estateTax === 0 ? 'grn' : 'red'} />
        <ResultBadge label="ILIT Saving" value={fmtSm(p.esResult.ilitSaving)} variant="grn" />
        <ResultBadge label="Net to Heirs" value={fmtSm(p.esResult.withPlanning)} variant="grn" />
        <ResultBadge label="Documents" value={`${p.esResult.documents.filter(d => d.status === 'Complete').length}/${p.esResult.documents.length}`} variant="gld" />
      </div>
    </section>
  );
}

export function EducationPanel(p: PanelProps) {
  return (
    <section>
      <h2 className="text-xl font-bold text-foreground mb-1 flex items-center gap-2">
        <GraduationCap className="w-5 h-5 text-primary" /> Education Planning
      </h2>
      <p className="text-sm text-muted-foreground mb-4">529 plan projections + funding gap analysis. Sources: College Board 2024, Vanguard 529.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="numChildren" label="Number of Children" value={p.numChildren} onChange={v => p.setNumChildren(+v)} min={0} max={8} />
            <FormInput id="avgChildAge" label="Avg Child Age" value={p.avgChildAge} onChange={v => p.setAvgChildAge(+v)} min={0} max={17} />
            <FormInput id="targetCost" label="Target Cost (4yr)" value={p.targetCost} onChange={v => p.setTargetCost(+v)} prefix="$" />
            <FormInput id="eduReturn" label="529 Return Rate" value={(p.eduReturn * 100).toFixed(1)} onChange={v => p.setEduReturn(+v / 100)} suffix="%" />
            <FormInput id="current529" label="Current 529 Balance" value={p.current529} onChange={v => p.setCurrent529(+v)} prefix="$" />
            <FormInput id="monthly529" label="Monthly 529 Contrib" value={p.monthly529} onChange={v => p.setMonthly529(+v)} prefix="$" suffix="/mo" />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">529 Projection ({p.edResult.yrsToCollege} years to college)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Metric</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Per Child</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total ({p.numChildren} children)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Future Cost (inflation-adjusted)</td>
                <td className="text-right px-2 font-medium">{fmtSm(p.edResult.futureCostPerChild)}</td>
                <td className="text-right px-2 font-bold">{fmtSm(p.edResult.totalFutureCost)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">Projected 529 Value</td>
                <td className="text-right px-2 font-medium text-green-400">{fmtSm(p.edResult.projectedPer529)}</td>
                <td className="text-right px-2 font-bold text-green-400">{fmtSm(p.edResult.totalProjected)}</td>
              </tr>
              <tr className="border-t-2 border-border bg-red-500/10 font-bold">
                <td className="py-2 px-2 text-red-400">Funding Gap</td>
                <td className="text-right px-2 text-red-400">{fmtSm(p.edResult.gapPerChild)}</td>
                <td className="text-right px-2 text-red-400">{fmtSm(p.edResult.totalGap)}</td>
              </tr>
            </tbody>
          </table>
          {p.edResult.additionalMonthlyNeeded > 0 && (
            <p className="text-sm text-primary mt-3 bg-primary/10 border border-primary/30 rounded-lg p-3">
              <strong>To close the gap:</strong> Increase monthly 529 contribution by {fmt(p.edResult.additionalMonthlyNeeded)}/mo per child.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Future Cost" value={fmtSm(p.edResult.totalFutureCost)} variant="gld" />
        <ResultBadge label="Projected 529" value={fmtSm(p.edResult.totalProjected)} variant="grn" />
        <ResultBadge label="Gap" value={fmtSm(p.edResult.totalGap)} variant={p.edResult.totalGap === 0 ? 'grn' : 'red'} />
        <ResultBadge label="Add'l Needed" value={fmt(p.edResult.additionalMonthlyNeeded) + '/mo'} variant="gld" />
      </div>
    </section>
  );
}
