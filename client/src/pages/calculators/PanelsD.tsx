/* ═══════════════════════════════════════════════════════════════
   PanelsD — Practice Planning Panels (Business Income Engine)
   8 panels: My Plan, GDC Brackets, Products, Sales Funnel,
             Recruiting, Channels, Dashboard, P&L
   ═══════════════════════════════════════════════════════════════ */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  PRODUCTS, GDC_BRACKETS, CHANNELS, HIER_NAMES, HIER_SHORT, HIER_ORDER, HIER_UP, HIER_DOWN,
  ROLE_DEFAULTS, RECRUIT_DEFAULTS, RECRUIT_LABELS, RECRUIT_SOURCES,
  getBracket, calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard, calcAllTracksSummary,
  calcTrackFunnel, blendSources, calcCumOvrPerHire, calcYr2OvrPerHire, calcFunnelYield,
  fmt, fmtSm, pct,
  type RoleId, type TeamMember, type RecruitTrack, type Product,
} from './practiceEngine';
import { KPI } from './shared';

/* ═══ SHARED PRACTICE PROPS ═══ */
export interface PracticeProps {
  role: RoleId; setRole: (v: RoleId) => void;
  targetGDC: number; setTargetGDC: (v: number) => void;
  wbPct: number; setWbPct: (v: number) => void;
  months: number; setMonths: (v: number) => void;
  bracketOverride: string; setBracketOverride: (v: string) => void;
  productMix: Record<string, number>; setProductMix: (v: Record<string, number>) => void;
  funnelRates: { ap: number; sh: number; cl: number; pl: number };
  setFunnelRates: (v: { ap: number; sh: number; cl: number; pl: number }) => void;
  overrideRate: number; setOverrideRate: (v: number) => void;
  bonusRate: number; setBonusRate: (v: number) => void;
  gen2Rate: number; setGen2Rate: (v: number) => void;
  teamMembers: TeamMember[]; setTeamMembers: (v: TeamMember[]) => void;
  recruitTracks: RecruitTrack[]; setRecruitTracks: (v: RecruitTrack[]) => void;
  channelSpend: Record<string, number>; setChannelSpend: (v: Record<string, number>) => void;
  aumExisting: number; setAumExisting: (v: number) => void;
  aumNew: number; setAumNew: (v: number) => void;
  aumTrailPct: number; setAumTrailPct: (v: number) => void;
  pnlLevel: 'ind' | 'team'; setPnlLevel: (v: 'ind' | 'team') => void;
  pnlProducers: number; setPnlProducers: (v: number) => void;
  pnlAvgGDC: number; setPnlAvgGDC: (v: number) => void;
  pnlPayoutRate: number; setPnlPayoutRate: (v: number) => void;
  pnlOpEx: number; setPnlOpEx: (v: number) => void;
  pnlTaxRate: number; setPnlTaxRate: (v: number) => void;
  pnlEbitGoal: number; setPnlEbitGoal: (v: number) => void;
  pnlNetGoal: number; setPnlNetGoal: (v: number) => void;
  streams: Record<string, boolean>; setStreams: (v: Record<string, boolean>) => void;
}

/* ═══ SMALL HELPERS ═══ */
function PInput({ label, value, onChange, prefix, suffix, className = '' }: {
  label: string; value: number | string; onChange: (v: string) => void;
  prefix?: string; suffix?: string; className?: string;
}) {
  return (
    <div className={`space-y-0.5 ${className}`}>
      <Label className="text-[10px] font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">{prefix}</span>}
        <Input type="number" value={value} onChange={e => onChange(e.target.value)}
          className={`h-7 text-xs ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-6' : ''}`} />
        {suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50">{suffix}</span>}
      </div>
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80 bg-primary/5 px-3 py-1.5 rounded-md border border-primary/10 mb-2">{children}</div>;
}

function DataTable({ headers, rows, className = '' }: {
  headers: string[]; rows: (string | number | React.ReactNode)[][]; className?: string;
}) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[oklch(0.18_0.02_255)] text-foreground/90">
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1.5 font-semibold ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-border/30 hover:bg-card/50">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-2 py-1 ${ci > 0 ? 'text-right' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 1: MY PLAN — Multi-Stream Roll-Up
   ═══════════════════════════════════════════════════════════════ */
export function MyPlanPanel(p: PracticeProps) {
  const rd = ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new;
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);
  const funnel = calcProductionFunnel(p.targetGDC, p.wbPct, p.bracketOverride, avgGDC,
    p.funnelRates.ap, p.funnelRates.sh, p.funnelRates.cl, p.funnelRates.pl, p.months);
  const teamOvr = calcTeamOverride(p.teamMembers, p.overrideRate / 100, p.bonusRate / 100, p.gen2Rate / 100);
  const aumIncome = Math.round((p.aumExisting * (p.aumTrailPct / 100)) + (p.aumNew * (p.aumTrailPct / 100) * 0.5));
  const recSummary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);
  const chMetrics = calcChannelMetrics(p.channelSpend);

  const overrideInc = p.teamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
  const rollUp = calcRollUp({
    role: p.role, hasPersonal: rd.p === 1,
    wbTarget: funnel.wbTarget, expTarget: funnel.expTarget,
    overrideIncome: overrideInc, overrideRate: p.overrideRate / 100,
    aumIncome, affAIncome: 0, affBIncome: 0, affCIncome: 0, affDIncome: 0,
    channelRevAnnual: Math.round(chMetrics.tRevMo * 12),
    streams: p.streams,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">My Plan</span>
          <Badge variant="outline" className="text-[10px]">{HIER_NAMES[p.role]}</Badge>
          <Badge variant="outline" className="text-[10px] text-primary">{rollUp.streamCount} streams</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Role Selector */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="col-span-2">
            <Label className="text-[10px] text-muted-foreground">Role / Segment</Label>
            <Select value={p.role} onValueChange={(v) => {
              p.setRole(v as RoleId);
              const nd = ROLE_DEFAULTS[v] || ROLE_DEFAULTS.new;
              if (nd.mo) p.setMonths(nd.mo);
              if (nd.mix) p.setProductMix(nd.mix);
              p.setFunnelRates({ ap: nd.ap, sh: nd.sh, cl: nd.cl, pl: nd.pl });
            }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HIER_ORDER.map(r => (
                  <SelectItem key={r} value={r}>{HIER_NAMES[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PInput label="Target GDC ($)" value={p.targetGDC} onChange={v => p.setTargetGDC(+v || 0)} prefix="$" />
          <PInput label="Active Months" value={p.months} onChange={v => p.setMonths(+v || 10)} />
        </div>

        {/* Hierarchy Chain */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
          <span className="bg-primary text-primary-foreground px-2 py-0.5 rounded font-bold">YOU: {HIER_SHORT[p.role]}</span>
          {HIER_UP[p.role].length > 0 && <>
            <span className="text-muted-foreground">→ reports to →</span>
            {HIER_UP[p.role].map((r, i) => (
              <span key={r}>
                <span className="bg-muted px-2 py-0.5 rounded font-semibold">{HIER_SHORT[r]}</span>
                {i < HIER_UP[p.role].length - 1 && <span className="text-muted-foreground mx-0.5">→</span>}
              </span>
            ))}
          </>}
          {HIER_DOWN[p.role].length > 0 && <>
            <span className="text-muted-foreground ml-2">manages →</span>
            {HIER_DOWN[p.role].map(r => (
              <span key={r} className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-semibold">{HIER_NAMES[r]}</span>
            ))}
          </>}
        </div>

        {/* Stream Toggles */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: 'personal', label: 'Personal Production' },
            { key: 'expanded', label: 'Expanded Platform' },
            { key: 'override', label: 'Team Override' },
            { key: 'aum', label: 'AUM/Advisory' },
            { key: 'channels', label: 'Marketing Channels' },
          ].map(s => (
            <label key={s.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
              <Checkbox checked={!!p.streams[s.key]}
                onCheckedChange={(c) => p.setStreams({ ...p.streams, [s.key]: !!c })} />
              {s.label}
            </label>
          ))}
        </div>

        <Separator />

        {/* Roll-Up Table */}
        <SectionHeader>Multi-Stream Roll-Up ({rollUp.streamCount} active)</SectionHeader>
        <DataTable
          headers={['Stream', 'Annual', 'Monthly', '% of Total']}
          rows={[
            ...rollUp.items.map(item => [
              <span key={item.name}><b>{item.name}</b><br /><span className="text-[10px] text-muted-foreground">{item.source}</span></span>,
              <span key={`v-${item.name}`} className="text-green-400 font-semibold">{fmt(item.value)}</span>,
              fmt(Math.round(item.value / 12)),
              rollUp.grandTotal > 0 ? pct(item.value / rollUp.grandTotal) : '—',
            ]),
            [
              <b key="total" className="text-primary">TOTAL YEAR 1 ({rollUp.streamCount} streams)</b>,
              <b key="tv" className="text-green-400">{fmt(rollUp.grandTotal)}</b>,
              <b key="tm" className="text-green-400">{fmt(Math.round(rollUp.grandTotal / 12))}</b>,
              <b key="tp" className="text-green-400">100%</b>,
            ],
          ]}
        />

        {/* KPI Summary */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Total Yr1" value={fmtSm(rollUp.grandTotal)} variant="grn" />
          <KPI label="Monthly" value={fmtSm(Math.round(rollUp.grandTotal / 12))} variant="gld" />
          <KPI label="GDC Needed" value={fmtSm(funnel.gdcNeeded)} variant="blu" />
          <KPI label="Bracket" value={pct(funnel.bracketRate)} variant="gld" />
          <KPI label="Daily Appr" value={String(funnel.dailyApproaches)} variant="grn" />
          <KPI label="Mo Apps" value={String(funnel.monthlyApps)} variant="" />
        </div>

        {/* Production Funnel Summary */}
        {p.streams.personal && rd.p === 1 && (
          <>
            <SectionHeader>Production Funnel (Annual)</SectionHeader>
            <DataTable
              headers={['Step', 'Daily', 'Weekly', 'Monthly', 'Annual']}
              rows={[
                ['Approaches', funnel.dailyApproaches, Math.round(funnel.monthlyApproaches / 4.3), funnel.monthlyApproaches, funnel.approaches],
                ['Held', '—', Math.round(funnel.held / p.months / 4.3), Math.round(funnel.held / p.months), funnel.held],
                [<b key="apps">Apps</b>, '—', Math.round(funnel.monthlyApps / 4.3), funnel.monthlyApps, funnel.apps],
                ['Placed', '—', Math.round(funnel.placed / p.months / 4.3), Math.round(funnel.placed / p.months), funnel.placed],
                [<b key="gdc">GDC</b>, '—', '—', <span key="mg" className="text-green-400 font-semibold">{fmt(funnel.monthlyGDC)}</span>, <span key="ag" className="text-green-400 font-semibold">{fmt(funnel.gdcNeeded)}</span>],
              ]}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 2: GDC BRACKETS
   ═══════════════════════════════════════════════════════════════ */
export function GDCBracketsPanel(p: PracticeProps) {
  const [gdcInput, setGdcInput] = useState(150000);
  const [teamSize, setTeamSize] = useState(5);
  const [teamAvgGDC, setTeamAvgGDC] = useState(100000);
  const bracket = getBracket(gdcInput);
  const takeHome = Math.round(gdcInput * bracket.r);
  const override = Math.round(teamSize * teamAvgGDC * (p.overrideRate / 100));
  const nextBracket = GDC_BRACKETS.find(b => b.mn > gdcInput);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">GDC Brackets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <PInput label="Your GDC ($)" value={gdcInput} onChange={v => setGdcInput(+v || 0)} prefix="$" />
          <PInput label="Team Size" value={teamSize} onChange={v => setTeamSize(+v || 0)} />
          <PInput label="Team Avg GDC" value={teamAvgGDC} onChange={v => setTeamAvgGDC(+v || 0)} prefix="$" />
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="GDC" value={fmtSm(gdcInput)} variant="blu" />
          <KPI label="Rate" value={pct(bracket.r)} variant="gld" />
          <KPI label="Take-Home" value={fmtSm(takeHome)} variant="grn" />
          <KPI label="Override" value={fmtSm(override)} variant="gld" />
          <KPI label="Total" value={fmtSm(takeHome + override)} variant="grn" />
          <KPI label="Next Bracket" value={nextBracket ? fmtSm(nextBracket.mn - gdcInput) + ' away' : 'Max ★'} variant="" />
        </div>

        <DataTable
          headers={['Range', 'Rate', 'Take-Home', 'Status']}
          rows={GDC_BRACKETS.map(b => {
            const active = gdcInput >= b.mn && gdcInput <= b.mx;
            return [
              <span key={b.l} className={active ? 'font-bold text-primary' : ''}>{b.l}</span>,
              pct(b.r),
              <span key={`th-${b.l}`} className={active ? 'text-green-400 font-semibold' : ''}>{fmt(Math.round(gdcInput * b.r))}</span>,
              active ? <span key="act" className="text-primary font-bold">◀ Current</span> :
                gdcInput < b.mn ? fmt(b.mn - gdcInput) + ' to reach' : '',
            ];
          })}
        />
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 3: PRODUCTS & MIX
   ═══════════════════════════════════════════════════════════════ */
export function ProductsPanel(p: PracticeProps) {
  const [localProducts, setLocalProducts] = useState<Product[]>(() => PRODUCTS.map(pr => ({ ...pr })));

  const updateProductGDC = useCallback((idx: number, gdc: number) => {
    setLocalProducts(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], gdc };
      return next;
    });
  }, []);

  const totalMixPct = Object.values(p.productMix).reduce((a, b) => a + b, 0);
  const avgGDC = calcWeightedGDC(p.productMix, localProducts);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Products & Mix</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Mix Sliders */}
        <SectionHeader>Your Product Mix</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {localProducts.filter(pr => p.productMix[pr.id] !== undefined || pr.s === 'core').map(pr => (
            <PInput key={pr.id} label={pr.n} value={p.productMix[pr.id] || 0}
              onChange={v => p.setProductMix({ ...p.productMix, [pr.id]: Math.max(0, +v || 0) })} suffix="%" />
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={totalMixPct === 100 ? 'text-green-400' : 'text-red-400'}>
            Mix Total: {totalMixPct}%
          </span>
          <span className="text-muted-foreground">Weighted Avg GDC/Case: <b className="text-foreground">{fmt(avgGDC)}</b></span>
        </div>

        <Separator />

        {/* Product Comparison Table */}
        <SectionHeader>Product Comparison — Commission Rates</SectionHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[oklch(0.15_0.03_250)] text-foreground/90">
                <th className="px-2 py-1.5 text-left font-semibold">Product</th>
                <th className="px-2 py-1.5 text-right font-semibold">GDC/Case</th>
                <th className="px-2 py-1.5 text-left font-semibold">WB Carrier</th>
                <th className="px-2 py-1.5 text-center font-semibold">WB Rate</th>
                <th className="px-2 py-1.5 text-center font-semibold">Industry</th>
                <th className="px-2 py-1.5 text-left font-semibold">Best-in-Class</th>
                <th className="px-2 py-1.5 text-center font-semibold">Best Rate</th>
                <th className="px-2 py-1.5 text-center font-semibold">Renewals</th>
              </tr>
            </thead>
            <tbody>
              {localProducts.map((pr, idx) => {
                const isWbBest = pr.wbRate >= pr.bestRate;
                const wbColor = isWbBest ? 'text-green-400' : pr.wbRate >= pr.bestRate * 0.85 ? 'text-yellow-400' : 'text-red-400';
                const prevSuite = idx > 0 ? localProducts[idx - 1].s : null;
                return [
                  prevSuite !== pr.s && (
                    <tr key={`sep-${pr.s}`}>
                      <td colSpan={8} className="bg-blue-500/5 font-bold text-[10px] uppercase tracking-wider px-2 py-1 border-t-2 border-blue-500/30">
                        {pr.s === 'core' ? 'Core Product Suite' : 'Expanded / Specialty'}
                      </td>
                    </tr>
                  ),
                  <tr key={pr.id} className="border-b border-border/20 hover:bg-card/50">
                    <td className="px-2 py-1 font-semibold" title={pr.src}>{pr.n}</td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={pr.gdc} onChange={e => updateProductGDC(idx, +e.target.value || 0)}
                        className="h-6 w-16 text-[11px] text-right bg-primary/5 border-primary/20" />
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{pr.wb}</td>
                    <td className={`px-2 py-1 text-center font-bold ${wbColor}`}>{pr.wbRate}%{isWbBest ? ' ★' : ''}</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.ind}%</td>
                    <td className="px-2 py-1 text-muted-foreground">{pr.best}</td>
                    <td className="px-2 py-1 text-center font-semibold">{pr.bestRate}%</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.renew}</td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] text-muted-foreground bg-green-500/5 border border-green-500/20 rounded-md p-2">
          <b>★ = WealthBridge rate is best-in-class</b> ·
          <span className="text-green-400"> ● Green</span> = at or above best ·
          <span className="text-yellow-400"> ● Amber</span> = within 15% ·
          <span className="text-red-400"> ● Red</span> = below 85% of best.
          Source: TBA 2025, Sonant AI 2026, SmartAsset 2025.
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 4: SALES FUNNEL
   ═══════════════════════════════════════════════════════════════ */
export function SalesFunnelPanel(p: PracticeProps) {
  const [sfPolicies, setSfPolicies] = useState(50);
  const [sfPl, setSfPl] = useState(80);
  const [sfCl, setSfCl] = useState(30);
  const [sfSh, setSfSh] = useState(75);
  const [sfAp, setSfAp] = useState(15);
  const [sfMo, setSfMo] = useState(10);

  const apps = sfPl > 0 ? Math.round(sfPolicies / (sfPl / 100)) : 0;
  const held = sfCl > 0 ? Math.round(apps / (sfCl / 100)) : 0;
  const set = sfSh > 0 ? Math.round(held / (sfSh / 100)) : 0;
  const approaches = sfAp > 0 ? Math.round(set / (sfAp / 100)) : 0;
  const daily = sfMo > 0 ? Math.round(approaches / sfMo / 21.5) : 0;
  const perHour = Math.max(1, Math.round(daily / 8));

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Sales Funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          <PInput label="Policies Goal" value={sfPolicies} onChange={v => setSfPolicies(+v || 0)} />
          <PInput label="App→Placed %" value={sfPl} onChange={v => setSfPl(+v || 0)} suffix="%" />
          <PInput label="Held→App %" value={sfCl} onChange={v => setSfCl(+v || 0)} suffix="%" />
          <PInput label="Set→Held %" value={sfSh} onChange={v => setSfSh(+v || 0)} suffix="%" />
          <PInput label="Appr→Set %" value={sfAp} onChange={v => setSfAp(+v || 0)} suffix="%" />
          <PInput label="Active Months" value={sfMo} onChange={v => setSfMo(+v || 0)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <KPI label="Policies" value={String(sfPolicies)} variant="grn" />
          <KPI label="Apps" value={String(apps)} variant="" />
          <KPI label="Held" value={String(held)} variant="" />
          <KPI label="Approaches" value={approaches.toLocaleString()} variant="" />
          <KPI label="Daily" value={String(daily)} variant="grn" />
          <KPI label="Per Hour" value={String(perHour)} variant="gld" />
        </div>

        {/* Funnel Visualization */}
        <div className="space-y-1">
          {[
            { label: 'Approaches', count: approaches, color: 'bg-blue-500/30' },
            { label: 'Set', count: set, color: 'bg-blue-500/40' },
            { label: 'Held', count: held, color: 'bg-primary/40' },
            { label: 'Apps', count: apps, color: 'bg-primary/60' },
            { label: 'Placed', count: sfPolicies, color: 'bg-green-500/50' },
          ].map((step, i) => {
            const maxW = approaches || 1;
            const widthPct = Math.max(5, Math.round(step.count / maxW * 100));
            return (
              <div key={step.label} className="flex items-center gap-2">
                <span className="text-[10px] w-16 text-right text-muted-foreground">{step.label}</span>
                <div className={`${step.color} rounded-sm h-5 flex items-center px-2 transition-all`}
                  style={{ width: `${widthPct}%`, minWidth: '40px' }}>
                  <span className="text-[10px] font-bold text-foreground">{step.count.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 5: RECRUITING
   ═══════════════════════════════════════════════════════════════ */
export function RecruitingPanel(p: PracticeProps) {
  const addTrack = (type: string) => {
    const d = RECRUIT_DEFAULTS[type] || RECRUIT_DEFAULTS.newAssoc;
    p.setRecruitTracks([...p.recruitTracks, {
      type, n: d.f > 100000 ? 2 : 3, i: d.i, vw: d.v, o: d.o, a: d.a, p: d.p,
      f: d.f, bk: d.bk, ramp: d.ramp, rP: d.rP, startMo: 1,
      src: { inbound: 60, digital: 15, outbound: 10, campus: 10, poach: 5 },
    }]);
  };

  const updateTrack = (idx: number, field: string, value: number) => {
    const next = [...p.recruitTracks];
    (next[idx] as any)[field] = value;
    p.setRecruitTracks(next);
  };

  const removeTrack = (idx: number) => {
    p.setRecruitTracks(p.recruitTracks.filter((_, i) => i !== idx));
  };

  const summary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Recruiting</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Track Buttons */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(RECRUIT_LABELS).map(([k, label]) => (
            <Button key={k} variant="outline" size="sm" className="text-[11px] h-7"
              onClick={() => addTrack(k)}>+ {label}</Button>
          ))}
        </div>

        {/* Track Cards */}
        {p.recruitTracks.map((track, idx) => {
          const funnel = calcTrackFunnel(track);
          const srcBlend = blendSources(track.src);
          const colors: Record<string, string> = { newAssoc: 'border-l-[oklch(0.25_0.04_255)]', expPro: 'border-l-purple-500', affiliate: 'border-l-blue-500', md: 'border-l-primary' };

          return (
            <div key={idx} className={`border border-border rounded-lg p-3 space-y-3 border-l-4 ${colors[track.type] || 'border-l-primary'}`}>
              <div className="flex items-center justify-between">
                <b className="text-sm">{RECRUIT_LABELS[track.type] || track.type}</b>
                <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 h-6 text-[11px]"
                  onClick={() => removeTrack(idx)}>Remove</Button>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <PInput label="Target Producing" value={track.n} onChange={v => updateTrack(idx, 'n', +v || 0)} />
                <PInput label="Contact→Interest %" value={track.i} onChange={v => updateTrack(idx, 'i', +v || 0)} suffix="%" />
                <PInput label="Interest→Interview %" value={track.vw} onChange={v => updateTrack(idx, 'vw', +v || 0)} suffix="%" />
                <PInput label="Interview→Offer %" value={track.o} onChange={v => updateTrack(idx, 'o', +v || 0)} suffix="%" />
                <PInput label="Offer→Accept %" value={track.a} onChange={v => updateTrack(idx, 'a', +v || 0)} suffix="%" />
                <PInput label="Accept→Producing %" value={track.p} onChange={v => updateTrack(idx, 'p', +v || 0)} suffix="%" />
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                <PInput label="Avg FYC ($)" value={track.f} onChange={v => updateTrack(idx, 'f', +v || 0)} prefix="$" />
                <PInput label="Book ($)" value={track.bk} onChange={v => updateTrack(idx, 'bk', +v || 0)} prefix="$" />
                <PInput label="Ramp Months" value={track.ramp} onChange={v => updateTrack(idx, 'ramp', +v || 0)} />
                <PInput label="Ramp Prod %" value={track.rP} onChange={v => updateTrack(idx, 'rP', +v || 0)} suffix="%" />
                <PInput label="Start Month" value={track.startMo} onChange={v => updateTrack(idx, 'startMo', Math.max(1, Math.min(12, +v || 1)))} />
              </div>

              {/* Source retention badges */}
              <div className="flex flex-wrap gap-1.5 text-[10px]">
                <span className="bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded">Yr1 Ret: <b>{Math.round(srcBlend.yr1Ret * 100)}%</b></span>
                <span className="bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded">Yr2 Ret: <b>{Math.round(srcBlend.yr2Ret * 100)}%</b></span>
                <span className="bg-green-500/10 text-green-400 px-2 py-0.5 rounded">Close: <b>{Math.round(srcBlend.closeRate * 100)}%</b></span>
                <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded">CPA: <b>${srcBlend.cpa}</b></span>
              </div>

              {/* Track Funnel Table */}
              <DataTable
                headers={['Stage', 'Count', 'Step Rate', 'Weekly', 'Monthly']}
                rows={[
                  [<b key="c">Contacted</b>, funnel.cont, '—', Math.round(funnel.cont / 52), Math.round(funnel.cont / 12)],
                  ['Interested', funnel.intr, `${track.i}%`, Math.round(funnel.intr / 52), Math.round(funnel.intr / 12)],
                  ['Interviewed', funnel.intv, `${track.vw}%`, Math.round(funnel.intv / 52), Math.round(funnel.intv / 12)],
                  ['Offered', funnel.off, `${track.o}%`, Math.round(funnel.off / 52), Math.round(funnel.off / 12)],
                  ['Accepted', funnel.acc, `${track.a}%`, Math.round(funnel.acc / 52), Math.round(funnel.acc / 12)],
                  [<b key="p" className="text-green-400">Producing</b>, <span key="pv" className="text-green-400 font-bold">{funnel.prod}</span>, `${track.p}%`, '—', '—'],
                ]}
              />
            </div>
          );
        })}

        {/* Summary */}
        {p.recruitTracks.length > 0 && (
          <>
            <SectionHeader>All Tracks Summary</SectionHeader>
            <div className="flex flex-wrap gap-2">
              <KPI label="Hires" value={String(summary.tHires)} variant="grn" />
              <KPI label="Must Contact" value={String(summary.tContact)} variant="blu" />
              <KPI label="Mo Contacts" value={String(Math.round(summary.tContact / 12))} variant="" />
              <KPI label="Yr1 Override" value={fmtSm(summary.tOvr)} variant="grn" />
              <KPI label="Yr2 Override" value={fmtSm(summary.yr2Ovr)} variant="gld" />
              <KPI label="EBITDA" value={fmtSm(summary.recEBITDA)} variant="grn" />
              <KPI label="ARR" value={fmtSm(summary.recARR)} variant="blu" />
              <KPI label="Books" value={fmtSm(summary.tBooks)} variant="" />
            </div>

            {/* Financial Metrics */}
            <DataTable
              headers={['Metric', 'Year 1 (Ramp)', 'Year 2 (Full)', 'Notes']}
              rows={[
                [<b key="gdc">Team GDC</b>, fmt(summary.tFYC), <span key="y2" className="text-green-400">{fmt(summary.yr2FYC)}</span>, 'Total team production'],
                [<b key="ovr">Override ({p.overrideRate}%)</b>, <span key="o1" className="text-green-400">{fmt(summary.tOvr)}</span>, <span key="o2" className="text-green-400">{fmt(summary.yr2Ovr)}</span>, 'Your override income'],
                [<b key="opex">Recruiting OpEx</b>, <span key="op1" className="text-red-400">{fmt(summary.recOpEx)}</span>, <span key="op2" className="text-red-400">{fmt(Math.round(summary.recOpEx * 0.3))}</span>, '~$2K/hire direct costs'],
                [<b key="ebit">EBITDA</b>, <span key="e1" className={summary.recEBITDA >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(summary.recEBITDA)}</span>, <span key="e2" className="text-green-400">{fmt(summary.yr2Ovr - Math.round(summary.recOpEx * 0.3))}</span>, 'Override − OpEx'],
                [<b key="arr">ARR</b>, fmt(summary.recARR), <span key="a2" className="text-green-400">{fmt(Math.round(summary.yr2FYC * 0.15 + summary.tBooks * 0.01))}</span>, '~15% renewal + 1% trail on books'],
              ]}
            />

            <div className="text-[10px] text-muted-foreground bg-muted/30 rounded-md p-2 border border-border/30">
              <b>Retention context (LIMRA 2022):</b> Industry avg: 80% Yr1 → 40% Yr2 → 23% Yr3 → 15% Yr4.
              Top agencies retain 40–60% through structured onboarding. Source channel significantly impacts retention.
              <b> 65% of terminators leave in years 1–2</b> (focus early activity and joint field work).
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 6: CHANNELS
   ═══════════════════════════════════════════════════════════════ */
export function ChannelsPanel(p: PracticeProps) {
  const metrics = calcChannelMetrics(p.channelSpend);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Marketing Channels</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channel Input Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="bg-[oklch(0.18_0.02_255)] text-foreground/90">
                <th className="px-2 py-1.5 text-left">Channel</th>
                <th className="px-2 py-1.5 text-right">$/Mo</th>
                <th className="px-2 py-1.5 text-right">CPL</th>
                <th className="px-2 py-1.5 text-right">Conv%</th>
                <th className="px-2 py-1.5 text-right">Yr1 Rev</th>
                <th className="px-2 py-1.5 text-right">LTV</th>
                <th className="px-2 py-1.5 text-right">Leads/Yr</th>
                <th className="px-2 py-1.5 text-right">Clients/Yr</th>
                <th className="px-2 py-1.5 text-right">Rev/Mo</th>
                <th className="px-2 py-1.5 text-right">ROI</th>
              </tr>
            </thead>
            <tbody>
              {CHANNELS.map(c => {
                const sp = p.channelSpend[c.id] || 0;
                const annSp = sp * 12;
                const annL = annSp > 0 ? Math.round(annSp / c.cpl) : 0;
                const annC = Math.round(annL * c.cv);
                const annRv = annC * c.rev;
                const roi = annSp > 0 ? Math.round((annRv - annSp) / annSp * 100) : 0;
                return (
                  <tr key={c.id} className="border-b border-border/20 hover:bg-card/50">
                    <td className="px-2 py-1 font-semibold">{c.n}</td>
                    <td className="px-2 py-1 text-right">
                      <Input type="number" value={sp || ''} placeholder={String(c.def)}
                        onChange={e => p.setChannelSpend({ ...p.channelSpend, [c.id]: +e.target.value || 0 })}
                        className="h-6 w-16 text-[11px] text-right bg-primary/5 border-primary/20" />
                    </td>
                    <td className="px-2 py-1 text-right text-muted-foreground">${c.cpl}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{(c.cv * 100).toFixed(0)}%</td>
                    <td className="px-2 py-1 text-right">{fmtSm(c.rev)}</td>
                    <td className="px-2 py-1 text-right text-muted-foreground">{fmtSm(c.ltv)}</td>
                    <td className="px-2 py-1 text-right">{annL}</td>
                    <td className="px-2 py-1 text-right">{annC}</td>
                    <td className="px-2 py-1 text-right text-green-400">{sp > 0 ? fmt(Math.round(annRv / 12)) : '—'}</td>
                    <td className="px-2 py-1 text-right">{sp > 0 ? `${roi}%` : '—'}</td>
                  </tr>
                );
              })}
              <tr className="bg-primary/5 font-semibold">
                <td className="px-2 py-1">TOTAL</td>
                <td className="px-2 py-1 text-right">{fmt(metrics.tSpend)}</td>
                <td colSpan={3}></td>
                <td></td>
                <td className="px-2 py-1 text-right">{metrics.tLeads}</td>
                <td className="px-2 py-1 text-right text-green-400">{metrics.tClients}</td>
                <td className="px-2 py-1 text-right text-green-400">{fmt(Math.round(metrics.tRevMo))}</td>
                <td className="px-2 py-1 text-right">{metrics.roiPct}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Spend/mo" value={fmtSm(metrics.tSpend)} variant="" />
          <KPI label="Leads" value={String(metrics.tLeads)} variant="" />
          <KPI label="Clients" value={String(metrics.tClients)} variant="grn" />
          <KPI label="Rev/mo" value={fmtSm(Math.round(metrics.tRevMo))} variant="gld" />
          <KPI label="CAC" value={fmtSm(metrics.cac)} variant="" />
          <KPI label="LTV:CAC" value={`${metrics.ltvCac}:1`} variant={metrics.ltvCac >= 3 ? 'grn' : 'red'} />
          <KPI label="ROI" value={`${metrics.roiPct}%`} variant="grn" />
          <KPI label="ARR" value={fmtSm(metrics.arr)} variant="blu" />
        </div>

        {/* Marketing Metrics Table */}
        {metrics.tSpend > 0 && (
          <DataTable
            headers={['Marketing Metric', 'Value', 'Benchmark', 'Status']}
            rows={[
              [<b key="cac">CAC</b>, fmt(metrics.cac), 'FS avg: $500–$2,000', metrics.cac > 0 && metrics.cac < 1000 ? '✓ Strong' : metrics.cac < 2000 ? '⚠ Moderate' : '✗ High'],
              [<b key="arpc">Avg Rev/Client</b>, <span key="av" className="text-green-400">{fmt(metrics.avgRevClient)}/yr</span>, `${fmt(Math.round(metrics.avgRevClient / 12))}/mo`, ''],
              [<b key="ltv">LTV</b>, <span key="lv" className="text-green-400">{fmt(metrics.ltv)}</span>, 'Avg rev × 5yr × 85% retention', ''],
              [<b key="ltvcac">LTV:CAC</b>, <span key="lc" className={metrics.ltvCac >= 3 ? 'text-green-400' : 'text-red-400'}>{metrics.ltvCac}:1</span>, '3:1+ healthy, 5:1+ excellent', metrics.ltvCac >= 5 ? '✓ Excellent' : metrics.ltvCac >= 3 ? '✓ Healthy' : '✗ Below target'],
              [<b key="roi">Annual ROI</b>, <span key="rv" className={metrics.roiPct > 0 ? 'text-green-400' : 'text-red-400'}>{metrics.roiPct}%</span>, '500%+ target', metrics.roiPct >= 500 ? '✓ Strong' : metrics.roiPct >= 200 ? '⚠ Moderate' : '✗ Low'],
              [<b key="arr">ARR</b>, <span key="ar" className="text-green-400">{fmt(metrics.arr)}</span>, `Annual rev × 85% retention`, ''],
              [<b key="margin">Margin</b>, <span key="mg" className={metrics.margin >= 50 ? 'text-green-400' : 'text-red-400'}>{metrics.margin}%</span>, '60%+ target', metrics.margin >= 60 ? '✓ Strong' : metrics.margin >= 40 ? '⚠ Moderate' : '✗ Low'],
            ]}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 7: DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
export function DashboardPanel(p: PracticeProps) {
  const rd = ROLE_DEFAULTS[p.role] || ROLE_DEFAULTS.new;
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);
  const funnel = calcProductionFunnel(p.targetGDC, p.wbPct, p.bracketOverride, avgGDC,
    p.funnelRates.ap, p.funnelRates.sh, p.funnelRates.cl, p.funnelRates.pl, p.months);
  const teamOvr = calcTeamOverride(p.teamMembers, p.overrideRate / 100, p.bonusRate / 100, p.gen2Rate / 100);
  const aumIncome = Math.round((p.aumExisting * (p.aumTrailPct / 100)) + (p.aumNew * (p.aumTrailPct / 100) * 0.5));
  const recSummary = calcAllTracksSummary(p.recruitTracks, p.overrideRate / 100);
  const chMetrics = calcChannelMetrics(p.channelSpend);

  const overrideInc = p.teamMembers.length > 0 ? teamOvr.total : recSummary.tOvr;
  const dashboard = calcDashboard({
    monthlyGDC: funnel.monthlyGDC, aumIncome, expIncome: funnel.expTarget / 12,
    overrideIncome: overrideInc, opEx: p.pnlOpEx, taxRate: p.pnlTaxRate / 100,
    recOvr: recSummary.tOvr, recYr2Ovr: recSummary.yr2Ovr, recARR: recSummary.recARR,
    recBooks: recSummary.tBooks, recHires: recSummary.tHires,
    aumTotal: p.aumExisting + p.aumNew,
    mktgSpend: chMetrics.tSpend, mktgRev: chMetrics.tRevMo,
    mktgLeads: chMetrics.tLeads, mktgClients: chMetrics.tClients,
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Revenue" value={fmtSm(dashboard.totalRev)} variant="gld" />
          <KPI label="EBITDA" value={fmtSm(dashboard.ebitda)} variant="grn" />
          <KPI label="Net Income" value={fmtSm(dashboard.netInc)} variant="grn" />
          <KPI label="Margin" value={dashboard.marginPct + '%'} variant="" />
          <KPI label="ARR" value={fmtSm(dashboard.arr)} variant="blu" />
          <KPI label="AUM" value={fmtSm(dashboard.aumTotal)} variant="" />
          <KPI label="Team" value={`${dashboard.recHires} hires`} variant="" />
          <KPI label="Yr2 Ovr" value={fmtSm(dashboard.recYr2Ovr)} variant="gld" />
        </div>

        {/* Production KPIs */}
        {p.streams.personal && rd.p === 1 && (
          <>
            <SectionHeader>Production KPIs (Monthly Targets)</SectionHeader>
            <DataTable
              headers={['KPI', 'Monthly Target', 'Weekly', 'Daily']}
              rows={[
                [<b key="ap">Approaches</b>, <span key="ma" className="text-green-400">{funnel.monthlyApproaches}</span>, Math.round(funnel.monthlyApproaches / 4.3), funnel.dailyApproaches],
                ['Appts Held', Math.round(funnel.held / p.months), Math.round(funnel.held / p.months / 4.3), '—'],
                [<b key="apps">Applications</b>, <span key="mapp" className="text-green-400">{funnel.monthlyApps}</span>, Math.round(funnel.monthlyApps / 4.3), '—'],
                ['Placed', Math.round(funnel.placed / p.months), Math.round(funnel.placed / p.months / 4.3), '—'],
                [<b key="gdc">GDC</b>, <span key="mg" className="text-green-400">{fmt(funnel.monthlyGDC)}</span>, '—', '—'],
                ['AUM Trail', fmt(Math.round(aumIncome / 12)), '—', '—'],
                ['Override', fmt(Math.round(overrideInc / 12)), '—', '—'],
              ]}
            />
          </>
        )}

        {/* Financial Metrics */}
        <SectionHeader>Financial & Operating Metrics</SectionHeader>
        <DataTable
          headers={['Metric', 'Value', 'Context']}
          rows={[
            [<b key="rev">Total Revenue</b>, <span key="rv" className="text-green-400">{fmt(dashboard.totalRev)}</span>, 'Personal GDC + AUM + Expanded + Override'],
            ['ARR (Recurring)', fmt(dashboard.arr), '~15% ins renewals + AUM trail + recruiting book trail'],
            [<b key="ebit">EBITDA</b>, <span key="ev" className={dashboard.ebitda >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(dashboard.ebitda)}</span>, `Revenue − OpEx (${fmt(p.pnlOpEx)})`],
            ['Margin %', `${dashboard.marginPct}%`, 'EBITDA ÷ Revenue'],
            [<b key="ni">Net Income</b>, <span key="nv" className={dashboard.netInc >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(dashboard.netInc)}</span>, `After ${p.pnlTaxRate}% tax`],
            ['', '', ''],
            [<b key="aum">Total AUM</b>, fmt(dashboard.aumTotal), 'Existing + new gathered'],
            ['AUM Trail Income', <span key="at" className="text-green-400">{fmt(aumIncome)}</span>, 'Compounds YoY at ~1% trail'],
            ['', '', ''],
            ['Team Size', String(dashboard.recHires), 'Across all recruiting tracks'],
            ['Yr1 Override', <span key="o1" className="text-green-400">{fmt(dashboard.recOvr)}</span>, 'Accounts for onboarding ramp'],
            ['Yr2 Override', <span key="o2" className="text-green-400">{fmt(dashboard.recYr2Ovr)}</span>, 'Full production, no ramp'],
            ['Transferred Books', fmt(dashboard.recBooks), 'AUM + policies from experienced hires'],
            ['Recruiting ARR', fmt(dashboard.recARR), 'Renewal on team FYC + trail on books'],
            ...(chMetrics.tSpend > 0 ? [
              ['', '', ''],
              ['Monthly Spend', fmt(chMetrics.tSpend), `${fmt(chMetrics.tSpend * 12)}/yr across channels`],
              ['Leads / Clients', `${chMetrics.tLeads} / ${chMetrics.tClients}`, 'From channel inputs'],
              ['Channel Rev/Mo', <span key="cr" className="text-green-400">{fmt(Math.round(chMetrics.tRevMo))}</span>, `ROI: ${chMetrics.roiPct}%`],
            ] as any[] : []),
          ]}
        />
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 8: P&L (Profit & Loss)
   ═══════════════════════════════════════════════════════════════ */
export function PnLPanel(p: PracticeProps) {
  const pnl = calcPnL(p.pnlLevel, p.pnlProducers, p.pnlAvgGDC, p.pnlPayoutRate / 100, p.pnlOpEx, p.pnlTaxRate / 100, p.pnlEbitGoal, p.pnlNetGoal);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary">P&L (Profit & Loss)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px] text-muted-foreground">Level</Label>
            <Select value={p.pnlLevel} onValueChange={v => p.setPnlLevel(v as 'ind' | 'team')}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ind">Individual</SelectItem>
                <SelectItem value="team">Team/Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {p.pnlLevel === 'team' && (
            <PInput label="# Producers" value={p.pnlProducers} onChange={v => p.setPnlProducers(+v || 1)} />
          )}
          <PInput label="Avg GDC/Producer" value={p.pnlAvgGDC} onChange={v => p.setPnlAvgGDC(+v || 0)} prefix="$" />
          <PInput label="Payout Rate %" value={p.pnlPayoutRate} onChange={v => p.setPnlPayoutRate(+v || 0)} suffix="%" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="OpEx ($)" value={p.pnlOpEx} onChange={v => p.setPnlOpEx(+v || 0)} prefix="$" />
          <PInput label="Tax Rate %" value={p.pnlTaxRate} onChange={v => p.setPnlTaxRate(+v || 0)} suffix="%" />
          <PInput label="EBITDA Goal ($)" value={p.pnlEbitGoal} onChange={v => p.setPnlEbitGoal(+v || 0)} prefix="$" />
          <PInput label="Net Income Goal ($)" value={p.pnlNetGoal} onChange={v => p.setPnlNetGoal(+v || 0)} prefix="$" />
        </div>

        {/* KPI Row */}
        <div className="flex flex-wrap gap-2">
          <KPI label="Revenue" value={fmtSm(pnl.revenue)} variant="gld" />
          <KPI label="GM%" value={`${pnl.gmPct}%`} variant="" />
          <KPI label="EBITDA" value={fmtSm(pnl.ebitda)} variant="grn" />
          <KPI label="Margin%" value={`${pnl.marginPct}%`} variant="" />
          <KPI label="Net" value={fmtSm(pnl.netIncome)} variant="grn" />
        </div>

        {/* P&L Table */}
        <DataTable
          headers={['Line', 'Annual', 'Monthly', '% Rev']}
          rows={[
            [<b key="rev">Revenue</b>, <span key="rv" className="text-green-400">{fmt(pnl.revenue)}</span>, fmt(Math.round(pnl.revenue / 12)), '100%'],
            [<span key="cogs" className="text-red-400">COGS (Payouts)</span>, <span key="cv" className="text-red-400">{fmt(pnl.cogs)}</span>, fmt(Math.round(pnl.cogs / 12)), pnl.revenue > 0 ? pct(pnl.cogs / pnl.revenue) : '—'],
            [<b key="gm">Gross Margin</b>, <span key="gv" className="text-green-400">{fmt(pnl.grossMargin)}</span>, fmt(Math.round(pnl.grossMargin / 12)), `${pnl.gmPct}%`],
            [<span key="opex" className="text-red-400">OpEx</span>, <span key="ov" className="text-red-400">{fmt(pnl.opEx)}</span>, fmt(Math.round(pnl.opEx / 12)), pnl.revenue > 0 ? pct(pnl.opEx / pnl.revenue) : '—'],
            [<b key="ebit">EBIT/EBITDA</b>, <span key="ev" className={pnl.ebitda >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(pnl.ebitda)}</span>, fmt(Math.round(pnl.ebitda / 12)), `${pnl.marginPct}%`],
            [`Tax (${p.pnlTaxRate}%)`, <span key="tv" className="text-red-400">{fmt(pnl.tax)}</span>, fmt(Math.round(pnl.tax / 12)), pnl.revenue > 0 ? pct(pnl.tax / pnl.revenue) : '—'],
            [<b key="ni">Net Income</b>, <span key="nv" className={pnl.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(pnl.netIncome)}</span>, fmt(Math.round(pnl.netIncome / 12)), pnl.revenue > 0 ? pct(pnl.netIncome / pnl.revenue) : '—'],
          ]}
        />

        {pnl.backPlanned && (
          <div className="text-[10px] text-primary bg-primary/5 border border-primary/20 rounded-md p-2">
            <b>Back-planned:</b> GDC auto-set to {fmt(pnl.avgGDC)} to hit {p.pnlNetGoal > 0 ? `net income ${fmt(p.pnlNetGoal)}` : `EBITDA ${fmt(p.pnlEbitGoal)}`}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
