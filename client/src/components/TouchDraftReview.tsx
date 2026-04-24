/**
 * TouchDraftReview — Preview drafted touches with compliance badges, approve/reject.
 * GAP-A2-05: Shows drafted touch content, compliance grade, approve/reject buttons.
 * Calls trpc.cadenceEngine.draftTouch and trpc.cadenceEngine.logTouch.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Shield, Send, Edit3 } from "lucide-react";

interface TouchDraftReviewProps {
  enrollmentId: number;
  leadId: number;
  cadenceId: string;
  touchNumber: number;
  channel: string;
  leadName: string;
  onComplete?: () => void;
}

const gradeColors: Record<string, string> = {
  Pass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  "Conditional Pass": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Fail: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function TouchDraftReview({
  enrollmentId,
  leadId,
  cadenceId,
  touchNumber,
  channel,
  leadName,
  onComplete,
}: TouchDraftReviewProps) {
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState("");
  const utils = trpc.useUtils();

  const draftMutation = trpc.cadenceEngine.draftTouch.useMutation({
    onSuccess: (data) => {
      setEditedBody(data.draft?.body ?? "");
    },
    onError: (err) => toast.error(`Draft failed: ${err.message}`),
  });

  const logTouchMutation = trpc.cadenceEngine.logTouch.useMutation({
    onSuccess: () => {
      utils.cadenceEngine.getEnrollments.invalidate();
      onComplete?.();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleGenerateDraft = () => {
    draftMutation.mutate({
      enrollmentId,
      prospectData: { name: leadName },
      personalizationInputs: { prospect_first_name: leadName.split(" ")[0] },
      senderSignatureBlock: "Best regards,\nYour Advisor",
    });
  };

  const handleApprove = () => {
    const draft = draftMutation.data?.draft;
    logTouchMutation.mutate({
      enrollmentId,
      leadId,
      cadenceId,
      touchNumber,
      channel,
      status: "approved",
      subjectLine: draft?.subjectLine ?? "",
      bodyPreview: editedBody || (draft?.body?.substring(0, 500) ?? ""),
      complianceGrade: (draft?.complianceGrade as any) ?? "Pass",
      complianceNotes: (draft?.complianceIssues ?? []).join("; "),
    });
    toast.success("Touch approved and logged");
  };

  const handleReject = () => {
    logTouchMutation.mutate({
      enrollmentId,
      leadId,
      cadenceId,
      touchNumber,
      channel,
      status: "skipped",
      complianceNotes: "Rejected by advisor",
    });
    toast.info("Touch skipped");
  };

  const draft = draftMutation.data;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Touch #{touchNumber} Draft Review
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!draft && !draftMutation.isPending && (
          <Button onClick={handleGenerateDraft} variant="outline" size="sm" className="gap-1.5">
            <Edit3 className="h-3.5 w-3.5" /> Generate Draft
          </Button>
        )}

        {draftMutation.isPending && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {draft && (
          <>
            {/* Subject line */}
            {draft.draft?.subjectLine && (
              <div className="text-sm">
                <span className="text-muted-foreground">Subject: </span>
                <span className="font-medium">{draft.draft.subjectLine}</span>
              </div>
            )}

            {/* Body */}
            {editing ? (
              <Textarea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={6}
                className="text-sm"
              />
            ) : (
              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                {editedBody || draft.draft?.body || "No content"}
              </div>
            )}

            {/* Compliance badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {draft.readyToSend ? (
                <Badge variant="outline" className={gradeColors["Pass"]}>
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Ready to Send
                </Badge>
              ) : (
                <Badge variant="outline" className={gradeColors["Conditional Pass"]}>
                  <AlertTriangle className="h-3 w-3 mr-1" /> {(draft.issues ?? []).length} Issue(s)
                </Badge>
              )}
              {draft.draft?.complianceGrade && (
                <Badge variant="outline" className={gradeColors[draft.draft.complianceGrade] ?? ""}>
                  {draft.draft.complianceGrade}
                </Badge>
              )}
            </div>

            {/* Issues list */}
            {(draft.issues ?? []).length > 0 && (
              <div className="text-xs space-y-1">
                {(draft.issues as string[]).map((issue, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-amber-400">
                    <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleApprove} disabled={logTouchMutation.isPending} className="gap-1.5">
                {logTouchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Approve & Log
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)} className="gap-1.5">
                <Edit3 className="h-3.5 w-3.5" /> {editing ? "Preview" : "Edit"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleReject} disabled={logTouchMutation.isPending} className="text-destructive gap-1.5">
                <XCircle className="h-3.5 w-3.5" /> Skip
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
