/**
 * EmailCampaigns — Campaign management hub backed by `emailCampaign.*` tRPC.
 *
 * Features:
 *   - Campaign list with status badges and analytics
 *   - Create campaign with AI content generation
 *   - Add recipients and send
 *   - Campaign analytics (delivery, open, click rates)
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Mail, Plus, Send, Sparkles, Loader2, Trash2,
  Users, Eye, MousePointerClick, AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

type ViewMode = "list" | "create" | "detail";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  sending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "urgent", label: "Urgent" },
];

export default function EmailCampaigns() {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  // Create form state
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiTone, setAiTone] = useState<string>("professional");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");

  // Data queries
  const campaigns = trpc.emailCampaign.list.useQuery(undefined, { retry: false });
  const selectedCampaign = trpc.emailCampaign.get.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId, retry: false }
  );
  const analytics = trpc.emailCampaign.analytics.useQuery(
    { campaignId: selectedId! },
    { enabled: !!selectedId && view === "detail", retry: false }
  );
  const recipients = trpc.emailCampaign.getRecipients.useQuery(
    { campaignId: selectedId! },
    { enabled: !!selectedId && view === "detail", retry: false }
  );

  // Mutations
  const createMutation = trpc.emailCampaign.create.useMutation({
    onSuccess: () => {
      toast.success("Campaign created");
      campaigns.refetch();
      resetForm();
      setView("list");
    },
    onError: (err) => toast.error(err.message),
  });
  const deleteMutation = trpc.emailCampaign.delete.useMutation({
    onSuccess: () => {
      toast.success("Campaign deleted");
      campaigns.refetch();
      setView("list");
      setSelectedId(null);
    },
    onError: (err) => toast.error(err.message),
  });
  const generateMutation = trpc.emailCampaign.generateContent.useMutation({
    onSuccess: (data: any) => {
      if (data?.subject) setSubject(data.subject);
      if (data?.bodyHtml) setBodyHtml(data.bodyHtml);
      toast.success("AI content generated");
    },
    onError: (err) => toast.error(`Generation failed: ${err.message}`),
  });
  const sendMutation = trpc.emailCampaign.send.useMutation({
    onSuccess: () => {
      toast.success("Campaign sent successfully");
      campaigns.refetch();
      selectedCampaign.refetch();
    },
    onError: (err) => toast.error(err.message),
  });
  const addRecipientsMutation = trpc.emailCampaign.addRecipients.useMutation({
    onSuccess: () => {
      toast.success("Recipient added");
      recipients.refetch();
      setRecipientEmail("");
      setRecipientName("");
    },
    onError: (err) => toast.error(err.message),
  });

  function resetForm() {
    setName("");
    setSubject("");
    setBodyHtml("");
    setAiPurpose("");
    setAiTone("professional");
  }

  const filteredCampaigns = (campaigns.data || []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell title="Email Campaigns">
      <SEOHead title="Email Campaigns" description="Create and manage outreach campaigns with AI-generated content" />
      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="font-heading text-2xl font-bold">Email Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create AI-powered outreach campaigns. Messages are delivered as in-app notifications.
            </p>
          </div>
          {view === "list" && (
            <Button onClick={() => setView("create")} className="gap-2">
              <Plus className="w-4 h-4" /> New Campaign
            </Button>
          )}
          {view !== "list" && (
            <Button variant="outline" onClick={() => { setView("list"); setSelectedId(null); }}>
              Back to Campaigns
            </Button>
          )}
        </div>

        {/* List View */}
        {view === "list" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search campaigns..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {campaigns.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : campaigns.error ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Failed to load campaigns</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => campaigns.refetch()}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : filteredCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Mail className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-lg font-medium mb-1">No campaigns yet</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your first AI-powered outreach campaign
                  </p>
                  <Button onClick={() => setView("create")} className="gap-2">
                    <Plus className="w-4 h-4" /> Create Campaign
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredCampaigns.map((c: any) => (
                  <Card
                    key={c.id}
                    className="cursor-pointer hover:border-accent/40 transition-colors card-lift"
                    onClick={() => { setSelectedId(c.id); setView("detail"); }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium truncate">{c.name}</h3>
                            <Badge
                              variant="outline"
                              className={STATUS_COLORS[c.status] || STATUS_COLORS.draft}
                            >
                              {c.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{c.subject}</p>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {c.totalRecipients || 0}
                          </span>
                          {c.sentCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Send className="w-3.5 h-3.5" />
                              {c.sentCount}
                            </span>
                          )}
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Create View */}
        {view === "create" && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Campaign Form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="campaign-name">Campaign Name</Label>
                  <Input
                    id="campaign-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Q2 Client Check-in"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-subject">Email Subject</Label>
                  <Input
                    id="campaign-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Your portfolio update is ready"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-body">Message Body</Label>
                  <Textarea
                    id="campaign-body"
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    placeholder="Write your message or generate with AI..."
                    rows={8}
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate({ name, subject, bodyHtml })}
                  disabled={!name || !subject || !bodyHtml || createMutation.isPending}
                  className="w-full gap-2"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create Campaign
                </Button>
              </CardContent>
            </Card>

            {/* AI Generation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-accent" /> AI Content Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="ai-purpose">What's this campaign about?</Label>
                  <Textarea
                    id="ai-purpose"
                    value={aiPurpose}
                    onChange={(e) => setAiPurpose(e.target.value)}
                    placeholder="Quarterly portfolio review reminder for clients with over $500k AUM..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label>Tone</Label>
                  <Select value={aiTone} onValueChange={setAiTone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => generateMutation.mutate({
                    purpose: aiPurpose,
                    tone: aiTone as any,
                  })}
                  disabled={!aiPurpose || generateMutation.isPending}
                  variant="outline"
                  className="w-full gap-2"
                >
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  Generate Content
                </Button>
                <p className="text-xs text-muted-foreground">
                  AI will generate a subject line and message body. You can edit before creating.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detail View */}
        {view === "detail" && selectedId && (
          <div className="space-y-6">
            {selectedCampaign.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : selectedCampaign.error ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Campaign not found</p>
                </CardContent>
              </Card>
            ) : selectedCampaign.data && (
              <>
                {/* Campaign Info */}
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{(selectedCampaign.data as any).name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">{(selectedCampaign.data as any).subject}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={STATUS_COLORS[(selectedCampaign.data as any).status] || STATUS_COLORS.draft}>
                          {(selectedCampaign.data as any).status}
                        </Badge>
                        {(selectedCampaign.data as any).status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => sendMutation.mutate({ campaignId: selectedId })}
                              disabled={sendMutation.isPending}
                              className="gap-1"
                            >
                              {sendMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Send
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => {
                                if (window.confirm("Delete this campaign?")) {
                                  deleteMutation.mutate({ id: selectedId });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/30 rounded-lg p-4 text-sm whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {(selectedCampaign.data as any).bodyHtml || "No content"}
                    </div>
                  </CardContent>
                </Card>

                {/* Analytics */}
                {analytics.data && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-2xl font-bold">{(analytics.data as any).totalRecipients || 0}</div>
                        <div className="text-xs text-muted-foreground">Recipients</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Send className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-2xl font-bold">{(analytics.data as any).deliveryRate || "0"}%</div>
                        <div className="text-xs text-muted-foreground">Delivered</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <Eye className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-2xl font-bold">{(analytics.data as any).openRate || "0"}%</div>
                        <div className="text-xs text-muted-foreground">Opened</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4 text-center">
                        <MousePointerClick className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                        <div className="text-2xl font-bold">{(analytics.data as any).clickRate || "0"}%</div>
                        <div className="text-xs text-muted-foreground">Clicked</div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Recipients */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recipients</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(selectedCampaign.data as any).status === "draft" && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                          placeholder="Email address"
                          value={recipientEmail}
                          onChange={(e) => setRecipientEmail(e.target.value)}
                          type="email"
                        />
                        <Input
                          placeholder="Name (optional)"
                          value={recipientName}
                          onChange={(e) => setRecipientName(e.target.value)}
                          className="sm:w-40"
                        />
                        <Button
                          onClick={() => addRecipientsMutation.mutate({
                            campaignId: selectedId,
                            recipients: [{ email: recipientEmail, name: recipientName || undefined }],
                          })}
                          disabled={!recipientEmail || addRecipientsMutation.isPending}
                          className="gap-1 shrink-0"
                        >
                          {addRecipientsMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                          Add
                        </Button>
                      </div>
                    )}
                    {recipients.isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    ) : (recipients.data as any[])?.length ? (
                      <div className="divide-y divide-border/40">
                        {(recipients.data as any[]).map((r: any) => (
                          <div key={r.id} className="flex items-center justify-between py-2 text-sm">
                            <div>
                              <span className="font-medium">{r.recipientEmail}</span>
                              {r.recipientName && <span className="text-muted-foreground ml-2">{r.recipientName}</span>}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {r.status || "pending"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No recipients added yet
                      </p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
