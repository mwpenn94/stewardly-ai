import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Plus, Trash2, Shield, ShieldCheck, ShieldAlert, Key, Globe, DollarSign, AlertTriangle, CheckCircle2, Edit } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function DigitalAssets() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    assetType: "bank" as any, platform: "", approximateValue: "", accessMethod: "",
    hasAccessPlan: false, legacyContactSet: false, notes: "",
  });

  const assetsQuery = trpc.digitalAssets.list.useQuery(undefined, { enabled: !!user });
  const readinessQuery = trpc.digitalAssets.readiness.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();

  const addMutation = trpc.digitalAssets.add.useMutation({
    onSuccess: () => { utils.digitalAssets.invalidate(); setAddOpen(false); toast.success("Asset added"); resetForm(); },
  });
  const updateMutation = trpc.digitalAssets.update.useMutation({
    onSuccess: () => utils.digitalAssets.invalidate(),
  });
  const deleteMutation = trpc.digitalAssets.delete.useMutation({
    onSuccess: () => { utils.digitalAssets.invalidate(); toast.success("Asset removed"); },
  });

  const assets = assetsQuery.data || [];
  const readiness = readinessQuery.data;
  const formatCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  const resetForm = () => setForm({ assetType: "bank", platform: "", approximateValue: "", accessMethod: "", hasAccessPlan: false, legacyContactSet: false, notes: "" });

  const assetTypeLabels: Record<string, string> = {
    crypto_wallet: "Crypto Wallet", exchange_account: "Exchange", brokerage: "Brokerage",
    bank: "Bank Account", social_media: "Social Media", email: "Email",
    cloud_storage: "Cloud Storage", loyalty_program: "Loyalty Program",
    domain: "Domain", digital_content: "Digital Content", other: "Other",
  };

  const scoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-500";
    if (score >= 50) return "text-amber-500";
    return "text-red-500";
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Chat
          </Button>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">Digital Asset Estate</h1>
          </div>
          <div className="ml-auto">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Asset</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Digital Asset</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Asset Type</label>
                      <Select value={form.assetType} onValueChange={v => setForm(p => ({ ...p, assetType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(assetTypeLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Platform / Name</label>
                      <Input placeholder="e.g., Coinbase, Chase" value={form.platform} onChange={e => setForm(p => ({ ...p, platform: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Approximate Value ($)</label>
                    <Input type="number" placeholder="0" value={form.approximateValue} onChange={e => setForm(p => ({ ...p, approximateValue: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Access Method (how to access this account)</label>
                    <Input placeholder="e.g., Password manager, hardware key" value={form.accessMethod} onChange={e => setForm(p => ({ ...p, accessMethod: e.target.value }))} />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.hasAccessPlan} onChange={e => setForm(p => ({ ...p, hasAccessPlan: e.target.checked }))} />
                      Access plan documented
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={form.legacyContactSet} onChange={e => setForm(p => ({ ...p, legacyContactSet: e.target.checked }))} />
                      Legacy contact set
                    </label>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Notes</label>
                    <Textarea placeholder="Additional details..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
                  </div>
                  <Button className="w-full" onClick={() => addMutation.mutate({ ...form, approximateValue: Number(form.approximateValue) || undefined })} disabled={!form.platform || addMutation.isPending}>
                    Add Asset
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Readiness Score */}
        {readiness && (
          <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold">Estate Readiness Score</h2>
                  <p className="text-xs text-muted-foreground">How prepared is your digital estate?</p>
                </div>
                <div className={`text-4xl font-bold ${scoreColor(readiness.readinessScore)}`}>
                  {readiness.readinessScore}
                </div>
              </div>
              <Progress value={readiness.readinessScore} className="h-2 mb-3" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Total Assets</span>
                  <div className="font-semibold">{readiness.totalAssets}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Estimated Value</span>
                  <div className="font-semibold">{formatCurrency(readiness.totalEstimatedValue)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">With Access Plan</span>
                  <div className="font-semibold">{readiness.withAccessPlan}/{readiness.totalAssets}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Legacy Contact Set</span>
                  <div className="font-semibold">{readiness.withLegacyContact}/{readiness.totalAssets}</div>
                </div>
              </div>
              {readiness.recommendations.length > 0 && (
                <div className="mt-4 space-y-1">
                  {readiness.recommendations.map((r: string, i: number) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{r}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Assets List */}
        {assets.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No Digital Assets Inventoried</h3>
              <p className="text-sm text-muted-foreground mb-4">Start building your digital estate inventory to ensure your digital assets are protected and accessible.</p>
              <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Your First Asset</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {assets.map((asset: any) => (
              <Card key={asset.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{asset.platform}</span>
                        <Badge variant="outline" className="text-[10px]">{assetTypeLabels[asset.assetType] || asset.assetType}</Badge>
                        {asset.hasAccessPlan ? (
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        {asset.legacyContactSet && <Key className="w-3.5 h-3.5 text-blue-500" />}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {asset.approximateValue > 0 && <span>Value: {formatCurrency(asset.approximateValue)}</span>}
                        {asset.accessMethod && <span>Access: {asset.accessMethod}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => {
                        updateMutation.mutate({
                          id: asset.id,
                          hasAccessPlan: !asset.hasAccessPlan,
                        });
                      }}>
                        {asset.hasAccessPlan ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <ShieldAlert className="w-4 h-4" />}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate({ id: asset.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
