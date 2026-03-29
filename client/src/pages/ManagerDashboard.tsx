import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Shield, CheckCircle, XCircle, Eye, MessageSquare,
  AlertTriangle, Loader2, Sparkles, Clock, TrendingUp, FileText,
} from "lucide-react";
import { useState } from "react";

export default function ManagerDashboard() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [reviewNote, setReviewNote] = useState("");
  const [selectedItem, setSelectedItem] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const reviewQueue = trpc.review.pending.useQuery(undefined, { enabled: !!user });
  const auditTrail = trpc.review.audit.useQuery({ limit: 50 }, { enabled: !!user });
  const feedbackStats = trpc.feedback.stats.useQuery(undefined, { enabled: !!user });

  const approveReview = trpc.review.approve.useMutation({
    onSuccess: () => { utils.review.pending.invalidate(); toast.success("Review approved"); setSelectedItem(null); setReviewNote(""); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const rejectReview = trpc.review.reject.useMutation({
    onSuccess: () => { utils.review.pending.invalidate(); toast.success("Review rejected"); setSelectedItem(null); setReviewNote(""); },
    onError: (e: { message: string }) => toast.error(e.message),
  });

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  const pendingItems = reviewQueue.data || [];
  const pendingCount = pendingItems.length;
  const auditItems = auditTrail.data || [];
  const stats = feedbackStats.data || { total: 0, up: 0, down: 0 };
  const satisfactionRate = stats.total > 0 ? Math.round((stats.up / stats.total) * 100) : 0;

  return (
    <AppShell title="Manager Dashboard">
    <div className="min-h-screen">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Manager Dashboard</span>
          {pendingCount > 0 && <Badge variant="destructive" className="text-[10px]">{pendingCount} pending</Badge>}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-xs text-muted-foreground">Pending Reviews</span></div>
              <p className="text-2xl font-bold">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1"><MessageSquare className="w-4 h-4 text-blue-400" /><span className="text-xs text-muted-foreground">Total Feedback</span></div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-emerald-400" /><span className="text-xs text-muted-foreground">Satisfaction</span></div>
              <p className="text-2xl font-bold">{satisfactionRate}%</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-accent" /><span className="text-xs text-muted-foreground">Audit Entries</span></div>
              <p className="text-2xl font-bold">{auditItems.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="review" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="review" className="gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" /> Review Queue
              {pendingCount > 0 && <Badge variant="destructive" className="text-[10px] ml-1 px-1">{pendingCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5 text-xs"><Eye className="w-3.5 h-3.5" /> Audit Trail</TabsTrigger>
          </TabsList>

          {/* Review Queue */}
          <TabsContent value="review">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Flagged Responses</CardTitle>
                <CardDescription className="text-xs">AI responses flagged for human review due to low confidence or compliance concerns</CardDescription>
              </CardHeader>
              <CardContent>
                {pendingItems.length > 0 ? (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-3">
                      {pendingItems.map((item: any) => (
                        <div key={item.id} className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/5">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="destructive" className="text-[10px]"><Clock className="w-2.5 h-2.5 mr-0.5" /> pending</Badge>
                              {item.autonomyLevel && <Badge variant="secondary" className="text-[10px]">Autonomy: {item.autonomyLevel}</Badge>}
                              {item.confidenceScore != null && <span className="text-xs text-muted-foreground">Confidence: {Math.round(item.confidenceScore * 100)}%</span>}
                            </div>
                            <span className="text-[10px] text-muted-foreground shrink-0">{new Date(item.createdAt).toLocaleString()}</span>
                          </div>
                          {item.aiRecommendation && (
                            <div className="bg-secondary/50 rounded-md p-3 text-sm mb-3 max-h-32 overflow-y-auto">{item.aiRecommendation}</div>
                          )}
                          {item.complianceNotes && <p className="text-xs text-amber-400 mb-2">{item.complianceNotes}</p>}
                          <div className="space-y-2">
                            {selectedItem === item.id && (
                              <Textarea
                                value={reviewNote}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewNote(e.target.value)}
                                placeholder="Add review notes (optional)..."
                                className="bg-secondary border-border text-sm h-20"
                              />
                            )}
                            <div className="flex items-center gap-2">
                              {selectedItem !== item.id ? (
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => setSelectedItem(item.id)}>
                                  <Eye className="w-3 h-3 mr-1" /> Review
                                </Button>
                              ) : (
                                <>
                                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs" onClick={() => approveReview.mutate({ id: item.id, action: reviewNote || undefined })} disabled={approveReview.isPending}>
                                    <CheckCircle className="w-3 h-3 mr-1" /> Approve
                                  </Button>
                                  <Button size="sm" variant="destructive" className="text-xs" onClick={() => rejectReview.mutate({ id: item.id, action: reviewNote || undefined })} disabled={rejectReview.isPending}>
                                    <XCircle className="w-3 h-3 mr-1" /> Reject
                                  </Button>
                                  <Button size="sm" variant="ghost" className="text-xs" onClick={() => { setSelectedItem(null); setReviewNote(""); }}>Cancel</Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No items in review queue</p>
                    <p className="text-xs mt-1">Flagged responses will appear here for human review</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Trail */}
          <TabsContent value="audit">
            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Compliance Audit Trail</CardTitle>
                <CardDescription className="text-xs">All AI interactions logged with compliance metadata, PII detection, and disclaimers</CardDescription>
              </CardHeader>
              <CardContent>
                {auditItems.length > 0 ? (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {auditItems.map((entry: any) => (
                        <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-secondary/20 text-sm">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                            {entry.reviewStatus === "auto_approved" ? (
                              <CheckCircle className="w-4 h-4 text-emerald-400" />
                            ) : entry.reviewStatus === "pending_review" ? (
                              <Clock className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Eye className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-medium">{entry.action}</span>
                              <Badge variant="secondary" className="text-[10px]">{entry.reviewStatus}</Badge>
                              {entry.piiDetected && <Badge variant="destructive" className="text-[10px]">PII Detected</Badge>}
                              {entry.disclaimerAppended && <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">Disclaimer</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{entry.details}</p>
                            <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No audit entries yet</p>
                    <p className="text-xs mt-1">Entries will appear as the AI processes conversations</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}
