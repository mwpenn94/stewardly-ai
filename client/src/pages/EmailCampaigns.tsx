/**
 * Email Campaigns Page
 * Full campaign management: create, edit, send, track analytics.
 * Includes AI content generation, recipient management, and campaign analytics.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Mail, Plus, Send, BarChart3, Users, Loader2, Trash2,
  Sparkles, Eye, Edit, Clock, CheckCircle2, AlertCircle,
  ArrowLeft, RefreshCw, Copy, Pause, XCircle,
} from "lucide-react";
import { Link } from "wouter";

export default function EmailCampaigns() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);
  const [showAddRecipients, setShowAddRecipients] = useState(false);
  const [showAIGenerate, setShowAIGenerate] = useState(false);

  // Form state
  const [newCampaign, setNewCampaign] = useState({ name: "", subject: "", bodyHtml: "" });
  const [recipientInput, setRecipientInput] = useState("");
  const [aiPrompt, setAIPrompt] = useState({ purpose: "", tone: "professional" as "professional" | "friendly" | "formal" | "casual" | "urgent", recipientType: "client" as "client" | "prospect" | "partner" | "team" | "general" });

  // Queries
  const campaigns = trpc.emailCampaign.list.useQuery(undefined, { enabled: !!user });
  const selectedDetail = trpc.emailCampaign.get.useQuery(
    { id: selectedCampaign! },
    { enabled: !!selectedCampaign }
  );
  const recipients = trpc.emailCampaign.getRecipients.useQuery(
    { campaignId: selectedCampaign! },
    { enabled: !!selectedCampaign }
  );
  const analytics = trpc.emailCampaign.analytics.useQuery(
    { campaignId: selectedCampaign! },
    { enabled: !!selectedCampaign }
  );

  // Mutations
  const utils = trpc.useUtils();
  const createMut = trpc.emailCampaign.create.useMutation({
    onSuccess: () => { utils.emailCampaign.list.invalidate(); setShowCreate(false); setNewCampaign({ name: "", subject: "", bodyHtml: "" }); toast.success("Campaign created"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.emailCampaign.delete.useMutation({
    onSuccess: () => { utils.emailCampaign.list.invalidate(); setSelectedCampaign(null); toast.success("Campaign deleted"); },
    onError: (e) => toast.error(e.message),
  });
  const sendMut = trpc.emailCampaign.send.useMutation({
    onSuccess: (data) => { utils.emailCampaign.list.invalidate(); utils.emailCampaign.analytics.invalidate(); toast.success(`Sent to ${data.sentCount} recipients`); },
    onError: (e) => toast.error(e.message),
  });
  const addRecipientsMut = trpc.emailCampaign.addRecipients.useMutation({
    onSuccess: (data) => { utils.emailCampaign.getRecipients.invalidate(); utils.emailCampaign.list.invalidate(); setShowAddRecipients(false); setRecipientInput(""); toast.success(`Added ${data.added} recipients`); },
    onError: (e) => toast.error(e.message),
  });
  const removeRecipientMut = trpc.emailCampaign.removeRecipient.useMutation({
    onSuccess: () => { utils.emailCampaign.getRecipients.invalidate(); utils.emailCampaign.list.invalidate(); toast.success("Recipient removed"); },
    onError: (e) => toast.error(e.message),
  });
  const generateMut = trpc.emailCampaign.generateContent.useMutation({
    onSuccess: (data) => { setNewCampaign(prev => ({ ...prev, subject: data.subject, bodyHtml: data.bodyHtml })); setShowAIGenerate(false); toast.success("Content generated"); },
    onError: (e) => toast.error(e.message),
  });

  const parseRecipients = (text: string) => {
    return text.split("\n").filter(l => l.trim()).map(line => {
      const parts = line.split(",").map(p => p.trim());
      return { email: parts[0], name: parts[1] || undefined };
    }).filter(r => r.email.includes("@"));
  };

  const statusColors: Record<string, string> = {
    draft: "bg-zinc-500/10 text-zinc-400",
    scheduled: "bg-blue-500/10 text-blue-500",
    sending: "bg-yellow-500/10 text-yellow-500",
    sent: "bg-green-500/10 text-green-500",
    paused: "bg-orange-500/10 text-orange-500",
    cancelled: "bg-red-500/10 text-red-500",
    pending: "bg-zinc-500/10 text-zinc-400",
    delivered: "bg-green-500/10 text-green-500",
    opened: "bg-blue-500/10 text-blue-500",
    clicked: "bg-purple-500/10 text-purple-500",
    bounced: "bg-red-500/10 text-red-500",
    failed: "bg-red-500/10 text-red-500",
  };

  return (
    <div className="container max-w-7xl py-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/chat">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Mail className="w-6 h-6 text-primary" /> Email Campaigns
          </h1>
          <p className="text-sm text-muted-foreground">Create, manage, and send personalized email campaigns to your clients</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Campaign</DialogTitle>
              <DialogDescription>Set up a new email campaign with AI-powered content generation</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium">Campaign Name</label>
                <Input placeholder="Q1 Market Update" value={newCampaign.name} onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Subject Line</label>
                <Input placeholder="Your Q1 Portfolio Review" value={newCampaign.subject} onChange={e => setNewCampaign(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium">Email Body (HTML)</label>
                <Textarea rows={8} placeholder="<h1>Hello {{recipientName}}</h1>..." value={newCampaign.bodyHtml} onChange={e => setNewCampaign(p => ({ ...p, bodyHtml: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">Use {"{{recipientName}}"} and {"{{recipientEmail}}"} for personalization</p>
              </div>
              <div className="flex gap-2">
                <Dialog open={showAIGenerate} onOpenChange={setShowAIGenerate}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm"><Sparkles className="w-4 h-4 mr-1" /> AI Generate</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>AI Content Generator</DialogTitle>
                      <DialogDescription>Describe your email and let AI write it</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-sm font-medium">Purpose</label>
                        <Textarea rows={3} placeholder="Quarterly portfolio review update for high-net-worth clients..." value={aiPrompt.purpose} onChange={e => setAIPrompt(p => ({ ...p, purpose: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-medium">Tone</label>
                          <Select value={aiPrompt.tone} onValueChange={v => setAIPrompt(p => ({ ...p, tone: v as typeof p.tone }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="formal">Formal</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium">Recipient Type</label>
                          <Select value={aiPrompt.recipientType} onValueChange={v => setAIPrompt(p => ({ ...p, recipientType: v as typeof p.recipientType }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="client">Client</SelectItem>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="partner">Partner</SelectItem>
                              <SelectItem value="team">Team</SelectItem>
                              <SelectItem value="general">General</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button onClick={() => generateMut.mutate(aiPrompt)} disabled={generateMut.isPending || !aiPrompt.purpose} className="w-full">
                        {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                        Generate Email
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                <Button variant="outline" size="sm" onClick={() => { if (newCampaign.bodyHtml) { toast.info("Preview shown below"); } }}>
                  <Eye className="w-4 h-4 mr-1" /> Preview
                </Button>
              </div>
              {newCampaign.bodyHtml && (
                <Card>
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs">Preview</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: newCampaign.bodyHtml }} />
                  </CardContent>
                </Card>
              )}
              <Button onClick={() => createMut.mutate(newCampaign)} disabled={createMut.isPending || !newCampaign.name || !newCampaign.subject || !newCampaign.bodyHtml} className="w-full">
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Campaign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedCampaign}>Campaign Detail</TabsTrigger>
        </TabsList>

        {/* ─── Campaigns List ─────────────────────────────────────── */}
        <TabsContent value="campaigns" className="space-y-4">
          {campaigns.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : !campaigns.data?.length ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <h3 className="font-semibold">No campaigns yet</h3>
                <p className="text-sm text-muted-foreground mt-1">Create your first email campaign to reach your clients</p>
                <Button className="mt-4" onClick={() => setShowCreate(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Create Campaign
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3">
              {campaigns.data.map(c => (
                <Card key={c.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => { setSelectedCampaign(c.id); setActiveTab("detail"); }}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{c.name}</h3>
                          <Badge className={statusColors[c.status || "draft"]}>{c.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{c.subject}</p>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground ml-4">
                        <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.totalRecipients}</span>
                        <span className="flex items-center gap-1"><Send className="w-3.5 h-3.5" /> {c.sentCount}</span>
                        <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> {c.openCount}</span>
                        <span>{new Date(Number(c.createdAt)).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── Campaign Detail ────────────────────────────────────── */}
        <TabsContent value="detail" className="space-y-4">
          {!selectedDetail.data ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <>
              {/* Header */}
              <Card>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">{selectedDetail.data.name}</h2>
                      <p className="text-sm text-muted-foreground">{selectedDetail.data.subject}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColors[selectedDetail.data.status || "draft"]}>{selectedDetail.data.status}</Badge>
                      {selectedDetail.data.status === "draft" && (
                        <>
                          <Button size="sm" onClick={() => sendMut.mutate({ campaignId: selectedDetail.data!.id })} disabled={sendMut.isPending || (selectedDetail.data.totalRecipients || 0) === 0}>
                            {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
                            Send
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteMut.mutate({ id: selectedDetail.data!.id })} disabled={deleteMut.isPending}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              {analytics.data && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{analytics.data.deliveryRate}%</p>
                      <p className="text-xs text-muted-foreground">Delivery Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{analytics.data.openRate}%</p>
                      <p className="text-xs text-muted-foreground">Open Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{analytics.data.clickRate}%</p>
                      <p className="text-xs text-muted-foreground">Click Rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="py-3 text-center">
                      <p className="text-2xl font-bold">{analytics.data.bounceRate}%</p>
                      <p className="text-xs text-muted-foreground">Bounce Rate</p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Recipients */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Recipients ({selectedDetail.data.totalRecipients})</CardTitle>
                    <Dialog open={showAddRecipients} onOpenChange={setShowAddRecipients}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline"><Plus className="w-3.5 h-3.5 mr-1" /> Add</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Recipients</DialogTitle>
                          <DialogDescription>One per line: email, name (name optional)</DialogDescription>
                        </DialogHeader>
                        <Textarea rows={8} placeholder={"john@example.com, John Doe\njane@example.com, Jane Smith"} value={recipientInput} onChange={e => setRecipientInput(e.target.value)} />
                        <Button onClick={() => { const r = parseRecipients(recipientInput); if (r.length && selectedCampaign) addRecipientsMut.mutate({ campaignId: selectedCampaign, recipients: r }); }} disabled={addRecipientsMut.isPending}>
                          {addRecipientsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                          Add {parseRecipients(recipientInput).length} Recipients
                        </Button>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {recipients.isLoading ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  ) : !recipients.data?.length ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No recipients added yet</p>
                  ) : (
                    <div className="space-y-1 max-h-60 overflow-y-auto">
                      {recipients.data.map(r => (
                        <div key={r.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm truncate">{r.recipientName || r.recipientEmail}</span>
                            {r.recipientName && <span className="text-xs text-muted-foreground truncate">{r.recipientEmail}</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={statusColors[r.status || "pending"]} variant="outline">{r.status}</Badge>
                            {r.status === "pending" && (
                              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={(e) => { e.stopPropagation(); removeRecipientMut.mutate({ sendId: r.id }); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Email Preview */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Email Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg p-4 bg-card text-card-foreground">
                    <div className="border-b pb-2 mb-3">
                      <p className="text-sm font-medium">Subject: {selectedDetail.data.subject}</p>
                    </div>
                    <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: selectedDetail.data.bodyHtml }} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
