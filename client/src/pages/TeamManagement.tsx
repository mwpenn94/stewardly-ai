/**
 * TeamManagement — Team member management preview.
 *
 * PLACEHOLDER — pass 72 honesty pass.
 *
 * No `teamRouter` / `team_members` table / invitation flow exists
 * yet. The 5 members shown below are hardcoded mock data and the
 * Invite Member button fires a toast only. Page is not in the
 * sidebar nav — only reachable from /admin via direct link — so
 * normal users won't stumble into it, but any admin who does will
 * see a clear banner explaining this is a design preview.
 */
import { useState } from "react";
import { SEOHead } from "@/components/SEOHead";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Users, UserPlus, Shield, Mail, MoreHorizontal, Search } from "lucide-react";
import HonestPlaceholder from "@/components/HonestPlaceholder";
import { useLocation } from "wouter";
import AppShell from "@/components/AppShell";

const TEAM = [
  { name: "Sarah Johnson", email: "sarah@stewardly.com", role: "admin", status: "active", lastActive: "2 min ago", clients: 42 },
  { name: "Michael Chen", email: "michael@stewardly.com", role: "advisor", status: "active", lastActive: "15 min ago", clients: 38 },
  { name: "Emily Rodriguez", email: "emily@stewardly.com", role: "advisor", status: "active", lastActive: "1 hour ago", clients: 31 },
  { name: "David Kim", email: "david@stewardly.com", role: "paraplanner", status: "active", lastActive: "3 hours ago", clients: 0 },
  { name: "Lisa Thompson", email: "lisa@stewardly.com", role: "advisor", status: "invited", lastActive: "—", clients: 0 },
];

const roleColors: Record<string, string> = {
  admin: "text-red-400 border-red-500/30",
  advisor: "text-blue-400 border-blue-500/30",
  paraplanner: "text-amber-400 border-amber-500/30",
};

export default function TeamManagement() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const filtered = TEAM.filter(m => m.name.toLowerCase().includes(search.toLowerCase()) || m.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell title="Team Management">
    <div className="container max-w-4xl py-8 space-y-6">
      <SEOHead title="Team Management" description="Manage team members, roles, and permissions" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Users className="h-6 w-6" /> Team Management</h1>
            <p className="text-sm text-muted-foreground">{TEAM.length} members • {TEAM.filter(m => m.status === "active").length} active</p>
          </div>
        </div>
        <Button size="sm" disabled title="Not yet wired to a team router">
          <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite Member
        </Button>
      </div>

      <HonestPlaceholder
        willDo="Invite team members, assign roles, and manage org-level permissions through a dedicated UI."
        needed="Add a `team_members` table + `team` tRPC router (invite / role-update / remove). Today, role / permission data lives in `users.role` and is editable via Global Admin."
        workingAlternative={{ href: "/admin", label: "Global Admin (manage user roles directly)" }}
      />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search team members..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {filtered.map(member => (
              <div key={member.email} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                    {member.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{member.name}</p>
                      {member.status === "invited" && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">Pending</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{member.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <Badge variant="outline" className={`text-[10px] capitalize ${roleColors[member.role] || ""}`}>
                      <Shield className="h-2.5 w-2.5 mr-0.5" />{member.role}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-0.5">{member.clients > 0 ? `${member.clients} clients` : member.lastActive}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" disabled title="Member management requires team administration integration">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
                  <th className="text-center py-2 font-medium text-amber-400">Paraplanner</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { perm: "View all clients", admin: true, advisor: false, para: false },
                  { perm: "Manage own clients", admin: true, advisor: true, para: false },
                  { perm: "Run financial plans", admin: true, advisor: true, para: true },
                  { perm: "Manage team", admin: true, advisor: false, para: false },
                  { perm: "View compliance logs", admin: true, advisor: true, para: false },
                  { perm: "Export data", admin: true, advisor: true, para: false },
                  { perm: "Billing & subscriptions", admin: true, advisor: false, para: false },
                ].map(r => (
                  <tr key={r.perm} className="border-b border-border/50">
                    <td className="py-2">{r.perm}</td>
                    <td className="text-center">{r.admin ? "✓" : "—"}</td>
                    <td className="text-center">{r.advisor ? "✓" : "—"}</td>
                    <td className="text-center">{r.para ? "✓" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
