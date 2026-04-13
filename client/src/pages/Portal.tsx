import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Briefcase, Users, UserPlus, Eye, EyeOff,
  Search, Loader2, Building2, BarChart3, Clock,
  Shield, ChevronRight, User, Mail, Phone,
  AlertTriangle, CheckCircle, XCircle, TrendingUp,
  MessageSquare, FileText, Activity,
} from "lucide-react";
import { useState, useMemo } from "react";

// ─── TYPES ──────────────────────────────────────────────────────────

type ViewAsSession = {
  targetUserId: number;
  targetName: string;
  startedAt: string;
  expiresAt: string;
  user: any;
  suitability: any;
  profile: any;
} | null;

// ─── MAIN COMPONENT ────────────────────────────────────────────────

export default function Portal() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [viewAsSession, setViewAsSession] = useState<ViewAsSession>(null);
  const [viewAsReason, setViewAsReason] = useState("");
  const [showAddClient, setShowAddClient] = useState(false);
  const [addClientSearch, setAddClientSearch] = useState("");
  const [showViewAsConfirm, setShowViewAsConfirm] = useState<{ id: number; name: string } | null>(null);
  const [activeTab, setActiveTab] = useState("clients");

  const utils = trpc.useUtils();

  // ─── QUERIES ────────────────────────────────────────────────────
  const stats = trpc.portal.stats.useQuery(undefined, { enabled: !!user });
  const clientBook = trpc.portal.clientBook.useQuery(undefined, { enabled: !!user });
  const teamMembers = trpc.portal.teamMembers.useQuery(undefined, {
    enabled: !!user && (user.role === "manager" || user.role === "admin"),
  });
  const myOrgs = trpc.portal.myOrganizations.useQuery(undefined, { enabled: !!user });
  const viewAsAudit = trpc.portal.viewAsAudit.useQuery(undefined, {
    enabled: !!user && (user.role === "manager" || user.role === "admin"),
  });
  const searchResults = trpc.portal.searchUsers.useQuery(
    { query: addClientSearch },
    { enabled: addClientSearch.length >= 2 }
  );

  // ─── MUTATIONS ──────────────────────────────────────────────────
  const viewAsStart = trpc.portal.viewAsStart.useMutation({
    onSuccess: (data) => {
      setViewAsSession({
        targetUserId: data.user.id,
        targetName: data.user.name || data.user.email || "Unknown",
        startedAt: data.sessionStarted,
        expiresAt: data.expiresAt,
        user: data.user,
        suitability: data.suitability,
        profile: data.profile,
      });
      setShowViewAsConfirm(null);
      setViewAsReason("");
      toast.success(`Viewing as ${data.user.name || data.user.email}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const viewAsEnd = trpc.portal.viewAsEnd.useMutation({
    onSuccess: () => {
      setViewAsSession(null);
      toast.success("View-as session ended");
    },
  });

  const addClient = trpc.portal.addClient.useMutation({
    onSuccess: () => {
      utils.portal.clientBook.invalidate();
      utils.portal.stats.invalidate();
      setShowAddClient(false);
      setAddClientSearch("");
      toast.success("Client added successfully");
    },
    onError: (e) => toast.error(e.message),
  });

  const removeClient = trpc.portal.removeClient.useMutation({
    onSuccess: () => {
      utils.portal.clientBook.invalidate();
      utils.portal.stats.invalidate();
      toast.success("Client removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // ─── DERIVED ────────────────────────────────────────────────────
  const role = user?.role || "user";
  const isManager = role === "manager" || role === "admin";
  const isAdmin = role === "admin";

  const filteredClients = useMemo(() => {
    if (!clientBook.data) return [];
    if (!searchQuery) return clientBook.data;
    const q = searchQuery.toLowerCase();
    return (Array.isArray(clientBook.data) ? clientBook.data : []).filter(
      (c: any) =>
        c.clientName?.toLowerCase().includes(q) ||
        c.clientEmail?.toLowerCase().includes(q) ||
        c.profile?.lifeStage?.toLowerCase().includes(q)
    );
  }, [clientBook.data, searchQuery]);

  // ─── LOADING ────────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell title="Advisor Portal">
      <SEOHead title="Advisor Portal" description="Advisor portal and client management" />
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
      </AppShell>
    );
  }

  if (!user || (role !== "advisor" && role !== "manager" && role !== "admin")) {
    return (
      <AppShell title="Advisor Portal">
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <Shield className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-heading font-semibold">Access Restricted</h2>
            <p className="text-muted-foreground">
              The Professional Portal is available to advisors, managers, and administrators.
            </p>
            <Button onClick={() => navigate("/chat")} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Chat
            </Button>
          </CardContent>
        </Card>
      </div>
      </AppShell>
    );
  }

  // ─── VIEW-AS BANNER ─────────────────────────────────────────────
  const ViewAsBanner = () => {
    if (!viewAsSession) return null;
    return (
      <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-4 py-3 flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Eye className="w-5 h-5 text-amber-400" />
          <div>
            <span className="font-medium text-amber-200">Viewing as: </span>
            <span className="font-semibold text-foreground">{viewAsSession.targetName}</span>
            <span className="text-xs text-muted-foreground ml-2">
              (expires {new Date(viewAsSession.expiresAt).toLocaleTimeString()})
            </span>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-500/40 text-amber-200 hover:bg-amber-500/20"
          onClick={() => viewAsEnd.mutate({ targetUserId: viewAsSession.targetUserId })}
        >
          <EyeOff className="w-4 h-4 mr-1" /> End Session
        </Button>
      </div>
    );
  };

  // ─── VIEW-AS CLIENT DETAIL ──────────────────────────────────────
  const ViewAsDetail = () => {
    if (!viewAsSession) return null;
    const { user: vu, suitability, profile } = viewAsSession;
    return (
      <div className="space-y-4 mt-4">
        <Card className="bg-card/50 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5" />
              Client Profile — {vu.name || vu.email}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <InfoItem label="Email" value={vu.email} />
              <InfoItem label="Role" value={vu.role} />
              {profile && (
                <>
                  <InfoItem label="Age" value={profile.age?.toString()} />
                  <InfoItem label="Life Stage" value={profile.lifeStage} />
                  <InfoItem label="Income Range" value={profile.incomeRange} />
                  <InfoItem label="Savings Range" value={profile.savingsRange} />
                  <InfoItem label="Job Title" value={profile.jobTitle} />
                  <InfoItem label="Family" value={profile.familySituation} />
                </>
              )}
              {suitability && (
                <>
                  <InfoItem label="Risk Tolerance" value={suitability.riskTolerance} />
                  <InfoItem label="Investment Horizon" value={suitability.investmentHorizon} />
                  <InfoItem label="Experience" value={suitability.investmentExperience} />
                  <InfoItem label="Net Worth" value={suitability.netWorth} />
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ─── STAT CARDS ─────────────────────────────────────────────────
  const StatCards = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Clients"
        value={stats.data?.totalClients ?? 0}
        icon={<Users className="w-5 h-5" />}
        accent="text-accent"
      />
      <StatCard
        title="Active Clients"
        value={stats.data?.activeClients ?? 0}
        icon={<CheckCircle className="w-5 h-5" />}
        accent="text-emerald-400"
      />
      {isManager && (
        <StatCard
          title="Team Size"
          value={stats.data?.teamSize ?? 0}
          icon={<Briefcase className="w-5 h-5" />}
          accent="text-violet-400"
        />
      )}
      <StatCard
        title="Organizations"
        value={stats.data?.orgs ?? 0}
        icon={<Building2 className="w-5 h-5" />}
        accent="text-amber-400"
      />
    </div>
  );

  // ─── TABS ───────────────────────────────────────────────────────
  const tabItems = [
    { value: "clients", label: "Client Book", icon: <Users className="w-4 h-4" /> },
    ...(isManager ? [{ value: "team", label: "My Team", icon: <Briefcase className="w-4 h-4" /> }] : []),
    ...(isManager ? [{ value: "audit", label: "View-As Audit", icon: <Shield className="w-4 h-4" /> }] : []),
    { value: "orgs", label: "Organizations", icon: <Building2 className="w-4 h-4" /> },
  ];

  return (
    <AppShell title="Advisor Portal">
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-heading font-bold tracking-tight">Professional Portal</h1>
              <p className="text-sm text-muted-foreground">
                {role === "admin" ? "Administrator" : role === "manager" ? "Manager" : "Advisor"} View
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowAddClient(true)}>
              <UserPlus className="w-4 h-4 mr-1" /> Add Client
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <ViewAsBanner />
        {viewAsSession && <ViewAsDetail />}

        {!viewAsSession && (
          <>
            <StatCards />

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-card/50 border border-border/50">
                {tabItems.map(t => (
                  <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                    {t.icon} {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* ─── CLIENT BOOK TAB ─────────────────────────────── */}
              <TabsContent value="clients" className="mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Client Book</CardTitle>
                      <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search clients..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 bg-background/50"
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {clientBook.isLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                      </div>
                    ) : filteredClients.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No clients found</p>
                        <p className="text-sm mt-1">Add clients to start building your book.</p>
                        <Button size="sm" className="mt-4" onClick={() => setShowAddClient(true)}>
                          <UserPlus className="w-4 h-4 mr-1" /> Add Client
                        </Button>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[600px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Client</TableHead>
                              <TableHead>Life Stage</TableHead>
                              <TableHead>Risk Profile</TableHead>
                              <TableHead>Conversations</TableHead>
                              <TableHead>Last Activity</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredClients.map((client: any) => (
                              <TableRow key={client.associationId} className="group">
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-medium">
                                      {client.clientName?.[0]?.toUpperCase() || "?"}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm">{client.clientName || "Unknown"}</p>
                                      <p className="text-xs text-muted-foreground">{client.clientEmail}</p>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {client.profile?.lifeStage || "—"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <RiskBadge risk={client.suitability?.riskTolerance} />
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm flex items-center gap-1">
                                    <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
                                    {client.conversationCount}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {client.lastActivity
                                      ? new Date(client.lastActivity).toLocaleDateString()
                                      : "—"}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <Badge
                                    variant={client.status === "active" ? "default" : "secondary"}
                                    className={client.status === "active" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : ""}
                                  >
                                    {client.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs"
                                      onClick={() => setShowViewAsConfirm({ id: client.clientId, name: client.clientName || "Client" })}
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-1" /> View As
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 text-xs text-destructive"
                                      onClick={() => removeClient.mutate({ associationId: client.associationId })}
                                    >
                                      <XCircle className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── TEAM TAB (Manager+) ─────────────────────────── */}
              {isManager && (
                <TabsContent value="team" className="mt-4">
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">My Team</CardTitle>
                      <CardDescription>Team members across your organizations</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {teamMembers.isLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                        </div>
                      ) : !teamMembers.data?.length ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No team members found</p>
                          <p className="text-sm mt-1">Team members will appear once they join your organizations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {(Array.isArray(teamMembers.data) ? teamMembers.data : []).map((member: any) => (
                            <Card key={member.roleId} className="bg-background/50 border-border/30">
                              <CardContent className="pt-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-medium">
                                    {member.userName?.[0]?.toUpperCase() || "?"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{member.userName || "Unknown"}</p>
                                    <p className="text-xs text-muted-foreground truncate">{member.userEmail}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant="outline" className="text-xs capitalize">
                                        {member.organizationRole}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Users className="w-3 h-3" /> {member.clientCount} clients
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ─── AUDIT TAB (Manager+) ────────────────────────── */}
              {isManager && (
                <TabsContent value="audit" className="mt-4">
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5" /> View-As Audit Log
                      </CardTitle>
                      <CardDescription>Track all view-as sessions for compliance</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {viewAsAudit.isLoading ? (
                        <div className="space-y-3">
                          {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                        </div>
                      ) : !viewAsAudit.data?.length ? (
                        <div className="text-center py-12 text-muted-foreground">
                          <Shield className="w-10 h-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No audit entries</p>
                          <p className="text-sm mt-1">View-as sessions will be logged here.</p>
                        </div>
                      ) : (
                        <ScrollArea className="max-h-[500px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Actor</TableHead>
                                <TableHead>Target</TableHead>
                                <TableHead>Started</TableHead>
                                <TableHead>Duration</TableHead>
                                <TableHead>Reason</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(Array.isArray(viewAsAudit.data) ? viewAsAudit.data : []).map((entry: any) => (
                                <TableRow key={entry.id}>
                                  <TableCell className="text-sm font-medium">{entry.actorName}</TableCell>
                                  <TableCell className="text-sm">{entry.targetName}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {new Date(entry.startTime).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {entry.sessionDuration
                                      ? `${Math.round(entry.sessionDuration / 60)}m`
                                      : entry.endTime ? "—" : "Active"}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                    {entry.reason || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              )}

              {/* ─── ORGANIZATIONS TAB ───────────────────────────── */}
              <TabsContent value="orgs" className="mt-4">
                <Card className="bg-card/50 border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">My Organizations</CardTitle>
                    <CardDescription>Organizations you belong to</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {myOrgs.isLoading ? (
                      <div className="space-y-3">
                        {[1, 2].map(i => <Skeleton key={i} className="h-20" />)}
                      </div>
                    ) : !myOrgs.data?.length ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                        <p className="font-medium">No organizations</p>
                        <p className="text-sm mt-1">You are not a member of any organization yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(Array.isArray(myOrgs.data) ? myOrgs.data : []).map((org: any) => (
                          <Card key={org.organizationId} className="bg-background/50 border-border/30 hover:border-accent/30 transition-colors cursor-pointer"
                            onClick={() => navigate(`/org/${org.orgSlug}`)}>
                            <CardContent className="pt-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
                                  <Building2 className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{org.orgName}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-xs capitalize">
                                      {org.organizationRole}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">/{org.orgSlug}</span>
                                  </div>
                                </div>
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* ─── ADD CLIENT DIALOG ───────────────────────────────────── */}
      <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>Search for a user to add as your client.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={addClientSearch}
                onChange={(e) => setAddClientSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="max-h-[300px]">
              {searchResults.isLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {searchResults.data?.length === 0 && addClientSearch.length >= 2 && (
                <p className="text-center py-8 text-sm text-muted-foreground">No users found</p>
              )}
              {searchResults.data?.map((u: any) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent text-sm font-medium">
                      {u.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{u.name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => addClient.mutate({ clientId: u.id })}
                    disabled={addClient.isPending}
                  >
                    {addClient.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3 mr-1" />}
                    Add
                  </Button>
                </div>
              ))}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── VIEW-AS CONFIRM DIALOG ──────────────────────────────── */}
      <Dialog open={!!showViewAsConfirm} onOpenChange={() => setShowViewAsConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>View As Client</DialogTitle>
            <DialogDescription>
              You are about to view the platform as <strong>{showViewAsConfirm?.name}</strong>.
              This session will be logged and expires after 30 minutes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Reason (optional)</label>
              <Textarea
                placeholder="e.g., Reviewing client portfolio for upcoming meeting"
                value={viewAsReason}
                onChange={(e) => setViewAsReason(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowViewAsConfirm(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (showViewAsConfirm) {
                  viewAsStart.mutate({
                    targetUserId: showViewAsConfirm.id,
                    reason: viewAsReason || undefined,
                  });
                }
              }}
              disabled={viewAsStart.isPending}
            >
              {viewAsStart.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              Start View-As
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AppShell>
  );
}

// ─── HELPER COMPONENTS ──────────────────────────────────────────────

function StatCard({ title, value, icon, accent }: { title: string; value: number; icon: React.ReactNode; accent: string }) {
  return (
    <Card className="bg-card/50 border-border/50">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-heading font-bold mt-1">{value}</p>
          </div>
          <div className={`${accent} opacity-60`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function RiskBadge({ risk }: { risk?: string | null }) {
  if (!risk) return <span className="text-xs text-muted-foreground">—</span>;
  const colors: Record<string, string> = {
    conservative: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    moderate: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    aggressive: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${colors[risk] || ""}`}>
      {risk}
    </Badge>
  );
}

function InfoItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-0.5">{value || "—"}</p>
    </div>
  );
}
