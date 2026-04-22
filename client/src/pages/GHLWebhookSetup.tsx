/**
 * GHLWebhookSetup — In-app guided webhook registration for GoHighLevel.
 * Provides step-by-step instructions, copy-paste URLs, event checklist,
 * and a live verification test button.
 */
import { useState } from "react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, Webhook, Copy, CheckCircle2, XCircle, ExternalLink,
  Loader2, AlertTriangle, Radio, ChevronRight, Shield, Zap,
  Globe, Settings, ArrowRight, RefreshCw, ClipboardCheck
} from "lucide-react";
import { useLocation } from "wouter";

const WEBHOOK_URL = "https://stewardly.manus.space/api/webhooks/ghl";

const GHL_EVENTS = [
  { name: "ContactCreate", description: "When a new contact is created", category: "Contacts" },
  { name: "ContactUpdate", description: "When a contact is updated", category: "Contacts" },
  { name: "ContactDelete", description: "When a contact is deleted", category: "Contacts" },
  { name: "OpportunityCreate", description: "When a new opportunity is created", category: "Opportunities" },
  { name: "OpportunityStatusUpdate", description: "When an opportunity status changes", category: "Opportunities" },
];

const SETUP_STEPS = [
  {
    number: 1,
    title: "Open GoHighLevel Settings",
    description: "Navigate to your GHL sub-account settings",
    instructions: [
      "Log in to your GoHighLevel account",
      "Click Settings (gear icon) in the left sidebar",
      "Click on \"Integrations\" in the settings menu",
    ],
    link: "https://app.gohighlevel.com/v2/location/yUVrjyvzf0txCiJXuYGn/settings/lc-integrations",
    linkLabel: "Open GHL Integrations",
  },
  {
    number: 2,
    title: "Navigate to Automation → Workflows",
    description: "Create a new workflow to send webhook events",
    instructions: [
      "Click \"Automation\" in the left sidebar",
      "Click \"Workflows\" tab at the top",
      "Click the green \"+ Create Workflow\" button",
      "Select \"Start from scratch\" when prompted",
    ],
    link: "https://app.gohighlevel.com/v2/location/yUVrjyvzf0txCiJXuYGn/automation/workflows",
    linkLabel: "Open GHL Workflows",
  },
  {
    number: 3,
    title: "Add Contact Triggers",
    description: "Set up triggers for contact events",
    instructions: [
      "Click \"Add New Trigger\" in the workflow builder",
      "Search for and add these triggers one at a time:",
      "• Contact Created",
      "• Contact Changed",
      "• Contact Deleted (if available)",
      "Each trigger fires when the corresponding event occurs",
    ],
  },
  {
    number: 4,
    title: "Add Opportunity Triggers",
    description: "Set up triggers for opportunity/pipeline events",
    instructions: [
      "Click \"Add New Trigger\" again",
      "Search for and add these triggers:",
      "• Opportunity Created",
      "• Opportunity Status Changed",
      "These track your pipeline activity in Stewardly",
    ],
  },
  {
    number: 5,
    title: "Add Webhook Action",
    description: "Configure the webhook to send data to Stewardly",
    instructions: [
      "Below the triggers, click the \"+\" to add an action",
      "Search for \"Webhook\" in the actions list",
      "Select \"Send Webhook\" or \"Custom Webhook\"",
      "Set Method to POST",
      "Paste the Stewardly webhook URL (copied below)",
      "Set Content-Type header to application/json",
      "In the body, use \"Custom Values\" to include all contact/opportunity fields",
    ],
  },
  {
    number: 6,
    title: "Publish & Test",
    description: "Activate the workflow and verify it works",
    instructions: [
      "Name your workflow: \"Stewardly CRM Sync\"",
      "Click \"Save\" then toggle the workflow to \"Published\"",
      "Use the \"Send Test\" button below to verify the connection",
      "Create a test contact in GHL to confirm events flow through",
    ],
  },
];

export default function GHLWebhookSetup() {
  const [, navigate] = useLocation();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number>(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const healthQ = trpc.integrations.ghlWebhookHealth.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const testMut = trpc.integrations.testGhlWebhook.useMutation({
    onSuccess: (result) => {
      if (result.success) {
        toast.success("Webhook test successful! Your endpoint is receiving events correctly.");
      } else {
        toast.error(`Webhook test failed (HTTP ${result.status}): ${JSON.stringify(result.response)}`);
      }
    },
    onError: (e) => toast.error("Test failed: " + e.message),
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setCopiedUrl(true);
    toast.success("Webhook URL copied to clipboard");
    setTimeout(() => setCopiedUrl(false), 3000);
  };

  const toggleStep = (step: number) => {
    setExpandedStep(expandedStep === step ? 0 : step);
  };

  const markStepComplete = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });
  };

  const isHealthy = healthQ.data?.status === "ok";
  const progress = (completedSteps.size / SETUP_STEPS.length) * 100;

  return (
    <AppShell>
      <SEOHead title="GHL Webhook Setup" />
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/webhooks")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Webhook className="h-6 w-6 text-primary" />
              GoHighLevel Webhook Setup
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Connect GHL events to Stewardly for real-time CRM synchronization
            </p>
          </div>
          <Badge
            variant={isHealthy ? "outline" : "destructive"}
            className="gap-1.5 px-3 py-1"
          >
            <Radio className={`h-3 w-3 ${isHealthy ? "text-emerald-400 animate-pulse" : "text-red-400"}`} />
            {isHealthy ? "Endpoint Active" : "Endpoint Down"}
          </Badge>
        </div>

        {/* Webhook URL Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Your Webhook URL
            </CardTitle>
            <CardDescription>
              Copy this URL and paste it into your GHL workflow webhook action
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-background border rounded-md px-4 py-3 font-mono text-sm break-all select-all">
                {WEBHOOK_URL}
              </code>
              <Button
                variant={copiedUrl ? "default" : "outline"}
                size="sm"
                onClick={copyUrl}
                className="shrink-0 gap-1.5"
              >
                {copiedUrl ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copiedUrl ? "Copied!" : "Copy"}
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" /> HTTPS encrypted
              </span>
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> Ed25519 signature verification
              </span>
              <span className="flex items-center gap-1">
                <Settings className="h-3 w-3" /> Method: POST
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Setup Progress</span>
            <span className="text-muted-foreground">{completedSteps.size} of {SETUP_STEPS.length} steps</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Supported Events */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Supported Events
            </CardTitle>
            <CardDescription>
              These GHL events will be processed by Stewardly when received
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GHL_EVENTS.map((evt) => (
                <div
                  key={evt.name}
                  className="flex items-center gap-3 px-3 py-2 rounded-md bg-secondary/30 border border-border/50"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{evt.name}</div>
                    <div className="text-xs text-muted-foreground">{evt.description}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                    {evt.category}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Step-by-Step Guide */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Step-by-Step Setup Guide
          </h2>

          {SETUP_STEPS.map((step) => {
            const isExpanded = expandedStep === step.number;
            const isComplete = completedSteps.has(step.number);

            return (
              <Card
                key={step.number}
                className={`transition-all duration-200 ${
                  isComplete ? "border-emerald-500/30 bg-emerald-500/5" : ""
                } ${isExpanded ? "ring-1 ring-primary/30" : ""}`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => toggleStep(step.number)}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                      isComplete
                        ? "bg-emerald-500 text-white"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {isComplete ? <CheckCircle2 className="h-4 w-4" /> : step.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{step.title}</div>
                    <div className="text-xs text-muted-foreground">{step.description}</div>
                  </div>
                  <ChevronRight
                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  />
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    <Separator className="mb-3" />
                    <ol className="space-y-2 ml-1">
                      {step.instructions.map((inst, i) => (
                        <li key={i} className="text-sm text-foreground/80 flex items-start gap-2">
                          {inst.startsWith("•") ? (
                            <span className="text-primary mt-0.5">•</span>
                          ) : (
                            <span className="text-muted-foreground font-mono text-xs mt-0.5 w-4 shrink-0">
                              {i + 1}.
                            </span>
                          )}
                          <span>{inst.startsWith("•") ? inst.slice(2) : inst}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="flex items-center gap-2 mt-4">
                      {step.link && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => window.open(step.link, "_blank", "noopener,noreferrer")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          {step.linkLabel}
                        </Button>
                      )}
                      <Button
                        variant={isComplete ? "ghost" : "default"}
                        size="sm"
                        className="gap-1.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          markStepComplete(step.number);
                          if (!isComplete && step.number < SETUP_STEPS.length) {
                            setExpandedStep(step.number + 1);
                          }
                        }}
                      >
                        {isComplete ? (
                          <>
                            <XCircle className="h-3.5 w-3.5" /> Mark Incomplete
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Mark Complete
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Verification Test */}
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Webhook Verification Test
            </CardTitle>
            <CardDescription>
              Send a test event to verify your webhook endpoint is working correctly
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 space-y-1">
                <div className="text-sm">
                  <span className="font-medium">Endpoint Status: </span>
                  {healthQ.isLoading ? (
                    <span className="text-muted-foreground">Checking...</span>
                  ) : isHealthy ? (
                    <span className="text-emerald-500 font-medium">Active and Ready</span>
                  ) : (
                    <span className="text-red-500 font-medium">
                      {healthQ.data?.message || "Unreachable"}
                    </span>
                  )}
                </div>
                {healthQ.data?.supportedEvents && (
                  <div className="text-xs text-muted-foreground">
                    {healthQ.data.supportedEvents.length} event types supported
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => healthQ.refetch()}
                disabled={healthQ.isFetching}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${healthQ.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>

            <Separator />

            <div className="flex items-center gap-3">
              <Button
                onClick={() => testMut.mutate()}
                disabled={testMut.isPending}
                className="gap-2"
              >
                {testMut.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                Send Test Event
              </Button>
              <span className="text-xs text-muted-foreground">
                Sends a simulated ContactCreate event to the webhook endpoint
              </span>
            </div>

            {testMut.data && (
              <div
                className={`rounded-md border p-3 text-sm ${
                  testMut.data.success
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {testMut.data.success ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {testMut.data.success ? "Test Passed" : "Test Failed"}
                  <Badge variant="outline" className="text-xs ml-auto">
                    HTTP {testMut.data.status}
                  </Badge>
                </div>
                <pre className="mt-2 text-xs font-mono whitespace-pre-wrap break-all opacity-80">
                  {JSON.stringify(testMut.data.response, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Alternative: Direct API Setup */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Alternative: GHL API Webhook (Advanced)
            </CardTitle>
            <CardDescription>
              If you have a GHL Marketplace App with OAuth2 tokens, you can register webhooks programmatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                The GHL API webhook registration endpoint requires OAuth2 app-level tokens (not Private Integration / location API keys).
                If you have a Marketplace App configured:
              </p>
              <code className="block bg-secondary/50 rounded-md p-3 font-mono text-xs break-all">
                POST https://services.leadconnectorhq.com/hooks/<br />
                Authorization: Bearer YOUR_OAUTH2_TOKEN<br />
                {`{ "targetUrl": "${WEBHOOK_URL}", "events": ["ContactCreate", "ContactUpdate", ...] }`}
              </code>
              <p className="text-xs">
                For most users, the Workflow approach above is simpler and doesn't require a Marketplace App.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={() => navigate("/admin/webhooks")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Webhooks
          </Button>
          <Button variant="outline" onClick={() => navigate("/admin/sync-dashboard")} className="gap-1.5">
            View Sync Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
