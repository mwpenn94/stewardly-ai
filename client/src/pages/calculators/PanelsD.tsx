/* ═══════════════════════════════════════════════════════════════
   PanelsD — Practice Planning Panels (Business Income Engine)
   10 panels: My Plan, GDC Brackets, Products, Sales Funnel,
              Recruiting, Channels, Dashboard, P&L,
              Goal Tracker, Monthly Production
   ═══════════════════════════════════════════════════════════════ */
import { useState, useMemo } from 'react';
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
  SEASON_PROFILES, SEASON_LABELS,
  getBracket, calcWeightedGDC, calcProductionFunnel, calcTeamOverride,
  calcChannelMetrics, calcPnL, calcRollUp, calcDashboard, calcAllTracksSummary,
  calcTrackFunnel, blendSources, buildMonthlyProduction, calcGoalProgress,
  fmt, fmtSm, pct,
  type RoleId, type TeamMember, type RecruitTrack,
} from './practiceEngine';
import { KPI, RefTip } from './shared';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, Area, AreaChart,
} from 'recharts';

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
  /* Affiliate income inputs */
  affAIncome: number; setAffAIncome: (v: number) => void;
  affBIncome: number; setAffBIncome: (v: number) => void;
  affCIncome: number; setAffCIncome: (v: number) => void;
  affDIncome: number; setAffDIncome: (v: number) => void;
  /* Goal Tracker inputs */
  goalIncome: number; setGoalIncome: (v: number) => void;
  goalAUM: number; setGoalAUM: (v: number) => void;
  goalRecruits: number; setGoalRecruits: (v: number) => void;
  goalGDC: number; setGoalGDC: (v: number) => void;
  goalCases: number; setGoalCases: (v: number) => void;
  /* Seasonality inputs */
  seasonProfile: string; setSeasonProfile: (v: string) => void;
  customSeason: number[]; setCustomSeason: (v: number[]) => void;
  seasonGrowthRate: number; setSeasonGrowthRate: (v: number) => void;
  seasonHorizon: number; setSeasonHorizon: (v: number) => void;
  seasonRampMonths: number; setSeasonRampMonths: (v: number) => void;
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
    <div className={`overflow-x-auto -mx-2 px-2 ${className}`}>
      <table className="w-full text-xs border-collapse min-w-[400px]">
        <thead>
          <tr className="bg-muted/40 text-foreground/90">
            {headers.map((h, i) => (
              <th key={i} className={`px-2 py-1.5 font-semibold whitespace-nowrap ${i > 0 ? 'text-right' : 'text-left'}`}>{h}</th>
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
    aumIncome,
    affAIncome: p.affAIncome, affBIncome: p.affBIncome,
    affCIncome: p.affCIncome, affDIncome: p.affDIncome,
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="WB Platform %" value={p.wbPct} onChange={v => p.setWbPct(+v || 0)} suffix="%" />
          <div className="space-y-0.5">
            <Label className="text-[10px] font-medium text-muted-foreground">Payout Override</Label>
            <Select value={p.bracketOverride} onValueChange={p.setBracketOverride}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (by GDC)</SelectItem>
                {GDC_BRACKETS.map(b => (
                  <SelectItem key={String(b.r)} value={String(Math.round(b.r * 100))}>
                    {Math.round(b.r * 100)}% — {b.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <PInput label="AUM Existing ($)" value={p.aumExisting} onChange={v => p.setAumExisting(+v || 0)} prefix="$" />
          <PInput label="AUM New ($)" value={p.aumNew} onChange={v => p.setAumNew(+v || 0)} prefix="$" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <PInput label="AUM Trail %" value={p.aumTrailPct} onChange={v => p.setAumTrailPct(+v || 0)} suffix="%" />
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
            { key: 'affA', label: 'Affiliate A (Fee-Based)' },
            { key: 'affB', label: 'Affiliate B (Referral)' },
            { key: 'affC', label: 'Affiliate C (Co-Broker)' },
            { key: 'affD', label: 'Affiliate D (Wholesale)' },
          ].map(s => (
            <label key={s.key} className="flex items-center gap-1.5 text-[11px] cursor-pointer">
              <Checkbox checked={!!p.streams[s.key]}
                onCheckedChange={(c) => p.setStreams({ ...p.streams, [s.key]: !!c })} />
              {s.label}
            </label>
          ))}
        </div>

        {/* Affiliate Income Inputs (show when toggled) */}
        {(p.streams.affA || p.streams.affB || p.streams.affC || p.streams.affD) && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {p.streams.affA && <PInput label="Affiliate A Income" value={p.affAIncome} onChange={v => p.setAffAIncome(+v || 0)} prefix="$" />}
            {p.streams.affB && <PInput label="Affiliate B Income" value={p.affBIncome} onChange={v => p.setAffBIncome(+v || 0)} prefix="$" />}
            {p.streams.affC && <PInput label="Affiliate C Income" value={p.affCIncome} onChange={v => p.setAffCIncome(+v || 0)} prefix="$" />}
            {p.streams.affD && <PInput label="Affiliate D Income" value={p.affDIncome} onChange={v => p.setAffDIncome(+v || 0)} prefix="$" />}
          </div>
        )}

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
                ['Held', '—', Math.round(funnel.held / Math.max(1, p.months) / 4.3), Math.round(funnel.held / Math.max(1, p.months)), funnel.held],
                [<b key="apps">Apps</b>, '—', Math.round(funnel.monthlyApps / 4.3), funnel.monthlyApps, funnel.apps],
                ['Placed', '—', Math.round(funnel.placed / Math.max(1, p.months) / 4.3), Math.round(funnel.placed / Math.max(1, p.months)), funnel.placed],
                [<b key="gdc">GDC</b>, '—', '—', <span key="mg" className="text-green-400 font-semibold">{fmt(funnel.monthlyGDC)}</span>, <span key="ag" className="text-green-400 font-semibold">{fmt(funnel.gdcNeeded)}</span>],
              ]}
            />
          </>
        )}

        {/* Team Members (quick add/view) */}
        {p.streams.override && (
          <>
            <SectionHeader>Team Members ({p.teamMembers.length})</SectionHeader>
            <div className="space-y-2">
              {p.teamMembers.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <Input value={m.n} onChange={e => {
                    const next = [...p.teamMembers]; next[i] = { ...next[i], n: e.target.value }; p.setTeamMembers(next);
                  }} className="h-6 w-28 text-xs" placeholder="Name" />
                  <Select value={m.role} onValueChange={v => {
                    const next = [...p.teamMembers]; next[i] = { ...next[i], role: v as RoleId }; p.setTeamMembers(next);
                  }}>
                    <SelectTrigger className="h-6 w-24 text-[11px]"><SelectValue /></SelectTrigger>
                    <SelectContent>{HIER_ORDER.map(r => <SelectItem key={r} value={r}>{HIER_SHORT[r]}</SelectItem>)}</SelectContent>
                  </Select>
                  <PInput label="" value={m.f} onChange={v => {
                    const next = [...p.teamMembers]; next[i] = { ...next[i], f: +v || 0 }; p.setTeamMembers(next);
                  }} prefix="$" className="w-24" />
                  <Button variant="ghost" size="sm" className="h-6 text-red-400 text-[10px] px-1"
                    onClick={() => p.setTeamMembers(p.teamMembers.filter((_, j) => j !== i))}>✕</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="text-[11px] h-7"
                onClick={() => p.setTeamMembers([...p.teamMembers, { n: `Agent ${p.teamMembers.length + 1}`, f: 65000, role: 'new' }])}>
                + Add Team Member
              </Button>
              {p.teamMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  <KPI label="Team FYC" value={fmtSm(teamOvr.totalFYC)} variant="" />
                  <KPI label="Gen1 Ovr" value={fmtSm(teamOvr.gen1)} variant="grn" />
                  <KPI label="Gen2 Ovr" value={fmtSm(teamOvr.gen2)} variant="gld" />
                  <KPI label="Total Ovr" value={fmtSm(teamOvr.total)} variant="grn" />
                </div>
              )}
            </div>
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
  const [gdcInput, setGdcInput] = useState(() => p.targetGDC || 150000);
  const [teamSize, setTeamSize] = useState(5);
  const [teamAvgGDC, setTeamAvgGDC] = useState(100000);
  const bracket = getBracket(gdcInput);
  const takeHome = Math.round(gdcInput * bracket.r);
  const override = Math.round(teamSize * teamAvgGDC * (p.overrideRate / 100));
  const nextBracket = GDC_BRACKETS.find(b => b.mn > gdcInput);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-primary flex items-center gap-1">GDC Brackets<RefTip text="Commission brackets based on National Life Group 2026 schedules. FYC rates: IUL 90-110%, WL 55-80%, Term 80-100%." refId="commission" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

        {/* Override Rate Inputs */}
        <Separator />
        <SectionHeader>Override Settings</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <PInput label="Override Rate %" value={p.overrideRate} onChange={v => p.setOverrideRate(+v || 0)} suffix="%" />
          <PInput label="Bonus Rate %" value={p.bonusRate} onChange={v => p.setBonusRate(+v || 0)} suffix="%" />
          <PInput label="Gen2 Rate %" value={p.gen2Rate} onChange={v => p.setGen2Rate(+v || 0)} suffix="%" />
        </div>
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL 3: PRODUCTS & MIX
   ═══════════════════════════════════════════════════════════════ */
export function ProductsPanel(p: PracticeProps) {
  const [showExpanded, setShowExpanded] = useState(true);

  const totalMixPct = Object.values(p.productMix).reduce((a, b) => a + b, 0);
  const avgGDC = calcWeightedGDC(p.productMix, PRODUCTS);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">Products & Mix</span>
          <label className="flex items-center gap-1.5 text-[11px] cursor-pointer ml-auto font-normal">
            <Checkbox checked={showExpanded} onCheckedChange={c => setShowExpanded(!!c)} />
            Show Expanded/Specialty
          </label>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Product Mix Sliders */}
        <SectionHeader>Your Product Mix</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRODUCTS.filter(pr => showExpanded || pr.s === 'core').map(pr => (
            <PInput key={pr.id} label={pr.n} value={p.productMix[pr.id] || 0}
              onChange={v => p.setProductMix({ ...p.productMix, [pr.id]: Math.max(0, +v || 0) })} suffix="%" />
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={totalMixPct === 100 ? 'text-green-400' : 'text-red-400'}>
            Mix Total: {totalMixPct}%
          </span>
          {totalMixPct !== 100 && <span className="text-red-400/70 text-[10px]">(should be 100%)</span>}
          <span className="text-muted-foreground">Weighted Avg GDC/Case: <b className="text-foreground">{fmt(avgGDC)}</b></span>
        </div>

        <Separator />

        {/* Product Comparison Table */}
        <SectionHeader>Product Comparison — Commission Rates</SectionHeader>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-[11px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/40 text-foreground/90">
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
              {PRODUCTS.filter(pr => showExpanded || pr.s === 'core').flatMap((pr, idx, arr) => {
                const isWbBest = pr.wbRate >= pr.bestRate;
                const wbColor = isWbBest ? 'text-green-400' : pr.wbRate >= pr.bestRate * 0.85 ? 'text-yellow-400' : 'text-red-400';
                const prevSuite = idx > 0 ? arr[idx - 1].s : null;
                const nodes: React.JSX.Element[] = [];
                if (prevSuite !== pr.s) {
                  nodes.push(
                    <tr key={`sep-${pr.s}`}>
                      <td colSpan={8} className="bg-blue-500/5 font-bold text-[10px] uppercase tracking-wider px-2 py-1 border-t-2 border-blue-500/30">
                        {pr.s === 'core' ? 'Core Product Suite' : 'Expanded / Specialty'}
                      </td>
                    </tr>
                  );
                }
                nodes.push(
                  <tr key={pr.id} className="border-b border-border/20 hover:bg-card/50">
                    <td className="px-2 py-1 font-semibold whitespace-nowrap" title={pr.src}>{pr.n}</td>
                    <td className="px-2 py-1 text-right">{fmt(pr.gdc)}</td>
                    <td className="px-2 py-1 text-muted-foreground text-[10px]">{pr.wb}</td>
                    <td className={`px-2 py-1 text-center font-bold ${wbColor}`}>{pr.wbRate}%{isWbBest ? ' ★' : ''}</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.ind}%</td>
                    <td className="px-2 py-1 text-muted-foreground text-[10px]">{pr.best}</td>
                    <td className="px-2 py-1 text-center font-semibold">{pr.bestRate}%</td>
                    <td className="px-2 py-1 text-center text-muted-foreground">{pr.renew}</td>
                  </tr>
                );
                return nodes;
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
        <CardTitle className="text-base text-primary flex items-center gap-1">Sales Funnel<RefTip text="Conversion rates from LIMRA, Legacy Agent, and EverQuote research. Industry averages: approach-to-set 15-40%, held 65-85%, close 25-70%, place 60-85%." refId="funnel" /></CardTitle>
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
          ].map((step) => {
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

        {/* Activity Breakdown */}
        <Separator />
        <SectionHeader>Activity Breakdown</SectionHeader>
        <DataTable
          headers={['Metric', 'Annual', 'Monthly', 'Weekly', 'Daily']}
          rows={[
            ['Approaches', approaches, sfMo > 0 ? Math.round(approaches / sfMo) : 0, sfMo > 0 ? Math.round(approaches / sfMo / 4.3) : 0, daily],
            ['Appointments Set', set, sfMo > 0 ? Math.round(set / sfMo) : 0, sfMo > 0 ? Math.round(set / sfMo / 4.3) : 0, '—'],
            ['Appointments Held', held, sfMo > 0 ? Math.round(held / sfMo) : 0, sfMo > 0 ? Math.round(held / sfMo / 4.3) : 0, '—'],
            ['Applications', apps, sfMo > 0 ? Math.round(apps / sfMo) : 0, sfMo > 0 ? Math.round(apps / sfMo / 4.3) : 0, '—'],
            [<b key="pl">Policies Placed</b>, <span key="pv" className="text-green-400 font-bold">{sfPolicies}</span>, sfMo > 0 ? Math.round(sfPolicies / sfMo) : 0, sfMo > 0 ? Math.round(sfPolicies / sfMo / 4.3) : 0, '—'],
          ]}
        />
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
        <CardTitle className="text-base text-primary flex items-center gap-1">Recruiting<RefTip text="Override rates: 5-15% first-gen, 2-5% second-gen. Recruiting costs and retention from LIMRA Agent Compensation Study 2024." refId="recruiting" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Track Buttons */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(RECRUIT_LABELS).map(([k, label]) => (
            <Button key={k} variant="outline" size="sm" className="text-[11px] h-7"
              onClick={() => addTrack(k)}>+ {label}</Button>
          ))}
        </div>

        {p.recruitTracks.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            No recruiting tracks yet. Click a button above to add one.
          </div>
        )}

        {/* Track Cards */}
        {p.recruitTracks.map((track, idx) => {
          const funnel = calcTrackFunnel(track);
          const srcBlend = blendSources(track.src);
          const colors: Record<string, string> = { newAssoc: 'border-l-blue-500/50', expPro: 'border-l-purple-500', affiliate: 'border-l-cyan-500', md: 'border-l-primary' };

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
        <CardTitle className="text-base text-primary flex items-center gap-1">Marketing Channels<RefTip text="CPL benchmarks from FirstPageSage 2025: LinkedIn $75-180, Google $85-120, Facebook $50-90, SEO $45-75, Referrals $15-30." refId="marketing" /></CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Channel Input Table */}
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full text-[11px] border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-muted/40 text-foreground/90">
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
                    <td className="px-2 py-1 font-semibold whitespace-nowrap">{c.n}</td>
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
              <tr className="bg-primary/5 font-semibold border-t border-primary/20">
                <td className="px-2 py-1.5">TOTAL</td>
                <td className="px-2 py-1.5 text-right">{fmt(metrics.tSpend)}</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                <td className="px-2 py-1.5 text-right">{metrics.tLeads}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{metrics.tClients}</td>
                <td className="px-2 py-1.5 text-right text-green-400">{fmt(Math.round(metrics.tRevMo))}</td>
                <td className="px-2 py-1.5 text-right">{metrics.roiPct}%</td>
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
              [<b key="arr">ARR</b>, <span key="ar" className="text-green-400">{fmt(metrics.arr)}</span>, 'Annual rev × 85% retention', ''],
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
                ['Appts Held', Math.round(funnel.held / Math.max(1, p.months)), Math.round(funnel.held / Math.max(1, p.months) / 4.3), '—'],
                [<b key="apps">Applications</b>, <span key="mapp" className="text-green-400">{funnel.monthlyApps}</span>, Math.round(funnel.monthlyApps / 4.3), '—'],
                ['Placed', Math.round(funnel.placed / Math.max(1, p.months)), Math.round(funnel.placed / Math.max(1, p.months) / 4.3), '—'],
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
          ]}
        />

        {/* AUM Section */}
        {(p.aumExisting > 0 || p.aumNew > 0) && (
          <>
            <SectionHeader>AUM & Advisory</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                [<b key="aum">Total AUM</b>, fmt(dashboard.aumTotal), 'Existing + new gathered'],
                ['AUM Trail Income', <span key="at" className="text-green-400">{fmt(aumIncome)}</span>, `Compounds YoY at ${p.aumTrailPct}% trail`],
              ]}
            />
          </>
        )}

        {/* Recruiting Section */}
        {dashboard.recHires > 0 && (
          <>
            <SectionHeader>Recruiting & Team</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                ['Team Size', String(dashboard.recHires), 'Across all recruiting tracks'],
                ['Yr1 Override', <span key="o1" className="text-green-400">{fmt(dashboard.recOvr)}</span>, 'Accounts for onboarding ramp'],
                ['Yr2 Override', <span key="o2" className="text-green-400">{fmt(dashboard.recYr2Ovr)}</span>, 'Full production, no ramp'],
                ['Transferred Books', fmt(dashboard.recBooks), 'AUM + policies from experienced hires'],
                ['Recruiting ARR', fmt(dashboard.recARR), 'Renewal on team FYC + trail on books'],
              ]}
            />
          </>
        )}

        {/* Marketing Section */}
        {chMetrics.tSpend > 0 && (
          <>
            <SectionHeader>Marketing Channels</SectionHeader>
            <DataTable
              headers={['Metric', 'Value', 'Context']}
              rows={[
                ['Monthly Spend', fmt(chMetrics.tSpend), `${fmt(chMetrics.tSpend * 12)}/yr across channels`],
                ['Leads / Clients', `${chMetrics.tLeads} / ${chMetrics.tClients}`, 'From channel inputs'],
                ['Channel Rev/Mo', <span key="cr" className="text-green-400">{fmt(Math.round(chMetrics.tRevMo))}</span>, `ROI: ${chMetrics.roiPct}%`],
              ]}
            />
          </>
        )}

        {/* ═══ INTERACTIVE CHARTS ═══ */}
        <SectionHeader>Revenue Breakdown</SectionHeader>
        <DashboardCharts
          dashboard={dashboard}
          funnel={funnel}
          aumIncome={aumIncome}
          overrideInc={overrideInc}
          chMetrics={chMetrics}
          streams={p.streams}
          rd={rd}
          months={p.months}
          recruitTracks={p.recruitTracks}
          recSummary={recSummary}
          overrideRate={p.overrideRate / 100}
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
        <CardTitle className="text-base flex items-center gap-2">
          <span className="text-primary">P&L (Profit & Loss)</span>
          <Badge variant="outline" className="text-[10px]">{p.pnlLevel === 'ind' ? 'Individual' : 'Team/Agency'}</Badge>
          {pnl.backPlanned && <Badge variant="outline" className="text-[10px] text-primary">Back-Planned</Badge>}
        </CardTitle>
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


/* ═══════════════════════════════════════════════════════════════
   DASHBOARD CHARTS — Interactive Recharts visualizations
   ═══════════════════════════════════════════════════════════════ */
const CHART_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg p-2 shadow-lg text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color || entry.fill }}>
          {entry.name}: {fmtSm(entry.value)}
        </p>
      ))}
    </div>
  );
};

function DashboardCharts({ dashboard, funnel, aumIncome, overrideInc, chMetrics, streams, rd, months, recruitTracks, recSummary, overrideRate }: {
  dashboard: ReturnType<typeof calcDashboard>;
  funnel: ReturnType<typeof calcProductionFunnel>;
  aumIncome: number;
  overrideInc: number;
  chMetrics: ReturnType<typeof calcChannelMetrics>;
  streams: Record<string, boolean>;
  rd: { p: number };
  months: number;
  recruitTracks: RecruitTrack[];
  recSummary: ReturnType<typeof calcAllTracksSummary>;
  overrideRate: number;
}) {
  /* Revenue breakdown data for bar chart */
  const revData = [
    streams.personal && rd.p === 1 && funnel.wbTarget > 0 ? { name: 'Personal GDC', value: funnel.wbTarget } : null,
    streams.expanded && funnel.expTarget > 0 ? { name: 'Expanded', value: funnel.expTarget } : null,
    streams.aum && aumIncome > 0 ? { name: 'AUM Trail', value: aumIncome } : null,
    streams.override && overrideInc > 0 ? { name: 'Override', value: overrideInc } : null,
    streams.channels && chMetrics.tRevMo > 0 ? { name: 'Channels', value: Math.round(chMetrics.tRevMo * 12) } : null,
  ].filter(Boolean) as { name: string; value: number }[];

  /* P&L waterfall data */
  const waterfallData = [
    { name: 'Revenue', value: dashboard.totalRev },
    { name: 'OpEx', value: -dashboard.totalRev + dashboard.ebitda },
    { name: 'EBITDA', value: dashboard.ebitda },
    { name: 'Tax', value: -(dashboard.ebitda - dashboard.netInc) },
    { name: 'Net Income', value: dashboard.netInc },
  ];

  /* Funnel data for pie chart (monthly values) */
  const mo = months || 12;
  const funnelPieData = funnel.monthlyApproaches > 0 ? [
    { name: 'Approaches', value: funnel.monthlyApproaches },
    { name: 'Shows', value: Math.round(funnel.held / mo) },
    { name: 'Apps', value: funnel.monthlyApps },
    { name: 'Placed', value: Math.round(funnel.placed / mo) },
  ] : [];

  /* Channel ROI data */
  const channelROI = chMetrics.channelResults
    .filter(r => r.spend > 0)
    .map(r => ({ name: r.name, roi: r.roi, spend: r.spend, rev: r.annRev }))
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Revenue Breakdown Bar Chart */}
      {revData.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Annual Revenue by Stream</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Revenue" radius={[4, 4, 0, 0]}>
                {revData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* P&L Waterfall */}
      {dashboard.totalRev > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">P&L Waterfall</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={waterfallData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                {waterfallData.map((d, i) => (
                  <Cell key={i} fill={d.value >= 0 ? '#22c55e' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sales Funnel Pie */}
      {funnelPieData.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Monthly Sales Funnel</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={funnelPieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                outerRadius={80} innerRadius={40} paddingAngle={3} label={({ name, value }: any) => `${name}: ${value}`}>
                {funnelPieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recruiting Pipeline Chart */}
      {recruitTracks.length > 0 && recSummary.details.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Recruiting Pipeline — Override Income by Track</p>
          <ResponsiveContainer width="100%" height={Math.max(200, recSummary.details.length * 50 + 40)}>
            <BarChart
              data={recSummary.details.map(d => ({
                name: RECRUIT_LABELS[d.type] || d.type,
                hires: d.n,
                yr1Ovr: d.trackOvr,
                yr2Ovr: Math.round(d.n * d.f * overrideRate),
                trackFYC: d.trackFYC,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 90, bottom: 5 }}
            >
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${Math.round(v/1e3)}K` : `$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={85} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="yr1Ovr" name="Yr1 Override" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              <Bar dataKey="yr2Ovr" name="Yr2 Override" fill="#22c55e" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {/* Recruiting funnel summary */}
          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Total Hires</p>
              <p className="text-sm font-bold text-foreground">{recSummary.tHires}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Team FYC</p>
              <p className="text-sm font-bold text-green-400">{fmtSm(recSummary.tFYC)}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Rec EBITDA</p>
              <p className={`text-sm font-bold ${recSummary.recEBITDA >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmtSm(recSummary.recEBITDA)}</p>
            </div>
            <div className="text-center p-1.5 bg-muted/30 rounded">
              <p className="text-[10px] text-muted-foreground">Books Transferred</p>
              <p className="text-sm font-bold text-foreground">{fmtSm(recSummary.tBooks)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Channel ROI Comparison */}
      {channelROI.length > 0 && (
        <div className="bg-background/50 rounded-lg p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase">Channel ROI Comparison</p>
          <ResponsiveContainer width="100%" height={Math.max(180, channelROI.length * 32)}>
            <BarChart data={channelROI} layout="vertical" margin={{ top: 5, right: 10, left: 80, bottom: 5 }}>
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={75} />
              <Tooltip formatter={(v: number) => [`${v.toFixed(0)}%`, 'ROI']} contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="roi" name="ROI %" radius={[0, 4, 4, 0]}>
                {channelROI.map((d, i) => (
                  <Cell key={i} fill={d.roi >= 300 ? '#22c55e' : d.roi >= 100 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════
   GOAL TRACKER PANEL
   ═══════════════════════════════════════════════════════════════ */
export function GoalTrackerPanel(p: PracticeProps) {
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
    role: p.role, hasPersonal: rd.p === 1, wbTarget: funnel.wbTarget, expTarget: funnel.expTarget,
    overrideIncome: overrideInc, overrideRate: p.overrideRate / 100, aumIncome,
    affAIncome: p.affAIncome, affBIncome: p.affBIncome, affCIncome: p.affCIncome, affDIncome: p.affDIncome,
    channelRevAnnual: Math.round(chMetrics.tRevMo * 12), streams: p.streams,
  });

  // Compute "current" values from the engine
  const currentIncome = rollUp.grandTotal;
  const currentAUM = p.aumExisting + p.aumNew;
  const currentRecruits = recSummary.tHires;
  const currentGDC = funnel.gdcNeeded;
  const currentCases = funnel.placed;

  const progress = calcGoalProgress({
    incomeGoal: p.goalIncome, currentIncome,
    aumGoal: p.goalAUM, currentAUM,
    recruitGoal: p.goalRecruits, currentRecruits,
    gdcGoal: p.goalGDC, currentGDC,
    casesGoal: p.goalCases, currentCases,
  });

  const getColor = (pct: number) => pct >= 100 ? 'bg-green-500' : pct >= 75 ? 'bg-primary' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const getTextColor = (pct: number) => pct >= 100 ? 'text-green-400' : pct >= 75 ? 'text-primary' : pct >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
          <span>Goal Tracker</span>
          <Badge variant="outline" className={`text-xs ${getTextColor(progress.overallPct)}`}>
            {progress.overallPct}% Overall
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress Ring */}
        <div className="flex items-center gap-4 bg-muted/30 rounded-lg p-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={progress.overallPct >= 100 ? '#22c55e' : progress.overallPct >= 75 ? 'hsl(var(--primary))' : progress.overallPct >= 50 ? '#f59e0b' : '#ef4444'}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(progress.overallPct / 100) * 213.6} 213.6`} />
            </svg>
            <span className={`absolute inset-0 flex items-center justify-center text-sm font-bold ${getTextColor(progress.overallPct)}`}>
              {progress.overallPct}%
            </span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">
              {progress.overallPct >= 100 ? 'All Goals Achieved!' : progress.overallPct >= 75 ? 'Almost There!' : progress.overallPct >= 50 ? 'Making Progress' : 'Getting Started'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {progress.goals.filter(g => g.pct >= 100).length} of {progress.goals.length} goals met
            </p>
          </div>
        </div>

        {/* Goal Setting Inputs */}
        <SectionHeader>Set Your Goals</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <PInput label="Income Goal" value={p.goalIncome} onChange={v => p.setGoalIncome(+v || 0)} prefix="$" />
          <PInput label="GDC Goal" value={p.goalGDC} onChange={v => p.setGoalGDC(+v || 0)} prefix="$" />
          <PInput label="AUM Goal" value={p.goalAUM} onChange={v => p.setGoalAUM(+v || 0)} prefix="$" />
          <PInput label="Recruit Goal" value={p.goalRecruits} onChange={v => p.setGoalRecruits(+v || 0)} />
          <PInput label="Cases Goal" value={p.goalCases} onChange={v => p.setGoalCases(+v || 0)} />
        </div>

        {/* Individual Goal Progress Bars */}
        {progress.goals.length > 0 && (
          <>
            <SectionHeader>Progress</SectionHeader>
            <div className="space-y-3">
              {progress.goals.map(g => (
                <div key={g.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{g.label}</span>
                    <span className={`font-bold ${getTextColor(g.pct)}`}>
                      {g.pct}% — {g.format === 'dollar' ? fmt(g.current) : g.current} / {g.format === 'dollar' ? fmt(g.goal) : g.goal}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${getColor(g.pct)}`}
                      style={{ width: `${Math.min(100, g.pct)}%` }} />
                  </div>
                  {g.remaining > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {g.format === 'dollar' ? fmt(g.remaining) : g.remaining} remaining to goal
                    </p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Goal Breakdown Chart */}
        {progress.goals.length > 0 && (
          <>
            <SectionHeader>Goal Completion Chart</SectionHeader>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={progress.goals.map(g => ({ name: g.label.split(' ')[0], pct: g.pct, goal: 100 }))}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                  domain={[0, 120]} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'Progress']}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="pct" name="Progress" radius={[4, 4, 0, 0]}>
                  {progress.goals.map((g, i) => (
                    <Cell key={i} fill={g.pct >= 100 ? '#22c55e' : g.pct >= 75 ? 'hsl(var(--primary))' : g.pct >= 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </>
        )}

        {progress.goals.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">Set at least one goal above to track your progress.</p>
            <p className="text-xs mt-1">Goals are computed from your Practice Planning inputs.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MONTHLY PRODUCTION PANEL (Seasonality)
   ═══════════════════════════════════════════════════════════════ */
export function MonthlyProductionPanel(p: PracticeProps) {
  const [selectedYear, setSelectedYear] = useState(1);

  const bracket = getBracket(p.targetGDC);
  const payoutRate = p.bracketOverride !== 'auto' ? parseFloat(p.bracketOverride) / 100 : bracket.r;

  const production = useMemo(() => buildMonthlyProduction({
    annualGDC: p.targetGDC,
    seasonProfile: p.seasonProfile,
    customSeason: p.customSeason,
    horizonYears: p.seasonHorizon,
    growthRate: p.seasonGrowthRate / 100,
    bracketRate: payoutRate,
    rampMonths: p.seasonRampMonths,
    rampPct: 0.3,
  }), [p.targetGDC, p.seasonProfile, p.customSeason, p.seasonHorizon, p.seasonGrowthRate, payoutRate, p.seasonRampMonths]);

  const currentYearData = production.years.find(y => y.year === selectedYear) || production.years[0];
  const profileMults = (p.seasonProfile === 'custom' && p.customSeason?.length === 12)
    ? p.customSeason
    : (SEASON_PROFILES[p.seasonProfile] || SEASON_PROFILES.flat);

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
          <span>Monthly Production Plan</span>
          <Badge variant="outline" className="text-xs">{production.profileName}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seasonality Profile Selection */}
        <SectionHeader>Seasonality Profile</SectionHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="space-y-0.5">
            <Label className="text-[10px] font-medium text-muted-foreground">Profile</Label>
            <Select value={p.seasonProfile} onValueChange={v => p.setSeasonProfile(v)}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SEASON_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <PInput label="Growth Rate" value={p.seasonGrowthRate} onChange={v => p.setSeasonGrowthRate(+v || 0)} suffix="%" />
          <PInput label="Horizon (Years)" value={p.seasonHorizon} onChange={v => p.setSeasonHorizon(Math.max(1, Math.min(10, +v || 1)))} />
          <PInput label="Ramp Months (Yr1)" value={p.seasonRampMonths} onChange={v => p.setSeasonRampMonths(Math.max(0, Math.min(12, +v || 0)))} />
        </div>

        {/* Custom Multipliers */}
        {p.seasonProfile === 'custom' && (
          <>
            <SectionHeader>Custom Monthly Multipliers</SectionHeader>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                <PInput key={m} label={m} value={p.customSeason[i] ?? 1}
                  onChange={v => {
                    const next = [...p.customSeason];
                    next[i] = Math.max(0, parseFloat(v) || 0);
                    p.setCustomSeason(next);
                  }} suffix="×" />
              ))}
            </div>
          </>
        )}

        {/* Seasonality Curve Visualization */}
        <SectionHeader>Seasonality Curve</SectionHeader>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={profileMults.map((m, i) => ({ name: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i], mult: m }))}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
              domain={[0, 'auto']} tickFormatter={(v: number) => `${v}×`} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)}×`, 'Multiplier']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
            <Area type="monotone" dataKey="mult" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>

        {/* Year Selector */}
        {production.years.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            {production.years.map(y => (
              <Button key={y.year} variant={selectedYear === y.year ? 'default' : 'outline'} size="sm"
                className="text-xs h-7" onClick={() => setSelectedYear(y.year)}>
                Year {y.year}
              </Button>
            ))}
          </div>
        )}

        {/* Monthly Production Table */}
        <SectionHeader>Year {selectedYear} — Monthly Breakdown</SectionHeader>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <KPI label="Annual GDC" value={fmt(currentYearData?.annGDC || 0)} />
          <KPI label="Annual Income" value={fmt(currentYearData?.annIncome || 0)} />
          <KPI label="Avg Monthly" value={fmt(Math.round((currentYearData?.annGDC || 0) / 12))} />
        </div>

        <DataTable
          headers={['Month', 'Multiplier', 'GDC', 'Income', 'Cum. GDC']}
          rows={(() => {
            let cumGDC = 0;
            return (currentYearData?.months || []).map(m => {
              cumGDC += m.gdc;
              return [m.name, `${m.mult.toFixed(2)}×`, fmt(m.gdc), fmt(m.income), fmt(cumGDC)];
            });
          })()}
        />

        {/* Monthly GDC Bar Chart */}
        <SectionHeader>Monthly GDC — Year {selectedYear}</SectionHeader>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={currentYearData?.months || []} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => fmtSm(v)} />
            <Tooltip formatter={(v: number) => [fmt(v), 'GDC']}
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
            <Bar dataKey="gdc" name="GDC" radius={[4, 4, 0, 0]}>
              {(currentYearData?.months || []).map((m, i) => (
                <Cell key={i} fill={m.mult >= 1.2 ? '#22c55e' : m.mult >= 0.9 ? 'hsl(var(--primary))' : m.mult >= 0.7 ? '#f59e0b' : '#ef4444'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Multi-Year Projection */}
        {production.years.length > 1 && (
          <>
            <SectionHeader>Multi-Year Projection</SectionHeader>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={production.years.map(y => ({ name: `Yr ${y.year}`, gdc: y.annGDC, income: y.annIncome }))}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => fmtSm(v)} />
                <Tooltip formatter={(v: number) => [fmt(v)]}
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                <Line type="monotone" dataKey="gdc" name="GDC" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
              </LineChart>
            </ResponsiveContainer>

            <DataTable
              headers={['Year', 'Annual GDC', 'Annual Income', 'Growth']}
              rows={production.years.map((y, i) => [
                `Year ${y.year}`,
                fmt(y.annGDC),
                fmt(y.annIncome),
                i === 0 ? '—' : `+${pct((y.annGDC - production.years[i-1].annGDC) / production.years[i-1].annGDC)}`,
              ])}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
