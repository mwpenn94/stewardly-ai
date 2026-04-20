import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CalendarCheck, FileText, History, Plus, Trash2, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { SEOHead } from "@/components/SEOHead";

interface GoalEntry { goalName: string; targetAmount: number; currentAmount: number; targetDate: string; onTrack: boolean; }
interface InsuranceEntry { type: string; provider: string; coverage: number; premium: number; expirationDate: string; adequate: boolean; }

export default function AnnualReview({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  
  const [tab, setTab] = useState("generate");
  const [year] = useState(() => new Date().getFullYear());

  const [form, setForm] = useState({
    year,
    totalAssets: 500000,
    totalLiabilities: 150000,
    annualIncome: 120000,
    annualExpenses: 80000,
    investmentReturns: 8.5,
    goalsProgress: [{ goalName: "Retirement", targetAmount: 1000000, currentAmount: 350000, targetDate: "2045-01-01", onTrack: true }] as GoalEntry[],
    lifeChanges: [] as string[],
    insurancePolicies: [{ type: "Term Life", provider: "Guardian", coverage: 500000, premium: 600, expirationDate: "2035-01-01", adequate: true }] as InsuranceEntry[],
    estateDocsCurrent: true,
    beneficiariesReviewed: true,
  });

  const [newLifeChange, setNewLifeChange] = useState("");

  const generateMut = trpc.annualReview.generate.useMutation({
    onSuccess: () => {
      toast.success("Review Generated");
      historyQ.refetch();
      setTab("history");
    },
    onError: (e) => toast.error(e.message),
  });

  const historyQ = trpc.annualReview.history.useQuery(undefined, { enabled: !!user });

  const netWorth = useMemo(() => form.totalAssets - form.totalLiabilities, [form.totalAssets, form.totalLiabilities]);

  const addGoal = () => setForm((p) => ({ ...p, goalsProgress: [...p.goalsProgress, { goalName: "", targetAmount: 0, currentAmount: 0, targetDate: "", onTrack: false }] }));
  const removeGoal = (i: number) => setForm((p) => ({ ...p, goalsProgress: p.goalsProgress.filter((_, j) => j !== i) }));
  const updateGoal = (i: number, field: keyof GoalEntry, val: any) => setForm((p) => ({ ...p, goalsProgress: p.goalsProgress.map((g, j) => j === i ? { ...g, [field]: val } : g) }));

  const addLifeChange = () => { if (newLifeChange.trim()) { setForm((p) => ({ ...p, lifeChanges: [...p.lifeChanges, newLifeChange.trim()] })); setNewLifeChange(""); } };
  const removeLifeChange = (i: number) => setForm((p) => ({ ...p, lifeChanges: p.lifeChanges.filter((_, j) => j !== i) }));

  const addInsurance = () => setForm((p) => ({ ...p, insurancePolicies: [...p.insurancePolicies, { type: "", provider: "", coverage: 0, premium: 0, expirationDate: "", adequate: false }] }));
  const removeInsurance = (i: number) => setForm((p) => ({ ...p, insurancePolicies: p.insurancePolicies.filter((_, j) => j !== i) }));
  const updateInsurance = (i: number, field: keyof InsuranceEntry, val: any) => setForm((p) => ({ ...p, insurancePolicies: p.insurancePolicies.map((ins, j) => j === i ? { ...ins, [field]: val } : ins) }));

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <SEOHead title="Annual Review" description="Generate comprehensive annual financial reviews" />
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <CalendarCheck className="h-8 w-8 text-primary" /> Annual Financial Review
        </h1>
        <p className="text-muted-foreground mt-1">Generate a comprehensive year-end financial review packet.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="generate" className="gap-1"><FileText className="h-4 w-4" /> Generate</TabsTrigger>
          <TabsTrigger value="history" className="gap-1"><History className="h-4 w-4" /> History</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-4 mt-4">
          {/* Financial Summary */}
          <Card>
            <CardHeader><CardTitle>Financial Summary — {year}</CardTitle><CardDescription>Core financial metrics for the review year</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Total Assets ($)</Label><Input type="number" value={form.totalAssets} onChange={(e) => setForm((p) => ({ ...p, totalAssets: +e.target.value }))} /></div>
                <div className="space-y-2"><Label>Total Liabilities ($)</Label><Input type="number" value={form.totalLiabilities} onChange={(e) => setForm((p) => ({ ...p, totalLiabilities: +e.target.value }))} /></div>
                <div className="space-y-2"><Label>Net Worth</Label><div className={`text-2xl font-bold mt-2 ${netWorth >= 0 ? "text-green-500" : "text-red-500"}`}>${netWorth.toLocaleString()}</div></div>
                <div className="space-y-2"><Label>Annual Income ($)</Label><Input type="number" value={form.annualIncome} onChange={(e) => setForm((p) => ({ ...p, annualIncome: +e.target.value }))} /></div>
                <div className="space-y-2"><Label>Annual Expenses ($)</Label><Input type="number" value={form.annualExpenses} onChange={(e) => setForm((p) => ({ ...p, annualExpenses: +e.target.value }))} /></div>
                <div className="space-y-2"><Label>Investment Returns (%)</Label><Input type="number" step="0.1" value={form.investmentReturns} onChange={(e) => setForm((p) => ({ ...p, investmentReturns: +e.target.value }))} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Goals Progress */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Goals Progress</CardTitle><CardDescription>Track progress toward financial goals</CardDescription></div>
              <Button variant="outline" size="sm" onClick={addGoal}><Plus className="h-4 w-4 mr-1" /> Add Goal</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.goalsProgress.map((g, i) => (
                <div key={i} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <Input value={g.goalName} onChange={(e) => updateGoal(i, "goalName", e.target.value)} placeholder="Goal name" className="max-w-[200px]" />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">On Track</Label>
                      <Switch checked={g.onTrack} onCheckedChange={(v) => updateGoal(i, "onTrack", v)} />
                      <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => removeGoal(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div><Label className="text-xs">Target ($)</Label><Input type="number" value={g.targetAmount} onChange={(e) => updateGoal(i, "targetAmount", +e.target.value)} /></div>
                    <div><Label className="text-xs">Current ($)</Label><Input type="number" value={g.currentAmount} onChange={(e) => updateGoal(i, "currentAmount", +e.target.value)} /></div>
                    <div><Label className="text-xs">Target Date</Label><Input type="date" value={g.targetDate} onChange={(e) => updateGoal(i, "targetDate", e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Life Changes */}
          <Card>
            <CardHeader><CardTitle>Life Changes</CardTitle><CardDescription>Significant events this year (marriage, new child, job change, etc.)</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input value={newLifeChange} onChange={(e) => setNewLifeChange(e.target.value)} placeholder="e.g., Got married" onKeyDown={(e) => e.key === "Enter" && addLifeChange()} />
                <Button variant="outline" onClick={addLifeChange}><Plus className="h-4 w-4" /></Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.lifeChanges.map((lc, i) => (
                  <Badge key={i} variant="secondary" className="gap-1 cursor-pointer" onClick={() => removeLifeChange(i)}>{lc} <Trash2 className="h-3 w-3" /></Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Insurance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle>Insurance Policies</CardTitle></div>
              <Button variant="outline" size="sm" onClick={addInsurance}><Plus className="h-4 w-4 mr-1" /> Add Policy</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.insurancePolicies.map((ins, i) => (
                <div key={i} className="border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
                  <div><Label className="text-xs">Type</Label><Input value={ins.type} onChange={(e) => updateInsurance(i, "type", e.target.value)} placeholder="Term Life" /></div>
                  <div><Label className="text-xs">Provider</Label><Input value={ins.provider} onChange={(e) => updateInsurance(i, "provider", e.target.value)} /></div>
                  <div><Label className="text-xs">Coverage ($)</Label><Input type="number" value={ins.coverage} onChange={(e) => updateInsurance(i, "coverage", +e.target.value)} /></div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1"><Label className="text-xs">Adequate</Label><Switch checked={ins.adequate} onCheckedChange={(v) => updateInsurance(i, "adequate", v)} /></div>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => removeInsurance(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Estate & Beneficiaries */}
          <Card>
            <CardContent className="pt-6 flex flex-wrap gap-6">
              <div className="flex items-center gap-2"><Switch checked={form.estateDocsCurrent} onCheckedChange={(v) => setForm((p) => ({ ...p, estateDocsCurrent: v }))} /><Label>Estate documents current</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.beneficiariesReviewed} onCheckedChange={(v) => setForm((p) => ({ ...p, beneficiariesReviewed: v }))} /><Label>Beneficiaries reviewed</Label></div>
            </CardContent>
          </Card>

          <Button onClick={() => generateMut.mutate(form)} disabled={generateMut.isPending} className="w-full" size="lg">
            {generateMut.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generating Review...</> : <><FileText className="h-4 w-4 mr-2" /> Generate Annual Review</>}
          </Button>

          {generateMut.data && (
            <Card className="border-primary/30">
              <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle className="h-5 w-5 text-green-500" /> Review Generated</CardTitle></CardHeader>
              <CardContent>
                <pre className="text-sm bg-muted/50 p-4 rounded-lg overflow-auto max-h-96 whitespace-pre-wrap">{JSON.stringify(generateMut.data, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Review History</CardTitle></CardHeader>
            <CardContent>
              {historyQ.isLoading ? (
                <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : !historyQ.data?.length ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No reviews yet. Generate your first annual review.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(historyQ.data as any[]).map((r: any, i: number) => (
                    <div key={i} className="border rounded-lg p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium">Annual Review — {r.year || r.input?.year || year}</div>
                        <div className="text-sm text-muted-foreground">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</div>
                      </div>
                      <Badge variant="outline">{r.overallScore ?? r.score ?? "—"}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
