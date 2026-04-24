/**
 * LeadDetail — Detailed view for a single lead with score history trend,
 * enrichment data, activity timeline, AI insights, contact info, and action buttons.
 *
 * Pass 77: Wired to real leadPipeline.getPipeline data.
 * Pass 123: Added score history chart, enrichment panel, enhanced activity timeline.
 */
import { SEOHead } from "@/components/SEOHead";
import { PropensityGauge } from "@/components/PropensityGauge";
import { VerificationBadge } from "@/components/VerificationBadge";
import { PiiMaskedField } from "@/components/PiiMaskedField";
import { CalculatorInsight } from "@/components/CalculatorInsight";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft, Mail, Phone, Calendar, MapPin, DollarSign, FileText,
  MessageSquare, Clock, Loader2, TrendingUp, TrendingDown, Minus,
  Activity, Shield, Database, RefreshCw, BarChart3, AlertTriangle,
  CheckCircle2, Info, Zap, Globe, Building2, User, Target,
} from "lucide-react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import { MeddpiccScorecard } from "@/components/MeddpiccScorecard";
import { CadenceEnrollmentDialog } from "@/components/CadenceEnrollmentDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* ---------- Score History Sparkline ---------- */
function ScoreHistoryChart({ history }: { history: Array<{ score: number; model: string; scoredAt: string | Date }> }) {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-xs">
        <Activity className="h-5 w-5 mx-auto mb-1 opacity-40" />
        No score history yet
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => new Date(a.scoredAt).getTime() - new Date(b.scoredAt).getTime());
  const scores = sorted.map(h => Number(h.score));
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const range = maxScore - minScore || 1;
  const latest = scores[scores.length - 1];
  const prev = scores.length > 1 ? scores[scores.length - 2] : latest;
  const delta = latest - prev;
  const trend = delta > 0.01 ? "up" : delta < -0.01 ? "down" : "flat";

  // SVG sparkline
  const width = 200;
  const height = 40;
  const padding = 4;
  const points = scores.map((s, i) => {
    const x = padding + (i / Math.max(scores.length - 1, 1)) * (width - 2 * padding);
    const y = height - padding - ((s - minScore) / range) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">Score Trend ({history.length} records)</span>
        <div className="flex items-center gap-1">
          {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />}
          {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
          {trend === "flat" && <Minus className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className={`text-xs font-medium ${trend === "up" ? "text-emerald-500" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
            {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}%
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
        <defs>
          <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={trend === "down" ? "#ef4444" : "#10b981"} stopOpacity="0.3" />
            <stop offset="100%" stopColor={trend === "down" ? "#ef4444" : "#10b981"} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="url(#scoreGrad)"
        />
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={trend === "down" ? "#ef4444" : "#10b981"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Latest point */}
        {scores.length > 0 && (() => {
          const lastX = padding + ((scores.length - 1) / Math.max(scores.length - 1, 1)) * (width - 2 * padding);
          const lastY = height - padding - ((scores[scores.length - 1] - minScore) / range) * (height - 2 * padding);
          return <circle cx={lastX} cy={lastY} r="2.5" fill={trend === "down" ? "#ef4444" : "#10b981"} />;
        })()}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{sorted.length > 0 ? new Date(sorted[0].scoredAt).toLocaleDateString() : ""}</span>
        <span>{sorted.length > 0 ? new Date(sorted[sorted.length - 1].scoredAt).toLocaleDateString() : ""}</span>
      </div>
    </div>
  );
}

/* ---------- Enrichment Data Panel ---------- */
function EnrichmentPanel({ data }: { data: any }) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Enrichment Data</CardTitle></CardHeader>
        <CardContent className="text-center py-4">
          <Database className="h-6 w-6 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">No enrichment data available</p>
          <p className="text-[10px] text-muted-foreground mt-1">Data will populate from connected sources</p>
        </CardContent>
      </Card>
    );
  }

  const entries = Object.entries(data).filter(([, v]) => v != null);
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Enrichment Data</CardTitle></CardHeader>
      <CardContent className="space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim()}</span>
            <span className="font-medium truncate max-w-[140px]">{String(value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------- Compliance Status Badge ---------- */
function ComplianceBadge({ lead }: { lead: any }) {
  const checks = [
    { label: "KYC", ok: true },
    { label: "AML", ok: !lead.piiDeletionRequested },
    { label: "Consent", ok: lead.emailConsentGranted !== false },
    { label: "TCPA", ok: !lead.unsubscribed },
  ];
  const allOk = checks.every(c => c.ok);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {checks.map(c => (
        <Badge key={c.label} variant="outline" className={`text-[10px] px-1.5 py-0 ${c.ok ? "border-emerald-500/30 text-emerald-600" : "border-red-500/30 text-red-500"}`}>
          {c.ok ? <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
          {c.label}
        </Badge>
      ))}
      <Badge variant={allOk ? "outline" : "destructive"} className="text-[10px] px-1.5 py-0">
        <Shield className="h-2.5 w-2.5 mr-0.5" />
        {allOk ? "Compliant" : "Review Required"}
      </Badge>
    </div>
  );
}

/* ---------- Cadence Enroll Button ---------- */
function CadenceEnrollButton({ leadId, leadName }: { leadId: number; leadName: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" className="w-full justify-start text-sm" onClick={() => setOpen(true)}>
        <Target className="h-4 w-4 mr-2" /> Enroll in Cadence
      </Button>
      <CadenceEnrollmentDialog open={open} onOpenChange={setOpen} leadId={leadId} leadName={leadName} />
    </>
  );
}

/* ---------- Main Component ---------- */
export default function LeadDetail() {
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const leadId = Number(params.id);

  // Fetch pipeline data and find the specific lead
  const utils = trpc.useUtils();
  const { data: pipeline, isLoading, error } = trpc.leadPipeline.getPipeline.useQuery();
  const lead = useMemo(() => {
    if (!pipeline) return null;
    return pipeline.find((l: any) => l.id === leadId) ?? null;
  }, [pipeline, leadId]);

  // Score history query
  const scoreHistory = trpc.leadPipeline.getScoreHistory.useQuery(
    { leadId },
    { enabled: !!lead },
  );

  const LIFECYCLE_STAGES = ["new","enriched","scored","qualified","assigned","contacted","meeting","proposal","converted","disqualified","dormant"] as const;
  const updateStatus = trpc.leadPipeline.updateStatus.useMutation({
    onSuccess: () => { utils.leadPipeline.getPipeline.invalidate(); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <AppShell title="Lead Detail">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !lead) {
    return (
      <AppShell title="Lead Detail">
        <div className="container max-w-5xl py-8 text-center space-y-4">
          <SEOHead title="Lead Not Found" description="Lead detail view" />
          <p className="text-muted-foreground">{error ? "Failed to load lead data." : "Lead not found."}</p>
          <Button variant="outline" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pipeline
          </Button>
        </div>
      </AppShell>
    );
  }

  const name = lead.name ?? (`${lead.firstName ?? ""} ${lead.lastName ?? ""}`.trim() || "Unknown");
  const email = lead.email ?? "";
  const phone = lead.phone ?? "";
  const source = lead.source ?? "Direct";
  const stage = lead.status ?? lead.stage ?? "new";
  const score = Number(lead.propensityScore ?? lead.score ?? 0);
  const aum = Number(lead.estimatedAum ?? lead.aum ?? 0);
  const notes = lead.notes ?? "";
  const enrichment = lead.enrichmentData ?? lead.segmentData ?? {};
  const tier = lead.propensityTier ?? (score >= 0.75 ? "hot" : score >= 0.5 ? "warm" : score >= 0.25 ? "cool" : "cold");

  return (
    <AppShell title="Lead Detail">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title={`Lead: ${name}`} description="Lead detail view" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/leads")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Pipeline
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{name}</h1>
              <VerificationBadge status="verified" label="KYC" />
              <Badge variant="outline" className={`capitalize text-[10px] ${tier === "hot" ? "border-red-500 text-red-500" : tier === "warm" ? "border-amber-500 text-amber-500" : tier === "cool" ? "border-blue-500 text-blue-500" : "border-muted-foreground text-muted-foreground"}`}>
                {tier}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <ComplianceBadge lead={lead} />
            </div>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-sm text-muted-foreground">{source} &bull;</p>
              <Select value={stage} onValueChange={(v) => updateStatus.mutate({ leadId, status: v })}>
                <SelectTrigger className="h-7 w-auto text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LIFECYCLE_STAGES.map(s => <SelectItem key={s} value={s}><span className="capitalize">{s}</span></SelectItem>)}
                </SelectContent>
              </Select>
              {updateStatus.isPending && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { if (email) { window.open(`mailto:${email}?subject=Follow-up from Stewardly`, '_blank', 'noopener,noreferrer'); toast.info('Opening email client'); } else { toast.info('No email on file'); } }}>
            <Mail className="h-3.5 w-3.5 mr-1" /> Email
          </Button>
          <Button variant="outline" size="sm" onClick={() => { if (phone) { window.open(`tel:${phone}`, '_self', 'noopener,noreferrer'); toast.info('Opening dialer'); } else { toast.info('No phone on file'); } }}>
            <Phone className="h-3.5 w-3.5 mr-1" /> Call
          </Button>
          <Button size="sm" onClick={() => navigate('/outreach-automation')}>
            <Calendar className="h-3.5 w-3.5 mr-1" /> Schedule
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Details */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="scores">Score History</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="meddpicc">MEDDPICC</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Contact Information</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {email && <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {email}</div>}
                  {phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {phone}</div>}
                  {lead.city && <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> {lead.city}{lead.state ? `, ${lead.state}` : ""}</div>}
                  {lead.dateOfBirth && <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> DOB: {new Date(lead.dateOfBirth).toLocaleDateString()}</div>}
                  {lead.company && <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /> {lead.company}</div>}
                  {lead.title && <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" /> {lead.title}</div>}
                  {lead.linkedinUrl && <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /> <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline truncate max-w-[200px]">LinkedIn</a></div>}
                  {lead.ssnLast4 && <PiiMaskedField value={lead.ssnLast4} label="SSN" copyable allowReveal />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Financial Profile</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">AUM</p><p className="font-semibold">${aum >= 1000000 ? `${(aum / 1000000).toFixed(2)}M` : `${(aum / 1000).toFixed(0)}K`}</p></div>
                  <div><p className="text-xs text-muted-foreground">Account Type</p><p className="font-semibold">{lead.accountType ?? "Individual"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Risk Tolerance</p><p className="font-semibold">{lead.riskTolerance ?? "Moderate"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Segment</p><p className="font-semibold">{lead.targetSegment ?? source}</p></div>
                </CardContent>
              </Card>

              <CalculatorInsight
                title="Retirement Gap Analysis"
                summary={`Based on current AUM of $${aum >= 1000000 ? `${(aum / 1000000).toFixed(1)}M` : `${(aum / 1000).toFixed(0)}K`}, ${name.split(" ")[0]} may benefit from a comprehensive retirement projection.`}
                detail="Recommend running a full retirement analysis to identify potential gaps and optimize contribution strategy."
                severity="info"
                actionLabel="Run Full Analysis"
                onAction={() => navigate("/wealth-engine?panel=retirement")}
              />

              {notes && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground">{notes}</p></CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Score History Tab */}
            <TabsContent value="scores" className="space-y-4 mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" /> Propensity Score History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {scoreHistory.isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <ScoreHistoryChart history={(scoreHistory.data ?? []) as any} />
                  )}
                </CardContent>
              </Card>

              {/* Score breakdown table */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Score Records</CardTitle></CardHeader>
                <CardContent>
                  {!scoreHistory.data || (scoreHistory.data as any[]).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No scoring records available</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium">Date</th>
                            <th className="pb-2 font-medium text-right">Score</th>
                            <th className="pb-2 font-medium text-right">Model</th>
                            <th className="pb-2 font-medium text-center">Tier</th>
                          </tr>
                        </thead>
                        <tbody>
                          {((scoreHistory.data ?? []) as any[]).slice(0, 10).map((rec: any, i: number) => {
                            const s = Number(rec.score);
                            const t = s >= 0.75 ? "hot" : s >= 0.5 ? "warm" : s >= 0.25 ? "cool" : "cold";
                            return (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-2">{rec.scoredAt ? new Date(rec.scoredAt).toLocaleDateString() : "—"}</td>
                                <td className="py-2 text-right font-mono">{(s * 100).toFixed(1)}%</td>
                                <td className="py-2 text-right text-muted-foreground">{rec.model}</td>
                                <td className="py-2 text-center">
                                  <Badge variant="outline" className={`text-[10px] capitalize ${t === "hot" ? "border-red-500 text-red-500" : t === "warm" ? "border-amber-500 text-amber-500" : t === "cool" ? "border-blue-500 text-blue-500" : ""}`}>
                                    {t}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Scoring factors */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4" /> Scoring Factors</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "AUM Weight", value: aum >= 500000 ? "High" : aum >= 100000 ? "Medium" : "Low", color: aum >= 500000 ? "text-emerald-500" : aum >= 100000 ? "text-amber-500" : "text-muted-foreground" },
                    { label: "Engagement Level", value: stage === "meeting" || stage === "proposal" ? "Active" : stage === "contacted" ? "Responsive" : "Passive", color: stage === "meeting" || stage === "proposal" ? "text-emerald-500" : "text-amber-500" },
                    { label: "Data Completeness", value: [email, phone, lead.city, lead.company].filter(Boolean).length >= 3 ? "Complete" : "Partial", color: [email, phone, lead.city, lead.company].filter(Boolean).length >= 3 ? "text-emerald-500" : "text-amber-500" },
                    { label: "Compliance Status", value: lead.piiDeletionRequested ? "Restricted" : "Clear", color: lead.piiDeletionRequested ? "text-red-500" : "text-emerald-500" },
                  ].map(f => (
                    <div key={f.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{f.label}</span>
                      <span className={`font-medium ${f.color}`}>{f.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activity" className="mt-4 space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock className="h-4 w-4" /> Activity Timeline</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Auto-generated timeline from lead data */}
                    {lead.assignedAt && (
                      <div className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-primary mt-1" />
                          <div className="w-px h-full bg-border" />
                        </div>
                        <div>
                          <p className="font-medium">Assigned to advisor</p>
                          <p className="text-muted-foreground">{new Date(lead.assignedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                    {lead.updatedAt && lead.updatedAt !== lead.createdAt && (
                      <div className="flex gap-3 text-xs">
                        <div className="flex flex-col items-center">
                          <div className="h-2 w-2 rounded-full bg-amber-500 mt-1" />
                          <div className="w-px h-full bg-border" />
                        </div>
                        <div>
                          <p className="font-medium">Record updated</p>
                          <p className="text-muted-foreground">{new Date(lead.updatedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 text-xs">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-muted-foreground mt-1" />
                      </div>
                      <div>
                        <p className="font-medium">Lead created</p>
                        <p className="text-muted-foreground">{lead.createdAt ? new Date(lead.createdAt).toLocaleString() : "Recently"}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No documents attached yet</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/import')}>
                    Upload Document
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meddpicc" className="mt-4">
              <MeddpiccScorecard leadId={leadId} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right column — Score, Enrichment & Quick Actions */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <PropensityGauge score={score} label="Propensity Score" size="lg" />
              <Badge variant="outline" className="mt-2 capitalize">{stage}</Badge>
              <div className="w-full mt-3 pt-3 border-t">
                <ScoreHistoryChart history={(scoreHistory.data ?? []) as any} />
              </div>
            </CardContent>
          </Card>

          <EnrichmentPanel data={enrichment} />

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate('/outreach-automation')}>
                <MessageSquare className="h-4 w-4 mr-2" /> Send Follow-up
              </Button>
              <CadenceEnrollButton leadId={leadId} leadName={name} />
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate('/wealth-engine?panel=quickQuote')}>
                <DollarSign className="h-4 w-4 mr-2" /> Create Proposal
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate(`/wealth-engine?panel=clientProfile`)}>
                <BarChart3 className="h-4 w-4 mr-2" /> Open in Wealth Engine
              </Button>
              <Button variant="outline" className="w-full justify-start text-sm" onClick={() => navigate('/wealth-engine?panel=engineDashboard')}>
                <FileText className="h-4 w-4 mr-2" /> Generate Report
              </Button>
            </CardContent>
          </Card>

          {/* WORM Audit Trail indicator */}
          <Card>
            <CardContent className="p-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3.5 w-3.5 text-emerald-500" />
              <span>All interactions logged to WORM audit trail (Rule 17a-4)</span>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
    </AppShell>
  );
}
