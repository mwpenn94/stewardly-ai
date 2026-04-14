/* PanelsE — v2.6 Absent Panels: Advanced Strategies, Business Client, Timeline, Partner */
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { fmt, fmtSm, pct, calcAdvanced, calcBizClient, calcPartner, buildActionPlan } from './engine';
import type { AdvResult, BizClientResult, PartnerResult, ActionPhase } from './engine';
import { FormInput, ResultBadge, KPI, RefTip, type PanelProps } from './shared';

/* ═══ ADVANCED STRATEGIES PANEL ═══ */
export interface AdvancedProps {
  /* Premium Financing */
  pfFace: number; setPfFace: (v: number) => void;
  pfPrem: number; setPfPrem: (v: number) => void;
  pfCash: number; setPfCash: (v: number) => void;
  pfLoan: number; setPfLoan: (v: number) => void;
  pfCred: number; setPfCred: (v: number) => void;
  pfYrs: number; setPfYrs: (v: number) => void;
  /* ILIT */
  ilDB: number; setIlDB: (v: number) => void;
  ilPr: number; setIlPr: (v: number) => void;
  ilCr: number; setIlCr: (v: number) => void;
  ilTx: number; setIlTx: (v: number) => void;
  /* Executive Compensation */
  exSal: number; setExSal: (v: number) => void;
  ex162: number; setEx162: (v: number) => void;
  exSERP: number; setExSERP: (v: number) => void;
  exSD: number; setExSD: (v: number) => void;
  /* Charitable Vehicles */
  cvCRT: number; setCvCRT: (v: number) => void;
  cvPO: number; setCvPO: (v: number) => void;
  cvDAF: number; setCvDAF: (v: number) => void;
  cvLI: number; setCvLI: (v: number) => void;
  /* Tax Savings Goal */
  advGoal: number; setAdvGoal: (v: number) => void;
}

export function AdvancedStrategiesPanel(p: AdvancedProps) {
  const result: AdvResult = calcAdvanced(
    p.pfFace, p.pfPrem, p.pfCash, p.pfLoan, p.pfCred, p.pfYrs,
    p.ilDB, p.ilPr, p.ilCr, p.ilTx,
    p.exSal, p.ex162, p.exSERP, p.exSD,
    p.cvCRT, p.cvPO, p.cvDAF, p.cvLI,
    p.advGoal
  );

  return (
    <div className="space-y-4">
      {/* Main Card */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-foreground">Advanced Strategies</h2>
          <RefTip text="Premium financing: leverage low interest rates to fund large policies. ILIT: removes life insurance from taxable estate. Split-dollar: employer-funded insurance with shared benefits. Minimum case size: typically $1M+ death benefit." refId="AALU (2024), Estate Planning Council" />
        </div>
        <p className="text-xs text-muted-foreground mb-4">Premium financing, ILIT, executive compensation, and charitable vehicles.</p>

        {/* ─── Premium Financing ─── */}
        <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border/50 pb-1">Premium Financing</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <FormInput id="pfFace" label="Face Amount ($)" value={p.pfFace} onChange={v => p.setPfFace(Number(v))} prefix="$" />
          <FormInput id="pfPrem" label="Annual Premium ($)" value={p.pfPrem} onChange={v => p.setPfPrem(Number(v))} prefix="$" />
          <FormInput id="pfCash" label="Cash Outlay/Yr ($)" value={p.pfCash} onChange={v => p.setPfCash(Number(v))} prefix="$" />
          <FormInput id="pfLoan" label="Loan Rate %" value={p.pfLoan} onChange={v => p.setPfLoan(Number(v))} suffix="%" step={0.1} />
          <FormInput id="pfCred" label="Crediting Rate %" value={p.pfCred} onChange={v => p.setPfCred(Number(v))} suffix="%" step={0.1} />
          <FormInput id="pfYrs" label="Years" value={p.pfYrs} onChange={v => p.setPfYrs(Number(v))} min={1} max={30} />
        </div>

        {/* PF Year-by-Year Table */}
        {result.pf.yearByYear.length > 0 && (
          <div className="overflow-x-auto mb-3">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border/50">
                <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Year</th>
                <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Cash Outlay</th>
                <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Loan Balance</th>
                <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Cash Value</th>
                <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Net</th>
              </tr></thead>
              <tbody>
                {result.pf.yearByYear.map(row => (
                  <tr key={row.yr} className="border-b border-border/30">
                    <td className="py-1 px-2 text-muted-foreground">{row.yr}</td>
                    <td className="py-1 px-2 text-right">{fmtSm(row.cashOutlay)}</td>
                    <td className="py-1 px-2 text-right text-red-400">{fmtSm(row.loanBal)}</td>
                    <td className="py-1 px-2 text-right text-green-400">{fmtSm(row.cashValue)}</td>
                    <td className={`py-1 px-2 text-right font-medium ${row.net >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSm(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-4">
          <ResultBadge label="Leverage" value={result.pf.leverage} variant="gld" />
          <ResultBadge label="Total Outlay" value={fmtSm(result.pf.totalCashOutlay)} variant="" />
          <ResultBadge label="Cash Value" value={fmtSm(result.pf.totalCashValue)} variant="grn" />
          <ResultBadge label="Net Benefit" value={fmtSm(result.pf.netBenefit)} variant={result.pf.netBenefit >= 0 ? 'grn' : 'red'} />
        </div>

        {/* ─── ILIT ─── */}
        <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border/50 pb-1">ILIT (Irrevocable Life Insurance Trust)</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <FormInput id="ilDB" label="Death Benefit ($)" value={p.ilDB} onChange={v => p.setIlDB(Number(v))} prefix="$" />
          <FormInput id="ilPr" label="Annual Premium ($)" value={p.ilPr} onChange={v => p.setIlPr(Number(v))} prefix="$" />
          <FormInput id="ilCr" label="Crummey Beneficiaries" value={p.ilCr} onChange={v => p.setIlCr(Number(v))} min={1} />
          <FormInput id="ilTx" label="Estate Tax Rate %" value={p.ilTx} onChange={v => p.setIlTx(Number(v))} suffix="%" />
        </div>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/50">
              <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Metric</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Value</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Death Benefit (in ILIT)</td><td className="py-1 px-2 text-right text-green-400 font-medium">{fmtSm(result.ilit.netToHeirs)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Without ILIT (after estate tax)</td><td className="py-1 px-2 text-right text-red-400">{fmtSm(result.ilit.withoutILIT)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Estate Tax Saved</td><td className="py-1 px-2 text-right text-primary font-medium">{fmtSm(result.ilit.estateTaxSaved)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Annual Gift Exclusion ({result.ilit.crummey} beneficiaries)</td><td className="py-1 px-2 text-right">{fmtSm(result.ilit.annualGiftExclusion)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ─── Executive Compensation ─── */}
        <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border/50 pb-1">Executive Compensation</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <FormInput id="exSal" label="Base Salary ($)" value={p.exSal} onChange={v => p.setExSal(Number(v))} prefix="$" />
          <FormInput id="ex162" label="§162 Bonus ($)" value={p.ex162} onChange={v => p.setEx162(Number(v))} prefix="$" />
          <FormInput id="exSERP" label="SERP ($)" value={p.exSERP} onChange={v => p.setExSERP(Number(v))} prefix="$" />
          <FormInput id="exSD" label="Split Dollar ($)" value={p.exSD} onChange={v => p.setExSD(Number(v))} prefix="$" />
        </div>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/50">
              <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Metric</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Value</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Total Compensation</td><td className="py-1 px-2 text-right font-medium">{fmtSm(result.exec.totalComp)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Employer Tax Benefit</td><td className="py-1 px-2 text-right text-green-400">{fmtSm(result.exec.taxBenefit)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">5-Year Retention Value</td><td className="py-1 px-2 text-right text-primary">{fmtSm(result.exec.retentionValue)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ─── Charitable Vehicles ─── */}
        <h3 className="text-sm font-semibold text-foreground mb-2 border-b border-border/50 pb-1">Charitable Vehicles</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          <FormInput id="cvCRT" label="CRT Contribution ($)" value={p.cvCRT} onChange={v => p.setCvCRT(Number(v))} prefix="$" />
          <FormInput id="cvPO" label="CRT Payout %" value={p.cvPO} onChange={v => p.setCvPO(Number(v))} suffix="%" step={0.5} />
          <FormInput id="cvDAF" label="DAF Contribution ($)" value={p.cvDAF} onChange={v => p.setCvDAF(Number(v))} prefix="$" />
          <FormInput id="cvLI" label="Life Insurance Replacement ($)" value={p.cvLI} onChange={v => p.setCvLI(Number(v))} prefix="$" />
        </div>

        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/50">
              <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Metric</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Value</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">CRT Annual Income</td><td className="py-1 px-2 text-right text-green-400">{fmtSm(result.cv.annualIncome)}/yr</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Tax Deduction</td><td className="py-1 px-2 text-right text-primary">{fmtSm(result.cv.taxDeduction)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">Total Charitable</td><td className="py-1 px-2 text-right">{fmtSm(result.cv.totalCharitable)}</td></tr>
              <tr className="border-b border-border/30"><td className="py-1 px-2 text-muted-foreground">20-Year Net Benefit</td><td className="py-1 px-2 text-right font-medium">{fmtSm(result.cv.netBenefit)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* ─── Tax Savings Goal ─── */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mt-3">
          <h3 className="text-sm font-semibold text-foreground mb-2">Tax Savings Goal</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
            <FormInput id="advGoal" label="Annual Tax Savings Target ($)" value={p.advGoal} onChange={v => p.setAdvGoal(Number(v))} prefix="$" />
          </div>
          {p.advGoal > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant={result.goalMet ? 'default' : 'destructive'} className="text-xs">
                {result.goalMet ? 'Goal Met' : 'Below Target'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Projected savings: {fmtSm(result.totalTaxSavings)} / {fmtSm(p.advGoal)} target
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ BUSINESS CLIENT PANEL ═══ */
export interface BizClientProps {
  bcBizValue: number; setBcBizValue: (v: number) => void;
  bcKeyPersonSalary: number; setBcKeyPersonSalary: (v: number) => void;
  bcKeyPersonMult: number; setBcKeyPersonMult: (v: number) => void;
  bcOwners: number; setBcOwners: (v: number) => void;
  bcEmployees: number; setBcEmployees: (v: number) => void;
  age: number;
}

export function BusinessClientPanel(p: BizClientProps) {
  const result: BizClientResult = calcBizClient(p.bcBizValue, p.bcKeyPersonSalary, p.bcKeyPersonMult, p.bcOwners, p.bcEmployees, p.age);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold text-foreground">Business Owner Planning</h2>
          <RefTip text="Key person insurance: typically 5-10x the key employee's salary. Buy-sell funding: 60% of business owners lack a funded agreement. Group benefits: average employer cost $7,911/employee (single)." refId="NFIB (2024), KFF Employer Survey (2024)" />
        </div>
        <p className="text-xs text-muted-foreground mb-4">Key person, buy-sell, group benefits, and executive compensation needs.</p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <FormInput id="bcBizValue" label="Business Value ($)" value={p.bcBizValue} onChange={v => p.setBcBizValue(Number(v))} prefix="$" />
          <FormInput id="bcKeyPersonSalary" label="Key Person Salary ($)" value={p.bcKeyPersonSalary} onChange={v => p.setBcKeyPersonSalary(Number(v))} prefix="$" />
          <FormInput id="bcKeyPersonMult" label="Key Person Multiplier" value={p.bcKeyPersonMult} onChange={v => p.setBcKeyPersonMult(Number(v))} min={1} max={20} />
          <FormInput id="bcOwners" label="Number of Owners" value={p.bcOwners} onChange={v => p.setBcOwners(Number(v))} min={1} />
          <FormInput id="bcEmployees" label="Employees" value={p.bcEmployees} onChange={v => p.setBcEmployees(Number(v))} min={0} />
        </div>

        {/* Results Table */}
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/50">
              <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Need</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Coverage</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Product</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Annual</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Monthly</th>
            </tr></thead>
            <tbody>
              {result.products.map((pr, i) => (
                <tr key={i} className="border-b border-border/30">
                  <td className="py-1 px-2 text-muted-foreground">{pr.need}</td>
                  <td className="py-1 px-2 text-right">{typeof pr.coverage === 'number' && pr.coverage > 1000 ? fmtSm(pr.coverage) : pr.coverage}</td>
                  <td className="py-1 px-2 text-right text-foreground/80">{pr.product}</td>
                  <td className="py-1 px-2 text-right">{fmtSm(pr.premium)}</td>
                  <td className="py-1 px-2 text-right">{fmtSm(pr.monthly)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5 px-2">Total</td>
                <td className="py-1.5 px-2" colSpan={2}></td>
                <td className="py-1.5 px-2 text-right">{fmtSm(result.totalAnnualCost)}</td>
                <td className="py-1.5 px-2 text-right">{fmtSm(Math.round(result.totalAnnualCost / 12))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap gap-2">
          <ResultBadge label="Key Person Need" value={fmtSm(result.keyPersonNeed)} variant="gld" />
          <ResultBadge label="Buy-Sell/Owner" value={fmtSm(result.buySellNeed)} variant="blu" />
          <ResultBadge label="Group Benefits" value={fmtSm(result.groupBenefitsCost)} variant="" />
          <ResultBadge label="Total Annual" value={fmtSm(result.totalAnnualCost)} variant="red" />
        </div>
      </div>
    </div>
  );
}

/* ═══ TIMELINE PANEL ═══ */
export function TimelinePanel(p: PanelProps) {
  const actionPlan: ActionPhase[] = buildActionPlan(p.pace, p.recommendations, p.scores, p.prResult, p.cfResult, p.edResult);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Implementation Timeline</h3>
        <div className="flex gap-2 mb-4">
          {(['aggressive', 'standard', 'gradual'] as const).map(pc => (
            <Button key={pc} size="sm" variant={p.pace === pc ? 'default' : 'outline'}
              onClick={() => p.setPace(pc)} className="text-xs">
              {pc === 'aggressive' ? 'Aggressive (6 wks)' : pc === 'standard' ? 'Standard (3 mo)' : 'Gradual (6 mo)'}
            </Button>
          ))}
        </div>

        <div className="space-y-3">
          {actionPlan.map((phase, i) => (
            <div key={i} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-primary">{phase.timeline}</span>
                  <span className="text-sm font-semibold text-foreground">{phase.name}</span>
                </div>
                <Badge variant={phase.priority === 'Critical' ? 'destructive' : phase.priority === 'High' ? 'default' : 'secondary'}
                  className="text-[10px]">{phase.priority}</Badge>
              </div>
              <ul className="space-y-1">
                {phase.actions.map((action, j) => (
                  <li key={j} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Client KPIs */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">Client KPIs</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KPI label="Health Score" value={`${p.scorecard.pctScore}%`} variant={p.scorecard.pctScore >= 80 ? 'grn' : p.scorecard.pctScore >= 60 ? 'gld' : 'red'} />
          <KPI label="Protection Gap" value={fmtSm(p.prResult.gap)} variant={p.prResult.gap === 0 ? 'grn' : 'red'} />
          <KPI label="Monthly Surplus" value={fmtSm(p.cfResult.surplus)} variant={p.cfResult.surplus > 0 ? 'grn' : 'red'} />
          <KPI label="Savings Rate" value={pct(p.cfResult.saveRate)} variant={p.cfResult.saveRate >= 0.2 ? 'grn' : p.cfResult.saveRate >= 0.1 ? 'gld' : 'red'} />
          <KPI label="Estate Tax" value={fmtSm(p.esResult.estateTax)} variant={p.esResult.estateTax === 0 ? 'grn' : 'red'} />
          <KPI label="Education Gap" value={fmtSm(p.edResult.totalGap)} variant={p.edResult.totalGap === 0 ? 'grn' : 'red'} />
          <KPI label="Retirement Income" value={fmtSm(p.rtResult.monthlyIncome)} sub="/mo" variant="blu" />
          <KPI label="Tax Savings" value={fmtSm(p.txResult.totalSaving)} variant="gld" />
        </div>
      </div>
    </div>
  );
}

/* ═══ PARTNER / AFFILIATE EARNINGS PANEL ═══ */
export interface PartnerProps {
  paLow: number; setPaLow: (v: number) => void;
  paMid: number; setPaMid: (v: number) => void;
  paHigh: number; setPaHigh: (v: number) => void;
}

export function PartnerPanel(p: PartnerProps) {
  const result: PartnerResult = calcPartner(p.paLow, p.paMid, p.paHigh);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-lg font-bold text-foreground mb-1">Partner / Affiliate Earnings</h2>
        <p className="text-xs text-muted-foreground mb-4">Calculate your affiliate fee earnings from client introductions.</p>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <FormInput id="paLow" label="$250 Intros" value={p.paLow} onChange={v => p.setPaLow(Number(v))} min={0} />
          <FormInput id="paMid" label="$500 Intros" value={p.paMid} onChange={v => p.setPaMid(Number(v))} min={0} />
          <FormInput id="paHigh" label="$1K Intros" value={p.paHigh} onChange={v => p.setPaHigh(Number(v))} min={0} />
        </div>

        <div className="flex flex-wrap gap-2">
          <ResultBadge label="Total Intros" value={String(result.totalIntros)} variant="" />
          <ResultBadge label="Monthly" value={fmtSm(result.totalMonthly)} variant="gld" />
          <ResultBadge label="Annual" value={fmtSm(result.totalAnnual)} variant="grn" />
        </div>

        {/* Breakdown */}
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-border/50">
              <th className="py-1.5 px-2 text-left text-muted-foreground font-medium">Tier</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Intros/Mo</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Fee</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Monthly</th>
              <th className="py-1.5 px-2 text-right text-muted-foreground font-medium">Annual</th>
            </tr></thead>
            <tbody>
              <tr className="border-b border-border/30">
                <td className="py-1 px-2 text-muted-foreground">Standard</td>
                <td className="py-1 px-2 text-right">{result.lowIntros}</td>
                <td className="py-1 px-2 text-right">$250</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.lowEarnings)}</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.lowEarnings * 12)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 px-2 text-muted-foreground">Premium</td>
                <td className="py-1 px-2 text-right">{result.midIntros}</td>
                <td className="py-1 px-2 text-right">$500</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.midEarnings)}</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.midEarnings * 12)}</td>
              </tr>
              <tr className="border-b border-border/30">
                <td className="py-1 px-2 text-muted-foreground">Elite</td>
                <td className="py-1 px-2 text-right">{result.highIntros}</td>
                <td className="py-1 px-2 text-right">$1,000</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.highEarnings)}</td>
                <td className="py-1 px-2 text-right">{fmtSm(result.highEarnings * 12)}</td>
              </tr>
              <tr className="border-t border-border font-semibold">
                <td className="py-1.5 px-2">Total</td>
                <td className="py-1.5 px-2 text-right">{result.totalIntros}</td>
                <td className="py-1.5 px-2"></td>
                <td className="py-1.5 px-2 text-right text-primary">{fmtSm(result.totalMonthly)}</td>
                <td className="py-1.5 px-2 text-right text-primary">{fmtSm(result.totalAnnual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
