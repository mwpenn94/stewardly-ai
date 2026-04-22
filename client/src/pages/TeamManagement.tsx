/**
 * TeamManagement — Organization team member management.
 *
 * Wired to organizations.listMembers + organizations.inviteMember + organizations.removeMember
 * tRPC procedures. Shows real org members with role badges, invite flow, and search.
 */
import { useState, useMemo } from "react";
import { SEOHead } from "@/components/SEOHead";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { ArrowLeft, Users, UserPlus, Shield, MoreHorizontal, Search, Loader2, Trash2, Mail, CheckCircle } from "lucide-react";
import { ExportDataButton } from "@/components/ExportDataButton";
import { useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

const roleColors: Record<string, string> = {
  org_admin: "text-red-400 border-red-500/30",
  admin: "text-red-400 border-red-500/30",
  advisor: "text-blue-400 border-blue-500/30",
  manager: "text-purple-400 border-purple-500/30",
  user: "text-emerald-400 border-emerald-500/30",
};

export default function TeamManagement({ embedded = false }: { embedded?: boolean } = {}) {
  const Shell = embedded ? (({ children }: any) => <>{children}</>) as any : AppShell;

  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");

  // Get user's organizations
  const orgs = trpc.organizations.list.useQuery(undefined, { enabled: isAuthenticated });
  const primaryOrg = (orgs.data as any[])?.[0];
  const orgId = primaryOrg?.id;

  // Get members of the primary organization
  const members = trpc.organizations.listMembers.useQuery(
    { organizationId: orgId! },
    { enabled: orgId != null }
  );

  const utils = trpc.useUtils();

  const inviteMutation = trpc.organizations.inviteMember.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent!");
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("user");
      utils.organizations.listMembers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const removeMutation = trpc.organizations.removeMember.useMutation({
    onSuccess: () => {
      toast.success("Member removed");
      utils.organizations.listMembers.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const memberList = useMemo(() => {
    const list = (members.data ?? []) as any[];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter((m: any) =>
      (m.name || "").toLowerCase().includes(q) ||
      (m.email || "").toLowerCase().includes(q) ||
      (m.organizationRole || "").toLowerCase().includes(q)
    );
  }, [members.data, search]);

  const isOrgAdmin = primaryOrg?.userRole === "org_admin" || user?.role === "admin";

  return (
    <Shell title="Team Management">
    <div className="container max-w-4xl py-6 sm:py-8 space-y-4 sm:space-y-6">
      <SEOHead title="Team Management" description="Manage your organization team members and roles" />
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/admin")} className="h-7 w-7 p-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Team Management</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {primaryOrg ? primaryOrg.name : "Your organization"} — {memberList.length} member{memberList.length !== 1 ? "s" : ""}
          </p>
        </div>
        {isOrgAdmin && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="invite-email">Email Address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger id="invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="advisor">Advisor</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="org_admin">Organization Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    if (!inviteEmail.trim() || !orgId) return;
                    inviteMutation.mutate({
                      organizationId: orgId,
                      email: inviteEmail.trim(),
                      // @ts-expect-error — type assignment mismatch
                      role: inviteRole,
                    });
                  }}
                  disabled={!inviteEmail.trim() || inviteMutation.isPending}
                >
                  {inviteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Mail className="h-4 w-4 mr-1" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <QueryErrorBanner query={members} label="team members" />

      {!orgId && !orgs.isLoading && (
        <Card>
          <CardContent className="p-6 text-center">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h3 className="text-lg font-medium mb-2">No Organization</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create or join an organization to manage team members.
            </p>
            <Button type="button" variant="outline" onClick={() => navigate("/admin")}>
              Go to Admin Panel
            </Button>
          </CardContent>
        </Card>
      )}

      {(orgs.isLoading || members.isLoading) && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {orgId && !members.isLoading && (
        <>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search team members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <ExportDataButton
              data={memberList}
              filename="team-members"
              columns={["name", "email", "organizationRole", "status"]}
            />
          </div>

          <Card>
            <CardContent className="p-0">
              {memberList.length === 0 ? (
                <div className="p-8 text-center">
                  <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {search ? "No members match your search" : "No team members yet. Invite someone to get started."}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {memberList.map((member: any) => (
                    <div key={member.userId || member.email} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          {(member.name || member.email || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{member.name || member.email}</p>
                            {member.status === "invited" && (
                              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Pending</Badge>
                            )}
                            {member.status === "active" && (
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={`text-[10px] capitalize ${roleColors[member.organizationRole] || roleColors[member.role] || ""}`}>
                          <Shield className="h-2.5 w-2.5 mr-0.5" />
                          {(member.organizationRole || member.role || "user").replace("_", " ")}
                        </Badge>
                        {isOrgAdmin && member.userId !== user?.id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive/60 hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Remove ${member.name || member.email} from the team?`)) {
                                removeMutation.mutate({ organizationId: orgId, userId: member.userId });
                              }
                            }}
                            aria-label={`Remove ${member.name || member.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                        {!isOrgAdmin && (
                          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => toast.info("Contact your org admin to manage roles")}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Role permissions reference */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Role Permissions</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium text-muted-foreground">Permission</th>
                      <th className="text-center py-2 font-medium text-red-400">Admin</th>
                      <th className="text-center py-2 font-medium text-blue-400">Advisor</th>
                      <th className="text-center py-2 font-medium text-emerald-400">User</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { perm: "View all clients", admin: true, advisor: false, u: false },
                      { perm: "Manage own clients", admin: true, advisor: true, u: false },
                      { perm: "Run financial plans", admin: true, advisor: true, u: true },
                      { perm: "Manage team", admin: true, advisor: false, u: false },
                      { perm: "View compliance logs", admin: true, advisor: true, u: false },
                      { perm: "Export data", admin: true, advisor: true, u: false },
                      { perm: "Billing & subscriptions", admin: true, advisor: false, u: false },
                    ].map(r => (
                      <tr key={r.perm} className="border-b border-border/50">
                        <td className="py-2">{r.perm}</td>
                        <td className="text-center">{r.admin ? "✓" : "—"}</td>
                        <td className="text-center">{r.advisor ? "✓" : "—"}</td>
                        <td className="text-center">{r.u ? "✓" : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </Shell>
  );
}
