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
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import {
  Eye, Layers, Loader2, Save, Settings2, Shield, Users, User, Building2, Plus, X, AlertCircle,
  Brain, Zap, BookOpen, MessageSquare, HelpCircle, RefreshCw, Sparkles as SparklesIcon, Info
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  onSave, saving, layerLabel, hideSaveButton,
}: {
  promptOverlay: string; setPromptOverlay: (v: string) => void;
  toneStyle: string; setToneStyle: (v: string) => void;
  responseFormat: string; setResponseFormat: (v: string) => void;
  responseLength: string; setResponseLength: (v: string) => void;
  temperature: number; setTemperature: (v: number) => void;
  onSave: () => void; saving: boolean; layerLabel: string; hideSaveButton?: boolean;
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

      {!hideSaveButton && (
        <Button
          size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
          onClick={onSave} disabled={saving}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Save {layerLabel} Settings
        </Button>
      )}
    </div>
  );
}

// ─── TOOLTIP HELPER ─────────────────────────────────────────────────
function TuningTooltip({ children, tip }: { children: React.ReactNode; tip: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── THINKING DEPTH OPTIONS ─────────────────────────────────────────
const THINKING_DEPTH_OPTIONS = [
  { value: "quick", label: "Quick", icon: <Zap className="w-3.5 h-3.5" />, desc: "Fast responses, minimal reasoning" },
  { value: "standard", label: "Standard", icon: <Brain className="w-3.5 h-3.5" />, desc: "Balanced depth and speed" },
  { value: "deep", label: "Deep", icon: <BookOpen className="w-3.5 h-3.5" />, desc: "Thorough analysis, longer responses" },
  { value: "extended", label: "Extended", icon: <SparklesIcon className="w-3.5 h-3.5" />, desc: "Maximum reasoning, multi-step chains" },
];

const CONTEXT_DEPTH_OPTIONS = [
  { value: "recent", label: "Recent", desc: "Last 5 messages" },
  { value: "moderate", label: "Moderate", desc: "Last 15 messages" },
  { value: "full", label: "Full History", desc: "All available context" },
];

const DISCLAIMER_OPTIONS = [
  { value: "minimal", label: "Minimal" },
  { value: "standard", label: "Standard" },
  { value: "comprehensive", label: "Comprehensive" },
];

const CITATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "inline", label: "Inline" },
  { value: "footnotes", label: "Footnotes" },
];

// ─── USER PREFERENCES EDITOR (Layer 5) ──────────────────────────────
function UserPreferencesEditor() {
  const query = trpc.aiLayers.getUserPreferences.useQuery();
  const mutation = trpc.aiLayers.updateUserPreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: (e) => toast.error(e.message),
  });

  // Existing fields
  const [promptOverlay, setPromptOverlay] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  // AI Fine-Tuning fields
  const [thinkingDepth, setThinkingDepth] = useState("standard");
  const [creativity, setCreativity] = useState(0.7);
  const [contextDepth, setContextDepth] = useState("moderate");
  const [disclaimerVerbosity, setDisclaimerVerbosity] = useState("standard");
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [autoFollowUpCount, setAutoFollowUpCount] = useState(1);
  const [crossModelVerify, setCrossModelVerify] = useState(false);
  const [citationStyle, setCitationStyle] = useState("none");
  const [reasoningTransparency, setReasoningTransparency] = useState(false);

  useEffect(() => {
    if (query.data) {
      setPromptOverlay(query.data.customPromptAdditions || "");
      setToneStyle(query.data.communicationStyle || "professional");
      setResponseFormat(query.data.responseFormat || "mixed");
      setResponseLength(query.data.responseLength || "standard");
      setTemperature(query.data.temperature ?? 0.7);
      // AI Fine-Tuning
      setThinkingDepth(query.data.thinkingDepth || "standard");
      setCreativity(query.data.creativity ?? 0.7);
      setContextDepth(query.data.contextDepth || "moderate");
      setDisclaimerVerbosity(query.data.disclaimerVerbosity || "standard");
      setAutoFollowUp(query.data.autoFollowUp ?? false);
      setAutoFollowUpCount(query.data.autoFollowUpCount ?? 1);
      setCrossModelVerify(query.data.crossModelVerify ?? false);
      setCitationStyle(query.data.citationStyle || "none");
      setReasoningTransparency(query.data.reasoningTransparency ?? false);
    }
  }, [query.data]);

  if (query.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  const handleSave = () => mutation.mutate({
    customPromptAdditions: promptOverlay,
    communicationStyle: toneStyle as any,
    responseFormat,
    responseLength: responseLength as any,
    temperature,
    thinkingDepth: thinkingDepth as any,
    creativity,
    contextDepth: contextDepth as any,
    disclaimerVerbosity: disclaimerVerbosity as any,
    autoFollowUp,
    autoFollowUpCount,
    crossModelVerify,
    citationStyle: citationStyle as any,
    reasoningTransparency,
  });

  return (
    <div className="space-y-6">
      {/* ── Thinking Depth ── */}
      <Card className="bg-card/40 border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" />
            <Label className="text-sm font-semibold">Thinking Depth</Label>
            <TuningTooltip tip="Controls how deeply the AI reasons before responding. Extended thinking produces more thorough analysis but takes longer.">
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TuningTooltip>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THINKING_DEPTH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setThinkingDepth(opt.value)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  thinkingDepth === opt.value
                    ? "bg-accent/15 border-accent/40 text-accent"
                    : "bg-secondary/30 border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  {opt.icon}
                  <span className="text-xs font-medium">{opt.label}</span>
                </div>
                <p className="text-[9px] leading-tight opacity-70">{opt.desc}</p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Style & Tone (existing LayerFields) ── */}
      <Card className="bg-card/40 border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4 text-accent" />
            <Label className="text-sm font-semibold">Response Style</Label>
          </div>
          <LayerFields
            promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
            toneStyle={toneStyle} setToneStyle={setToneStyle}
            responseFormat={responseFormat} setResponseFormat={setResponseFormat}
            responseLength={responseLength} setResponseLength={setResponseLength}
            temperature={temperature} setTemperature={setTemperature}
            onSave={handleSave}
            saving={mutation.isPending}
            layerLabel="User"
            hideSaveButton
          />
        </CardContent>
      </Card>

      {/* ── Creativity Slider ── */}
      <Card className="bg-card/40 border-border/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-accent" />
            <Label className="text-sm font-semibold">Creativity</Label>
            <TuningTooltip tip="Higher creativity produces more novel and varied responses. Lower values keep responses more predictable and factual.">
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
            </TuningTooltip>
            <span className="ml-auto text-[10px] text-muted-foreground font-mono">{creativity.toFixed(2)}</span>
          </div>
          <Slider value={[creativity]} onValueChange={([v]) => setCreativity(v)} min={0} max={2} step={0.05} className="w-full" />
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Precise</span><span>Balanced</span><span>Creative</span><span>Experimental</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Context & Citations ── */}
      <Card className="bg-card/40 border-border/40">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-accent" />
            <Label className="text-sm font-semibold">Context & Citations</Label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Context Window</Label>
              <div className="flex gap-1.5">
                {CONTEXT_DEPTH_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setContextDepth(opt.value)}
                    className={`flex-1 px-2 py-1.5 rounded-md text-center transition-all ${
                      contextDepth === opt.value
                        ? "bg-accent/15 border border-accent/40 text-accent"
                        : "bg-secondary/30 border border-border/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="text-[10px] font-medium block">{opt.label}</span>
                    <span className="text-[8px] opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium mb-1.5 block">Citation Style</Label>
              <Select value={citationStyle} onValueChange={setCitationStyle}>
                <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CITATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs font-medium mb-1.5 block">Financial Disclaimer Verbosity</Label>
            <Select value={disclaimerVerbosity} onValueChange={setDisclaimerVerbosity}>
              <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DISCLAIMER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ── Advanced Toggles ── */}
      <Card className="bg-card/40 border-border/40">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-4 h-4 text-accent" />
            <Label className="text-sm font-semibold">Advanced</Label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Reasoning Transparency</Label>
                <TuningTooltip tip="Show 'How I got here' reasoning chains in AI responses so you can see the logic behind each answer.">
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TuningTooltip>
              </div>
              <Switch checked={reasoningTransparency} onCheckedChange={setReasoningTransparency} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Cross-Model Verification</Label>
                <TuningTooltip tip="Run a second AI perspective to verify critical financial advice. Adds a brief delay but increases accuracy.">
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TuningTooltip>
              </div>
              <Switch checked={crossModelVerify} onCheckedChange={setCrossModelVerify} />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Auto Follow-Up</Label>
                <TuningTooltip tip="AI will proactively suggest follow-up questions and deeper explorations after each response.">
                  <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                </TuningTooltip>
              </div>
              <div className="flex items-center gap-2">
                {autoFollowUp && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-muted-foreground">Max:</span>
                    <Select value={String(autoFollowUpCount)} onValueChange={(v) => setAutoFollowUpCount(Number(v))}>
                      <SelectTrigger className="bg-secondary border-border h-6 w-14 text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <Switch checked={autoFollowUp} onCheckedChange={setAutoFollowUp} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <Button
        size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5"
        onClick={handleSave} disabled={mutation.isPending}
      >
        {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save All Preferences
      </Button>
    </div>
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

// ─── ORGANIZATION EDITOR (Layer 2) ────────────────────────────────
function OrganizationEditor() {
  const orgsQuery = trpc.organizations.list.useQuery();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);

  const settingsQuery = trpc.aiLayers.getOrgAISettings.useQuery(
    { organizationId: selectedOrgId! },
    { enabled: !!selectedOrgId }
  );
  const mutation = trpc.aiLayers.updateOrgAISettings.useMutation({
    onSuccess: () => toast.success("Organization AI settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [promptOverlay, setPromptOverlay] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [complianceLanguage, setComplianceLanguage] = useState("");
  const [customDisclaimers, setCustomDisclaimers] = useState("");
  const [approvedCategories, setApprovedCategories] = useState<string[]>([]);
  const [prohibitedTopics, setProhibitedTopics] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [newProhibited, setNewProhibited] = useState("");
  const [toneStyle, setToneStyle] = useState("professional");
  const [responseFormat, setResponseFormat] = useState("mixed");
  const [responseLength, setResponseLength] = useState("standard");
  const [temperature, setTemperature] = useState(0.7);

  useEffect(() => {
    if (settingsQuery.data) {
      const s = settingsQuery.data;
      setPromptOverlay(s.promptOverlay || "");
      setBrandVoice(s.brandVoice || "");
      setComplianceLanguage(s.complianceLanguage || "");
      setCustomDisclaimers(s.customDisclaimers || "");
      setApprovedCategories(Array.isArray(s.approvedProductCategories) ? s.approvedProductCategories as string[] : []);
      setProhibitedTopics(Array.isArray(s.prohibitedTopics) ? s.prohibitedTopics as string[] : []);
      setToneStyle(s.toneStyle || "professional");
      setResponseFormat(s.responseFormat || "mixed");
      setResponseLength(s.responseLength || "standard");
      setTemperature(s.temperature ?? 0.7);
    } else if (!settingsQuery.isLoading && selectedOrgId) {
      setPromptOverlay(""); setBrandVoice(""); setComplianceLanguage("");
      setCustomDisclaimers(""); setApprovedCategories([]); setProhibitedTopics([]);
      setToneStyle("professional"); setResponseFormat("mixed"); setResponseLength("standard");
      setTemperature(0.7);
    }
  }, [settingsQuery.data, selectedOrgId]);

  if (orgsQuery.isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>;

  const orgs = orgsQuery.data || [];
  if (orgs.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        <Building2 className="w-7 h-7 mx-auto mb-2 opacity-50" />
        <p className="text-sm">You are not a member of any organization yet.</p>
        <p className="text-xs mt-1">Join or create an organization to configure Layer 2 settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <p className="text-xs text-blue-400 flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5" />
          Organization-level settings define brand voice, compliance language, and approved topics for all members.
        </p>
      </div>

      {/* Org selector */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Select Organization</Label>
        <Select value={selectedOrgId?.toString() || ""} onValueChange={(v) => setSelectedOrgId(parseInt(v))}>
          <SelectTrigger className="bg-secondary border-border h-8 text-xs"><SelectValue placeholder="Choose an organization..." /></SelectTrigger>
          <SelectContent>
            {orgs.map((org: any) => (
              <SelectItem key={org.id} value={org.id.toString()}>{org.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedOrgId && settingsQuery.isLoading && (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-accent" /></div>
      )}

      {selectedOrgId && !settingsQuery.isLoading && (
        <div className="space-y-5">
          {/* Brand Voice */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Brand Voice</Label>
            <Textarea
              value={brandVoice}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBrandVoice(e.target.value)}
              placeholder="Describe the organization's brand voice and communication style (e.g., 'Warm, authoritative, client-first. Use plain language for complex financial concepts.')"
              className="bg-secondary border-border min-h-[80px] text-sm"
            />
          </div>

          {/* Compliance Language */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Compliance Language</Label>
            <Textarea
              value={complianceLanguage}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComplianceLanguage(e.target.value)}
              placeholder="Required compliance language and regulatory disclaimers (e.g., FINRA 2210 requirements, SEC guidelines)"
              className="bg-secondary border-border min-h-[60px] text-sm"
            />
          </div>

          {/* Custom Disclaimers */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Custom Disclaimers</Label>
            <Textarea
              value={customDisclaimers}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCustomDisclaimers(e.target.value)}
              placeholder="Organization-specific disclaimers appended to financial advice responses"
              className="bg-secondary border-border min-h-[60px] text-sm"
            />
          </div>

          {/* Approved Product Categories */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Approved Product Categories</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {approvedCategories.map((cat, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1">
                  {cat}
                  <button onClick={() => setApprovedCategories(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCategory}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCategory(e.target.value)}
                placeholder="Add category (e.g., IUL, Term Life)"
                className="bg-secondary border-border h-7 text-xs flex-1"
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && newCategory.trim()) {
                    setApprovedCategories(prev => [...prev, newCategory.trim()]);
                    setNewCategory("");
                  }
                }}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                if (newCategory.trim()) { setApprovedCategories(prev => [...prev, newCategory.trim()]); setNewCategory(""); }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Prohibited Topics */}
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Prohibited Topics</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {prohibitedTopics.map((topic, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1 border-destructive/30 text-destructive">
                  {topic}
                  <button onClick={() => setProhibitedTopics(prev => prev.filter((_, j) => j !== i))} className="hover:text-destructive">
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newProhibited}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewProhibited(e.target.value)}
                placeholder="Add prohibited topic (e.g., cryptocurrency, specific competitor names)"
                className="bg-secondary border-border h-7 text-xs flex-1"
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" && newProhibited.trim()) {
                    setProhibitedTopics(prev => [...prev, newProhibited.trim()]);
                    setNewProhibited("");
                  }
                }}
              />
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => {
                if (newProhibited.trim()) { setProhibitedTopics(prev => [...prev, newProhibited.trim()]); setNewProhibited(""); }
              }}><Plus className="w-3 h-3" /></Button>
            </div>
          </div>

          {/* Shared layer fields (tone, format, length, temperature) + prompt overlay */}
          <LayerFields
            promptOverlay={promptOverlay} setPromptOverlay={setPromptOverlay}
            toneStyle={toneStyle} setToneStyle={setToneStyle}
            responseFormat={responseFormat} setResponseFormat={setResponseFormat}
            responseLength={responseLength} setResponseLength={setResponseLength}
            temperature={temperature} setTemperature={setTemperature}
            onSave={() => mutation.mutate({
              organizationId: selectedOrgId,
              brandVoice,
              complianceLanguage,
              customDisclaimers,
              approvedProductCategories: approvedCategories,
              prohibitedTopics,
              promptOverlay,
              toneStyle,
              responseFormat,
              responseLength,
              temperature,
            })}
            saving={mutation.isPending}
            layerLabel="Organization"
          />
        </div>
      )}
    </div>
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
      {activeTab === "organization" && <OrganizationEditor />}
      {activeTab === "platform" && <PlatformEditor />}
      {activeTab === "preview" && user && <PreviewPanel userId={user.id} />}

      {/* ── Autonomy Level ─────────────────────────────────────────── */}
      <Card className="mt-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-blue-500" />
            <span className="font-medium text-sm">AI Autonomy Level</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { level: 1, name: "Supervised", desc: "AI suggests, human approves all actions" },
              { level: 2, name: "Assisted", desc: "AI executes routine tasks, human reviews complex" },
              { level: 3, name: "Autonomous", desc: "AI handles most tasks, escalates edge cases" },
              { level: 4, name: "Full Autonomy", desc: "AI operates independently within guardrails" },
            ].map(l => (
              <div key={l.level} className="p-2 rounded border text-xs">
                <div className="font-medium">L{l.level}: {l.name}</div>
                <div className="text-muted-foreground mt-1">{l.desc}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Current level is determined by your trust score and interaction history.</p>
        </CardContent>
      </Card>

      {/* ── Memory Management ──────────────────────────────────────── */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-purple-500" />
            <span className="font-medium text-sm">AI Memory</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {["fact", "preference", "goal", "relationship", "financial", "temporal"].map(cat => (
              <div key={cat} className="flex items-center justify-between p-2 rounded border text-xs">
                <span className="capitalize">{cat}</span>
                <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1">Clear</Button>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">Memory helps the AI personalize responses. Clearing a category removes stored knowledge in that area.</p>
        </CardContent>
      </Card>

      {/* ── Autonomous Processing ──────────────────────────────────── */}
      <Card className="mt-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-sm">Autonomous Processing</span>
            </div>
            <Switch defaultChecked={true} />
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <p>When enabled, the AI automatically:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Analyzes client gaps nightly (protection, retirement, estate, tax, education)</li>
              <li>Generates pre-meeting briefs from accumulated profile data</li>
              <li>Runs propensity scoring on new leads</li>
              <li>Tests AI response templates across models monthly</li>
              <li>Detects improvement signals every 6 hours</li>
            </ul>
            <div className="flex items-center gap-3 mt-3 p-2 rounded bg-secondary/30">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Budget</div>
                <div className="font-medium text-foreground">$0.50/client/night</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Schedule</div>
                <div className="font-medium text-foreground">Nightly 2am + 6h signals</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">Status</div>
                <div className="font-medium text-green-400">Active</div>
              </div>
            </div>
            <p className="text-[10px] mt-2">All autonomous outputs are archived in communication_archive for FINRA 17a-4 compliance (3yr retention). Budget caps prevent runaway costs.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
