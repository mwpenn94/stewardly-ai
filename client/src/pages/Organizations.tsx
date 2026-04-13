import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Building2, Plus, Users, Trash2,
  Loader2, UserPlus, ChevronRight,
  Edit, ExternalLink,
} from "lucide-react";
import { useState } from "react";

export default function Organizations() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // State
  const [showCreate, setShowCreate] = useState(false);
  const [showDetail, setShowDetail] = useState<number | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editingOrg, setEditingOrg] = useState<any>(null);

  // Form state
  const [form, setForm] = useState({
    name: "", slug: "", description: "", website: "", ein: "", industry: "", size: "small" as const,
  });
  const [inviteForm, setInviteForm] = useState({ userId: "", role: "user" as string });

  // Queries
  const orgList = trpc.organizations.list.useQuery(undefined, { enabled: !!user });
  const orgDetail = trpc.organizations.get.useQuery(
    { id: showDetail! },
    { enabled: !!showDetail }
  );
  const orgMembers = trpc.organizations.listMembers.useQuery(
    { organizationId: showDetail! },
    { enabled: !!showDetail }
  );

  // Mutations
  const createOrg = trpc.organizations.create.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      setShowCreate(false);
      resetForm();
      toast.success("Organization created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateOrg = trpc.organizations.update.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      utils.organizations.get.invalidate();
      setEditingOrg(null);
      toast.success("Organization updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteOrg = trpc.organizations.delete.useMutation({
    onSuccess: () => {
      utils.organizations.list.invalidate();
      setShowDetail(null);
      toast.success("Organization deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const inviteMember = trpc.organizations.inviteMember.useMutation({
    onSuccess: () => {
      utils.organizations.listMembers.invalidate();
      setShowInvite(false);
      setInviteForm({ email: "", role: "user" });
      toast.success("Member invited");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMember = trpc.organizations.removeMember.useMutation({
    onSuccess: () => {
      utils.organizations.listMembers.invalidate();
      toast.success("Member removed");
    },
    onError: (e) => toast.error(e.message),
  });

  function resetForm() {
    setForm({ name: "", slug: "", description: "", website: "", ein: "", industry: "", size: "small" });
  }

  function handleNameChange(name: string) {
    setForm(f => ({
      ...f,
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    }));
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </div>

    );
  }

  // ─── ORGANIZATION DETAIL VIEW ─────────────────────────────────
  if (showDetail) {
    const org = orgDetail.data;
    const members = orgMembers.data;

    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" aria-label="Back to list" onClick={() => setShowDetail(null)}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-xl font-heading font-bold">{org?.name || "Organization"}</h1>
                <p className="text-sm text-muted-foreground">/{org?.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => navigate(`/org/${org?.slug}`)}>
                <ExternalLink className="w-4 h-4 mr-1" /> Landing Page
              </Button>
              <Button size="sm" variant="outline" onClick={() => {
                if (org) {
                  setEditingOrg(org);
                  setForm({
                    name: org.name,
                    slug: org.slug,
                    description: org.description || "",
                    website: org.website || "",
                    ein: org.ein || "",
                    industry: org.industry || "",
                    size: (org.size as any) || "small",
                  });
                }
              }}>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
              <Button size="sm" variant="destructive" onClick={() => {
                if (confirm("Delete this organization? This cannot be undone.")) {
                  deleteOrg.mutate({ id: showDetail });
                }
              }}>
                <Trash2 className="w-4 h-4 mr-1" /> Delete
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* Org Info */}
          {orgDetail.isLoading ? (
            <Skeleton className="h-40" />
          ) : org ? (
            <Card className="bg-card/50 border-border/50">
              <CardContent className="pt-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <InfoItem label="Industry" value={org.industry} />
                  <InfoItem label="Size" value={org.size} />
                  <InfoItem label="EIN" value={org.ein} />
                  <InfoItem label="Website" value={org.website} />
                </div>
                {org.description && (
                  <p className="text-sm text-muted-foreground mt-4">{org.description}</p>
                )}
              </CardContent>
            </Card>
          ) : null}

          {/* Members */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Members</CardTitle>
                  <CardDescription>{members?.length ?? 0} member(s)</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowInvite(true)}>
                  <UserPlus className="w-4 h-4 mr-1" /> Invite
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {orgMembers.isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map(i => <Skeleton key={i} className="h-14" />)}
                </div>
              ) : !members?.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No members yet. Invite someone to get started.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m: any) => (
                      <TableRow key={m.roleId || m.userId}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent text-xs font-medium">
                              {m.userName?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{m.userName || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{m.userEmail}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {m.organizationRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={m.status === "active" ? "default" : "secondary"}
                            className={m.status === "active" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : ""}
                          >
                            {m.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            onClick={() => removeMember.mutate({ organizationId: showDetail, userId: m.userId })}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Invite Dialog */}
        <Dialog open={showInvite} onOpenChange={setShowInvite}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Invite Member</DialogTitle>
              <DialogDescription>Invite a user to this organization by email.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">User ID</label>
                <Input
                  type="number"
                  placeholder="Enter user ID to invite"
                  value={inviteForm.userId}
                  onChange={(e) => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">Enter the numeric user ID of the person to invite.</p>
              </div>
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={inviteForm.role} onValueChange={(v) => setInviteForm(f => ({ ...f, role: v }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="org_admin">Org Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvite(false)}>Cancel</Button>
              <Button
                onClick={() => inviteMember.mutate({
                  organizationId: showDetail!,
                  userId: parseInt(inviteForm.userId, 10) || 0,
                  role: inviteForm.role as any,
                })}
                disabled={!inviteForm.userId || inviteMember.isPending}
              >
                {inviteMember.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                Invite
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={!!editingOrg} onOpenChange={() => setEditingOrg(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Organization</DialogTitle>
            </DialogHeader>
            <OrgForm form={form} setForm={setForm} onNameChange={handleNameChange} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingOrg(null)}>Cancel</Button>
              <Button
                onClick={() => updateOrg.mutate({ id: showDetail!, ...form })}
                disabled={updateOrg.isPending}
              >
                {updateOrg.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── ORGANIZATION LIST VIEW ───────────────────────────────────
  return (
    <AppShell title="Organizations">
      <SEOHead title="Organizations" description="Organization management and configuration" />
    <div className="min-h-screen">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold tracking-tight">Organizations</h1>
              <p className="text-sm text-muted-foreground">Manage your organizations and teams</p>
            </div>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowCreate(true); }}>
            <Plus className="w-4 h-4 mr-1" /> New Organization
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {orgList.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : !orgList.data?.length ? (
          <div className="text-center py-20 text-muted-foreground">
            <Building2 className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <h2 className="text-lg font-heading font-semibold text-foreground">No organizations yet</h2>
            <p className="text-sm mt-2 max-w-md mx-auto">
              Create an organization to manage teams, clients, and branding.
            </p>
            <Button className="mt-6" onClick={() => { resetForm(); setShowCreate(true); }}>
              <Plus className="w-4 h-4 mr-1" /> Create Organization
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(Array.isArray(orgList.data) ? orgList.data : []).map((org: any) => (
              <Card
                key={org.id}
                className="bg-card/50 border-border/50 hover:border-accent/30 transition-colors cursor-pointer group"
                onClick={() => setShowDetail(org.id)}
              >
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-lg bg-accent/15 flex items-center justify-center text-accent">
                        <Building2 className="w-6 h-6" />
                      </div>
                      <div>
                        <h3 className="font-heading font-semibold">{org.name}</h3>
                        <p className="text-xs text-muted-foreground">/{org.slug}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  {org.description && (
                    <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{org.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-3">
                    {org.industry && (
                      <Badge variant="outline" className="text-xs">{org.industry}</Badge>
                    )}
                    {org.size && (
                      <Badge variant="secondary" className="text-xs capitalize">{org.size}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Users className="w-3 h-3" /> {org.memberCount ?? "—"} members
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>Set up a new organization for your team.</DialogDescription>
          </DialogHeader>
          <OrgForm form={form} setForm={setForm} onNameChange={handleNameChange} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createOrg.mutate(form)}
              disabled={!form.name || !form.slug || createOrg.isPending}
            >
              {createOrg.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}

// ─── SHARED FORM COMPONENT ──────────────────────────────────────────

function OrgForm({ form, setForm, onNameChange }: {
  form: any;
  setForm: (fn: (f: any) => any) => void;
  onNameChange: (name: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Name *</label>
          <Input
            placeholder="Acme Financial"
            value={form.name}
            onChange={(e) => onNameChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Slug *</label>
          <Input
            placeholder="acme-financial"
            value={form.slug}
            onChange={(e) => setForm((f: any) => ({ ...f, slug: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Textarea
          placeholder="Brief description of your organization..."
          value={form.description}
          onChange={(e) => setForm((f: any) => ({ ...f, description: e.target.value }))}
          className="mt-1"
          rows={2}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Website</label>
          <Input
            placeholder="https://example.com"
            value={form.website}
            onChange={(e) => setForm((f: any) => ({ ...f, website: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">EIN</label>
          <Input
            placeholder="12-3456789"
            value={form.ein}
            onChange={(e) => setForm((f: any) => ({ ...f, ein: e.target.value }))}
            className="mt-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Industry</label>
          <Input
            placeholder="Financial Services"
            value={form.industry}
            onChange={(e) => setForm((f: any) => ({ ...f, industry: e.target.value }))}
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Size</label>
          <Select value={form.size} onValueChange={(v) => setForm((f: any) => ({ ...f, size: v }))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="solo">Solo</SelectItem>
              <SelectItem value="small">Small (2-10)</SelectItem>
              <SelectItem value="medium">Medium (11-50)</SelectItem>
              <SelectItem value="large">Large (51-200)</SelectItem>
              <SelectItem value="enterprise">Enterprise (200+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5 capitalize">{value || "—"}</p>
    </div>
  );
}
