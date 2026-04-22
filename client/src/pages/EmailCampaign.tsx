/**
 * EmailCampaign.tsx — Full email campaign management page.
 *
 * Features:
 * - Campaign list with status badges and quick actions
 * - Create/edit campaign with rich text editor
 * - AI-powered content generation
 * - Recipient management (manual + import from CRM)
 * - Campaign analytics dashboard
 * - Schedule and send campaigns
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import DOMPurify from "dompurify";
import EmailTemplateBuilder from "@/components/EmailTemplateBuilder";
import { toast } from "sonner";
import {
  Mail,
  Plus,
  Send,
  BarChart3,
  Users,
  Pencil,
  Trash2,
  Clock,
  CheckCircle2,
  XCircle,
  Pause,
  Sparkles,
  ArrowLeft,
  Eye,
  UserPlus,
  X,
  Calendar,
  Loader2,
  AlertCircle,
  Copy,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { SEOHead } from "@/components/SEOHead";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";

// ─── Types ─────────────────────────────────────────────────────────
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
type ViewMode = "list" | "create" | "edit" | "detail" | "analytics";

interface Campaign {
  id: number;
  name: string;
  subject: string;
  bodyHtml: string;
  status: CampaignStatus;
  totalRecipients: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  scheduledAt: number | null;
  sentAt: number | null;
  createdAt: number;
  updatedAt: number;
}

// ─── Status helpers ────────────────────────────────────────────────
const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: typeof Mail }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground", icon: Pencil },
  scheduled: { label: "Scheduled", color: "bg-blue-500/10 text-blue-500", icon: Clock },
  sending: { label: "Sending", color: "bg-amber-500/10 text-amber-500", icon: Send },
  sent: { label: "Sent", color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
  paused: { label: "Paused", color: "bg-orange-500/10 text-orange-500", icon: Pause },
  cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-500", icon: XCircle },
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  const Icon = config.icon;
  return (
    <Badge variant="secondary" className={cn("gap-1", config.color)}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  );
}

// ─── Campaign List ─────────────────────────────────────────────────
function CampaignList({
  onView,
  onCreate,
  onEdit,
}: {
  onView: (id: number) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
}) {
  const campaignsQ = trpc.emailCampaign.list.useQuery();
  const { data: campaigns, isLoading } = campaignsQ;
  const utils = trpc.useUtils();
  const deleteMut = trpc.emailCampaign.delete.useMutation({
    onSuccess: () => {
      utils.emailCampaign.list.invalidate();
      toast.success("Campaign deleted");
    },
    onError: () => toast.error("Failed to delete campaign"),
  });
  const [deleteId, setDeleteId] = useState<number | null>(null);

  if (campaignsQ.isError) {
    return <QueryErrorBanner query={campaignsQ} label="campaigns" />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const campaignList = (campaigns || []) as Campaign[];

  if (campaignList.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No campaigns yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Create your first email campaign to engage clients, nurture prospects, or share market
            insights with your audience.
          </p>
          <Button onClick={onCreate} className="gap-2">
            <Plus className="w-4 h-4" />
            Create Campaign
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {campaignList.map((campaign) => (
          <Card
            key={campaign.id}
            className="hover:border-primary/30 transition-colors cursor-pointer"
            onClick={() => onView(campaign.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{campaign.name}</h3>
                    <StatusBadge status={campaign.status} />
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{campaign.subject}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {campaign.totalRecipients} recipients
                    </span>
                    {campaign.sentCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Send className="w-3 h-3" />
                        {campaign.sentCount} sent
                      </span>
                    )}
                    {campaign.openCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        {campaign.openCount} opened
                      </span>
                    )}
                    <span>
                      {new Date(campaign.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(campaign.id); }}>
                      <Pencil className="w-4 h-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(campaign.id); }}>
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => { e.stopPropagation(); setDeleteId(campaign.id); }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteId) {
                  deleteMut.mutate({ id: deleteId });
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Campaign Editor ───────────────────────────────────────────────
function CampaignEditor({
  campaignId,
  onBack,
  onSaved,
}: {
  campaignId?: number;
  onBack: () => void;
  onSaved: (id: number) => void;
}) {
  const [, navigate] = useLocation();
  const isEdit = !!campaignId;
  const { data: existing } = trpc.emailCampaign.get.useQuery(
    { id: campaignId! },
    { enabled: isEdit }
  );
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [tone, setTone] = useState<string>("professional");
  const [recipientType, setRecipientType] = useState<string>("client");
  const [aiPrompt, setAiPrompt] = useState("");
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  if (isEdit && existing && !initialized) {
    const c = existing as Campaign;
    setName(c.name);
    setSubject(c.subject);
    setBodyHtml(c.bodyHtml);
    setInitialized(true);
  }

  const createMut = trpc.emailCampaign.create.useMutation({
    onSuccess: (data: any) => {
      utils.emailCampaign.list.invalidate();
      toast.success("Campaign created");
      onSaved(data.id);
    },
    onError: () => toast.error("Failed to create campaign"),
  });

  const updateMut = trpc.emailCampaign.update.useMutation({
    onSuccess: () => {
      utils.emailCampaign.list.invalidate();
      toast.success("Campaign updated");
      onBack();
    },
    onError: () => toast.error("Failed to update campaign"),
  });

  const generateMut = trpc.emailCampaign.generateContent.useMutation({
    onSuccess: (data: any) => {
      if (data.subject) setSubject(data.subject);
      if (data.bodyHtml) setBodyHtml(data.bodyHtml);
      toast.success("AI content generated");
      setShowAiPanel(false);
    },
    onError: () => toast.error("AI generation failed — try again"),
  });

  const handleSave = useCallback(() => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (isEdit && campaignId) {
      updateMut.mutate({ id: campaignId, name, subject, bodyHtml });
    } else {
      createMut.mutate({ name, subject, bodyHtml });
    }
  }, [name, subject, bodyHtml, isEdit, campaignId, createMut, updateMut]);

  const handleGenerate = useCallback(() => {
    if (!aiPrompt.trim()) {
      toast.error("Describe what the email should be about");
      return;
    }
    generateMut.mutate({
      purpose: aiPrompt,
      tone: tone as any,
      recipientType: recipientType as any,
    });
  }, [aiPrompt, tone, recipientType, generateMut]);

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate("/operations")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Operations
      </button>
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Button>
        <h2 className="text-lg font-semibold">
          {isEdit ? "Edit Campaign" : "New Campaign"}
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main editor */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <Label htmlFor="campaign-name">Campaign Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Q2 Client Newsletter"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="campaign-subject">Email Subject</Label>
            <Input
              id="campaign-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Your Q2 Financial Review is Ready"
              className="mt-1"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="campaign-body">Email Body</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => setShowAiPanel(!showAiPanel)}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Generate
                </Button>
              </div>
            </div>
            <EmailTemplateBuilder
              // @ts-expect-error — strict mode type fix
              value={bodyHtml}
              onChange={setBodyHtml}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use {"{{recipientName}}"}, {"{{recipientEmail}}"}, {"{{senderName}}"}, {"{{companyName}}"} for personalization.
            </p>
          </div>

          {/* Preview */}
          {bodyHtml && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Preview
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-sm dark:prose-invert max-w-none">
                <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => `[${k}]`)) }} />
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* AI Generation Panel */}
          {showAiPanel && (
            <Card className="border-primary/30">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  AI Content Generator
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">What should this email be about?</Label>
                  <Textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Quarterly portfolio review for high-net-worth clients, highlighting market performance and upcoming strategy adjustments"
                    className="mt-1 min-h-[80px] text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
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
                    <Label className="text-xs">Audience</Label>
                    <Select value={recipientType} onValueChange={setRecipientType}>
                      <SelectTrigger className="mt-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Clients</SelectItem>
                        <SelectItem value="prospect">Prospects</SelectItem>
                        <SelectItem value="partner">Partners</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generateMut.isPending || !aiPrompt.trim()}
                  className="w-full gap-2"
                  size="sm"
                >
                  {generateMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Generate Content
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Save actions */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Button onClick={handleSave} disabled={isSaving} className="w-full gap-2">
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isEdit ? "Update Campaign" : "Save as Draft"}
              </Button>
              <Button variant="outline" onClick={onBack} className="w-full">
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Campaign Detail ───────────────────────────────────────────────
function CampaignDetail({
  campaignId,
  onBack,
  onEdit,
}: {
  campaignId: number;
  onBack: () => void;
  onEdit: () => void;
}) {
  const { data: campaign, isLoading } = trpc.emailCampaign.get.useQuery({ id: campaignId });
  const { data: recipients } = trpc.emailCampaign.getRecipients.useQuery({ campaignId });
  const { data: analytics } = trpc.emailCampaign.analytics.useQuery({ campaignId });
  const utils = trpc.useUtils();

  const sendMut = trpc.emailCampaign.send.useMutation({
    onSuccess: () => {
      utils.emailCampaign.get.invalidate({ id: campaignId });
      utils.emailCampaign.analytics.invalidate({ campaignId });
      utils.emailCampaign.list.invalidate();
      toast.success("Campaign sent successfully");
    },
    onError: () => toast.error("Failed to send campaign"),
  });

  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  const addRecipientMut = trpc.emailCampaign.addRecipients.useMutation({
    onSuccess: () => {
      utils.emailCampaign.getRecipients.invalidate({ campaignId });
      utils.emailCampaign.get.invalidate({ id: campaignId });
      toast.success("Recipient added");
      setNewEmail("");
      setNewName("");
      setShowAddRecipient(false);
    },
    onError: () => toast.error("Failed to add recipient"),
  });

  const removeRecipientMut = trpc.emailCampaign.removeRecipient.useMutation({
    onSuccess: () => {
      utils.emailCampaign.getRecipients.invalidate({ campaignId });
      utils.emailCampaign.get.invalidate({ id: campaignId });
      toast.success("Recipient removed");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const c = campaign as Campaign | undefined;
  if (!c) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <AlertCircle className="w-8 h-8 mb-2" />
        <p>Campaign not found</p>
        <Button variant="link" onClick={onBack}>Go back</Button>
      </div>
    );
  }

  const recipientList = (recipients || []) as Array<{
    id: number;
    recipientEmail: string;
    recipientName: string | null;
    status: string;
  }>;
  const analyticsData = analytics as {
    totalSent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    failed: number;
  } | undefined;

  const openRate = c.sentCount > 0 ? ((c.openCount / c.sentCount) * 100).toFixed(1) : "0.0";
  const clickRate = c.sentCount > 0 ? ((c.clickCount / c.sentCount) * 100).toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{c.name}</h2>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-sm text-muted-foreground">{c.subject}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {c.status === "draft" && (
            <>
              <Button variant="outline" size="sm" onClick={onEdit} className="gap-1">
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <Button
                size="sm"
                onClick={() => sendMut.mutate({ campaignId })}
                disabled={sendMut.isPending || recipientList.length === 0}
                className="gap-1"
              >
                {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Now
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recipients">
            Recipients ({recipientList.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{c.totalRecipients}</div>
                <p className="text-xs text-muted-foreground">Total Recipients</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{c.sentCount}</div>
                <p className="text-xs text-muted-foreground">Messages Sent</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{openRate}%</div>
                <p className="text-xs text-muted-foreground">Open Rate</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{clickRate}%</div>
                <p className="text-xs text-muted-foreground">Click Rate</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Campaign Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Updated</span>
                <span>{new Date(c.updatedAt).toLocaleString()}</span>
              </div>
              {c.scheduledAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scheduled For</span>
                  <span>{new Date(c.scheduledAt).toLocaleString()}</span>
                </div>
              )}
              {c.sentAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sent At</span>
                  <span>{new Date(c.sentAt).toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipients Tab */}
        <TabsContent value="recipients" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {recipientList.length} recipient{recipientList.length !== 1 ? "s" : ""}
            </p>
            {c.status === "draft" && (
              <Button size="sm" onClick={() => setShowAddRecipient(true)} className="gap-1">
                <UserPlus className="w-4 h-4" />
                Add Recipient
              </Button>
            )}
          </div>

          {recipientList.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No recipients added yet</p>
                <p className="text-xs mt-1">Add recipients manually or import from your CRM</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {recipientList.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card"
                >
                  <div>
                    <p className="text-sm font-medium">{r.recipientName || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{r.recipientEmail}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {r.status}
                    </Badge>
                    {c.status === "draft" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRecipientMut.mutate({ sendId: r.id })}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add recipient dialog */}
          <Dialog open={showAddRecipient} onOpenChange={setShowAddRecipient}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Recipient</DialogTitle>
                <DialogDescription>
                  Add a recipient to this campaign.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="recipient-email">Email Address</Label>
                  <Input
                    id="recipient-email"
                    type="email" autoComplete="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="client@example.com"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="recipient-name">Name (optional)</Label>
                  <Input
                    id="recipient-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="John Smith"
                    className="mt-1"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddRecipient(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!newEmail.trim()) {
                      toast.error("Email is required");
                      return;
                    }
                    addRecipientMut.mutate({
                      campaignId,
                      recipients: [{ email: newEmail, name: newName || undefined }],
                    });
                  }}
                  disabled={addRecipientMut.isPending}
                >
                  {addRecipientMut.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Add
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {analyticsData ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-green-500">{analyticsData.delivered}</div>
                  <p className="text-xs text-muted-foreground mt-1">Delivered</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-blue-500">{analyticsData.opened}</div>
                  <p className="text-xs text-muted-foreground mt-1">Opened</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-primary">{analyticsData.clicked}</div>
                  <p className="text-xs text-muted-foreground mt-1">Clicked</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-red-500">{analyticsData.bounced}</div>
                  <p className="text-xs text-muted-foreground mt-1">Bounced</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold text-orange-500">{analyticsData.failed}</div>
                  <p className="text-xs text-muted-foreground mt-1">Failed</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <div className="text-3xl font-bold">{analyticsData.totalSent}</div>
                  <p className="text-xs text-muted-foreground mt-1">Total Sent</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-muted-foreground">
                <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No analytics data yet</p>
                <p className="text-xs mt-1">Send the campaign to start tracking performance</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Email Preview</CardTitle>
              <CardDescription>Subject: {c.subject}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-white dark:bg-zinc-900">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(c.bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, k) => `<span class="text-primary font-medium">[${k}]</span>`)),
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function EmailCampaign({ embedded = false }: { embedded?: boolean } = {}) {
  const [view, setView] = useState<ViewMode>("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  return (
    <>
    <SEOHead title="Email Campaign" description="Create and manage email campaigns for client outreach." />
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      {view === "list" && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Mail className="w-6 h-6" />
              Email Campaigns
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create, manage, and track AI-powered email campaigns for your clients and prospects.
            </p>
          </div>
          <Button onClick={() => setView("create")} className="gap-2">
            <Plus className="w-4 h-4" />
            New Campaign
          </Button>
        </div>
      )}

      {/* View routing */}
      {view === "list" && (
        <CampaignList
          onCreate={() => setView("create")}
          onView={(id) => { setSelectedId(id); setView("detail"); }}
          onEdit={(id) => { setSelectedId(id); setView("edit"); }}
        />
      )}

      {view === "create" && (
        <CampaignEditor
          onBack={() => setView("list")}
          onSaved={(id) => { setSelectedId(id); setView("detail"); }}
        />
      )}

      {view === "edit" && selectedId && (
        <CampaignEditor
          campaignId={selectedId}
          onBack={() => { setSelectedId(null); setView("list"); }}
          onSaved={(id) => { setSelectedId(id); setView("detail"); }}
        />
      )}

      {view === "detail" && selectedId && (
        <CampaignDetail
          campaignId={selectedId}
          onBack={() => { setSelectedId(null); setView("list"); }}
          onEdit={() => setView("edit")}
        />
      )}
    </div>
    </>
  );
}
