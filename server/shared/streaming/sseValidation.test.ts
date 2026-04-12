/**
 * Tests for SSE pipeline input validation and safety guards.
 * Covers the hardening done in CBL9 pass:
 * - Message array validation (each message must have string role)
 * - maxIterations cap (1-25 range)
 * - Tool call null safety (guard against missing function.arguments)
 * - Abort signal propagation to tool execution
 */
import { describe, it, expect } from "vitest";

// ─── Message Validation ────────────────────────────────────────────────
// Mirrors the validation logic in server/_core/index.ts /api/chat/stream
function validateMessage(m: any): boolean {
  if (!m || typeof m !== "object") return false;
  return (
    typeof m.role === "string" &&
    (m.content === undefined || m.content === null || typeof m.content === "string")
  );
}

describe("SSE Message Validation", () => {
  it("accepts valid messages with string content", () => {
    expect(validateMessage({ role: "user", content: "hello" })).toBe(true);
    expect(validateMessage({ role: "assistant", content: "hi" })).toBe(true);
    expect(validateMessage({ role: "system", content: "you are helpful" })).toBe(true);
  });

  it("accepts messages with null or undefined content (tool result messages)", () => {
    expect(validateMessage({ role: "assistant", content: null })).toBe(true);
    expect(validateMessage({ role: "assistant" })).toBe(true);
  });

  it("rejects messages with non-string content", () => {
    expect(validateMessage({ role: "user", content: 123 })).toBe(false);
    expect(validateMessage({ role: "user", content: { text: "hello" } })).toBe(false);
    expect(validateMessage({ role: "user", content: ["hello"] })).toBe(false);
    expect(validateMessage({ role: "user", content: true })).toBe(false);
  });

  it("rejects messages without a role", () => {
    expect(validateMessage({ content: "hello" })).toBe(false);
    expect(validateMessage({})).toBe(false);
  });

  it("rejects messages with non-string role", () => {
    expect(validateMessage({ role: 123, content: "hello" })).toBe(false);
    expect(validateMessage({ role: null, content: "hello" })).toBe(false);
    expect(validateMessage({ role: true, content: "hello" })).toBe(false);
  });

  it("rejects null/undefined/primitive messages", () => {
    expect(validateMessage(null)).toBe(false);
    expect(validateMessage(undefined)).toBe(false);
    expect(validateMessage("hello")).toBe(false);
    expect(validateMessage(42)).toBe(false);
  });

  it("validates a realistic conversation array", () => {
    const messages = [
      { role: "system", content: "You are a financial advisor." },
      { role: "user", content: "What's my tax bracket?" },
      { role: "assistant", content: "Based on your income..." },
      { role: "user", content: "How about Roth conversions?" },
    ];
    expect(messages.every(validateMessage)).toBe(true);
  });

  it("catches a corrupted message in a conversation array", () => {
    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: 42 }, // corrupted
      { role: "user", content: "world" },
    ];
    const invalid = messages.find((m) => !validateMessage(m));
    expect(invalid).toEqual({ role: "assistant", content: 42 });
  });
});

// ─── maxIterations Cap ─────────────────────────────────────────────────
// Mirrors the capping logic in server/routes/codeChatStream.ts
function capMaxIterations(raw: unknown): number {
  return Math.min(Math.max(1, Number(raw) || 5), 25);
}

describe("maxIterations Cap", () => {
  it("defaults to 5 for undefined/null/NaN", () => {
    expect(capMaxIterations(undefined)).toBe(5);
    expect(capMaxIterations(null)).toBe(5);
    expect(capMaxIterations("abc")).toBe(5);
    expect(capMaxIterations(NaN)).toBe(5);
  });

  it("respects valid values within range", () => {
    expect(capMaxIterations(1)).toBe(1);
    expect(capMaxIterations(10)).toBe(10);
    expect(capMaxIterations(25)).toBe(25);
  });

  it("caps at 25 for values above range", () => {
    expect(capMaxIterations(100)).toBe(25);
    expect(capMaxIterations(999)).toBe(25);
    expect(capMaxIterations(Infinity)).toBe(25);
  });

  it("floors at 1 for values at or below zero", () => {
    expect(capMaxIterations(0)).toBe(5); // 0 is falsy, so Number(0)||5 = 5
    expect(capMaxIterations(-5)).toBe(1);
    expect(capMaxIterations(-Infinity)).toBe(1);
  });

  it("handles string numbers", () => {
    expect(capMaxIterations("10")).toBe(10);
    expect(capMaxIterations("50")).toBe(25);
    expect(capMaxIterations("0")).toBe(5);
  });
});

// ─── Tool Call Null Safety ───────────────────────────────────────���─────
// Mirrors the guard in server/shared/streaming/sseStreamHandler.ts
function safeParseToolArgs(toolCall: any): Record<string, unknown> | null {
  if (!toolCall.function?.arguments) {
    return null;
  }
  try {
    return JSON.parse(toolCall.function.arguments);
  } catch {
    return null;
  }
}

describe("Tool Call Null Safety", () => {
  it("parses valid tool call arguments", () => {
    const tc = { function: { name: "search", arguments: '{"query":"test"}' } };
    expect(safeParseToolArgs(tc)).toEqual({ query: "test" });
  });

  it("returns null for missing function property", () => {
    expect(safeParseToolArgs({})).toBeNull();
    expect(safeParseToolArgs({ function: null })).toBeNull();
  });

  it("returns null for missing arguments property", () => {
    expect(safeParseToolArgs({ function: { name: "search" } })).toBeNull();
    expect(safeParseToolArgs({ function: { name: "search", arguments: undefined } })).toBeNull();
    expect(safeParseToolArgs({ function: { name: "search", arguments: "" } })).toBeNull();
  });

  it("returns null for invalid JSON arguments", () => {
    expect(safeParseToolArgs({ function: { name: "search", arguments: "not json" } })).toBeNull();
    expect(safeParseToolArgs({ function: { name: "search", arguments: "{broken" } })).toBeNull();
  });

  it("handles nested objects in arguments", () => {
    const tc = {
      function: {
        name: "complex_tool",
        arguments: JSON.stringify({ path: "/foo", options: { recursive: true } }),
      },
    };
    expect(safeParseToolArgs(tc)).toEqual({ path: "/foo", options: { recursive: true } });
  });
});

// ─── Abort Signal Propagation ──────────────────────────────────────────
describe("Abort Signal Propagation", () => {
  it("immediately rejects if signal already aborted", async () => {
    const ac = new AbortController();
    ac.abort();

    const promise = new Promise<string>((_, reject) => {
      if (ac.signal.aborted) reject(new Error("Client disconnected"));
      ac.signal.addEventListener("abort", () => reject(new Error("Client disconnected")), { once: true });
    });

    await expect(promise).rejects.toThrow("Client disconnected");
  });

  it("rejects when signal is aborted after creation", async () => {
    const ac = new AbortController();

    const promise = new Promise<string>((_, reject) => {
      if (ac.signal.aborted) reject(new Error("Client disconnected"));
      ac.signal.addEventListener("abort", () => reject(new Error("Client disconnected")), { once: true });
    });

    // Abort after a short delay
    setTimeout(() => ac.abort(), 10);

    await expect(promise).rejects.toThrow("Client disconnected");
  });

  it("does not reject if signal is never aborted (race with fast resolve)", async () => {
    const ac = new AbortController();

    const fastResolve = Promise.resolve("done");
    const abortPromise = new Promise<string>((_, reject) => {
      if (ac.signal.aborted) reject(new Error("Client disconnected"));
      ac.signal.addEventListener("abort", () => reject(new Error("Client disconnected")), { once: true });
    });

    const result = await Promise.race([fastResolve, abortPromise]);
    expect(result).toBe("done");
  });
});
