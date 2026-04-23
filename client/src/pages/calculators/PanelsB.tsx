/* Panels B: Retirement (5), Tax (6), Estate (7), Education (8) */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Clock, Building2, Scale, GraduationCap, ChevronDown, ChevronUp, Shield, TrendingUp, Layers
} from 'lucide-react';
import { calcBucketStrategy, calcFloorUpside, calcGuytonKlinger, calcRothLadder } from './engine';
import { fmt, fmtSm, pct } from './format';
import { FormInput, ResultBadge, KPI, RefTip, CrossCalcRecs, ExportPDFButton, type PanelProps } from './shared';

/* ═══ COLLAPSIBLE SECTION (Progressive Disclosure) ═══ */
function CollapsibleSection({ title, icon, defaultOpen = false, children }: {
  title: string; icon?: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors rounded-t-lg">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon} {title}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <CardContent className="pt-0 pb-4">{children}</CardContent>}
    </Card>
  );
}

export function RetirementPanel(p: PanelProps) {
  const [retireMethod, setRetireMethod] = useState<'overview' | 'buckets' | 'floor' | 'guyton'>('overview');
  const [annuityIncome, setAnnuityIncome] = useState(0);
  const [essentialExpenses, setEssentialExpenses] = useState(60000);
  const [inflationRate, setInflationRate] = useState(3);
  const [planningHorizon, setPlanningHorizon] = useState(30);

  const bestSS = p.rtResult.ssComparison.find(s => s.age === p.rtResult.bestAge);
  const ssAnnual = bestSS ? bestSS.annual : 0;
  const pensionAnnual = p.pension * 12;

  const bucketResult = useMemo(() =>
    calcBucketStrategy(p.rtResult.portfolioAtRetire, essentialExpenses, ssAnnual, pensionAnnual),
    [p.rtResult.portfolioAtRetire, essentialExpenses, ssAnnual, pensionAnnual]
  );

  const floorResult = useMemo(() =>
    calcFloorUpside(ssAnnual, pensionAnnual, annuityIncome, p.rtResult.portfolioAtRetire, p.withdrawalRate, essentialExpenses),
    [ssAnnual, pensionAnnual, annuityIncome, p.rtResult.portfolioAtRetire, p.withdrawalRate, essentialExpenses]
  );

  const guytonResult = useMemo(() =>
    calcGuytonKlinger(p.rtResult.portfolioAtRetire, p.withdrawalRate, inflationRate / 100, planningHorizon),
    [p.rtResult.portfolioAtRetire, p.withdrawalRate, inflationRate, planningHorizon]
  );

  return (
    <section aria-label="Retirement Planning" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" /> Retirement Income Engineering
        </h2>
        <ExportPDFButton title="Retirement Planning" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Multi-method retirement income analysis. Sources: SSA 2025, Trinity Study, Bengen Rule, Guyton-Klinger (2004).
      </p>

      {/* ─── Core Inputs ─── */}
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <FormInput id="ss62" label="SS at 62 (monthly)" value={p.ss62} onChange={v => p.setSs62(+v)} prefix="$" />
            <FormInput id="ss67" label="SS at 67 (monthly)" value={p.ss67} onChange={v => p.setSs67(+v)} prefix="$" />
            <FormInput id="ss70" label="SS at 70 (monthly)" value={p.ss70} onChange={v => p.setSs70(+v)} prefix="$" />
            <FormInput id="pension" label="Pension (monthly)" value={p.pension} onChange={v => p.setPension(+v)} prefix="$" />
            <FormInput id="withdrawalRate" label="Withdrawal Rate" value={(p.withdrawalRate * 100).toFixed(1)} onChange={v => p.setWithdrawalRate(+v / 100)} suffix="%" />
            <FormInput id="essentialExp" label="Essential Expenses/yr" value={essentialExpenses} onChange={v => setEssentialExpenses(+v)} prefix="$" />
            <FormInput id="annuityIncome" label="Annuity Income/yr" value={annuityIncome} onChange={v => setAnnuityIncome(+v)} prefix="$" />
            <FormInput id="inflationRate" label="Inflation Rate" value={inflationRate} onChange={v => setInflationRate(+v)} suffix="%" />
          </div>
        </CardContent>
      </Card>

      {/* ─── SS Claiming Comparison ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Social Security Claiming Comparison<RefTip text="Based on SSA 2025 benefit estimates. Break-even analysis compares cumulative benefits at ages 62, 67, and 70." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
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
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            <strong>Optimal claiming age: {p.rtResult.bestAge}</strong> — maximizes cumulative benefits to age 85.
          </p>
        </CardContent>
      </Card>

      {/* ─── Income Engineering Methods (Tabbed) ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            Retirement Income Strategies
            <RefTip text="Three research-backed withdrawal strategies. Bucket: time-segmented (Evensky). Floor-Upside: guaranteed floor + growth (Pfau). Guyton-Klinger: dynamic guardrails (2004 paper)." refId="planning" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={retireMethod} onValueChange={v => setRetireMethod(v as any)}>
            <TabsList className="grid grid-cols-2 sm:grid-cols-4 mb-4">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="buckets" className="text-xs">Bucket</TabsTrigger>
              <TabsTrigger value="floor" className="text-xs">Floor-Upside</TabsTrigger>
              <TabsTrigger value="guyton" className="text-xs">Guyton-Klinger</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview">
              <div className="overflow-x-auto -mx-1 px-1">
              <table role="table" className="w-full text-sm">
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
              </div>
            </TabsContent>

            {/* Bucket Strategy Tab */}
            <TabsContent value="buckets">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Bucket Strategy (Evensky)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Segment your portfolio into time-based buckets. Near-term spending from safe assets, long-term growth from equities.
              </p>
              <div className="space-y-2 mb-4">
                {bucketResult.buckets.map(b => {
                  const pctOfTotal = p.rtResult.portfolioAtRetire > 0 ? b.allocation / p.rtResult.portfolioAtRetire : 0;
                  const riskColor = b.risk === 'low' ? 'bg-green-500' : b.risk === 'medium' ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={b.bucket} className="border border-border/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{b.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">{b.assetClass}</Badge>
                          <span className={`w-2 h-2 rounded-full ${riskColor}`} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full ${riskColor}/70 rounded-full`} style={{ width: `${pctOfTotal * 100}%` }} />
                        </div>
                        <span className="text-xs font-mono text-muted-foreground">{pct(pctOfTotal)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{fmtSm(b.allocation)}</span>
                        <span>Expected: {pct(b.expectedReturn)}/yr</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KPI label="Sustainability" value={`${bucketResult.sustainabilityYears} yrs`} sub="Portfolio longevity" />
                <KPI label="Annual Refill" value={fmtSm(bucketResult.refillSchedule[0]?.amount ?? 0)} sub="Long→Near transfer" />
                <KPI label="30yr Need" value={fmtSm(bucketResult.totalNeeded)} sub="Total withdrawals" />
              </div>
            </TabsContent>

            {/* Floor-Upside Tab */}
            <TabsContent value="floor">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Floor-Upside Strategy (Pfau)</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Guaranteed income floor covers essential expenses; portfolio growth provides upside for discretionary spending.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                {/* Floor */}
                <div className="border border-green-500/30 rounded-lg p-3 bg-green-500/5">
                  <div className="text-xs font-bold text-green-400 uppercase tracking-wider mb-2">Guaranteed Floor</div>
                  {floorResult.floor.map(f => (
                    <div key={f.source} className="flex justify-between text-sm py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground">{f.source}</span>
                      <span className="font-medium">{fmt(f.monthly)}/mo</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-green-500/30 mt-2">
                    <span className="text-green-400">Total Floor</span>
                    <span className="text-green-400">{fmt(Math.round(floorResult.totalFloor / 12))}/mo</span>
                  </div>
                </div>
                {/* Upside */}
                <div className="border border-blue-500/30 rounded-lg p-3 bg-blue-500/5">
                  <div className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Growth Upside</div>
                  {floorResult.upside.map(u => (
                    <div key={u.source} className="flex justify-between text-sm py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground">{u.source}</span>
                      <span className="font-medium">{fmt(u.monthly)}/mo</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-blue-500/30 mt-2">
                    <span className="text-blue-400">Total Upside</span>
                    <span className="text-blue-400">{fmt(Math.round(floorResult.totalUpside / 12))}/mo</span>
                  </div>
                </div>
              </div>
              {/* Floor coverage indicator */}
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Floor covers essential expenses</span>
                  <span className={floorResult.floorCoversPct >= 1 ? 'text-green-400 font-bold' : 'text-amber-400 font-bold'}>
                    {pct(floorResult.floorCoversPct)}
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${floorResult.floorCoversPct >= 1 ? 'bg-green-500' : floorResult.floorCoversPct >= 0.8 ? 'bg-amber-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, floorResult.floorCoversPct * 100)}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KPI label="Total Income" value={fmt(Math.round(floorResult.totalIncome / 12))} sub="Monthly combined" />
                <KPI label="Floor Coverage" value={pct(floorResult.floorCoversPct)} sub={floorResult.floorCoversPct >= 1 ? 'Fully covered' : 'Gap exists'} />
                <KPI label="Essential Exp." value={fmt(Math.round(essentialExpenses / 12))} sub="Monthly need" />
              </div>
            </TabsContent>

            {/* Guyton-Klinger Tab */}
            <TabsContent value="guyton">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Guyton-Klinger Decision Rules</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Dynamic withdrawal with guardrails. Adjusts spending based on portfolio performance to extend longevity.
                <RefTip text="Guyton & Klinger (2004): Decision rules increase safe withdrawal rates to 5-6% by dynamically adjusting withdrawals based on portfolio performance." refId="planning" />
              </p>
              <div className="flex items-center gap-3 mb-4">
                <FormInput id="planHorizon" label="Planning Horizon (yrs)" value={planningHorizon} onChange={v => setPlanningHorizon(Math.max(5, Math.min(40, +v)))} />
              </div>
              {/* Guardrails */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                {guytonResult.guardrails.map(g => (
                  <div key={g.name} className={`border rounded-lg p-2 text-xs ${g.triggered ? 'border-amber-500/50 bg-amber-500/10' : 'border-border/50'}`}>
                    <div className="font-semibold flex items-center gap-1">
                      {g.triggered && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                      {g.name}
                    </div>
                    <div className="text-muted-foreground mt-0.5">{g.description}</div>
                    <Badge variant={g.triggered ? 'default' : 'secondary'} className="text-[9px] mt-1">{g.adjustment}</Badge>
                  </div>
                ))}
              </div>
              {/* Projection table (first 10 years) */}
              <div className="overflow-x-auto -mx-1 px-1 mb-3">
                <table role="table" className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Year</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Portfolio</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Withdrawal</th>
                      <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guytonResult.projectedYears.slice(0, 10).map(y => (
                      <tr key={y.year} className={`border-b border-border/30 ${y.rate > guytonResult.ceilingRate ? 'bg-red-500/10' : y.rate < guytonResult.floorRate ? 'bg-green-500/10' : ''}`}>
                        <td className="py-1 px-2">{y.year}</td>
                        <td className="text-right px-2">{fmtSm(y.portfolio)}</td>
                        <td className="text-right px-2">{fmtSm(y.withdrawal)}</td>
                        <td className="text-right px-2 font-mono">{pct(y.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KPI label="Initial" value={fmtSm(guytonResult.initialWithdrawal)} sub={`${pct(p.withdrawalRate)} rate`} />
                <KPI label="Year 10" value={fmtSm(guytonResult.projectedYears[9]?.withdrawal ?? 0)} sub="Adjusted" />
                <KPI label="Ceiling" value={pct(guytonResult.ceilingRate)} sub="Cut trigger" />
                <KPI label="Floor" value={pct(guytonResult.floorRate)} sub="Raise trigger" />
              </div>
            </TabsContent>
          </Tabs>
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
              <RefTip text="Practice income augments retirement projections. Recurring revenue streams (AUM, overrides) provide more stable retirement income than one-time commissions." refId="planning" />
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
      <CrossCalcRecs currentPanel="retire" scores={p.scores} />
    </section>
  );
}

export function TaxPanel(p: PanelProps) {
  const [showLadder, setShowLadder] = useState(false);
  const [targetBracketFill, setTargetBracketFill] = useState(80);

  const rothLadder = useMemo(() =>
    calcRothLadder(
      p.age, p.retireAge, p.savings * 0.6, // Assume 60% is traditional IRA/401k
      p.totalIncome, p.filing, p.stateRate,
      targetBracketFill / 100
    ),
    [p.age, p.retireAge, p.savings, p.totalIncome, p.filing, p.stateRate, targetBracketFill]
  );

  return (
    <section aria-label="Tax Planning" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" /> Tax-Bracket Engineering
        </h2>
        <ExportPDFButton title="Tax Planning" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Marginal bracket analysis + Roth conversion ladder + deduction strategies. Sources: IRS 2025, IRC §199A/§408A.</p>
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
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
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
          </div>
        </CardContent>
      </Card>

      {/* ─── Roth Conversion Ladder ─── */}
      <CollapsibleSection title="Roth Conversion Ladder (Multi-Year)" icon={<TrendingUp className="w-4 h-4 text-primary" />} defaultOpen={false}>
        <p className="text-xs text-muted-foreground mb-3">
          Systematically convert traditional IRA/401(k) to Roth by filling bracket headroom each year.
          Reduces future RMDs and creates tax-free retirement income.
          <RefTip text="Roth conversion ladder (IRC §408A): Convert traditional IRA to Roth during low-income years. 5-year seasoning rule applies. Optimal when current marginal rate < expected future rate." refId="planning" />
        </p>
        <div className="flex items-center gap-3 mb-4">
          <FormInput id="bracketFill" label="Bracket Fill %" value={targetBracketFill} onChange={v => setTargetBracketFill(Math.max(10, Math.min(100, +v)))} suffix="%" />
          <div className="text-xs text-muted-foreground mt-4">
            Fill {targetBracketFill}% of available bracket headroom each year
          </div>
        </div>
        {rothLadder.years.length > 0 && (
          <>
            <div className="overflow-x-auto -mx-1 px-1 mb-3">
              <table role="table" className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-background">
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Year</th>
                    <th className="text-left py-1.5 px-2 font-semibold text-muted-foreground">Age</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Convert</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Tax Cost</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Trad. Bal.</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Roth Bal.</th>
                    <th className="text-right py-1.5 px-2 font-semibold text-muted-foreground">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rothLadder.years.slice(0, 15).map(y => (
                    <tr key={y.year} className="border-b border-border/30">
                      <td className="py-1 px-2">{y.year}</td>
                      <td className="py-1 px-2">{y.age}</td>
                      <td className="text-right px-2 text-primary">{fmtSm(y.convertAmount)}</td>
                      <td className="text-right px-2 text-red-400">{fmtSm(y.taxCost)}</td>
                      <td className="text-right px-2">{fmtSm(y.traditionalBalance)}</td>
                      <td className="text-right px-2 text-green-400">{fmtSm(y.rothBalance)}</td>
                      <td className="text-right px-2 font-mono">{pct(y.marginalRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Separator className="my-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <KPI label="Total Converted" value={fmtSm(rothLadder.totalConverted)} sub={`Over ${rothLadder.years.length} years`} />
              <KPI label="Total Tax Paid" value={fmtSm(rothLadder.totalTaxPaid)} sub="Conversion cost" />
              <KPI label="Projected Tax Saved" value={fmtSm(rothLadder.projectedTaxSaved)} sub="vs. future RMDs" />
              <KPI label="RMD Reduction" value={fmtSm(rothLadder.rmdReduction)} sub="Annual at 72" />
            </div>
          </>
        )}
      </CollapsibleSection>

      {/* ─── Basic Roth Conversion ─── */}
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Single-Year Roth Conversion<RefTip text="Compares tax-now vs tax-later strategies. Roth conversions (IRC §408A) can reduce future RMDs and estate tax exposure." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Recommended Conversion</td>
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
          </div>
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
              <RefTip text="Self-employment tax (15.3%) applies to practice income. QBI deduction (IRC §199A) may reduce taxable income by up to 20% for qualifying businesses." refId="planning" />
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
      <CrossCalcRecs currentPanel="tax" scores={p.scores} />
    </section>
  );
}

export function EstatePanel(p: PanelProps) {
  return (
    <section aria-label="Estate Planning" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Scale className="w-5 h-5 text-primary" /> Estate Planning
        </h2>
        <ExportPDFButton title="Estate Planning" clientName={p.clientName} />
      </div>
      <p className="text-sm text-muted-foreground mb-4">Estate tax analysis + ILIT strategy + document checklist. Sources: IRS 2025 exemption, IRC §2010.</p>
      <Card className="mb-4">
        <CardContent className="pt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <FormInput id="grossEstate" label="Gross Estate Value" value={p.grossEstate} onChange={v => p.setGrossEstate(+v)} prefix="$" max={500000000} />
            <FormInput id="exemption" label="Federal Exemption" value={p.exemption} onChange={v => p.setExemption(+v)} prefix="$" max={100000000} />
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
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">Estate Tax Analysis<RefTip text="Federal estate tax exemption: $13.99M (2025). Rate: 40% on amounts above exemption. Sunset to ~$7M in 2026 under TCJA." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Gross Estate</td>
                <td className="text-right font-medium">{fmt(p.esResult.grossEstate)}</td>
              </tr>
              <tr className="border-b border-border/50">
                <td className="py-1.5 text-muted-foreground">Federal Exemption (2025)</td>
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
          </div>
        </CardContent>
      </Card>
      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Estate Document Checklist</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
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
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ResultBadge label="Estate Tax" value={fmtSm(p.esResult.estateTax)} variant={p.esResult.estateTax === 0 ? 'grn' : 'red'} />
        <ResultBadge label="ILIT Saving" value={fmtSm(p.esResult.ilitSaving)} variant="grn" />
        <ResultBadge label="Net to Heirs" value={fmtSm(p.esResult.withPlanning)} variant="grn" />
        <ResultBadge label="Documents" value={`${p.esResult.documents.filter(d => d.status === 'Complete').length}/${p.esResult.documents.length}`} variant="gld" />
      </div>
      <CrossCalcRecs currentPanel="estate" scores={p.scores} />
    </section>
  );
}

export function EducationPanel(p: PanelProps) {
  return (
    <section aria-label="Education Planning" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" /> Education Planning
        </h2>
        <ExportPDFButton title="Education Planning" clientName={p.clientName} />
      </div>
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
        <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-1">529 Projection ({p.edResult.yrsToCollege} years to college)<RefTip text="529 plans offer tax-free growth for qualified education expenses. Average 4-year public university: ~$100K; private: ~$200K (College Board 2024)." refId="planning" /></CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-1 px-1">
          <table role="table" className="w-full text-sm">
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
          </div>
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
      <CrossCalcRecs currentPanel="edu" scores={p.scores} />
    </section>
  );
}
