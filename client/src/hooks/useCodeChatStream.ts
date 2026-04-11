/**
 * useCodeChatStream — SSE streaming hook for Code Chat
 *
 * Connects to POST /api/codechat/stream and processes real-time
 * tool execution events, providing live updates to the UI.
 */

import { useState, useCallback, useRef } from "react";
import {
  parseTodosPayload,
  mergeTodoList,
  type AgentTodoItem,
} from "@/components/codeChat/agentTodos";

export interface ToolEvent {
  stepIndex: number;
  toolName: string;
  args?: Record<string, unknown>;
  kind?: string;
  preview?: string;
  truncated?: boolean;
  durationMs?: number;
  status: "running" | "complete" | "error";
}

export interface CodeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolEvents?: ToolEvent[];
  /** Pass 237: final agent todo list snapshot captured at `done` time */
  agentTodos?: AgentTodoItem[];
  model?: string;
  iterations?: number;
  toolCallCount?: number;
  totalDurationMs?: number;
  timestamp: Date;
}

interface StreamConfig {
  model?: string;
  allowMutations?: boolean;
  maxIterations?: number;
  /** Pass 213: per-tool allowlist, e.g. ["read_file", "grep_search"] */
  enabledTools?: string[];
  /** Pass 238: auto-load CLAUDE.md and friends into the system prompt */
  includeProjectInstructions?: boolean;
}

export function useCodeChatStream() {
  const [messages, setMessages] = useState<CodeChatMessage[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentTools, setCurrentTools] = useState<ToolEvent[]>([]);
  /** Pass 237: live agent todo list, cleared at each new send */
  const [currentTodos, setCurrentTodos] = useState<AgentTodoItem[]>([]);
  /** Pass 238: files auto-loaded from CLAUDE.md / .stewardly / AGENTS.md */
  const [loadedInstructionFiles, setLoadedInstructionFiles] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (message: string, config: StreamConfig = {}) => {
    if (isExecuting) return;
    setIsExecuting(true);
    setError(null);
    setCurrentTools([]);
    setCurrentTodos([]);

    // Add user message
    const userMsg: CodeChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: message,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/codechat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          model: config.model,
          allowMutations: config.allowMutations ?? false,
          maxIterations: config.maxIterations ?? 5,
          enabledTools: config.enabledTools,
          includeProjectInstructions: config.includeProjectInstructions ?? true,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Stream failed" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      const toolEvents: ToolEvent[] = [];
      let agentTodos: AgentTodoItem[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));

            switch (event.type) {
              case "tool_start": {
                const te: ToolEvent = {
                  stepIndex: event.stepIndex,
                  toolName: event.toolName,
                  args: event.args,
                  status: "running",
                };
                toolEvents.push(te);
                setCurrentTools([...toolEvents]);
                break;
              }
              case "tool_result": {
                const existing = toolEvents.find(t => t.stepIndex === event.stepIndex);
                if (existing) {
                  existing.status = event.kind === "error" ? "error" : "complete";
                  existing.kind = event.kind;
                  existing.preview = event.preview;
                  existing.truncated = event.truncated;
                  existing.durationMs = event.durationMs;
                }
                setCurrentTools([...toolEvents]);
                break;
              }
              case "todos_updated": {
                // Pass 237: live todo tracker event
                const parsed = parseTodosPayload(event.todos);
                agentTodos = mergeTodoList(agentTodos, parsed);
                setCurrentTodos([...agentTodos]);
                break;
              }
              case "instructions_loaded": {
                // Pass 238: CLAUDE.md auto-loading receipt
                if (Array.isArray(event.files)) {
                  setLoadedInstructionFiles(
                    event.files.filter((f: unknown): f is string => typeof f === "string"),
                  );
                }
                break;
              }
              case "done": {
                const assistantMsg: CodeChatMessage = {
                  id: `a-${Date.now()}`,
                  role: "assistant",
                  content: event.response,
                  toolEvents: [...toolEvents],
                  agentTodos: agentTodos.length > 0 ? [...agentTodos] : undefined,
                  model: event.model,
                  iterations: event.iterations,
                  toolCallCount: event.toolCallCount,
                  totalDurationMs: event.totalDurationMs,
                  timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMsg]);
                setCurrentTools([]);
                // Do NOT reset currentTodos — leave them visible until
                // the next send for continuity
                break;
              }
              case "error":
                setError(event.message);
                break;
              case "thinking":
              case "heartbeat":
                break;
            }
          } catch { /* skip unparseable lines */ }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Stream failed");
      }
    } finally {
      setIsExecuting(false);
      abortRef.current = null;
    }
  }, [isExecuting]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setCurrentTools([]);
    setCurrentTodos([]);
    setError(null);
  }, []);

  /**
   * Regenerate the last assistant response: remove the last assistant
   * message and re-send the most recent user message through the
   * stream. Returns true if a regeneration actually kicked off.
   * Pass 208.
   */
  const regenerateLast = useCallback(
    async (config: StreamConfig = {}) => {
      if (isExecuting) return false;
      // Find the last user message in the current log
      let lastUser: CodeChatMessage | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          lastUser = messages[i];
          break;
        }
      }
      if (!lastUser) return false;
      // Drop every message after (and including) the last user turn,
      // then resend. This matches Claude Code's "regenerate" UX where
      // the conversation trims back to the last question.
      setMessages((prev) => {
        const out: CodeChatMessage[] = [];
        for (const m of prev) {
          if (m === lastUser) break;
          out.push(m);
        }
        return out;
      });
      await sendMessage(lastUser.content, config);
      return true;
    },
    [isExecuting, messages, sendMessage],
  );

  /**
   * Replace the entire message log. Used by the Sessions library
   * (Pass 212) to restore a saved conversation into the live hook.
   */
  const loadMessages = useCallback((next: CodeChatMessage[]) => {
    setMessages(next);
    setCurrentTools([]);
    setCurrentTodos([]);
    setError(null);
  }, []);

  return {
    messages,
    isExecuting,
    currentTools,
    currentTodos,
    loadedInstructionFiles,
    error,
    sendMessage,
    abort,
    clearHistory,
    regenerateLast,
    loadMessages,
  };
}
