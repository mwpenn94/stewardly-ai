/* ═══════════════════════════════════════════════════════════════
   SharedPlanView — Read-only client-facing portal for shared plans.
   Accessed via /plan/:token — no authentication required.

   Enhanced with:
   - Branded advisor header with firm name and professional styling
   - Print/PDF-friendly layout with @media print styles
   - Polished responsive design with better visual hierarchy
   - Compliance disclaimer footer
   - Expiry/view count indicators
   - Smooth animations and loading states
   ═══════════════════════════════════════════════════════════════ */
import React, { useRef, useCallback } from 'react';
import { useRoute } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Shield, TrendingUp, PiggyBank, Landmark, Building2,
  GraduationCap, DollarSign, Clock, Eye, AlertTriangle,
  Printer, ChevronRight, Lock, ExternalLink,
} from 'lucide-react';
import { fmtSm as fmt } from './calculators/format';

// ── Domain icon mapping ──────────────────────────────────────────────
const DOMAIN_ICONS: Record<string, React.ElementType> = {
  Protection: Shield, Growth: TrendingUp, Retirement: PiggyBank,
  'Tax Optimization': Landmark, 'Estate Planning': Building2,
  Education: GraduationCap, 'Cash Flow': DollarSign,
};

// ── Score bar component ──────────────────────────────────────────────
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
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Priority badge helper ────────────────────────────────────────────
function PriorityBadge({ priority }: { priority: string }) {
  const styles: Record<string, string> = {
    high: 'bg-red-500/15 text-red-400 border-red-500/30',
    medium: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    low: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  };
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${styles[priority] || styles.low}`}>
      {priority || 'info'}
    </Badge>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="h-8 w-64 bg-muted/50 rounded animate-pulse" />
          <div className="h-4 w-48 bg-muted/30 rounded animate-pulse mt-3" />
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-48 bg-muted/20 rounded-xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}

// ── Error / Not Found states ─────────────────────────────────────────
function PlanNotAvailable({ reason }: { reason?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-semibold">Plan Not Available</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {reason === 'expired'
              ? 'This shared plan link has expired. Please contact your advisor for a new link.'
              : reason === 'max_views'
              ? 'This shared plan has reached its maximum view limit. Please contact your advisor.'
              : 'This shared plan link is invalid or has been revoked. Please contact your advisor for assistance.'}
          </p>
          <Button variant="outline" size="sm" asChild>
            <a href="/">
              Visit WealthBridge AI
              <ExternalLink className="w-3 h-3 ml-1.5" />
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────
export default function SharedPlanView() {
  const [, params] = useRoute('/plan/:token');
  const token = params?.token || '';
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = trpc.planSharing.getShare.useQuery(
    { token },
    { enabled: !!token, retry: false },
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ── Loading state ──
  if (isLoading) return <LoadingSkeleton />;

  // ── Error / not found ──
  if (error || !data?.found) {
    const reason = data && 'reason' in data ? data.reason : undefined;
    return <PlanNotAvailable reason={reason} />;
  }

  const snap = data.snapshot as any;
  if (!snap) {
    return <PlanNotAvailable />;
  }

  const sc = snap.scorecard || { overall: 0, maxScore: 36, pctScore: 0, domains: [] };
  const client = snap.client || {};
  const recs = snap.recommendations || [];
  const hb = snap.holisticBridge;
  const overallGrade = sc.pctScore >= 80 ? 'Excellent' : sc.pctScore >= 60 ? 'Good' : sc.pctScore >= 40 ? 'Needs Attention' : 'Critical';
  const gradeColor = sc.pctScore >= 80 ? '#22c55e' : sc.pctScore >= 60 ? '#f59e0b' : sc.pctScore >= 40 ? '#f97316' : '#ef4444';

  return (
    <div ref={printRef} className="min-h-screen bg-background print:bg-white">
      {/* ── Branded Header ── */}
      <header className="bg-gradient-to-r from-primary/8 via-primary/4 to-transparent border-b print:border-b-2 print:border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              {/* Advisor branding */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground print:text-gray-500">
                <Lock className="w-3 h-3" />
                <span>Shared via WealthBridge AI</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight print:text-black">
                {data.label}
              </h1>
              <p className="text-sm text-muted-foreground print:text-gray-600">
                Prepared by <span className="font-medium text-foreground print:text-black">{data.sharedBy}</span>
                {' '}on {new Date(data.sharedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {/* Meta info + print button */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-3 text-xs text-muted-foreground print:hidden">
                <span className="flex items-center gap-1">
                  <Eye className="w-3 h-3" /> {data.viewCount} views
                </span>
                {data.expiresAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Expires {new Date(data.expiresAt).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 print:hidden">
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                  Read-Only
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handlePrint}
                >
                  <Printer className="w-3 h-3" />
                  Print / PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 print:space-y-8">

        {/* Overall Financial Health Score */}
        <Card className="overflow-hidden print:shadow-none print:border-2">
          <CardHeader className="bg-gradient-to-r from-muted/30 to-transparent">
            <CardTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Financial Health Score
              </span>
              {hb && (
                <Badge variant="outline" className="text-amber-500 border-amber-500/30 text-xs">
                  Holistic: {hb.holisticScore?.toFixed(0) || 0}/100
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Score circle */}
              <div className="text-center shrink-0">
                <div className="relative w-28 h-28 flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" stroke={gradeColor} strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(sc.pctScore / 100) * 264} 264`}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-2xl font-bold" style={{ color: gradeColor }}>
                      {sc.overall}
                    </div>
                    <div className="text-[10px] text-muted-foreground">of {sc.maxScore}</div>
                  </div>
                </div>
                <div className="text-sm font-medium mt-2" style={{ color: gradeColor }}>
                  {overallGrade}
                </div>
              </div>

              {/* Domain breakdown */}
              <div className="flex-1 w-full space-y-3">
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
          <Card className="print:shadow-none print:border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-5 h-5 text-primary" />
                Client Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {client.clientName && (
                  <ProfileField label="Client" value={client.clientName} />
                )}
                <ProfileField label="Age" value={client.age} />
                {client.income > 0 && <ProfileField label="Annual Income" value={fmt(client.income)} />}
                {client.nw > 0 && <ProfileField label="Net Worth" value={fmt(client.nw)} />}
                {client.savings > 0 && <ProfileField label="Liquid Savings" value={fmt(client.savings)} />}
                {client.retirement401k > 0 && <ProfileField label="401(k) Balance" value={fmt(client.retirement401k)} />}
                {client.dep > 0 && <ProfileField label="Dependents" value={client.dep} />}
                {client.filing && <ProfileField label="Filing Status" value={client.filing.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())} />}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {recs.length > 0 && (
          <Card className="print:shadow-none print:border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ChevronRight className="w-5 h-5 text-primary" />
                Recommendations
                <Badge variant="secondary" className="text-[10px] ml-1">{recs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recs.slice(0, 12).map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 print:bg-gray-50 print:border">
                    <div className="mt-0.5">
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium print:text-black">{r.title || r.text}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed print:text-gray-600">
                          {r.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Holistic Cascade Summary */}
        {hb && hb.holisticScore > 0 && (
          <Card className="print:shadow-none print:border-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-5 h-5 text-primary" />
                Holistic Cascade Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <CascadeScore label="Client Hub" score={hb.clientHubScore} color="blue" />
                <CascadeScore label="Advanced Hub" score={hb.advancedHubScore} color="purple" />
                <CascadeScore label="Practice Hub" score={hb.practiceHubScore} color="emerald" />
              </div>
            </CardContent>
          </Card>
        )}

        <Separator className="print:hidden" />

        {/* Compliance Disclaimer Footer */}
        <footer className="space-y-4 pb-8 print:pb-4">
          <div className="p-4 rounded-lg bg-muted/20 border border-border/50 print:bg-gray-50 print:border-gray-200">
            <p className="text-[11px] text-muted-foreground leading-relaxed print:text-gray-500">
              <strong className="text-foreground/70 print:text-gray-700">Important Disclosure:</strong>{' '}
              This document is a read-only snapshot of a financial plan generated by WealthBridge AI.
              It is provided for informational purposes only and does not constitute financial, investment,
              tax, or legal advice. The projections and recommendations contained herein are based on
              information provided at the time of generation and may not reflect current market conditions
              or changes in personal circumstances. Past performance is not indicative of future results.
              Please consult with a qualified financial professional before making any financial decisions.
            </p>
          </div>
          <div className="text-center text-xs text-muted-foreground print:text-gray-400">
            <p>
              Generated by{' '}
              <a href="/" className="text-primary hover:underline print:text-gray-600 print:no-underline">
                WealthBridge AI
              </a>
              {' '}— Digital Financial Twin Platform
            </p>
            <p className="mt-1 text-[10px]">
              Document ID: {token.substring(0, 8)}...{token.substring(token.length - 4)}
            </p>
          </div>
        </footer>
      </main>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-600 { color: #4b5563 !important; }
          .print\\:text-gray-700 { color: #374151 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-2 { border-width: 2px !important; }
          .print\\:bg-gray-50 { background: #f9fafb !important; }
          .print\\:border-gray-200 { border-color: #e5e7eb !important; }
          .print\\:no-underline { text-decoration: none !important; }
        }
      `}</style>
    </div>
  );
}

// ── Helper sub-components ────────────────────────────────────────────

function ProfileField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-0.5">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wider print:text-gray-500">
        {label}
      </span>
      <p className="text-sm font-medium print:text-black">{value}</p>
    </div>
  );
}

function CascadeScore({ label, score, color }: { label: string; score?: number; color: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/10', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-500/10', text: 'text-purple-500' },
    emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
  };
  const c = colorMap[color] || colorMap.blue;
  return (
    <div className={`p-4 rounded-xl ${c.bg} text-center print:border print:border-gray-200`}>
      <div className={`text-2xl font-bold ${c.text}`}>{score?.toFixed(0) || 0}</div>
      <div className="text-xs text-muted-foreground mt-1 print:text-gray-500">{label}</div>
    </div>
  );
}
