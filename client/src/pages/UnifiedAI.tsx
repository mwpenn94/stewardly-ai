/**
 * UnifiedAI.tsx — AI Studio: True Unified AI Surface
 *
 * Three interactive modes in ONE page:
 * 1. Chat — Full streaming chat with markdown, suggestions, conversation history
 * 2. Dev — Terminal-aesthetic code assistant (codeChat.chat ReAct loop with tool traces)
 * 3. Auto — Agent management: create, launch, stop, monitor agents
 *
 * This is the spec-compliant Phase 4 AI Studio — not a hub/dashboard,
 * but a real interactive surface where users DO their AI work.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  MessageSquare, Terminal, Bot, Sparkles, Send, Loader2, Plus,
  Settings2, Brain, Zap, ExternalLink, Trash2,
  Play, Square, Shield, ChevronDown, ChevronRight, Activity,
  BarChart3, Clock, CheckCircle2, AlertTriangle,
  Target, RefreshCw, X, History,
} from "lucide-react";
import { authFetch } from "@/lib/sessionToken";
import ServiceDegradedFallback from "@/components/ServiceDegradedFallback";

// ─── Types ─────────────────────────────────────────────────────────
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface DevMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  traces?: Array<{
    step: number;
    thought?: string;
    toolName?: string;
    observation?: string;
    durationMs?: number;
  }>;
  model?: string;
  iterations?: number;
  toolCallCount?: number;
}

// ─── Suggestion chips ──────────────────────────────────────────────
const CHAT_SUGGESTIONS = [
  "Explain my retirement readiness",
  "What's the best strategy for tax-loss harvesting?",
  "Compare IUL vs whole life insurance",
  "Help me create a financial plan",
];

const DEV_SUGGESTIONS = [
  "List all TypeScript files in the project",
  "Find all TODO comments in the codebase",
  "Show me the database schema",
  "What routes are defined in App.tsx?",
];

const AGENT_TYPES = [
  { value: "compliance_monitor", label: "Compliance Monitor", desc: "Flags compliance issues", icon: Shield },
  { value: "lead_processor", label: "Lead Processor", desc: "Enriches and scores leads", icon: Target },
  { value: "report_generator", label: "Report Generator", desc: "Generates periodic reports", icon: BarChart3 },
  { value: "plan_analyzer", label: "Plan Analyzer", desc: "Analyzes business plans", icon: Activity },
  { value: "custom", label: "Custom Agent", desc: "Define your own agent", icon: Sparkles },
];

const TASK_TEMPLATES = [
  { name: "Monday Client Review", type: "report_generator" as const, instructions: "Review all active clients, check for upcoming RMD events, birthday milestones, policy renewals. Generate a prioritized action list." },
  { name: "Compliance Audit Sweep", type: "compliance_monitor" as const, instructions: "Scan recent client communications and trade confirmations for compliance issues. Flag suitability concerns or documentation gaps." },
  { name: "Lead Pipeline Analysis", type: "lead_processor" as const, instructions: "Review all leads, enrich with public data, score based on AUM potential and conversion likelihood, recommend next-best-action for top prospects." },
  { name: "Tax Planning Opportunities", type: "plan_analyzer" as const, instructions: "Analyze each client's tax situation for Roth conversion opportunities, tax-loss harvesting candidates, and year-end planning actions." },
];

// ─── Unique ID helper ──────────────────────────────────────────────
let _idCounter = 0;
function uid() { return `msg-${Date.now()}-${++_idCounter}`; }

// ════════════════════════════════════════════════════════════════════
//  MODE 1: CHAT PANEL
// ════════════════════════════════════════════════════════════════════
const CONTEXT_TYPES = [
  { value: "chat", label: "General" },
  { value: "financial", label: "Financial" },
  { value: "legal", label: "Legal" },
  { value: "learning", label: "Learning" },
  { value: "code", label: "Code" },
  { value: "document", label: "Document" },
] as const;

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [contextType, setContextType] = useState<string>("chat");
  const [showHistory, setShowHistory] = useState(false);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const convList = trpc.conversations.list.useQuery(undefined, { retry: false });
  const convMessages = trpc.conversations.messages.useQuery(
    { conversationId: activeConvId! },
    { enabled: activeConvId != null }
  );
  const createConv = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      setActiveConvId(data.id);
      convList.refetch();
    },
  });
  // Load conversation messages when selected
  useEffect(() => {
    if (convMessages.data && activeConvId != null) {
      const loaded: ChatMessage[] = convMessages.data.map((m: any) => ({
        id: `conv-${m.id}`,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
      }));
      setMessages(loaded);
    }
  }, [convMessages.data, activeConvId]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || isStreaming) return;
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", content: msg, timestamp: Date.now() };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "", timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const allMsgs = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
      const response = await authFetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMsgs, contextType }),
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
                updated[updated.length - 1] = { ...updated[updated.length - 1], content: fullContent };
                return updated;
              });
            } else if (parsed.type === "error") {
              throw new Error(parsed.content || "AI error");
            }
          } catch (e) {
            if ((e as Error).message?.includes("AI error")) throw e;
          }
        }
      }

      if (!fullContent) {
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: "I couldn't generate a response. Please try again." };
          return updated;
        });
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const errMsg = (err as Error).message || "Connection error";
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content: `Error: ${errMsg}` };
        return updated;
      });
      toast.error("Chat error: " + errMsg);
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, scrollToBottom]);

  const handleStop = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const handleClear = useCallback(() => {
    setMessages([]);
    toast.success("Conversation cleared");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex h-full">
      {/* Conversation history sidebar */}
      {showHistory && (
        <div className="w-56 border-r border-border/50 flex flex-col shrink-0 bg-background/50">
          <div className="p-2 border-b border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">History</span>
            <Button type="button" size="icon" aria-label="New item" variant="ghost" className="h-6 w-6" onClick={() => { setActiveConvId(null); setMessages([]); createConv.mutate({ mode: "client" }); }}>
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(convList.data ?? []).map((c: any) => (
              <button
                key={c.id}
                type="button"
                className={`w-full text-left px-3 py-2 text-xs truncate hover:bg-accent/10 transition-colors ${
                  activeConvId === c.id ? "bg-accent/20 text-accent-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setActiveConvId(c.id)}
              >
                {c.title || `Chat ${c.id}`}
              </button>
            ))}
            {(convList.data ?? []).length === 0 && (
              <p className="text-[10px] text-muted-foreground/50 text-center py-4">No saved conversations</p>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-col flex-1 min-w-0">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground/80 mb-2">Start a conversation</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              Ask anything — financial planning, market analysis, insurance strategies, or general questions.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {CHAT_SUGGESTIONS.map(s => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
              {msg.role === "assistant" && (
                <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-accent" />
                </div>
              )}
              <div className={cn(
                "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-foreground"
              )}>
                {msg.role === "assistant" && msg.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : msg.role === "assistant" ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-xs">Thinking...</span>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}
        {isStreaming && (
          <div className="flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={handleStop} className="gap-1.5 text-xs">
              <Square className="w-3 h-3" /> Stop
            </Button>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-border/50 p-3 shrink-0">
        <div className="flex items-center gap-1.5 mb-2">
          <button
            type="button"
            className={`px-2 py-0.5 rounded text-[10px] transition-colors flex items-center gap-1 ${
              showHistory ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
            }`}
            onClick={() => setShowHistory(p => !p)}
            aria-label="Toggle conversation history"
          >
            <History className="w-3 h-3" /> History
          </button>
          <span className="text-border">|</span>
          <span className="text-[10px] text-muted-foreground">Context:</span>
          {CONTEXT_TYPES.map(ct => (
            <button
              key={ct.value}
              type="button"
              className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                contextType === ct.value
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/30"
              }`}
              onClick={() => setContextType(ct.value)}
            >
              {ct.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isStreaming}
          />
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              size="icon" aria-label="Send message"
              className="h-9 w-9"
              onClick={() => handleSend()}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
            {messages.length > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button type="button" size="icon" aria-label="Delete" variant="ghost" className="h-7 w-7" onClick={handleClear}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Clear conversation</TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>
      </div>
      </div>{/* close flex-col flex-1 */}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  MODE 2: DEV PANEL (Code Chat)
// ════════════════════════════════════════════════════════════════════
function DevPanel() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [input, setInput] = useState("");
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.codeChat.chat.useMutation({
    onSuccess: (data) => {
      const assistantMsg: DevMessage = {
        id: uid(),
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
        traces: data.traces,
        model: data.model ?? undefined,
        iterations: data.iterations,
        toolCallCount: data.toolCallCount,
      };
      setMessages(prev => [...prev, assistantMsg]);
    },
    onError: (err) => {
      const errMsg: DevMessage = {
        id: uid(),
        role: "assistant",
        content: `Error: ${err.message}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
      toast.error("Dev chat error: " + err.message);
    },
  });

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  const handleSend = useCallback((text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMutation.isPending) return;
    setInput("");

    const userMsg: DevMessage = { id: uid(), role: "user", content: msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);

    chatMutation.mutate({
      message: msg,
      allowMutations: user?.role === "admin",
      maxIterations: 5,
    });
  }, [input, chatMutation, user?.role]);

  const toggleTrace = useCallback((msgId: string) => {
    setExpandedTraces(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleClear = useCallback(() => {
    setMessages([]);
    toast.success("Dev session cleared");
  }, []);

  return (
    <div className="flex flex-col h-full font-mono">
      {/* Terminal-style messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-black/20" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Terminal className="w-12 h-12 text-emerald-500/30 mb-4" />
            <h3 className="text-lg font-medium text-foreground/80 mb-2 font-sans">Code Assistant</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md font-sans">
              Explore the codebase, search for symbols, read files, and get AI-powered code analysis.
              {user?.role === "admin" && " Admin mode: file writes and bash commands are available."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {DEV_SUGGESTIONS.map(s => (
                <Button
                  key={s}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-8 font-sans border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => handleSend(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="space-y-1">
              {msg.role === "user" ? (
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 text-xs mt-0.5 shrink-0">$</span>
                  <p className="text-sm text-emerald-300 whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Tool traces */}
                  {msg.traces && msg.traces.length > 0 && (
                    <div className="ml-4">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => toggleTrace(msg.id)}
                      >
                        {expandedTraces.has(msg.id) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        <Activity className="w-3 h-3" />
                        {msg.toolCallCount ?? msg.traces.length} tool call{(msg.toolCallCount ?? msg.traces.length) !== 1 ? "s" : ""}
                        {msg.iterations ? ` · ${msg.iterations} iteration${msg.iterations !== 1 ? "s" : ""}` : ""}
                      </button>
                      {expandedTraces.has(msg.id) && (
                        <div className="mt-2 space-y-2 border-l-2 border-emerald-500/20 pl-3">
                          {msg.traces.map((trace, i) => (
                            <div key={i} className="text-xs space-y-0.5">
                              {trace.thought && (
                                <p className="text-amber-400/80 italic">💭 {trace.thought}</p>
                              )}
                              {trace.toolName && (
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="outline" className="text-[10px] h-4 border-emerald-500/30 text-emerald-400">
                                    {trace.toolName}
                                  </Badge>
                                  {trace.durationMs != null && (
                                    <span className="text-muted-foreground">{trace.durationMs}ms</span>
                                  )}
                                </div>
                              )}
                              {trace.observation && (
                                <pre className="text-muted-foreground/70 text-[10px] max-h-24 overflow-y-auto whitespace-pre-wrap bg-black/30 rounded p-1.5">
                                  {trace.observation.slice(0, 500)}{trace.observation.length > 500 ? "..." : ""}
                                </pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Response */}
                  <div className="ml-4 text-sm text-foreground/90 prose prose-sm dark:prose-invert max-w-none prose-pre:bg-black/40 prose-pre:border prose-pre:border-emerald-500/20">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                  {msg.model && (
                    <div className="ml-4 flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Brain className="w-3 h-3" />
                      {msg.model}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
        {chatMutation.isPending && (
          <div className="flex items-center gap-2 ml-4 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span className="animate-pulse">Executing...</span>
          </div>
        )}
      </div>

      {/* Terminal-style input */}
      <div className="border-t border-emerald-500/20 p-3 shrink-0 bg-black/10">
        <div className="flex gap-2 items-center">
          <span className="text-emerald-400 text-sm shrink-0">$</span>
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the codebase..."
            className="font-mono text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-emerald-300 placeholder:text-emerald-500/40"
            disabled={chatMutation.isPending}
          />
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon" aria-label="Send message"
              variant="ghost"
              className="h-8 w-8 text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => handleSend()}
              disabled={!input.trim() || chatMutation.isPending}
            >
              {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
            {messages.length > 0 && (
              <Button type="button" size="icon" aria-label="Delete" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={handleClear}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground ml-4">
          <span>Tools: read_file, grep_search, list_directory, glob_files, find_symbol</span>
          {user?.role === "admin" && <Badge variant="outline" className="text-[9px] h-3.5 border-amber-500/30 text-amber-400">Admin: write + bash enabled</Badge>}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  MODE 3: AUTO PANEL (Agent Manager)
// ════════════════════════════════════════════════════════════════════
function AutoPanel() {
  const { isAuthenticated } = useAuth();
  const agents = trpc.openClaw.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", type: "compliance_monitor" as string, instructions: "", maxBudgetPerRun: 0.5, complianceAware: true,
  });

  const resetForm = useCallback(() => {
    setForm({ name: "", type: "compliance_monitor", instructions: "", maxBudgetPerRun: 0.5, complianceAware: true });
  }, []);

  const createMutation = trpc.openClaw.create.useMutation({
    onSuccess: () => { agents.refetch(); toast.success("Agent created"); setShowCreate(false); resetForm(); },
    onError: (err) => toast.error("Failed to create agent: " + err.message),
  });
  const launchMutation = trpc.openClaw.launch.useMutation({
    onSuccess: () => { agents.refetch(); toast.success("Agent launched"); },
  });
  const stopMutation = trpc.openClaw.stop.useMutation({
    onSuccess: () => { agents.refetch(); toast.info("Agent stopped"); },
  });
  const deleteMutation = trpc.openClaw.delete.useMutation({
    onSuccess: () => { agents.refetch(); toast.success("Agent deleted"); },
  });

  const applyTemplate = useCallback((t: typeof TASK_TEMPLATES[0]) => {
    setForm({ name: t.name, type: t.type, instructions: t.instructions, maxBudgetPerRun: 0.5, complianceAware: true });
    setShowCreate(true);
  }, []);

  const handleCreate = useCallback(() => {
    if (!form.name.trim() || !form.instructions.trim()) {
      toast.error("Name and instructions are required");
      return;
    }
    createMutation.mutate({
      name: form.name,
      type: form.type as any,
      instructions: form.instructions,
      maxBudgetPerRun: form.maxBudgetPerRun,
      complianceAware: form.complianceAware,
    });
  }, [form, createMutation]);

  // Agent action log for selected agent
  const actionsQuery = trpc.openClaw.listActions.useQuery(
    { agentId: selectedAgent!, limit: 20 },
    { enabled: selectedAgent != null }
  );

  const agentList = (agents.data ?? []) as any[];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Empty state */}
        {!showCreate && agentList.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground/80 mb-2">No Agents Yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Create autonomous agents to handle compliance monitoring, lead processing, report generation, and more.
            </p>
          </div>
        )}

        {/* Task templates */}
        {!showCreate && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-muted-foreground">Quick Start Templates</h3>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCreate(true)}>
                <Plus className="w-3 h-3" /> Custom Agent
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TASK_TEMPLATES.map(t => (
                <button
                  key={t.name}
                  type="button"
                  className="text-left p-3 rounded-lg border border-border/50 hover:border-accent/50 hover:bg-accent/5 transition-colors"
                  onClick={() => applyTemplate(t)}
                >
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.instructions}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Create form */}
        {showCreate && (
          <Card className="border-accent/30">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Create Agent</CardTitle>
                <Button type="button" size="icon" aria-label="Close" variant="ghost" className="h-6 w-6" onClick={() => { setShowCreate(false); resetForm(); }}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                placeholder="Agent name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-sm"
              />
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {AGENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="w-3.5 h-3.5" />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea
                placeholder="Instructions — what should this agent do?"
                value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                className="text-sm min-h-[80px]"
                rows={3}
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.complianceAware}
                    onCheckedChange={v => setForm(f => ({ ...f, complianceAware: v }))}
                  />
                  <span className="text-xs text-muted-foreground">Compliance-aware</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent list */}
        {agentList.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Your Agents</h3>
            {agentList.map((agent: any) => (
              <div
                key={agent.id}
                className={cn(
                  "p-3 rounded-lg border transition-colors cursor-pointer",
                  selectedAgent === agent.id
                    ? "border-accent/50 bg-accent/5"
                    : "border-border/50 hover:border-border"
                )}
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      agent.status === "running" ? "bg-emerald-500 animate-pulse" :
                      agent.status === "idle" ? "bg-amber-500" :
                      agent.status === "error" ? "bg-red-500" : "bg-muted-foreground/30"
                    )} />
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{agent.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {agent.status === "running" ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400 hover:bg-red-500/10"
                        onClick={e => { e.stopPropagation(); stopMutation.mutate({ agentId: agent.id }); }}
                        disabled={stopMutation.isPending}
                        aria-label={`Stop agent ${agent.name}`}
                      >
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/10"
                        onClick={e => { e.stopPropagation(); launchMutation.mutate({ agentId: agent.id }); }}
                        disabled={launchMutation.isPending}
                        aria-label={`Launch agent ${agent.name}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-red-400"
                      onClick={e => { e.stopPropagation(); deleteMutation.mutate({ agentId: agent.id }); }}
                      disabled={deleteMutation.isPending}
                      aria-label={`Delete agent ${agent.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {agent.instructions && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{agent.instructions}</p>
                )}

                {/* Action log for selected agent */}
                {selectedAgent === agent.id && (
                  <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Recent Actions</span>
                      <Button type="button" size="icon" variant="ghost" className="h-5 w-5" onClick={() => actionsQuery.refetch()} aria-label="Refresh actions">
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    </div>
                    {actionsQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Loading actions...
                      </div>
                    ) : (actionsQuery.data ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No actions yet. Launch the agent to start.</p>
                    ) : (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {(actionsQuery.data as any[] ?? []).map((action: any) => (
                          <div key={action.id} className="flex items-center gap-2 text-xs p-1.5 rounded bg-muted/30">
                            {action.status === "completed" ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" /> :
                             action.status === "error" ? <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" /> :
                             <Clock className="w-3 h-3 text-amber-500 shrink-0" />}
                            <span className="truncate flex-1">{action.actionType || action.type || "Action"}</span>
                            {action.durationMs && <span className="text-muted-foreground shrink-0">{action.durationMs}ms</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
//  MAIN: UNIFIED AI STUDIO
// ════════════════════════════════════════════════════════════════════
type StudioMode = "chat" | "dev" | "auto";

export default function UnifiedAI() {
  const { isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<StudioMode>("chat");
  const serviceHealth = trpc.system.serviceHealth.useQuery(undefined, { enabled: isAuthenticated, refetchInterval: 60_000, retry: false });

  // Keyboard shortcuts for mode switching: Ctrl+1/2/3
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "1") { e.preventDefault(); setMode("chat"); requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Chat mode"] textarea')?.focus()); }
        else if (e.key === "2") { e.preventDefault(); setMode("dev"); requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[aria-label="Dev mode"] input')?.focus()); }
        else if (e.key === "3") { e.preventDefault(); setMode("auto"); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const modeConfig: Record<StudioMode, { label: string; icon: typeof MessageSquare; color: string; desc: string }> = {
    chat: { label: "Chat", icon: MessageSquare, color: "text-blue-400", desc: "Streaming AI conversation" },
    dev: { label: "Dev", icon: Terminal, color: "text-emerald-400", desc: "Code assistant with tool access" },
    auto: { label: "Auto", icon: Bot, color: "text-purple-400", desc: "Autonomous agent management" },
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SEOHead title="AI Studio" description="Unified AI surface — chat, code, and automate" />

      {/* Header with mode tabs */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          {/* Mode tabs */}
          <div className="flex items-center bg-muted/50 rounded-lg p-0.5">
            {(Object.keys(modeConfig) as StudioMode[]).map(m => {
              const cfg = modeConfig[m];
              const Icon = cfg.icon;
              return (
                <button
                  key={m}
                  type="button"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                    mode === m
                      ? "bg-background shadow-sm " + cfg.color
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setMode(m)}
                  aria-pressed={mode === m}
                  title={`${cfg.label} (Ctrl+${m === "chat" ? "1" : m === "dev" ? "2" : "3"})`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">{cfg.label}</span>
                </button>
              );
            })}
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">{modeConfig[mode].desc}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate("/chat")} aria-label="Open full Chat">
                <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open full Chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => navigate("/settings/ai-tuning")} aria-label="AI Settings">
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>AI Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Mode content — all panels stay mounted to preserve conversation state */}
      <div className="flex-1 overflow-hidden relative">
        <div className={cn("absolute inset-0", mode === "chat" ? "z-10 visible" : "z-0 invisible")} role="tabpanel" aria-label="Chat mode" aria-hidden={mode !== "chat"}>
          <ServiceDegradedFallback serviceId="llm" degradedMessage="AI chat may be slower or unavailable.">
            <ChatPanel />
          </ServiceDegradedFallback>
        </div>
        <div className={cn("absolute inset-0", mode === "dev" ? "z-10 visible" : "z-0 invisible")} role="tabpanel" aria-label="Dev mode" aria-hidden={mode !== "dev"}>
          <ServiceDegradedFallback serviceId="llm" degradedMessage="Code assistant may be slower or unavailable.">
            <DevPanel />
          </ServiceDegradedFallback>
        </div>
        <div className={cn("absolute inset-0", mode === "auto" ? "z-10 visible" : "z-0 invisible")} role="tabpanel" aria-label="Auto mode" aria-hidden={mode !== "auto"}>
          <AutoPanel />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-1 border-t border-border/30 bg-muted/30 text-[10px] text-muted-foreground shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className={cn("w-1.5 h-1.5 rounded-full", serviceHealth.data?.every((s: any) => s.status === "connected") ? "bg-emerald-500" : serviceHealth.isLoading ? "bg-amber-500 animate-pulse" : "bg-red-500")} />
            {serviceHealth.data?.every((s: any) => s.status === "connected") ? "All services connected" : serviceHealth.isLoading ? "Checking..." : "Some services degraded"}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-muted-foreground/60">
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Ctrl+1</kbd> Chat
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Ctrl+2</kbd> Dev
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Ctrl+3</kbd> Auto
        </div>
      </div>
    </div>
  );
}
