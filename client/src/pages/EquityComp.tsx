import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Calculator, TrendingUp, Building2, DollarSign, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function EquityComp() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [form, setForm] = useState({ grantType: "rsu" as any, company: "", exercisePrice: "", currentFMV: "", sharesGranted: "", sharesVested: "", sharesExercised: "0" });
  const [modelForm, setModelForm] = useState({ sharesToExercise: "", agi: "" });
  const [selectedGrant, setSelectedGrant] = useState<any>(null);

  const grantsQuery = trpc.equityComp.list.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();

  const addMutation = trpc.equityComp.add.useMutation({
    onSuccess: () => { utils.equityComp.list.invalidate(); setAddOpen(false); toast.success("Grant added"); },
  });
  const deleteMutation = trpc.equityComp.delete.useMutation({
    onSuccess: () => { utils.equityComp.list.invalidate(); toast.success("Grant removed"); },
  });

  const modelQuery = trpc.equityComp.modelExercise.useQuery(
    {
      grantType: selectedGrant?.grantType || "rsu",
      exercisePrice: selectedGrant?.exercisePrice ?? null,
      currentFMV: selectedGrant?.currentFMV ?? null,
      sharesVested: selectedGrant?.sharesVested ?? null,
      sharesExercised: selectedGrant?.sharesExercised ?? null,
      sharesToExercise: Number(modelForm.sharesToExercise) || 100,
      agi: Number(modelForm.agi) || 100000,
    },
    { enabled: modelOpen && !!selectedGrant && Number(modelForm.sharesToExercise) > 0 && Number(modelForm.agi) > 0 }
  );

  const grants = grantsQuery.data || [];
  const totalValue = grants.reduce((s: number, g: any) => s + ((g.currentFMV || 0) * (g.sharesVested || 0)), 0);
  const formatCurrency = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Chat
          </Button>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">Equity Compensation</h1>
          </div>
          <div className="ml-auto">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Grant</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Equity Grant</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Grant Type</label>
                      <Select value={form.grantType} onValueChange={v => setForm(p => ({ ...p, grantType: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iso">ISO (Incentive Stock Options)</SelectItem>
                          <SelectItem value="nso">NSO (Non-Qualified Stock Options)</SelectItem>
                          <SelectItem value="rsu">RSU (Restricted Stock Units)</SelectItem>
                          <SelectItem value="espp">ESPP (Employee Stock Purchase)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Company</label>
                      <Input placeholder="Company name" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Exercise/Strike Price ($)</label>
                      <Input type="number" step="0.01" placeholder="10.00" value={form.exercisePrice} onChange={e => setForm(p => ({ ...p, exercisePrice: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Current FMV ($)</label>
                      <Input type="number" step="0.01" placeholder="50.00" value={form.currentFMV} onChange={e => setForm(p => ({ ...p, currentFMV: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Shares Granted</label>
                      <Input type="number" placeholder="1000" value={form.sharesGranted} onChange={e => setForm(p => ({ ...p, sharesGranted: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Shares Vested</label>
                      <Input type="number" placeholder="250" value={form.sharesVested} onChange={e => setForm(p => ({ ...p, sharesVested: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Shares Exercised</label>
                      <Input type="number" placeholder="0" value={form.sharesExercised} onChange={e => setForm(p => ({ ...p, sharesExercised: e.target.value }))} />
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => addMutation.mutate({
                    ...form,
                    exercisePrice: Number(form.exercisePrice) || undefined,
                    currentFMV: Number(form.currentFMV) || undefined,
                    sharesGranted: Number(form.sharesGranted) || undefined,
                    sharesVested: Number(form.sharesVested) || undefined,
                    sharesExercised: Number(form.sharesExercised) || undefined,
                  })} disabled={!form.company || addMutation.isPending}>
                    Add Grant
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Total Vested Value</span>
                <DollarSign className="w-4 h-4 text-accent" />
              </div>
              <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
              <p className="text-xs text-muted-foreground">{grants.length} grant{grants.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Companies</span>
                <Building2 className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-2xl font-bold">{new Set(grants.map((g: any) => g.company)).size}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Grant Types</span>
                <BarChart3 className="w-4 h-4 text-amber-500" />
              </div>
              <div className="flex gap-2 flex-wrap mt-1">
                {["iso", "nso", "rsu", "espp"].map(t => {
                  const count = grants.filter((g: any) => g.grantType === t).length;
                  if (count === 0) return null;
                  return <Badge key={t} variant="outline" className="text-[10px]">{t.toUpperCase()}: {count}</Badge>;
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Grants List */}
        {grants.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <TrendingUp className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No Equity Grants</h3>
              <p className="text-sm text-muted-foreground mb-4">Track your stock options, RSUs, and ESPP grants to model exercise scenarios and tax implications.</p>
              <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Your First Grant</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {grants.map((grant: any) => {
              const spread = (grant.currentFMV || 0) - (grant.exercisePrice || 0);
              const vestedValue = (grant.currentFMV || 0) * (grant.sharesVested || 0);
              return (
                <Card key={grant.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{grant.company}</span>
                          <Badge variant="outline" className="text-[10px]">{grant.grantType?.toUpperCase()}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          {grant.exercisePrice != null && <span>Strike: ${grant.exercisePrice}</span>}
                          {grant.currentFMV != null && <span>FMV: ${grant.currentFMV}</span>}
                          {spread > 0 && <span className="text-emerald-500">Spread: ${spread.toFixed(2)}</span>}
                          <span>Vested: {grant.sharesVested || 0}/{grant.sharesGranted || 0}</span>
                          <span className="font-medium text-foreground">Value: {formatCurrency(vestedValue)}</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => { setSelectedGrant(grant); setModelForm({ sharesToExercise: String(grant.sharesVested || 100), agi: "100000" }); setModelOpen(true); }}>
                        <Calculator className="w-4 h-4 mr-1" /> Model
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate({ id: grant.id })}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Exercise Model Dialog */}
      <Dialog open={modelOpen} onOpenChange={setModelOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Exercise Scenario Modeling — {selectedGrant?.company} ({selectedGrant?.grantType?.toUpperCase()})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-xs text-muted-foreground">Shares to Exercise</label>
              <Input type="number" value={modelForm.sharesToExercise} onChange={e => setModelForm(p => ({ ...p, sharesToExercise: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Annual Gross Income (AGI)</label>
              <Input type="number" value={modelForm.agi} onChange={e => setModelForm(p => ({ ...p, agi: e.target.value }))} />
            </div>
          </div>
          {modelQuery.data && (
            <div className="space-y-3">
              {(Array.isArray(modelQuery.data) ? modelQuery.data : []).map((s: any, i: number) => (
                <Card key={i} className={i === 2 ? "border-emerald-500/50 bg-emerald-500/5" : ""}>
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      {i === 2 && <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px]">Best Net Proceeds (if held)</Badge>}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Exercise Cost</span>
                        <div className="font-semibold text-sm">{formatCurrency(s.exerciseCost)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Current Value</span>
                        <div className="font-semibold text-sm">{formatCurrency(s.currentValue)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Ordinary Tax</span>
                        <div className="font-semibold text-sm text-red-400">{formatCurrency(s.ordinaryIncomeTax)}</div>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Net Proceeds</span>
                        <div className="font-semibold text-sm text-emerald-500">{formatCurrency(s.netProceeds)}</div>
                      </div>
                    </div>
                    {s.amtExposure > 0 && <div className="text-[10px] text-amber-400 mt-1">AMT Exposure: {formatCurrency(s.amtExposure)}</div>}
                    {s.capitalGainsTax > 0 && <div className="text-[10px] text-muted-foreground mt-1">Capital Gains Tax: {formatCurrency(s.capitalGainsTax)}</div>}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
