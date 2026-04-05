import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Calculator, DollarSign, TrendingDown, GraduationCap, AlertCircle, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function StudentLoans() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [form, setForm] = useState({ servicer: "", balance: "", rate: "", loanType: "subsidized" as any, repaymentPlan: "", pslfEligible: false });
  const [compareForm, setCompareForm] = useState({ agi: "", familySize: "1", pslfEligible: false });

  const loansQuery = trpc.studentLoans.list.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();

  const addMutation = trpc.studentLoans.add.useMutation({
    onSuccess: () => { utils.studentLoans.list.invalidate(); setAddOpen(false); toast.success("Loan added"); resetForm(); },
  });
  const deleteMutation = trpc.studentLoans.delete.useMutation({
    onSuccess: () => { utils.studentLoans.list.invalidate(); toast.success("Loan removed"); },
  });

  const loans = loansQuery.data || [];
  const totalBalance = loans.reduce((s: number, l: any) => s + (l.balance || 0), 0);
  const avgRate = loans.length > 0 ? loans.reduce((s: number, l: any) => s + (l.rate || 0), 0) / loans.length : 0;

  // Comparison query
  const [selectedLoanForCompare, setSelectedLoanForCompare] = useState<any>(null);
  const compareQuery = trpc.studentLoans.compare.useQuery(
    {
      balance: selectedLoanForCompare?.balance || totalBalance || 10000,
      rate: selectedLoanForCompare?.rate || avgRate || 5.0,
      agi: Number(compareForm.agi) || 50000,
      familySize: Number(compareForm.familySize) || 1,
      pslfEligible: compareForm.pslfEligible,
    },
    { enabled: compareOpen && Number(compareForm.agi) > 0 }
  );

  const resetForm = () => setForm({ servicer: "", balance: "", rate: "", loanType: "subsidized", repaymentPlan: "", pslfEligible: false });

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
            <GraduationCap className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">Student Loan Optimizer</h1>
          </div>
          <div className="ml-auto flex gap-2">
            <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" disabled={loans.length === 0}>
                  <Calculator className="w-4 h-4 mr-1" /> Compare Plans
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Repayment Plan Comparison</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Annual Gross Income (AGI)</label>
                    <Input type="number" placeholder="50000" value={compareForm.agi} onChange={e => setCompareForm(p => ({ ...p, agi: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Family Size</label>
                    <Input type="number" min={1} value={compareForm.familySize} onChange={e => setCompareForm(p => ({ ...p, familySize: e.target.value }))} />
                  </div>
                  <div className="col-span-2 flex items-center gap-2">
                    <input type="checkbox" checked={compareForm.pslfEligible} onChange={e => setCompareForm(p => ({ ...p, pslfEligible: e.target.checked }))} />
                    <span className="text-sm">PSLF Eligible (work for qualifying employer)</span>
                  </div>
                </div>
                {compareQuery.data && (
                  <div className="space-y-3">
                    {(Array.isArray(compareQuery.data) ? compareQuery.data : []).map((s: any, i: number) => (
                      <Card key={i} className={i === 0 ? "border-emerald-500/50 bg-emerald-500/5" : ""}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{s.name}</span>
                            {i === 0 && <Badge className="bg-emerald-500/20 text-emerald-500 text-[10px]">Best Total Cost</Badge>}
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-muted-foreground">Monthly Payment</span>
                              <div className="font-semibold text-sm">{formatCurrency(s.monthlyPayment)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Paid</span>
                              <div className="font-semibold text-sm">{formatCurrency(s.totalPaid)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total Interest</span>
                              <div className="font-semibold text-sm text-amber-500">{formatCurrency(s.totalInterest)}</div>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Forgiveness</span>
                              <div className="font-semibold text-sm">{s.forgivenessAmount > 0 ? formatCurrency(s.forgivenessAmount) : "—"}</div>
                              {s.taxOnForgiveness > 0 && <div className="text-[10px] text-red-400">Tax: {formatCurrency(s.taxOnForgiveness)}</div>}
                            </div>
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-1">Payoff: {Math.round(s.payoffMonths / 12)} years</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </DialogContent>
            </Dialog>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Loan</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Student Loan</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Servicer</label>
                    <Input placeholder="e.g., Nelnet, FedLoan" value={form.servicer} onChange={e => setForm(p => ({ ...p, servicer: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Balance ($)</label>
                      <Input type="number" placeholder="25000" value={form.balance} onChange={e => setForm(p => ({ ...p, balance: e.target.value }))} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Interest Rate (%)</label>
                      <Input type="number" step="0.1" placeholder="5.5" value={form.rate} onChange={e => setForm(p => ({ ...p, rate: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Loan Type</label>
                    <Select value={form.loanType} onValueChange={v => setForm(p => ({ ...p, loanType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="subsidized">Subsidized</SelectItem>
                        <SelectItem value="unsubsidized">Unsubsidized</SelectItem>
                        <SelectItem value="plus">PLUS</SelectItem>
                        <SelectItem value="grad_plus">Grad PLUS</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                        <SelectItem value="consolidation">Consolidation</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={form.pslfEligible} onChange={e => setForm(p => ({ ...p, pslfEligible: e.target.checked }))} />
                    <span className="text-sm">PSLF Eligible</span>
                  </div>
                  <Button className="w-full" onClick={() => addMutation.mutate({ ...form, balance: Number(form.balance), rate: Number(form.rate) })} disabled={!form.balance || !form.rate || addMutation.isPending}>
                    Add Loan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-red-500/5 to-red-500/10 border-red-500/20">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Total Balance</span>
                <DollarSign className="w-4 h-4 text-red-400" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{formatCurrency(totalBalance)}</div>
              <p className="text-xs text-muted-foreground">{loans.length} loan{loans.length !== 1 ? "s" : ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">Avg Interest Rate</span>
                <TrendingDown className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{avgRate.toFixed(2)}%</div>
              <p className="text-xs text-muted-foreground">weighted average</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">PSLF Eligible</span>
                {loans.some((l: any) => l.pslfEligible) ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums">{loans.filter((l: any) => l.pslfEligible).length}</div>
              <p className="text-xs text-muted-foreground">qualifying loans</p>
            </CardContent>
          </Card>
        </div>

        {/* Loan List */}
        {loans.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No Student Loans Added</h3>
              <p className="text-sm text-muted-foreground mb-4">Add your student loans to compare repayment strategies and find the optimal plan.</p>
              <Button onClick={() => setAddOpen(true)}><Plus className="w-4 h-4 mr-1" /> Add Your First Loan</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {loans.map((loan: any) => (
              <Card key={loan.id}>
                <CardContent className="py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{loan.servicer || "Unknown Servicer"}</span>
                        <Badge variant="outline" className="text-[10px]">{loan.loanType}</Badge>
                        {loan.pslfEligible && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-500">PSLF</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Balance: <strong className="text-foreground">{formatCurrency(loan.balance)}</strong></span>
                        <span>Rate: <strong className="text-foreground">{loan.rate}%</strong></span>
                        {loan.paymentsMade > 0 && <span>Payments: {loan.paymentsMade}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate({ id: loan.id })}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Info Card */}
        <Card className="bg-accent/5 border-accent/20">
          <CardContent className="py-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-accent shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong className="text-foreground">How to use:</strong> Add all your student loans, then click "Compare Plans" to see which repayment strategy saves you the most money.</p>
                <p>The optimizer compares Standard, SAVE, PAYE, IBR, PSLF, and refinancing scenarios based on your income and family size.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
