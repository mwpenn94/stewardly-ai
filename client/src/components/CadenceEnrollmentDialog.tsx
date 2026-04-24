/**
 * CadenceEnrollmentDialog — Select a cadence and enroll a lead.
 * GAP-A2-04: Cadence selector with touch preview, calls trpc.cadenceEngine.enrollLead.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Loader2, Mail, Phone, MessageSquare, Linkedin, Zap, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

interface CadenceEnrollmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: number;
  leadName: string;
}

const channelIcon: Record<string, React.ElementType> = {
  email: Mail,
  phone: Phone,
  sms: MessageSquare,
  LinkedIn_InMail: Linkedin,
  LinkedIn: Linkedin,
  direct_mail: Mail,
};

export function CadenceEnrollmentDialog({ open, onOpenChange, leadId, leadName }: CadenceEnrollmentDialogProps) {
  const [selectedCadenceId, setSelectedCadenceId] = useState<string | null>(null);
  const [esiPreApprovalId, setEsiPreApprovalId] = useState("");

  const utils = trpc.useUtils();
  const cadences = trpc.cadenceEngine.listCadences.useQuery(undefined, { enabled: open });
  const cadenceDetail = trpc.cadenceEngine.getCadenceDetail.useQuery(
    { cadenceId: selectedCadenceId! },
    { enabled: !!selectedCadenceId },
  );

  const enrollMutation = trpc.cadenceEngine.enrollLead.useMutation({
    onSuccess: () => {
      toast.success(`${leadName} enrolled in cadence`);
      utils.cadenceEngine.getEnrollments.invalidate();
      onOpenChange(false);
      setSelectedCadenceId(null);
      setEsiPreApprovalId("");
    },
    onError: (err) => toast.error(err.message),
  });

  const handleEnroll = () => {
    if (!selectedCadenceId) return;
    enrollMutation.mutate({
      leadId,
      cadenceId: selectedCadenceId,
      esiPreApprovalId: esiPreApprovalId || undefined,
    });
  };

  const detail = cadenceDetail.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enroll in Cadence</DialogTitle>
          <DialogDescription>Select a cadence for {leadName}</DialogDescription>
        </DialogHeader>

        {cadences.isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Cadence list */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Available Cadences</Label>
              <ScrollArea className="max-h-48">
                <div className="space-y-1.5">
                  {(cadences.data ?? []).map((c: any) => (
                    <Card
                      key={c.id}
                      className={`cursor-pointer transition-colors ${selectedCadenceId === c.id ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}
                      onClick={() => setSelectedCadenceId(c.id)}
                    >
                      <CardContent className="p-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{c.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px]">{c.pattern}</Badge>
                            <span className="text-xs text-muted-foreground">{c.touches} touches</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {(c.channels ?? []).map((ch: string) => {
                            const Icon = channelIcon[ch] || Zap;
                            return <Icon key={ch} className="h-3.5 w-3.5 text-muted-foreground" />;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Touch preview */}
            {selectedCadenceId && detail && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Touch Sequence Preview</Label>
                <ScrollArea className="max-h-40 border rounded-md p-2">
                  <div className="space-y-1.5">
                    {(detail.touches ?? []).map((t: any, i: number) => {
                      const Icon = channelIcon[t.channel] || Zap;
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground w-6 text-right">{i + 1}.</span>
                          <Icon className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">Day {t.day}</span>
                          <span className="truncate">{t.subjectLine || t.channel}</span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
                {detail.esiPreApprovalRequired && (
                  <div className="space-y-1.5">
                    <Label htmlFor="esi-id" className="text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500" />
                      ESI Pre-Approval ID (required)
                    </Label>
                    <Input
                      id="esi-id"
                      value={esiPreApprovalId}
                      onChange={(e) => setEsiPreApprovalId(e.target.value)}
                      placeholder="Enter ESI pre-approval ID"
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {cadenceDetail.isLoading && selectedCadenceId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading cadence details...
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={handleEnroll}
            disabled={!selectedCadenceId || enrollMutation.isPending}
          >
            {enrollMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Enroll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
