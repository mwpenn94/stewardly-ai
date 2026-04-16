/* ═══ PanelsH — Domain A: Practice Management Strategy Surfaces ═══ */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Info, TrendingUp, TrendingDown, Minus, Target, BarChart3, PieChart, DollarSign, Plus, Trash2 } from 'lucide-react';
import {
  calcProductionOptimization, MDRT_BENCHMARKS, TOP_10_BENCHMARKS,
  calcChannelDiversification, type ChannelMix,
  calcMarketingROI, DEFAULT_CAMPAIGNS, type Campaign,
} from './domainAEngine';
import { fmt, pct } from './engine';

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
            <div className="grid grid-cols-3 gap-3">
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
