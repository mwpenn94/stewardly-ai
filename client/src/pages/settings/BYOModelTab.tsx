/**
 * BYOModelTab — Bring Your Own Model settings.
 *
 * Absorbed from manus-next-app sovereign mode + BYO infrastructure.
 * Allows users to configure their own model providers (S1-S4 tiers).
 * Per v2.0.3 §3: BYOM is a core differentiator for Stewardly.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Shield, Zap, Brain, Server, AlertTriangle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type BYOTier = "S1" | "S2" | "S3" | "S4";

interface ProviderConfig {
  name: string;
  tier: BYOTier;
  apiEndpoint: string;
  apiKey: string;
  modelId: string;
  enabled: boolean;
}

const TIER_INFO: Record<BYOTier, { label: string; desc: string; icon: typeof Shield; color: string }> = {
  S1: { label: "S1 — Platform Default", desc: "Uses Stewardly's built-in models. No configuration needed.", icon: Shield, color: "text-emerald-500" },
  S2: { label: "S2 — Managed BYO", desc: "Your API key, our routing. Cost tracked, compliance preserved.", icon: Zap, color: "text-primary" },
  S3: { label: "S3 — Self-Hosted", desc: "Your infrastructure, our orchestration. Full cost control.", icon: Server, color: "text-amber-500" },
  S4: { label: "S4 — Air-Gapped", desc: "Fully sovereign. No data leaves your environment.", icon: Brain, color: "text-purple-500" },
};

export default function BYOModelTab() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [activeTier, setActiveTier] = useState<BYOTier>("S1");
  const [newProvider, setNewProvider] = useState<Partial<ProviderConfig>>({
    tier: "S2",
    enabled: true,
  });
  const [testing, setTesting] = useState(false);

  const testBYOMutation = trpc.substrate.testBYO.useMutation();
  const handleTestConnection = async () => {
    if (!newProvider.apiEndpoint || !newProvider.apiKey) {
      toast.error("Please fill in API endpoint and key");
      return;
    }
    setTesting(true);
    try {
      const result = await testBYOMutation.mutateAsync({
        endpoint: newProvider.apiEndpoint,
        apiKey: newProvider.apiKey,
        modelId: newProvider.modelId,
      });
      if (result.success) {
        toast.success(`Connection verified (${result.latencyMs}ms) — Model: ${result.model ?? "detected"}`);
      } else {
        toast.error(`Connection failed: ${result.error ?? "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error(`Test failed: ${err.message ?? "Network error"}`);
    } finally {
      setTesting(false);
    }
  };

  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiEndpoint || !newProvider.apiKey || !newProvider.modelId) {
      toast.error("Please fill in all required fields");
      return;
    }
    setProviders((prev) => [
      ...prev,
      { ...newProvider, enabled: true } as ProviderConfig,
    ]);
    setNewProvider({ tier: "S2", enabled: true });
    toast.success(`Provider "${newProvider.name}" added`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold font-heading">Bring Your Own Model</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure your own AI model providers. Stewardly routes intelligently across your models
          while preserving compliance guardrails and cost tracking.
        </p>
      </div>

      {/* Active Tier Selection */}
      <Card className="glass-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Active Sovereignty Tier
          </CardTitle>
          <CardDescription>
            Choose how much control you want over model infrastructure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(Object.entries(TIER_INFO) as [BYOTier, typeof TIER_INFO.S1][]).map(([tier, info]) => {
              const Icon = info.icon;
              const isActive = activeTier === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setActiveTier(tier)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    isActive
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border hover:border-primary/30 hover:bg-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-4 h-4 ${info.color}`} />
                    <span className="text-xs font-semibold">{info.label}</span>
                    {isActive && <Check className="w-3 h-3 text-primary ml-auto" />}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{info.desc}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Provider Configuration (only for S2-S4) */}
      {activeTier !== "S1" && (
        <>
          <Separator />
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Model Provider</CardTitle>
              <CardDescription>
                Configure an external model endpoint for {TIER_INFO[activeTier].label}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider-name" className="text-xs">Provider Name</Label>
                  <Input
                    id="provider-name"
                    placeholder="e.g., My OpenAI, Anthropic, Local Ollama"
                    value={newProvider.name || ""}
                    onChange={(e) => setNewProvider((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-id" className="text-xs">Model ID</Label>
                  <Input
                    id="model-id"
                    placeholder="e.g., gpt-4o, claude-3-opus, llama-3.1-70b"
                    value={newProvider.modelId || ""}
                    onChange={(e) => setNewProvider((p) => ({ ...p, modelId: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-endpoint" className="text-xs">API Endpoint</Label>
                <Input
                  id="api-endpoint"
                  placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                  value={newProvider.apiEndpoint || ""}
                  onChange={(e) => setNewProvider((p) => ({ ...p, apiEndpoint: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="api-key" className="text-xs">API Key</Label>
                <Input
                  id="api-key"
                  type="password"
                  placeholder="sk-..."
                  value={newProvider.apiKey || ""}
                  onChange={(e) => setNewProvider((p) => ({ ...p, apiKey: e.target.value }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                  Test Connection
                </Button>
                <Button size="sm" onClick={handleAddProvider}>
                  Add Provider
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Existing Providers */}
          {providers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Configured Providers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {providers.map((p, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <Server className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-[11px] text-muted-foreground">{p.modelId} • {p.tier}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.enabled ? "default" : "secondary"} className="text-[10px]">
                          {p.enabled ? "Active" : "Disabled"}
                        </Badge>
                        <Switch
                          checked={p.enabled}
                          onCheckedChange={(checked) => {
                            setProviders((prev) =>
                              prev.map((pr, idx) => (idx === i ? { ...pr, enabled: checked } : pr))
                            );
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Compliance Notice */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-amber-500 mb-1">Compliance Notice</p>
              <p>
                When using BYO models (S2-S4), AEGIS pre/post-flight checks still apply.
                Stewardly cannot guarantee compliance for responses generated by external models
                unless they pass through the AEGIS pipeline. Ensure your model endpoints
                support the required latency for real-time guardrail evaluation.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
