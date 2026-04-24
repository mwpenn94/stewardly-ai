/**
 * ReplyInbox — Shows classified replies with recommended actions.
 * GAP-A2-09: Wires trpc.cadenceEngine.analyzeReply, displays reply classifications,
 * auto-pause status, and recommended next actions.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MessageSquare, ArrowRight, Pause, XCircle, CheckCircle2, AlertTriangle, Mail } from "lucide-react";

interface ReplyInboxProps {
  enrollments: Array<{
    id: number;
    leadId: number;
    cadenceId: string;
    currentTouchNumber: number | null;
    status: string | null;
  }>;
}

const classificationColors: Record<string, { bg: string; icon: React.ElementType }> = {
  interested: { bg: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
  meeting_request: { bg: "bg-blue-500/10 text-blue-400", icon: CheckCircle2 },
  not_interested: { bg: "bg-red-500/10 text-red-400", icon: XCircle },
  opt_out: { bg: "bg-red-500/10 text-red-400", icon: XCircle },
  out_of_office: { bg: "bg-amber-500/10 text-amber-400", icon: Pause },
  question: { bg: "bg-purple-500/10 text-purple-400", icon: MessageSquare },
  referral: { bg: "bg-cyan-500/10 text-cyan-400", icon: ArrowRight },
  neutral: { bg: "bg-muted text-muted-foreground", icon: Mail },
};

export function ReplyInbox({ enrollments }: ReplyInboxProps) {
  const [replyText, setReplyText] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>("");
  const [prospectName, setProspectName] = useState("");
  const [channel, setChannel] = useState<"email" | "LinkedIn" | "phone" | "sms">("email");
  const [analyses, setAnalyses] = useState<Array<{ id: string; text: string; result: any; timestamp: number }>>([]);

  const analyzeMutation = trpc.cadenceEngine.analyzeReply.useMutation({
    onSuccess: (result) => {
      setAnalyses((prev) => [
        { id: `reply-${Date.now()}`, text: replyText, result, timestamp: Date.now() },
        ...prev,
      ]);
      setReplyText("");
      toast.success(`Reply classified: ${result.classification}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const activeEnrollments = enrollments.filter((e) => e.status === "active" || e.status === "paused");
  const selectedEnrollment = activeEnrollments.find((e) => String(e.id) === selectedEnrollmentId);

  const handleAnalyze = () => {
    if (!replyText.trim() || !selectedEnrollment) {
      toast.error("Please select an enrollment and enter reply text");
      return;
    }
    analyzeMutation.mutate({
      replyText,
      cadenceId: selectedEnrollment.cadenceId,
      touchNumber: selectedEnrollment.currentTouchNumber ?? 1,
      prospectName: prospectName || "Prospect",
      channel,
      enrollmentId: selectedEnrollment.id,
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          Reply Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Input form */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Enrollment</Label>
              <Select value={selectedEnrollmentId} onValueChange={setSelectedEnrollmentId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select enrollment" />
                </SelectTrigger>
                <SelectContent>
                  {activeEnrollments.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      #{e.id} — {e.cadenceId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Channel</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Input
            placeholder="Prospect name"
            value={prospectName}
            onChange={(e) => setProspectName(e.target.value)}
            className="h-8 text-xs"
          />
          <Textarea
            placeholder="Paste reply text here..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            rows={3}
            className="text-xs"
          />
          <Button
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzeMutation.isPending || !replyText.trim() || !selectedEnrollmentId}
            className="gap-1.5"
          >
            {analyzeMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
            Analyze Reply
          </Button>
        </div>

        {/* Results */}
        {analyses.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground font-medium">Recent Analyses</p>
            {analyses.slice(0, 5).map((a) => {
              const cls = a.result.classification ?? "neutral";
              const config = classificationColors[cls] ?? classificationColors.neutral;
              const Icon = config.icon;
              return (
                <div key={a.id} className="bg-muted/50 rounded-md p-2.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${config.bg}`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {cls.replace(/_/g, " ")}
                    </Badge>
                    {a.result.shouldPauseCadence && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400">
                        <Pause className="h-3 w-3 mr-1" /> Auto-Paused
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto">
                      {new Date(a.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{a.text}</p>
                  {a.result.recommendedAction && (
                    <div className="flex items-center gap-1 text-xs text-primary">
                      <ArrowRight className="h-3 w-3" />
                      <span>{a.result.recommendedAction}</span>
                    </div>
                  )}
                  {a.result.sentiment && (
                    <span className="text-[10px] text-muted-foreground">Sentiment: {a.result.sentiment}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {analyses.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            No replies analyzed yet. Paste a reply above to classify it.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
