/* ═══════════════════════════════════════════════════════════════
   SharedPlanView — Read-only view of a shared financial plan.
   Accessed via /plan/:token — no authentication required.
   ═══════════════════════════════════════════════════════════════ */
import React from 'react';
import { useRoute } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Shield, TrendingUp, PiggyBank, Landmark, Building2, GraduationCap, DollarSign, Clock, Eye, AlertTriangle } from 'lucide-react';
import { fmtSm as fmt } from './calculators/format';

const DOMAIN_ICONS: Record<string, React.ElementType> = {
  Protection: Shield, Growth: TrendingUp, Retirement: PiggyBank,
  'Tax Optimization': Landmark, 'Estate Planning': Building2, Education: GraduationCap,
  'Cash Flow': DollarSign,
};

function ScoreBar({ score, maxScore, label }: { score: number; maxScore: number; label: string }) {
  const pct = Math.min(100, (score / maxScore) * 100);
  const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#f59e0b' : pct >= 40 ? '#f97316' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span style={{ color }}>{score}/{maxScore}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function SharedPlanView() {
  const [, params] = useRoute('/plan/:token');
  const token = params?.token || '';

  const { data, isLoading, error } = trpc.planSharing.getShare.useQuery(
    { token },
    { enabled: !!token, retry: false },
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading shared plan...</p>
        </div>
      </div>
    );
  }

  if (error || !data?.found) {
    const reason = data && 'reason' in data ? data.reason : undefined;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">Plan Not Available</h2>
            <p className="text-muted-foreground">
              {reason === 'expired' ? 'This shared plan link has expired.' :
               reason === 'max_views' ? 'This shared plan has reached its maximum view limit.' :
               'This shared plan link is invalid or has been revoked.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const snap = data.snapshot as any;
  if (!snap) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h2 className="text-xl font-semibold">No Plan Data</h2>
            <p className="text-muted-foreground">The plan snapshot is empty or corrupted.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const sc = snap.scorecard || { overall: 0, maxScore: 36, pctScore: 0, domains: [] };
  const client = snap.client || {};
  const recs = snap.recommendations || [];
  const hb = snap.holisticBridge;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">{data.label}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Shared by {data.sharedBy} on {new Date(data.sharedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {data.viewCount} views</span>
              {data.expiresAt && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Expires {new Date(data.expiresAt).toLocaleDateString()}</span>
              )}
              <Badge variant="outline" className="text-[10px]">Read-Only</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Overall Score */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Financial Health Score</span>
              {hb && (
                <Badge variant="outline" className="text-amber-500 border-amber-500">
                  Holistic: {hb.holisticScore?.toFixed(0) || 0}/100
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-bold" style={{ color: sc.pctScore >= 80 ? '#22c55e' : sc.pctScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {sc.overall}/{sc.maxScore}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {sc.pctScore >= 80 ? 'Excellent' : sc.pctScore >= 60 ? 'Good' : sc.pctScore >= 40 ? 'Needs Attention' : 'Critical'}
                </div>
              </div>
              <div className="flex-1 space-y-3">
                {sc.domains?.map((d: any) => {
                  const Icon = DOMAIN_ICONS[d.label] || DollarSign;
                  return (
                    <div key={d.label} className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1">
                        <ScoreBar score={d.score} maxScore={d.maxScore} label={d.label} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Client Profile Summary */}
        {client.age && (
          <Card>
            <CardHeader><CardTitle>Client Profile</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {client.clientName && <div><span className="text-muted-foreground">Client</span><p className="font-medium">{client.clientName}</p></div>}
                <div><span className="text-muted-foreground">Age</span><p className="font-medium">{client.age}</p></div>
                {client.income > 0 && <div><span className="text-muted-foreground">Income</span><p className="font-medium">{fmt(client.income)}</p></div>}
                {client.nw > 0 && <div><span className="text-muted-foreground">Net Worth</span><p className="font-medium">{fmt(client.nw)}</p></div>}
                {client.savings > 0 && <div><span className="text-muted-foreground">Savings</span><p className="font-medium">{fmt(client.savings)}</p></div>}
                {client.retirement401k > 0 && <div><span className="text-muted-foreground">401(k)</span><p className="font-medium">{fmt(client.retirement401k)}</p></div>}
                {client.dep > 0 && <div><span className="text-muted-foreground">Dependents</span><p className="font-medium">{client.dep}</p></div>}
                {client.filing && <div><span className="text-muted-foreground">Filing</span><p className="font-medium">{client.filing.toUpperCase()}</p></div>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recommendations</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recs.slice(0, 10).map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                    <Badge variant={r.priority === 'high' ? 'destructive' : r.priority === 'medium' ? 'secondary' : 'outline'} className="text-[10px] mt-0.5 shrink-0">
                      {r.priority || 'info'}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{r.title || r.text}</p>
                      {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cascade Summary (if advanced strategies were used) */}
        {hb && hb.holisticScore > 0 && (
          <Card>
            <CardHeader><CardTitle>Holistic Cascade Summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <div className="text-2xl font-bold text-blue-500">{hb.clientHubScore?.toFixed(0) || 0}</div>
                  <div className="text-xs text-muted-foreground">Client Hub</div>
                </div>
                <div className="p-3 rounded-lg bg-purple-500/10">
                  <div className="text-2xl font-bold text-purple-500">{hb.advancedHubScore?.toFixed(0) || 0}</div>
                  <div className="text-xs text-muted-foreground">Advanced Hub</div>
                </div>
                <div className="p-3 rounded-lg bg-emerald-500/10">
                  <div className="text-2xl font-bold text-emerald-500">{hb.practiceHubScore?.toFixed(0) || 0}</div>
                  <div className="text-xs text-muted-foreground">Practice Hub</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-4">
          <p>This is a read-only snapshot of a financial plan shared via WealthBridge AI.</p>
          <p className="mt-1">For personalized financial planning, visit <a href="/" className="text-primary hover:underline">WealthBridge AI</a>.</p>
        </div>
      </div>
    </div>
  );
}
