/**
 * AdvancedWorkflowsPanel — Phase 4 advanced advisory workflows UI.
 * Provides tabs for Policy Delivery/Free Look, 1035 Exchange Analysis,
 * Beneficiary Review, Tax Return Review, Benchmark Comparison, and PFR Export.
 */
import { useState, useMemo } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  FileCheck, ArrowLeftRight, Users, Receipt, BarChart3, FileText,
  Plus, Clock, AlertTriangle, CheckCircle2, Shield, Download,
  ChevronRight, Eye, Calendar, DollarSign, Percent, Target,
  TrendingUp, TrendingDown, Minus, Loader2, RefreshCw,
} from "lucide-react";

// ─── FORMATTING ────────────────────────────────────────────────────
const fmt = (n: number) => {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

// ─── STATUS BADGE ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, { class: string; icon: React.ElementType }> = {
    pending: { class: "bg-amber-500/10 text-amber-400 border-amber-500/30", icon: Clock },
    active: { class: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: RefreshCw },
    completed: { class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    approved: { class: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    rejected: { class: "bg-red-500/10 text-red-400 border-red-500/30", icon: AlertTriangle },
    expired: { class: "bg-slate-500/10 text-slate-400 border-slate-500/30", icon: Clock },
    cancelled: { class: "bg-slate-500/10 text-slate-400 border-slate-500/30", icon: Minus },
    exercised: { class: "bg-purple-500/10 text-purple-400 border-purple-500/30", icon: CheckCircle2 },
    due: { class: "bg-rose-500/10 text-rose-400 border-rose-500/30", icon: AlertTriangle },
    current: { class: "bg-blue-500/10 text-blue-400 border-blue-500/30", icon: CheckCircle2 },
  };
  const v = variants[status] || variants.pending;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={`gap-1 text-[10px] ${v.class}`}>
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// ═══════════════════════════════════════════════════════════════════
// POLICY DELIVERY TAB
// ═══════════════════════════════════════════════════════════════════
function PolicyDeliveryTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    policyNumber: "",
    carrier: "",
    productType: "whole_life",
    faceAmount: "",
    annualPremium: "",
    freeLookDays: "10",
  });

  const deliveriesQuery = trpc.planningHierarchy.listPolicyDeliveries.useQuery(undefined, {
    retry: 2,
  });
  const freeLookAlertsQuery = trpc.planningHierarchy.getFreeLookAlerts.useQuery(undefined, {
    retry: 2,
  });
  const createMut = trpc.planningHierarchy.createPolicyDelivery.useMutation({
    onSuccess: () => {
      toast.success("Policy delivery created");
      deliveriesQuery.refetch();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const recordDeliveryMut = trpc.planningHierarchy.recordDelivery.useMutation({
    onSuccess: () => {
      toast.success("Delivery recorded");
      deliveriesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const recordAckMut = trpc.planningHierarchy.recordClientAcknowledgment.useMutation({
    onSuccess: () => {
      toast.success("Client acknowledgment recorded");
      deliveriesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });
  const exerciseFreeLookMut = trpc.planningHierarchy.exerciseFreeLook.useMutation({
    onSuccess: () => {
      toast.success("Free look exercised — policy will be cancelled");
      deliveriesQuery.refetch();
      freeLookAlertsQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deliveries = deliveriesQuery.data ?? [];
  const alerts = freeLookAlertsQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Free Look Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Free Look Expiring Soon ({alerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between text-xs bg-card/40 rounded-md p-2">
                <div>
                  <span className="font-medium">{a.policyNumber}</span>
                  <span className="text-muted-foreground ml-2">{a.carrier}</span>
                  <span className="text-amber-400 ml-2">Expires {new Date(a.freeLookExpiry).toLocaleDateString()}</span>
                </div>
                <Button size="sm" variant="outline" className="h-6 text-[10px]"
                  onClick={() => exerciseFreeLookMut.mutate({ deliveryId: a.id, reason: "Client requested cancellation" })}>
                  Exercise Free Look
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Policy Deliveries</h3>
          <p className="text-xs text-muted-foreground">Track policy delivery, client acknowledgment, and free look periods</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> New Delivery
        </Button>
      </div>

      {/* Deliveries List */}
      {deliveriesQuery.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : deliveries.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No policy deliveries yet. Create one to start tracking.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {deliveries.map((d: any) => (
            <Card key={d.id} className="bg-card/60">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{d.policyNumber}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {d.carrier} · {d.productType?.replace(/_/g, " ")} · {fmt(d.faceAmount || 0)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.status === "pending" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => recordDeliveryMut.mutate({ deliveryId: d.id, deliveryMethod: "in_person" })}>
                        Record Delivery
                      </Button>
                    )}
                    {d.status === "delivered" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => recordAckMut.mutate({ deliveryId: d.id })}>
                        Record Acknowledgment
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Policy Delivery</DialogTitle>
            <DialogDescription>Track a new policy delivery through the compliance workflow.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Policy Number</Label>
                <Input value={form.policyNumber} onChange={e => setForm(p => ({ ...p, policyNumber: e.target.value }))} placeholder="POL-12345" />
              </div>
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input value={form.carrier} onChange={e => setForm(p => ({ ...p, carrier: e.target.value }))} placeholder="Carrier name" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Face Amount</Label>
                <Input type="number" value={form.faceAmount} onChange={e => setForm(p => ({ ...p, faceAmount: e.target.value }))} placeholder="500000" />
              </div>
              <div>
                <Label className="text-xs">Annual Premium</Label>
                <Input type="number" value={form.annualPremium} onChange={e => setForm(p => ({ ...p, annualPremium: e.target.value }))} placeholder="12000" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Product Type</Label>
                <Select value={form.productType} onValueChange={v => setForm(p => ({ ...p, productType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole_life">Whole Life</SelectItem>
                    <SelectItem value="universal_life">Universal Life</SelectItem>
                    <SelectItem value="term_life">Term Life</SelectItem>
                    <SelectItem value="variable_life">Variable Life</SelectItem>
                    <SelectItem value="indexed_universal_life">Indexed UL</SelectItem>
                    <SelectItem value="annuity">Annuity</SelectItem>
                    <SelectItem value="disability">Disability</SelectItem>
                    <SelectItem value="ltc">Long-Term Care</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Free Look Days</Label>
                <Input type="number" value={form.freeLookDays} onChange={e => setForm(p => ({ ...p, freeLookDays: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({
              clientId: Number(form.clientId) || 1,
              policyNumber: form.policyNumber,
              carrier: form.carrier,
              productType: form.productType,
              faceAmount: Number(form.faceAmount) || 0,
              annualPremium: Number(form.annualPremium) || 0,
              freeLookDays: Number(form.freeLookDays) || 10,
            })} disabled={createMut.isPending || !form.policyNumber}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 1035 EXCHANGE TAB
// ═══════════════════════════════════════════════════════════════════
function ExchangeAnalysisTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    existingPolicyNumber: "",
    existingCarrier: "",
    existingProductType: "whole_life",
    existingCashValue: "",
    existingDeathBenefit: "",
    existingAnnualPremium: "",
    proposedCarrier: "",
    proposedProductType: "indexed_universal_life",
    proposedDeathBenefit: "",
    proposedAnnualPremium: "",
  });

  const analysesQuery = trpc.planningHierarchy.listExchangeAnalyses.useQuery(undefined, { retry: 2 });
  const createMut = trpc.planningHierarchy.createExchangeAnalysis.useMutation({
    onSuccess: () => {
      toast.success("1035 exchange analysis created");
      analysesQuery.refetch();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const analyses = analysesQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">1035 Exchange Analyses</h3>
          <p className="text-xs text-muted-foreground">Evaluate tax-free policy exchanges with NAIC compliance scoring</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> New Analysis
        </Button>
      </div>

      {analysesQuery.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : analyses.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No exchange analyses yet. Create one to evaluate a potential 1035 exchange.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {analyses.map((a: any) => (
            <Card key={a.id} className="bg-card/60">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{a.existingPolicyNumber}</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{a.proposedCarrier}</span>
                        <StatusBadge status={a.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {a.existingCarrier} → {a.proposedCarrier} · CV: {fmt(a.existingCashValue || 0)}
                      </div>
                    </div>
                  </div>
                  {a.naicScore != null && (
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">NAIC Score</div>
                      <div className={`text-sm font-semibold ${a.naicScore >= 70 ? "text-emerald-400" : a.naicScore >= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {a.naicScore}/100
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New 1035 Exchange Analysis</DialogTitle>
            <DialogDescription>Evaluate a tax-free policy exchange with NAIC compliance scoring.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Existing Policy</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Policy Number</Label>
                <Input value={form.existingPolicyNumber} onChange={e => setForm(p => ({ ...p, existingPolicyNumber: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input value={form.existingCarrier} onChange={e => setForm(p => ({ ...p, existingCarrier: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Cash Value</Label>
                <Input type="number" value={form.existingCashValue} onChange={e => setForm(p => ({ ...p, existingCashValue: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Death Benefit</Label>
                <Input type="number" value={form.existingDeathBenefit} onChange={e => setForm(p => ({ ...p, existingDeathBenefit: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Annual Premium</Label>
                <Input type="number" value={form.existingAnnualPremium} onChange={e => setForm(p => ({ ...p, existingAnnualPremium: e.target.value }))} />
              </div>
            </div>
            <Separator />
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Proposed Policy</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Carrier</Label>
                <Input value={form.proposedCarrier} onChange={e => setForm(p => ({ ...p, proposedCarrier: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Product Type</Label>
                <Select value={form.proposedProductType} onValueChange={v => setForm(p => ({ ...p, proposedProductType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole_life">Whole Life</SelectItem>
                    <SelectItem value="universal_life">Universal Life</SelectItem>
                    <SelectItem value="indexed_universal_life">Indexed UL</SelectItem>
                    <SelectItem value="variable_life">Variable Life</SelectItem>
                    <SelectItem value="annuity">Annuity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Death Benefit</Label>
                <Input type="number" value={form.proposedDeathBenefit} onChange={e => setForm(p => ({ ...p, proposedDeathBenefit: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Annual Premium</Label>
                <Input type="number" value={form.proposedAnnualPremium} onChange={e => setForm(p => ({ ...p, proposedAnnualPremium: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({
              clientId: Number(form.clientId) || 1,
              existingPolicyNumber: form.existingPolicyNumber,
              existingCarrier: form.existingCarrier,
              existingProductType: form.existingProductType,
              existingCashValue: Number(form.existingCashValue) || 0,
              existingDeathBenefit: Number(form.existingDeathBenefit) || 0,
              existingAnnualPremium: Number(form.existingAnnualPremium) || 0,
              proposedCarrier: form.proposedCarrier,
              proposedProductType: form.proposedProductType,
              proposedDeathBenefit: Number(form.proposedDeathBenefit) || 0,
              proposedAnnualPremium: Number(form.proposedAnnualPremium) || 0,
            })} disabled={createMut.isPending || !form.existingPolicyNumber}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze Exchange"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BENEFICIARY REVIEW TAB
// ═══════════════════════════════════════════════════════════════════
function BeneficiaryReviewTab() {
  const reviewsDueQuery = trpc.planningHierarchy.getBeneficiaryReviewsDue.useQuery(undefined, { retry: 2 });
  const reviewsQuery = trpc.planningHierarchy.listBeneficiaryReviews.useQuery(undefined, { retry: 2 });

  const reviewsDue = reviewsDueQuery.data ?? [];
  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="space-y-4">
      {/* Reviews Due Alert */}
      {reviewsDue.length > 0 && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              Reviews Due ({reviewsDue.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {reviewsDue.slice(0, 5).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between text-xs bg-card/40 rounded-md p-2">
                <div>
                  <span className="font-medium">Client #{r.clientId}</span>
                  <span className="text-muted-foreground ml-2">Last reviewed: {r.lastReviewDate ? new Date(r.lastReviewDate).toLocaleDateString() : "Never"}</span>
                </div>
                <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-400">Due</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Beneficiary Reviews</h3>
          <p className="text-xs text-muted-foreground">Track and analyze beneficiary designations across client policies</p>
        </div>
      </div>

      {reviewsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No beneficiary reviews yet. Reviews are created automatically when client policies are analyzed.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r: any) => {
            const findings = r.findings ? (typeof r.findings === "string" ? JSON.parse(r.findings) : r.findings) : {};
            return (
              <Card key={r.id} className="bg-card/60">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">Client #{r.clientId}</span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {r.reviewDate ? `Reviewed ${new Date(r.reviewDate).toLocaleDateString()}` : "Pending review"}
                          {findings.totalPolicies && ` · ${findings.totalPolicies} policies`}
                          {findings.issuesFound && ` · ${findings.issuesFound} issues`}
                        </div>
                      </div>
                    </div>
                    {findings.overallScore != null && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Score</div>
                        <div className={`text-sm font-semibold ${findings.overallScore >= 80 ? "text-emerald-400" : findings.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                          {findings.overallScore}/100
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAX RETURN REVIEW TAB
// ═══════════════════════════════════════════════════════════════════
function TaxReturnReviewTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    taxYear: new Date().getFullYear() - 1,
    filingStatus: "married_filing_jointly",
    totalIncome: "",
    agi: "",
    taxableIncome: "",
    totalTax: "",
    effectiveRate: "",
  });

  const reviewsQuery = trpc.planningHierarchy.listTaxReturnReviews.useQuery(undefined, { retry: 2 });
  const createMut = trpc.planningHierarchy.createTaxReturnReview.useMutation({
    onSuccess: () => {
      toast.success("Tax return review created");
      reviewsQuery.refetch();
      setShowCreate(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const reviews = reviewsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Tax Return Reviews</h3>
          <p className="text-xs text-muted-foreground">Analyze client tax returns to identify planning opportunities</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> New Review
        </Button>
      </div>

      {reviewsQuery.isLoading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <Card className="bg-card/40">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No tax return reviews yet. Create one to identify planning opportunities.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r: any) => {
            const opportunities = r.opportunities ? (typeof r.opportunities === "string" ? JSON.parse(r.opportunities) : r.opportunities) : [];
            return (
              <Card key={r.id} className="bg-card/60">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Receipt className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">TY {r.taxYear}</span>
                          <Badge variant="outline" className="text-[10px]">{r.filingStatus?.replace(/_/g, " ")}</Badge>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          AGI: {fmt(r.agi || 0)} · Tax: {fmt(r.totalTax || 0)} · Rate: {pct(r.effectiveRate || 0)}
                          {Array.isArray(opportunities) && opportunities.length > 0 && ` · ${opportunities.length} opportunities`}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Tax Return Review</DialogTitle>
            <DialogDescription>Enter key tax return data to identify planning opportunities.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tax Year</Label>
                <Input type="number" value={form.taxYear} onChange={e => setForm(p => ({ ...p, taxYear: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">Filing Status</Label>
                <Select value={form.filingStatus} onValueChange={v => setForm(p => ({ ...p, filingStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married_filing_jointly">Married Filing Jointly</SelectItem>
                    <SelectItem value="married_filing_separately">Married Filing Separately</SelectItem>
                    <SelectItem value="head_of_household">Head of Household</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Total Income</Label>
                <Input type="number" value={form.totalIncome} onChange={e => setForm(p => ({ ...p, totalIncome: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">AGI</Label>
                <Input type="number" value={form.agi} onChange={e => setForm(p => ({ ...p, agi: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Total Tax</Label>
                <Input type="number" value={form.totalTax} onChange={e => setForm(p => ({ ...p, totalTax: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Effective Rate (%)</Label>
                <Input type="number" step="0.01" value={form.effectiveRate} onChange={e => setForm(p => ({ ...p, effectiveRate: e.target.value }))} placeholder="e.g. 0.22" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMut.mutate({
              clientId: Number(form.clientId) || 1,
              taxYear: form.taxYear,
              filingStatus: form.filingStatus,
              totalIncome: Number(form.totalIncome) || 0,
              agi: Number(form.agi) || 0,
              taxableIncome: Number(form.taxableIncome) || 0,
              totalTax: Number(form.totalTax) || 0,
              effectiveRate: Number(form.effectiveRate) || 0,
            })} disabled={createMut.isPending}>
              {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// BENCHMARK COMPARISON TAB
// ═══════════════════════════════════════════════════════════════════
function BenchmarkTab() {
  const [form, setForm] = useState({
    clientAge: "45",
    clientIncome: "150000",
    clientNetWorth: "500000",
    clientSavingsRate: "0.15",
    clientDebtToIncome: "0.3",
    clientInsuranceCoverage: "750000",
  });

  const computeMut = trpc.planningHierarchy.computeBenchmarks.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const result = computeMut.data;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Benchmark Comparison</h3>
        <p className="text-xs text-muted-foreground">Compare client metrics against SCF peer data and CFP planning standards</p>
      </div>

      <Card className="bg-card/60">
        <CardContent className="py-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Age</Label>
              <Input type="number" value={form.clientAge} onChange={e => setForm(p => ({ ...p, clientAge: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Income</Label>
              <Input type="number" value={form.clientIncome} onChange={e => setForm(p => ({ ...p, clientIncome: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Net Worth</Label>
              <Input type="number" value={form.clientNetWorth} onChange={e => setForm(p => ({ ...p, clientNetWorth: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Savings Rate</Label>
              <Input type="number" step="0.01" value={form.clientSavingsRate} onChange={e => setForm(p => ({ ...p, clientSavingsRate: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Debt-to-Income</Label>
              <Input type="number" step="0.01" value={form.clientDebtToIncome} onChange={e => setForm(p => ({ ...p, clientDebtToIncome: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Insurance Coverage</Label>
              <Input type="number" value={form.clientInsuranceCoverage} onChange={e => setForm(p => ({ ...p, clientInsuranceCoverage: e.target.value }))} />
            </div>
          </div>
          <Button onClick={() => computeMut.mutate({
            clientAge: Number(form.clientAge),
            clientIncome: Number(form.clientIncome),
            clientNetWorth: Number(form.clientNetWorth),
            clientSavingsRate: Number(form.clientSavingsRate),
            clientDebtToIncome: Number(form.clientDebtToIncome),
            clientInsuranceCoverage: Number(form.clientInsuranceCoverage),
          })} disabled={computeMut.isPending} className="w-full gap-1">
            {computeMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Compute Benchmarks
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Overall Score */}
          <Card className="bg-card/60">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold">Overall Financial Health</span>
                <span className={`text-lg font-bold ${result.overallScore >= 80 ? "text-emerald-400" : result.overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {result.overallScore}/100
                </span>
              </div>
              <Progress value={result.overallScore} className="h-2" />
            </CardContent>
          </Card>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.metrics?.map((m: any, i: number) => {
              const TrendIcon = m.percentile >= 60 ? TrendingUp : m.percentile >= 40 ? Minus : TrendingDown;
              const trendColor = m.percentile >= 60 ? "text-emerald-400" : m.percentile >= 40 ? "text-amber-400" : "text-red-400";
              return (
                <Card key={i} className="bg-card/60">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium">{m.label}</span>
                      <TrendIcon className={`h-3.5 w-3.5 ${trendColor}`} />
                    </div>
                    <div className="flex items-end gap-2">
                      <span className="text-lg font-semibold">{typeof m.clientValue === "number" && m.clientValue < 1 ? pct(m.clientValue) : fmt(m.clientValue)}</span>
                      <span className="text-xs text-muted-foreground mb-0.5">
                        vs. peer median {typeof m.peerMedian === "number" && m.peerMedian < 1 ? pct(m.peerMedian) : fmt(m.peerMedian)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={m.percentile} className="h-1 flex-1" />
                      <span className="text-[10px] text-muted-foreground">{m.percentile}th %ile</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Recommendations */}
          {result.recommendations?.length > 0 && (
            <Card className="bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.recommendations.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Target className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" />
                    <span>{r}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// PFR EXPORT TAB
// ═══════════════════════════════════════════════════════════════════
function PFRExportTab() {
  const [clientId, setClientId] = useState("");
  const exportMut = trpc.planningHierarchy.exportPFR.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const result = exportMut.data;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Personal Financial Review Export</h3>
        <p className="text-xs text-muted-foreground">Generate professional client-facing PFR documents</p>
      </div>

      <Card className="bg-card/60">
        <CardContent className="py-4 space-y-3">
          <div>
            <Label className="text-xs">Client ID</Label>
            <Input type="number" value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Enter client ID" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => exportMut.mutate({ clientId: Number(clientId) || 1, format: "html" })}
              disabled={exportMut.isPending} className="flex-1 gap-1">
              {exportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Generate HTML
            </Button>
            <Button variant="outline" onClick={() => exportMut.mutate({ clientId: Number(clientId) || 1, format: "markdown" })}
              disabled={exportMut.isPending} className="flex-1 gap-1">
              {exportMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Generate Markdown
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {result && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Generated PFR</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => {
                  const blob = new Blob([result.content], { type: result.format === "html" ? "text/html" : "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `PFR-${clientId}.${result.format === "html" ? "html" : "md"}`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("PFR downloaded");
                }}>
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {result.format === "html" ? (
              <div className="prose prose-invert prose-sm max-w-none max-h-[500px] overflow-y-auto rounded-md border border-border/30 p-4"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(result.content) }} />
            ) : (
              <pre className="text-xs max-h-[500px] overflow-y-auto rounded-md border border-border/30 p-4 whitespace-pre-wrap">
                {result.content}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export default function AdvancedWorkflowsPanel() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Advanced Advisory Workflows</h2>
        <p className="text-xs text-muted-foreground">
          Phase 4 compliance workflows — policy delivery, 1035 exchanges, beneficiary reviews, tax analysis, benchmarks, and PFR export.
        </p>
      </div>

      <Tabs defaultValue="policy-delivery" className="w-full">
        <TabsList className="w-full flex flex-wrap h-auto gap-1 bg-transparent p-0">
          <TabsTrigger value="policy-delivery" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <FileCheck className="h-3.5 w-3.5" /> Policy Delivery
          </TabsTrigger>
          <TabsTrigger value="exchange" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <ArrowLeftRight className="h-3.5 w-3.5" /> 1035 Exchange
          </TabsTrigger>
          <TabsTrigger value="beneficiary" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <Users className="h-3.5 w-3.5" /> Beneficiary
          </TabsTrigger>
          <TabsTrigger value="tax" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <Receipt className="h-3.5 w-3.5" /> Tax Review
          </TabsTrigger>
          <TabsTrigger value="benchmark" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <BarChart3 className="h-3.5 w-3.5" /> Benchmark
          </TabsTrigger>
          <TabsTrigger value="pfr-export" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <FileText className="h-3.5 w-3.5" /> PFR Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policy-delivery"><PolicyDeliveryTab /></TabsContent>
        <TabsContent value="exchange"><ExchangeAnalysisTab /></TabsContent>
        <TabsContent value="beneficiary"><BeneficiaryReviewTab /></TabsContent>
        <TabsContent value="tax"><TaxReturnReviewTab /></TabsContent>
        <TabsContent value="benchmark"><BenchmarkTab /></TabsContent>
        <TabsContent value="pfr-export"><PFRExportTab /></TabsContent>
      </Tabs>
    </div>
  );
}
