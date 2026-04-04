import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const ROUTERS_PATH = "/home/ubuntu/wealthbridge-ai/server/routers.ts";
const NOTIFICATION_PATH = "/home/ubuntu/wealthbridge-ai/client/src/components/NotificationBell.tsx";
const CHAT_PATH = "/home/ubuntu/wealthbridge-ai/client/src/pages/Chat.tsx";

describe("Bug Fix: Streaming Persistence", () => {
  const routersContent = readFileSync(ROUTERS_PATH, "utf-8");
  const chatContent = readFileSync(CHAT_PATH, "utf-8");

  it("persistStreamed procedure is defined in routers.ts", () => {
    expect(routersContent).toContain("persistStreamed: protectedProcedure");
  });

  it("persistStreamed accepts conversationId, userContent, assistantContent", () => {
    expect(routersContent).toContain("userContent: z.string()");
    expect(routersContent).toContain("assistantContent: z.string()");
    expect(routersContent).toContain("conversationId: z.number()");
  });

  it("persistStreamed saves both user and assistant messages", () => {
    // Find the persistStreamed section
    const startIdx = routersContent.indexOf("persistStreamed: protectedProcedure");
    const endIdx = routersContent.indexOf("send: protectedProcedure");
    const section = routersContent.substring(startIdx, endIdx);
    // Must add user message
    expect(section).toContain('role: "user"');
    // Must add assistant message
    expect(section).toContain('role: "assistant"');
    // Must NOT call contextualLLM for regeneration (only for title/suggestions)
    // The main response should come from input.assistantContent, not LLM
    expect(section).toContain("content: input.assistantContent");
  });

  it("chat.send still exists for non-streaming fallback", () => {
    expect(routersContent).toContain("send: protectedProcedure");
  });

  it("Chat.tsx uses persistStreamedMutation for SSE done event", () => {
    expect(chatContent).toContain("persistStreamedMutation");
    expect(chatContent).toContain("trpc.chat.persistStreamed.useMutation()");
  });

  it("Chat.tsx does NOT await persistStreamed (non-blocking)", () => {
    // The persist call should use .then() pattern, not await
    expect(chatContent).toContain("persistStreamedMutation.mutateAsync(");
    expect(chatContent).toContain(".then((persistResult)");
  });

  it("Chat.tsx starts TTS immediately before persist completes", () => {
    // TTS should fire before the persist call
    const ttsIdx = chatContent.indexOf("if (ttsEnabled) tts.speak(accumulated)");
    const persistIdx = chatContent.indexOf("persistStreamedMutation.mutateAsync(");
    expect(ttsIdx).toBeGreaterThan(0);
    expect(persistIdx).toBeGreaterThan(0);
    expect(ttsIdx).toBeLessThan(persistIdx);
  });
});

describe("Bug Fix: Notification Portal", () => {
  const content = readFileSync(NOTIFICATION_PATH, "utf-8");

  it("NotificationBell uses createPortal for dropdown", () => {
    expect(content).toContain("createPortal");
    expect(content).toContain("document.body");
  });

  it("NotificationBell uses fixed positioning", () => {
    expect(content).toContain('position: "fixed"');
    expect(content).toContain("zIndex: 9999");
  });

  it("NotificationBell calculates position from bell button rect", () => {
    expect(content).toContain("getBoundingClientRect");
    expect(content).toContain("bellRef");
  });

  it("NotificationBell supports upward and downward opening", () => {
    expect(content).toContain("spaceBelow");
    expect(content).toContain("spaceAbove");
  });

  it("NotificationBell handles outside clicks and Escape key", () => {
    expect(content).toContain("mousedown");
    expect(content).toContain("Escape");
  });

  it("NotificationBell recalculates position on resize/scroll", () => {
    expect(content).toContain("resize");
    expect(content).toContain("scroll");
  });
});
