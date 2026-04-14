/* ═══ PanelsF — Income Streams Panel ═══ */
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, DollarSign, TrendingUp, PieChart, Shield } from 'lucide-react';
import { RefTip, KPI, CrossCalcRecs, ExportPDFButton } from './shared';
import { fmt, fmtSm, pct, calcIncomeStreams } from './engine';
import type { IncomeStream, IncomeStreamResult } from './engine';
import type { PanelProps } from './shared';

// Re-export PanelProps check — PanelProps doesn't include income streams yet, so we extend
interface IncomeStreamsPanelProps {
  incomeStreams: IncomeStream[];
  setIncomeStreams: (streams: IncomeStream[]) => void;
  scores?: PanelProps['scores'];
}

const CATEGORIES = [
  { value: 'earned', label: 'Earned (W-2/Salary)' },
  { value: 'business', label: 'Business Income' },
  { value: 'investment', label: 'Investment Returns' },
  { value: 'passive', label: 'Passive Income' },
  { value: 'retirement', label: 'Retirement Income' },
];

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one-time', label: 'One-Time' },
];

const TAX_TREATMENTS = [
  { value: 'w2', label: 'W-2 (Employee)' },
  { value: '1099', label: '1099 (Self-Employed)' },
  { value: 'passive', label: 'Passive/Capital Gains' },
  { value: 'tax-free', label: 'Tax-Free (Roth/Muni)' },
];

const CATEGORY_COLORS: Record<string, string> = {
  earned: 'bg-blue-500',
  business: 'bg-green-500',
  investment: 'bg-primary',
  passive: 'bg-purple-500',
  retirement: 'bg-orange-500',
};

function newStream(): IncomeStream {
  return {
    id: crypto.randomUUID(),
    source: '',
    amount: 0,
    frequency: 'monthly',
    taxTreatment: 'w2',
    growthRate: 0.03,
    category: 'earned',
  };
}

export function IncomeStreamsPanel({ incomeStreams, setIncomeStreams, scores }: IncomeStreamsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const result: IncomeStreamResult = calcIncomeStreams(incomeStreams);

  const addStream = () => {
    const s = newStream();
    setIncomeStreams([...incomeStreams, s]);
    setEditingId(s.id);
  };

  const updateStream = (id: string, updates: Partial<IncomeStream>) => {
    setIncomeStreams(incomeStreams.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const removeStream = (id: string) => {
    setIncomeStreams(incomeStreams.filter(s => s.id !== id));
    if (editingId === id) setEditingId(null);
  };

  return (
    <section aria-label="Income Streams" role="region">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" /> Income Streams
        </h2>
        <ExportPDFButton title="Income Streams" />
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Track all income sources, analyze diversification, and project growth. Multiple streams reduce risk and improve financial resilience.
      </p>

      {/* Stream List */}
      <Card className="mb-4">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-1">
              Your Income Sources
              <RefTip text="Income diversification reduces financial risk. Research shows households with 3+ income sources have 40% lower financial stress. Source: Federal Reserve Survey of Consumer Finances, 2022." refId="planning" />
            </CardTitle>
            <Button size="sm" variant="outline" onClick={addStream} className="h-7 text-xs gap-1">
              <Plus className="w-3 h-3" /> Add Stream
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {incomeStreams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No income streams added yet.</p>
              <p className="text-xs mt-1">Click "Add Stream" to track your income sources.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {incomeStreams.map(stream => (
                <div key={stream.id} className="border border-border/50 rounded-lg p-3">
                  {editingId === stream.id ? (
                    /* Editing mode */
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div className="space-y-1 col-span-2 md:col-span-1">
                          <Label className="text-xs font-medium text-muted-foreground">Source Name</Label>
                          <Input className="h-8 text-sm" placeholder="e.g., Primary Salary"
                            value={stream.source} onChange={e => updateStream(stream.id, { source: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">Amount</Label>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">$</span>
                            <Input className="h-8 text-sm pl-6" type="number"
                              value={stream.amount || ''} onChange={e => updateStream(stream.id, { amount: +e.target.value })} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">Frequency</Label>
                          <Select value={stream.frequency} onValueChange={v => updateStream(stream.id, { frequency: v as IncomeStream['frequency'] })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">Category</Label>
                          <Select value={stream.category} onValueChange={v => updateStream(stream.id, { category: v as IncomeStream['category'] })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">Tax Treatment</Label>
                          <Select value={stream.taxTreatment} onValueChange={v => updateStream(stream.id, { taxTreatment: v as IncomeStream['taxTreatment'] })}>
                            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {TAX_TREATMENTS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs font-medium text-muted-foreground">Growth Rate</Label>
                          <div className="relative">
                            <Input className="h-8 text-sm pr-6" type="number" step="0.5"
                              value={(stream.growthRate * 100).toFixed(1)} onChange={e => updateStream(stream.id, { growthRate: +e.target.value / 100 })} />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/60">%</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Done</Button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[stream.category] || 'bg-muted'}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{stream.source || 'Unnamed Stream'}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {fmt(stream.amount)}/{stream.frequency} · {CATEGORIES.find(c => c.value === stream.category)?.label} · {pct(stream.growthRate)} growth
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-primary">{fmt(stream.amount * (stream.frequency === 'monthly' ? 12 : stream.frequency === 'quarterly' ? 4 : 1))}/yr</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(stream.id)}>
                          <span className="text-xs">✏️</span>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:text-red-300" onClick={() => removeStream(stream.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results — only show if streams exist */}
      {result.totalAnnual > 0 && (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <KPI label="Monthly Income" value={fmt(result.totalMonthly)} variant="gld" />
            <KPI label="Annual Income" value={fmtSm(result.totalAnnual)} variant="grn" />
            <KPI label="Diversification" value={`${result.diversificationScore}/100`} variant={result.diversificationScore >= 60 ? 'grn' : result.diversificationScore >= 30 ? 'gld' : 'red'} />
            <KPI label="5-Year Projection" value={fmtSm(result.projectedYear5)} variant="blu" />
          </div>

          {/* Category Breakdown */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <PieChart className="w-4 h-4" /> Income by Category
                <RefTip text="Diversified income across earned, business, investment, passive, and retirement sources provides greater financial stability. Target: no single category > 50% of total." refId="planning" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {result.byCategory.map(cat => (
                  <div key={cat.category} className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${CATEGORY_COLORS[cat.category] || 'bg-muted'}`} />
                    <span className="text-xs font-medium text-foreground w-24 capitalize">{cat.category}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${CATEGORY_COLORS[cat.category] || 'bg-primary'}`}
                        style={{ width: `${(cat.pct * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-20 text-right">{fmtSm(cat.annual)}/yr</span>
                    <span className="text-[10px] text-muted-foreground w-10 text-right">{(cat.pct * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tax Analysis */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                Tax Treatment Analysis
                <RefTip text="Different income types have different tax rates. W-2 income: ~30% effective. 1099: ~35% (includes SE tax). Passive/capital gains: ~20%. Tax-free (Roth/Muni): 0%. Source: IRS 2024 brackets." refId="tax" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-1 px-1">
                <table role="table" className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Treatment</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Annual</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Est. Tax</th>
                      <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">After-Tax</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.byTax.map(t => (
                      <tr key={t.treatment} className="border-b border-border/50">
                        <td className="py-1.5 px-2 text-foreground capitalize">{t.treatment}</td>
                        <td className="py-1.5 px-2 text-right font-medium">{fmtSm(t.annual)}</td>
                        <td className="py-1.5 px-2 text-right text-red-400">{fmtSm(Math.round(t.annual * t.effectiveRate))}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-green-400">{fmtSm(Math.round(t.annual * (1 - t.effectiveRate)))}</td>
                      </tr>
                    ))}
                    <tr className="bg-primary/5">
                      <td className="py-1.5 px-2 font-bold">Total</td>
                      <td className="py-1.5 px-2 text-right font-bold">{fmtSm(result.totalAnnual)}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-red-400">
                        {fmtSm(result.byTax.reduce((sum, t) => sum + Math.round(t.annual * t.effectiveRate), 0))}
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-green-400">
                        {fmtSm(result.byTax.reduce((sum, t) => sum + Math.round(t.annual * (1 - t.effectiveRate)), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pillar Contributions */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <Shield className="w-4 h-4" /> Pillar Contributions
                <RefTip text="Income streams contribute to your Plan/Protect/Grow pillars differently. Earned & business income supports Planning. Passive & retirement supports Protection. Investment returns support Growth." refId="planning" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { name: 'Plan', value: result.pillarContributions.plan, color: 'bg-blue-500', icon: '📋' },
                  { name: 'Protect', value: result.pillarContributions.protect, color: 'bg-green-500', icon: '🛡️' },
                  { name: 'Grow', value: result.pillarContributions.grow, color: 'bg-primary', icon: '📈' },
                ].map(p => (
                  <div key={p.name} className="text-center">
                    <div className="text-lg mb-1">{p.icon}</div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase">{p.name}</div>
                    <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${p.color}`} style={{ width: `${p.value}%` }} />
                    </div>
                    <div className="text-xs mt-1 font-bold text-foreground">{p.value}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Growth Projections */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-1">
                <TrendingUp className="w-4 h-4" /> Growth Projections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                <KPI label="Current" value={fmtSm(result.totalAnnual)} variant="gld" sub="Annual" />
                <KPI label="Year 5" value={fmtSm(result.projectedYear5)} variant="blu" sub={`+${fmtSm(result.projectedYear5 - result.totalAnnual)}`} />
                <KPI label="Year 10" value={fmtSm(result.projectedYear10)} variant="grn" sub={`+${fmtSm(result.projectedYear10 - result.totalAnnual)}`} />
              </div>
              {/* Simple projection chart */}
              <div className="mt-4 h-24 relative">
                <svg viewBox="0 0 400 80" className="w-full h-full" aria-label="Income growth projection chart">
                  {/* Grid lines */}
                  {[0, 20, 40, 60, 80].map(y => (
                    <line key={y} x1="40" y1={y} x2="380" y2={y} stroke="currentColor" strokeOpacity="0.1" />
                  ))}
                  {/* Projection line */}
                  {(() => {
                    const maxVal = result.projectedYear10 * 1.1;
                    const points = Array.from({ length: 11 }, (_, i) => {
                      const val = result.totalAnnual * Math.pow(1 + (result.streams.length > 0 ? result.streams.reduce((s, st) => s + st.growthRate, 0) / result.streams.length : 0.03), i);
                      const x = 40 + (i / 10) * 340;
                      const y = 75 - (val / maxVal) * 70;
                      return `${x},${y}`;
                    }).join(' ');
                    return (
                      <>
                        <polyline points={points} fill="none" stroke="oklch(0.7 0.15 85)" strokeWidth="2" />
                        {[0, 5, 10].map(i => {
                          const val = result.totalAnnual * Math.pow(1 + (result.streams.length > 0 ? result.streams.reduce((s, st) => s + st.growthRate, 0) / result.streams.length : 0.03), i);
                          const x = 40 + (i / 10) * 340;
                          const y = 75 - (val / maxVal) * 70;
                          return <circle key={i} cx={x} cy={y} r="3" fill="oklch(0.7 0.15 85)" />;
                        })}
                      </>
                    );
                  })()}
                  {/* X-axis labels */}
                  <text x="40" y="78" fontSize="8" fill="currentColor" opacity="0.5" textAnchor="middle">Now</text>
                  <text x="210" y="78" fontSize="8" fill="currentColor" opacity="0.5" textAnchor="middle">Yr 5</text>
                  <text x="380" y="78" fontSize="8" fill="currentColor" opacity="0.5" textAnchor="middle">Yr 10</text>
                </svg>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <CrossCalcRecs currentPanel="income" scores={scores ?? {}} />
    </section>
  );
}
