import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Streamdown } from "streamdown";
import {
  Calendar, Plus, FileText, Mail, CheckCircle, Clock, AlertTriangle,
  Loader2, ChevronRight, Sparkles, Trash2, ArrowLeft, ClipboardList,
} from "lucide-react";

const MEETING_TYPES = [
  { value: "initial_consultation", label: "Initial Consultation", color: "bg-blue-500/10 text-blue-400" },
  { value: "portfolio_review", label: "Portfolio Review", color: "bg-emerald-500/10 text-emerald-400" },
  { value: "financial_plan", label: "Financial Plan", color: "bg-purple-500/10 text-purple-400" },
  { value: "tax_planning", label: "Tax Planning", color: "bg-amber-500/10 text-amber-400" },
  { value: "estate_planning", label: "Estate Planning", color: "bg-rose-500/10 text-rose-400" },
  { value: "insurance_review", label: "Insurance Review", color: "bg-cyan-500/10 text-cyan-400" },
  { value: "general", label: "General", color: "bg-zinc-500/10 text-zinc-400" },
  { value: "follow_up", label: "Follow-Up", color: "bg-indigo-500/10 text-indigo-400" },
] as const;

const STATUS_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  scheduled: { icon: <Calendar className="w-3.5 h-3.5" />, color: "bg-blue-500/10 text-blue-400", label: "Scheduled" },
  preparing: { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, color: "bg-amber-500/10 text-amber-400", label: "Preparing" },
  in_progress: { icon: <Clock className="w-3.5 h-3.5" />, color: "bg-emerald-500/10 text-emerald-400", label: "In Progress" },
  completed: { icon: <CheckCircle className="w-3.5 h-3.5" />, color: "bg-zinc-500/10 text-zinc-400", label: "Completed" },
  cancelled: { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: "bg-red-500/10 text-red-400", label: "Cancelled" },
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-zinc-500/10 text-zinc-400",
  medium: "bg-blue-500/10 text-blue-400",
  high: "bg-amber-500/10 text-amber-400",
  urgent: "bg-red-500/10 text-red-400",
};

export default function Meetings() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState("meetings");

  // Create form state
  const [newClient, setNewClient] = useState("");
  const [newType, setNewType] = useState<string>("general");
  const [newDate, setNewDate] = useState("");

  // Summary notes state
  const [meetingNotes, setMeetingNotes] = useState("");

  const meetingsList = trpc.meetings.list.useQuery();
  const meetingDetail = trpc.meetings.get.useQuery(
    { id: selectedMeetingId! },
    { enabled: !!selectedMeetingId }
  );
  const actionItems = trpc.meetings.actionItems.useQuery();

  const createMeeting = trpc.meetings.create.useMutation({
    onSuccess: (data) => {
      meetingsList.refetch();
      setSelectedMeetingId(data.id);
      setShowCreate(false);
      setNewClient("");
      setNewType("general");
      setNewDate("");
    },
  });

  const generateBrief = trpc.meetings.generateBrief.useMutation({
    onSuccess: () => meetingDetail.refetch(),
  });

  const generateSummary = trpc.meetings.generateSummary.useMutation({
    onSuccess: () => {
      meetingDetail.refetch();
      actionItems.refetch();
      setMeetingNotes("");
    },
  });

  const generateEmail = trpc.meetings.generateFollowUpEmail.useMutation({
    onSuccess: () => meetingDetail.refetch(),
  });

  const updateAction = trpc.meetings.updateActionItem.useMutation({
    onSuccess: () => {
      actionItems.refetch();
      meetingDetail.refetch();
    },
  });

  const deleteMeeting = trpc.meetings.delete.useMutation({
    onSuccess: () => {
      meetingsList.refetch();
      setSelectedMeetingId(null);
    },
  });

  const meeting = meetingDetail.data;
  const typeConfig = (type: string) => MEETING_TYPES.find(t => t.value === type) || MEETING_TYPES[6];

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full border-border/50">
          <CardContent className="p-8 text-center space-y-4">
            <Calendar className="w-10 h-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Loading Meeting Intelligence...</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold">Meeting Intelligence</h1>
              <p className="text-xs text-muted-foreground">AI-powered meeting prep, summaries, and follow-ups</p>
            </div>
          </div>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Meeting
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule a Meeting</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Client Name</label>
                  <Input
                    placeholder="e.g., John & Sarah Smith"
                    value={newClient}
                    onChange={e => setNewClient(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Meeting Type</label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEETING_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Scheduled Date (optional)</label>
                  <Input type="datetime-local" value={newDate} onChange={e => setNewDate(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!newClient.trim() || createMeeting.isPending}
                  onClick={() => createMeeting.mutate({
                    clientName: newClient.trim(),
                    meetingType: newType as any,
                    scheduledAt: newDate || undefined,
                  })}
                >
                  {createMeeting.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Create Meeting
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="meetings" className="gap-1.5">
              <Calendar className="w-3.5 h-3.5" /> Meetings
            </TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" /> Action Items
              {actionItems.data?.filter(a => a.status === "pending").length ? (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-[10px]">
                  {(Array.isArray(actionItems.data) ? actionItems.data : []).filter(a => a.status === "pending").length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* Meetings Tab */}
          <TabsContent value="meetings">
            {selectedMeetingId && meeting ? (
              <MeetingDetail
                meeting={meeting}
                typeConfig={typeConfig}
                onBack={() => setSelectedMeetingId(null)}
                onGenerateBrief={() => generateBrief.mutate({ meetingId: selectedMeetingId })}
                onGenerateSummary={(notes: string) => generateSummary.mutate({ meetingId: selectedMeetingId, notes })}
                onGenerateEmail={() => generateEmail.mutate({ meetingId: selectedMeetingId })}
                onDelete={() => deleteMeeting.mutate({ id: selectedMeetingId })}
                onUpdateAction={(id: number, status: string) => updateAction.mutate({ id, status: status as any })}
                briefLoading={generateBrief.isPending}
                summaryLoading={generateSummary.isPending}
                emailLoading={generateEmail.isPending}
                meetingNotes={meetingNotes}
                setMeetingNotes={setMeetingNotes}
              />
            ) : (
              <MeetingsList
                meetings={meetingsList.data || []}
                loading={meetingsList.isLoading}
                typeConfig={typeConfig}
                onSelect={setSelectedMeetingId}
              />
            )}
          </TabsContent>

          {/* Action Items Tab */}
          <TabsContent value="actions">
            <ActionItemsList
              items={actionItems.data || []}
              loading={actionItems.isLoading}
              onUpdate={(id: number, status: string) => updateAction.mutate({ id, status: status as any })}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ─── Meetings List ─── */
function MeetingsList({ meetings, loading, typeConfig, onSelect }: {
  meetings: any[];
  loading: boolean;
  typeConfig: (t: string) => { value: string; label: string; color: string };
  onSelect: (id: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-card/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!meetings.length) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center">
          <Calendar className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
          <h3 className="font-medium mb-1">No meetings yet</h3>
          <p className="text-sm text-muted-foreground">Create your first meeting to get AI-powered briefs and summaries.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {meetings.map((m: any) => {
        const tc = typeConfig(m.meetingType || "general");
        const sc = STATUS_CONFIG[m.status || "scheduled"];
        return (
          <Card
            key={m.id}
            className="cursor-pointer hover:bg-accent/30 transition-colors group"
            onClick={() => onSelect(m.id)}
          >
            <CardContent className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium truncate">{m.clientName}</span>
                  <Badge variant="outline" className={`text-[10px] ${tc.color}`}>{tc.label}</Badge>
                  <Badge variant="outline" className={`text-[10px] ${sc.color} gap-1`}>
                    {sc.icon} {sc.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {m.scheduledAt && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(m.scheduledAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                  {m.preMeetingBrief && <Badge variant="secondary" className="text-[10px]">Brief Ready</Badge>}
                  {m.postMeetingSummary && <Badge variant="secondary" className="text-[10px]">Summary Ready</Badge>}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ─── Meeting Detail ─── */
function MeetingDetail({ meeting, typeConfig, onBack, onGenerateBrief, onGenerateSummary, onGenerateEmail, onDelete, onUpdateAction, briefLoading, summaryLoading, emailLoading, meetingNotes, setMeetingNotes }: {
  meeting: any;
  typeConfig: (t: string) => { value: string; label: string; color: string };
  onBack: () => void;
  onGenerateBrief: () => void;
  onGenerateSummary: (notes: string) => void;
  onGenerateEmail: () => void;
  onDelete: () => void;
  onUpdateAction: (id: number, status: string) => void;
  briefLoading: boolean;
  summaryLoading: boolean;
  emailLoading: boolean;
  meetingNotes: string;
  setMeetingNotes: (v: string) => void;
}) {
  const tc = typeConfig(meeting.meetingType || "general");
  const sc = STATUS_CONFIG[meeting.status || "scheduled"];
  const [detailTab, setDetailTab] = useState("brief");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{meeting.clientName}</h2>
            <Badge variant="outline" className={tc.color}>{tc.label}</Badge>
            <Badge variant="outline" className={`${sc.color} gap-1`}>{sc.icon} {sc.label}</Badge>
          </div>
          {meeting.scheduledAt && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {new Date(meeting.scheduledAt).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" className="text-destructive/60 hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Content Tabs */}
      <Tabs value={detailTab} onValueChange={setDetailTab}>
        <TabsList>
          <TabsTrigger value="brief" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Pre-Meeting Brief
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Post-Meeting Summary
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Follow-Up Email
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <ClipboardList className="w-3.5 h-3.5" /> Action Items
            {meeting.actionItems?.filter((a: any) => a.status === "pending").length ? (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 text-[10px]">
                {meeting.actionItems.filter((a: any) => a.status === "pending").length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Pre-Meeting Brief */}
        <TabsContent value="brief" className="mt-4">
          {meeting.preMeetingBrief ? (
            <Card>
              <CardContent className="p-6 prose prose-invert prose-sm max-w-none">
                <Streamdown>{meeting.preMeetingBrief}</Streamdown>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FileText className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-medium mb-1">No brief generated yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate an AI-powered pre-meeting brief with client context, agenda suggestions, and compliance reminders.
                </p>
                <Button onClick={onGenerateBrief} disabled={briefLoading} className="gap-1.5">
                  {briefLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Brief
                </Button>
              </CardContent>
            </Card>
          )}
          {meeting.preMeetingBrief && (
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm" onClick={onGenerateBrief} disabled={briefLoading} className="gap-1.5">
                {briefLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Regenerate
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Post-Meeting Summary */}
        <TabsContent value="summary" className="mt-4 space-y-4">
          {!meeting.postMeetingSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Meeting Notes</CardTitle>
                <CardDescription>Paste your meeting notes or transcript below. The AI will generate a structured summary with action items.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  placeholder="Paste meeting notes, transcript, or key discussion points here..."
                  value={meetingNotes}
                  onChange={e => setMeetingNotes(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button
                  onClick={() => onGenerateSummary(meetingNotes)}
                  disabled={meetingNotes.length < 10 || summaryLoading}
                  className="gap-1.5"
                >
                  {summaryLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Summary
                </Button>
              </CardContent>
            </Card>
          )}
          {meeting.postMeetingSummary && (
            <Card>
              <CardContent className="p-6 prose prose-invert prose-sm max-w-none">
                <Streamdown>{meeting.postMeetingSummary}</Streamdown>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Follow-Up Email */}
        <TabsContent value="email" className="mt-4">
          {meeting.followUpEmail ? (
            <Card>
              <CardContent className="p-6">
                <div className="prose prose-invert prose-sm max-w-none">
                  <Streamdown>{meeting.followUpEmail}</Streamdown>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(meeting.followUpEmail || "")}
                  >
                    Copy to Clipboard
                  </Button>
                  <Button variant="outline" size="sm" onClick={onGenerateEmail} disabled={emailLoading} className="gap-1.5">
                    {emailLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    Regenerate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <Mail className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-medium mb-1">No follow-up email yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {meeting.postMeetingSummary
                    ? "Generate a professional follow-up email based on the meeting summary."
                    : "Generate a post-meeting summary first, then create the follow-up email."}
                </p>
                <Button
                  onClick={onGenerateEmail}
                  disabled={!meeting.postMeetingSummary || emailLoading}
                  className="gap-1.5"
                >
                  {emailLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Generate Email
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Action Items */}
        <TabsContent value="actions" className="mt-4">
          {meeting.actionItems?.length ? (
            <div className="space-y-2">
              {meeting.actionItems.map((item: any) => (
                <Card key={item.id} className={item.status === "completed" ? "opacity-60" : ""}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <button
                      className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        item.status === "completed"
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                          : "border-muted-foreground/30 hover:border-primary"
                      }`}
                      onClick={() => onUpdateAction(item.id, item.status === "completed" ? "pending" : "completed")}
                    >
                      {item.status === "completed" && <CheckCircle className="w-3 h-3" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`font-medium text-sm ${item.status === "completed" ? "line-through" : ""}`}>
                        {item.title}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5">
                        {item.assignedTo && (
                          <Badge variant="outline" className="text-[10px]">{item.assignedTo}</Badge>
                        )}
                        <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority || "medium"]}`}>
                          {item.priority}
                        </Badge>
                        {item.dueDate && (
                          <span className="text-[10px] text-muted-foreground">
                            Due: {new Date(item.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <ClipboardList className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
                <h3 className="font-medium mb-1">No action items</h3>
                <p className="text-sm text-muted-foreground">
                  Action items will be automatically extracted when you generate a post-meeting summary.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Action Items List (Global) ─── */
function ActionItemsList({ items, loading, onUpdate }: {
  items: any[];
  loading: boolean;
  onUpdate: (id: number, status: string) => void;
}) {
  const [filter, setFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter(i => i.status === filter);
  }, [items, filter]);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 bg-card/50 rounded-lg animate-pulse" />)}</div>;
  }

  const pending = items.filter(i => i.status === "pending").length;
  const inProgress = items.filter(i => i.status === "in_progress").length;
  const completed = items.filter(i => i.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setFilter("pending")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-400">{pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setFilter("in_progress")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-400">{inProgress}</p>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent/30 transition-colors" onClick={() => setFilter("completed")}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-1.5">
        {["all", "pending", "in_progress", "completed"].map(f => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="text-xs"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "in_progress" ? "In Progress" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      {/* Items */}
      {filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No action items in this category.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((item: any) => (
            <Card key={item.id} className={item.status === "completed" ? "opacity-60" : ""}>
              <CardContent className="p-4 flex items-start gap-3">
                <button
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                    item.status === "completed"
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "border-muted-foreground/30 hover:border-primary"
                  }`}
                  onClick={() => onUpdate(item.id, item.status === "completed" ? "pending" : "completed")}
                >
                  {item.status === "completed" && <CheckCircle className="w-3 h-3" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium text-sm ${item.status === "completed" ? "line-through" : ""}`}>
                    {item.title}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1.5">
                    {item.assignedTo && <Badge variant="outline" className="text-[10px]">{item.assignedTo}</Badge>}
                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority || "medium"]}`}>
                      {item.priority}
                    </Badge>
                    {item.dueDate && (
                      <span className="text-[10px] text-muted-foreground">
                        Due: {new Date(item.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
