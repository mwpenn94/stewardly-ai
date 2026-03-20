/**
 * Agentic Execution Hub
 * Dashboard for Part G: Licensed Review Gate, Agent Orchestrator,
 * Insurance Quoting, Applications, Advisory Execution, Estate Docs,
 * Premium Finance, and Carrier Connections.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Shield, Bot, FileText, Calculator, Scale, Building2,
  DollarSign, Link2, Play, Plus, CheckCircle2, XCircle,
  Clock, AlertTriangle, Loader2, Eye, ArrowRight,
} from "lucide-react";

export default function AgenticHub() {
  const [activeTab, setActiveTab] = useState("gate");

  // Gate queries
  const gateReviews = trpc.agentic.gate.list.useQuery({});
  const agents = trpc.agentic.agent.list.useQuery({});

  // Gate mutations
  const submitGate = trpc.agentic.gate.submit.useMutation({
    onSuccess: (data) => {
      toast.success(`Gate review: ${data.decision}`);
      gateReviews.refetch();
    },
  });
  const reviewGate = trpc.agentic.gate.review.useMutation({
    onSuccess: () => { toast.success("Review submitted"); gateReviews.refetch(); },
  });

  // Agent mutations
  const spawnAgent = trpc.agentic.agent.spawn.useMutation({
    onSuccess: (data) => {
      toast.success(`Agent spawned — Instance #${data.instanceId}`);
      agents.refetch();
    },
  });
  const terminateAgent = trpc.agentic.agent.terminate.useMutation({
    onSuccess: () => { toast.success("Agent terminated"); agents.refetch(); },
  });

  // Quote state
  const [quoteParams, setQuoteParams] = useState({
    clientId: 1, productType: "whole_life", faceAmount: 500000, clientAge: 45, healthClass: "preferred",
  });
  const generateQuotes = trpc.agentic.quote.generateQuotes.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.quotes.length} quotes generated from carriers`);
    },
  });

  // Estate doc state
  const [estateParams, setEstateParams] = useState({
    clientId: 1, documentType: "trust" as const, stateJurisdiction: "CA", complexityLevel: "standard" as const,
  });
  const generateEstateDraft = trpc.agentic.estateDocs.generateDraft.useMutation({
    onSuccess: () => { toast.success("Estate document draft generated"); },
  });

  const decisionColors: Record<string, string> = {
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    approved: "bg-green-500/10 text-green-600 border-green-500/20",
    rejected: "bg-red-500/10 text-red-600 border-red-500/20",
    modified: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    escalated: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agentic Execution Hub</h1>
        <p className="text-muted-foreground">Compliance-gated autonomous execution for insurance, advisory, and estate planning</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="gate" className="gap-1"><Shield className="h-3 w-3" /><span className="hidden sm:inline">Gate</span></TabsTrigger>
          <TabsTrigger value="agents" className="gap-1"><Bot className="h-3 w-3" /><span className="hidden sm:inline">Agents</span></TabsTrigger>
          <TabsTrigger value="quotes" className="gap-1"><Calculator className="h-3 w-3" /><span className="hidden sm:inline">Quotes</span></TabsTrigger>
          <TabsTrigger value="applications" className="gap-1"><FileText className="h-3 w-3" /><span className="hidden sm:inline">Apps</span></TabsTrigger>
          <TabsTrigger value="advisory" className="gap-1"><Scale className="h-3 w-3" /><span className="hidden sm:inline">Advisory</span></TabsTrigger>
          <TabsTrigger value="estate" className="gap-1"><Building2 className="h-3 w-3" /><span className="hidden sm:inline">Estate</span></TabsTrigger>
          <TabsTrigger value="finance" className="gap-1"><DollarSign className="h-3 w-3" /><span className="hidden sm:inline">Finance</span></TabsTrigger>
        </TabsList>

        {/* G8: Licensed Review Gate */}
        <TabsContent value="gate" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Licensed Review Gate</h3>
              <p className="text-sm text-muted-foreground">Universal compliance gate for all agentic actions</p>
            </div>
            <Button size="sm" onClick={() => submitGate.mutate({
              actionId: `TEST-${Date.now()}`, actionType: "test_action", complianceTier: 2,
            })} disabled={submitGate.isPending}>
              {submitGate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Test Gate
            </Button>
          </div>

          {/* Gate Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {["pending", "approved", "rejected", "modified", "escalated"].map(status => {
              const count = gateReviews.data?.filter((r: any) => r.decision === status).length || 0;
              return (
                <Card key={status}>
                  <CardContent className="py-3 text-center">
                    <p className="text-xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{status}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Gate Reviews List */}
          {gateReviews.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No gate reviews yet</p>
              <p className="text-sm mt-1">Actions requiring compliance review will appear here</p>
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {gateReviews.data?.map((review: any) => (
                <Card key={review.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={decisionColors[review.decision] || ""}>
                          {review.decision}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{review.actionType}</p>
                          <p className="text-xs text-muted-foreground">
                            Tier {review.complianceTier} · {review.actionId}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {review.decision === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="text-green-600" onClick={() => reviewGate.mutate({ gateReviewId: review.id, decision: "approved" })}>
                              <CheckCircle2 className="h-3 w-3 mr-1" />Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => reviewGate.mutate({ gateReviewId: review.id, decision: "rejected" })}>
                              <XCircle className="h-3 w-3 mr-1" />Reject
                            </Button>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(Number(review.createdAt)).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    {review.classificationRationale && (
                      <p className="text-xs text-muted-foreground mt-2 pl-[4.5rem]">{review.classificationRationale}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* G1: Agent Orchestrator */}
        <TabsContent value="agents" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Agent Orchestrator</h3>
              <p className="text-sm text-muted-foreground">Manage autonomous agent instances and their action logs</p>
            </div>
            <Button size="sm" onClick={() => spawnAgent.mutate({ workflowType: "general", runtimeLimitMinutes: 60 })} disabled={spawnAgent.isPending}>
              {spawnAgent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bot className="h-4 w-4 mr-2" />}
              Spawn Agent
            </Button>
          </div>

          {agents.data?.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">
              <Bot className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No agent instances</p>
              <p className="text-sm mt-1">Spawn an agent to begin autonomous execution</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-3">
              {agents.data?.map((agent: any) => (
                <Card key={agent.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agent.instanceStatus === "active" ? "bg-green-500/10" : "bg-muted"}`}>
                          <Bot className={`h-5 w-5 ${agent.instanceStatus === "active" ? "text-green-500" : "text-muted-foreground"}`} />
                        </div>
                        <div>
                          <p className="font-medium">Agent #{agent.id} — {agent.workflowType}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={agent.instanceStatus === "active" ? "default" : "secondary"}>{agent.instanceStatus}</Badge>
                            <span className="text-xs text-muted-foreground">{agent.totalActions || 0} actions</span>
                            <span className="text-xs text-muted-foreground">{agent.deploymentMode}</span>
                          </div>
                        </div>
                      </div>
                      {agent.instanceStatus === "active" && (
                        <Button size="sm" variant="destructive" onClick={() => terminateAgent.mutate({ instanceId: agent.id })}>
                          Terminate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* G2: Insurance Quotes */}
        <TabsContent value="quotes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Insurance Quote Engine</CardTitle>
              <CardDescription>Generate multi-carrier illustrative quotes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Select value={quoteParams.productType} onValueChange={v => setQuoteParams(p => ({ ...p, productType: v }))}>
                  <SelectTrigger><SelectValue placeholder="Product Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whole_life">Whole Life</SelectItem>
                    <SelectItem value="term_life">Term Life</SelectItem>
                    <SelectItem value="universal_life">Universal Life</SelectItem>
                    <SelectItem value="variable_life">Variable Life</SelectItem>
                    <SelectItem value="indexed_ul">Indexed UL</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Face Amount" value={quoteParams.faceAmount} onChange={e => setQuoteParams(p => ({ ...p, faceAmount: Number(e.target.value) }))} />
                <Input type="number" placeholder="Client Age" value={quoteParams.clientAge} onChange={e => setQuoteParams(p => ({ ...p, clientAge: Number(e.target.value) }))} />
                <Select value={quoteParams.healthClass} onValueChange={v => setQuoteParams(p => ({ ...p, healthClass: v }))}>
                  <SelectTrigger><SelectValue placeholder="Health Class" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preferred_plus">Preferred Plus</SelectItem>
                    <SelectItem value="preferred">Preferred</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="substandard">Substandard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => generateQuotes.mutate(quoteParams)} disabled={generateQuotes.isPending}>
                {generateQuotes.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Calculator className="h-4 w-4 mr-2" />}
                {generateQuotes.isPending ? "Generating Quotes..." : "Generate Multi-Carrier Quotes"}
              </Button>

              {generateQuotes.data?.quotes && generateQuotes.data.quotes.length > 0 && (
                <div className="space-y-3 mt-4">
                  <h4 className="font-semibold text-sm">Quote Results — Run {generateQuotes.data.quoteRunId}</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="py-2 pr-3">Carrier</th>
                          <th className="py-2 pr-3">Product</th>
                          <th className="py-2 pr-3 text-right">Monthly</th>
                          <th className="py-2 pr-3 text-right">Annual</th>
                          <th className="py-2 pr-3 text-right">Death Benefit</th>
                          <th className="py-2 pr-3 text-right">CV Yr 10</th>
                          <th className="py-2 pr-3">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateQuotes.data.quotes.map((q: any, i: number) => (
                          <tr key={i} className="border-b border-border/50">
                            <td className="py-2 pr-3 font-medium">{q.carrierName}</td>
                            <td className="py-2 pr-3">{q.productName}</td>
                            <td className="py-2 pr-3 text-right">${q.premiumMonthly?.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right">${q.premiumAnnual?.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right">${q.deathBenefit?.toLocaleString()}</td>
                            <td className="py-2 pr-3 text-right">${q.cashValueYr10?.toLocaleString()}</td>
                            <td className="py-2 pr-3"><Badge variant="outline">{q.amBestRating}</Badge></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* G3: Applications */}
        <TabsContent value="applications" className="space-y-4">
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <h3 className="font-semibold mb-1">Insurance Applications</h3>
            <p className="text-sm">Create applications from selected quotes with AI compliance preflight</p>
            <p className="text-xs mt-2">Select a quote from the Quotes tab to begin an application</p>
          </CardContent></Card>
        </TabsContent>

        {/* G4: Advisory Execution */}
        <TabsContent value="advisory" className="space-y-4">
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <Scale className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <h3 className="font-semibold mb-1">Advisory Execution</h3>
            <p className="text-sm">Account opening, rebalancing, tax-loss harvesting, and transfers</p>
            <p className="text-xs mt-2">Create advisory execution requests with AI tax impact estimation</p>
          </CardContent></Card>
        </TabsContent>

        {/* G5: Estate Documents */}
        <TabsContent value="estate" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Estate Document Generator</CardTitle>
              <CardDescription>AI-drafted trust, will, POA, and directive documents for attorney review</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Select value={estateParams.documentType} onValueChange={v => setEstateParams(p => ({ ...p, documentType: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Document Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trust">Revocable Trust</SelectItem>
                    <SelectItem value="will">Last Will & Testament</SelectItem>
                    <SelectItem value="poa_financial">Financial POA</SelectItem>
                    <SelectItem value="poa_healthcare">Healthcare POA</SelectItem>
                    <SelectItem value="directive">Advance Directive</SelectItem>
                    <SelectItem value="beneficiary_audit">Beneficiary Audit</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="State (e.g. CA)" value={estateParams.stateJurisdiction} onChange={e => setEstateParams(p => ({ ...p, stateJurisdiction: e.target.value }))} />
                <Select value={estateParams.complexityLevel} onValueChange={v => setEstateParams(p => ({ ...p, complexityLevel: v as any }))}>
                  <SelectTrigger><SelectValue placeholder="Complexity" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="complex">Complex</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={() => generateEstateDraft.mutate(estateParams)} disabled={generateEstateDraft.isPending}>
                {generateEstateDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Building2 className="h-4 w-4 mr-2" />}
                {generateEstateDraft.isPending ? "Generating Draft..." : "Generate Estate Document Draft"}
              </Button>

              {generateEstateDraft.data && (
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <h4 className="font-semibold text-sm mb-2">Document Outline</h4>
                    <p className="text-sm whitespace-pre-wrap">{(generateEstateDraft.data as any).outline}</p>
                  </div>
                  {(generateEstateDraft.data as any).keyProvisions?.length > 0 && (
                    <div className="p-4 rounded-lg bg-muted/50">
                      <h4 className="font-semibold text-sm mb-2">Key Provisions</h4>
                      <ul className="space-y-1">
                        {(generateEstateDraft.data as any).keyProvisions.map((p: string, i: number) => (
                          <li key={i} className="text-sm flex gap-2"><ArrowRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />{p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {(generateEstateDraft.data as any).attorneyNotes && (
                    <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                      <h4 className="font-semibold text-sm mb-1 text-amber-600">Attorney Review Notes</h4>
                      <p className="text-sm">{(generateEstateDraft.data as any).attorneyNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* G6: Premium Finance */}
        <TabsContent value="finance" className="space-y-4">
          <Card><CardContent className="py-12 text-center text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <h3 className="font-semibold mb-1">Premium Finance Engine</h3>
            <p className="text-sm">Loan structuring, stress testing, and collateral monitoring</p>
            <p className="text-xs mt-2">Create premium finance cases with AI-powered stress test scenarios</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
