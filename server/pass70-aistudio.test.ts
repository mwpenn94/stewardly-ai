import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const uai = readFileSync(join(__dirname, "../client/src/pages/UnifiedAI.tsx"), "utf-8");

describe("Pass 70 — AI Studio Unified Surface", () => {
  describe("C4.1 Mode switching (Chat/Dev/Auto)", () => {
    it("has all three mode tabs", () => {
      expect(uai).toContain("Chat");
      expect(uai).toContain("Dev");
      expect(uai).toContain("Auto");
    });
    it("uses CSS visibility for mode preservation (not conditional mount)", () => {
      // Modes use absolute positioning with visible/invisible to preserve state
      expect(uai).toMatch(/visible.*invisible|invisible.*visible/);
    });
    it("has keyboard shortcuts for mode switching (Ctrl+1/2/3)", () => {
      expect(uai).toContain("Ctrl+1");
      expect(uai).toContain("Ctrl+2");
      expect(uai).toContain("Ctrl+3");
    });
  });

  describe("C4.2 Chat mode streaming", () => {
    it("uses SSE streaming via /api/chat/stream", () => {
      expect(uai).toContain("/api/chat/stream");
    });
    it("has abort/stop functionality", () => {
      expect(uai).toContain("AbortController");
      expect(uai).toContain("handleStop");
    });
    it("renders markdown with Streamdown", () => {
      expect(uai).toContain("Streamdown");
    });
    it("has suggestion chips for empty state", () => {
      expect(uai).toContain("CHAT_SUGGESTIONS");
    });
    it("has context type selector", () => {
      expect(uai).toContain("CONTEXT_TYPES");
      expect(uai).toContain("contextType");
    });
  });

  describe("C4.3 Conversation history", () => {
    it("has conversation history sidebar", () => {
      expect(uai).toContain("showHistory");
      expect(uai).toContain("conversations.list");
    });
    it("can load conversation messages", () => {
      expect(uai).toContain("conversations.messages");
      expect(uai).toContain("activeConvId");
    });
    it("can create new conversations", () => {
      expect(uai).toContain("conversations.create");
    });
    it("has history toggle button", () => {
      expect(uai).toContain("Toggle conversation history");
    });
  });

  describe("C4.4 Dev mode (Code Chat)", () => {
    it("uses codeChat.chat mutation", () => {
      expect(uai).toContain("codeChat.chat");
    });
    it("shows traces and tool calls", () => {
      expect(uai).toContain("traces");
      expect(uai).toContain("toolCallCount");
    });
    it("has expandable trace details", () => {
      expect(uai).toContain("expandedTraces");
    });
  });

  describe("C4.5 Auto mode (Agent Management)", () => {
    it("uses openClaw router for agent CRUD", () => {
      expect(uai).toContain("openClaw");
    });
    it("has task templates for quick agent creation", () => {
      expect(uai).toContain("TASK_TEMPLATES");
    });
    it("shows agent status with visual indicators", () => {
      expect(uai).toMatch(/running|completed|failed/);
      expect(uai).toContain("bg-emerald");
    });
    it("has action log display for agent activities", () => {
      expect(uai).toContain("actionsQuery");
      expect(uai).toContain("Recent Actions");
    });
  });

  describe("C4.6 Accessibility", () => {
    it("has role=tabpanel on mode panels", () => {
      expect(uai).toContain('role="tabpanel"');
    });
    it("has aria-label on mode panels", () => {
      expect(uai).toContain('aria-label="Chat mode"');
      expect(uai).toContain('aria-label="Dev mode"');
      expect(uai).toContain('aria-label="Auto mode"');
    });
    it("has ServiceDegradedFallback", () => {
      expect(uai).toContain("ServiceDegradedFallback");
    });
  });

  describe("C4.7 Status bar", () => {
    it("shows system service health status", () => {
      expect(uai).toContain("system.serviceHealth");
    });
    it("shows keyboard shortcuts hint in status bar", () => {
      expect(uai).toContain("Ctrl+1");
    });
    it("has visual health indicator", () => {
      expect(uai).toContain("All services connected");
      expect(uai).toContain("Some services degraded");
    });
  });
});
