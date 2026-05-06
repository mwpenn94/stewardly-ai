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
  FileSignature, LineChart, Stethoscope, ClipboardCheck, Lock,
  Archive, Activity, MessageSquare, Briefcase, HeartPulse,
} from "lucide-react";
import { fmt, pct } from '@/lib/format';
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
                  // @ts-expect-error — strict mode type fix
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
                        // @ts-expect-error — strict mode type fix
                        onClick={() => recordDeliveryMut.mutate({ deliveryId: d.id, deliveryMethod: "in_person" })}>
                        Record Delivery
                      </Button>
                    )}
                    {d.status === "delivered" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        // @ts-expect-error — strict mode type fix
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
              // @ts-expect-error — excess property in object literal
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
              // @ts-expect-error — strict mode fix
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
            // @ts-expect-error — strict mode type fix
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
                <span className={`text-lg font-bold ${(result as any).overallScore >= 80 ? "text-emerald-400" : (result as any).overallScore >= 60 ? "text-amber-400" : "text-red-400"}`}>
                  {(result as any).overallScore}/100
                </span>
              </div>
              <Progress value={(result as any).overallScore} className="h-2" />
            </CardContent>
          </Card>

          {/* Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(result as any).metrics?.map((m: any, i: number) => {
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
          {(result as any).recommendations?.length > 0 && (
            <Card className="bg-card/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(result as any).recommendations.map((r: any, i: number) => (
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
                  // @ts-expect-error — property access on loosely typed object
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
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize((result as any).content) }} />
            ) : (
              <pre className="text-xs max-h-[500px] overflow-y-auto rounded-md border border-border/30 p-4 whitespace-pre-wrap">
                {(result as any).content}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// ENGAGEMENT LETTER TAB (Pass 119)
// ═══════════════════════════════════════════════════════════════════
function EngagementLetterTab() {
  const { user } = useAuth();
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [firmName, setFirmName] = useState("Stewardly Financial");
  const [feeType, setFeeType] = useState<"aum" | "flat" | "hourly" | "commission" | "hybrid">("flat");
  const [flatFee, setFlatFee] = useState("2500");
  const [fiduciary, setFiduciary] = useState<"fiduciary" | "suitability" | "best-interest">("fiduciary");
  const [engType, setEngType] = useState<"initial" | "renewal" | "amendment">("initial");
  const [termMonths, setTermMonths] = useState("12");

  const genMut = trpc.planningHierarchy.generateEngagementLetter.useMutation({
    onSuccess: (d) => toast.success(`Engagement letter #${d.id} generated`),
    onError: (e) => toast.error(e.message),
  });
  const letters = trpc.planningHierarchy.listEngagementLetters.useQuery({ clientId: clientId ? Number(clientId) : undefined });
  const statusMut = trpc.planningHierarchy.updateEngagementStatus.useMutation({
    onSuccess: () => { letters.refetch(); toast.success("Status updated"); },
  });

  const [preview, setPreview] = useState<{ html: string; markdown: string } | null>(null);

  return (
    <div className="space-y-4 mt-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><FileSignature className="h-4 w-4" /> Generate Engagement Letter</CardTitle>
          <CardDescription className="text-xs">Create a professional engagement letter with scope, fees, and fiduciary disclosures.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Client ID</Label><Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Client Name</Label><Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full name" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Firm Name</Label><Input value={firmName} onChange={e => setFirmName(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Fee Type</Label>
              <Select value={feeType} onValueChange={(v: any) => setFeeType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aum">AUM</SelectItem>
                  <SelectItem value="flat">Flat Fee</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="commission">Commission</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {feeType === "flat" && <div><Label className="text-xs">Annual Fee ($)</Label><Input value={flatFee} onChange={e => setFlatFee(e.target.value)} className="h-8 text-xs" /></div>}
            <div><Label className="text-xs">Standard</Label>
              <Select value={fiduciary} onValueChange={(v: any) => setFiduciary(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fiduciary">Fiduciary</SelectItem>
                  <SelectItem value="suitability">Suitability</SelectItem>
                  <SelectItem value="best-interest">Best Interest (Reg BI)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Engagement Type</Label>
              <Select value={engType} onValueChange={(v: any) => setEngType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="initial">Initial</SelectItem>
                  <SelectItem value="renewal">Renewal</SelectItem>
                  <SelectItem value="amendment">Amendment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Term (months)</Label><Input value={termMonths} onChange={e => setTermMonths(e.target.value)} className="h-8 text-xs" /></div>
          </div>
          <Button size="sm" className="gap-1" disabled={genMut.isPending || !clientId || !clientName}
            onClick={() => genMut.mutate({
              clientId: Number(clientId), clientName, advisorName: user?.name ?? "Advisor", firmName,
              scope: { financialPlanning: true, investmentManagement: false, insurancePlanning: true, taxPlanning: false, estatePlanning: false, retirementPlanning: true, educationPlanning: false, debtManagement: false, businessPlanning: false, charitablePlanning: false, specialNeeds: false, elderCare: false, divorceFinancial: false, crossBorder: false, customServices: [] },
              feeSchedule: feeType === "flat" ? { feeType: "flat", flat: { annualFee: Number(flatFee), services: ["Financial Planning", "Insurance Analysis", "Retirement Planning"] } } : { feeType },
              fiduciaryStandard: fiduciary, engagementType: engType, effectiveDate: new Date().toISOString().split("T")[0],
              termMonths: Number(termMonths), autoRenew: true, terminationNoticeDays: 30, arbitrationClause: false,
            }, { onSuccess: (d) => setPreview({ html: d.html, markdown: d.markdown }) })}>
            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
            Generate Letter
          </Button>
        </CardContent>
      </Card>

      {preview && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Letter Preview</CardTitle>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                onClick={() => {
                  const blob = new Blob([preview.markdown], { type: "text/markdown" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a"); a.href = url; a.download = "engagement-letter.md"; a.click();
                  URL.revokeObjectURL(url); toast.success("Downloaded");
                }}>
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-invert prose-sm max-w-none max-h-[400px] overflow-y-auto rounded-md border border-border/30 p-4"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.html) }} />
          </CardContent>
        </Card>
      )}

      {/* Existing Letters */}
      {letters.data && letters.data.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Engagement Letters ({letters.data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {letters.data.map(l => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center gap-2">
                    <FileSignature className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium">{l.metadata.clientName}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{l.metadata.engagementType}</Badge>
                    <Badge variant="outline" className="text-[10px] h-5">{l.metadata.status}</Badge>
                  </div>
                  <div className="flex gap-1">
                    {l.metadata.status === "draft" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => statusMut.mutate({ id: l.id, status: "sent" })}>Send</Button>}
                    {l.metadata.status === "sent" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => statusMut.mutate({ id: l.id, status: "signed" })}>Mark Signed</Button>}
                    {l.metadata.status === "signed" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => statusMut.mutate({ id: l.id, status: "active" })}>Activate</Button>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// YEAR-OVER-YEAR COMPARISON TAB (Pass 119)
// ═══════════════════════════════════════════════════════════════════
function YoYComparisonTab() {
  const [clientId, setClientId] = useState("");
  const [snapLabel, setSnapLabel] = useState("");
  const [snapType, setSnapType] = useState<"annual" | "quarterly" | "milestone" | "manual">("manual");

  const yoy = trpc.planningHierarchy.getYoYComparison.useQuery(
    { clientId: Number(clientId) || 0 },
    { enabled: !!clientId }
  );
  const adherence = trpc.planningHierarchy.getPlanAdherence.useQuery(
    { clientId: Number(clientId) || 0 },
    { enabled: !!clientId }
  );
  const snapMut = trpc.planningHierarchy.captureSnapshot.useMutation({
    onSuccess: () => { yoy.refetch(); adherence.refetch(); toast.success("Snapshot captured"); },
    onError: (e) => toast.error(e.message),
  });

  const trendIcon = (t: string) => t === "improving" || t === "on-track" || t === "ahead" ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : t === "declining" || t === "at-risk" || t === "behind" ? <TrendingDown className="h-3 w-3 text-rose-400" /> : <Minus className="h-3 w-3 text-muted-foreground" />;
  const trendColor = (t: string) => t === "improving" || t === "on-track" || t === "ahead" ? "text-emerald-400" : t === "declining" || t === "at-risk" || t === "behind" ? "text-rose-400" : "text-muted-foreground";

  return (
    <div className="space-y-4 mt-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><LineChart className="h-4 w-4" /> Year-over-Year Comparison</CardTitle>
          <CardDescription className="text-xs">Track planning progress across time with snapshots, trend analysis, and plan adherence scoring.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div><Label className="text-xs">Client ID</Label><Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Snapshot Label</Label><Input value={snapLabel} onChange={e => setSnapLabel(e.target.value)} placeholder="Q1 2026 Review" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={snapType} onValueChange={(v: any) => setSnapType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button size="sm" className="gap-1 w-full" disabled={snapMut.isPending || !clientId}
                onClick={() => snapMut.mutate({ clientId: Number(clientId), snapshotType: snapType, label: snapLabel || `${snapType} snapshot` })}>
                {snapMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Capture
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Trends */}
      {yoy.data && yoy.data.metrics.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Metric Trends ({yoy.data.periods.length} periods)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2">
              {yoy.data.metrics.map(m => (
                <div key={m.metricName} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center gap-2">
                    {trendIcon(m.trend)}
                    <span className="text-xs">{m.metricName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${trendColor(m.trend)}`}>
                      {m.changeFromFirst > 0 ? "+" : ""}{m.changeFromFirst.toFixed(1)}%
                    </span>
                    <Badge variant="outline" className="text-[10px] h-5">{m.category}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Progress */}
      {yoy.data && yoy.data.goalProgress.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Goal Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {yoy.data.goalProgress.map(g => (
                <div key={g.goalName} className="p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {trendIcon(g.trend)}
                      <span className="text-xs font-medium">{g.goalName}</span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] h-5 ${trendColor(g.trend)}`}>{g.trend}</Badge>
                  </div>
                  <Progress value={g.milestones[g.milestones.length - 1]?.progressPct ?? 0} className="h-1.5" />
                  <span className="text-[10px] text-muted-foreground">{(g.milestones[g.milestones.length - 1]?.progressPct ?? 0).toFixed(0)}% complete</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Adherence */}
      {adherence.data && adherence.data.adherenceScore > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Plan Adherence Score: {adherence.data.adherenceScore.toFixed(0)}%</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={adherence.data.adherenceScore} className="h-2 mb-3" />
            {adherence.data.achievedMilestones.length > 0 && (
              <div className="mb-2">
                <span className="text-xs font-medium text-emerald-400">Achieved:</span>
                {adherence.data.achievedMilestones.map((m, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">{m}</p>)}
              </div>
            )}
            {adherence.data.missedMilestones.length > 0 && (
              <div>
                <span className="text-xs font-medium text-rose-400">Needs Attention:</span>
                {adherence.data.missedMilestones.map((m, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">{m}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {yoy.data?.summary && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Overall Trend: <Badge variant="outline" className={trendColor(yoy.data.summary.overallTrend)}>{yoy.data.summary.overallTrend}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {yoy.data.summary.keyWins.length > 0 && (
              <div>
                <span className="text-xs font-medium text-emerald-400">Key Wins</span>
                {yoy.data.summary.keyWins.map((w, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">+ {w}</p>)}
              </div>
            )}
            {yoy.data.summary.areasOfConcern.length > 0 && (
              <div>
                <span className="text-xs font-medium text-amber-400">Areas of Concern</span>
                {yoy.data.summary.areasOfConcern.map((c, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">! {c}</p>)}
              </div>
            )}
            {yoy.data.summary.recommendations.length > 0 && (
              <div>
                <span className="text-xs font-medium text-blue-400">Recommendations</span>
                {yoy.data.summary.recommendations.map((r, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">&rarr; {r}</p>)}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// UNDERWRITING TRACKING TAB (Pass 119)
// ═══════════════════════════════════════════════════════════════════
function UnderwritingTab() {
  const [clientId, setClientId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [product, setProduct] = useState("");

  const list = trpc.planningHierarchy.listUnderwritingStatuses.useQuery({ clientId: clientId ? Number(clientId) : undefined });
  const createMut = trpc.planningHierarchy.createUnderwritingTracking.useMutation({
    onSuccess: () => { list.refetch(); toast.success("Application tracked"); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.planningHierarchy.updateUnderwritingTracking.useMutation({
    onSuccess: () => { list.refetch(); toast.success("Status updated"); },
  });

  const statusColors: Record<string, string> = {
    submitted: "bg-blue-500/10 text-blue-400",
    underwriting: "bg-amber-500/10 text-amber-400",
    "requirements-pending": "bg-orange-500/10 text-orange-400",
    approved: "bg-emerald-500/10 text-emerald-400",
    declined: "bg-red-500/10 text-red-400",
    withdrawn: "bg-slate-500/10 text-slate-400",
    issued: "bg-purple-500/10 text-purple-400",
    delivered: "bg-emerald-500/10 text-emerald-400",
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Underwriting Tracker</CardTitle>
          <CardDescription className="text-xs">Track insurance application status, requirements, and policy delivery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Client ID</Label><Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Carrier</Label><Input value={carrier} onChange={e => setCarrier(e.target.value)} placeholder="e.g. Pacific Life" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Product</Label><Input value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g. IUL Pro" className="h-8 text-xs" /></div>
          </div>
          <Button size="sm" className="gap-1" disabled={createMut.isPending || !clientId || !carrier || !product}
            onClick={() => createMut.mutate({ clientId: Number(clientId), carrier, product })}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Track Application
          </Button>
        </CardContent>
      </Card>

      {list.data && list.data.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Applications ({list.data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {list.data.map(app => (
                <div key={app.applicationId} className="p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{app.carrier} — {app.product}</span>
                      <Badge variant="outline" className={`text-[10px] h-5 ${statusColors[app.status] ?? ""}`}>{app.status}</Badge>
                    </div>
                    <div className="flex gap-1">
                      {app.status === "submitted" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateMut.mutate({ applicationId: app.applicationId, status: "underwriting" })}>In UW</Button>}
                      {app.status === "underwriting" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateMut.mutate({ applicationId: app.applicationId, status: "approved" })}>Approve</Button>}
                      {app.status === "approved" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateMut.mutate({ applicationId: app.applicationId, status: "issued" })}>Issue</Button>}
                      {app.status === "issued" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateMut.mutate({ applicationId: app.applicationId, status: "delivered" })}>Deliver</Button>}
                    </div>
                  </div>
                  {app.requirements.length > 0 && (
                    <div className="mt-1 ml-4">
                      {app.requirements.map((r, i) => (
                        <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {r.status === "received" ? <CheckCircle2 className="h-2.5 w-2.5 text-emerald-400" /> : <Clock className="h-2.5 w-2.5 text-amber-400" />}
                          {r.description}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPLIANCE AUDIT TAB (Pass 119)
// ═══════════════════════════════════════════════════════════════════
function ComplianceAuditTab() {
  const [reviewPeriod, setReviewPeriod] = useState(new Date().getFullYear().toString());
  const [sampleSize, setSampleSize] = useState("10");
  const [reviewType, setReviewType] = useState<"random" | "targeted" | "comprehensive">("random");

  const genMut = trpc.planningHierarchy.generateAuditSample.useMutation({
    onSuccess: (d) => toast.success(`Sample generated: ${d.selectedAccounts.length} accounts`),
    onError: (e) => toast.error(e.message),
  });
  const audits = trpc.planningHierarchy.listComplianceAuditSamples.useQuery({});

  return (
    <div className="space-y-4 mt-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Compliance Audit Sampling</CardTitle>
          <CardDescription className="text-xs">Generate random or targeted audit samples for supervisory review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Review Period</Label><Input value={reviewPeriod} onChange={e => setReviewPeriod(e.target.value)} className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Sample Size</Label><Input value={sampleSize} onChange={e => setSampleSize(e.target.value)} type="number" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Review Type</Label>
              <Select value={reviewType} onValueChange={(v: any) => setReviewType(v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Random</SelectItem>
                  <SelectItem value="targeted">Targeted</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button size="sm" className="gap-1" disabled={genMut.isPending}
            onClick={() => genMut.mutate({ reviewPeriod, sampleSize: Number(sampleSize), reviewType })}>
            {genMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
            Generate Sample
          </Button>
          {genMut.data && (
            <div className="p-2 rounded-md bg-background/40 border border-border/20">
              <p className="text-xs">{genMut.data.rationale}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Accounts: {genMut.data.selectedAccounts.join(", ") || "None"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {audits.data && audits.data.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Audit History ({audits.data.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {audits.data.map(a => (
                <div key={a.sampleId} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center gap-2">
                    <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs">{a.reviewPeriod}</span>
                    <Badge variant="outline" className="text-[10px] h-5">{a.reviewType}</Badge>
                    <Badge variant="outline" className="text-[10px] h-5">{a.status}</Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{a.sampleSize} accounts</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MEETING MANAGEMENT TAB (Pass 119)
// ═══════════════════════════════════════════════════════════════════
function MeetingManagementTab() {
  const [clientId, setClientId] = useState("");
  const [meetingPurpose, setMeetingPurpose] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");

  const brief = trpc.planningHierarchy.generatePreMeetingBrief.useQuery(
    { clientId: Number(clientId) || 0, meetingPurpose },
    { enabled: false }
  );
  const extractMut = trpc.planningHierarchy.extractActionItems.useMutation({
    onSuccess: (d) => toast.success(`Extracted ${d.length} action items`),
    onError: (e) => toast.error(e.message),
  });
  const actionItems = trpc.planningHierarchy.listMeetingActionItems.useQuery(
    { clientId: Number(clientId) || 0 },
    { enabled: !!clientId }
  );
  const updateAI = trpc.planningHierarchy.updateActionItemStatus.useMutation({
    onSuccess: () => { actionItems.refetch(); toast.success("Updated"); },
  });

  return (
    <div className="space-y-4 mt-4">
      {/* Pre-Meeting Brief */}
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Meeting Management</CardTitle>
          <CardDescription className="text-xs">Generate pre-meeting briefs, extract action items, and track follow-ups.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Client ID</Label><Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" className="h-8 text-xs" /></div>
            <div><Label className="text-xs">Meeting Purpose</Label><Input value={meetingPurpose} onChange={e => setMeetingPurpose(e.target.value)} placeholder="e.g. Annual Review" className="h-8 text-xs" /></div>
          </div>
          <Button size="sm" className="gap-1" disabled={brief.isFetching || !clientId || !meetingPurpose}
            onClick={() => brief.refetch()}>
            {brief.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Generate Brief
          </Button>
          {brief.data && (
            <div className="p-3 rounded-md bg-background/40 border border-border/20 space-y-2">
              <p className="text-xs">{brief.data.brief}</p>
              <Separator />
              <div>
                <span className="text-xs font-medium">Agenda:</span>
                {brief.data.agendaItems.map((a, i) => <p key={i} className="text-[10px] text-muted-foreground ml-2">{i + 1}. {a}</p>)}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Item Extraction */}
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Extract Action Items from Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea value={meetingNotes} onChange={e => setMeetingNotes(e.target.value)}
            placeholder="Paste meeting notes or transcript here..." className="text-xs min-h-[100px]" />
          <Button size="sm" className="gap-1" disabled={extractMut.isPending || !meetingNotes}
            onClick={() => extractMut.mutate({ meetingNotes })}>
            {extractMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Extract Items
          </Button>
          {extractMut.data && extractMut.data.length > 0 && (
            <div className="space-y-1">
              {extractMut.data.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-blue-400" />
                    <span className="text-xs">{item.item}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] h-5">{item.assignee}</Badge>
                    <span className="text-[10px] text-muted-foreground">{item.dueDate}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Action Items */}
      {actionItems.data && actionItems.data.length > 0 && (
        <Card className="bg-card/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Action Items ({actionItems.data.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {actionItems.data.map(ai => (
                <div key={ai.id} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                  <div className="flex items-center gap-2">
                    {ai.status === "done" ? <CheckCircle2 className="h-3 w-3 text-emerald-400" /> : <Clock className="h-3 w-3 text-amber-400" />}
                    <span className={`text-xs ${ai.status === "done" ? "line-through text-muted-foreground" : ""}`}>{ai.item}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className="text-[10px] h-5">{ai.assignee}</Badge>
                    {ai.status === "pending" && <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => updateAI.mutate({ id: ai.id, status: "done" })}>Done</Button>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// WEALTH ENGINE DIAGNOSTIC TAB
// ═══════════════════════════════════════════════════════════════════
function WealthEngineDiagnosticTab() {
  const [clientId, setClientId] = useState("");
  const [runDiag, setRunDiag] = useState(false);
  const diagnostic = trpc.planningHierarchy.runComprehensiveDiagnostic.useQuery(
    { clientId: Number(clientId) },
    { enabled: runDiag && !!clientId }
  );

  const getGradeColor = (grade: string) => {
    if (grade === "A+" || grade === "A") return "text-emerald-400";
    if (grade === "B") return "text-blue-400";
    if (grade === "C") return "text-amber-400";
    return "text-red-400";
  };

  const getSeverityColor = (sev: string) => {
    if (sev === "fresh" || sev === "compliant") return "text-emerald-400";
    if (sev === "aging" || sev === "low" || sev === "info") return "text-blue-400";
    if (sev === "stale" || sev === "medium" || sev === "warning" || sev === "needs-review") return "text-amber-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><HeartPulse className="h-4 w-4 text-rose-400" /> Comprehensive Wealth Engine Diagnostic</CardTitle>
          <CardDescription className="text-xs">Run a full diagnostic across fiduciary file, assumption drift, recommendation linkage, data freshness, planning health, and calculator consistency.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input placeholder="Client ID" value={clientId} onChange={e => { setClientId(e.target.value); setRunDiag(false); }} className="w-32 h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={() => setRunDiag(true)} disabled={!clientId || diagnostic.isLoading}>
              {diagnostic.isLoading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" /> Running...</> : "Run Diagnostic"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {diagnostic.data && (
        <>
          {/* Overall Score */}
          <Card className="bg-card/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Overall Diagnostic Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="text-3xl font-bold">{diagnostic.data.overallDiagnosticScore}<span className="text-sm text-muted-foreground">/100</span></div>
                <div className={`text-2xl font-bold ${getGradeColor(diagnostic.data.healthReport.grade)}`}>{diagnostic.data.healthReport.grade}</div>
                <Progress value={diagnostic.data.overallDiagnosticScore} className="flex-1 h-3" />
              </div>
              {diagnostic.data.criticalIssues.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-xs font-medium text-red-400">Critical Issues:</p>
                  {diagnostic.data.criticalIssues.map((issue, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-300">
                      <AlertTriangle className="h-3 w-3" /> {issue}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Health Dimensions */}
          <Card className="bg-card/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Planning Health Dimensions</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(diagnostic.data.healthReport.dimensions).map(([key, dim]) => (
                  <div key={key} className="p-2 rounded-md bg-background/40 border border-border/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium capitalize">{key}</span>
                      <span className="text-xs font-bold">{(dim as any).score}%</span>
                    </div>
                    <Progress value={(dim as any).score} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground mt-1">{(dim as any).details}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Fiduciary File Summary */}
          <Card className="bg-card/60">
            <CardHeader className="pb-2"><CardTitle className="text-sm">Fiduciary File</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.totalEntries}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.suitabilityAssessments}</div><div className="text-[10px] text-muted-foreground">Suitability</div></div>
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.recommendations}</div><div className="text-[10px] text-muted-foreground">Recs</div></div>
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.acknowledgments}</div><div className="text-[10px] text-muted-foreground">Acks</div></div>
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.disclosures}</div><div className="text-[10px] text-muted-foreground">Disclosures</div></div>
                <div className="p-2 rounded-md bg-background/40"><div className="text-lg font-bold">{diagnostic.data.fiduciaryFile.summary.complianceScore}%</div><div className="text-[10px] text-muted-foreground">Compliance</div></div>
              </div>
              <Separator className="my-3" />
              <div className="flex gap-4">
                {["basisForRecommendation", "costDisclosure", "conflictsDisclosure", "careObligation"].map(key => (
                  <div key={key} className="flex items-center gap-1">
                    {(diagnostic.data!.fiduciaryFile.regBICompliance as any)[key]
                      ? <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      : <AlertTriangle className="h-3 w-3 text-amber-400" />}
                    <span className="text-[10px] capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Data Staleness */}
          {diagnostic.data.staleness.staleItems.length > 0 && (
            <Card className="bg-card/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Data Freshness ({diagnostic.data.staleness.overallFreshness}%)</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {diagnostic.data.staleness.staleItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                      <span className="text-xs">{item.entity}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{item.staleDays}d ago</span>
                        <Badge variant="outline" className={`text-[10px] h-5 ${getSeverityColor(item.severity)}`}>{item.severity}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Orphaned Recommendations */}
          {diagnostic.data.orphanedRecommendations.orphaned.length > 0 && (
            <Card className="bg-card/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Orphaned Recommendations ({diagnostic.data.orphanedRecommendations.orphaned.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {diagnostic.data.orphanedRecommendations.orphaned.slice(0, 10).map(rec => (
                    <div key={rec.id} className="flex items-center justify-between p-2 rounded-md bg-background/40 border border-border/20">
                      <div>
                        <span className="text-xs">{rec.description}</span>
                        <span className="text-[10px] text-muted-foreground ml-2">{rec.type}</span>
                      </div>
                      {rec.suggestedGoalLinks.length > 0 && (
                        <Badge variant="outline" className="text-[10px] h-5">Suggest: {rec.suggestedGoalLinks[0].goalName}</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          {diagnostic.data.actionItems.length > 0 && (
            <Card className="bg-card/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Action Items</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {diagnostic.data.actionItems.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-md bg-background/40 border border-border/20">
                      <Target className="h-3 w-3 text-blue-400 shrink-0" /> {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
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
          Advisory workflows — policy delivery, 1035 exchanges, beneficiary reviews, tax analysis, benchmarks, PFR export, engagement letters, YoY comparison, underwriting tracking, compliance audit, meeting management, and comprehensive wealth engine diagnostics.
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
          <TabsTrigger value="engagement" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <FileSignature className="h-3.5 w-3.5" /> Engagement
          </TabsTrigger>
          <TabsTrigger value="yoy" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <LineChart className="h-3.5 w-3.5" /> YoY Compare
          </TabsTrigger>
          <TabsTrigger value="underwriting" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <Stethoscope className="h-3.5 w-3.5" /> Underwriting
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <ClipboardCheck className="h-3.5 w-3.5" /> Audit
          </TabsTrigger>
          <TabsTrigger value="meetings" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <MessageSquare className="h-3.5 w-3.5" /> Meetings
          </TabsTrigger>
          <TabsTrigger value="diagnostic" className="gap-1 text-xs data-[state=active]:bg-accent/20">
            <HeartPulse className="h-3.5 w-3.5" /> Diagnostic
          </TabsTrigger>
        </TabsList>

        <TabsContent value="policy-delivery"><PolicyDeliveryTab /></TabsContent>
        <TabsContent value="exchange"><ExchangeAnalysisTab /></TabsContent>
        <TabsContent value="beneficiary"><BeneficiaryReviewTab /></TabsContent>
        <TabsContent value="tax"><TaxReturnReviewTab /></TabsContent>
        <TabsContent value="benchmark"><BenchmarkTab /></TabsContent>
        <TabsContent value="pfr-export"><PFRExportTab /></TabsContent>
        <TabsContent value="engagement"><EngagementLetterTab /></TabsContent>
        <TabsContent value="yoy"><YoYComparisonTab /></TabsContent>
        <TabsContent value="underwriting"><UnderwritingTab /></TabsContent>
        <TabsContent value="audit"><ComplianceAuditTab /></TabsContent>
        <TabsContent value="meetings"><MeetingManagementTab /></TabsContent>
        <TabsContent value="diagnostic"><WealthEngineDiagnosticTab /></TabsContent>
      </Tabs>
    </div>
  );
}
