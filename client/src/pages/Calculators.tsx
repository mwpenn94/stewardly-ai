import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ArrowLeft, Calculator, TrendingUp, Building2, PiggyBank, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

function fmt(n: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n); }

export default function Calculators() {
  useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();

  // IUL state
  const [iulAge, setIulAge] = useState(35);
  const [iulPremium, setIulPremium] = useState(12000);
  const [iulYears, setIulYears] = useState(30);
  const [iulRate, setIulRate] = useState(6.5);
  const [iulDB, setIulDB] = useState(500000);

  // Premium Finance state
  const [pfFace, setPfFace] = useState(5000000);
  const [pfPremium, setPfPremium] = useState(100000);
  const [pfLoanRate, setPfLoanRate] = useState(5.5);
  const [pfYears, setPfYears] = useState(10);
  const [pfCollateral, setPfCollateral] = useState(2.0);

  // Retirement state
  const [retAge, setRetAge] = useState(35);
  const [retTarget, setRetTarget] = useState(65);
  const [retSavings, setRetSavings] = useState(50000);
  const [retMonthly, setRetMonthly] = useState(1500);
  const [retReturn, setRetReturn] = useState(7.0);
  const [retInflation, setRetInflation] = useState(3.0);

  const iulCalc = trpc.calculators.iulProjection.useMutation({ onError: (e) => toast.error(e.message) });
  const pfCalc = trpc.calculators.premiumFinance.useMutation({ onError: (e) => toast.error(e.message) });
  const retCalc = trpc.calculators.retirement.useMutation({ onError: (e) => toast.error(e.message) });

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Financial Calculators</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="iul" className="space-y-6">
          <TabsList className="bg-secondary">
            <TabsTrigger value="iul" className="gap-1.5 text-xs"><TrendingUp className="w-3.5 h-3.5" /> IUL Projection</TabsTrigger>
            <TabsTrigger value="pf" className="gap-1.5 text-xs"><Building2 className="w-3.5 h-3.5" /> Premium Finance</TabsTrigger>
            <TabsTrigger value="ret" className="gap-1.5 text-xs"><PiggyBank className="w-3.5 h-3.5" /> Retirement</TabsTrigger>
          </TabsList>

          {/* IUL Calculator */}
          <TabsContent value="iul">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">IUL Projection</CardTitle>
                  <CardDescription className="text-xs">Indexed Universal Life illustration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><Label className="text-xs">Current Age</Label><Input type="number" value={iulAge} onChange={e => setIulAge(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Annual Premium</Label><Input type="number" value={iulPremium} onChange={e => setIulPremium(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Years</Label><Input type="number" value={iulYears} onChange={e => setIulYears(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Illustrated Rate (%)</Label><Input type="number" step="0.1" value={iulRate} onChange={e => setIulRate(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Death Benefit</Label><Input type="number" value={iulDB} onChange={e => setIulDB(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm" onClick={() => iulCalc.mutate({ age: iulAge, annualPremium: iulPremium, years: iulYears, illustratedRate: iulRate, deathBenefit: iulDB })} disabled={iulCalc.isPending}>
                    {iulCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4 mr-1.5" /> Calculate</>}
                  </Button>
                </CardContent>
              </Card>
              <div className="lg:col-span-2">
                {iulCalc.data ? (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3"><CardTitle className="text-base">Projection Results</CardTitle><CardDescription className="text-xs">Total premiums: {fmt(iulCalc.data.totalPremiums)}</CardDescription></CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader><TableRow className="border-border"><TableHead className="text-xs">Year</TableHead><TableHead className="text-xs">Age</TableHead><TableHead className="text-xs text-right">Cash Value</TableHead><TableHead className="text-xs text-right">Surrender</TableHead><TableHead className="text-xs text-right">Death Benefit</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {iulCalc.data.projections.map(p => (
                              <TableRow key={p.year} className="border-border text-xs">
                                <TableCell>{p.year}</TableCell><TableCell>{p.age}</TableCell>
                                <TableCell className="text-right">{fmt(p.cashValue)}</TableCell>
                                <TableCell className="text-right">{fmt(p.surrenderValue)}</TableCell>
                                <TableCell className="text-right">{fmt(p.deathBenefit)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Enter parameters and click Calculate to see projections</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Premium Finance Calculator */}
          <TabsContent value="pf">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Premium Finance</CardTitle>
                  <CardDescription className="text-xs">Leverage analysis for high-net-worth clients</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><Label className="text-xs">Face Amount</Label><Input type="number" value={pfFace} onChange={e => setPfFace(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Annual Premium</Label><Input type="number" value={pfPremium} onChange={e => setPfPremium(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Loan Rate (%)</Label><Input type="number" step="0.1" value={pfLoanRate} onChange={e => setPfLoanRate(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Years</Label><Input type="number" value={pfYears} onChange={e => setPfYears(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Collateral Rate (%)</Label><Input type="number" step="0.1" value={pfCollateral} onChange={e => setPfCollateral(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm" onClick={() => pfCalc.mutate({ faceAmount: pfFace, annualPremium: pfPremium, loanRate: pfLoanRate, years: pfYears, collateralRate: pfCollateral })} disabled={pfCalc.isPending}>
                    {pfCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4 mr-1.5" /> Calculate</>}
                  </Button>
                </CardContent>
              </Card>
              <div className="lg:col-span-2">
                {pfCalc.data ? (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Premium Finance Results</CardTitle>
                      <CardDescription className="text-xs">Total collateral cost: {fmt(pfCalc.data.totalCollateralCost)} | ROI: {pfCalc.data.roi}%</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader><TableRow className="border-border"><TableHead className="text-xs">Year</TableHead><TableHead className="text-xs text-right">Loan Balance</TableHead><TableHead className="text-xs text-right">Policy Value</TableHead><TableHead className="text-xs text-right">Net Equity</TableHead><TableHead className="text-xs text-right">Death Benefit</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {pfCalc.data.projections.map(p => (
                              <TableRow key={p.year} className="border-border text-xs">
                                <TableCell>{p.year}</TableCell>
                                <TableCell className="text-right">{fmt(p.loanBalance)}</TableCell>
                                <TableCell className="text-right">{fmt(p.policyValue)}</TableCell>
                                <TableCell className={`text-right ${p.netEquity >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(p.netEquity)}</TableCell>
                                <TableCell className="text-right">{fmt(p.deathBenefit)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Enter parameters and click Calculate to see projections</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Retirement Calculator */}
          <TabsContent value="ret">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base">Retirement Projection</CardTitle>
                  <CardDescription className="text-xs">Wealth accumulation with inflation adjustment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div><Label className="text-xs">Current Age</Label><Input type="number" value={retAge} onChange={e => setRetAge(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Retirement Age</Label><Input type="number" value={retTarget} onChange={e => setRetTarget(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Current Savings</Label><Input type="number" value={retSavings} onChange={e => setRetSavings(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Monthly Contribution</Label><Input type="number" value={retMonthly} onChange={e => setRetMonthly(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Expected Return (%)</Label><Input type="number" step="0.1" value={retReturn} onChange={e => setRetReturn(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <div><Label className="text-xs">Inflation Rate (%)</Label><Input type="number" step="0.1" value={retInflation} onChange={e => setRetInflation(+e.target.value)} className="bg-secondary border-border h-9 text-sm" /></div>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-sm" onClick={() => retCalc.mutate({ currentAge: retAge, retirementAge: retTarget, currentSavings: retSavings, monthlyContribution: retMonthly, expectedReturn: retReturn, inflationRate: retInflation })} disabled={retCalc.isPending}>
                    {retCalc.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Calculator className="w-4 h-4 mr-1.5" /> Calculate</>}
                  </Button>
                </CardContent>
              </Card>
              <div className="lg:col-span-2">
                {retCalc.data ? (
                  <Card className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Retirement Results</CardTitle>
                      <CardDescription className="text-xs">Final balance: {fmt(retCalc.data.finalBalance)} | Est. monthly income (4% rule): {fmt(retCalc.data.estimatedMonthlyIncome)}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader><TableRow className="border-border"><TableHead className="text-xs">Year</TableHead><TableHead className="text-xs">Age</TableHead><TableHead className="text-xs text-right">Contributed</TableHead><TableHead className="text-xs text-right">Nominal</TableHead><TableHead className="text-xs text-right">Real (Today's $)</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {retCalc.data.projections.map(p => (
                              <TableRow key={p.year} className="border-border text-xs">
                                <TableCell>{p.year}</TableCell><TableCell>{p.age}</TableCell>
                                <TableCell className="text-right">{fmt(p.totalContributed)}</TableCell>
                                <TableCell className="text-right">{fmt(p.nominalBalance)}</TableCell>
                                <TableCell className="text-right text-accent">{fmt(p.realBalance)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                    <p>Enter parameters and click Calculate to see projections</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-[10px] text-muted-foreground text-center mt-8">
          These calculators are for illustrative purposes only. Actual results will vary. Consult a licensed financial professional before making decisions.
        </p>
      </div>
    </div>
  );
}
