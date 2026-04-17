import { fmt, pct } from './format';
/* ═══ PanelsH — Domain A: Practice Management Strategy Surfaces ═══ */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, TrendingDown, Minus, Target, BarChart3, PieChart, DollarSign, Plus, Trash2, Users, Layers } from 'lucide-react';
import {
  calcProductionOptimization, MDRT_BENCHMARKS, TOP_10_BENCHMARKS,
  calcChannelDiversification, type ChannelMix,
  calcMarketingROI, DEFAULT_CAMPAIGNS, type Campaign,
  calcRecruitingFunnel,
  calcPnLBusinessEconomics,
  calcGDCOverrideOpt,
} from './domainAEngine';
;

/* ─── Shared helpers ─── */
const N = (props: { label: string; value: number; onChange: (v: number) => void; prefix?: string; suffix?: string; min?: number; max?: number; step?: number }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{props.label}</Label>
    <div className="relative">
      {props.prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{props.prefix}</span>}
      <Input type="number" className={`h-8 text-sm ${props.prefix ? 'pl-6' : ''} ${props.suffix ? 'pr-8' : ''}`}
        value={props.value} min={props.min ?? 0} max={props.max} step={props.step ?? 1}
        onChange={e => props.onChange(Number(e.target.value) || 0)} />
      {props.suffix && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{props.suffix}</span>}
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: 'below' | 'at' | 'above' }) => {
  if (status === 'above') return <Badge className="bg-emerald-500/20 text-emerald-400 text-xs"><TrendingUp className="w-3 h-3 mr-1" />Above</Badge>;
  if (status === 'at') return <Badge className="bg-amber-500/20 text-amber-400 text-xs"><Minus className="w-3 h-3 mr-1" />At Benchmark</Badge>;
  return <Badge className="bg-red-500/20 text-red-400 text-xs"><TrendingDown className="w-3 h-3 mr-1" />Below</Badge>;
};

/* ═══════════════════════════════════════════════════════════════
   Production Optimization Panel
   ═══════════════════════════════════════════════════════════════ */
export function ProductionOptPanel() {
  const [prospectingHrs, setProspectingHrs] = useState(12);
  const [meetingHrs, setMeetingHrs] = useState(10);
  const [adminHrs, setAdminHrs] = useState(8);
  const [learningHrs, setLearningHrs] = useState(4);
  const [networkingHrs, setNetworkingHrs] = useState(4);
  const [callTarget, setCallTarget] = useState(40);
  const [meetingTarget, setMeetingTarget] = useState(10);
  const [proposalTarget, setProposalTarget] = useState(5);
  const [closeTarget, setCloseTarget] = useState(4);
  const [avgRevPerClose, setAvgRevPerClose] = useState(5000);
  const [callToMeeting, setCallToMeeting] = useState(0.30);
  const [meetingToProposal, setMeetingToProposal] = useState(0.50);
  const [proposalToClose, setProposalToClose] = useState(0.50);

  const result = useMemo(() => calcProductionOptimization(
    prospectingHrs, meetingHrs, adminHrs, learningHrs, networkingHrs,
    callTarget, meetingTarget, proposalTarget, closeTarget, avgRevPerClose,
    callToMeeting, meetingToProposal, proposalToClose
  ), [prospectingHrs, meetingHrs, adminHrs, learningHrs, networkingHrs,
    callTarget, meetingTarget, proposalTarget, closeTarget, avgRevPerClose,
    callToMeeting, meetingToProposal, proposalToClose]);

  const totalHrs = result.weeklyStructure.totalHours;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-5 h-5 text-amber-400" />
            Production Optimization
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Model your weekly structure, pipeline metrics, and activity targets against MDRT and top-10% benchmarks.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Weekly Time Allocation */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Weekly Time Allocation ({totalHrs}h total)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <N label="Prospecting" value={prospectingHrs} onChange={setProspectingHrs} suffix="hrs" />
              <N label="Meetings" value={meetingHrs} onChange={setMeetingHrs} suffix="hrs" />
              <N label="Admin" value={adminHrs} onChange={setAdminHrs} suffix="hrs" />
              <N label="Learning" value={learningHrs} onChange={setLearningHrs} suffix="hrs" />
              <N label="Networking" value={networkingHrs} onChange={setNetworkingHrs} suffix="hrs" />
            </div>
            {/* Visual bar */}
            <div className="mt-3 h-4 rounded-full overflow-hidden flex bg-muted">
              {totalHrs > 0 && <>
                <div className="bg-blue-500 transition-all" style={{ width: `${(prospectingHrs / totalHrs) * 100}%` }} title={`Prospecting ${((prospectingHrs / totalHrs) * 100).toFixed(0)}%`} />
                <div className="bg-emerald-500 transition-all" style={{ width: `${(meetingHrs / totalHrs) * 100}%` }} title={`Meetings ${((meetingHrs / totalHrs) * 100).toFixed(0)}%`} />
                <div className="bg-amber-500 transition-all" style={{ width: `${(adminHrs / totalHrs) * 100}%` }} title={`Admin ${((adminHrs / totalHrs) * 100).toFixed(0)}%`} />
                <div className="bg-purple-500 transition-all" style={{ width: `${(learningHrs / totalHrs) * 100}%` }} title={`Learning ${((learningHrs / totalHrs) * 100).toFixed(0)}%`} />
                <div className="bg-pink-500 transition-all" style={{ width: `${(networkingHrs / totalHrs) * 100}%` }} title={`Networking ${((networkingHrs / totalHrs) * 100).toFixed(0)}%`} />
              </>}
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />Prospecting</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Meetings</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Admin</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" />Learning</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-500" />Networking</span>
            </div>
          </div>

          {/* Activity Targets */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Activity Targets</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <N label="Weekly Calls" value={callTarget} onChange={setCallTarget} />
              <N label="Weekly Meetings" value={meetingTarget} onChange={setMeetingTarget} />
              <N label="Weekly Proposals" value={proposalTarget} onChange={setProposalTarget} />
              <N label="Monthly Closes" value={closeTarget} onChange={setCloseTarget} />
              <N label="Avg Rev/Close" value={avgRevPerClose} onChange={setAvgRevPerClose} prefix="$" />
            </div>
          </div>

          {/* Conversion Rates */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Conversion Rates</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <N label="Call → Meeting" value={Math.round(callToMeeting * 100)} onChange={v => setCallToMeeting(v / 100)} suffix="%" min={0} max={100} />
              <N label="Meeting → Proposal" value={Math.round(meetingToProposal * 100)} onChange={v => setMeetingToProposal(v / 100)} suffix="%" min={0} max={100} />
              <N label="Proposal → Close" value={Math.round(proposalToClose * 100)} onChange={v => setProposalToClose(v / 100)} suffix="%" min={0} max={100} />
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Monthly GDC</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.projectedMonthlyGDC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Annual GDC</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.projectedAnnualGDC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Efficiency Score</div>
              <div className={`text-lg font-bold ${result.efficiencyScore >= 70 ? 'text-emerald-400' : result.efficiencyScore >= 50 ? 'text-amber-400' : 'text-red-400'}`}>{result.efficiencyScore}/100</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">vs MDRT</div>
              <div className={`text-lg font-bold ${result.projectedAnnualGDC >= MDRT_BENCHMARKS.annualGDC ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.projectedAnnualGDC >= MDRT_BENCHMARKS.annualGDC ? '✓ Qualifying' : `${fmt(MDRT_BENCHMARKS.annualGDC - result.projectedAnnualGDC)} gap`}
              </div>
            </CardContent></Card>
          </div>

          {/* Benchmark Comparison Table */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Benchmark Comparison</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Yours</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">MDRT Avg</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Top 10%</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {result.benchmarkComparison.map(b => (
                    <tr key={b.metric} className="border-b border-border/50">
                      <td className="py-2">{b.metric}</td>
                      <td className="text-right font-mono">{b.metric.includes('GDC') || b.metric.includes('Rev') ? fmt(b.yours) : b.yours.toLocaleString()}</td>
                      <td className="text-right font-mono text-muted-foreground">{b.metric.includes('GDC') || b.metric.includes('Rev') ? fmt(b.mdrtAvg) : b.mdrtAvg.toLocaleString()}</td>
                      <td className="text-right font-mono text-muted-foreground">{b.metric.includes('GDC') || b.metric.includes('Rev') ? fmt(b.top10Pct) : b.top10Pct.toLocaleString()}</td>
                      <td className="text-right"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Channel Diversification Panel
   ═══════════════════════════════════════════════════════════════ */
export function ChannelDiversPanel() {
  const [insuranceGDC, setInsuranceGDC] = useState(80000);
  const [aumFees, setAumFees] = useState(40000);
  const [affiliateIncome, setAffiliateIncome] = useState(15000);
  const [customChannelIncome, setCustomChannelIncome] = useState(0);
  const [teamOverrides, setTeamOverrides] = useState(20000);
  const [gdcRetainedPct, setGdcRetainedPct] = useState(75);

  const result = useMemo(() => calcChannelDiversification(
    { insuranceGDC, aumFees, affiliateIncome, customChannelIncome, teamOverrides },
    gdcRetainedPct
  ), [insuranceGDC, aumFees, affiliateIncome, customChannelIncome, teamOverrides, gdcRetainedPct]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChart className="w-5 h-5 text-blue-400" />
            Channel Diversification
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Model your revenue mix across insurance, AUM/advisory, affiliate, and team override channels. Analyze concentration risk and optimization opportunities.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Channel Inputs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <N label="Insurance GDC" value={insuranceGDC} onChange={setInsuranceGDC} prefix="$" />
            <N label="AUM/Advisory Fees" value={aumFees} onChange={setAumFees} prefix="$" />
            <N label="Affiliate/Referral" value={affiliateIncome} onChange={setAffiliateIncome} prefix="$" />
            <N label="Custom Channel" value={customChannelIncome} onChange={setCustomChannelIncome} prefix="$" />
            <N label="Team Overrides" value={teamOverrides} onChange={setTeamOverrides} prefix="$" />
            <N label="GDC Retained" value={gdcRetainedPct} onChange={setGdcRetainedPct} suffix="%" min={0} max={100} />
          </div>

          {/* Results Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total GDC</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.totalGDC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Effective Payout</div>
              <div className="text-lg font-bold text-blue-400">{fmt(result.effectivePayout)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Override Impact</div>
              <div className="text-lg font-bold text-amber-400">{fmt(result.overrideImpact)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Concentration Risk</div>
              <div className={`text-lg font-bold ${result.concentrationRisk === 'low' ? 'text-emerald-400' : result.concentrationRisk === 'medium' ? 'text-amber-400' : 'text-red-400'}`}>
                {result.concentrationRisk.charAt(0).toUpperCase() + result.concentrationRisk.slice(1)}
              </div>
            </CardContent></Card>
          </div>

          {/* Channel Breakdown Visual */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Revenue Mix</h4>
            <div className="h-6 rounded-full overflow-hidden flex bg-muted">
              {result.channelBreakdown.map(c => (
                <div key={c.name} className="transition-all" style={{ width: `${c.pct * 100}%`, backgroundColor: c.color }}
                  title={`${c.name}: ${fmt(c.amount)} (${(c.pct * 100).toFixed(1)}%)`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-4 mt-2">
              {result.channelBreakdown.map(c => (
                <div key={c.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                  <span>{c.name}: {fmt(c.amount)} ({(c.pct * 100).toFixed(1)}%)</span>
                </div>
              ))}
            </div>
          </div>

          {/* HHI Index */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">Herfindahl-Hirschman Index (HHI)</span>
              <span className="font-mono text-sm">{result.herfindahlIndex.toFixed(3)}</span>
            </div>
            <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden">
              <div className={`h-full transition-all ${result.herfindahlIndex > 0.6 ? 'bg-red-500' : result.herfindahlIndex > 0.35 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${result.herfindahlIndex * 100}%` }} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Diversified (0.0)</span><span>Concentrated (1.0)</span>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-400 mb-2">Strategy Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-blue-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Marketing / Acquisition ROI Panel
   ═══════════════════════════════════════════════════════════════ */
export function MarketingROIPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEFAULT_CAMPAIGNS);

  const result = useMemo(() => calcMarketingROI(campaigns), [campaigns]);

  const updateCampaign = (id: string, field: keyof Campaign, value: string | number) => {
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const addCampaign = () => {
    const id = String(Date.now());
    setCampaigns(prev => [...prev, { id, name: 'New Campaign', type: 'other', monthlyCost: 1000, leadsPerMonth: 5, conversionRate: 0.10, avgRevenuePerClient: 5000, avgLTV: 25000 }]);
  };

  const removeCampaign = (id: string) => {
    setCampaigns(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
            Marketing / Acquisition ROI
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Model campaign costs vs revenue, calculate CAC, LTV, ROI, and payback period for each marketing channel. Identify your highest-performing channels.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Monthly Spend</div>
              <div className="text-lg font-bold text-red-400">{fmt(result.totalMonthlyCost)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Monthly Revenue</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.totalMonthlyRevenue)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Blended CAC</div>
              <div className="text-lg font-bold text-amber-400">{fmt(result.blendedCAC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">LTV:CAC Ratio</div>
              <div className={`text-lg font-bold ${result.blendedLTV / result.blendedCAC >= 3 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {result.blendedCAC > 0 ? `${(result.blendedLTV / result.blendedCAC).toFixed(1)}:1` : '—'}
              </div>
            </CardContent></Card>
          </div>

          {/* Campaign Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-medium">Campaign</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Cost/mo</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Leads/mo</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Conv %</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Rev/Client</th>
                <th className="text-right py-2 text-muted-foreground font-medium">CAC</th>
                <th className="text-right py-2 text-muted-foreground font-medium">LTV</th>
                <th className="text-right py-2 text-muted-foreground font-medium">ROI</th>
                <th className="text-right py-2 text-muted-foreground font-medium">Payback</th>
                <th className="w-8"></th>
              </tr></thead>
              <tbody>
                {result.campaigns.map(c => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2">
                      <Input className="h-7 text-sm w-32" value={c.name}
                        onChange={e => updateCampaign(c.id, 'name', e.target.value)} />
                    </td>
                    <td className="text-right">
                      <Input type="number" className="h-7 text-sm w-20 text-right ml-auto" value={c.monthlyCost}
                        onChange={e => updateCampaign(c.id, 'monthlyCost', Number(e.target.value) || 0)} />
                    </td>
                    <td className="text-right">
                      <Input type="number" className="h-7 text-sm w-16 text-right ml-auto" value={c.leadsPerMonth}
                        onChange={e => updateCampaign(c.id, 'leadsPerMonth', Number(e.target.value) || 0)} />
                    </td>
                    <td className="text-right">
                      <Input type="number" className="h-7 text-sm w-16 text-right ml-auto" value={Math.round(c.conversionRate * 100)}
                        onChange={e => updateCampaign(c.id, 'conversionRate', (Number(e.target.value) || 0) / 100)} />
                    </td>
                    <td className="text-right">
                      <Input type="number" className="h-7 text-sm w-20 text-right ml-auto" value={c.avgRevenuePerClient}
                        onChange={e => updateCampaign(c.id, 'avgRevenuePerClient', Number(e.target.value) || 0)} />
                    </td>
                    <td className="text-right font-mono">{isFinite(c.cac) ? fmt(c.cac) : '—'}</td>
                    <td className="text-right font-mono">{fmt(c.ltv)}</td>
                    <td className="text-right">
                      <span className={`font-mono ${c.monthlyROI >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(c.monthlyROI * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-right font-mono text-muted-foreground">
                      {c.paybackMonths < 999 ? `${c.paybackMonths}mo` : '—'}
                    </td>
                    <td>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCampaign(c.id)} aria-label="Remove campaign">
                        <Trash2 className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button variant="outline" size="sm" onClick={addCampaign} className="gap-1">
            <Plus className="w-3 h-3" /> Add Campaign
          </Button>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">Optimization Insights</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Recruiting Funnel Strategy Panel
   ═══════════════════════════════════════════════════════════════ */
export function RecruitingFunnelPanel() {
  const [identifyCount, setIdentifyCount] = useState(100);
  const [outreachRate, setOutreachRate] = useState(0.60);
  const [interviewRate, setInterviewRate] = useState(0.35);
  const [offerRate, setOfferRate] = useState(0.45);
  const [onboardRate, setOnboardRate] = useState(0.70);
  const [productiveRate, setProductiveRate] = useState(0.65);
  const [costPerIdentify, setCostPerIdentify] = useState(50);
  const [costPerOutreach, setCostPerOutreach] = useState(100);
  const [costPerInterview, setCostPerInterview] = useState(200);
  const [costPerOffer, setCostPerOffer] = useState(500);
  const [costPerOnboard, setCostPerOnboard] = useState(2000);
  const [rampMonths, setRampMonths] = useState(6);
  const [avgFYCPerHire, setAvgFYCPerHire] = useState(65000);
  const [overrideRate, setOverrideRate] = useState(0.10);
  const [retentionYears, setRetentionYears] = useState(5);

  const result = useMemo(() => calcRecruitingFunnel(
    identifyCount, outreachRate, interviewRate, offerRate, onboardRate, productiveRate,
    costPerIdentify, costPerOutreach, costPerInterview, costPerOffer, costPerOnboard,
    rampMonths, avgFYCPerHire, overrideRate, retentionYears
  ), [identifyCount, outreachRate, interviewRate, offerRate, onboardRate, productiveRate,
    costPerIdentify, costPerOutreach, costPerInterview, costPerOffer, costPerOnboard,
    rampMonths, avgFYCPerHire, overrideRate, retentionYears]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-purple-400" />
            Recruiting Funnel Strategy
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Model your full recruiting pipeline from identification through productive ramp. Track conversion rates, CAC, LTV, and break-even at each stage. Benchmarks from LIMRA, GAMA, and industry research.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pipeline Inputs */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Pipeline Volume & Conversion Rates</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <N label="Identify (prospects)" value={identifyCount} onChange={setIdentifyCount} />
              <N label="→ Outreach %" value={Math.round(outreachRate * 100)} onChange={v => setOutreachRate(v / 100)} suffix="%" min={0} max={100} />
              <N label="→ Interview %" value={Math.round(interviewRate * 100)} onChange={v => setInterviewRate(v / 100)} suffix="%" min={0} max={100} />
              <N label="→ Offer %" value={Math.round(offerRate * 100)} onChange={v => setOfferRate(v / 100)} suffix="%" min={0} max={100} />
              <N label="→ Onboard %" value={Math.round(onboardRate * 100)} onChange={v => setOnboardRate(v / 100)} suffix="%" min={0} max={100} />
              <N label="→ Productive %" value={Math.round(productiveRate * 100)} onChange={v => setProductiveRate(v / 100)} suffix="%" min={0} max={100} />
            </div>
          </div>

          {/* Cost Inputs */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Cost per Stage</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <N label="$/Identify" value={costPerIdentify} onChange={setCostPerIdentify} prefix="$" />
              <N label="$/Outreach" value={costPerOutreach} onChange={setCostPerOutreach} prefix="$" />
              <N label="$/Interview" value={costPerInterview} onChange={setCostPerInterview} prefix="$" />
              <N label="$/Offer" value={costPerOffer} onChange={setCostPerOffer} prefix="$" />
              <N label="$/Onboard" value={costPerOnboard} onChange={setCostPerOnboard} prefix="$" />
            </div>
          </div>

          {/* Economics Inputs */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Unit Economics</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <N label="Ramp (months)" value={rampMonths} onChange={setRampMonths} min={1} max={24} />
              <N label="Avg FYC/Hire" value={avgFYCPerHire} onChange={setAvgFYCPerHire} prefix="$" />
              <N label="Override Rate" value={Math.round(overrideRate * 100)} onChange={v => setOverrideRate(v / 100)} suffix="%" min={0} max={50} />
              <N label="Retention (years)" value={retentionYears} onChange={setRetentionYears} min={1} max={20} />
            </div>
          </div>

          {/* Funnel Visualization */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Funnel Flow</h4>
            <div className="space-y-1">
              {result.stages.map((s, i) => {
                const maxCount = result.stages[0].count;
                const widthPct = maxCount > 0 ? Math.max(10, (s.count / maxCount) * 100) : 10;
                const colors = ['bg-blue-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500', 'bg-purple-500'];
                return (
                  <div key={s.stage} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-20 text-right">{s.stage}</span>
                    <div className="flex-1 h-7 bg-muted rounded overflow-hidden relative">
                      <div className={`h-full ${colors[i]} transition-all rounded`} style={{ width: `${widthPct}%` }} />
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-mono font-semibold text-white drop-shadow">
                        {s.count.toLocaleString()} {i > 0 && `(${(s.conversionRate * 100).toFixed(0)}%)`}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground w-16 text-right">{fmt(s.totalCost)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Total CAC</div>
              <div className={`text-lg font-bold ${result.totalCAC <= 5000 ? 'text-emerald-400' : result.totalCAC <= 8500 ? 'text-amber-400' : 'text-red-400'}`}>{fmt(result.totalCAC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">LTV per Hire</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.estimatedLTV)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">LTV:CAC</div>
              <div className={`text-lg font-bold ${result.ltvCacRatio >= 5 ? 'text-emerald-400' : result.ltvCacRatio >= 3 ? 'text-amber-400' : 'text-red-400'}`}>
                {result.ltvCacRatio.toFixed(1)}:1
              </div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Break-Even</div>
              <div className="text-lg font-bold text-blue-400">{result.breakEvenMonths < 999 ? `${result.breakEvenMonths} mo` : '—'}</div>
            </CardContent></Card>
          </div>

          {/* Benchmark Table */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Benchmark Comparison</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Metric</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Yours</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Industry Avg</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Top Quartile</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Status</th>
                </tr></thead>
                <tbody>
                  {result.benchmarks.map(b => (
                    <tr key={b.metric} className="border-b border-border/50">
                      <td className="py-2">{b.metric}</td>
                      <td className="text-right font-mono">{b.metric.includes('$') ? fmt(b.yours) : b.yours.toLocaleString()}</td>
                      <td className="text-right font-mono text-muted-foreground">{b.metric.includes('$') ? fmt(b.industryAvg) : b.industryAvg.toLocaleString()}</td>
                      <td className="text-right font-mono text-muted-foreground">{b.metric.includes('$') ? fmt(b.topQuartile) : b.topQuartile.toLocaleString()}</td>
                      <td className="text-right"><StatusBadge status={b.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-purple-400 mb-2">Recruiting Strategy Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-purple-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   P&L / Business Economics Panel
   ═══════════════════════════════════════════════════════════════ */
export function PnLBusinessEconomicsPanel() {
  // Revenue inputs
  const [gdcRevenue, setGdcRevenue] = useState(200000);
  const [aumRevenue, setAumRevenue] = useState(80000);
  const [affiliateRevenue, setAffiliateRevenue] = useState(30000);
  const [overrideRevenue, setOverrideRevenue] = useState(50000);
  const [channelRevenue, setChannelRevenue] = useState(15000);
  // COGS %
  const [gdcCogsPct, setGdcCogsPct] = useState(35);
  const [aumCogsPct, setAumCogsPct] = useState(25);
  const [affiliateCogsPct, setAffiliateCogsPct] = useState(40);
  const [overrideCogsPct, setOverrideCogsPct] = useState(15);
  const [channelCogsPct, setChannelCogsPct] = useState(45);
  // OpEx
  const [staffCost, setStaffCost] = useState(45000);
  const [officeCost, setOfficeCost] = useState(18000);
  const [techCost, setTechCost] = useState(6000);
  const [marketingCost, setMarketingCost] = useState(24000);
  const [insuranceCost, setInsuranceCost] = useState(8000);
  const [otherOpEx, setOtherOpEx] = useState(5000);
  // Below the line
  const [interestExpense, setInterestExpense] = useState(0);
  const [depAmort, setDepAmort] = useState(3000);
  const [taxRate, setTaxRate] = useState(25);

  const result = useMemo(() => calcPnLBusinessEconomics(
    gdcRevenue, aumRevenue, affiliateRevenue, overrideRevenue, channelRevenue,
    gdcCogsPct, aumCogsPct, affiliateCogsPct, overrideCogsPct, channelCogsPct,
    staffCost, officeCost, techCost, marketingCost, insuranceCost, otherOpEx,
    interestExpense, depAmort, taxRate
  ), [gdcRevenue, aumRevenue, affiliateRevenue, overrideRevenue, channelRevenue,
    gdcCogsPct, aumCogsPct, affiliateCogsPct, overrideCogsPct, channelCogsPct,
    staffCost, officeCost, techCost, marketingCost, insuranceCost, otherOpEx,
    interestExpense, depAmort, taxRate]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            P&L / Business Economics
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Full income statement with channel attribution, break-even analysis, and margin optimization levers. Model your practice as a business with COGS, OpEx, and tax considerations.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Revenue by Channel */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Revenue by Channel</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <N label="Insurance GDC" value={gdcRevenue} onChange={setGdcRevenue} prefix="$" />
              <N label="AUM/Advisory" value={aumRevenue} onChange={setAumRevenue} prefix="$" />
              <N label="Affiliate" value={affiliateRevenue} onChange={setAffiliateRevenue} prefix="$" />
              <N label="Override" value={overrideRevenue} onChange={setOverrideRevenue} prefix="$" />
              <N label="Channel/Marketing" value={channelRevenue} onChange={setChannelRevenue} prefix="$" />
            </div>
          </div>

          {/* COGS % by Channel */}
          <div>
            <h4 className="text-sm font-semibold mb-3">COGS % by Channel</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <N label="GDC COGS %" value={gdcCogsPct} onChange={setGdcCogsPct} suffix="%" min={0} max={100} />
              <N label="AUM COGS %" value={aumCogsPct} onChange={setAumCogsPct} suffix="%" min={0} max={100} />
              <N label="Affiliate COGS %" value={affiliateCogsPct} onChange={setAffiliateCogsPct} suffix="%" min={0} max={100} />
              <N label="Override COGS %" value={overrideCogsPct} onChange={setOverrideCogsPct} suffix="%" min={0} max={100} />
              <N label="Channel COGS %" value={channelCogsPct} onChange={setChannelCogsPct} suffix="%" min={0} max={100} />
            </div>
          </div>

          {/* Operating Expenses */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Operating Expenses (Annual)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <N label="Staff/Payroll" value={staffCost} onChange={setStaffCost} prefix="$" />
              <N label="Office/Rent" value={officeCost} onChange={setOfficeCost} prefix="$" />
              <N label="Technology" value={techCost} onChange={setTechCost} prefix="$" />
              <N label="Marketing" value={marketingCost} onChange={setMarketingCost} prefix="$" />
              <N label="Insurance/E&O" value={insuranceCost} onChange={setInsuranceCost} prefix="$" />
              <N label="Other" value={otherOpEx} onChange={setOtherOpEx} prefix="$" />
            </div>
          </div>

          {/* Below the Line */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Below the Line</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <N label="Interest Expense" value={interestExpense} onChange={setInterestExpense} prefix="$" />
              <N label="Dep. & Amort." value={depAmort} onChange={setDepAmort} prefix="$" />
              <N label="Tax Rate" value={taxRate} onChange={setTaxRate} suffix="%" min={0} max={50} />
            </div>
          </div>

          {/* P&L Statement */}
          <div className="bg-muted/30 rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-3">Income Statement</h4>
            <div className="space-y-2 text-sm">
              {/* Revenue section */}
              {result.channels.filter(c => c.revenue > 0).map(c => (
                <div key={c.channel} className="flex justify-between">
                  <span className="text-muted-foreground pl-4">{c.channel}</span>
                  <span className="font-mono">{fmt(c.revenue)}</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>Total Revenue</span>
                <span className="font-mono text-emerald-400">{fmt(result.totalRevenue)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span className="pl-4">Less: COGS</span>
                <span className="font-mono text-red-400">({fmt(result.totalCOGS)})</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>Gross Profit</span>
                <span className="font-mono">{fmt(result.grossProfit)} <span className="text-xs text-muted-foreground">({result.grossMarginPct}%)</span></span>
              </div>
              {result.opExBreakdown.filter(o => o.amount > 0).map(o => (
                <div key={o.category} className="flex justify-between text-muted-foreground">
                  <span className="pl-4">{o.category}</span>
                  <span className="font-mono">({fmt(o.amount)})</span>
                </div>
              ))}
              <div className="flex justify-between font-semibold border-t border-border pt-1">
                <span>EBITDA</span>
                <span className={`font-mono ${result.ebitda >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(result.ebitda)} <span className="text-xs text-muted-foreground">({result.ebitdaMarginPct}%)</span></span>
              </div>
              {(interestExpense > 0 || depAmort > 0) && <>
                {interestExpense > 0 && <div className="flex justify-between text-muted-foreground"><span className="pl-4">Interest</span><span className="font-mono">({fmt(interestExpense)})</span></div>}
                {depAmort > 0 && <div className="flex justify-between text-muted-foreground"><span className="pl-4">D&A</span><span className="font-mono">({fmt(depAmort)})</span></div>}
              </>}
              <div className="flex justify-between text-muted-foreground">
                <span className="pl-4">Estimated Tax ({taxRate}%)</span>
                <span className="font-mono">({fmt(result.estimatedTax)})</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t-2 border-border pt-2">
                <span>Net Income</span>
                <span className={`font-mono ${result.netIncome >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(result.netIncome)} <span className="text-xs text-muted-foreground font-normal">({result.netMarginPct}%)</span></span>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Gross Margin</div>
              <div className={`text-lg font-bold ${result.grossMarginPct >= 55 ? 'text-emerald-400' : result.grossMarginPct >= 40 ? 'text-amber-400' : 'text-red-400'}`}>{result.grossMarginPct}%</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">EBITDA Margin</div>
              <div className={`text-lg font-bold ${result.ebitdaMarginPct >= 25 ? 'text-emerald-400' : result.ebitdaMarginPct >= 15 ? 'text-amber-400' : 'text-red-400'}`}>{result.ebitdaMarginPct}%</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Break-Even/mo</div>
              <div className="text-lg font-bold text-blue-400">{fmt(result.breakEvenMonthlyGDC)}</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Net Margin</div>
              <div className={`text-lg font-bold ${result.netMarginPct >= 15 ? 'text-emerald-400' : result.netMarginPct >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{result.netMarginPct}%</div>
            </CardContent></Card>
          </div>

          {/* Margin Optimization Levers */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Margin Optimization Levers</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Lever</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Impact</th>
                  <th className="text-left py-2 text-muted-foreground font-medium pl-4">Description</th>
                </tr></thead>
                <tbody>
                  {result.marginOptLevers.map(l => (
                    <tr key={l.lever} className="border-b border-border/50">
                      <td className="py-2 font-medium">{l.lever}</td>
                      <td className="text-right font-mono text-emerald-400">+{fmt(l.impact)}</td>
                      <td className="py-2 text-muted-foreground pl-4 text-xs">{l.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-emerald-400 mb-2">P&L Strategy Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GDC / Override Optimization Panel
   ═══════════════════════════════════════════════════════════════ */
export function GDCOverrideOptPanel() {
  const [personalGDC, setPersonalGDC] = useState(180000);
  const [targetGDC, setTargetGDC] = useState(250000);
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Agent A', gdcProduction: 120000, overrideRate: 10 },
    { name: 'Agent B', gdcProduction: 85000, overrideRate: 8 },
    { name: 'Agent C', gdcProduction: 65000, overrideRate: 12 },
  ]);

  const result = useMemo(() => calcGDCOverrideOpt(personalGDC, teamMembers, targetGDC),
    [personalGDC, teamMembers, targetGDC]);

  const updateMember = (idx: number, field: string, value: string | number) => {
    setTeamMembers(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const addMember = () => {
    setTeamMembers(prev => [...prev, { name: `Agent ${String.fromCharCode(65 + prev.length)}`, gdcProduction: 50000, overrideRate: 10 }]);
  };

  const removeMember = (idx: number) => {
    setTeamMembers(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="w-5 h-5 text-amber-400" />
            GDC / Override Optimization
            <Tooltip><TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs">Visualize your GDC bracket position, optimize override rates, model team production targets, and calculate the income impact of bracket advancement. Based on WealthBridge Financial Group compensation grid.</TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Personal GDC & Target */}
          <div className="grid grid-cols-2 gap-3">
            <N label="Personal GDC" value={personalGDC} onChange={setPersonalGDC} prefix="$" />
            <N label="Target GDC" value={targetGDC} onChange={setTargetGDC} prefix="$" />
          </div>

          {/* Bracket Visualization */}
          <div>
            <h4 className="text-sm font-semibold mb-3">GDC Bracket Position</h4>
            <div className="space-y-2">
              {result.brackets.map(b => (
                <div key={b.label} className="flex items-center gap-3">
                  <span className={`text-xs w-20 text-right ${b.isCurrentBracket ? 'font-bold text-amber-400' : 'text-muted-foreground'}`}>
                    {b.label}
                  </span>
                  <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                    <div className={`h-full transition-all rounded ${b.isCurrentBracket ? 'bg-amber-500' : b.fillPct === 100 ? 'bg-emerald-500/60' : 'bg-muted-foreground/20'}`}
                      style={{ width: `${b.fillPct}%` }} />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">
                      {(b.rate * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Current Position KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Current Payout</div>
              <div className="text-lg font-bold text-emerald-400">{fmt(result.currentPayout)}</div>
              <div className="text-xs text-muted-foreground">{(result.currentBracket.rate * 100).toFixed(1)}% rate</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Gap to Next</div>
              <div className="text-lg font-bold text-amber-400">{result.nextBracket ? fmt(result.nextBracket.gapToNext) : 'Max'}</div>
              {result.nextBracket && <div className="text-xs text-muted-foreground">→ {result.nextBracket.label}</div>}
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Bracket Lift</div>
              <div className="text-lg font-bold text-blue-400">{fmt(result.bracketLiftIncome)}</div>
              <div className="text-xs text-muted-foreground">at next bracket</div>
            </CardContent></Card>
            <Card className="bg-muted/50"><CardContent className="p-3 text-center">
              <div className="text-xs text-muted-foreground">Override Income</div>
              <div className="text-lg font-bold text-purple-400">{fmt(result.totalOverrideIncome)}</div>
              <div className="text-xs text-muted-foreground">{result.blendedOverrideRate}% blended</div>
            </CardContent></Card>
          </div>

          {/* Team Production Table */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Team Production & Override</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Member</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">GDC</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Override %</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Override $</th>
                  <th className="w-8"></th>
                </tr></thead>
                <tbody>
                  {teamMembers.map((m, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2">
                        <Input className="h-7 text-sm w-28" value={m.name}
                          onChange={e => updateMember(i, 'name', e.target.value)} />
                      </td>
                      <td className="text-right">
                        <Input type="number" className="h-7 text-sm w-24 text-right ml-auto" value={m.gdcProduction}
                          onChange={e => updateMember(i, 'gdcProduction', Number(e.target.value) || 0)} />
                      </td>
                      <td className="text-right">
                        <Input type="number" className="h-7 text-sm w-16 text-right ml-auto" value={m.overrideRate}
                          onChange={e => updateMember(i, 'overrideRate', Number(e.target.value) || 0)} />
                      </td>
                      <td className="text-right font-mono text-emerald-400">
                        {fmt(result.teamProduction[i]?.overrideIncome ?? 0)}
                      </td>
                      <td>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMember(i)} aria-label="Remove member">
                          <Trash2 className="w-3 h-3 text-muted-foreground" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-semibold">
                    <td className="py-2">Total</td>
                    <td className="text-right font-mono">{fmt(result.totalTeamGDC)}</td>
                    <td className="text-right font-mono">{result.blendedOverrideRate}%</td>
                    <td className="text-right font-mono text-emerald-400">{fmt(result.totalOverrideIncome)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Button variant="outline" size="sm" onClick={addMember} className="gap-1 mt-2">
              <Plus className="w-3 h-3" /> Add Team Member
            </Button>
          </div>

          {/* Optimization Scenarios */}
          <div>
            <h4 className="text-sm font-semibold mb-2">Optimization Scenarios</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Scenario</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Add'l GDC</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">New Bracket</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Add'l Income</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">ROI</th>
                </tr></thead>
                <tbody>
                  {result.optimizationScenarios.map(s => (
                    <tr key={s.scenario} className="border-b border-border/50">
                      <td className="py-2">{s.scenario}</td>
                      <td className="text-right font-mono">{fmt(s.additionalGDC)}</td>
                      <td className="text-right"><Badge variant="outline" className="text-xs">{s.newBracket}</Badge></td>
                      <td className="text-right font-mono text-emerald-400">+{fmt(s.additionalIncome)}</td>
                      <td className="text-right text-xs text-muted-foreground">{s.roi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recommendations */}
          {result.recommendations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-amber-400 mb-2">GDC/Override Optimization Recommendations</h4>
              <ul className="space-y-1">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
