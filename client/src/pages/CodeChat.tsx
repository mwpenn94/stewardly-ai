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
  Copy, RotateCw, Download, Keyboard, BookMarked, ShieldCheck,
  LibraryBig, GitFork, Star, ThumbsUp, ThumbsDown, List,
  BookOpen, History, StickyNote, Brain, BarChart3, Code2,
} from "lucide-react";
import { toast } from "sonner";
import GitHubWritePanel from "@/components/codeChat/GitHubWritePanel";
import BackgroundJobsPanel from "@/components/codeChat/BackgroundJobsPanel";
import DiffView from "@/components/codeChat/DiffView";
import SlashCommandPopover from "@/components/codeChat/SlashCommandPopover";
import MarkdownMessage from "@/components/codeChat/MarkdownMessage";
import FileMentionPopover from "@/components/codeChat/FileMentionPopover";
import KeyboardShortcutsOverlay from "@/components/codeChat/KeyboardShortcutsOverlay";
import SessionsLibraryPopover from "@/components/codeChat/SessionsLibraryPopover";
import {
  forkMessagesAt,
  upsertSession,
  loadLibrary,
  saveLibrary,
  autoName,
  shouldCheckpoint,
  type SessionSnapshot,
} from "@/components/codeChat/sessionLibrary";
import {
  loadPinned,
  savePinned,
  addPinned,
  removePinned,
  applyPinnedToMessage,
} from "@/components/codeChat/pinnedFiles";
import {
  emptyChordState,
  stepChord,
} from "@/components/codeChat/keyChords";
import ToolPermissionsPopover, {
  DEFAULT_ENABLED_TOOLS,
} from "@/components/codeChat/ToolPermissionsPopover";
import PromptTemplatesPopover from "@/components/codeChat/PromptTemplatesPopover";
import CodeSnippetsPopover from "@/components/codeChat/CodeSnippetsPopover";
import FileTreePanel from "@/components/codeChat/FileTreePanel";
import CommandHistorySearchPopover from "@/components/codeChat/CommandHistorySearchPopover";
import {
  summarizeToolEvents,
  summaryChips,
} from "@/components/codeChat/toolSummary";
import { compactConversation } from "@/components/codeChat/conversationCompact";
import {
  loadBookmarks,
  saveBookmarks,
  toggleBookmark as toggleBookmarkPure,
  isBookmarked,
  loadReactions,
  saveReactions,
  setReaction as setReactionPure,
  getReaction,
  type ReactionMap,
} from "@/components/codeChat/messageAnnotations";
import {
  extractGrepMatches,
  groupMatchesByFile,
} from "@/components/codeChat/grepMatches";
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
  evaluateBudget,
  DEFAULT_BUDGET_STATE,
  evaluateContextWindow,
  formatContextSize,
  type TokenUsage,
  type BudgetState,
} from "@/components/codeChat/tokenEstimator";
import {
  filterCommands,
  tryRunSlashCommand,
  type SlashCommand,
} from "@/components/codeChat/slashCommands";
import PlanReviewPanel from "@/components/codeChat/PlanReviewPanel";
import {
  parsePlanFromText,
  buildExecutionPrompt,
  type Plan,
  type PlanSnapshot,
  snapshotPlan,
  restorePlan,
} from "@/components/codeChat/planMode";
import AgentTodoPanel from "@/components/codeChat/AgentTodoPanel";
import ProjectInstructionsPopover from "@/components/codeChat/ProjectInstructionsPopover";
import EditHistoryPopover from "@/components/codeChat/EditHistoryPopover";
import ScratchpadPanel from "@/components/codeChat/ScratchpadPanel";
import {
  loadScratchpad,
  saveScratchpad,
  type ScratchpadState,
} from "@/components/codeChat/scratchpad";
import AgentMemoryPopover from "@/components/codeChat/AgentMemoryPopover";
import {
  loadMemory,
  saveMemory,
  addMemory,
  buildMemoryOverlay,
  type MemoryEntry,
} from "@/components/codeChat/agentMemory";
import SymbolNavigatorPopover from "@/components/codeChat/SymbolNavigatorPopover";
import SessionAnalyticsPopover from "@/components/codeChat/SessionAnalyticsPopover";
import GitStatusPanel from "@/components/codeChat/GitStatusPanel";
import ImportGraphPanel from "@/components/codeChat/ImportGraphPanel";
import TodoMarkerPanel from "@/components/codeChat/TodoMarkerPanel";
import WorkspaceSearchPanel from "@/components/codeChat/WorkspaceSearchPanel";
import FindReplacePanel from "@/components/codeChat/FindReplacePanel";
import CheckpointsPanel from "@/components/codeChat/CheckpointsPanel";
import DiagnosticsPanel from "@/components/codeChat/DiagnosticsPanel";
import PRDrafterPanel from "@/components/codeChat/PRDrafterPanel";
import TestRunnerPanel from "@/components/codeChat/TestRunnerPanel";
import EnvInspectorPanel from "@/components/codeChat/EnvInspectorPanel";
import ActionPalettePopover from "@/components/codeChat/ActionPalettePopover";
import {
  loadHistory,
  saveHistory,
  recordEdit,
  undo as undoEdit,
  redo as redoEdit,
  dropEntry,
  clearHistory as clearEditHistory,
  summarizeHistory,
  type EditHistoryState,
  type EditHistoryEntry,
} from "@/components/codeChat/editHistory";

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
        const grep = extractGrepMatches(t.toolName, t.rawPreview);
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
            {grep && grep.matches.length > 0 && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-chart-3/50 text-chart-3">
                {grep.matches.length} hit{grep.matches.length === 1 ? "" : "s"}
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
              ) : grep ? (
                <GrepResultView result={grep} />
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

// ─── Grep result row view (Pass 225) ──────────────────────────────────
//
// Renders parsed grep matches as clickable per-line rows. Clicking a
// hit dispatches a `codechat-open-file` custom event so the
// FileBrowser (standalone component) can read the file at that line.

function GrepResultView({
  result,
}: {
  result: ReturnType<typeof extractGrepMatches>;
}) {
  if (!result) return null;
  const groups = groupMatchesByFile(result.matches);
  if (groups.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground italic">No matches.</p>
    );
  }
  return (
    <div className="rounded border border-border/40 max-h-60 overflow-auto bg-background/80">
      {groups.map((group) => (
        <div key={group.file} className="border-b border-border/20 last:border-b-0">
          <div className="px-2 py-1 bg-muted/30 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span className="truncate">{group.file}</span>
            <span className="text-muted-foreground/60">
              {group.matches.length} hit{group.matches.length === 1 ? "" : "s"}
            </span>
          </div>
          {group.matches.map((m, i) => (
            <button
              key={`${m.file}-${m.line}-${i}`}
              type="button"
              className="w-full text-left flex items-start gap-2 px-2 py-1 text-[10px] font-mono hover:bg-secondary/40 transition-colors"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent("codechat-open-file", {
                    detail: { path: m.file, line: m.line },
                  }),
                );
              }}
              title={`Open ${m.file}:${m.line}`}
            >
              <span className="text-accent tabular-nums shrink-0 w-10 text-right">
                {m.line}
              </span>
              <span className="truncate text-foreground/90">{m.text}</span>
            </button>
          ))}
        </div>
      ))}
      {result.truncated && (
        <p className="px-2 py-1 text-[10px] italic text-muted-foreground">
          … results truncated
        </p>
      )}
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

  const { messages, isExecuting, currentTools, currentTodos, loadedInstructionFiles, error, sendMessage, abort, clearHistory, regenerateLast, loadMessages } = useCodeChatStream();

  // Pass 238: project instructions toggle — persisted so toggling
  // off sticks across refreshes for users who prefer a clean slate
  const INSTR_TOGGLE_KEY = "stewardly-codechat-instructions-on";
  const [projectInstructionsOn, setProjectInstructionsOn] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(INSTR_TOGGLE_KEY);
      return raw === null ? true : raw === "true";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(INSTR_TOGGLE_KEY, String(projectInstructionsOn));
    } catch { /* quota */ }
  }, [projectInstructionsOn]);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // Pass 239: edit history ring buffer
  const [editHistory, setEditHistory] = useState<EditHistoryState>(() => loadHistory());
  useEffect(() => { saveHistory(editHistory); }, [editHistory]);
  const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
  const dispatchMutation = trpc.codeChat.dispatch.useMutation();

  // Pass 240: scratchpad drawer
  const [scratchpad, setScratchpad] = useState<ScratchpadState>(() => loadScratchpad());
  useEffect(() => { saveScratchpad(scratchpad); }, [scratchpad]);
  const [scratchpadOpen, setScratchpadOpen] = useState(false);

  // Pass 241: agent memory — persistent facts injected into system prompt
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>(() => loadMemory());
  useEffect(() => { saveMemory(memoryEntries); }, [memoryEntries]);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const memoryOverlay = useMemo(
    () => buildMemoryOverlay(memoryEntries),
    [memoryEntries],
  );

  // /remember slash command broadcasts a window event
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ content: string }>).detail;
      if (detail?.content) {
        setMemoryEntries((prev) => addMemory(prev, detail.content, "fact"));
      }
    };
    window.addEventListener("codechat-remember", handler);
    return () => window.removeEventListener("codechat-remember", handler);
  }, []);

  // Pass 242: symbol navigator (Ctrl+T / Cmd+T)
  const [symbolNavOpen, setSymbolNavOpen] = useState(false);

  // Pass 243: session analytics popover
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Pass 248: listen for palette-dispatched actions
  useEffect(() => {
    const openHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ target: string }>).detail;
      switch (detail?.target) {
        case "symbols":
          setSymbolNavOpen(true);
          break;
        case "sessions":
          setSessionsOpen(true);
          break;
        case "bookmarks":
          setBookmarksOpen(true);
          break;
        case "tools":
          setToolsOpen(true);
          break;
        case "templates":
          setTemplatesOpen(true);
          break;
        case "snippets":
          setSnippetsOpen(true);
          break;
        case "memory":
          setMemoryOpen(true);
          break;
        case "instructions":
          setInstructionsOpen(true);
          break;
        case "history":
          setHistoryPanelOpen(true);
          break;
        case "scratchpad":
          setScratchpadOpen((v) => !v);
          break;
        case "analytics":
          setAnalyticsOpen(true);
          break;
        case "shortcuts":
          setShortcutsOpen(true);
          break;
        case "search":
          setHistoryOpen(true);
          break;
      }
    };
    const slashHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ command: string }>).detail;
      if (detail?.command) {
        setInput(`/${detail.command} `);
        inputRef.current?.focus();
      }
    };
    const actionHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ action: string }>).detail;
      switch (detail?.action) {
        case "clear":
          clearHistory();
          setCurrentSessionId(null);
          toast.success("Chat cleared");
          break;
        case "abort":
          abort();
          break;
      }
    };
    window.addEventListener("codechat-palette-open", openHandler);
    window.addEventListener("codechat-palette-slash", slashHandler);
    window.addEventListener("codechat-palette-action", actionHandler);
    return () => {
      window.removeEventListener("codechat-palette-open", openHandler);
      window.removeEventListener("codechat-palette-slash", slashHandler);
      window.removeEventListener("codechat-palette-action", actionHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const handleScratchpadInsert = useCallback((text: string) => {
    setInput((prev) => {
      if (!prev) return text;
      // Append with a separating newline so the user's in-progress
      // draft isn't clobbered
      return prev.endsWith("\n") || prev.endsWith(" ") ? `${prev}${text}` : `${prev}\n${text}`;
    });
    inputRef.current?.focus();
  }, []);

  // Listen for manual edits broadcast from the FileBrowser component
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{
        path: string;
        before: string;
        after: string;
        kind: "write" | "edit";
        origin: "agent" | "manual";
      }>).detail;
      if (!detail?.path) return;
      setEditHistory((prev) =>
        recordEdit(prev, {
          path: detail.path,
          before: detail.before,
          after: detail.after,
          kind: detail.kind,
          origin: detail.origin,
        }),
      );
    };
    window.addEventListener("codechat-edit-recorded", handler);
    return () => window.removeEventListener("codechat-edit-recorded", handler);
  }, []);

  // Watch for newly-completed assistant messages with edit/write tool
  // events that carry before/after snapshots (Pass 205 added these)
  // and record them in the edit history.
  const recordedMsgIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (isExecuting) return;
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      if (recordedMsgIdsRef.current.has(msg.id)) continue;
      if (!msg.toolEvents || msg.toolEvents.length === 0) {
        recordedMsgIdsRef.current.add(msg.id);
        continue;
      }
      const toRecord: Array<{ path: string; before: string; after: string; kind: "write" | "edit" }> = [];
      for (const ev of msg.toolEvents) {
        if (ev.toolName !== "edit_file" && ev.toolName !== "write_file") continue;
        if (typeof ev.preview !== "string") continue;
        try {
          const parsed = JSON.parse(ev.preview);
          const inner = parsed?.result;
          if (!inner || typeof inner.before !== "string" || typeof inner.after !== "string") continue;
          if (typeof inner.path !== "string") continue;
          toRecord.push({
            path: inner.path,
            before: inner.before,
            after: inner.after,
            kind: ev.toolName === "edit_file" ? "edit" : "write",
          });
        } catch { /* skip */ }
      }
      if (toRecord.length > 0) {
        setEditHistory((prev) => {
          let next = prev;
          for (const e of toRecord) {
            next = recordEdit(next, { ...e, origin: "agent" });
          }
          return next;
        });
      }
      recordedMsgIdsRef.current.add(msg.id);
    }
  }, [messages, isExecuting]);

  const handleUndoEdit = useCallback(async () => {
    const result = undoEdit(editHistory);
    if (!result) {
      toast.info("Nothing to undo");
      return;
    }
    try {
      await dispatchMutation.mutateAsync({
        call: { name: "write_file", args: { path: result.entry.path, content: result.entry.before } },
        allowMutations: true,
        confirmDangerous: true,
      });
      setEditHistory(result.state);
      toast.success(`Reverted ${result.entry.path}`);
    } catch (err: any) {
      toast.error(`Undo failed: ${err.message ?? err}`);
    }
  }, [editHistory, dispatchMutation]);

  const handleRedoEdit = useCallback(async () => {
    const result = redoEdit(editHistory);
    if (!result) {
      toast.info("Nothing to redo");
      return;
    }
    try {
      await dispatchMutation.mutateAsync({
        call: { name: "write_file", args: { path: result.entry.path, content: result.entry.after } },
        allowMutations: true,
        confirmDangerous: true,
      });
      setEditHistory(result.state);
      toast.success(`Re-applied ${result.entry.path}`);
    } catch (err: any) {
      toast.error(`Redo failed: ${err.message ?? err}`);
    }
  }, [editHistory, dispatchMutation]);

  const handleRevertToBefore = useCallback(async (entry: EditHistoryEntry) => {
    try {
      await dispatchMutation.mutateAsync({
        call: { name: "write_file", args: { path: entry.path, content: entry.before } },
        allowMutations: true,
        confirmDangerous: true,
      });
      toast.success(`Reverted ${entry.path} to before this edit`);
    } catch (err: any) {
      toast.error(`Revert failed: ${err.message ?? err}`);
    }
  }, [dispatchMutation]);

  // Pass 212: saved sessions library
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  // Pass 213: per-tool permissions
  const [toolsOpen, setToolsOpen] = useState(false);
  const [enabledTools, setEnabledTools] = useState<string[]>(
    DEFAULT_ENABLED_TOOLS,
  );

  // Pass 214: prompt template library
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [snippetsOpen, setSnippetsOpen] = useState(false);

  // Pass 216: Ctrl+R command history search
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pass 224: pinned working set of files
  const [pinned, setPinned] = useState<string[]>(() => loadPinned());
  useEffect(() => {
    savePinned(pinned);
  }, [pinned]);

  // Pass 233: message bookmarks
  const [bookmarks, setBookmarks] = useState<string[]>(() => loadBookmarks());
  useEffect(() => { saveBookmarks(bookmarks); }, [bookmarks]);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const scrollToMessage = useCallback((messageId: string) => {
    const el = scrollRef.current?.querySelector(
      `[data-message-id="${CSS.escape(messageId)}"]`,
    );
    if (el && "scrollIntoView" in el) {
      (el as HTMLElement).scrollIntoView({ behavior: "smooth", block: "center" });
      // Briefly highlight
      const prevBg = (el as HTMLElement).style.backgroundColor;
      (el as HTMLElement).style.transition = "background-color 0.3s";
      (el as HTMLElement).style.backgroundColor = "rgba(212,168,67,0.15)";
      setTimeout(() => {
        (el as HTMLElement).style.backgroundColor = prevBg;
      }, 1500);
    }
  }, []);

  // Pass 234: message outline rail toggle
  const [outlineOpen, setOutlineOpen] = useState(false);

  // Pass 235: message reactions (thumbs up/down)
  const [reactions, setReactions] = useState<ReactionMap>(() => loadReactions());
  useEffect(() => { saveReactions(reactions); }, [reactions]);

  // Pass 236: Plan Mode — per-assistant-message plan state, persisted
  // across refreshes via localStorage. When the user runs `/plan <task>`
  // the response gets auto-parsed into a structured Plan and rendered
  // inline via PlanReviewPanel, where they can edit/reorder/approve.
  const PLANS_KEY = "stewardly-codechat-plans";
  const [plans, setPlans] = useState<Record<string, Plan>>(() => {
    try {
      const raw = localStorage.getItem(PLANS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, PlanSnapshot>;
      const out: Record<string, Plan> = {};
      for (const [k, v] of Object.entries(parsed)) {
        try {
          out[k] = restorePlan(v);
        } catch { /* skip malformed */ }
      }
      return out;
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      const snapshots: Record<string, PlanSnapshot> = {};
      for (const [k, v] of Object.entries(plans)) {
        snapshots[k] = snapshotPlan(v);
      }
      localStorage.setItem(PLANS_KEY, JSON.stringify(snapshots));
    } catch { /* quota */ }
  }, [plans]);
  const [planExpecting, setPlanExpecting] = useState(false);

  // Auto-parse any new assistant response into a Plan when we're
  // expecting one (the user just ran /plan <task>). Only attaches when
  // the response actually parses into a multi-step plan.
  useEffect(() => {
    if (!planExpecting) return;
    // Look at the last assistant message
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      if (plans[m.id]) return; // already have a plan for this msg
      const parsed = parsePlanFromText(m.content);
      if (parsed && parsed.steps.length >= 2) {
        setPlans((prev) => ({ ...prev, [m.id]: parsed }));
        setPlanExpecting(false);
      }
      return;
    }
  }, [messages, planExpecting, plans]);
  const handleUnpin = useCallback((path: string) => {
    setPinned((prev) => removePinned(prev, path));
  }, []);
  // Listen for pin events from the FileBrowser (decoupled via window
  // event so FileBrowser stays a standalone component)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string }>).detail;
      if (detail?.path) {
        setPinned((prev) => addPinned(prev, detail.path));
      }
    };
    window.addEventListener("codechat-pin-file", handler);
    return () => window.removeEventListener("codechat-pin-file", handler);
  }, []);

  // Pass 219: gist export mutation
  const gistExportMutation = trpc.codeChat.exportToGist.useMutation();

  // Pass 222: cost budget guardrail — persists across refreshes
  const BUDGET_KEY = "stewardly-codechat-budget";
  const [budget, setBudget] = useState<BudgetState>(() => {
    try {
      const raw = localStorage.getItem(BUDGET_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed === "object" &&
          (parsed.limitUSD === null || typeof parsed.limitUSD === "number") &&
          typeof parsed.warnAt === "number"
        ) {
          return parsed as BudgetState;
        }
      }
    } catch { /* fall through */ }
    return DEFAULT_BUDGET_STATE;
  });
  useEffect(() => {
    try {
      localStorage.setItem(BUDGET_KEY, JSON.stringify(budget));
    } catch { /* quota */ }
  }, [budget]);

  // Pass 236: execute an approved plan by sending the built execution
  // prompt through the ReAct loop
  const handleExecutePlan = useCallback(
    async (plan: Plan) => {
      const prompt = buildExecutionPrompt(plan);
      const admin = user?.role === "admin";
      toast.success(`Executing ${plan.steps.length}-step plan…`);
      await sendMessage(prompt, {
        allowMutations: admin && allowMutations,
        maxIterations: Math.max(maxIterations, plan.steps.length),
        model: modelOverride,
        enabledTools,
        includeProjectInstructions: projectInstructionsOn,
        memoryOverlay,
      });
    },
    [sendMessage, user, allowMutations, maxIterations, modelOverride, enabledTools, projectInstructionsOn, memoryOverlay],
  );

  // Pass 220: fork conversation at a specific message
  const handleForkAt = useCallback(
    (forkMessageId: string) => {
      const truncated = forkMessagesAt(messages, forkMessageId);
      if (truncated.length === 0) {
        toast.error("Cannot fork an empty conversation");
        return;
      }
      const now = Date.now();
      const snapshot: SessionSnapshot = {
        id: crypto.randomUUID(),
        name: `Fork: ${autoName(truncated)}`.slice(0, 80),
        createdAt: now,
        updatedAt: now,
        messages: truncated,
      };
      const lib = upsertSession(loadLibrary(), snapshot);
      saveLibrary(lib);
      // Load the fork into the live hook — user continues from here
      loadMessages(truncated);
      setCurrentSessionId(snapshot.id);
      toast.success(
        `Forked into "${snapshot.name}" (${truncated.length} messages)`,
      );
    },
    [messages, loadMessages],
  );

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

  // Pass 222: evaluate budget against current session total
  const budgetEval = useMemo(
    () => evaluateBudget(sessionUsage.costUSD, budget),
    [sessionUsage.costUSD, budget],
  );

  // Pass 230: evaluate context window usage vs the active model's limit.
  // Resolves the model from the user's override (if set) or the most
  // recent assistant message (what the server actually routed to).
  const activeModel = useMemo(() => {
    if (modelOverride) return modelOverride;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "assistant" && m.model) return m.model;
    }
    return undefined;
  }, [modelOverride, messages]);
  const contextEval = useMemo(
    () => evaluateContextWindow(sessionUsage.totalTokens, activeModel),
    [sessionUsage.totalTokens, activeModel],
  );

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages.slice(-50))); } catch { /* quota */ }
    }
  }, [messages]);

  // Pass 223: silent auto-checkpoint — persist the current conversation
  // to the sessions library every 4 new messages once there's an
  // assistant reply. Survives refresh + crash without manual saving.
  const checkpointStateRef = useRef({
    lastSavedCount: 0,
    sessionId: "" as string,
  });
  useEffect(() => {
    if (messages.length === 0) {
      // New conversation or cleared — reset checkpoint state so the
      // next session starts fresh
      checkpointStateRef.current = { lastSavedCount: 0, sessionId: "" };
      return;
    }
    if (isExecuting) return; // wait for the turn to finish
    if (!shouldCheckpoint(messages, checkpointStateRef.current, 4)) return;

    const now = Date.now();
    // Reuse the currently-loaded session id if there is one (so
    // saved sessions stay attached to their existing row). Otherwise
    // allocate a stable auto-id that persists across checkpoint
    // saves so we don't spam the library with new rows.
    let id = currentSessionId ?? checkpointStateRef.current.sessionId;
    if (!id) {
      id = `auto-${crypto.randomUUID()}`;
      checkpointStateRef.current.sessionId = id;
      setCurrentSessionId(id);
    }
    const lib = loadLibrary();
    const existing = lib.sessions.find((s) => s.id === id);
    const name = existing?.name ?? `Auto: ${autoName(messages)}`;
    const snapshot: SessionSnapshot = {
      id,
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages,
    };
    saveLibrary(upsertSession(lib, snapshot));
    checkpointStateRef.current.lastSavedCount = messages.length;
  }, [messages, isExecuting, currentSessionId]);

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
  // Pass 216: Ctrl+R (or Cmd+R) opens the command history reverse-
  // search from anywhere in the Code Chat UI.
  // Pass 239: Ctrl+Z / Ctrl+Shift+Z for edit undo/redo (only when not
  // in a textarea so the native undo-in-input still works).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextField =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      // Ctrl+R / Cmd+R → reverse-search — works even from the textarea
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
        e.preventDefault();
        setHistoryOpen(true);
        return;
      }
      // Pass 242: Ctrl+T / Cmd+T → symbol navigator
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "t") {
        e.preventDefault();
        setSymbolNavOpen(true);
        return;
      }
      // Ctrl+Z / Ctrl+Shift+Z → edit undo/redo
      // Only fire outside text fields so in-textarea undo still works
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !isTextField) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedoEdit();
        } else {
          handleUndoEdit();
        }
        return;
      }
      if (e.key === "?" && !input) {
        if (!isTextField) {
          e.preventDefault();
          setShortcutsOpen(true);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [input, handleUndoEdit, handleRedoEdit]);

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
        clear: () => { clearHistory(); setCurrentSessionId(null); },
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
          if ("compact" in result && result.compact) {
            // Pass 232: /compact — collapse older turns into a summary
            const keep = typeof result.keepRecent === "number" ? result.keepRecent : 4;
            const compacted = compactConversation(messages, keep);
            if (compacted.compacted) {
              loadMessages(compacted.messages);
              toast.success(
                `Compacted ${compacted.collapsed} older message${compacted.collapsed === 1 ? "" : "s"} into a summary`,
              );
            } else {
              toast.info("Nothing to compact yet");
            }
            setInput("");
            return;
          }
          if ("rewrite" in result && result.rewrite) {
            // Pass 236: if this is a /plan or /p command, set the
            // "expecting a plan" flag so the next assistant response
            // gets parsed into an interactive PlanReviewPanel instead
            // of just a plain markdown reply.
            if (text.toLowerCase().startsWith("/plan") || text.toLowerCase().startsWith("/p ")) {
              setPlanExpecting(true);
            }
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

    // Pass 222: hard-block if the session cost has hit the budget
    if (budgetEval.status === "blocked") {
      toast.error(
        `Session cost budget exceeded (${formatCost(sessionUsage.costUSD)} / ${formatCost(budget.limitUSD)}). Raise the limit or start a new session.`,
      );
      return;
    }

    // Save to command history
    const newHistory = [text, ...commandHistory.filter(h => h !== text)].slice(0, 50);
    setCommandHistory(newHistory);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory)); } catch { /* quota */ }
    setHistoryIndex(-1);
    setInput("");
    setLastErrorBanner(null); // Pass 211: clear previous error on new send
    // Pass 224: inject pinned files as @-mentions so the server-side
    // expander picks them up as auto-context
    const messageWithPinned = applyPinnedToMessage(pinned, text);
    await sendMessage(messageWithPinned, {
      allowMutations: isAdmin && allowMutations,
      maxIterations,
      model: modelOverride,
      enabledTools,
      includeProjectInstructions: projectInstructionsOn,
      memoryOverlay,
    });
    inputRef.current?.focus();
  }, [input, isExecuting, sendMessage, allowMutations, maxIterations, isAdmin, commandHistory, clearHistory, abort, modelOverride, enabledTools, budgetEval, sessionUsage.costUSD, budget.limitUSD, pinned, messages, loadMessages, projectInstructionsOn, memoryOverlay]);

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
          <button
            type="button"
            onClick={() => {
              const current = budget.limitUSD === null ? "" : String(budget.limitUSD);
              const next = prompt(
                `Session budget (USD). Empty = no limit. Current: ${current || "no limit"}`,
                current,
              );
              if (next === null) return;
              const trimmed = next.trim();
              if (!trimmed) {
                setBudget({ ...budget, limitUSD: null });
                toast.success("Budget cleared");
                return;
              }
              const parsed = parseFloat(trimmed);
              if (!Number.isFinite(parsed) || parsed < 0) {
                toast.error("Enter a non-negative number or leave empty");
                return;
              }
              setBudget({ ...budget, limitUSD: parsed });
              toast.success(`Budget set to $${parsed.toFixed(2)}`);
            }}
            className={`hidden md:flex items-center gap-1 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded transition-colors ${
              budgetEval.status === "blocked"
                ? "text-destructive bg-destructive/10 hover:bg-destructive/20"
                : budgetEval.status === "warning"
                  ? "text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                  : "text-muted-foreground hover:text-foreground"
            }`}
            title={
              budget.limitUSD === null
                ? `${sessionUsage.inputTokens} in / ${sessionUsage.outputTokens} out — click to set a budget`
                : `${formatCost(sessionUsage.costUSD)} of ${formatCost(budget.limitUSD)} used · ${Math.round(budgetEval.pct * 100)}%`
            }
            aria-label="Session token usage and cost budget"
          >
            <span>{formatTokens(sessionUsage.totalTokens)}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{formatCost(sessionUsage.costUSD)}</span>
            {budget.limitUSD !== null && (
              <span className="text-muted-foreground/60">
                /{formatCost(budget.limitUSD)}
              </span>
            )}
          </button>
        )}
        {/* Pass 230: context window usage meter */}
        {messages.length > 0 && (
          <div
            className={`hidden md:flex items-center gap-1 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
              contextEval.status === "critical"
                ? "text-destructive bg-destructive/10"
                : contextEval.status === "warning"
                  ? "text-amber-500 bg-amber-500/10"
                  : "text-muted-foreground"
            }`}
            title={
              contextEval.modelKnown
                ? `${formatContextSize(contextEval.used)} of ${formatContextSize(contextEval.limit)} context window — ${Math.round(contextEval.pct * 100)}%`
                : `${formatContextSize(contextEval.used)} of ${formatContextSize(contextEval.limit)} (default — unknown model ${activeModel ?? ""})`
            }
            aria-label="Context window usage"
          >
            <span>ctx</span>
            <span>{Math.round(contextEval.pct * 100)}%</span>
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
          onClick={() => setTemplatesOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Prompt templates"
          title="Prompt templates"
        >
          <LibraryBig className="w-3 h-3" /> Templates
        </button>
        <button
          onClick={() => setSnippetsOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Code snippets"
          title="Code snippets library"
        >
          <Code2 className="w-3 h-3" /> Snippets
        </button>
        <button
          onClick={() => setToolsOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Tool permissions"
          title={`Tool permissions (${enabledTools.length}/8 enabled)`}
        >
          <ShieldCheck className="w-3 h-3" /> {enabledTools.length}/8
        </button>
        {(() => {
          const s = summarizeHistory(editHistory);
          if (s.total === 0) return null;
          return (
            <button
              onClick={() => setHistoryPanelOpen(true)}
              className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Edit history"
              title={`Edit history (${s.undoCount}/${s.total} applied, ⌃Z undo, ⌃⇧Z redo)`}
            >
              <History className="w-3 h-3" /> {s.undoCount}/{s.total}
            </button>
          );
        })()}
        <button
          onClick={() => setSymbolNavOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Symbol navigator"
          title="Symbol navigator (⌘T / Ctrl+T) — jump to function/class/type definition"
        >
          <Sparkles className="w-3 h-3" /> Symbols
        </button>
        {messages.length > 0 && (
          <button
            onClick={() => setAnalyticsOpen(true)}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Session analytics"
            title="Session analytics — cost, model, tool, and I/O breakdown"
          >
            <BarChart3 className="w-3 h-3" /> Stats
          </button>
        )}
        <button
          onClick={() => setMemoryOpen(true)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
            memoryEntries.length > 0
              ? "border-accent/40 bg-accent/5 text-accent"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Agent memory"
          title={
            memoryEntries.length > 0
              ? `${memoryEntries.length} memories injected into every prompt`
              : "Agent memory (empty)"
          }
        >
          <Brain className="w-3 h-3" /> {memoryEntries.length > 0 ? memoryEntries.length : "Mem"}
        </button>
        <button
          onClick={() => setInstructionsOpen(true)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
            projectInstructionsOn && loadedInstructionFiles.length > 0
              ? "border-accent/40 bg-accent/5 text-accent"
              : projectInstructionsOn
                ? "border-border text-muted-foreground hover:text-foreground"
                : "border-border/40 text-muted-foreground/60 line-through"
          }`}
          aria-label="Project instructions"
          title={
            projectInstructionsOn
              ? loadedInstructionFiles.length > 0
                ? `Project instructions loaded: ${loadedInstructionFiles.join(", ")}`
                : "Project instructions (no files found)"
              : "Project instructions disabled for this session"
          }
        >
          <BookOpen className="w-3 h-3" />
          {projectInstructionsOn && loadedInstructionFiles.length > 0
            ? loadedInstructionFiles.length
            : "Rules"}
        </button>
        <button
          onClick={() => setSessionsOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Saved sessions"
          title="Saved sessions"
        >
          <BookMarked className="w-3 h-3" /> Sessions
        </button>
        <button
          onClick={() => setBookmarksOpen(true)}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Bookmarks"
          title={`Bookmarks (${bookmarks.filter((id) => messages.some((m) => m.id === id)).length} in this session)`}
        >
          <Star className="w-3 h-3" /> {bookmarks.filter((id) => messages.some((m) => m.id === id)).length}
        </button>
        <button
          onClick={() => setOutlineOpen((v) => !v)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
            outlineOpen
              ? "bg-accent/10 border-accent/30 text-accent"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Toggle outline"
          title="Message outline (Pass 234)"
        >
          <List className="w-3 h-3" /> Outline
        </button>
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
          title="Export conversation as markdown file"
        >
          <Download className="w-3 h-3" /> Export
        </button>
        <button
          onClick={async () => {
            if (messages.length === 0) {
              toast.info("Nothing to export yet");
              return;
            }
            const content = exportConversationAsMarkdown(messages);
            const description =
              messages[0]?.role === "user"
                ? `Code Chat: ${messages[0].content.slice(0, 200)}`
                : `Code Chat transcript (${messages.length} messages)`;
            const toastId = toast.loading("Publishing to Gist…");
            try {
              const result = await gistExportMutation.mutateAsync({
                description,
                content,
                public: false,
                filename: `code-chat-${new Date().toISOString().slice(0, 10)}.md`,
              });
              toast.dismiss(toastId);
              if (result.ok) {
                toast.success(
                  <span>
                    Gist created.{" "}
                    <a
                      href={result.gist.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Open
                    </a>
                  </span>,
                );
                try {
                  await navigator.clipboard.writeText(result.gist.url);
                } catch { /* clipboard optional */ }
              } else {
                toast.error(`Gist failed: ${result.error}`);
              }
            } catch (err: any) {
              toast.dismiss(toastId);
              toast.error(`Gist failed: ${err.message ?? err}`);
            }
          }}
          className="hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Publish conversation as GitHub Gist"
          title="Publish conversation as a secret GitHub Gist (uses your connected GitHub)"
        >
          <Github className="w-3 h-3" /> Gist
        </button>
        <button
          onClick={() => setScratchpadOpen((v) => !v)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${
            scratchpadOpen
              ? "bg-accent/10 border-accent/30 text-accent"
              : scratchpad.content
                ? "border-accent/30 text-accent/80"
                : "border-border text-muted-foreground hover:text-foreground"
          }`}
          aria-label="Toggle scratchpad"
          title={
            scratchpad.content
              ? `Scratchpad (${scratchpad.content.length.toLocaleString()} chars)`
              : "Scratchpad (empty)"
          }
        >
          <StickyNote className="w-3 h-3" /> Notes
        </button>
        <button
          onClick={() => setShowFiles(!showFiles)}
          className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-[10px] border transition-colors ${showFiles ? "bg-accent/10 border-accent/30 text-accent" : "border-border text-muted-foreground hover:text-foreground"}`}
          aria-label="Toggle file panel"
        >
          <FolderOpen className="w-3 h-3" /> Files
        </button>
      </div>

      {/* Split layout: chat + optional file panel + optional outline rail */}
      <div className="flex flex-1 min-h-0">
      {/* Pass 234: outline rail (user prompts only, click to scroll) */}
      {outlineOpen && (
        <div className="hidden md:flex flex-col w-60 border-r border-border/40 overflow-y-auto bg-card/20">
          <div className="p-3 border-b border-border/40 flex items-center justify-between text-xs font-medium">
            <span className="flex items-center gap-1.5">
              <List className="w-3.5 h-3.5" /> Outline
            </span>
            <button
              onClick={() => setOutlineOpen(false)}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Close outline"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {messages.filter((m) => m.role === "user").length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic p-3">
                No prompts yet.
              </p>
            ) : (
              <ol className="divide-y divide-border/20">
                {messages.map((msg, idx) => {
                  if (msg.role !== "user") return null;
                  const preview = msg.content.split("\n")[0].slice(0, 80);
                  const turnNumber =
                    messages.slice(0, idx + 1).filter((m) => m.role === "user")
                      .length;
                  return (
                    <li key={msg.id}>
                      <button
                        type="button"
                        onClick={() => scrollToMessage(msg.id)}
                        className="w-full text-left px-3 py-2 hover:bg-secondary/30 transition-colors"
                      >
                        <div className="text-[9px] uppercase tracking-wide text-muted-foreground/60 font-mono">
                          turn {turnNumber}
                        </div>
                        <div className="text-[11px] text-foreground truncate">
                          {preview}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      )}
      {/* Chat column */}
      <div className={`flex flex-col ${showFiles ? "flex-1 min-w-0" : "flex-1"}`}>
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
          <div
            key={msg.id}
            data-message-id={msg.id}
            className={`${msg.role === "user" ? "flex justify-end" : "group"}`}
          >
            {msg.role === "user" ? (
              <div className="bg-accent/10 text-foreground px-4 py-2.5 rounded-2xl rounded-br-md max-w-[85%] text-sm">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2 max-w-full">
                {/* Pass 237: captured agent todo list */}
                {msg.agentTodos && msg.agentTodos.length > 0 && (
                  <AgentTodoPanel todos={msg.agentTodos} variant="card" />
                )}
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
                {/* Pass 236: inline Plan review panel */}
                {plans[msg.id] && (
                  <PlanReviewPanel
                    plan={plans[msg.id]}
                    onChange={(next) =>
                      setPlans((prev) => ({ ...prev, [msg.id]: next }))
                    }
                    onApprove={(approved) => {
                      // Fire-and-forget; handleExecutePlan handles toasts
                      handleExecutePlan(approved);
                    }}
                    onReject={() => {
                      toast.info("Plan rejected");
                    }}
                  />
                )}
                {/* Pass 217: tool-call summary chips */}
                {(() => {
                  const summary = summarizeToolEvents(msg.toolEvents);
                  const chips = summaryChips(summary);
                  if (chips.length === 0) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {chips.map((c) => (
                        <span
                          key={c.key}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono tabular-nums ${
                            c.variant === "error"
                              ? "border-destructive/50 text-destructive bg-destructive/5"
                              : c.variant === "warn"
                                ? "border-amber-500/40 text-amber-500 bg-amber-500/5"
                                : "border-border/60 text-muted-foreground bg-muted/10"
                          }`}
                        >
                          {c.label} {c.count}
                        </span>
                      ))}
                      {summary.filesTouched.length > 0 && (
                        <span
                          className="text-[9px] text-muted-foreground/60 font-mono truncate"
                          title={summary.filesTouched.join("\n")}
                        >
                          {summary.filesTouched.length === 1
                            ? summary.filesTouched[0]
                            : `${summary.filesTouched.length} files`}
                        </span>
                      )}
                    </div>
                  );
                })()}
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
                    <button
                      type="button"
                      className="hover:text-foreground transition-colors p-1 rounded"
                      aria-label="Fork conversation from this message"
                      title="Fork — save as new session trimmed here"
                      onClick={() => handleForkAt(msg.id)}
                    >
                      <GitFork className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className={`transition-colors p-1 rounded ${
                        isBookmarked(bookmarks, msg.id)
                          ? "text-amber-400"
                          : "hover:text-foreground"
                      }`}
                      aria-label={
                        isBookmarked(bookmarks, msg.id)
                          ? "Remove bookmark"
                          : "Bookmark this message"
                      }
                      title="Bookmark"
                      onClick={() =>
                        setBookmarks((prev) => toggleBookmarkPure(prev, msg.id))
                      }
                    >
                      <Star
                        className="w-3 h-3"
                        fill={
                          isBookmarked(bookmarks, msg.id) ? "currentColor" : "none"
                        }
                      />
                    </button>
                    <button
                      type="button"
                      className={`transition-colors p-1 rounded ${
                        getReaction(reactions, msg.id) === "up"
                          ? "text-emerald-500"
                          : "hover:text-foreground"
                      }`}
                      aria-label="Thumbs up"
                      onClick={() =>
                        setReactions((prev) => setReactionPure(prev, msg.id, "up"))
                      }
                    >
                      <ThumbsUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      className={`transition-colors p-1 rounded ${
                        getReaction(reactions, msg.id) === "down"
                          ? "text-destructive"
                          : "hover:text-foreground"
                      }`}
                      aria-label="Thumbs down"
                      onClick={() =>
                        setReactions((prev) => setReactionPure(prev, msg.id, "down"))
                      }
                    >
                      <ThumbsDown className="w-3 h-3" />
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
                            enabledTools,
                            includeProjectInstructions: projectInstructionsOn,
                            memoryOverlay,
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

        {/* Pass 237: live agent todo summary while executing */}
        {isExecuting && currentTodos.length > 0 && (
          <AgentTodoPanel todos={currentTodos} variant="live" />
        )}

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
                  enabledTools,
                  includeProjectInstructions: projectInstructionsOn,
                  memoryOverlay,
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

      {/* Pass 224: pinned files working set */}
      {pinned.length > 0 && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-border/30 bg-muted/10 text-[10px]">
          <span className="text-muted-foreground font-mono shrink-0">
            Pinned ({pinned.length}):
          </span>
          <div className="flex flex-wrap gap-1 min-w-0 flex-1">
            {pinned.map((path) => (
              <span
                key={path}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-accent/40 bg-accent/5 text-accent font-mono max-w-[200px]"
                title={path}
              >
                <span className="truncate">{path}</span>
                <button
                  type="button"
                  onClick={() => handleUnpin(path)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label={`Unpin ${path}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
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
      {/* Pass 240: scratchpad drawer */}
      <ScratchpadPanel
        open={scratchpadOpen}
        onClose={() => setScratchpadOpen(false)}
        state={scratchpad}
        onChange={setScratchpad}
        onInsertIntoPrompt={handleScratchpadInsert}
      />
      </div>{/* end split layout */}
      <KeyboardShortcutsOverlay
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <SessionsLibraryPopover
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        currentMessages={messages}
        currentSessionId={currentSessionId}
        onLoadSession={(snap) => {
          loadMessages(snap.messages);
          setCurrentSessionId(snap.id);
          setSessionsOpen(false);
        }}
        onSaved={(id) => setCurrentSessionId(id)}
      />
      <ToolPermissionsPopover
        open={toolsOpen}
        onClose={() => setToolsOpen(false)}
        enabled={enabledTools}
        onChange={setEnabledTools}
        canMutate={isAdmin && allowMutations}
      />
      <PromptTemplatesPopover
        open={templatesOpen}
        onClose={() => setTemplatesOpen(false)}
        currentInput={input}
        onInsert={(body) => {
          setInput(body);
          inputRef.current?.focus();
        }}
      />
      <CodeSnippetsPopover
        open={snippetsOpen}
        onClose={() => setSnippetsOpen(false)}
        onInsert={(markdown) => {
          setInput((prev) => {
            const base = prev ?? "";
            if (!base) return markdown;
            if (base.endsWith("\n\n")) return base + markdown;
            if (base.endsWith("\n")) return base + "\n" + markdown;
            return base + "\n\n" + markdown;
          });
          inputRef.current?.focus();
        }}
      />
      <CommandHistorySearchPopover
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={commandHistory}
        onSelect={(entry) => {
          setInput(entry);
          setHistoryOpen(false);
          inputRef.current?.focus();
        }}
      />
      <ProjectInstructionsPopover
        open={instructionsOpen}
        onClose={() => setInstructionsOpen(false)}
        enabled={projectInstructionsOn}
        onToggle={setProjectInstructionsOn}
      />
      <EditHistoryPopover
        open={historyPanelOpen}
        onClose={() => setHistoryPanelOpen(false)}
        state={editHistory}
        onUndo={handleUndoEdit}
        onRedo={handleRedoEdit}
        onRevert={handleRevertToBefore}
        onDrop={(id) => setEditHistory((prev) => dropEntry(prev, id))}
        onClear={() => setEditHistory(clearEditHistory())}
      />
      <AgentMemoryPopover
        open={memoryOpen}
        onClose={() => setMemoryOpen(false)}
        entries={memoryEntries}
        onChange={setMemoryEntries}
      />
      <SymbolNavigatorPopover
        open={symbolNavOpen}
        onClose={() => setSymbolNavOpen(false)}
      />
      <SessionAnalyticsPopover
        open={analyticsOpen}
        onClose={() => setAnalyticsOpen(false)}
        messages={messages}
        onJumpToMessage={scrollToMessage}
      />
      {/* Pass 233: bookmarks popover */}
      {bookmarksOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={() => setBookmarksOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Bookmarks"
        >
          <div
            className="relative w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBookmarksOpen(false)}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
              aria-label="Close bookmarks"
            >
              <X className="h-4 w-4" />
            </button>
            <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-400" /> Bookmarks
            </h2>
            <p className="text-[11px] text-muted-foreground mb-4">
              Messages you starred in this session. Click to scroll to
              them. Bookmarks persist across sessions in localStorage.
            </p>
            {(() => {
              const inSession = messages.filter((m) => bookmarks.includes(m.id));
              if (inSession.length === 0) {
                return (
                  <p className="text-xs text-muted-foreground italic text-center py-4">
                    No bookmarked messages in this session.
                  </p>
                );
              }
              return (
                <ul className="space-y-1.5">
                  {inSession.map((msg) => {
                    const preview = msg.content.split("\n")[0].slice(0, 140);
                    return (
                      <li key={msg.id}>
                        <button
                          type="button"
                          className="w-full flex items-start gap-2 px-3 py-2 rounded border border-border/40 hover:bg-secondary/20 transition-colors text-left"
                          onClick={() => {
                            scrollToMessage(msg.id);
                            setBookmarksOpen(false);
                          }}
                        >
                          <Star className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" fill="currentColor" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              {msg.role}
                            </div>
                            <div className="text-[11px] text-foreground truncate">
                              {preview}
                              {msg.content.length > 140 ? "…" : ""}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookmarks((prev) => toggleBookmarkPure(prev, msg.id));
                            }}
                            aria-label={`Unbookmark ${msg.role} message`}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export default function CodeChatPage() {
  const [activeTab, setActiveTab] = useState("chat");
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Pass 248: ⌘K / Ctrl+K opens the action palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Pass 248: dispatch an action by id
  const handlePaletteRun = (actionId: string) => {
    if (actionId.startsWith("tab:")) {
      const tab = actionId.slice(4);
      setActiveTab(tab);
      return;
    }
    if (actionId.startsWith("open:")) {
      // Forward to inner components via window event
      window.dispatchEvent(
        new CustomEvent("codechat-palette-open", {
          detail: { target: actionId.slice(5) },
        }),
      );
      return;
    }
    if (actionId.startsWith("slash:")) {
      window.dispatchEvent(
        new CustomEvent("codechat-palette-slash", {
          detail: { command: actionId.slice(6) },
        }),
      );
      return;
    }
    if (actionId.startsWith("workspace:")) {
      window.dispatchEvent(
        new CustomEvent("codechat-palette-action", {
          detail: { action: actionId.slice(10) },
        }),
      );
      return;
    }
  };

  // Pass 225 / 227: cross-component tab navigation via window events.
  // Grep quick-jump dispatches `codechat-open-file` which switches to
  // the Files tab and the FileBrowser (which re-mounts on tab switch)
  // reads the pending open target from localStorage.
  // Keyboard chord shortcuts (Pass 227) use `codechat-go-tab`.
  useEffect(() => {
    const openHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ path: string; line?: number }>).detail;
      if (detail?.path) {
        try {
          localStorage.setItem(
            "stewardly-codechat-pending-open",
            JSON.stringify({ path: detail.path, line: detail.line ?? null }),
          );
        } catch { /* quota */ }
        setActiveTab("files");
      }
    };
    const goTabHandler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab: string }>).detail;
      if (detail?.tab) setActiveTab(detail.tab);
    };
    window.addEventListener("codechat-open-file", openHandler);
    window.addEventListener("codechat-go-tab", goTabHandler);
    return () => {
      window.removeEventListener("codechat-open-file", openHandler);
      window.removeEventListener("codechat-go-tab", goTabHandler);
    };
  }, []);

  // Pass 227: keyboard chord shortcuts (g c / g f / g r / g d / g h / g w / g j)
  const chordStateRef = useRef(emptyChordState());
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore when typing inside an editable field — the user might
      // be pressing `g` as part of their prose
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      // Only alphanumeric single-key presses (no modifiers)
      if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
      const result = stepChord(chordStateRef.current, e.key, Date.now());
      if (result.kind === "pending") {
        chordStateRef.current = result.next;
      } else if (result.kind === "match") {
        e.preventDefault();
        chordStateRef.current = result.next;
        setActiveTab(result.match.tab);
        toast.info(`→ ${result.match.label}`);
      } else if (result.kind === "reset") {
        chordStateRef.current = result.next;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AppShell title="Code Chat">
      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
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
              <TabsTrigger value="gitstatus" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Git Status
              </TabsTrigger>
              <TabsTrigger value="search" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Find
              </TabsTrigger>
              <TabsTrigger value="replace" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Replace
              </TabsTrigger>
              <TabsTrigger value="checkpoints" className="gap-1.5">
                <GitBranch className="h-3.5 w-3.5" /> Checkpoints
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" /> Problems
              </TabsTrigger>
              <TabsTrigger value="prdraft" className="gap-1.5">
                <Github className="h-3.5 w-3.5" /> PR Draft
              </TabsTrigger>
              <TabsTrigger value="tests" className="gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Tests
              </TabsTrigger>
              <TabsTrigger value="env" className="gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Env
              </TabsTrigger>
              <TabsTrigger value="imports" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Imports
              </TabsTrigger>
              <TabsTrigger value="todos" className="gap-1.5">
                <List className="h-3.5 w-3.5" /> TODOs
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

          <TabsContent value="gitstatus">
            <div className="p-6"><GitStatusPanel /></div>
          </TabsContent>

          <TabsContent value="search">
            <div className="p-6"><WorkspaceSearchPanel /></div>
          </TabsContent>

          <TabsContent value="replace">
            <div className="p-6"><FindReplacePanel /></div>
          </TabsContent>

          <TabsContent value="checkpoints">
            <div className="p-6"><CheckpointsPanel /></div>
          </TabsContent>

          <TabsContent value="diagnostics">
            <div className="p-6"><DiagnosticsPanel /></div>
          </TabsContent>

          <TabsContent value="prdraft">
            <div className="p-6"><PRDrafterPanel /></div>
          </TabsContent>

          <TabsContent value="tests">
            <div className="p-6"><TestRunnerPanel /></div>
          </TabsContent>

          <TabsContent value="env">
            <div className="p-6"><EnvInspectorPanel /></div>
          </TabsContent>

          <TabsContent value="imports">
            <div className="p-6"><ImportGraphPanel /></div>
          </TabsContent>

          <TabsContent value="todos">
            <div className="p-6"><TodoMarkerPanel /></div>
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
      <ActionPalettePopover
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onRun={handlePaletteRun}
      />
    </AppShell>
  );
}

// ─── File Browser ─────────────────────────────────────────────────────────

function FileBrowser() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [pathInput, setPathInput] = useState(".");
  const [viewMode, setViewMode] = useState<"list" | "tree">("list");
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

  // Pass 225: honor a pending-open target (grep quick-jump) on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("stewardly-codechat-pending-open");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { path?: string; line?: number | null };
      if (parsed?.path) {
        localStorage.removeItem("stewardly-codechat-pending-open");
        onRead(parsed.path);
        if (parsed.line) {
          toast.info(`Line ${parsed.line} in ${parsed.path}`);
        }
      }
    } catch { /* malformed */ }
    // Intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSave = async () => {
    if (!fileContent) return;
    setSaving(true);
    try {
      const before = fileContent.content;
      const result = await dispatch.mutateAsync({
        call: { name: "write_file", args: { path: fileContent.path, content: draft } },
        allowMutations: true,
        confirmDangerous: true,
      });
      if (result.kind === "write") {
        toast.success(
          `${result.result.created ? "Created" : "Saved"} ${result.result.path} (${result.result.byteLength}B)`,
        );
        // Pass 239: broadcast the manual edit so CodeChatInterface
        // captures it in the edit history ring buffer
        window.dispatchEvent(
          new CustomEvent("codechat-edit-recorded", {
            detail: {
              path: fileContent.path,
              before,
              after: draft,
              kind: "write",
              origin: "manual",
            },
          }),
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
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" /> Workspace
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={viewMode === "list" ? "default" : "outline"}
                onClick={() => setViewMode("list")}
                className="h-6 text-[10px]"
              >
                List
              </Button>
              <Button
                size="sm"
                variant={viewMode === "tree" ? "default" : "outline"}
                onClick={() => setViewMode("tree")}
                className="h-6 text-[10px]"
              >
                Tree
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {viewMode === "tree" ? (
            <FileTreePanel onFileClick={(path) => onRead(path)} />
          ) : (
            <>
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
            </>
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
            {fileContent && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("codechat-pin-file", {
                      detail: { path: fileContent.path },
                    }),
                  );
                  toast.success(`Pinned ${fileContent.path}`);
                }}
                className="h-7 text-[10px] shrink-0"
                title="Pin file to working set (auto-inject into every prompt)"
                aria-label="Pin file to working set"
              >
                <BookMarked className="h-3 w-3 mr-1" /> Pin
              </Button>
            )}
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
