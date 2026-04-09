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
import { useMemo, useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { FinancialScoreCard } from "@/components/FinancialScoreCard";
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
import { trpc } from "@/lib/trpc";

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

export default function ComplianceAudit() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "clean" | "flagged" | "pending" | "reviewed">("all");

  const statsQ = trpc.compliance.getDashboardStats.useQuery(undefined, { retry: false });
  const reviewsQ = trpc.compliance.getReviews.useQuery(
    { limit: 100, status: statusFilter },
    { retry: false },
  );

  const stats = statsQ.data;
  const reviews = reviewsQ.data ?? [];

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
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Compliance Audit" description="Audit trail and regulatory compliance dashboard" />

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
              Live review queue from{" "}
              <code className="font-mono text-xs">compliance.getReviews</code>
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled
          title="CSV export is not yet wired — see REMAINING_ITEMS.md"
        >
          <Download className="h-3.5 w-3.5 mr-1" /> Export Report
        </Button>
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
              Reviews are created automatically when AI responses flow through the
              <code className="font-mono text-xs"> guardrails.screenOutput</code> layer.
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
    </div>
  );
}
