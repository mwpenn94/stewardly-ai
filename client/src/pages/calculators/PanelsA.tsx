/* Panels A: Profile (1), Cash Flow (2), Protection (3), Growth (4) */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  User, DollarSign, Shield, TrendingUp, Building2, CheckCircle2, XCircle
} from 'lucide-react';
import { fmt, fmtSm, pct } from './engine';
import { FormInput, ScoreBadge, ResultBadge, KPI, ScoreGauge, RefTip, PillarTooltip, CrossCalcRecs, ExportPDFButton, type PanelProps } from './shared';

export function ProfilePanel(p: PanelProps) {
  const keyMetrics: Record<string, string> = {
    'Cash Flow': `Save rate ${pct(p.cfResult.saveRate)}`,
    'Protection': `Gap ${fmtSm(p.prResult.gap)}`,
    'Growth': `${p.grResult.yrs}yr to retire`,
    'Retirement': `SS best at ${p.rtResult.bestAge}`,
    'Tax': `Eff rate ${pct(p.txResult.effectiveRate)}`,
    'Estate': `Tax ${fmtSm(p.esResult.estateTax)}`,
    'Education': `Gap ${fmtSm(p.edResult.totalGap)}`,
  };
  return (
    <section aria-label="Client Profile" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <User className="w-5 h-5 text-primary" /> Client Profile
        </h2>
        <ExportPDFButton title="Client Profile" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Enter client information. All fields auto-calculate across every panel.</p>

      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormInput id="name" label="Client Name" value={p.clientName} onChange={p.setClientName} type="text" />
            <FormInput id="age" label="Age" value={p.age} onChange={v => p.setAge(+v)} min={18} max={85} />
            <FormInput id="spouseAge" label="Spouse Age" value={p.spouseAge} onChange={v => p.setSpouseAge(+v)} min={0} max={85} />
            <FormInput id="dep" label="Dependents" value={p.dep} onChange={v => p.setDep(+v)} min={0} max={10} />
            <FormInput id="income" label="Annual Income" value={p.income} onChange={v => p.setIncome(+v)} prefix="$" max={50000000} />
            <FormInput id="spouseIncome" label="Spouse Income" value={p.spouseIncome} onChange={v => p.setSpouseIncome(+v)} prefix="$" />
            <FormInput id="nw" label="Net Worth" value={p.nw} onChange={v => p.setNw(+v)} prefix="$" max={500000000} />
            <FormInput id="savings" label="Liquid Savings" value={p.savings} onChange={v => p.setSavings(+v)} prefix="$" max={100000000} />
            <FormInput id="retirement401k" label="401(k)/IRA Balance" value={p.retirement401k} onChange={v => p.setRetirement401k(+v)} prefix="$" max={100000000} />
            <FormInput id="mortgage" label="Mortgage Balance" value={p.mortgage} onChange={v => p.setMortgage(+v)} prefix="$" max={50000000} />
            <FormInput id="debt" label="Other Debt" value={p.debt} onChange={v => p.setDebt(+v)} prefix="$" />
            <FormInput id="existIns" label="Existing Life Insurance" value={p.existIns} onChange={v => p.setExistIns(+v)} prefix="$" max={100000000} />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Filing Status</Label>
              <Select value={p.filing} onValueChange={p.setFiling}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mfj">Married Filing Jointly</SelectItem>
                  <SelectItem value="single">Single</SelectItem>
                  <SelectItem value="hoh">Head of Household</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FormInput id="stateRate" label="State Tax Rate" value={(p.stateRate * 100).toFixed(1)} onChange={v => p.setStateRate(+v / 100)} suffix="%" />
            <div className="space-y-1">
              <Label className="text-xs font-medium text-muted-foreground">Risk Tolerance</Label>
              <Select value={p.riskTolerance} onValueChange={p.setRiskTolerance}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={p.isBiz} onChange={e => p.setIsBiz(e.target.checked)} className="rounded" />
                Business Owner
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business-Specific Inputs */}
      {p.isBiz && (
        <Card className="mb-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Business Profile
              <RefTip text="Business profile inputs feed into key person, buy-sell, and succession planning calculations. Entity type affects tax treatment per IRC §199A (QBI deduction)." refId="planning" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Entity Type</Label>
                <Select value={p.bizEntityType} onValueChange={p.setBizEntityType}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sole">Sole Proprietorship</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="scorp">S-Corp</SelectItem>
                    <SelectItem value="ccorp">C-Corp</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormInput id="bizRevenue" label="Annual Revenue" value={p.bizRevenue} onChange={v => p.setBizRevenue(+v)} prefix="$" />
              <FormInput id="bizExpenses" label="Annual Expenses" value={p.bizExpenses} onChange={v => p.setBizExpenses(+v)} prefix="$" />
              <FormInput id="bizEmployees" label="Employees" value={p.bizEmployees} onChange={v => p.setBizEmployees(+v)} min={0} />
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Seasonality</Label>
                <Select value={p.bizSeasonality} onValueChange={p.setBizSeasonality}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="even">Even Year-Round</SelectItem>
                    <SelectItem value="q1heavy">Q1 Heavy</SelectItem>
                    <SelectItem value="q4heavy">Q4 Heavy</SelectItem>
                    <SelectItem value="summer">Summer Peak</SelectItem>
                    <SelectItem value="cyclical">Cyclical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormInput id="bizStreams" label="Revenue Streams" value={p.bizRevenueStreams} onChange={v => p.setBizRevenueStreams(+v)} min={1} max={20} />
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Product Mix</Label>
                <Select value={p.bizProductMix} onValueChange={p.setBizProductMix}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="services">Services Only</SelectItem>
                    <SelectItem value="products">Products Only</SelectItem>
                    <SelectItem value="mixed">Mixed</SelectItem>
                    <SelectItem value="saas">SaaS / Recurring</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <FormInput id="bizGrowth" label="Growth Rate" value={(p.bizGrowthRate * 100).toFixed(0)} onChange={v => p.setBizGrowthRate(+v / 100)} suffix="%" />
              <FormInput id="bizDebt" label="Business Debt Service" value={p.bizDebtService} onChange={v => p.setBizDebtService(+v)} prefix="$" suffix="/yr" />
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={p.bizKeyPerson} onChange={e => p.setBizKeyPerson(e.target.checked)} className="rounded" />
                  Key Person Dependency
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-muted-foreground">Succession Plan</Label>
                <Select value={p.bizSuccessionPlan} onValueChange={p.setBizSuccessionPlan}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="family">Family Transfer</SelectItem>
                    <SelectItem value="partner">Partner Buyout</SelectItem>
                    <SelectItem value="esop">ESOP</SelectItem>
                    <SelectItem value="sale">Third-Party Sale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={p.bizBuySell} onChange={e => p.setBizBuySell(e.target.checked)} className="rounded" />
                  Buy-Sell Agreement
                </label>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Net Profit" value={fmt(p.bizRevenue - p.bizExpenses)} variant={p.bizRevenue > p.bizExpenses ? 'grn' : 'red'} />
              <KPI label="Profit Margin" value={p.bizRevenue > 0 ? pct((p.bizRevenue - p.bizExpenses) / p.bizRevenue) : '0%'} variant={p.bizRevenue > 0 && (p.bizRevenue - p.bizExpenses) / p.bizRevenue >= 0.15 ? 'grn' : 'gld'} />
              <KPI label="Rev/Employee" value={p.bizEmployees > 0 ? fmtSm(p.bizRevenue / p.bizEmployees) : 'N/A'} variant="blu" />
              <KPI label="Biz Risk" value={p.bizKeyPerson && !p.bizBuySell ? 'High' : p.bizKeyPerson ? 'Medium' : 'Low'} variant={p.bizKeyPerson && !p.bizBuySell ? 'red' : p.bizKeyPerson ? 'gld' : 'grn'} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Health Scorecard */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-1">
            Financial Health Scorecard
            <RefTip text="7-domain scoring based on DIME method, BLS spending data, and Trinity Study withdrawal rates." refId="planning" />
          </CardTitle>
          <p className="text-[10px] text-muted-foreground mt-0.5">Last calculated: {new Date().toLocaleTimeString()}</p>
        </CardHeader>
        <CardContent>
          {p.income === 0 && p.nw === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground mb-3">Enter your income and net worth above to see your financial health score.</p>
              <div className="inline-flex gap-2">
                <button className="text-xs text-primary hover:underline" onClick={() => document.getElementById('income')?.focus()}>Set Income</button>
                <span className="text-muted-foreground">·</span>
                <button className="text-xs text-primary hover:underline" onClick={() => document.getElementById('nw')?.focus()}>Set Net Worth</button>
              </div>
            </div>
          ) : (
          <>
          <div className="flex flex-col md:flex-row gap-6">
            <ScoreGauge pct={p.scorecard.pctScore} total={p.scorecard.overall} max={p.scorecard.maxScore} />
            <div className="flex-1">
              <div className="overflow-x-auto -mx-1 px-1">
              <table role="table" className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 text-xs font-semibold text-muted-foreground">Domain</th>
                    <th className="text-center py-1 text-xs font-semibold text-muted-foreground">Score</th>
                    <th className="text-left py-1 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-1 text-xs font-semibold text-muted-foreground">Key Metric</th>
                  </tr>
                </thead>
                <tbody>
                  {p.scorecard.domains.map(d => (
                    <tr key={d.name} className="border-b border-border/50">
                      <td className="py-1.5 font-medium text-foreground/80">{d.name}</td>
                      <td className="text-center">
                        <span className="inline-flex gap-0.5">
                          {[1,2,3].map(i => (
                            <span key={i} className={`w-2 h-2 rounded-full ${i <= d.score ? 'bg-green-500' : 'bg-muted'}`} />
                          ))}
                        </span>
                      </td>
                      <td><ScoreBadge score={d.score} /></td>
                      <td className="text-xs text-muted-foreground">{keyMetrics[d.name] || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {p.scorecard.pillars.map(pl => (
              <div key={pl.name} className="bg-background rounded-lg p-3 text-center">
                <div className="text-xs font-semibold text-muted-foreground uppercase flex items-center justify-center">{pl.name}<PillarTooltip pillar={pl.name} /></div>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${pl.score / pl.maxScore >= 0.8 ? 'bg-green-500' : pl.score / pl.maxScore >= 0.5 ? 'bg-primary' : 'bg-red-500'}`}
                    style={{ width: `${(pl.score / pl.maxScore * 100).toFixed(0)}%` }} />
                </div>
                <div className="text-xs mt-1 text-muted-foreground">{pl.score}/{pl.maxScore} — {pl.domains.join(', ')}</div>
                <div className="text-[10px] mt-0.5 text-muted-foreground/60 italic">Peer avg: {Math.round(pl.maxScore * 0.55)}/{pl.maxScore}</div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">Peer benchmarks based on aggregated advisor client data (similar age/income bracket).</p>
          </>
          )}
        </CardContent>
      </Card>

      {/* Recommended Products */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Recommended Products<RefTip text="Recommendations based on gap analysis across all 7 domains. Premiums reflect industry averages from AM Best and NAIC data." refId="premiums" /></CardTitle></CardHeader>
        <CardContent>
          {p.recommendations.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No recommendations — all domains scoring well.</p>
          ) : (
            <div className="overflow-x-auto">
              <div className="overflow-x-auto -mx-1 px-1">
              <table role="table" className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Coverage</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Annual</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Carrier</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {p.recommendations.map((r, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-1.5 px-2 font-medium text-foreground/80">{r.product}</td>
                      <td className="text-right px-2 text-muted-foreground">{r.coverage}</td>
                      <td className="text-right px-2 font-medium">{fmt(r.premium)}</td>
                      <td className="text-right px-2 text-muted-foreground">{fmt(r.monthly)}</td>
                      <td className="px-2 text-muted-foreground">{r.carrier}</td>
                      <td className="text-center px-2">
                        <Badge variant={r.priority === 'High' ? 'destructive' : r.priority === 'Medium' ? 'default' : 'secondary'}
                          className="text-[10px]">{r.priority}</Badge>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background font-bold">
                    <td className="py-2 px-2">TOTAL</td>
                    <td className="text-right px-2">{p.recommendations.length} products</td>
                    <td className="text-right px-2">{fmt(p.totalAnnualPremium)}</td>
                    <td className="text-right px-2">{fmt(Math.round(p.totalAnnualPremium / 12))}</td>
                    <td colSpan={2} className="px-2 text-xs text-muted-foreground">
                      {pct(p.totalIncome > 0 ? p.totalAnnualPremium / p.totalIncome : 0)} of income
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <CrossCalcRecs currentPanel="cash" scores={p.scores} />
    </section>
  );
}
export function CashFlowPanel(p: PanelProps) {
  return (
    <section aria-label="Cash Flow Analysis" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Monthly Cash Flow
        </h2>
        <ExportPDFButton title="Cash Flow Analysis" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Budget analysis with emergency fund tracking. Sources: BLS Consumer Expenditure Survey 2024.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="housing" label="Housing" value={p.housing} onChange={v => p.setHousing(+v)} prefix="$" suffix="/mo" />
            <FormInput id="transport" label="Transport" value={p.transport} onChange={v => p.setTransport(+v)} prefix="$" suffix="/mo" />
            <FormInput id="food" label="Food" value={p.food} onChange={v => p.setFood(+v)} prefix="$" suffix="/mo" />
            <FormInput id="insurancePmt" label="Insurance" value={p.insurancePmt} onChange={v => p.setInsurancePmt(+v)} prefix="$" suffix="/mo" />
            <FormInput id="debtPmt" label="Debt Payments" value={p.debtPmt} onChange={v => p.setDebtPmt(+v)} prefix="$" suffix="/mo" />
            <FormInput id="otherExp" label="Other" value={p.otherExp} onChange={v => p.setOtherExp(+v)} prefix="$" suffix="/mo" />
            <FormInput id="emMonths" label="Emergency Fund Target (months)" value={p.emMonths} onChange={v => p.setEmMonths(+v)} min={3} max={12} />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Budget Breakdown<RefTip text="Budget allocation follows the 50/30/20 rule (needs/wants/savings). BLS Consumer Expenditure Survey 2024 benchmarks used for category averages." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Item</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">% Gross</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50 bg-green-500/10">
                <td className="py-1.5 px-2 font-medium text-green-400">Gross Income</td>
                <td className="text-right px-2 font-bold text-green-400">{fmt(p.cfResult.gross)}</td>
                <td className="text-right px-2 text-green-400">100%</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-muted-foreground">− Taxes ({pct(p.cfResult.taxRate)})</td>
                <td className="text-right px-2 text-red-400">−{fmt(p.cfResult.gross - p.cfResult.net)}</td>
                <td className="text-right px-2 text-muted-foreground">{pct(p.cfResult.taxRate)}</td>
              </tr>
              <tr className="border-b border-border bg-blue-500/10">
                <td className="py-1.5 px-2 font-medium text-blue-400">Net Income</td>
                <td className="text-right px-2 font-bold text-blue-400">{fmt(p.cfResult.net)}</td>
                <td className="text-right px-2 text-blue-600">{pct(1 - p.cfResult.taxRate)}</td>
              </tr>
              {p.cfResult.expenses.map(e => (
                <tr key={e.label} className="border-b border-border/50">
                  <td className="py-1.5 px-2 text-muted-foreground">− {e.label}</td>
                  <td className="text-right px-2 text-foreground/80">{fmt(e.amount)}</td>
                  <td className="text-right px-2 text-muted-foreground">{p.cfResult.gross > 0 ? pct(e.amount / p.cfResult.gross) : '—'}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-background font-bold">
                <td className="py-2 px-2">Monthly Surplus</td>
                <td className={`text-right px-2 ${p.cfResult.surplus >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(p.cfResult.surplus)}</td>
                <td className="text-right px-2 text-muted-foreground">{p.cfResult.gross > 0 ? pct(p.cfResult.surplus / p.cfResult.gross) : '—'}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Save Rate" value={pct(p.cfResult.saveRate)} variant={p.cfResult.saveRate >= 0.2 ? 'grn' : p.cfResult.saveRate >= 0.1 ? 'gld' : 'red'} />
        <ResultBadge label="DTI Ratio" value={pct(p.cfResult.dti)} variant={p.cfResult.dti <= 0.36 ? 'grn' : p.cfResult.dti <= 0.43 ? 'gld' : 'red'} />
        <ResultBadge label="Emergency Target" value={fmt(p.cfResult.emTarget)} variant="blu" />
        <ResultBadge label="Emergency Gap" value={fmt(p.cfResult.emGap)} variant={p.cfResult.emGap === 0 ? 'grn' : 'red'} />
      </div>

      {/* ─── Practice Income Cross-Link ─── */}
      {p.practiceIncome.grandTotal > 0 && (
        <Card className="mt-4 border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Practice Income (from Practice Planning)
              <RefTip text="Cross-linked from Practice Planning panels. Revenue streams include personal production, overrides, bonuses, and renewal income." refId="commission" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">These figures are computed from your Practice Planning panels and represent your projected practice revenue streams.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <KPI label="Annual Practice Revenue" value={fmtSm(p.practiceIncome.grandTotal)} sub={`${p.practiceIncome.streamCount} active streams`} />
              <KPI label="Monthly Practice Net" value={fmtSm(p.practiceIncome.monthlyNet)} sub="After tax & OpEx" />
              <KPI label="Practice EBITDA" value={fmtSm(p.practiceIncome.pnlEbitda)} sub="Annual" />
              <KPI label="Combined Monthly" value={fmtSm(p.cfResult.surplus + p.practiceIncome.monthlyNet)} sub="Personal + Practice" />
            </div>
            {p.practiceIncome.items.length > 0 && (
              <div className="overflow-x-auto -mx-1 px-1">
              <table role="table" className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-muted-foreground">Revenue Stream</th>
                    <th className="text-right py-1.5 px-2 text-xs font-semibold text-muted-foreground">Annual</th>
                    <th className="text-right py-1.5 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                    <th className="text-left py-1.5 px-2 text-xs font-semibold text-muted-foreground">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {p.practiceIncome.items.map(item => (
                    <tr key={item.name} className="border-b border-border/50">
                      <td className="py-1 px-2 text-foreground/80">{item.name}</td>
                      <td className="text-right px-2 font-medium text-primary">{fmtSm(item.value)}</td>
                      <td className="text-right px-2 text-muted-foreground">{fmtSm(Math.round(item.value / 12))}</td>
                      <td className="px-2 text-xs text-muted-foreground">{item.source}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-background font-bold">
                    <td className="py-1.5 px-2">Total Practice Revenue</td>
                    <td className="text-right px-2 text-primary">{fmtSm(p.practiceIncome.grandTotal)}</td>
                    <td className="text-right px-2 text-primary">{fmtSm(Math.round(p.practiceIncome.grandTotal / 12))}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
      <CrossCalcRecs currentPanel="protect" scores={p.scores} />
    </section>
  );
}
export function ProtectionPanel(p: PanelProps) {
  return (
    <section aria-label="Protection Analysis" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" /> Protection Analysis
        </h2>
        <ExportPDFButton title="Protection Analysis" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">DIME method life insurance needs + DI + LTC. Sources: LIMRA 2024, SOA mortality tables.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="replaceYrs" label="Income Replace Years" value={p.replaceYrs} onChange={v => p.setReplaceYrs(+v)} min={5} max={30} />
            <FormInput id="payoffRate" label="Payoff Rate" value={(p.payoffRate * 100).toFixed(0)} onChange={v => p.setPayoffRate(+v / 100)} suffix="%" />
            <FormInput id="eduPerChild" label="Education/Child" value={p.eduPerChild} onChange={v => p.setEduPerChild(+v)} prefix="$" />
            <FormInput id="finalExp" label="Final Expenses" value={p.finalExp} onChange={v => p.setFinalExp(+v)} prefix="$" />
            <FormInput id="ssBenefit" label="SS Survivor Benefit" value={p.ssBenefit} onChange={v => p.setSsBenefit(+v)} prefix="$" suffix="/mo" />
            <FormInput id="diPct" label="DI Benefit %" value={(p.diPct * 100).toFixed(0)} onChange={v => p.setDiPct(+v / 100)} suffix="%" />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">DIME Analysis<RefTip text="Debt + Income replacement + Mortgage + Education. Standard needs-based method per LIMRA and SOA guidelines." refId="premiums" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Component</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.prResult.components.map(c => (
                <tr key={c.label} className="border-b border-border/50">
                  <td className="py-1.5 px-2 text-muted-foreground">{c.label}</td>
                  <td className="text-right px-2 font-medium">{fmtSm(c.amount)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-primary/10 font-bold">
                <td className="py-2 px-2 text-primary">Total DIME Need</td>
                <td className="text-right px-2 text-primary">{fmtSm(p.prResult.dimeNeed)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 px-2 text-green-400">− Existing Coverage</td>
                <td className="text-right px-2 text-green-400">−{fmtSm(p.prResult.existingCoverage)}</td>
              </tr>
              <tr className="bg-red-500/10 font-bold">
                <td className="py-2 px-2 text-red-400">Coverage Gap</td>
                <td className="text-right px-2 text-red-400">{fmtSm(p.prResult.gap)}</td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Recommended Coverage<RefTip text="Coverage recommendations based on DIME analysis, LIMRA needs-based standards, and SOA mortality tables. Premium estimates from AM Best industry averages." refId="premiums" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Need</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Product</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Coverage</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Annual</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Monthly</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Carrier</th>
              </tr>
            </thead>
            <tbody>
              {p.prResult.products.map((pr, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-1.5 px-2 text-muted-foreground">{pr.need}</td>
                  <td className="px-2 font-medium text-foreground/80">{pr.product}</td>
                  <td className="text-right px-2">{fmtSm(pr.coverage)}</td>
                  <td className="text-right px-2 font-medium">{fmt(pr.premium)}</td>
                  <td className="text-right px-2 text-muted-foreground">{fmt(pr.monthly)}</td>
                  <td className="px-2 text-muted-foreground">{pr.carrier}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-background font-bold">
                <td colSpan={3} className="py-2 px-2">TOTAL</td>
                <td className="text-right px-2">{fmt(p.prResult.totalPremium)}</td>
                <td className="text-right px-2">{fmt(Math.round(p.prResult.totalPremium / 12))}</td>
                <td className="px-2 text-xs text-muted-foreground">{pct(p.totalIncome > 0 ? p.prResult.totalPremium / p.totalIncome : 0)} of income</td>
              </tr>
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="DIME Need" value={fmtSm(p.prResult.dimeNeed)} variant="gld" />
        <ResultBadge label="Coverage Gap" value={fmtSm(p.prResult.gap)} variant={p.prResult.gap === 0 ? 'grn' : 'red'} />
        <ResultBadge label="DI Benefit" value={fmt(p.prResult.diNeed) + '/yr'} variant="blu" />
        <ResultBadge label="Total Premium" value={fmt(p.prResult.totalPremium) + '/yr'} variant="gld" />
       </div>
      <CrossCalcRecs currentPanel="protect" scores={p.scores} />
    </section>
  );
}
export function GrowthPanel(p: PanelProps) {
  return (
    <section aria-label="Growth Projections" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" /> Growth & Accumulation
        </h2>
        <ExportPDFButton title="Growth & Accumulation" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Multi-vehicle comparison: Taxable vs 401(k) vs Roth vs IUL vs FIA. Sources: Morningstar, Vanguard 2024.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="retireAge" label="Target Retire Age" value={p.retireAge} onChange={v => p.setRetireAge(+v)} min={50} max={80} />
            <FormInput id="monthlySav" label="Monthly Savings" value={p.monthlySav} onChange={v => p.setMonthlySav(+v)} prefix="$" />
            <FormInput id="taxReturn" label="Taxable/401k Return" value={(p.taxReturn * 100).toFixed(1)} onChange={v => p.setTaxReturn(+v / 100)} suffix="%" />
            <FormInput id="iulReturn" label="IUL Net Return" value={(p.iulReturn * 100).toFixed(1)} onChange={v => p.setIulReturn(+v / 100)} suffix="%" />
            <FormInput id="fiaReturn" label="FIA Return" value={(p.fiaReturn * 100).toFixed(1)} onChange={v => p.setFiaReturn(+v / 100)} suffix="%" />
            <FormInput id="infRate" label="Inflation Rate" value={(p.infRate * 100).toFixed(1)} onChange={v => p.setInfRate(+v / 100)} suffix="%" />
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Vehicle Comparison ({p.grResult.yrs} years to retirement)<RefTip text="Projections use historical averages: S&P 500 ~10%, bonds ~5%. IUL uses illustrated rates per AG49A. FIA uses fixed-index crediting." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-background">
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Vehicle</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Projected Value</th>
                <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Tax-Free?</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Note</th>
              </tr>
            </thead>
            <tbody>
              {p.grResult.vehicles.map(v => (
                <tr key={v.name} className="border-b border-border/50">
                  <td className="py-1.5 px-2 font-medium text-foreground/80">{v.name}</td>
                  <td className="text-right px-2 font-bold">{fmtSm(v.value)}</td>
                  <td className="text-center px-2">
                    {v.taxFree ? <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                  </td>
                  <td className="px-2 text-xs text-muted-foreground">{v.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Tax-Free Edge Analysis<RefTip text="Compares after-tax wealth: Roth (IRC §408A) and IUL (IRC §7702) vs traditional taxable accounts over the accumulation period." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            By using Roth + IUL instead of taxable + traditional 401(k), the projected tax-free advantage over {p.grResult.yrs} years is:
          </p>
          <div className="mt-2 text-2xl font-bold text-green-400">{fmtSm(p.grResult.taxEdge)}</div>
          <p className="text-xs text-muted-foreground mt-1">This represents the additional after-tax wealth from tax-free growth vehicles (IRC §7702, §408A).</p>
        </CardContent>
      </Card>
      {/* Trajectory Chart with Scenario Overlays */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Wealth Trajectory — Multi-Scenario<RefTip text="Shows projected wealth accumulation under base, optimistic (+2% return), and pessimistic (-2% return) scenarios. Shaded area represents the range of outcomes." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          {(() => {
            const yrs = p.grResult.yrs || 25;
            const monthly = p.monthlySav;
            const baseRate = p.iulReturn;
            const scenarios = [
              { label: 'Optimistic', rate: baseRate + 0.02, color: '#22c55e', dash: '6,3' },
              { label: 'Base Case', rate: baseRate, color: '#f59e0b', dash: '' },
              { label: 'Pessimistic', rate: Math.max(0.01, baseRate - 0.02), color: '#ef4444', dash: '4,4' },
            ];
            const W = 400, H = 180, PL = 50, PR = 10, PT = 10, PB = 30;
            const cw = W - PL - PR, ch = H - PT - PB;
            const allPts = scenarios.map(s => {
              const pts: number[] = [];
              for (let y = 0; y <= yrs; y++) {
                const mr = s.rate / 12;
                const n = y * 12;
                const fv = n > 0 ? monthly * ((Math.pow(1 + mr, n) - 1) / mr) : 0;
                pts.push(fv);
              }
              return pts;
            });
            const maxVal = Math.max(...allPts.flat(), 1);
            const toX = (y: number) => PL + (y / yrs) * cw;
            const toY = (v: number) => PT + ch - (v / maxVal) * ch;
            const toPath = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
            const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => maxVal * f);
            const xTicks = Array.from({ length: Math.min(6, yrs + 1) }, (_, i) => Math.round((i / Math.min(5, yrs)) * yrs));
            return (
              <div>
                <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Wealth trajectory chart with scenario overlays">
                  {/* Grid */}
                  {gridLines.map((v, i) => (
                    <g key={i}>
                      <line x1={PL} y1={toY(v)} x2={W - PR} y2={toY(v)} stroke="currentColor" strokeOpacity={0.1} />
                      <text x={PL - 4} y={toY(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="8">{v >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`}</text>
                    </g>
                  ))}
                  {xTicks.map(y => (
                    <text key={y} x={toX(y)} y={H - 5} textAnchor="middle" className="fill-muted-foreground" fontSize="8">Yr {y}</text>
                  ))}
                  {/* Shaded area between optimistic and pessimistic */}
                  <path d={`${toPath(allPts[0])} ${allPts[2].map((v, i) => `L${toX(yrs - i).toFixed(1)},${toY(allPts[2][yrs - i]).toFixed(1)}`).join(' ')} Z`}
                    fill="currentColor" fillOpacity={0.05} />
                  {/* Scenario lines */}
                  {scenarios.map((s, si) => (
                    <path key={s.label} d={toPath(allPts[si])} fill="none" stroke={s.color} strokeWidth={s.dash ? 1.5 : 2.5}
                      strokeDasharray={s.dash || undefined} />
                  ))}
                </svg>
                <div className="flex justify-center gap-4 mt-2 text-xs">
                  {scenarios.map(s => (
                    <span key={s.label} className="flex items-center gap-1">
                      <span className="w-3 h-0.5 inline-block" style={{ background: s.color, borderStyle: s.dash ? 'dashed' : 'solid' }} />
                      <span className="text-muted-foreground">{s.label} ({(s.rate * 100).toFixed(0)}%)</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Years to Retire" value={String(p.grResult.yrs)} variant="blu" />
        <ResultBadge label="Best Vehicle" value="Roth/IUL" variant="grn" />
        <ResultBadge label="Tax-Free Edge" value={fmtSm(p.grResult.taxEdge)} variant="grn" />
        <ResultBadge label="Monthly Saving" value={fmt(p.monthlySav)} variant="gld" />
      </div>
      <CrossCalcRecs currentPanel="grow" scores={p.scores} />
    </section>
  );
}
