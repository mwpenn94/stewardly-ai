/**
 * Code Chat — Claude Code-style interface.
 *
 * Terminal-like conversational UI with:
 *   - Chat input with ReAct loop tool visualization
 *   - Inline file viewer with syntax highlighting (via <pre>)
 *   - Step-by-step tool call traces (reading files, grep, edits)
 *   - File browser, roadmap, diff, and GitHub tabs
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, FileText, FolderOpen, GitBranch, Sparkles,
  CheckCircle2, AlertTriangle, Github, ExternalLink,
  Lock, Unlock, Terminal, Send, ChevronDown, ChevronRight,
  Activity, Save, Pencil, X, SplitSquareHorizontal,
  Copy, RotateCw, Download, Keyboard,
} from "lucide-react";
import { toast } from "sonner";
import GitHubWritePanel from "@/components/codeChat/GitHubWritePanel";
import BackgroundJobsPanel from "@/components/codeChat/BackgroundJobsPanel";
import DiffView from "@/components/codeChat/DiffView";
import SlashCommandPopover from "@/components/codeChat/SlashCommandPopover";
import MarkdownMessage from "@/components/codeChat/MarkdownMessage";
import FileMentionPopover from "@/components/codeChat/FileMentionPopover";
import KeyboardShortcutsOverlay from "@/components/codeChat/KeyboardShortcutsOverlay";
import {
  exportConversationAsMarkdown,
  exportSingleMessageAsMarkdown,
  downloadTextFile,
} from "@/components/codeChat/conversationExport";
import {
  estimateMessageUsage,
  sumUsage,
  formatTokens,
  formatCost,
  type TokenUsage,
} from "@/components/codeChat/tokenEstimator";
import {
  filterCommands,
  tryRunSlashCommand,
  type SlashCommand,
} from "@/components/codeChat/slashCommands";

// ─── Types ─────────────────────────────────────────────────────────────────

interface TraceStep {
  step: number;
  thought?: string;
  toolName?: string;
  observation?: string;
  /** Raw JSON preview from the SSE tool_result event — parsed for diffs */
  rawPreview?: string;
  durationMs?: number;
}

/**
 * Try to extract before/after snapshots from a serialized dispatch
 * result. Returns null if the tool isn't edit/write or the snapshots
 * aren't present. Pass 205.
 */
function extractDiffFromTrace(
  toolName: string | undefined,
  rawPreview: string | undefined,
): { before: string; after: string; path: string } | null {
  if (!rawPreview) return null;
  if (toolName !== "edit_file" && toolName !== "write_file") return null;
  try {
    const parsed = JSON.parse(rawPreview);
    // dispatch result shape: { kind: "edit"|"write", result: { before, after, path } }
    const inner = parsed?.result;
    if (!inner) return null;
    if (typeof inner.before !== "string" || typeof inner.after !== "string") {
      return null;
    }
    return {
      before: inner.before,
      after: inner.after,
      path: typeof inner.path === "string" ? inner.path : "",
    };
  } catch {
    return null;
  }
}

// ─── Tool Trace Visualization ──────────────────────────────────────────────

function TraceView({ traces }: { traces: TraceStep[] }) {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const toggle = (step: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  };

  return (
    <div className="space-y-1 my-2">
      {traces.map(t => {
        const diff = extractDiffFromTrace(t.toolName, t.rawPreview);
        return (
        <div key={t.step} className="border border-border/40 rounded-lg overflow-hidden bg-card/30">
          <button
            onClick={() => toggle(t.step)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-secondary/30 transition-colors"
          >
            {expandedSteps.has(t.step) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">
              {t.toolName || "thinking"}
            </Badge>
            <span className="text-muted-foreground truncate flex-1 text-left">
              {t.thought?.slice(0, 80) || "processing..."}
            </span>
            {diff && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/50 text-emerald-500">
                diff
              </Badge>
            )}
            {t.durationMs != null && (
              <span className="text-[9px] text-muted-foreground/60 tabular-nums">{t.durationMs}ms</span>
            )}
          </button>
          {expandedSteps.has(t.step) && (
            <div className="px-3 pb-2 space-y-1.5">
              {t.thought && (
                <div className="text-[11px] text-muted-foreground italic">{t.thought}</div>
              )}
              {diff ? (
                <DiffView
                  oldText={diff.before}
                  newText={diff.after}
                  pathA={diff.path || undefined}
                  pathB={diff.path || undefined}
                  heightClass="max-h-72"
                  hideGutter={false}
                />
              ) : t.observation && (
                <pre className="text-[11px] bg-background/80 rounded p-2 overflow-x-auto max-h-60 font-mono whitespace-pre-wrap border border-border/30">
                  {t.observation.length > 3000 ? t.observation.slice(0, 3000) + "\n... (truncated)" : t.observation}
                </pre>
              )}
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}

import { useCodeChatStream, type ToolEvent, type CodeChatMessage } from "@/hooks/useCodeChatStream";

// ─── Live Tool Event Display ───────────────────────────────────────────────

function LiveToolEvents({ events }: { events: ToolEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="space-y-1 my-2">
      {events.map(ev => (
        <div key={ev.stepIndex} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/30 bg-card/20 text-xs">
          {ev.status === "running" ? (
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
          ) : ev.status === "error" ? (
            <AlertTriangle className="w-3 h-3 text-destructive" />
          ) : (
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          )}
          <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono">{ev.toolName}</Badge>
          {ev.args?.path != null && <span className="text-muted-foreground truncate">{String(ev.args.path)}</span>}
          {ev.args?.pattern != null && <span className="text-muted-foreground truncate">&quot;{String(ev.args.pattern)}&quot;</span>}
          {ev.durationMs != null && <span className="text-muted-foreground/50 tabular-nums ml-auto">{ev.durationMs}ms</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Main Chat Interface (SSE Streaming) ───────────────────────────────────

const HISTORY_KEY = "stewardly-codechat-history";
const MESSAGES_KEY = "stewardly-codechat-messages";
const DRAFT_KEY = "stewardly-codechat-draft";

function CodeChatInterface() {
  const { user } = useAuth();
  // Pass 209: draft autosave — restore any in-progress text from the
  // previous session so a refresh doesn't lose what the user typed
  const [input, setInput] = useState(() => {
    try {
      return localStorage.getItem(DRAFT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [allowMutations, setAllowMutations] = useState(false);
  const [maxIterations, setMaxIterations] = useState(5);
  const [modelOverride, setModelOverride] = useState<string | undefined>(undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showFiles, setShowFiles] = useState(false);

  // Slash-command popover state
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashActiveIdx, setSlashActiveIdx] = useState(0);

  // @-mention popover state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionActiveIdx, setMentionActiveIdx] = useState(0);
  const mentionFilesQuery = trpc.codeChat.listWorkspaceFiles.useQuery(
    { query: mentionQuery ?? "", limit: 12 },
    { enabled: mentionQuery !== null, staleTime: 30_000 },
  );

  // Command history (up/down arrow)
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); } catch { return []; }
  });
  const [historyIndex, setHistoryIndex] = useState(-1);

  const { messages, isExecuting, currentTools, error, sendMessage, abort, clearHistory, regenerateLast } = useCodeChatStream();

  // Derive slash-command suggestions from the current input
  const slashSuggestions: SlashCommand[] = useMemo(() => {
    if (!input.startsWith("/")) return [];
    const query = input.slice(1).split(" ")[0];
    return filterCommands(query);
  }, [input]);

  // Open/close the slash popover as the user types
  useEffect(() => {
    const shouldShow = input.startsWith("/") && !input.includes("\n");
    setSlashOpen(shouldShow && slashSuggestions.length > 0);
    setSlashActiveIdx(0);
  }, [input, slashSuggestions.length]);

  // Detect `@query` at the caret (simplified: look at the last @
  // that isn't followed by whitespace). If found, open the mention
  // popover with that query.
  useEffect(() => {
    const match = /@([\w./-]*)$/.exec(input);
    if (match) {
      setMentionQuery(match[1]);
      setMentionActiveIdx(0);
    } else {
      setMentionQuery(null);
    }
  }, [input]);

  const mentionFiles = mentionFilesQuery.data?.files ?? [];
  const mentionOpen = mentionQuery !== null && mentionFiles.length > 0;

  // Pass 210: compute per-message usage + running session total
  const messageUsages = useMemo<Map<string, TokenUsage>>(() => {
    const map = new Map<string, TokenUsage>();
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (msg.role !== "assistant") continue;
      // Input = the most recent user turn before this assistant message
      let input = "";
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === "user") {
          input = messages[j].content;
          break;
        }
      }
      map.set(msg.id, estimateMessageUsage(input, msg.content, msg.model));
    }
    return map;
  }, [messages]);
  const sessionUsage = useMemo(
    () => sumUsage(Array.from(messageUsages.values())),
    [messageUsages],
  );

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50))); } catch { /* quota */ }
    }
  }, [messages]);

  // Pass 209: persist the in-progress draft to localStorage on every
  // change, and clear it as soon as the draft becomes empty.
  useEffect(() => {
    try {
      if (input) localStorage.setItem(DRAFT_KEY, input);
      else localStorage.removeItem(DRAFT_KEY);
    } catch { /* quota */ }
  }, [input]);

  // Pass 209: `?` opens the keyboard shortcuts overlay when the
  // input is empty (so typing a literal "?" in a prompt still works).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "?" && !input) {
        const target = e.target as HTMLElement | null;
        const isTextField =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable);
        if (!isTextField) {
          e.preventDefault();
          setShortcutsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [input]);

  const isAdmin = user?.role === "admin";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, currentTools]);

  // Pass 211: persistent error banner instead of a single toast.
  // Errors stick until the user dismisses them or kicks off a retry.
  const [lastErrorBanner, setLastErrorBanner] = useState<string | null>(null);
  useEffect(() => {
    if (error) {
      setLastErrorBanner(error);
      toast.error(error);
    }
  }, [error]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isExecuting) return;

    // Intercept slash commands first — they run locally without
    // sending a chat message (unless the handler returns a rewrite)
    if (text.startsWith("/")) {
      const result = await tryRunSlashCommand(text, {
        clear: clearHistory,
        cancel: abort,
        setInput,
        setAllowMutations,
        setMaxIterations,
        setModel: setModelOverride,
        toast: (kind, message) => {
          if (kind === "success") toast.success(message);
          else if (kind === "error") toast.error(message);
          else toast.info(message);
        },
        isAdmin,
      });
      if (result !== null) {
        if (result.handled) {
          if ("rewrite" in result && result.rewrite) {
            // The command expanded the input into a longer prompt —
            // put it in the textarea for the user to review, don't auto-send
            setInput(result.rewrite);
            inputRef.current?.focus();
          } else {
            setInput("");
          }
          return;
        } else {
          toast.error(result.error);
          return;
        }
      }
    }

    // Save to command history
    const newHistory = [text, ...commandHistory.filter(h => h !== text)].slice(0, 50);
    setCommandHistory(newHistory);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)); } catch { /* quota */ }
    setHistoryIndex(-1);
    setInput("");
    setLastErrorBanner(null); // Pass 211: clear previous error on new send
    await sendMessage(text, {
      allowMutations: isAdmin && allowMutations,
      maxIterations,
      model: modelOverride,
    });
    inputRef.current?.focus();
  }, [input, isExecuting, sendMessage, allowMutations, maxIterations, isAdmin, commandHistory, clearHistory, abort, modelOverride]);

  const handleSlashSelect = useCallback((cmd: SlashCommand) => {
    // Pre-fill the input with the command so the user can type args
    setInput(`/${cmd.name}${cmd.args ? " " : ""}`);
    setSlashOpen(false);
    inputRef.current?.focus();
  }, []);

  const handleMentionSelect = useCallback((file: string) => {
    // Replace the trailing @query with @file and a trailing space
    setInput((prev) => prev.replace(/@([\w./-]*)$/, `@${file} `));
    setMentionQuery(null);
    inputRef.current?.focus();
  }, []);

  // Arrow key navigation for command history + slash popover
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Mention popover nav takes precedence over slash
    if (mentionOpen) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionActiveIdx((i) => Math.min(i + 1, mentionFiles.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        handleMentionSelect(mentionFiles[mentionActiveIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    // Slash popover nav takes precedence over history
    if (slashOpen && slashSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashActiveIdx((i) => Math.min(i + 1, slashSuggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        handleSlashSelect(slashSuggestions[slashActiveIdx]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashOpen(false);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    } else if (e.key === "ArrowUp" && !input && commandHistory.length > 0) {
      e.preventDefault();
      const idx = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(idx);
      setInput(commandHistory[idx]);
    } else if (e.key === "ArrowDown" && historyIndex >= 0) {
      e.preventDefault();
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      setInput(idx >= 0 ? commandHistory[idx] : "");
    } else if (e.key === "Escape" && isExecuting) {
      e.preventDefault();
      abort();
    }
  }, [handleSend, input, commandHistory, historyIndex, slashOpen, slashSuggestions, slashActiveIdx, handleSlashSelect, mentionOpen, mentionFiles, mentionActiveIdx, handleMentionSelect, isExecuting, abort]);

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-10rem)]">
      {/* Config bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/40 text-xs">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-accent" />
          <span className="font-medium">Code Chat</span>
        </div>
        {messages.length > 0 && (
          <div
            className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground font-mono tabular-nums"
            title={`${sessionUsage.inputTokens} in / ${sessionUsage.outputTokens} out`}
          >
            <span>{formatTokens(sessionUsage.totalTokens)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{formatCost(sessionUsage.costUSD)}</span>
          </div>
        )}
        <div className="flex-1" />
        {isAdmin && (
          <label className="flex items-center gap-1.5 cursor-pointer">
            {allowMutations ? <Unlock className="w-3 h-3 text-amber-400" /> : <Lock className="w-3 h-3 text-muted-foreground" />}
            <span className="text-muted-foreground">Write mode</span>
            <Switch checked={allowMutations} onCheckedChange={setAllowMutations} className="scale-75" />
          </label>
        )}
        <select
          value={maxIterations}
          onChange={e => setMaxIterations(Number(e.target.value))}
          className="h-6 px-1.5 text-[10px] rounded border border-border bg-background"
          aria-label="Max iterations"
        >
          {[1, 3, 5, 7, 10].map(n => <option key={n} value={n}>{n} steps</option>)}
        </select>
        <button
          onClick={() => setShortcutsOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (press ?)"
        >
          <Keyboard className="w-3 h-3" /> ?
        </button>
        <button
          onClick={() => {
            if (messages.length === 0) {
              toast.info("Nothing to export yet");
              return;
            }
            downloadTextFile(
              exportConversationAsMarkdown(messages),
              `code-chat-${new Date().toISOString().slice(0, 10)}.md`,
            );
          }}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Export conversation as markdown"
          title="Export conversation"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${showFiles ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted-foreground hover:text-foreground"}`}
          aria-label="Toggle file panel"
        >
          <FolderOpen className="w-3 h-3" /> Files
        </button>
      </div>

      {/* Split layout: chat + optional file panel */}
      <div className="flex flex-1 min-h-0">
      {/* Chat column */}
      <div className={`flex flex-col ${showFiles ? "flex-1 min-w-0" : "w-full"}`}>
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Terminal className="w-10 h-10 mb-3 text-accent/40" />
            <h3 className="font-heading text-lg font-semibold text-foreground mb-1">Code Chat</h3>
            <p className="text-sm max-w-md">
              Ask questions about the codebase. The AI will read files, search code, and explain what it finds — step by step.
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              {[
                "What does the chat streaming pipeline do?",
                "Find where user authentication is implemented",
                "Explain the wealth engine architecture",
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 text-xs rounded-full border border-border hover:border-accent/30 hover:bg-accent/5 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, msgIdx) => {
          // Only the most recent assistant message shows the Regenerate button
          const isLastAssistant =
            msg.role === "assistant" &&
            msgIdx === messages.length - 1 &&
            !isExecuting;
          return (
          <div key={msg.id} className={`${msg.role === "user" ? "flex justify-end" : "group"}`}>
            {msg.role === "user" ? (
              <div className="bg-accent/10 text-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2 max-w-full">
                {/* Tool events from streaming */}
                {msg.toolEvents && msg.toolEvents.length > 0 && (
                  <TraceView traces={msg.toolEvents.map(ev => ({
                    step: ev.stepIndex,
                    thought: ev.args ? `${ev.toolName}(${Object.entries(ev.args).map(([k,v]) => `${k}: ${String(v).slice(0,60)}`).join(", ")})` : undefined,
                    toolName: ev.toolName,
                    observation: ev.preview ? (typeof ev.preview === "string" ? ev.preview.slice(0, 3000) : JSON.stringify(ev.preview).slice(0, 3000)) : undefined,
                    rawPreview: typeof ev.preview === "string" ? ev.preview : undefined,
                    durationMs: ev.durationMs,
                  }))} />
                )}
                {/* Response */}
                <div className="bg-card/60 border border-border/30 px-4 py-3 rounded-xl text-sm leading-relaxed">
                  <MarkdownMessage content={msg.content} />
                </div>
                {/* Meta + action bar */}
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
                  {msg.model && <span>{msg.model}</span>}
                  {msg.toolCallCount != null && msg.toolCallCount > 0 && (
                    <span>• {msg.toolCallCount} tool calls</span>
                  )}
                  {msg.iterations != null && <span>• {msg.iterations} iterations</span>}
                  {msg.totalDurationMs != null && <span>• {(msg.totalDurationMs / 1000).toFixed(1)}s</span>}
                  {(() => {
                    const usage = messageUsages.get(msg.id);
                    if (!usage) return null;
                    return (
                      <span
                        className="tabular-nums"
                        title={`${usage.inputTokens} in / ${usage.outputTokens} out`}
                      >
                        • {formatTokens(usage.totalTokens)} {usage.costUSD !== null && `(${formatCost(usage.costUSD)})`}
                      </span>
                    );
                  })()}
                  <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="hover:text-foreground transition-colors p-1 rounded"
                      aria-label="Copy response"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(msg.content);
                          toast.success("Response copied");
                        } catch {
                          toast.error("Copy failed");
                        }
                      }}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className="hover:text-foreground transition-colors p-1 rounded"
                      aria-label="Export message as markdown"
                      onClick={() => {
                        downloadTextFile(
                          exportSingleMessageAsMarkdown(msg),
                          `code-chat-${msg.id}.md`,
                        );
                      }}
                    >
                      <Download className="w-3 h-3" />
                    </button>
                    {isLastAssistant && (
                      <button
                        type="button"
                        className="hover:text-foreground transition-colors p-1 rounded"
                        aria-label="Regenerate response"
                        onClick={async () => {
                          const ok = await regenerateLast({
                            allowMutations: isAdmin && allowMutations,
                            maxIterations,
                            model: modelOverride,
                          });
                          if (!ok) toast.error("Nothing to regenerate");
                        }}
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          );
        })}

        {/* Live streaming tool events */}
        {isExecuting && currentTools.length > 0 && (
          <LiveToolEvents events={currentTools} />
        )}

        {isExecuting && currentTools.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span>Thinking...</span>
          </div>
        )}
      </div>

      {/* Error banner (Pass 211) */}
      {lastErrorBanner && !isExecuting && (
        <div className="px-3 py-2 border-t border-destructive/30 bg-destructive/5 text-xs flex items-start gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-destructive">Request failed</div>
            <div className="text-muted-foreground break-words">{lastErrorBanner}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="px-2 py-0.5 rounded border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
              onClick={async () => {
                const ok = await regenerateLast({
                  allowMutations: isAdmin && allowMutations,
                  maxIterations,
                  model: modelOverride,
                });
                if (ok) setLastErrorBanner(null);
                else toast.info("No previous prompt to retry");
              }}
            >
              Retry
            </button>
            <button
              type="button"
              className="px-2 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setLastErrorBanner(null)}
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border/40 p-3">
        <div className="flex gap-2 relative">
          {mentionOpen && (
            <FileMentionPopover
              files={mentionFiles}
              activeIndex={mentionActiveIdx}
              onSelect={handleMentionSelect}
            />
          )}
          {slashOpen && !mentionOpen && (
            <SlashCommandPopover
              commands={slashSuggestions}
              activeIndex={slashActiveIdx}
              onSelect={handleSlashSelect}
            />
          )}
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              modelOverride
                ? `[${modelOverride}] @file or / for commands...`
                : allowMutations
                  ? "Write mode — ask, @file, or type / for commands..."
                  : "Ask about the codebase — @file to reference, / for commands..."
            }
            className="flex-1 min-h-[40px] max-h-[120px] resize-none text-sm border-border/50 bg-background/50 font-mono"
            rows={1}
            disabled={isExecuting}
          />
          {isExecuting ? (
            <Button
              size="icon"
              onClick={abort}
              className="h-10 w-10 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30 shrink-0"
              aria-label="Stop execution"
            >
              <span className="w-3 h-3 bg-destructive rounded-sm" />
            </Button>
          ) : (
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim()}
              className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shrink-0"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
      </div>{/* end chat column */}

      {/* File panel (desktop only, toggled) */}
      {showFiles && (
        <div className="hidden md:flex flex-col w-80 border-l border-border/40 overflow-y-auto">
          <div className="p-3 border-b border-border/40 flex items-center justify-between">
            <span className="text-xs font-medium flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> File Explorer
            </span>
            <button onClick={() => setShowFiles(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
          </div>
          <div className="p-3">
            <FileBrowser />
          </div>
        </div>
      )}
      </div>{/* end split layout */}
      <KeyboardShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export default function CodeChatPage() {
  return (
    <AppShell title="Code Chat">
      <div className="max-w-6xl mx-auto">
        <Tabs defaultValue="chat">
          <div className="border-b border-border/40 px-4 pt-2">
            <TabsList className="bg-transparent">
              <TabsTrigger value="chat" className="gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> Chat
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <FolderOpen className="h-3.5 w-3.5" /> Files
              </TabsTrigger>
              <TabsTrigger value="roadmap" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Roadmap
              </TabsTrigger>
              <TabsTrigger value="diff" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Diff
              </TabsTrigger>
              <TabsTrigger value="github" className="gap-1.5">
                <Github className="h-3.5 w-3.5" /> GitHub
              </TabsTrigger>
              <TabsTrigger value="write" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Git Write
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Jobs
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="mt-0">
            <CodeChatInterface />
          </TabsContent>

          <TabsContent value="files">
            <div className="p-6"><FileBrowser /></div>
          </TabsContent>

          <TabsContent value="roadmap">
            <div className="p-6"><RoadmapPanel /></div>
          </TabsContent>

          <TabsContent value="diff">
            <div className="p-6"><DiffPanel /></div>
          </TabsContent>

          <TabsContent value="github">
            <div className="p-6"><GitHubPanel /></div>
          </TabsContent>

          <TabsContent value="write">
            <div className="p-6"><GitHubWritePanel /></div>
          </TabsContent>

          <TabsContent value="jobs">
            <div className="p-6"><BackgroundJobsPanel /></div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

// ─── File Browser ─────────────────────────────────────────────────────────

function FileBrowser() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [pathInput, setPathInput] = useState(".");
  const dispatch = trpc.codeChat.dispatch.useMutation();
  const [listing, setListing] = useState<{
    path: string;
    entries: Array<{ name: string; type: string; size?: number }>;
  } | null>(null);
  const [fileContent, setFileContent] = useState<{ path: string; content: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showDiff, setShowDiff] = useState(false);

  const onList = async () => {
    const result = await dispatch.mutateAsync({
      call: { name: "list_directory", args: { path: pathInput } },
      allowMutations: false,
    });
    if (result.kind === "list") {
      setListing(result.result);
      setFileContent(null);
      setEditing(false);
    } else if (result.kind === "error") {
      toast.error(`list failed: ${result.error}`);
    }
  };

  const onRead = async (relPath: string) => {
    const result = await dispatch.mutateAsync({
      call: { name: "read_file", args: { path: relPath } },
      allowMutations: false,
    });
    if (result.kind === "read") {
      setFileContent({ path: result.result.path, content: result.result.content });
      setDraft(result.result.content);
      setEditing(false);
    } else if (result.kind === "error") {
      toast.error(`read failed: ${result.error}`);
    }
  };

  const onSave = async () => {
    if (!fileContent) return;
    setSaving(true);
    try {
      const result = await dispatch.mutateAsync({
        call: { name: "write_file", args: { path: fileContent.path, content: draft } },
        allowMutations: true,
        confirmDangerous: true,
      });
      if (result.kind === "write") {
        toast.success(
          `${result.result.created ? "Created" : "Saved"} ${result.result.path} (${result.result.byteLength}B)`,
        );
        setFileContent({ path: fileContent.path, content: draft });
        setEditing(false);
      } else if (result.kind === "error") {
        toast.error(`save failed: ${result.error}`);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FolderOpen className="h-4 w-4" /> Workspace
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="server/services"
            />
            <Button onClick={onList} disabled={dispatch.isPending}>
              {dispatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "List"}
            </Button>
          </div>
          {listing && (
            <div className="border rounded-md max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <tbody>
                  {listing.entries.map((e) => (
                    <tr
                      key={e.name}
                      className="hover:bg-muted cursor-pointer"
                      onClick={() => {
                        if (e.type === "file") {
                          onRead(`${listing.path}/${e.name}`.replace(/^\.\//, ""));
                        } else if (e.type === "directory") {
                          setPathInput(`${listing.path}/${e.name}`.replace(/^\.\//, ""));
                          setTimeout(onList, 0);
                        }
                      }}
                    >
                      <td className="py-1 px-2 w-8">
                        {e.type === "directory" ? "📁" : "📄"}
                      </td>
                      <td className="py-1 px-2">{e.name}</td>
                      <td className="py-1 px-2 text-right text-muted-foreground tabular-nums">
                        {e.size ? `${(e.size / 1024).toFixed(1)}KB` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="font-mono text-xs truncate">
                {fileContent?.path ?? "No file selected"}
              </span>
            </div>
            {fileContent && isAdmin && (
              <div className="flex items-center gap-1 shrink-0">
                {editing ? (
                  <>
                    <Button
                      size="sm"
                      variant={showDiff ? "default" : "outline"}
                      onClick={() => setShowDiff((v) => !v)}
                      className="h-7 text-[10px]"
                      disabled={saving}
                    >
                      <SplitSquareHorizontal className="h-3 w-3 mr-1" /> Diff
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditing(false); setDraft(fileContent.content); setShowDiff(false); }}
                      disabled={saving}
                      className="h-7 text-[10px]"
                    >
                      <X className="h-3 w-3 mr-1" /> Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={onSave}
                      disabled={saving || draft === fileContent.content}
                      className="h-7 text-[10px]"
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Save className="h-3 w-3 mr-1" />
                      )}
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(true)}
                    className="h-7 text-[10px]"
                  >
                    <Pencil className="h-3 w-3 mr-1" /> Edit
                  </Button>
                )}
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {fileContent ? (
            editing ? (
              showDiff ? (
                <DiffView
                  oldText={fileContent.content}
                  newText={draft}
                  pathA={`${fileContent.path} (saved)`}
                  pathB={`${fileContent.path} (draft)`}
                  heightClass="max-h-[500px]"
                />
              ) : (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="text-xs font-mono h-[500px] resize-none"
                  spellCheck={false}
                />
              )
            ) : (
              <pre className="text-xs overflow-auto max-h-[500px] bg-muted/50 p-3 rounded-md">
                <code>{fileContent.content}</code>
              </pre>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Click a file in the listing to view its contents.
              {isAdmin && <> Admin users can edit files directly with the Edit button.</>}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Roadmap Panel ────────────────────────────────────────────────────────

function RoadmapPanel() {
  const roadmap = trpc.codeChat.getRoadmap.useQuery();
  const utils = trpc.useUtils();
  const addItem = trpc.codeChat.addRoadmapItem.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });
  const iterate = trpc.codeChat.iterateRoadmap.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });
  const updateStatus = trpc.codeChat.updateRoadmapStatus.useMutation({
    onSuccess: () => utils.codeChat.getRoadmap.invalidate(),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const onAdd = async () => {
    if (!title.trim()) return;
    await addItem.mutateAsync({
      title,
      description,
      businessValue: 5,
      timeCriticality: 5,
      riskReduction: 5,
      effort: 3,
    });
    setTitle("");
    setDescription("");
    toast.success("Item added to roadmap");
  };

  const onIterate = async () => {
    const r = await iterate.mutateAsync({ topN: 5 });
    toast.success(`Iteration ${r.iterationNumber}: promoted ${r.promoted.length} item(s)`);
  };

  const items = roadmap.data?.roadmap.items ?? [];
  const health = roadmap.data?.health;

  return (
    <div className="space-y-4">
      {/* Health */}
      {health && (
        <Card>
          <CardContent className="grid grid-cols-3 md:grid-cols-6 gap-3 py-4">
            <Stat label="Total" value={health.totalItems} />
            <Stat label="Backlog" value={health.byStatus.backlog} />
            <Stat label="Ready" value={health.byStatus.ready} />
            <Stat label="In Progress" value={health.byStatus.in_progress} />
            <Stat label="Done" value={health.byStatus.done} />
            <Stat label="Avg Priority" value={health.averagePriority.toFixed(1)} />
          </CardContent>
        </Card>
      )}

      {/* Add new item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add roadmap item</CardTitle>
        </CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3 items-end">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="md:col-span-3 flex justify-between">
            <Button onClick={onAdd} disabled={addItem.isPending || !title.trim()}>
              {addItem.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add
            </Button>
            <Button onClick={onIterate} disabled={iterate.isPending} variant="outline">
              {iterate.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Iterate roadmap
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items yet.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-md border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.title}</span>
                      <Badge variant="outline">{item.status}</Badge>
                      {item.priority !== undefined && (
                        <Badge variant="secondary">prio {item.priority}</Badge>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {item.status !== "done" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateStatus.mutate({ id: item.id, status: "done" })
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {item.status !== "blocked" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          updateStatus.mutate({ id: item.id, status: "blocked" })
                        }
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-[11px] uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
    </div>
  );
}

// ─── Diff Panel ──────────────────────────────────────────────────────────

function DiffPanel() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const diff = trpc.codeChat.diffResponses.useQuery(
    { a, b },
    { enabled: a.length > 0 && b.length > 0, staleTime: 0 },
  );

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Response A</Label>
          <Textarea value={a} onChange={(e) => setA(e.target.value)} rows={8} />
        </div>
        <div className="space-y-2">
          <Label>Response B</Label>
          <Textarea value={b} onChange={(e) => setB(e.target.value)} rows={8} />
        </div>
      </div>

      {diff.data && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Word diff —{" "}
              <span className="font-normal text-sm text-muted-foreground">
                similarity {(diff.data.stats.similarity * 100).toFixed(0)}% • {diff.data.stats.shared} shared / {diff.data.stats.uniqueToA} A-only / {diff.data.stats.uniqueToB} B-only
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="leading-relaxed text-sm">
              {diff.data.segments.map((seg, i) => {
                const cls =
                  seg.op === "equal"
                    ? ""
                    : seg.op === "insert"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-200 px-1 rounded"
                      : "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-200 px-1 rounded line-through";
                return (
                  <span key={i} className={cls}>
                    {seg.text}{" "}
                  </span>
                );
              })}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── GitHub Panel ─────────────────────────────────────────────────────────
//
// Shows the live state of the GitHub self-update integration:
//   - Is GITHUB_TOKEN configured?
//   - Can we reach the configured owner/repo?
//   - Open pull requests on the repo (admin can use this to track
//     in-flight changes without leaving the app).
//
// This is the first user-facing surface for the codeChat → github
// foundation. Write-side procedures (create branch, commit, open PR)
// remain admin+confirmDangerous only and are NOT exposed here yet —
// the read-side proves the integration is live before we add UI paths
// that mutate the repo.
function GitHubPanel() {
  const status = trpc.codeChat.githubStatus.useQuery(undefined, {
    retry: false,
  });
  const prs = trpc.codeChat.githubListOpenPRs.useQuery(undefined, {
    retry: false,
    enabled: status.data?.configured === true,
  });

  return (
    <div className="space-y-4 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Github className="h-4 w-4" />
            Integration Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {status.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Probing GitHub…
            </div>
          ) : status.data?.configured ? (
            <>
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  Connected to{" "}
                  <code className="font-mono text-xs">
                    {status.data.owner}/{status.data.repo}
                  </code>
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div>
                  <Label className="text-[10px] uppercase">
                    Default branch
                  </Label>
                  <div className="font-mono">
                    {status.data.defaultBranch ?? "—"}
                  </div>
                </div>
                <div>
                  <Label className="text-[10px] uppercase">Visibility</Label>
                  <div className="flex items-center gap-1">
                    {status.data.isPrivate ? (
                      <>
                        <Lock className="h-3 w-3" /> Private
                      </>
                    ) : (
                      <>
                        <Unlock className="h-3 w-3" /> Public
                      </>
                    )}
                  </div>
                </div>
              </div>
              {status.data.description && (
                <p className="text-xs text-muted-foreground italic">
                  {status.data.description}
                </p>
              )}
              {/* Pass 77: show which credential path was used. */}
              <p className="text-[11px] text-muted-foreground">
                Credential source:{" "}
                {status.data.source === "user_connection" ? (
                  <>
                    your connected account (
                    <a href="/integrations" className="underline">
                      /integrations
                    </a>
                    )
                  </>
                ) : status.data.source === "env" ? (
                  <>
                    deployment env var (<code className="font-mono">GITHUB_TOKEN</code>)
                  </>
                ) : (
                  "unknown"
                )}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span>Not configured</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {status.data?.error ??
                  "Connect a GitHub account in /integrations (provider slug: `github`) or set the GITHUB_TOKEN env var as a deployment-wide fallback."}
              </p>
              <p className="text-[11px] text-muted-foreground">
                <a href="/integrations" className="underline">
                  Open Integrations →
                </a>{" "}
                · see{" "}
                <code className="font-mono">docs/ENV_SETUP.md</code> for the env fallback path.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" /> Open Pull Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!status.data?.configured ? (
            <p className="text-sm text-muted-foreground">
              Connect GitHub above to list open PRs.
            </p>
          ) : prs.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading PRs…
            </div>
          ) : prs.data?.error ? (
            <p className="text-sm text-amber-700 dark:text-amber-400">
              {prs.data.error}
            </p>
          ) : (prs.data?.prs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No open pull requests on{" "}
              <code className="font-mono text-xs">
                {status.data.owner}/{status.data.repo}
              </code>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {(prs.data?.prs ?? []).map((pr) => (
                <li
                  key={pr.number}
                  className="flex items-center justify-between gap-3 rounded border border-border/50 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        #{pr.number}
                      </Badge>
                      <span className="text-sm font-medium truncate">
                        {pr.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                      {pr.head} → {pr.base}
                    </p>
                  </div>
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="Open on GitHub"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
