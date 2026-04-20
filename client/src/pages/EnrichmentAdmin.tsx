/**
 * EnrichmentAdmin — Manage enrichment datasets, cohorts, and matches.
 * Wired to trpc.enrichmentEngine.{datasets,cohorts,matches}
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
  Database, Layers, Users, Link2, Plus, Trash2,
  Loader2, Search, RefreshCw, Eye, BarChart3,
  CheckCircle2, Target, Sparkles, ArrowLeft
} from "lucide-react";
import { SEOHead } from "@/components/SEOHead";

export default function EnrichmentAdmin({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [tab, setTab] = useState("datasets");
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [showCreateDataset, setShowCreateDataset] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(null);
  const [newDataset, setNewDataset] = useState({ name: "", description: "", dataType: "demographic", applicableDomains: [] as string[], matchDimensions: [] as string[] });
  const [newCohort, setNewCohort] = useState({ matchCriteria: "{}", enrichmentFields: "{}" });
  const [showCreateCohort, setShowCreateCohort] = useState(false);
  const utils = trpc.useUtils();

  // ── Queries ──────────────────────────────────────────────────────
  const datasetsQ = trpc.enrichmentEngine.datasets.list.useQuery({ limit: 100 }, { retry: false });
  const cohortsQ = trpc.enrichmentEngine.cohorts.list.useQuery(
    { datasetId: selectedDatasetId ?? 0 },
    { enabled: !!selectedDatasetId, retry: false }
  );
  const matchesQ = trpc.enrichmentEngine.matches.list.useQuery({ limit: 100 }, { retry: false });

  // ── Mutations ────────────────────────────────────────────────────
  const createDataset = trpc.enrichmentEngine.datasets.create.useMutation({
    onSuccess: () => { utils.enrichmentEngine.datasets.list.invalidate(); setShowCreateDataset(false); toast.success("Dataset created"); },
    onError: (e) => toast.error(e.message),
  });
  const removeDataset = trpc.enrichmentEngine.datasets.remove.useMutation({
    onSuccess: () => { utils.enrichmentEngine.datasets.list.invalidate(); toast.success("Dataset removed"); },
    onError: (e) => toast.error(e.message),
  });
  const createCohort = trpc.enrichmentEngine.cohorts.create.useMutation({
    onSuccess: () => { utils.enrichmentEngine.cohorts.list.invalidate(); setShowCreateCohort(false); toast.success("Cohort created"); },
    onError: (e) => toast.error(e.message),
  });

  // ── Filtered data ────────────────────────────────────────────────
  const filteredDatasets = useMemo(() => {
    if (!datasetsQ.data) return [];
    if (!search.trim()) return datasetsQ.data;
    const q = search.toLowerCase();
    return (datasetsQ.data as any[]).filter((d: any) =>
      d.name?.toLowerCase().includes(q) || d.description?.toLowerCase().includes(q)
    );
  }, [datasetsQ.data, search]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      <button type="button" onClick={() => navigate("/admin")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors -ml-1 mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to Admin
      </button>
      <SEOHead title="Enrichment Engine" description="Data enrichment datasets, cohorts, and matching" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" /> Enrichment Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage data enrichment datasets, define cohort matching criteria, and review enrichment matches.
          </p>
        </div>
        {isAdmin && tab === "datasets" && (
          <Button onClick={() => setShowCreateDataset(true)} className="gap-1">
            <Plus className="h-4 w-4" /> New Dataset
          </Button>
        )}
        {isAdmin && tab === "cohorts" && selectedDatasetId && (
          <Button onClick={() => setShowCreateCohort(true)} className="gap-1">
            <Plus className="h-4 w-4" /> New Cohort
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Datasets", value: (datasetsQ.data as any[])?.length ?? 0, icon: Database },
          { label: "Cohorts", value: selectedDatasetId ? (cohortsQ.data as any[])?.length ?? 0 : "—", icon: Users },
          { label: "My Matches", value: (matchesQ.data as any[])?.length ?? 0, icon: Target },
          { label: "Avg Confidence", value: matchesQ.data && (matchesQ.data as any[]).length > 0 ? ((matchesQ.data as any[]).reduce((a: number, m: any) => a + (m.confidenceScore || 0), 0) / (matchesQ.data as any[]).length * 100).toFixed(0) + "%" : "—", icon: BarChart3 },
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
          <TabsTrigger value="datasets" className="gap-1"><Database className="h-4 w-4" /> Datasets</TabsTrigger>
          <TabsTrigger value="cohorts" className="gap-1"><Users className="h-4 w-4" /> Cohorts</TabsTrigger>
          <TabsTrigger value="matches" className="gap-1"><Target className="h-4 w-4" /> My Matches</TabsTrigger>
        </TabsList>

        {/* ── DATASETS TAB ────────────────────────────────────────── */}
        <TabsContent value="datasets" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search datasets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="icon" aria-label="Refresh" onClick={() => datasetsQ.refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {datasetsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredDatasets.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No datasets found. {isAdmin && "Create one to get started."}</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Domains</TableHead>
                    <TableHead>Match Dims</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDatasets.map((d: any) => (
                    <TableRow key={d.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{d.name}</p>
                          {d.description && <p className="text-xs text-muted-foreground line-clamp-1">{d.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{d.dataType || "general"}</Badge></TableCell>
                      <TableCell className="text-xs">
                        {Array.isArray(d.applicableDomains) ? d.applicableDomains.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {Array.isArray(d.matchDimensions) ? d.matchDimensions.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedDatasetId(d.id); setTab("cohorts"); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this dataset?")) removeDataset.mutate({ id: d.id }); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── COHORTS TAB ─────────────────────────────────────────── */}
        <TabsContent value="cohorts" className="space-y-4 mt-4">
          {!selectedDatasetId ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">Select a dataset from the Datasets tab to view its cohorts.</CardContent></Card>
          ) : cohortsQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(cohortsQ.data as any[])?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No cohorts for dataset #{selectedDatasetId}. {isAdmin && "Create one to define matching criteria."}</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Match Criteria</TableHead>
                    <TableHead>Enrichment Fields</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cohortsQ.data as any[]).map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">#{c.id}</TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">
                        {typeof c.matchCriteria === "string" ? c.matchCriteria : JSON.stringify(c.matchCriteria)}
                      </TableCell>
                      <TableCell className="text-xs font-mono max-w-xs truncate">
                        {typeof c.enrichmentFields === "string" ? c.enrichmentFields : JSON.stringify(c.enrichmentFields)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── MATCHES TAB ─────────────────────────────────────────── */}
        <TabsContent value="matches" className="space-y-4 mt-4">
          {matchesQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !(matchesQ.data as any[])?.length ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">No enrichment matches found for your profile.</CardContent></Card>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Dataset</TableHead>
                    <TableHead>Cohort</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Domains</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(matchesQ.data as any[]).map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono text-xs">#{m.id}</TableCell>
                      <TableCell>#{m.datasetId}</TableCell>
                      <TableCell>#{m.cohortId}</TableCell>
                      <TableCell>
                        <Badge variant={m.confidenceScore >= 0.8 ? "default" : m.confidenceScore >= 0.5 ? "secondary" : "outline"}>
                          {(m.confidenceScore * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {Array.isArray(m.applicableDomains) ? m.applicableDomains.join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── CREATE DATASET DIALOG ─────────────────────────────────── */}
      <Dialog open={showCreateDataset} onOpenChange={setShowCreateDataset}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Enrichment Dataset</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newDataset.name} onChange={(e) => setNewDataset((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Census Demographics 2024" /></div>
            <div><Label>Description</Label><Textarea value={newDataset.description} onChange={(e) => setNewDataset((p) => ({ ...p, description: e.target.value }))} rows={3} /></div>
            <div><Label>Data Type</Label><Input value={newDataset.dataType} onChange={(e) => setNewDataset((p) => ({ ...p, dataType: e.target.value }))} placeholder="demographic, financial, behavioral" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDataset(false)}>Cancel</Button>
            <Button onClick={() => createDataset.mutate(newDataset)} disabled={createDataset.isPending || !newDataset.name}>
              {createDataset.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CREATE COHORT DIALOG ──────────────────────────────────── */}
      <Dialog open={showCreateCohort} onOpenChange={setShowCreateCohort}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Cohort for Dataset #{selectedDatasetId}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Match Criteria (JSON)</Label><Textarea value={newCohort.matchCriteria} onChange={(e) => setNewCohort((p) => ({ ...p, matchCriteria: e.target.value }))} rows={4} placeholder='{"age_range": "30-50", "income": ">100000"}' /></div>
            <div><Label>Enrichment Fields (JSON)</Label><Textarea value={newCohort.enrichmentFields} onChange={(e) => setNewCohort((p) => ({ ...p, enrichmentFields: e.target.value }))} rows={4} placeholder='{"propensity_score": true, "ltv_estimate": true}' /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateCohort(false)}>Cancel</Button>
            <Button onClick={() => {
              if (!selectedDatasetId) return;
              let mc: any, ef: any;
              try { mc = JSON.parse(newCohort.matchCriteria); } catch { toast.error("Invalid match criteria JSON"); return; }
              try { ef = JSON.parse(newCohort.enrichmentFields); } catch { toast.error("Invalid enrichment fields JSON"); return; }
              createCohort.mutate({ datasetId: selectedDatasetId, matchCriteria: mc, enrichmentFields: ef });
            }} disabled={createCohort.isPending}>
              {createCohort.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
