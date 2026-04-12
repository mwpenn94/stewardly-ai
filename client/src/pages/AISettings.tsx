import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Check, ChevronRight, Eye, Layers, Loader2,
  Lock, Save, Settings2, Sparkles, Shield, Users, User, Building2
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
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

// ─── LAYER TAB CONFIG ────────────────────────────────────────────────
const LAYER_TABS: { id: LayerTab; label: string; layer: number; icon: React.ReactNode; desc: string }[] = [
  { id: "user", label: "My Preferences", layer: 5, icon: <User className="w-4 h-4" />, desc: "Your personal AI settings" },
  { id: "professional", label: "Professional", layer: 4, icon: <Settings2 className="w-4 h-4" />, desc: "Advisor-level tuning" },
  { id: "manager", label: "Manager", layer: 3, icon: <Users className="w-4 h-4" />, desc: "Team-level overrides" },
  { id: "organization", label: "Organization", layer: 2, icon: <Building2 className="w-4 h-4" />, desc: "Org-wide AI policy" },
  { id: "platform", label: "Platform", layer: 1, icon: <Shield className="w-4 h-4" />, desc: "Global base settings" },
  { id: "preview", label: "Preview", layer: 0, icon: <Eye className="w-4 h-4" />, desc: "See assembled prompt" },
];

// ─── ENSEMBLE WEIGHT EDITOR ──────────────────────────────────────────
function EnsembleWeightEditor({
  weights,
  onChange,
}: {
  weights: Record<string, number>;
  onChange: (w: Record<string, number>) => void;
}) {
  const [newModel, setNewModel] = useState("");

  const addModel = () => {
    if (newModel && !weights[newModel]) {
      onChange({ ...weights, [newModel]: 0.5 });
      setNewModel("");
    }
  };

  const removeModel = (key: string) => {
    const next = { ...weights };
    delete next[key];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Model Ensemble Weights</Label>
      {Object.entries(weights).map(([model, weight]) => (
        <div key={model} className="flex items-center gap-3">
          <span className="text-sm font-medium w-28 truncate">{model}</span>
          <Slider
            value={[weight]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={([v]) => onChange({ ...weights, [model]: v })}
            className="flex-1"
          />
          <span className="text-xs text-muted-foreground w-10 text-right">{(weight * 100).toFixed(0)}%</span>
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive" onClick={() => removeModel(model)}>
            &times;
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          placeholder="Add model name..."
          value={newModel}
          onChange={(e) => setNewModel(e.target.value)}
          className="text-sm h-8"
          onKeyDown={(e) => e.key === "Enter" && addModel()}
        />
        <Button variant="outline" size="sm" className="h-8" onClick={addModel}>Add</Button>
      </div>
    </div>
  );
}

// ─── TAG INPUT ───────────────────────────────────────────────────────
function TagInput({
  label,
  tags,
  onChange,
  placeholder,
}: {
  label: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
      setInput("");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{label}</Label>
      <div className="flex flex-wrap gap-1.5 min-h-[32px]">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="text-xs gap-1 pr-1">
            {tag}
            <button className="ml-1 hover:text-destructive" onClick={() => onChange(tags.filter((_, j) => j !== i))}>&times;</button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder || "Add item..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="text-sm h-8"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
        />
        <Button variant="outline" size="sm" className="h-8" onClick={addTag}>Add</Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 5: USER PREFERENCES EDITOR
// ═══════════════════════════════════════════════════════════════════════
function UserPreferencesEditor() {
  const { data: prefs, isLoading } = trpc.aiLayers.getUserPreferences.useQuery(undefined, { staleTime: 30_000 });
  const updateMut = trpc.aiLayers.updateUserPreferences.useMutation({
    onSuccess: () => toast.success("Preferences saved"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    communicationStyle: "detailed" as "simple" | "detailed" | "expert",
    responseLength: "standard" as "concise" | "standard" | "comprehensive",
    responseFormat: "mixed",
    temperature: 0.7,
    maxTokens: 4096,
    customPromptAdditions: "",
    ensembleWeights: { default: 1.0 } as Record<string, number>,
    focusModeDefaults: "general,financial",
  });

  useEffect(() => {
    if (prefs) {
      setForm({
        communicationStyle: (prefs.communicationStyle as any) || "detailed",
        responseLength: (prefs.responseLength as any) || "standard",
        responseFormat: prefs.responseFormat || "mixed",
        temperature: prefs.temperature ?? 0.7,
        maxTokens: prefs.maxTokens ?? 4096,
        customPromptAdditions: prefs.customPromptAdditions || "",
        ensembleWeights: (prefs.ensembleWeights as Record<string, number>) || { default: 1.0 },
        focusModeDefaults: prefs.focusModeDefaults || "general,financial",
      });
    }
  }, [prefs]);

  const save = () => {
    updateMut.mutate({
      communicationStyle: form.communicationStyle,
      responseLength: form.responseLength,
      responseFormat: form.responseFormat,
      temperature: form.temperature,
      maxTokens: form.maxTokens,
      customPromptAdditions: form.customPromptAdditions,
      ensembleWeights: form.ensembleWeights,
      focusModeDefaults: form.focusModeDefaults,
    });
  };

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading preferences...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Communication Style</Label>
          <Select value={form.communicationStyle} onValueChange={(v) => setForm(f => ({ ...f, communicationStyle: v as any }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple &mdash; Plain language, no jargon</SelectItem>
              <SelectItem value="detailed">Detailed &mdash; Balanced explanation</SelectItem>
              <SelectItem value="expert">Expert &mdash; Technical depth</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Response Length</Label>
          <Select value={form.responseLength} onValueChange={(v) => setForm(f => ({ ...f, responseLength: v as any }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Response Format</Label>
          <Select value={form.responseFormat} onValueChange={(v) => setForm(f => ({ ...f, responseFormat: v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Temperature</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.temperature]} min={0} max={2} step={0.05} onValueChange={([v]) => setForm(f => ({ ...f, temperature: v }))} className="flex-1" />
            <span className="text-sm font-mono w-10 text-right">{form.temperature.toFixed(2)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Lower = more focused, higher = more creative</p>
        </div>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Tokens</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.maxTokens]} min={256} max={16384} step={256} onValueChange={([v]) => setForm(f => ({ ...f, maxTokens: v }))} className="flex-1" />
            <span className="text-sm font-mono w-16 text-right">{form.maxTokens}</span>
          </div>
        </div>
      </div>

      <Separator />

      <EnsembleWeightEditor weights={form.ensembleWeights} onChange={(w) => setForm(f => ({ ...f, ensembleWeights: w }))} />

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Custom Prompt Additions</Label>
        <Textarea
          value={form.customPromptAdditions}
          onChange={(e) => setForm(f => ({ ...f, customPromptAdditions: e.target.value }))}
          placeholder="Add personal instructions that will be appended to every AI response... (e.g., 'Always explain concepts using analogies' or 'Focus on Arizona-specific regulations')"
          className="min-h-[100px] text-sm"
        />
        <p className="text-xs text-muted-foreground">These instructions are added to Layer 5 (your personal layer) of the AI prompt.</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateMut.isPending} className="gap-2">
          {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 1: PLATFORM SETTINGS EDITOR
// ═══════════════════════════════════════════════════════════════════════
function PlatformEditor() {
  const { data: settings, isLoading } = trpc.aiLayers.getPlatformSettings.useQuery(undefined, {
    retry: false,
  });
  const updateMut = trpc.aiLayers.updatePlatformSettings.useMutation({
    onSuccess: () => toast.success("Platform settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    baseSystemPrompt: "",
    defaultTone: "professional",
    defaultResponseFormat: "mixed",
    defaultResponseLength: "standard",
    temperatureDefault: 0.7,
    maxTokensDefault: 4096,
    globalGuardrails: [] as string[],
    prohibitedTopics: [] as string[],
    enabledFocusModes: ["general", "financial", "study"] as string[],
    platformDisclaimer: "",
    ensembleWeights: { default: 1.0 } as Record<string, number>,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        baseSystemPrompt: settings.baseSystemPrompt || "",
        defaultTone: settings.defaultTone || "professional",
        defaultResponseFormat: settings.defaultResponseFormat || "mixed",
        defaultResponseLength: settings.defaultResponseLength || "standard",
        temperatureDefault: settings.temperatureDefault ?? 0.7,
        maxTokensDefault: settings.maxTokensDefault ?? 4096,
        globalGuardrails: (settings.globalGuardrails as string[]) || [],
        prohibitedTopics: (settings.prohibitedTopics as string[]) || [],
        enabledFocusModes: (settings.enabledFocusModes as string[]) || ["general", "financial", "study"],
        platformDisclaimer: settings.platformDisclaimer || "",
        ensembleWeights: (settings.ensembleWeights as Record<string, number>) || { default: 1.0 },
      });
    }
  }, [settings]);

  const save = () => updateMut.mutate(form);

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading platform settings...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-start gap-2">
        <Lock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <p className="text-xs text-amber-200">Platform settings affect all users across all organizations. Changes here cascade to every layer below.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Base System Prompt</Label>
        <Textarea
          value={form.baseSystemPrompt}
          onChange={(e) => setForm(f => ({ ...f, baseSystemPrompt: e.target.value }))}
          placeholder="The foundational system prompt for the entire platform..."
          className="min-h-[120px] text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Default Tone</Label>
          <Select value={form.defaultTone} onValueChange={(v) => setForm(f => ({ ...f, defaultTone: v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Default Format</Label>
          <Select value={form.defaultResponseFormat} onValueChange={(v) => setForm(f => ({ ...f, defaultResponseFormat: v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Default Length</Label>
          <Select value={form.defaultResponseLength} onValueChange={(v) => setForm(f => ({ ...f, defaultResponseLength: v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Temperature</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.temperatureDefault]} min={0} max={2} step={0.05} onValueChange={([v]) => setForm(f => ({ ...f, temperatureDefault: v }))} className="flex-1" />
            <span className="text-sm font-mono w-10 text-right">{form.temperatureDefault.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Tokens</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.maxTokensDefault]} min={256} max={32768} step={256} onValueChange={([v]) => setForm(f => ({ ...f, maxTokensDefault: v }))} className="flex-1" />
            <span className="text-sm font-mono w-16 text-right">{form.maxTokensDefault}</span>
          </div>
        </div>
      </div>

      <Separator />

      <EnsembleWeightEditor weights={form.ensembleWeights} onChange={(w) => setForm(f => ({ ...f, ensembleWeights: w }))} />

      <Separator />

      <TagInput label="Global Guardrails" tags={form.globalGuardrails} onChange={(t) => setForm(f => ({ ...f, globalGuardrails: t }))} placeholder="Add guardrail rule..." />
      <TagInput label="Prohibited Topics" tags={form.prohibitedTopics} onChange={(t) => setForm(f => ({ ...f, prohibitedTopics: t }))} placeholder="Add prohibited topic..." />

      <Separator />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Platform Disclaimer</Label>
        <Textarea
          value={form.platformDisclaimer}
          onChange={(e) => setForm(f => ({ ...f, platformDisclaimer: e.target.value }))}
          placeholder="Disclaimer text appended to AI responses..."
          className="min-h-[80px] text-sm"
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateMut.isPending} className="gap-2">
          {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Platform Settings
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 3: MANAGER SETTINGS EDITOR
// ═══════════════════════════════════════════════════════════════════════
function ManagerEditor({ userId }: { userId: number }) {
  const { data: settings, isLoading } = trpc.aiLayers.getManagerSettings.useQuery(
    { managerId: userId },
    { retry: false }
  );
  const updateMut = trpc.aiLayers.updateManagerSettings.useMutation({
    onSuccess: () => toast.success("Manager settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    teamFocusAreas: [] as string[],
    clientSegmentTargeting: "",
    promptOverlay: "",
    toneStyle: "",
    responseFormat: "",
    responseLength: "",
    temperature: 0.7,
    maxTokens: 4096,
    ensembleWeights: {} as Record<string, number>,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        teamFocusAreas: (settings.teamFocusAreas as string[]) || [],
        clientSegmentTargeting: settings.clientSegmentTargeting || "",
        promptOverlay: settings.promptOverlay || "",
        toneStyle: settings.toneStyle || "",
        responseFormat: settings.responseFormat || "",
        responseLength: settings.responseLength || "",
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens ?? 4096,
        ensembleWeights: (settings.ensembleWeights as Record<string, number>) || {},
      });
    }
  }, [settings]);

  const save = () => updateMut.mutate({
    managerId: userId,
    teamFocusAreas: form.teamFocusAreas,
    clientSegmentTargeting: form.clientSegmentTargeting || undefined,
    promptOverlay: form.promptOverlay || undefined,
    toneStyle: form.toneStyle || undefined,
    responseFormat: form.responseFormat || undefined,
    responseLength: form.responseLength || undefined,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    ensembleWeights: Object.keys(form.ensembleWeights).length > 0 ? form.ensembleWeights : undefined,
  });

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 flex items-start gap-2">
        <Users className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <p className="text-xs text-blue-200">Manager settings apply to all professionals and users under your team. These override organization defaults.</p>
      </div>

      <TagInput label="Team Focus Areas" tags={form.teamFocusAreas} onChange={(t) => setForm(f => ({ ...f, teamFocusAreas: t }))} placeholder="e.g., Retirement planning, Estate planning..." />

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Client Segment Targeting</Label>
        <Textarea
          value={form.clientSegmentTargeting}
          onChange={(e) => setForm(f => ({ ...f, clientSegmentTargeting: e.target.value }))}
          placeholder="Describe the client segments your team focuses on..."
          className="min-h-[80px] text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt Overlay</Label>
        <Textarea
          value={form.promptOverlay}
          onChange={(e) => setForm(f => ({ ...f, promptOverlay: e.target.value }))}
          placeholder="Additional instructions appended to the AI prompt for your team..."
          className="min-h-[100px] text-sm font-mono"
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tone Override</Label>
          <Select value={form.toneStyle || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, toneStyle: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Format Override</Label>
          <Select value={form.responseFormat || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, responseFormat: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Length Override</Label>
          <Select value={form.responseLength || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, responseLength: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Temperature</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.temperature]} min={0} max={2} step={0.05} onValueChange={([v]) => setForm(f => ({ ...f, temperature: v }))} className="flex-1" />
            <span className="text-sm font-mono w-10 text-right">{form.temperature.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Tokens</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.maxTokens]} min={256} max={16384} step={256} onValueChange={([v]) => setForm(f => ({ ...f, maxTokens: v }))} className="flex-1" />
            <span className="text-sm font-mono w-16 text-right">{form.maxTokens}</span>
          </div>
        </div>
      </div>

      <Separator />

      <EnsembleWeightEditor weights={form.ensembleWeights} onChange={(w) => setForm(f => ({ ...f, ensembleWeights: w }))} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateMut.isPending} className="gap-2">
          {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Manager Settings
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// LAYER 4: PROFESSIONAL SETTINGS EDITOR
// ═══════════════════════════════════════════════════════════════════════
function ProfessionalEditor({ userId }: { userId: number }) {
  const { data: settings, isLoading } = trpc.aiLayers.getProfessionalSettings.useQuery(
    { professionalId: userId },
    { retry: false }
  );
  const updateMut = trpc.aiLayers.updateProfessionalSettings.useMutation({
    onSuccess: () => toast.success("Professional settings saved"),
    onError: (e) => toast.error(e.message),
  });

  const [form, setForm] = useState({
    specialization: "",
    methodology: "",
    communicationStyle: "",
    promptOverlay: "",
    toneStyle: "",
    responseFormat: "",
    responseLength: "",
    temperature: 0.7,
    maxTokens: 4096,
    ensembleWeights: {} as Record<string, number>,
  });

  useEffect(() => {
    if (settings) {
      setForm({
        specialization: settings.specialization || "",
        methodology: settings.methodology || "",
        communicationStyle: settings.communicationStyle || "",
        promptOverlay: settings.promptOverlay || "",
        toneStyle: settings.toneStyle || "",
        responseFormat: settings.responseFormat || "",
        responseLength: settings.responseLength || "",
        temperature: settings.temperature ?? 0.7,
        maxTokens: settings.maxTokens ?? 4096,
        ensembleWeights: (settings.ensembleWeights as Record<string, number>) || {},
      });
    }
  }, [settings]);

  const save = () => updateMut.mutate({
    professionalId: userId,
    specialization: form.specialization || undefined,
    methodology: form.methodology || undefined,
    communicationStyle: form.communicationStyle || undefined,
    promptOverlay: form.promptOverlay || undefined,
    toneStyle: form.toneStyle || undefined,
    responseFormat: form.responseFormat || undefined,
    responseLength: form.responseLength || undefined,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    ensembleWeights: Object.keys(form.ensembleWeights).length > 0 ? form.ensembleWeights : undefined,
  });

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-start gap-2">
        <Settings2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <p className="text-xs text-emerald-200">Professional settings customize the AI for your practice. These override manager and org defaults for your clients.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Specialization</Label>
          <Input value={form.specialization} onChange={(e) => setForm(f => ({ ...f, specialization: e.target.value }))} placeholder="e.g., Retirement planning, Estate planning" className="h-9 text-sm" />
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Communication Style</Label>
          <Input value={form.communicationStyle} onChange={(e) => setForm(f => ({ ...f, communicationStyle: e.target.value }))} placeholder="e.g., Warm and educational" className="h-9 text-sm" />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Methodology</Label>
        <Textarea
          value={form.methodology}
          onChange={(e) => setForm(f => ({ ...f, methodology: e.target.value }))}
          placeholder="Describe your advisory methodology and approach..."
          className="min-h-[80px] text-sm"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt Overlay</Label>
        <Textarea
          value={form.promptOverlay}
          onChange={(e) => setForm(f => ({ ...f, promptOverlay: e.target.value }))}
          placeholder="Additional instructions for the AI when serving your clients..."
          className="min-h-[100px] text-sm font-mono"
        />
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tone Override</Label>
          <Select value={form.toneStyle || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, toneStyle: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {TONE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Format Override</Label>
          <Select value={form.responseFormat || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, responseFormat: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {FORMAT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Length Override</Label>
          <Select value={form.responseLength || "inherit"} onValueChange={(v) => setForm(f => ({ ...f, responseLength: v === "inherit" ? "" : v }))}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="inherit">Inherit from above</SelectItem>
              {LENGTH_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Temperature</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.temperature]} min={0} max={2} step={0.05} onValueChange={([v]) => setForm(f => ({ ...f, temperature: v }))} className="flex-1" />
            <span className="text-sm font-mono w-10 text-right">{form.temperature.toFixed(2)}</span>
          </div>
        </div>
        <div className="space-y-3">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Max Tokens</Label>
          <div className="flex items-center gap-3">
            <Slider value={[form.maxTokens]} min={256} max={16384} step={256} onValueChange={([v]) => setForm(f => ({ ...f, maxTokens: v }))} className="flex-1" />
            <span className="text-sm font-mono w-16 text-right">{form.maxTokens}</span>
          </div>
        </div>
      </div>

      <Separator />

      <EnsembleWeightEditor weights={form.ensembleWeights} onChange={(w) => setForm(f => ({ ...f, ensembleWeights: w }))} />

      <div className="flex justify-end">
        <Button onClick={save} disabled={updateMut.isPending} className="gap-2">
          {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Professional Settings
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PREVIEW PANEL
// ═══════════════════════════════════════════════════════════════════════
function PreviewPanel({ userId }: { userId: number }) {
  const { data, isLoading, refetch } = trpc.aiLayers.previewConfig.useQuery(
    { targetUserId: userId },
    { retry: false }
  );

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-8"><Loader2 className="w-4 h-4 animate-spin" /> Resolving layers...</div>;

  if (!data) return <div className="text-muted-foreground p-8">Unable to load preview. You may not have permission.</div>;

  const { config, assembledPrompt } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Assembled AI Configuration</h3>
          <p className="text-xs text-muted-foreground">This shows the final merged config from all 5 layers</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Layer sources */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Active Layers</Label>
        <div className="flex flex-wrap gap-2">
          {config.layerSources.map((src) => (
            <Badge
              key={src.layer}
              variant={src.hasConfig ? "default" : "outline"}
              className={`text-xs ${src.hasConfig ? "bg-primary/20 text-primary border-primary/30" : "opacity-50"}`}
            >
              L{src.layer}: {src.name} {src.hasConfig ? <Check className="w-3 h-3 ml-1" /> : <span className="ml-1 opacity-50">(empty)</span>}
            </Badge>
          ))}
        </div>
      </div>

      {/* Resolved values */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Tone</p>
            <p className="text-sm font-medium">{config.toneStyle}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Format</p>
            <p className="text-sm font-medium">{config.responseFormat}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Length</p>
            <p className="text-sm font-medium">{config.responseLength}</p>
          </CardContent>
        </Card>
        <Card className="bg-card/50">
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Temperature</p>
            <p className="text-sm font-medium">{config.temperature.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ensemble weights */}
      {Object.keys(config.ensembleWeights).length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Ensemble Weights</Label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(config.ensembleWeights).map(([model, weight]) => (
              <Badge key={model} variant="secondary" className="text-xs">
                {model}: {((weight as number) * 100).toFixed(0)}%
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Guardrails */}
      {config.guardrails.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Active Guardrails ({config.guardrails.length})</Label>
          <div className="bg-card/30 rounded-lg p-3 space-y-1">
            {config.guardrails.map((g, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Shield className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" /> {g}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Prompt overlays */}
      {config.promptOverlays.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Prompt Overlays ({config.promptOverlays.length} layers)</Label>
          <div className="space-y-2">
            {config.promptOverlays.map((overlay, i) => (
              <div key={i} className="bg-card/30 rounded-lg p-3 border border-border/50">
                <Badge variant="outline" className="text-[10px] mb-2">{overlay.layer}</Badge>
                <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{overlay.content.substring(0, 300)}{overlay.content.length > 300 ? "..." : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full assembled prompt */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Full Assembled Overlay Prompt</Label>
        <div className="bg-card/20 rounded-lg p-4 border border-border/30 max-h-[400px] overflow-y-auto">
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono">{assembledPrompt || "(No overlay prompt generated)"}</pre>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function AISettings() {
  const { user, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<LayerTab>("user");

  // Determine which tabs this user can see
  const userRole = user?.role || "user";
  const visibleTabs = useMemo(() => {
    const tabs: LayerTab[] = ["user"]; // Everyone sees their own preferences
    // For now, show professional/manager tabs to all users (they'll get FORBIDDEN if they don't have the role)
    // In production, this would check org roles
    if (["advisor", "manager", "admin"].includes(userRole)) {
      tabs.push("professional");
    }
    if (["manager", "admin"].includes(userRole)) {
      tabs.push("manager");
    }
    // Org admin and global admin see organization tab
    if (["admin"].includes(userRole)) {
      tabs.push("organization");
      tabs.push("platform");
    }
    tabs.push("preview"); // Everyone can preview their own config
    return tabs;
  }, [userRole]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Settings2 className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading AI Settings...</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back to Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-10 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" /> Chat
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-semibold">AI Personalization</h1>
          </div>
          <Badge variant="outline" className="text-[10px] ml-auto">5-Layer Cascade</Badge>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Tab navigation */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {LAYER_TABS.filter(t => visibleTabs.includes(t.id)).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? "bg-primary/15 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.layer > 0 && (
                <span className={`text-[10px] font-mono ${activeTab === tab.id ? "text-primary/70" : "text-muted-foreground/50"}`}>
                  L{tab.layer}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Layer description */}
        {activeTab !== "preview" && (
          <div className="mb-6">
            <Card className="bg-card/30 border-border/30">
              <CardContent className="p-4 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {LAYER_TABS.find(t => t.id === activeTab)?.icon}
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{LAYER_TABS.find(t => t.id === activeTab)?.label}</h2>
                  <p className="text-xs text-muted-foreground">{LAYER_TABS.find(t => t.id === activeTab)?.desc}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    Layer {LAYER_TABS.find(t => t.id === activeTab)?.layer} in the cascade. Lower layers override higher layers for style/format settings. Prompt overlays are appended (not replaced).
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab content */}
        <Card className="border-border/30">
          <CardContent className="p-6">
            {activeTab === "user" && <UserPreferencesEditor />}
            {activeTab === "professional" && <ProfessionalEditor userId={user.id} />}
            {activeTab === "manager" && <ManagerEditor userId={user.id} />}
            {activeTab === "organization" && (
              <div className="text-center text-muted-foreground py-12">
                <Building2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Organization AI settings are managed from the Organization Settings page.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => window.location.assign("/organizations")}>
                  Go to Organization Settings
                </Button>
              </div>
            )}
            {activeTab === "platform" && <PlatformEditor />}
            {activeTab === "preview" && <PreviewPanel userId={user.id} />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
