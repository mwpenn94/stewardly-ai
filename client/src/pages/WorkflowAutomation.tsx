/**
 * WorkflowAutomation — Event chain management, execution logs, and checkpoints.
 * Wired to trpc.workflowAutomation.{chains,executions,checkpoints}
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Workflow, Play, Pause, History, CheckCircle2, XCircle,
  AlertTriangle, Loader2, Plus, Trash2, RotateCcw, Eye,
  Clock, Activity, Layers, Search, RefreshCw, ArrowLeft
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

const STATUS_BADGE: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  running: { variant: "default", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed: { variant: "secondary", icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" /> },
  failed: { variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
  partial: { variant: "outline", icon: <AlertTriangle className="h-3 w-3 text-amber-500" /> },
  saved: { variant: "secondary", icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" /> },
  restored: { variant: "default", icon: <RotateCcw className="h-3 w-3" /> },
  compensating: { variant: "outline", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  compensated: { variant: "secondary", icon: <CheckCircle2 className="h-3 w-3" /> },
};

export default function WorkflowAutomation() {
  const { user } = useAuth();
  const [tab, setTab] = useState("chains");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newChain, setNewChain] = useState({ name: "", eventType: "", actionsJson: "[]", isActive: true });
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // ── Queries ──────────────────────────────────────────────────────
  const chainsQ = trpc.workflowAutomation.chains.list.useQuery({ limit: 100 }, { retry: false });
  const execsQ = trpc.workflowAutomation.executions.list.useQuery(
    { limit: 100, ...(selectedChainId ? { chainId: selectedChainId } : {}) },
    { retry: false }
  );
  const checkpointsQ = trpc.workflowAutomation.checkpoints.list.useQuery(
    { workflowId: selectedChainId ?? 0, limit: 50 },
    { enabled: !!selectedChainId, retry: false }
  );

  // ── Mutations ────────────────────────────────────────────────────
  const createChain = trpc.workflowAutomation.chains.create.useMutation({
    onSuccess: () => { utils.workflowAutomation.chains.list.invalidate(); setShowCreate(false); toast.success("Chain created"); },
    onError: (e) => toast.error(e.message),
  });
  const toggleChain = trpc.workflowAutomation.chains.toggle.useMutation({
    onSuccess: () => { utils.workflowAutomation.chains.list.invalidate(); toast.success("Chain updated"); },
    onError: (e) => toast.error(e.message),
  });
  const removeChain = trpc.workflowAutomation.chains.remove.useMutation({
    onSuccess: () => { utils.workflowAutomation.chains.list.invalidate(); toast.success("Chain removed"); },
    onError: (e) => toast.error(e.message),
  });
  const restoreCheckpoint = trpc.workflowAutomation.checkpoints.restore.useMutation({
    onSuccess: (d) => { toast.success(`Restored to step ${d.stepIndex}`); utils.workflowAutomation.checkpoints.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // ── Filtered data ────────────────────────────────────────────────
  const filteredChains = useMemo(() => {
    if (!chainsQ.data) return [];
    if (!search.trim()) return chainsQ.data;
    const q = search.toLowerCase();
    return (chainsQ.data as any[]).filter((c: any) =>
      c.name?.toLowerCase().includes(q) || c.eventType?.toLowerCase().includes(q)
    );
  }, [chainsQ.data, search]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <button type="button" onClick={() => navigate("/operations")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Operations
      </button>
      <SEOHead title="Workflow Automation" description="Event chain automation and execution management" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8 text-primary" /> Workflow Automation
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage event-driven workflow chains, view execution history, and restore checkpoints.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="gap-1">
            <Plus className="h-4 w-4" /> New Chain
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Event Chains", value: (chainsQ.data as any[])?.length ?? 0, icon: Layers },
          { label: "Active", value: ((chainsQ.data as any[]) || []).filter((c: any) => c.isActive).length, icon: Play },
          { label: "Executions", value: (execsQ.data as any[])?.length ?? 0, icon: History },
          { label: "Failed", value: ((execsQ.data as any[]) || []).filter((e: any) => e.status === "failed").length, icon: AlertTriangle },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <s.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="chains" className="gap-1"><Layers className="h-4 w-4" /> Chains</TabsTrigger>
          <TabsTrigger value="executions" className="gap-1"><History className="h-4 w-4" /> Executions</TabsTrigger>
          <TabsTrigger value="checkpoints" className="gap-1"><RotateCcw className="h-4 w-4" /> Checkpoints</TabsTrigger>
        </TabsList>

        {/* ── CHAINS TAB ──────────────────────────────────────────── */}
        <TabsContent value="chains" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search chains..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => chainsQ.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {chainsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredChains.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No event chains found. {isAdmin && "Create one to get started."}</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead className="text-right">Controls</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChains.map((c: any) => {
                    let actionCount = 0;
                    try { actionCount = JSON.parse(c.actionsJson || "[]").length; } catch {}
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell><Badge variant="outline">{c.eventType}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={c.isActive ? "default" : "secondary"}>
                            {c.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>{actionCount} action{actionCount !== 1 ? "s" : ""}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedChainId(c.id); setTab("executions"); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => toggleChain.mutate({ id: c.id, isActive: !c.isActive })}>
                                {c.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this chain?")) removeChain.mutate({ id: c.id }); }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── EXECUTIONS TAB ──────────────────────────────────────── */}
        <TabsContent value="executions" className="space-y-4 mt-4">
          {selectedChainId && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Activity className="h-4 w-4" />
              Filtered to chain #{selectedChainId}
              <Button variant="link" size="sm" onClick={() => setSelectedChainId(null)}>Clear filter</Button>
            </div>
          )}
          {execsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(execsQ.data as any[])?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No execution logs yet.</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Chain</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Executed / Failed</TableHead>
                    <TableHead>Started</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(execsQ.data as any[]).map((e: any) => {
                    const sb = STATUS_BADGE[e.status] || STATUS_BADGE.running;
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="font-mono text-xs">#{e.id}</TableCell>
                        <TableCell>#{e.chainId}</TableCell>
                        <TableCell className="text-xs">{e.eventSource || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={sb.variant} className="gap-1">{sb.icon} {e.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-emerald-500">{e.actionsExecuted ?? 0}</span>
                          {" / "}
                          <span className="text-destructive">{e.actionsFailed ?? 0}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.startedAt ? new Date(e.startedAt).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── CHECKPOINTS TAB ─────────────────────────────────────── */}
        <TabsContent value="checkpoints" className="space-y-4 mt-4">
          {!selectedChainId ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Select a chain from the Chains tab to view its checkpoints.
              </CardContent>
            </Card>
          ) : checkpointsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(checkpointsQ.data as any[])?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No checkpoints for chain #{selectedChainId}.</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Max Retries</TableHead>
                    <TableHead className="text-right">Restore</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(checkpointsQ.data as any[]).map((cp: any) => {
                    const sb = STATUS_BADGE[cp.status] || STATUS_BADGE.saved;
                    return (
                      <TableRow key={cp.id}>
                        <TableCell className="font-mono text-xs">#{cp.id}</TableCell>
                        <TableCell>{cp.stepName || `Step ${cp.stepIndex}`}</TableCell>
                        <TableCell><Badge variant={sb.variant} className="gap-1">{sb.icon} {cp.status}</Badge></TableCell>
                        <TableCell>{cp.maxRetries}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="gap-1" onClick={() => restoreCheckpoint.mutate({ id: cp.id })}
                            disabled={restoreCheckpoint.isPending}>
                            <RotateCcw className="h-3 w-3" /> Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── CREATE CHAIN DIALOG ───────────────────────────────────── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Event Chain</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={newChain.name} onChange={(e) => setNewChain((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., New Client Onboarding" />
            </div>
            <div>
              <Label>Event Type</Label>
              <Input value={newChain.eventType} onChange={(e) => setNewChain((p) => ({ ...p, eventType: e.target.value }))} placeholder="e.g., client.created" />
            </div>
            <div>
              <Label>Actions (JSON)</Label>
              <Textarea value={newChain.actionsJson} onChange={(e) => setNewChain((p) => ({ ...p, actionsJson: e.target.value }))} rows={5} placeholder='[{"type":"email","template":"welcome"}]' />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createChain.mutate(newChain)} disabled={createChain.isPending || !newChain.name || !newChain.eventType}>
              {createChain.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
