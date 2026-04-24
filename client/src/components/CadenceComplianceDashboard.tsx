/**
 * CadenceComplianceDashboard — Cadence-level compliance audit dashboard.
 * GAP-A2-03: Wires trpc.cadenceEngine.getAuditSummary, auditTouch.
 * Shows daily audit samples, monthly summary, ESI tracking, grade distribution.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Shield, CheckCircle2, AlertTriangle, XCircle,
  BarChart3, FileText, Clock, Search, RefreshCw,
} from "lucide-react";

interface CadenceComplianceDashboardProps {
  embedded?: boolean;
}

const gradeColors: Record<string, { bg: string; icon: React.ElementType }> = {
  Pass: { bg: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle2 },
  "Conditional Pass": { bg: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertTriangle },
  Fail: { bg: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

export function CadenceComplianceDashboard({ embedded }: CadenceComplianceDashboardProps) {
  const [auditDialogOpen, setAuditDialogOpen] = useState(false);
  const [auditForm, setAuditForm] = useState({
    touchLogId: 0,
    body: "",
    channel: "email",
    esiPreApprovalId: "",
  });

  const utils = trpc.useUtils();
  const auditSummary = trpc.cadenceEngine.getAuditSummary.useQuery();

  const auditMutation = trpc.cadenceEngine.auditTouch.useMutation({
    onSuccess: (result) => {
      toast.success(`Audit complete: ${result.grade}`);
      utils.cadenceEngine.getAuditSummary.invalidate();
      setAuditDialogOpen(false);
    },
    onError: (err) => toast.error(err.message),
  });

  const summary = auditSummary.data;

  // Compute grade distribution from audits
  const gradeDistribution = useMemo(() => {
    if (!summary?.audits) return { Pass: 0, "Conditional Pass": 0, Fail: 0, total: 0 };
    const dist = { Pass: 0, "Conditional Pass": 0, Fail: 0, total: 0 };
    summary.audits.forEach((a: any) => {
      const grade = a.grade as keyof typeof dist;
      if (grade in dist) (dist as any)[grade]++;
      dist.total++;
    });
    return dist;
  }, [summary]);

  const passRate = gradeDistribution.total > 0
    ? Math.round((gradeDistribution.Pass / gradeDistribution.total) * 100)
    : 0;

  const handleAudit = () => {
    if (!auditForm.body.trim()) {
      toast.error("Please enter message body to audit");
      return;
    }
    auditMutation.mutate({
      touchLogId: auditForm.touchLogId || 1,
      body: auditForm.body,
      channel: auditForm.channel,
      esiPreApprovalId: auditForm.esiPreApprovalId || "N/A",
      auditType: "ad_hoc",
    });
  };

  if (auditSummary.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <CardContent className="py-3">
            <p className="text-2xl font-bold">{gradeDistribution.total}</p>
            <p className="text-[10px] text-muted-foreground">Total Audits</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-3">
            <p className="text-2xl font-bold text-emerald-400">{passRate}%</p>
            <p className="text-[10px] text-muted-foreground">Pass Rate</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-3">
            <p className="text-2xl font-bold text-amber-400">{gradeDistribution["Conditional Pass"]}</p>
            <p className="text-[10px] text-muted-foreground">Conditional</p>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="py-3">
            <p className="text-2xl font-bold text-red-400">{gradeDistribution.Fail}</p>
            <p className="text-[10px] text-muted-foreground">Failures</p>
          </CardContent>
        </Card>
      </div>

      {/* Grade distribution bar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Grade Distribution
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setAuditDialogOpen(true)} className="h-7 text-xs gap-1">
              <Shield className="h-3 w-3" /> Run Audit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {(["Pass", "Conditional Pass", "Fail"] as const).map((grade) => {
            const count = gradeDistribution[grade];
            const pct = gradeDistribution.total > 0 ? (count / gradeDistribution.total) * 100 : 0;
            const config = gradeColors[grade];
            const Icon = config.icon;
            return (
              <div key={grade} className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px] w-28 justify-center ${config.bg}`}>
                  <Icon className="h-3 w-3 mr-1" /> {grade}
                </Badge>
                <Progress value={pct} className="flex-1 h-2" />
                <span className="text-xs font-medium w-12 text-right">{count} ({Math.round(pct)}%)</span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Monthly summary */}
      {summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Monthly Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.monthlyNarrative ? (
              <p className="text-xs text-muted-foreground">{summary.monthlyNarrative}</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {gradeDistribution.total} audits completed this period.
                {gradeDistribution.Fail > 0 && ` ${gradeDistribution.Fail} failure(s) require remediation.`}
                {gradeDistribution["Conditional Pass"] > 0 && ` ${gradeDistribution["Conditional Pass"]} conditional pass(es) need review.`}
              </p>
            )}
            {summary.topFindings && summary.topFindings.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-[10px] text-muted-foreground font-medium">Top Findings</p>
                {summary.topFindings.slice(0, 5).map((f: string, i: number) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent audit entries */}
      {summary?.audits && summary.audits.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Recent Audits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {summary.audits.slice(0, 20).map((audit: any, i: number) => {
                  const config = gradeColors[audit.grade] ?? gradeColors.Pass;
                  const Icon = config.icon;
                  return (
                    <div key={i} className="bg-muted/50 rounded-md p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${config.bg}`}>
                            <Icon className="h-3 w-3 mr-1" /> {audit.grade}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">{audit.auditType}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {audit.timestamp ? new Date(audit.timestamp).toLocaleDateString() : ""}
                        </span>
                      </div>
                      {audit.findings && audit.findings.length > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {audit.findings.slice(0, 2).map((f: string, j: number) => (
                            <p key={j}>• {f}</p>
                          ))}
                        </div>
                      )}
                      {audit.remediation && audit.remediation.length > 0 && (
                        <div className="text-xs text-primary">
                          {audit.remediation.slice(0, 1).map((r: string, j: number) => (
                            <p key={j}>→ {r}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Ad-hoc audit dialog */}
      <Dialog open={auditDialogOpen} onOpenChange={setAuditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Run Compliance Audit</DialogTitle>
            <DialogDescription>Audit a message for FINRA 2210, TCPA, ESI compliance</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Message Body</Label>
              <Textarea
                value={auditForm.body}
                onChange={(e) => setAuditForm((p) => ({ ...p, body: e.target.value }))}
                placeholder="Paste the message content to audit..."
                rows={5}
                className="text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Channel</Label>
                <Input
                  value={auditForm.channel}
                  onChange={(e) => setAuditForm((p) => ({ ...p, channel: e.target.value }))}
                  placeholder="email"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">ESI Pre-Approval ID</Label>
                <Input
                  value={auditForm.esiPreApprovalId}
                  onChange={(e) => setAuditForm((p) => ({ ...p, esiPreApprovalId: e.target.value }))}
                  placeholder="ESI-xxx"
                  className="text-sm"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAuditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAudit} disabled={auditMutation.isPending}>
              {auditMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Run Audit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
