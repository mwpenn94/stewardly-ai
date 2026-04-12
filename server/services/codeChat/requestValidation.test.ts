/**
 * requestValidation.test.ts — Parity Pass 4.
 *
 * Locks in the stream-request validator's contract so the SSE
 * endpoint can never regress to accepting unbounded input. Each
 * invariant has at least one positive and one negative case.
 */

import { describe, it, expect } from "vitest";
import {
  validateStreamRequest,
  byteLength,
  STREAM_REQUEST_LIMITS,
} from "./requestValidation";

// ─── message field ────────────────────────────────────────────────────

describe("validateStreamRequest — message", () => {
  it("accepts a reasonable message", () => {
    const r = validateStreamRequest({ message: "fix the auth bug" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.message).toBe("fix the auth bug");
  });

  it("rejects missing message", () => {
    const r = validateStreamRequest({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MESSAGE_REQUIRED");
  });

  it("rejects null message", () => {
    const r = validateStreamRequest({ message: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MESSAGE_REQUIRED");
  });

  it("rejects non-string message", () => {
    const r = validateStreamRequest({ message: 42 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MESSAGE_INVALID_TYPE");
  });

  it("rejects whitespace-only message", () => {
    const r = validateStreamRequest({ message: "   \n  \t " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MESSAGE_EMPTY");
  });

  it("rejects oversized message", () => {
    const huge = "x".repeat(STREAM_REQUEST_LIMITS.maxMessageBytes + 1);
    const r = validateStreamRequest({ message: huge });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("MESSAGE_TOO_LARGE");
      expect(r.message).toContain(String(STREAM_REQUEST_LIMITS.maxMessageBytes));
    }
  });

  it("accepts a message exactly at the byte limit", () => {
    const exact = "x".repeat(STREAM_REQUEST_LIMITS.maxMessageBytes);
    const r = validateStreamRequest({ message: exact });
    expect(r.ok).toBe(true);
  });

  it("preserves original message whitespace (user intent)", () => {
    const r = validateStreamRequest({ message: "  hello  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.message).toBe("  hello  ");
  });

  it("counts bytes, not characters, for the size check", () => {
    // A 4-byte emoji is 1 char but 4 bytes. Size check should use bytes.
    const emojiChar = "💀"; // 4 UTF-8 bytes
    // Make a string whose char-length < limit but byte-length > limit
    const count = Math.floor(STREAM_REQUEST_LIMITS.maxMessageBytes / 4) + 10;
    const huge = emojiChar.repeat(count);
    const r = validateStreamRequest({ message: huge });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MESSAGE_TOO_LARGE");
  });
});

// ─── model field ──────────────────────────────────────────────────────

describe("validateStreamRequest — model", () => {
  it("accepts undefined model", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.model).toBeUndefined();
  });

  it("accepts a valid model id", () => {
    const r = validateStreamRequest({ message: "hi", model: "claude-opus-4-6" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.model).toBe("claude-opus-4-6");
  });

  it("rejects non-string model", () => {
    const r = validateStreamRequest({ message: "hi", model: {} });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MODEL_INVALID");
  });

  it("rejects model longer than max", () => {
    const long = "x".repeat(STREAM_REQUEST_LIMITS.maxModelIdLength + 1);
    const r = validateStreamRequest({ message: "hi", model: long });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MODEL_TOO_LONG");
  });

  it("rejects model with control characters", () => {
    const r = validateStreamRequest({ message: "hi", model: "bad\x00model" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MODEL_INVALID");
  });

  it("rejects model with newlines (log injection)", () => {
    const r = validateStreamRequest({ message: "hi", model: "bad\nmodel" });
    expect(r.ok).toBe(false);
  });

  it("treats empty-string model as undefined", () => {
    const r = validateStreamRequest({ message: "hi", model: "   " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.model).toBeUndefined();
  });
});

// ─── allowMutations field ─────────────────────────────────────────────

describe("validateStreamRequest — allowMutations", () => {
  it("defaults to false", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.allowMutations).toBe(false);
  });

  it("accepts true", () => {
    const r = validateStreamRequest({ message: "hi", allowMutations: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.allowMutations).toBe(true);
  });

  it("coerces falsy values to false", () => {
    const r = validateStreamRequest({ message: "hi", allowMutations: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.allowMutations).toBe(false);
  });

  it("coerces truthy values to true", () => {
    const r = validateStreamRequest({ message: "hi", allowMutations: "yes" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.allowMutations).toBe(true);
  });
});

// ─── maxIterations field ──────────────────────────────────────────────

describe("validateStreamRequest — maxIterations", () => {
  it("defaults to 5", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.maxIterations).toBe(5);
  });

  it("accepts a value in range", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.maxIterations).toBe(10);
  });

  it("accepts the max bound", () => {
    const r = validateStreamRequest({
      message: "hi",
      maxIterations: STREAM_REQUEST_LIMITS.maxIterations,
    });
    expect(r.ok).toBe(true);
  });

  it("rejects zero", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ITERATIONS_OUT_OF_RANGE");
  });

  it("rejects negative", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: -1 });
    expect(r.ok).toBe(false);
  });

  it("rejects > 20", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: 1000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ITERATIONS_OUT_OF_RANGE");
  });

  it("rejects NaN", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: NaN });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ITERATIONS_INVALID_TYPE");
  });

  it("rejects Infinity", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: Infinity });
    expect(r.ok).toBe(false);
  });

  it("floors decimal values", () => {
    const r = validateStreamRequest({ message: "hi", maxIterations: 5.9 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.maxIterations).toBe(5);
  });
});

// ─── enabledTools field ───────────────────────────────────────────────

describe("validateStreamRequest — enabledTools", () => {
  it("defaults to null (no filter)", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.enabledTools).toBeNull();
  });

  it("accepts a clean array", () => {
    const r = validateStreamRequest({
      message: "hi",
      enabledTools: ["read_file", "grep_search"],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.enabledTools).toEqual(["read_file", "grep_search"]);
  });

  it("rejects non-array", () => {
    const r = validateStreamRequest({ message: "hi", enabledTools: "read_file" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("TOOLS_INVALID_TYPE");
  });

  it("rejects oversized array", () => {
    const arr = Array.from({ length: 100 }, (_, i) => `tool_${i}`);
    const r = validateStreamRequest({ message: "hi", enabledTools: arr });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("TOOLS_TOO_MANY");
  });

  it("rejects non-string entries", () => {
    const r = validateStreamRequest({
      message: "hi",
      enabledTools: ["read_file", 42],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("TOOLS_INVALID_ENTRY");
  });

  it("silently drops empty entries", () => {
    const r = validateStreamRequest({
      message: "hi",
      enabledTools: ["read_file", "", "grep_search", "   "],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.enabledTools).toEqual(["read_file", "grep_search"]);
  });

  it("rejects entries with control characters", () => {
    const r = validateStreamRequest({
      message: "hi",
      enabledTools: ["read_file\x00bad"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("TOOLS_INVALID_ENTRY");
  });

  it("rejects entries longer than 64 chars", () => {
    const r = validateStreamRequest({
      message: "hi",
      enabledTools: ["x".repeat(65)],
    });
    expect(r.ok).toBe(false);
  });
});

// ─── includeProjectInstructions field ────────────────────────────────

describe("validateStreamRequest — includeProjectInstructions", () => {
  it("defaults to true", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.includeProjectInstructions).toBe(true);
  });

  it("honors explicit false", () => {
    const r = validateStreamRequest({ message: "hi", includeProjectInstructions: false });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.includeProjectInstructions).toBe(false);
  });
});

// ─── memoryOverlay field ─────────────────────────────────────────────

describe("validateStreamRequest — memoryOverlay", () => {
  it("defaults to empty string", () => {
    const r = validateStreamRequest({ message: "hi" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.memoryOverlay).toBe("");
  });

  it("accepts a short overlay", () => {
    const r = validateStreamRequest({ message: "hi", memoryOverlay: "remember to use drizzle" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.memoryOverlay).toContain("drizzle");
  });

  it("rejects non-string overlay", () => {
    const r = validateStreamRequest({ message: "hi", memoryOverlay: ["a"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MEMORY_INVALID_TYPE");
  });

  it("rejects oversized overlay", () => {
    const long = "a".repeat(STREAM_REQUEST_LIMITS.maxMemoryOverlayBytes + 1);
    const r = validateStreamRequest({ message: "hi", memoryOverlay: long });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("MEMORY_TOO_LARGE");
  });

  it("trims whitespace on acceptance", () => {
    const r = validateStreamRequest({ message: "hi", memoryOverlay: "  fact  " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.memoryOverlay).toBe("fact");
  });
});

// ─── byteLength helper ───────────────────────────────────────────────

describe("byteLength", () => {
  it("counts ASCII as 1 byte per char", () => {
    expect(byteLength("hello")).toBe(5);
  });

  it("counts multi-byte UTF-8 correctly", () => {
    expect(byteLength("café")).toBe(5); // 4 chars, 5 bytes
    expect(byteLength("💀")).toBe(4); // 1 char, 4 bytes
  });

  it("returns 0 for empty string", () => {
    expect(byteLength("")).toBe(0);
  });
});
