/**
 * UnifiedAI.tsx — AI Studio: Interactive AI command center
 *
 * A fully functional hub that provides:
 * 1. Quick AI Chat — inline chat with streaming responses
 * 2. Model Configuration — preset management, model weights
 * 3. AI Tuning — quick access to personalization layers
 * 4. Usage Analytics — model usage stats and trends
 * 5. Quick Actions — launch agents, code chat, consensus queries
 *
 * Navigation to full-page experiences (Chat, Code Chat, Agents) via links.
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MessageSquare, Terminal, Bot, Sparkles, Send, Loader2, Plus,
  Settings2, BarChart3, Brain, Zap, ArrowRight, ExternalLink,
  Sliders, Save, Trash2, ChevronRight, Activity, TrendingUp,
  Users, Shield, Building2, Eye, RefreshCw, Copy, Check,
  Layers, Play, Target, Wand2, BookOpen, Scale,
} from "lucide-react";
import { authFetch } from "@/lib/sessionToken";
import ServiceDegradedFallback from "@/components/ServiceDegradedFallback";

// ─── Types ─────────────────────────────────────────────────────────
interface QuickMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ─── Quick Chat Panel ──────────────────────────────────────────────
function QuickChatPanel() {
  const [messages, setMessages] = useState<QuickMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [focus, setFocus] = useState<"general" | "financial" | "both">("both");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: QuickMessage = { role: "user", content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Add placeholder assistant message
    const assistantMsg: QuickMessage = { role: "assistant", content: "", timestamp: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      abortRef.current = new AbortController();
      const response = await authFetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.filter(m => m.role === "user" || m.role === "assistant").map(m => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: text },
          ],
          contextType: focus === "financial" ? "financial" : "chat",
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "token" && parsed.content) {
              fullContent += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === "assistant") {
                  updated[updated.length - 1] = { ...last, content: fullContent };
                }
                return updated;
              });
            } else if (parsed.type === "error") {
              throw new Error(parsed.content || "AI error");
            }
          } catch (parseErr: any) {
            if (parseErr.message === "AI error") throw parseErr;
            // Skip malformed SSE data
          }
        }
      }
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setMessages(prev => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last?.role === "assistant" && !last.content) {
          updated[updated.length - 1] = {
            ...last,
            content: "Sorry, I couldn't process that request. Please try again or use the full Chat for a better experience.",
          };
        }
        return updated;
      });
      toast.error("Failed to get AI response");
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, focus]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" />
            <CardTitle className="text-base">Quick Chat</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={focus} onValueChange={(v) => setFocus(v as any)}>
              <SelectTrigger className="h-7 text-xs w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="both">All Focus</SelectItem>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="financial">Financial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-2 overflow-hidden pb-3">
        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 text-muted-foreground">
              <Sparkles className="w-8 h-8 opacity-40" />
              <div>
                <p className="text-sm font-medium">Ask anything</p>
                <p className="text-xs mt-1 max-w-[250px]">Quick questions, analysis, or financial guidance. For deeper conversations, use the full Chat.</p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                {["What's my portfolio risk?", "Explain Roth conversion", "Market outlook"].map((q) => (
                  <button
                    type="button"
                    key={q}
                    onClick={() => { setInput(q); }}
                    className="text-[11px] px-2.5 py-1 rounded-full border border-border/60 hover:bg-accent/10 hover:border-accent/30 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-accent text-accent-foreground"
                  : "bg-muted/50 text-foreground"
              )}>
                {msg.role === "assistant" ? (
                  msg.content ? (
                    <Streamdown>{msg.content}</Streamdown>
                  ) : (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs">Thinking...</span>
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="flex gap-2 items-end shrink-0">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a quick question..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button size="sm" variant="outline" onClick={handleStop} className="shrink-0 h-10">
              <Loader2 className="w-4 h-4 animate-spin" />
            </Button>
          ) : (
            <Button size="sm" onClick={handleSend} disabled={!input.trim()} className="shrink-0 h-10">
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Model Presets Panel ───────────────────────────────────────────
function ModelPresetsPanel() {
  const perspectivesQuery = trpc.multiModel.perspectives.useQuery();
  const presetsQuery = trpc.multiModel.presets.useQuery();
  const userPresetsQuery = trpc.multiModel.listPresets.useQuery();
  const saveMut = trpc.multiModel.savePreset.useMutation({
    onSuccess: () => {
      toast.success("Preset saved");
      userPresetsQuery.refetch();
      setShowCreate(false);
    },
    onError: () => toast.error("Failed to save preset"),
  });
  const deleteMut = trpc.multiModel.deletePreset.useMutation({
    onSuccess: () => {
      toast.success("Preset deleted");
      userPresetsQuery.refetch();
    },
    onError: () => toast.error("Failed to delete preset"),
  });

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [selectedPerspectives, setSelectedPerspectives] = useState<string[]>([]);
  const [weights, setWeights] = useState<Record<string, number>>({});

  const perspectives = perspectivesQuery.data || [];
  const builtInPresets = presetsQuery.data || [];
  const userPresets = userPresetsQuery.data || [];

  const togglePerspective = (id: string) => {
    setSelectedPerspectives(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
    if (!weights[id]) {
      setWeights(prev => ({ ...prev, [id]: 1.0 }));
    }
  };

  const handleSave = () => {
    if (!newName.trim() || selectedPerspectives.length === 0) {
      toast.error("Name and at least one perspective required");
      return;
    }
    saveMut.mutate({
      name: newName,
      description: newDesc || undefined,
      perspectives: selectedPerspectives,
      weights,
    });
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" />
            <CardTitle className="text-base">Model Presets</CardTitle>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setShowCreate(!showCreate)}>
            <Plus className="w-3 h-3 mr-1" />
            New
          </Button>
        </div>
        <CardDescription className="text-xs">Configure how multiple AI models collaborate on your queries</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-3">
        {/* Create new preset */}
        {showCreate && (
          <div className="border border-accent/30 rounded-lg p-3 space-y-3 bg-accent/5">
            <Input
              placeholder="Preset name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Description (optional)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Perspectives</p>
              <div className="flex flex-wrap gap-1.5">
                {perspectives.map((p: any) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() => togglePerspective(p.id)}
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full border transition-colors",
                      selectedPerspectives.includes(p.id)
                        ? "bg-accent text-accent-foreground border-accent"
                        : "border-border hover:border-accent/50"
                    )}
                  >
                    {p.name || p.id}
                  </button>
                ))}
              </div>
            </div>
            {selectedPerspectives.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Weights</p>
                {selectedPerspectives.map((id) => (
                  <div key={id} className="flex items-center gap-2">
                    <span className="text-xs w-24 truncate">{id}</span>
                    <Slider
                      value={[weights[id] || 1.0]}
                      onValueChange={([v]) => setWeights(prev => ({ ...prev, [id]: v }))}
                      min={0}
                      max={2}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs w-8 text-right">{(weights[id] || 1.0).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saveMut.isPending}>
                {saveMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Built-in presets */}
        {builtInPresets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Shield className="w-3 h-3" /> Built-in Presets
            </p>
            {builtInPresets.map((preset: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description || `${preset.perspectives?.length || 0} perspectives`}</p>
                </div>
                <Badge variant="secondary" className="text-[10px]">Built-in</Badge>
              </div>
            ))}
          </div>
        )}

        {/* User presets */}
        {userPresets.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> Your Presets
            </p>
            {userPresets.map((preset: any) => (
              <div key={preset.id} className="flex items-center justify-between p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors group">
                <div>
                  <p className="text-sm font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground">{preset.description || `${preset.perspectives?.length || 0} perspectives`}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                  onClick={() => deleteMut.mutate({ id: preset.id })}
                  aria-label={`Delete preset ${preset.name}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {builtInPresets.length === 0 && userPresets.length === 0 && !showCreate && (
          <div className="text-center text-muted-foreground py-6">
            <Sliders className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No presets yet. Create one to configure multi-model collaboration.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Usage Analytics Panel ─────────────────────────────────────────
function UsageAnalyticsPanel() {
  const statsQuery = trpc.multiModel.usageStats.useQuery({ days: 30 });
  const ratingsQuery = trpc.multiModel.ratingSummary.useQuery({ days: 30 });

  const stats = statsQuery.data || [];
  const ratings = ratingsQuery.data || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" />
          <CardTitle className="text-base">AI Usage</CardTitle>
        </div>
        <CardDescription className="text-xs">Model usage and performance over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-3">
        {statsQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : stats.length === 0 ? (
          <div className="text-center text-muted-foreground py-6">
            <Activity className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">No usage data yet. Start chatting to see analytics.</p>
          </div>
        ) : (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground">Total Queries</p>
                <p className="text-lg font-semibold">
                  {stats.reduce((sum: number, s: any) => sum + (Number(s.totalQueries) || 0), 0)}
                </p>
              </div>
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-[11px] text-muted-foreground">Models Used</p>
                <p className="text-lg font-semibold">{stats.length}</p>
              </div>
            </div>

            {/* Per-model breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">By Model</p>
              {stats.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{s.model || "Unknown"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {Number(s.totalQueries) || 0} queries · {Number(s.avgInputTokens) || 0} avg tokens
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {Number(s.totalQueries) || 0}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Ratings */}
            {ratings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Quality Ratings</p>
                {ratings.map((r: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                    <span className="text-sm">{r.model || "Unknown"}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{Number(r.avgRating)?.toFixed(1) || "—"}</span>
                      <span className="text-[10px] text-muted-foreground">/ 5</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Quick Actions Panel ───────────────────────────────────────────
function QuickActionsPanel() {
  const [, navigate] = useLocation();

  const actions = [
    {
      icon: MessageSquare,
      label: "Full Chat",
      desc: "Deep conversations with context, voice, and multi-model",
      path: "/chat",
      color: "text-blue-400",
    },
    {
      icon: Terminal,
      label: "Code Chat",
      desc: "AI-powered code generation and editing",
      path: "/code-chat",
      color: "text-emerald-400",
    },
    {
      icon: Bot,
      label: "AI Agents",
      desc: "Autonomous task execution and workflows",
      path: "/agents",
      color: "text-purple-400",
    },
    {
      icon: Scale,
      label: "Consensus Query",
      desc: "Multi-model analysis for complex decisions",
      path: "/chat?mode=consensus",
      color: "text-amber-400",
    },
    {
      icon: Brain,
      label: "AI Tuning",
      desc: "Personalize AI behavior across 5 layers",
      path: "/settings/ai-tuning",
      color: "text-pink-400",
    },
    {
      icon: BookOpen,
      label: "Knowledge Base",
      desc: "Train your AI with documents and artifacts",
      path: "/documents",
      color: "text-cyan-400",
    },
    {
      icon: TrendingUp,
      label: "Wealth Engine",
      desc: "AI-powered financial analysis and projections",
      path: "/wealth-engine",
      color: "text-green-400",
    },
    {
      icon: Target,
      label: "Workflows",
      desc: "Automated multi-step AI workflows",
      path: "/workflows",
      color: "text-orange-400",
    },
  ];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-accent" />
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </div>
        <CardDescription className="text-xs">Jump to AI-powered features</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pb-3">
        <div className="grid grid-cols-1 gap-1.5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                type="button"
                key={action.path}
                onClick={() => navigate(action.path)}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left group"
              >
                <div className={cn("w-8 h-8 rounded-md flex items-center justify-center bg-muted/50 shrink-0", action.color)}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium group-hover:text-accent transition-colors">{action.label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{action.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-accent transition-colors shrink-0" />
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── AI Config Preview ─────────────────────────────────────────────
function AIConfigPreview() {
  const configQuery = trpc.aiLayers.previewConfig.useQuery({}, {
    retry: false,
    staleTime: 60_000,
  });

  const config = configQuery.data?.config;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-accent" />
            <CardTitle className="text-base">AI Configuration</CardTitle>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => configQuery.refetch()}>
            <RefreshCw className={cn("w-3 h-3", configQuery.isFetching && "animate-spin")} />
          </Button>
        </div>
        <CardDescription className="text-xs">Your resolved 5-layer AI settings</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2 pb-3">
        {configQuery.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : configQuery.isError ? (
          <div className="text-center text-muted-foreground py-6">
            <Settings2 className="w-6 h-6 mx-auto mb-2 opacity-40" />
            <p className="text-xs">Sign in to view your AI configuration</p>
          </div>
        ) : config ? (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-md bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Tone</p>
                <p className="text-xs font-medium capitalize">{config.toneStyle || "Professional"}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Format</p>
                <p className="text-xs font-medium capitalize">{config.responseFormat || "Mixed"}</p>
              </div>
              <div className="p-2 rounded-md bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground">Length</p>
                <p className="text-xs font-medium capitalize">{config.responseLength || "Standard"}</p>
              </div>
            </div>

            <div className="p-2 rounded-md bg-muted/30">
              <p className="text-[10px] text-muted-foreground mb-1">Temperature</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${((config.temperature || 0.7) / 2) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-medium">{config.temperature?.toFixed(1) || "0.7"}</span>
              </div>
            </div>

            {config.guardrails && config.guardrails.length > 0 && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-1">Active Guardrails</p>
                <div className="flex flex-wrap gap-1">
                  {config.guardrails.slice(0, 5).map((g: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{g}</Badge>
                  ))}
                  {config.guardrails.length > 5 && (
                    <Badge variant="secondary" className="text-[10px]">+{config.guardrails.length - 5}</Badge>
                  )}
                </div>
              </div>
            )}

            {config.promptOverlays && config.promptOverlays.length > 0 && (
              <div className="p-2 rounded-md bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-1">Active Layers</p>
                <div className="flex flex-wrap gap-1">
                  {config.promptOverlays.map((o: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px] capitalize">{o.layer}</Badge>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function UnifiedAI() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("studio");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SEOHead title="AI Studio" description="AI command center — chat, configure, and manage your AI experience" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-semibold">AI Studio</h1>
          <Badge variant="secondary" className="text-[10px]">Beta</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => navigate("/chat")}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Full Chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open full-featured Chat experience</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => navigate("/settings/ai-tuning")}
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">AI Settings</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Configure AI personalization layers</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2 shrink-0">
          <TabsList className="h-8">
            <TabsTrigger value="studio" className="text-xs h-7 gap-1">
              <Sparkles className="w-3 h-3" />
              Studio
            </TabsTrigger>
            <TabsTrigger value="presets" className="text-xs h-7 gap-1">
              <Sliders className="w-3 h-3" />
              Presets
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-xs h-7 gap-1">
              <BarChart3 className="w-3 h-3" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Studio Tab — Main view with chat + actions */}
        <TabsContent value="studio" className="flex-1 overflow-hidden mt-0 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            {/* Left: Quick Chat (takes 2 cols on large screens) */}
            <div className="lg:col-span-2 min-h-0">
              <ServiceDegradedFallback serviceId="llm" degradedMessage="AI chat may be slower or unavailable. Quick Actions and configuration still work normally.">
                <QuickChatPanel />
              </ServiceDegradedFallback>
            </div>
            {/* Right: Quick Actions + Config */}
            <div className="flex flex-col gap-4 min-h-0 overflow-y-auto">
              <QuickActionsPanel />
              <AIConfigPreview />
            </div>
          </div>
        </TabsContent>

        {/* Presets Tab */}
        <TabsContent value="presets" className="flex-1 overflow-hidden mt-0 p-4">
          <div className="h-full">
            <ModelPresetsPanel />
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="flex-1 overflow-hidden mt-0 p-4">
          <div className="h-full">
            <UsageAnalyticsPanel />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
