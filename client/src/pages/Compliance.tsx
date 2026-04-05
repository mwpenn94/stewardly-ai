import { useState, useMemo } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Shield, AlertTriangle, CheckCircle, FileText,
  Loader2, Search, ChevronDown, ChevronUp, Scale,
  ClipboardCheck, BarChart3, XCircle, Info,
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: typeof AlertTriangle }> = {
  critical: { color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  high: { color: "text-orange-400", bg: "bg-orange-500/10", icon: AlertTriangle },
  warning: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  medium: { color: "text-amber-400", bg: "bg-amber-500/10", icon: AlertTriangle },
  low: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info },
  info: { color: "text-blue-400", bg: "bg-blue-500/10", icon: Info },
  clean: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle },
};

export default function Compliance() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("review");
  const [content, setContent] = useState("");
  const [contentType, setContentType] = useState<string>("chat_response");
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  // Queries
  const stats = trpc.compliance.getDashboardStats.useQuery(undefined, { enabled: !!user });
  const reviews = trpc.compliance.getReviews.useQuery({ limit: 50, status: "all" }, { enabled: !!user });
  const rules = trpc.compliance.getRules.useQuery(undefined, { enabled: !!user });

  // Mutations
  const reviewMutation = trpc.compliance.reviewContent.useMutation({
    onSuccess: () => {
      reviews.refetch();
      stats.refetch();
    },
  });

  const regBIMutation = trpc.compliance.generateRegBIDoc.useMutation();

  const [regBIProfile, setRegBIProfile] = useState("");
  const [regBIRec, setRegBIRec] = useState("");
  const [regBIAlts, setRegBIAlts] = useState("");

  const handleReview = () => {
    if (!content.trim()) return;
    reviewMutation.mutate({
      content: content.trim(),
      contentType: contentType as "chat_response" | "email" | "report" | "marketing" | "recommendation",
    });
  };

  const handleRegBI = () => {
    if (!regBIProfile.trim() || !regBIRec.trim()) return;
    regBIMutation.mutate({
      clientProfile: regBIProfile.trim(),
      recommendation: regBIRec.trim(),
      alternatives: regBIAlts.trim() || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" /> Compliance Center
            </h1>
            <p className="text-xs text-muted-foreground">FINRA 2210 · SEC · Reg BI content review and documentation</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats.data && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums">{stats.data.totalReviews}</p>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{stats.data.cleanReviews}</p>
                <p className="text-xs text-muted-foreground">Clean</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-amber-400">{stats.data.flaggedReviews}</p>
                <p className="text-xs text-muted-foreground">Flagged</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-red-400">{stats.data.criticalIssues}</p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold font-mono tabular-nums text-blue-400">{stats.data.complianceRate}%</p>
                <p className="text-xs text-muted-foreground">Compliance Rate</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="review" className="gap-1.5"><Search className="w-3.5 h-3.5" /> Content Review</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5"><FileText className="w-3.5 h-3.5" /> History</TabsTrigger>
            <TabsTrigger value="regbi" className="gap-1.5"><Scale className="w-3.5 h-3.5" /> Reg BI Docs</TabsTrigger>
            <TabsTrigger value="rules" className="gap-1.5"><ClipboardCheck className="w-3.5 h-3.5" /> Rules</TabsTrigger>
          </TabsList>

          {/* ─── Content Review Tab ───────────────────────────────── */}
          <TabsContent value="review">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Input */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Submit Content for Review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={contentType} onValueChange={setContentType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Content type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat_response">Chat Response</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="report">Report</SelectItem>
                      <SelectItem value="marketing">Marketing Material</SelectItem>
                      <SelectItem value="recommendation">Recommendation</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Paste the content you want reviewed for compliance..."
                    rows={10}
                    className="resize-none"
                  />
                  <Button
                    onClick={handleReview}
                    disabled={!content.trim() || reviewMutation.isPending}
                    className="w-full"
                  >
                    {reviewMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Analyzing...</>
                    ) : (
                      <><Shield className="w-4 h-4 mr-2" /> Review for Compliance</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Results */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Review Results</CardTitle>
                </CardHeader>
                <CardContent>
                  {!reviewMutation.data && !reviewMutation.isPending && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Shield className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Submit content to see compliance analysis</p>
                    </div>
                  )}

                  {reviewMutation.isPending && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-400" />
                      <p className="text-sm text-muted-foreground">Analyzing against FINRA 2210, SEC, and Reg BI rules...</p>
                    </div>
                  )}

                  {reviewMutation.data && (
                    <div className="space-y-4">
                      {/* Overall Status */}
                      <div className={`p-3 rounded-lg ${reviewMutation.data.isClean ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-amber-500/10 border border-amber-500/20"}`}>
                        <div className="flex items-center gap-2">
                          {reviewMutation.data.isClean ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <AlertTriangle className="w-5 h-5 text-amber-400" />
                          )}
                          <span className="text-sm font-medium">
                            {reviewMutation.data.isClean ? "Content is compliant" : `${reviewMutation.data.flags.length} issue(s) found`}
                          </span>
                          <Badge className={`ml-auto ${SEVERITY_CONFIG[reviewMutation.data.overallSeverity]?.bg || ""} ${SEVERITY_CONFIG[reviewMutation.data.overallSeverity]?.color || ""}`}>
                            {reviewMutation.data.overallSeverity}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{reviewMutation.data.summary}</p>
                      </div>

                      {/* Individual Flags */}
                      {reviewMutation.data.flags.map((flag: any, i: number) => {
                        const sev = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.info;
                        const Icon = sev.icon;
                        return (
                          <div key={i} className={`p-3 rounded-lg border ${sev.bg}`}>
                            <div className="flex items-start gap-2">
                              <Icon className={`w-4 h-4 mt-0.5 ${sev.color}`} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-[10px]">{flag.rule_code}</Badge>
                                  <Badge className={`text-[10px] ${sev.bg} ${sev.color}`}>{flag.severity}</Badge>
                                </div>
                                <p className="text-xs">{flag.description}</p>
                                {flag.original_text && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">"{flag.original_text}"</p>
                                )}
                                <p className="text-xs text-emerald-400 mt-1">Fix: {flag.suggested_fix}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Corrected Content */}
                      {!reviewMutation.data.isClean && reviewMutation.data.correctedContent && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-emerald-400">Corrected Version:</p>
                          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-xs whitespace-pre-wrap">
                            {reviewMutation.data.correctedContent}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(reviewMutation.data!.correctedContent);
                            }}
                            className="text-xs"
                          >
                            Copy Corrected Content
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── History Tab ───────────────────────────────────────── */}
          <TabsContent value="history">
            <div className="space-y-3">
              {reviews.isLoading && (
                <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
              )}
              {reviews.data?.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="w-8 h-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm text-muted-foreground">No compliance reviews yet</p>
                  </CardContent>
                </Card>
              )}
              {reviews.data?.map((review: any) => {
                const sev = SEVERITY_CONFIG[review.severity] || SEVERITY_CONFIG.info;
                const isExpanded = expandedReview === review.id;
                return (
                  <Card key={review.id} className={`cursor-pointer transition-colors hover:bg-secondary/30`} onClick={() => setExpandedReview(isExpanded ? null : review.id)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`${sev.bg} ${sev.color}`}>{review.status}</Badge>
                          <Badge variant="outline" className="text-[10px]">{review.reviewType}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${sev.color}`}>{review.severity}</Badge>
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </div>
                      </div>
                      {review.originalContent && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{review.originalContent}</p>
                      )}
                      {isExpanded && review.flaggedIssues?.length > 0 && (
                        <div className="mt-3 space-y-2 border-t border-border/40 pt-3">
                          {review.flaggedIssues.map((flag: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 text-xs">
                              <AlertTriangle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                              <div>
                                <span className="font-medium">{flag.rule_code}:</span> {flag.description}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* ─── Reg BI Documentation Tab ──────────────────────────── */}
          <TabsContent value="regbi">
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4 text-purple-400" /> Generate Reg BI Documentation
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-xs font-medium mb-1 block">Client Profile</label>
                    <Textarea
                      value={regBIProfile}
                      onChange={(e) => setRegBIProfile(e.target.value)}
                      placeholder="Risk tolerance, objectives, time horizon, financial situation..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Recommendation</label>
                    <Textarea
                      value={regBIRec}
                      onChange={(e) => setRegBIRec(e.target.value)}
                      placeholder="What product/strategy is being recommended and why..."
                      rows={4}
                      className="resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block">Alternatives Considered (optional)</label>
                    <Textarea
                      value={regBIAlts}
                      onChange={(e) => setRegBIAlts(e.target.value)}
                      placeholder="Other options evaluated..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <Button
                    onClick={handleRegBI}
                    disabled={!regBIProfile.trim() || !regBIRec.trim() || regBIMutation.isPending}
                    className="w-full"
                  >
                    {regBIMutation.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                    ) : (
                      <><FileText className="w-4 h-4 mr-2" /> Generate Reg BI Package</>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Generated Documentation</CardTitle>
                </CardHeader>
                <CardContent>
                  {!regBIMutation.data && !regBIMutation.isPending && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Scale className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Fill in the form to generate Reg BI documentation</p>
                    </div>
                  )}
                  {regBIMutation.isPending && (
                    <div className="text-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-400" />
                      <p className="text-sm text-muted-foreground">Generating compliance documentation...</p>
                    </div>
                  )}
                  {regBIMutation.data && (
                    <div className="space-y-3">
                      <div className="p-3 rounded-lg bg-secondary/30 text-xs whitespace-pre-wrap max-h-[500px] overflow-y-auto">
                        {regBIMutation.data.document}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(regBIMutation.data!.document)}
                        className="text-xs"
                      >
                        Copy Document
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── Rules Reference Tab ──────────────────────────────── */}
          <TabsContent value="rules">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground mb-4">Compliance rules applied during content review</p>
              {rules.data?.map((rule: any) => (
                <Card key={rule.code}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="mt-0.5">
                      <ClipboardCheck className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] font-mono">{rule.code}</Badge>
                        <span className="text-sm font-medium">{rule.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{rule.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
