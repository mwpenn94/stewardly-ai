/**
 * ComplianceAudit — audit trail + compliance dashboard (pass 72).
 *
 * Before pass 72 this page rendered a `AUDIT_EVENTS` array of 6
 * hardcoded fake events and a static 94% "Compliance Score". The
 * `compliance.getReviews` + `compliance.getDashboardStats` tRPC
 * procedures existed the whole time reading real rows from the
 * `compliance_reviews` table, but this page never called them.
 *
 * Pass 72 wires the page fully:
 *   - `compliance.getDashboardStats` → real counts of total /
 *     flagged / clean / critical reviews for the caller's userId
 *   - `compliance.getReviews` → real review rows with
 *     `flaggedIssues` parsed out of the JSON column
 *   - Client-side search + severity filter operates on real data
 *   - Export Report button hidden for now (no CSV export proc yet),
 *     with a clarifying tooltip instead of a toast that misleads
 */
import { useMemo, useState, useCallback } from "react";
import { sendFeedback } from "@/lib/feedbackSpecs";
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
import AppShell from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Shield,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  FileText,
  Eye,
  Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { ShareButton } from "@/components/sharing/ShareKit";
import { DisclosureSection } from "@/components/DisclosureSection";
import { ExportDataButton } from "@/components/ExportDataButton";

type SeverityKey = "info" | "success" | "warning" | "critical";

const severityIcon: Record<SeverityKey, typeof Eye> = {
  info: Eye,
  success: CheckCircle2,
  warning: AlertTriangle,
  critical: XCircle,
};

const severityColor: Record<SeverityKey, string> = {
  info: "text-blue-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-red-400",
};

// Map the schema's (status, severity) pair into the UI's single
// severity key. The UI was designed around a simple 4-level scale;
// the schema uses (status ∈ clean/flagged/pending/reviewed) +
// (severity ∈ low/medium/high/critical), so we fold them.
function uiSeverity(row: { status: string; severity: string | null }): SeverityKey {
  if (row.severity === "critical") return "critical";
  if (row.status === "flagged") return "warning";
  if (row.status === "clean") return "success";
  return "info";
}

function formatTime(createdAt: number | string | null | undefined): string {
  if (createdAt == null) return "—";
  const ms = typeof createdAt === "string" ? new Date(createdAt).getTime() : Number(createdAt);
  if (!Number.isFinite(ms)) return "—";
  return new Date(ms).toLocaleString();
}

export default function ComplianceAudit({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const { isAuthenticated } = useAuth();

  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "flagged" | "pending" | "reviewed">("all");
  const [reviewContent, setReviewContent] = useState("");
  const [reviewType, setReviewType] = useState<"chat_response" | "email" | "report" | "marketing" | "recommendation">("chat_response");
  const [showReviewForm, setShowReviewForm] = useState(false);

  const utils = trpc.useUtils();
  const reviewMutation = trpc.compliance.reviewContent.useMutation({
    onSuccess: () => {
      utils.compliance.getReviews.invalidate();
      utils.compliance.getDashboardStats.invalidate();
      setReviewContent("");
      setShowReviewForm(false);
      import("sonner").then(m => m.toast.success("Content submitted for compliance review"));
      sendFeedback("compliance.check_passed");
    },
    onError: (e) => import("sonner").then(m => m.toast.error(e.message)),
  });
  const regBIMutation = trpc.compliance.generateRegBIDoc.useMutation({
    onSuccess: (data) => {
      import("sonner").then(m => m.toast.success("Reg BI document generated"));
      sendFeedback("compliance.check_passed");
    },
    onError: (e) => import("sonner").then(m => m.toast.error(e.message)),
  });

  const handleSubmitReview = useCallback(() => {
    if (!reviewContent.trim()) return;
    reviewMutation.mutate({ content: reviewContent, contentType: reviewType });
  }, [reviewContent, reviewType, reviewMutation]);

  const statsQ = trpc.compliance.getDashboardStats.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const reviewsQ = trpc.compliance.getReviews.useQuery(
    { limit: 100, status: statusFilter },
    { enabled: isAuthenticated, retry: false },
  );

  const stats = statsQ.data;
  const reviews = reviewsQ.data ?? [];

  // G1: Fire compliance.flag_raised when flagged reviews exist
  const prevFlaggedRef = useMemo(() => ({ current: -1 }), []);
  if (stats && stats.flaggedReviews > 0 && stats.flaggedReviews !== prevFlaggedRef.current) {
    if (prevFlaggedRef.current >= 0) sendFeedback("compliance.flag_raised", { count: stats.flaggedReviews });
    prevFlaggedRef.current = stats.flaggedReviews;
  }

  const filtered = useMemo(() => {
    if (!search) return reviews;
    const q = search.toLowerCase();
    return reviews.filter((r: any) => {
      const content = (r.originalContent ?? "").toLowerCase();
      const type = (r.reviewType ?? "").toLowerCase();
      return content.includes(q) || type.includes(q);
    });
  }, [reviews, search]);

  return (
    <Shell title="Compliance Audit">
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Compliance Audit" description="Audit trail and regulatory compliance dashboard" />
      <div className="flex justify-end px-4 pt-2"><ShareButton contentType="compliance" contentId="compliance-audit" contentTitle="Compliance Audit" variant="ghost" size="sm" /></div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/operations")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6" /> Compliance Audit
            </h1>
            <p className="text-sm text-muted-foreground">
              Live review queue for all AI-generated financial guidance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowReviewForm(!showReviewForm)}>
            <Shield className="h-3.5 w-3.5 mr-1" /> {showReviewForm ? "Hide Form" : "Review Content"}
          </Button>
          <ExportDataButton
          data={(filtered ?? []).map((r: any) => ({
            date: r.createdAt ? new Date(r.createdAt).toLocaleString() : "—",
            type: r.contentType ?? "—",
            status: r.status ?? "—",
            score: r.complianceScore ?? "—",
            issues: Array.isArray(r.flaggedIssues) ? r.flaggedIssues.join("; ") : "—",
          }))}
          filename="compliance-audit"
          columns={["date", "type", "status", "score", "issues"]}
          headers={["Date", "Content Type", "Status", "Score", "Flagged Issues"]}
        />
      </div>

      {/* Dashboard tiles — now driven by real stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <FinancialScoreCard
          title="Total Reviews"
          value={stats?.totalReviews ?? 0}
          format="number"
          icon={FileText}
        />
        <FinancialScoreCard
          title="Flagged"
          value={stats?.flaggedReviews ?? 0}
          format="number"
          icon={AlertTriangle}
        />
        <FinancialScoreCard
          title="Clean"
          value={stats?.cleanReviews ?? 0}
          format="number"
          icon={CheckCircle2}
        />
        <FinancialScoreCard
          title="Critical Issues"
          value={stats?.criticalIssues ?? 0}
          format="number"
          icon={XCircle}
        />
        </div>
      </div>

      {/* Submit Content for Review */}
      {showReviewForm && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Submit Content for Compliance Review</h3>
            <div className="flex items-center gap-2">
              <Select value={reviewType} onValueChange={(v: any) => setReviewType(v)}>
                <SelectTrigger className="w-48 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat_response">Chat Response</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="report">Report</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                  <SelectItem value="recommendation">Recommendation</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={() => regBIMutation.mutate({ clientProfile: "Current user profile", recommendation: "General portfolio review" })} disabled={regBIMutation.isPending}>
                {regBIMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <FileText className="h-3 w-3 mr-1" />}
                Generate Reg BI Doc
              </Button>
            </div>
            <textarea
              className="w-full min-h-[100px] p-3 text-sm rounded-md border border-border bg-background resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Paste content to review for compliance..."
              value={reviewContent}
              onChange={(e) => setReviewContent(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowReviewForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmitReview} disabled={!reviewContent.trim() || reviewMutation.isPending}>
                {reviewMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                Submit for Review
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search review content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="clean">Clean</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Review list */}
      {reviewsQ.isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading compliance reviews…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Shield className="w-10 h-10 mx-auto opacity-40" />
            <p>
              {reviews.length === 0
                ? "No compliance reviews on file yet."
                : "No reviews match your search."}
            </p>
            <p className="text-xs">
              Reviews are created automatically as you use the AI assistant.
              The compliance engine monitors every response for regulatory accuracy.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.map((review: any) => {
                const sev = uiSeverity(review);
                const Icon = severityIcon[sev];
                const flaggedIssues = Array.isArray(review.flaggedIssues)
                  ? review.flaggedIssues
                  : [];
                return (
                  <div
                    key={review.id}
                    className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors"
                  >
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${severityColor[sev]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">
                          {review.reviewType || "Review"}
                        </span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {review.status}
                        </Badge>
                        {review.severity && (
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {review.severity}
                          </Badge>
                        )}
                      </div>
                      {review.originalContent && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                          {review.originalContent}
                        </p>
                      )}
                      {flaggedIssues.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {flaggedIssues.slice(0, 5).map((issue: string, i: number) => (
                            <Badge
                              key={i}
                              variant="outline"
                              className="text-[10px] text-amber-600 dark:text-amber-400"
                            >
                              {issue}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {formatTime(review.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
      {/* ═══ Jurisdictional Compliance Awareness ═══ */}
      <Card className="mt-2">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold">Regulatory Compliance Coverage</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            WealthBridge maintains compliance awareness across federal, state, and international regulatory frameworks.
            All content workflows include automated FINRA 2210, SEC, and Reg BI review.
          </p>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Federal */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Federal</Badge>
                <span className="text-xs text-muted-foreground">10 regulations</span>
              </div>
              <div className="space-y-1">
                {['FINRA 2210','FINRA 2111','FINRA 4511','SEC 17a-4','SEC 206(4)-1','Reg BI','ERISA','GLBA','TCPA','CAN-SPAM'].map(r => (
                  <div key={r} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="text-foreground/80">{r}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* State */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">State</Badge>
                <span className="text-xs text-muted-foreground">4 frameworks</span>
              </div>
              <div className="space-y-1">
                {['CCPA/CPRA (California)','NYDFS 500 (New York)','State Insurance Licensing','Blue Sky Laws'].map(r => (
                  <div key={r} className="flex items-center gap-1.5 text-xs">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                    <span className="text-foreground/80">{r}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* International */}
            <div className="border border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">International</Badge>
                <span className="text-xs text-muted-foreground">Awareness</span>
              </div>
              <div className="space-y-1">
                {['GDPR (EU)','MiFID II (EU)','PIPEDA (Canada)'].map(r => (
                  <div key={r} className="flex items-center gap-1.5 text-xs">
                    <Eye className="h-3 w-3 text-amber-400 shrink-0" />
                    <span className="text-foreground/80">{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-3">
            Compliance coverage is maintained through automated review workflows. WORM audit trail (SEC 17a-4) captures all calculator interactions.
            State-specific requirements are validated during client onboarding based on jurisdiction.
          </p>
        </CardContent>
      </Card>
    </div>
    </Shell>
  );
}
