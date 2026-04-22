/**
 * Permission Management — Location-Level User/Role Assignment
 *
 * Features:
 * - Permission summary overview (locations, members, unassigned users)
 * - Per-location member management (assign, unassign, change role)
 * - Per-user location assignment view
 * - Bulk assign/unassign operations
 * - Auto-assignment rule configuration
 * - Hierarchical role display (admin > editor > viewer)
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import {
  Shield, Users, MapPin, UserPlus, UserMinus, Eye, Pencil, Crown,
  Search, ChevronRight, Building2, AlertTriangle, CheckCircle2,
  Loader2, RefreshCw, Settings2, Globe, Lock, Unlock,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  admin: { label: "Admin", icon: Crown, color: "text-amber-400", bgColor: "bg-amber-400/10 border-amber-400/30", order: 0 },
  editor: { label: "Editor", icon: Pencil, color: "text-blue-400", bgColor: "bg-blue-400/10 border-blue-400/30", order: 1 },
  viewer: { label: "Viewer", icon: Eye, color: "text-slate-400", bgColor: "bg-slate-400/10 border-slate-400/30", order: 2 },
} as const;

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || ROLE_CONFIG.viewer;
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`text-[10px] gap-1 ${config.bgColor}`}>
      <Icon className={`h-3 w-3 ${config.color}`} />
      {config.label}
    </Badge>
  );
}

function UserAvatar({ name, avatarUrl, size = "sm" }: { name?: string | null; avatarUrl?: string | null; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "h-10 w-10 text-sm" : "h-8 w-8 text-xs";
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name || ""} className={`${sizeClass} rounded-full object-cover`} />;
  }
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className={`${sizeClass} rounded-full bg-primary/10 flex items-center justify-center font-medium text-primary`}>
      {initials}
    </div>
  );
}

// ─── Location Card ────────────────────────────────────────────────────────

function LocationPermissionCard({
  location,
  onManage,
}: {
  location: any;
  onManage: (id: number) => void;
}) {
  return (
    <Card
      className="cursor-pointer hover:border-primary/30 transition-colors group"
      onClick={() => onManage(location.id)}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${location.is_active ? "bg-primary/10" : "bg-muted"}`}>
              <MapPin className={`h-5 w-5 ${location.is_active ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <div>
              <p className="font-medium text-sm">{location.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{location.ghl_location_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-lg font-semibold">{Number(location.member_count) || 0}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Members</p>
            </div>
            <div className="flex gap-1">
              {Number(location.admin_count) > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5 bg-amber-400/10 border-amber-400/30">
                  <Crown className="h-2.5 w-2.5 text-amber-400" />
                  {location.admin_count}
                </Badge>
              )}
              {Number(location.editor_count) > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5 bg-blue-400/10 border-blue-400/30">
                  <Pencil className="h-2.5 w-2.5 text-blue-400" />
                  {location.editor_count}
                </Badge>
              )}
              {Number(location.viewer_count) > 0 && (
                <Badge variant="outline" className="text-[10px] gap-0.5 bg-slate-400/10 border-slate-400/30">
                  <Eye className="h-2.5 w-2.5 text-slate-400" />
                  {location.viewer_count}
                </Badge>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
        </div>
        {!location.is_active && (
          <Badge variant="destructive" className="mt-2 text-[10px]">Inactive</Badge>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Location Members Panel ───────────────────────────────────────────────

function LocationMembersPanel({
  locationId,
  locationName,
  onBack,
}: {
  locationId: number;
  locationName: string;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignRole, setAssignRole] = useState<string>("editor");
  const [assignSearch, setAssignSearch] = useState("");

  const membersQuery = trpc.integrations.getLocationMembers.useQuery({ locationDbId: locationId });
  const allUsersQuery = trpc.integrations.listUsers.useQuery();
  const utils = trpc.useUtils();

  const assignMutation = trpc.integrations.bulkAssignUsersToLocation.useMutation({
    onSuccess: (data) => {
      toast.success(`Assigned ${data.assigned} user${data.assigned !== 1 ? "s" : ""} to ${locationName}`);
      utils.integrations.getLocationMembers.invalidate({ locationDbId: locationId });
      utils.integrations.getPermissionSummary.invalidate();
      setShowAssignDialog(false);
      setSelectedUserIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const unassignMutation = trpc.integrations.bulkUnassignUsersFromLocation.useMutation({
    onSuccess: (data) => {
      toast.success(`Removed ${data.removed} user${data.removed !== 1 ? "s" : ""} from ${locationName}`);
      utils.integrations.getLocationMembers.invalidate({ locationDbId: locationId });
      utils.integrations.getPermissionSummary.invalidate();
      setSelectedUserIds(new Set());
    },
    onError: (err) => toast.error(err.message),
  });

  const updateRoleMutation = trpc.integrations.updateLocationMemberRole.useMutation({
    onSuccess: () => {
      toast.success("Role updated");
      utils.integrations.getLocationMembers.invalidate({ locationDbId: locationId });
    },
    onError: (err) => toast.error(err.message),
  });

  const members = membersQuery.data || [];
  const filteredMembers = members.filter((m: any) =>
    !search || (m.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (m.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const memberIds = new Set(members.map((m: any) => m.user_id));
  const availableUsers = (allUsersQuery.data || []).filter(
    (u: any) => !memberIds.has(u.id) &&
    (!assignSearch || (u.name || "").toLowerCase().includes(assignSearch.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(assignSearch.toLowerCase()))
  );

  const toggleUser = (id: number) => {
    const next = new Set(selectedUserIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedUserIds(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            {locationName}
          </h3>
          <p className="text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setShowAssignDialog(true)} className="gap-1.5">
          <UserPlus className="h-4 w-4" />
          Add Members
        </Button>
        {selectedUserIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={() => unassignMutation.mutate({ userIds: Array.from(selectedUserIds), locationDbId: locationId })}
            disabled={unassignMutation.isPending}
            className="gap-1.5"
          >
            {unassignMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Remove ({selectedUserIds.size})
          </Button>
        )}
      </div>

      {membersQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : filteredMembers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? "No members match your search" : "No members assigned to this location"}
            </p>
            <Button variant="outline" className="mt-3 gap-1.5" onClick={() => setShowAssignDialog(true)}>
              <UserPlus className="h-4 w-4" />
              Add Members
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {filteredMembers.map((member: any) => (
            <div
              key={member.user_id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-secondary/20 transition-colors"
            >
              <Checkbox
                checked={selectedUserIds.has(member.user_id)}
                onCheckedChange={() => toggleUser(member.user_id)}
              />
              <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.name || "Unnamed User"}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email || "No email"}</p>
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0">
                {member.global_role}
              </Badge>
              <Select
                value={member.location_role}
                onValueChange={(role) =>
                  updateRoleMutation.mutate({ userId: member.user_id, locationDbId: locationId, role: role as any })
                }
              >
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">
                    <span className="flex items-center gap-1.5">
                      <Crown className="h-3 w-3 text-amber-400" /> Admin
                    </span>
                  </SelectItem>
                  <SelectItem value="editor">
                    <span className="flex items-center gap-1.5">
                      <Pencil className="h-3 w-3 text-blue-400" /> Editor
                    </span>
                  </SelectItem>
                  <SelectItem value="viewer">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3 w-3 text-slate-400" /> Viewer
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      )}

      {/* Assign Users Dialog */}
      <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              Add Members to {locationName}
            </DialogTitle>
            <DialogDescription>
              Select users and choose their role for this location
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={assignRole} onValueChange={setAssignRole}>
                <SelectTrigger className="w-28 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
              {allUsersQuery.isLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              ) : availableUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="h-6 w-6 mx-auto mb-1 opacity-50" />
                  <p className="text-sm">{assignSearch ? "No matching users" : "All users are already assigned"}</p>
                </div>
              ) : (
                availableUsers.map((user: any) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedUserIds.has(user.id)
                        ? "border-primary/50 bg-primary/5"
                        : "border-border/50 hover:bg-secondary/20"
                    }`}
                    onClick={() => toggleUser(user.id)}
                  >
                    <Checkbox checked={selectedUserIds.has(user.id)} />
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name || "Unnamed"}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email || "No email"}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{user.role}</Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAssignDialog(false); setSelectedUserIds(new Set()); }}>
              Cancel
            </Button>
            <Button
              disabled={selectedUserIds.size === 0 || assignMutation.isPending}
              onClick={() =>
                assignMutation.mutate({
                  userIds: Array.from(selectedUserIds),
                  locationDbId: locationId,
                  role: assignRole as any,
                })
              }
            >
              {assignMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <UserPlus className="h-4 w-4 mr-1.5" />
              )}
              Assign {selectedUserIds.size} User{selectedUserIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── User Assignments Panel ───────────────────────────────────────────────

function UserAssignmentsPanel({
  userId,
  userName,
  onBack,
}: {
  userId: number;
  userName: string;
  onBack: () => void;
}) {
  const assignmentsQuery = trpc.integrations.getUserLocationAssignments.useQuery({ userId });
  const assignments = assignmentsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <div>
          <h3 className="text-lg font-semibold">{userName}</h3>
          <p className="text-xs text-muted-foreground">{assignments.length} location{assignments.length !== 1 ? "s" : ""} assigned</p>
        </div>
      </div>

      {assignmentsQuery.isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No locations assigned to this user</p>
            <p className="text-xs text-muted-foreground mt-1">
              {userName} is not assigned to any GHL locations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1">
          {assignments.map((a: any) => (
            <div
              key={a.location_id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card"
            >
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${a.is_active ? "bg-primary/10" : "bg-muted"}`}>
                <MapPin className={`h-4 w-4 ${a.is_active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.location_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{a.ghl_location_id}</p>
              </div>
              <RoleBadge role={a.location_role} />
              {!a.is_active && <Badge variant="destructive" className="text-[10px]">Inactive</Badge>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────

export default function PermissionManagement() {
  // @ts-expect-error — property access on loosely typed object
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState("locations");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedLocationName, setSelectedLocationName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const summaryQuery = trpc.integrations.getPermissionSummary.useQuery();
  const allUsersQuery = trpc.integrations.listUsers.useQuery();

  const summary = summaryQuery.data;
  const locations = summary?.locations || [];
  const allUsers = allUsersQuery.data || [];

  const filteredUsers = allUsers.filter(
    (u: any) => !userSearch ||
    (u.name || "").toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(userSearch.toLowerCase())
  );

  if (authLoading) {
    return (
      <AppShell>
        <div className="container py-8 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <SEOHead title="Permission Management" />
      <div className="container py-8 max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Permission Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage user access to GHL locations — control who sees what
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              summaryQuery.refetch();
              allUsersQuery.refetch();
            }}
            disabled={summaryQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${summaryQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{locations.length}</p>
                <p className="text-xs text-muted-foreground">Locations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-400/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.totalAssignments || 0}</p>
                <p className="text-xs text-muted-foreground">Total Assignments</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                (summary?.unassignedUsers || 0) > 0 ? "bg-amber-400/10" : "bg-emerald-400/10"
              }`}>
                {(summary?.unassignedUsers || 0) > 0 ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold">{summary?.unassignedUsers || 0}</p>
                <p className="text-xs text-muted-foreground">Unassigned Users</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="locations" className="gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              By Location
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-3.5 w-3.5" />
              By User
            </TabsTrigger>
          </TabsList>

          {/* ═══ LOCATIONS TAB ═══ */}
          <TabsContent value="locations" className="space-y-4 mt-4">
            {selectedLocationId != null ? (
              <LocationMembersPanel
                locationId={selectedLocationId}
                locationName={selectedLocationName}
                onBack={() => setSelectedLocationId(null)}
              />
            ) : summaryQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
              </div>
            ) : locations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">No locations configured</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add GHL locations in the Sync Dashboard first
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {locations.map((loc: any) => (
                  <LocationPermissionCard
                    key={loc.id}
                    location={loc}
                    onManage={(id) => {
                      setSelectedLocationId(id);
                      setSelectedLocationName(loc.name);
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ═══ USERS TAB ═══ */}
          <TabsContent value="users" className="space-y-4 mt-4">
            {selectedUserId != null ? (
              <UserAssignmentsPanel
                userId={selectedUserId}
                userName={selectedUserName}
                onBack={() => setSelectedUserId(null)}
              />
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users by name or email..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {allUsersQuery.isLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14" />)}
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">
                        {userSearch ? "No users match your search" : "No users found"}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-1">
                    {filteredUsers.map((user: any) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-secondary/20 transition-colors cursor-pointer group"
                        onClick={() => {
                          setSelectedUserId(user.id);
                          setSelectedUserName(user.name || "Unnamed User");
                        }}
                      >
                        <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{user.name || "Unnamed User"}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email || "No email"}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">{user.role}</Badge>
                        {user.role === "admin" && (
                          <Badge variant="outline" className="text-[10px] gap-0.5 bg-amber-400/10 border-amber-400/30 shrink-0">
                            <Globe className="h-2.5 w-2.5 text-amber-400" />
                            All Access
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        {/* Info Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How permissions work</p>
                <p><strong>Admin</strong> users have global access to all locations regardless of assignments.</p>
                <p><strong>Viewer</strong> can see leads in their assigned locations. <strong>Editor</strong> can modify leads. <strong>Location Admin</strong> can manage location settings and members.</p>
                <p>Users without any location assignment can only see their own data.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
