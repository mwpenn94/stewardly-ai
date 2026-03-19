/**
 * AITuningTab — 5-layer AI personalization editor embedded in the Settings hub.
 * Each layer editor maps to the actual aiLayers router endpoints.
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Eye, Layers, Loader2, Save, Settings2, Shield, Users, User, Building2
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

// ─── TYPES ───────────────────────────────────────────────────────────
type LayerTab = "user" | "professional" | "manager" | "organization" | "platform" | "preview";

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
  { value: "educational", label: "Educational" },
  { value: "formal", label: "Formal" },
  { value: "friendly", label: "Friendly" },
  { value: "technical", label: "Technical" },
];

const FORMAT_OPTIONS = [
  { value: "mixed", label: "Mixed (bullets + prose)" },
  { value: "bullets", label: "Bullet Points" },
  { value: "prose", label: "Flowing Prose" },
];

const LENGTH_OPTIONS = [
  { value: "concise", label: "Concise" },
  { value: "standard", label: "Standard" },
  { value: "comprehensive", label: "Comprehensive" },
];

const LAYER_TABS: { id: LayerTab; label: string; layer: number; icon: React.ReactNode; desc: string }[] = [
  { id: "user", label: "My Preferences", layer: 5, icon: <User className="w-4 h-4" />, desc: "Your personal AI settings" },
  { id: "professional", label: "Professional", layer: 4, icon: <Settings2 className="w-4 h-4" />, desc: "Advisor-level tuning" },
  { id: "manager", label: "Manager", layer: 3, icon: <Users className="w-4 h-4" />, desc: "Team-level overrides" },
  { id: "organization", label: "Organization", layer: 2, icon: <Building2 className="w-4 h-4" />, desc: "Org-wide AI policy" },
  { id: "platform", label: "Platform", layer: 1, icon: <Shield className="w-4 h-4" />, desc: "Global base settings" },
  { id: "preview", label: "Preview", layer: 0, icon: <Eye className="w-4 h-4" />, desc: "See assembled config" },
];

// ═══════════════════════════════════════════════════════════════════════
// SHARED LAYER FIELDS COMPONENT
// ═══════════════════════════════════════════════════════════════════════
function LayerFields({
  promptOverlay, setPromptOverlay,
  toneStyle, setToneStyle,
  responseFormat, setResponseFormat,
  responseLength, setResponseLength,
  temperature, setTemperature,
  onSave, saving, layerLabel,
}: {
  promptOverlay: string; setPromptOverlay: (v: string) => void;
  toneStyle: string; setToneStyle: (v: string) => void;
  responseFormat: string; setResponseFormat: (v: string) => void;
  responseLength: string; setResponseLength: (v: string) => void;
  temperature: number; setTemperature: (v: number) => void;
  onSave: () => void; saving: boolean; layerLabel: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Prompt Overlay</Label>
        <Textarea
          value={promptOverlay}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPromptOverlay(e.target.value)}
          placeholder={`Additional instructions for the ${layerLabel} layer. Appended to higher-layer prompts.`}
          className="bg-secondary border-border min-h-[100px] text-sm"
        />
        <p className="text-[9px] text-muted-foreground mt-1">Appended to the prompt cascade — does not replace higher layers.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Tone</Label>
          <Select value={toneStyle || "professional"} onValueChange={setToneStyle}>
            <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Format</Label>
          <Select value={responseFormat || "mixed"} onValueChange={setResponseFormat}>
            <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Length</Label>
          <Select value={responseLength || "standard"} onValueChange={setResponseLength}>
            <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs font-medium">Temperature</Label>
          <span className="text-[10px] text-muted-foreground font-mono">{temperature.toFixed(2)}</span>
        </div>
        <Slider value={[temperature]} onValueChange={([v]) => setTemperature(v)} min={0} max={1} step={0.05} className="w-full" />
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>Precise</span><span>Creative</span>
        </div>
      </div>

      <Button
        size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
        onClick={onSave} disabled={saving}
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save {layerLabel} Settings
      </Button>
    </div>
  );
}

// ─── USER PREFERENCES EDITOR (Layer 5) ──────────────────────────────
function UserPreferencesEditor() {
  const query = trpc.aiLayers.getUserPreferences.useQuery();
  const mutation = trpc.aiLayers.updateUserPreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: (e) => toast.error(e.message),
  });

  const [promptOverlay, setPromptOverlay] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (query.data) {
      setPromptOverlay(query.data.customPromptAdditions || "");
      setToneStyle(query.data.communicationStyle || "professional");
      setResponseFormat(query.data.responseFormat || "mixed");
      setResponseLength(query.data.responseLength || "standard");
      setTemperature(query.data.temperature ?? 0.7);
    }
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <LayerFields
      promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
      toneStyle={toneStyle} setToneStyle={setToneStyle}
      responseFormat={responseFormat} setResponseFormat={setResponseFormat}
      responseLength={responseLength} setResponseLength={setResponseLength}
      temperature={temperature} setTemperature={setTemperature}
      onSave={() => mutation.mutate({
        customPromptAdditions: promptOverlay,
        communicationStyle: toneStyle as any,
        responseFormat,
        responseLength: responseLength as any,
        temperature,
      })}
      saving={mutation.isPending}
      layerLabel="User"
    />
  );
}

// ─── PROFESSIONAL EDITOR (Layer 4) ─────────────────────────────────
function ProfessionalEditor({ userId }: { userId: number }) {
  const query = trpc.aiLayers.getProfessionalSettings.useQuery({ professionalId: userId });
  const mutation = trpc.aiLayers.updateProfessionalSettings.useMutation({
    onSuccess: () => toast.success("Professional settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [promptOverlay, setPromptOverlay] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (query.data) {
      setPromptOverlay(query.data.promptOverlay || "");
      setToneStyle(query.data.toneStyle || "professional");
      setResponseFormat(query.data.responseFormat || "mixed");
      setResponseLength(query.data.responseLength || "standard");
      setTemperature(query.data.temperature ?? 0.7);
    }
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <LayerFields
      promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
      toneStyle={toneStyle} setToneStyle={setToneStyle}
      responseFormat={responseFormat} setResponseFormat={setResponseFormat}
      responseLength={responseLength} setResponseLength={setResponseLength}
      temperature={temperature} setTemperature={setTemperature}
      onSave={() => mutation.mutate({
        professionalId: userId,
        promptOverlay, toneStyle, responseFormat, responseLength, temperature,
      })}
      saving={mutation.isPending}
      layerLabel="Professional"
    />
  );
}

// ─── MANAGER EDITOR (Layer 3) ──────────────────────────────────────
function ManagerEditor({ userId }: { userId: number }) {
  const query = trpc.aiLayers.getManagerSettings.useQuery({ managerId: userId });
  const mutation = trpc.aiLayers.updateManagerSettings.useMutation({
    onSuccess: () => toast.success("Manager settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [promptOverlay, setPromptOverlay] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (query.data) {
      setPromptOverlay(query.data.promptOverlay || "");
      setToneStyle(query.data.toneStyle || "professional");
      setResponseFormat(query.data.responseFormat || "mixed");
      setResponseLength(query.data.responseLength || "standard");
      setTemperature(query.data.temperature ?? 0.7);
    }
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <LayerFields
      promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
      toneStyle={toneStyle} setToneStyle={setToneStyle}
      responseFormat={responseFormat} setResponseFormat={setResponseFormat}
      responseLength={responseLength} setResponseLength={setResponseLength}
      temperature={temperature} setTemperature={setTemperature}
      onSave={() => mutation.mutate({
        managerId: userId,
        promptOverlay, toneStyle, responseFormat, responseLength, temperature,
      })}
      saving={mutation.isPending}
      layerLabel="Manager"
    />
  );
}

// ─── PLATFORM EDITOR (Layer 1) ─────────────────────────────────────
function PlatformEditor() {
  const query = trpc.aiLayers.getPlatformSettings.useQuery();
  const mutation = trpc.aiLayers.updatePlatformSettings.useMutation({
    onSuccess: () => toast.success("Platform settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [promptOverlay, setPromptOverlay] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (query.data) {
      setPromptOverlay(query.data.baseSystemPrompt || "");
      setToneStyle(query.data.defaultTone || "professional");
      setResponseFormat(query.data.defaultResponseFormat || "mixed");
      setResponseLength(query.data.defaultResponseLength || "standard");
      setTemperature(query.data.temperatureDefault ?? 0.7);
    }
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5" />
          Platform-level settings affect ALL users. Changes here cascade through every layer.
        </p>
      </div>
      <LayerFields
        promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
        toneStyle={toneStyle} setToneStyle={setToneStyle}
        responseFormat={responseFormat} setResponseFormat={setResponseFormat}
        responseLength={responseLength} setResponseLength={setResponseLength}
        temperature={temperature} setTemperature={setTemperature}
        onSave={() => mutation.mutate({
          baseSystemPrompt: promptOverlay,
          defaultTone: toneStyle,
          defaultResponseFormat: responseFormat,
          defaultResponseLength: responseLength,
          temperatureDefault: temperature,
        })}
        saving={mutation.isPending}
        layerLabel="Platform"
      />
    </div>
  );
}

// ─── PREVIEW PANEL ──────────────────────────────────────────────────
function PreviewPanel({ userId }: { userId: number }) {
  const query = trpc.aiLayers.previewConfig.useQuery({ targetUserId: userId });

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;
  if (query.error) return <p className="text-sm text-destructive">Failed to load preview: {query.error.message}</p>;

  const data = query.data?.config;
  const assembledPrompt = query.data?.assembledPrompt;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold mb-2">Resolved Configuration</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-[9px] text-muted-foreground">Tone</p>
            <p className="text-xs font-medium capitalize">{data?.toneStyle || "—"}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-[9px] text-muted-foreground">Format</p>
            <p className="text-xs font-medium capitalize">{data?.responseFormat || "—"}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-[9px] text-muted-foreground">Length</p>
            <p className="text-xs font-medium capitalize">{data?.responseLength || "—"}</p>
          </div>
          <div className="p-2.5 rounded-lg bg-secondary/50 border border-border/50">
            <p className="text-[9px] text-muted-foreground">Temperature</p>
            <p className="text-xs font-medium font-mono">{data?.temperature?.toFixed(2) || "—"}</p>
          </div>
        </div>
      </div>

      {data?.guardrails && data.guardrails.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Active Guardrails</h3>
          <div className="flex flex-wrap gap-1.5">
            {data.guardrails.map((g: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[10px]">{g}</Badge>
            ))}
          </div>
        </div>
      )}

      {data?.layerSources && data.layerSources.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Layer Sources</h3>
          <div className="space-y-1">
            {data.layerSources.map((s: any, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <Badge variant={s.hasConfig ? "default" : "outline"} className="text-[9px] w-6 h-5 flex items-center justify-center p-0">
                  L{s.layer}
                </Badge>
                <span className={s.hasConfig ? "text-foreground" : "text-muted-foreground"}>{s.name}</span>
                {s.hasConfig && <span className="text-emerald-400 text-[9px]">active</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h3 className="text-sm font-semibold mb-2">Assembled Prompt Cascade</h3>
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/30 max-h-[40vh] overflow-y-auto">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{assembledPrompt || "(No overlay prompt generated)"}</pre>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN TAB COMPONENT
// ═══════════════════════════════════════════════════════════════════════
export default function AITuningTab() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<LayerTab>("user");

  const userRole = user?.role || "user";
  const visibleTabs = useMemo(() => {
    const tabs: LayerTab[] = ["user"];
    if (["advisor", "manager", "admin"].includes(userRole)) tabs.push("professional");
    if (["manager", "admin"].includes(userRole)) tabs.push("manager");
    if (["admin"].includes(userRole)) {
      tabs.push("organization");
      tabs.push("platform");
    }
    tabs.push("preview");
    return tabs;
  }, [userRole]);

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h2 className="text-lg font-semibold mb-1">AI Tuning</h2>
        <p className="text-sm text-muted-foreground">
          Fine-tune how the AI responds at each layer of the hierarchy. Lower layers override higher layers for style settings; prompt overlays are appended.
        </p>
      </div>

      {/* Layer tab navigation */}
      <div className="flex gap-1 mb-5 overflow-x-auto pb-1">
        {LAYER_TABS.filter(t => visibleTabs.includes(t.id)).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? "bg-accent/15 text-accent border border-accent/30"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.layer > 0 && (
              <span className={`text-[9px] font-mono ${activeTab === tab.id ? "text-accent/70" : "text-muted-foreground/50"}`}>
                L{tab.layer}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Layer description */}
      {activeTab !== "preview" && (
        <div className="mb-5 p-3 rounded-lg bg-card/30 border border-border/30 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
            {LAYER_TABS.find(t => t.id === activeTab)?.icon}
          </div>
          <div>
            <p className="text-xs font-semibold">{LAYER_TABS.find(t => t.id === activeTab)?.label}</p>
            <p className="text-[10px] text-muted-foreground">{LAYER_TABS.find(t => t.id === activeTab)?.desc}</p>
          </div>
          <Badge variant="outline" className="text-[9px] ml-auto shrink-0">
            Layer {LAYER_TABS.find(t => t.id === activeTab)?.layer}
          </Badge>
        </div>
      )}

      {/* Tab content */}
      {activeTab === "user" && <UserPreferencesEditor />}
      {activeTab === "professional" && user && <ProfessionalEditor userId={user.id} />}
      {activeTab === "manager" && user && <ManagerEditor userId={user.id} />}
      {activeTab === "organization" && (
        <div className="text-center text-muted-foreground py-10">
          <Building2 className="w-7 h-7 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Organization AI settings are managed from the Organization Settings page.</p>
        </div>
      )}
      {activeTab === "platform" && <PlatformEditor />}
      {activeTab === "preview" && user && <PreviewPanel userId={user.id} />}
    </div>
  );
}
