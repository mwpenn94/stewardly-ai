/**
 * sseEventParser.test.ts — Parity Pass 8.
 *
 * Locks down the SSE event parser against every malformed-event
 * path the server could accidentally emit. Also pins the happy
 * path for each event type so the useCodeChatStream hook can
 * refactor to use the parser without regressing.
 */

import { describe, it, expect } from "vitest";
import { parseSseLine, splitSseBuffer } from "./sseEventParser";

// ─── Line framing ──────────────────────────────────────────────

describe("parseSseLine — line framing", () => {
  it("returns null for empty lines", () => {
    expect(parseSseLine("")).toBeNull();
    expect(parseSseLine("   ")).toBeNull();
    expect(parseSseLine("\n")).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(parseSseLine(undefined as unknown as string)).toBeNull();
    expect(parseSseLine(null as unknown as string)).toBeNull();
  });

  it("rejects non-data lines", () => {
    const r = parseSseLine("event: ping");
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") expect(r.reason).toBe("not_data_line");
  });

  it("rejects empty payload after data:", () => {
    const r = parseSseLine("data: ");
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") expect(r.reason).toBe("bad_json");
  });

  it("rejects malformed JSON", () => {
    const r = parseSseLine("data: {not json}");
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") {
      expect(r.reason).toBe("bad_json");
      expect(r.detail).toBeDefined();
    }
  });

  it("rejects top-level array JSON", () => {
    const r = parseSseLine('data: [1,2,3]');
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") expect(r.reason).toBe("bad_shape");
  });

  it("rejects primitive JSON (number/string)", () => {
    expect(parseSseLine("data: 42")?.kind).toBe("invalid");
    expect(parseSseLine('data: "hello"')?.kind).toBe("invalid");
    expect(parseSseLine("data: null")?.kind).toBe("invalid");
  });

  it("rejects events with missing type", () => {
    const r = parseSseLine('data: {"foo":"bar"}');
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") expect(r.reason).toBe("missing_type");
  });

  it("returns unknown for unknown type", () => {
    const r = parseSseLine('data: {"type":"new_event_type","x":1}');
    expect(r?.kind).toBe("unknown");
    if (r?.kind === "unknown") expect(r.rawType).toBe("new_event_type");
  });
});

// ─── tool_start validation ─────────────────────────────────────

describe("parseSseLine — tool_start", () => {
  it("accepts a valid tool_start", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":3,"toolName":"read_file","args":{"path":"a.ts"}}',
    );
    expect(r?.kind).toBe("tool_start");
    if (r?.kind === "tool_start") {
      expect(r.stepIndex).toBe(3);
      expect(r.toolName).toBe("read_file");
      expect(r.args.path).toBe("a.ts");
    }
  });

  it("defaults args to empty object when missing", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":1,"toolName":"read_file"}',
    );
    expect(r?.kind).toBe("tool_start");
    if (r?.kind === "tool_start") expect(r.args).toEqual({});
  });

  it("defaults args to empty when args is null", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":1,"toolName":"read_file","args":null}',
    );
    expect(r?.kind).toBe("tool_start");
  });

  it("coerces args array to empty object (non-object arg)", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":1,"toolName":"read_file","args":[1,2]}',
    );
    expect(r?.kind).toBe("tool_start");
    if (r?.kind === "tool_start") expect(r.args).toEqual({});
  });

  it("rejects non-numeric stepIndex", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":"abc","toolName":"read_file"}',
    );
    expect(r?.kind).toBe("invalid");
    if (r?.kind === "invalid") expect(r.reason).toBe("validation_failed");
  });

  it("accepts numeric string stepIndex", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":"5","toolName":"read_file"}',
    );
    expect(r?.kind).toBe("tool_start");
    if (r?.kind === "tool_start") expect(r.stepIndex).toBe(5);
  });

  it("rejects missing toolName", () => {
    const r = parseSseLine('data: {"type":"tool_start","stepIndex":1}');
    expect(r?.kind).toBe("invalid");
  });

  it("rejects empty toolName", () => {
    const r = parseSseLine(
      'data: {"type":"tool_start","stepIndex":1,"toolName":""}',
    );
    expect(r?.kind).toBe("invalid");
  });
});

// ─── tool_result validation ────────────────────────────────────

describe("parseSseLine — tool_result", () => {
  it("accepts a valid tool_result", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":3,"toolName":"read_file","kind":"read","preview":"{\\"x\\":1}","truncated":false,"durationMs":42}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") {
      expect(r.stepIndex).toBe(3);
      expect(r.resultKind).toBe("read");
      expect(r.durationMs).toBe(42);
      expect(r.truncated).toBe(false);
    }
  });

  it("defaults resultKind to unknown when absent", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":1,"toolName":"read_file"}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") expect(r.resultKind).toBe("unknown");
  });

  it("clamps negative durationMs to 0", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":1,"toolName":"read_file","durationMs":-100}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") expect(r.durationMs).toBe(0);
  });

  it("clamps NaN durationMs to 0", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":1,"toolName":"read_file","durationMs":"bad"}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") expect(r.durationMs).toBe(0);
  });

  it("coerces truncated to boolean", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":1,"toolName":"read_file","truncated":"yes"}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") expect(r.truncated).toBe(true);
  });

  it("rejects missing stepIndex", () => {
    const r = parseSseLine('data: {"type":"tool_result","toolName":"read_file"}');
    expect(r?.kind).toBe("invalid");
  });

  it("rejects missing toolName", () => {
    const r = parseSseLine('data: {"type":"tool_result","stepIndex":1}');
    expect(r?.kind).toBe("invalid");
  });

  it("accepts preview as undefined", () => {
    const r = parseSseLine(
      'data: {"type":"tool_result","stepIndex":1,"toolName":"read_file"}',
    );
    expect(r?.kind).toBe("tool_result");
    if (r?.kind === "tool_result") expect(r.preview).toBeUndefined();
  });
});

// ─── todos_updated ─────────────────────────────────────────────

describe("parseSseLine — todos_updated", () => {
  it("forwards todos payload", () => {
    const r = parseSseLine(
      'data: {"type":"todos_updated","todos":[{"id":"1","content":"do thing","activeForm":"doing thing","status":"pending"}]}',
    );
    expect(r?.kind).toBe("todos_updated");
    if (r?.kind === "todos_updated") expect(Array.isArray(r.todos)).toBe(true);
  });

  it("forwards non-array todos payload without error (downstream validates)", () => {
    const r = parseSseLine('data: {"type":"todos_updated","todos":"not-an-array"}');
    expect(r?.kind).toBe("todos_updated");
  });
});

// ─── instructions_loaded ───────────────────────────────────────

describe("parseSseLine — instructions_loaded", () => {
  it("accepts files array", () => {
    const r = parseSseLine(
      'data: {"type":"instructions_loaded","files":["CLAUDE.md",".stewardly/instructions.md"]}',
    );
    expect(r?.kind).toBe("instructions_loaded");
    if (r?.kind === "instructions_loaded") {
      expect(r.files).toEqual(["CLAUDE.md", ".stewardly/instructions.md"]);
    }
  });

  it("filters non-string entries", () => {
    const r = parseSseLine(
      'data: {"type":"instructions_loaded","files":["CLAUDE.md",42,null,"AGENTS.md"]}',
    );
    expect(r?.kind).toBe("instructions_loaded");
    if (r?.kind === "instructions_loaded") {
      expect(r.files).toEqual(["CLAUDE.md", "AGENTS.md"]);
    }
  });

  it("returns empty files when the field is not an array", () => {
    const r = parseSseLine('data: {"type":"instructions_loaded","files":"bad"}');
    expect(r?.kind).toBe("instructions_loaded");
    if (r?.kind === "instructions_loaded") expect(r.files).toEqual([]);
  });
});

// ─── mentions_resolved ─────────────────────────────────────────

describe("parseSseLine — mentions_resolved", () => {
  it("accepts valid mentions", () => {
    const r = parseSseLine(
      'data: {"type":"mentions_resolved","mentions":[{"path":"a.ts","bytes":1024},{"path":"b.ts","bytes":0,"error":"not_found"}]}',
    );
    expect(r?.kind).toBe("mentions_resolved");
    if (r?.kind === "mentions_resolved") {
      expect(r.mentions).toHaveLength(2);
      expect(r.mentions[1].error).toBe("not_found");
    }
  });

  it("drops mentions without a path", () => {
    const r = parseSseLine(
      'data: {"type":"mentions_resolved","mentions":[{"bytes":1},{"path":"ok.ts","bytes":1}]}',
    );
    expect(r?.kind).toBe("mentions_resolved");
    if (r?.kind === "mentions_resolved") expect(r.mentions).toHaveLength(1);
  });

  it("clamps non-finite bytes to 0", () => {
    const r = parseSseLine(
      'data: {"type":"mentions_resolved","mentions":[{"path":"a.ts","bytes":"bad"}]}',
    );
    expect(r?.kind).toBe("mentions_resolved");
    if (r?.kind === "mentions_resolved") expect(r.mentions[0].bytes).toBe(0);
  });
});

// ─── done ──────────────────────────────────────────────────────

describe("parseSseLine — done", () => {
  it("accepts a full done event", () => {
    const r = parseSseLine(
      'data: {"type":"done","response":"hi","model":"claude","iterations":3,"toolCallCount":5,"totalDurationMs":1000}',
    );
    expect(r?.kind).toBe("done");
    if (r?.kind === "done") {
      expect(r.response).toBe("hi");
      expect(r.model).toBe("claude");
      expect(r.iterations).toBe(3);
      expect(r.toolCallCount).toBe(5);
      expect(r.totalDurationMs).toBe(1000);
    }
  });

  it("defaults response to empty string", () => {
    const r = parseSseLine('data: {"type":"done"}');
    expect(r?.kind).toBe("done");
    if (r?.kind === "done") expect(r.response).toBe("");
  });

  it("leaves optional numeric fields undefined when missing", () => {
    const r = parseSseLine('data: {"type":"done","response":"hi"}');
    expect(r?.kind).toBe("done");
    if (r?.kind === "done") {
      expect(r.iterations).toBeUndefined();
      expect(r.toolCallCount).toBeUndefined();
    }
  });
});

// ─── error / thinking / heartbeat ──────────────────────────────

describe("parseSseLine — error/thinking/heartbeat", () => {
  it("accepts an error event", () => {
    const r = parseSseLine('data: {"type":"error","message":"boom"}');
    expect(r?.kind).toBe("error");
    if (r?.kind === "error") expect(r.message).toBe("boom");
  });

  it("defaults error message to 'Unknown error'", () => {
    const r = parseSseLine('data: {"type":"error"}');
    expect(r?.kind).toBe("error");
    if (r?.kind === "error") expect(r.message).toBe("Unknown error");
  });

  it("accepts a thinking event", () => {
    const r = parseSseLine('data: {"type":"thinking","content":"hmm"}');
    expect(r?.kind).toBe("thinking");
    if (r?.kind === "thinking") expect(r.content).toBe("hmm");
  });

  it("accepts a heartbeat", () => {
    const r = parseSseLine('data: {"type":"heartbeat"}');
    expect(r?.kind).toBe("heartbeat");
  });
});

// ─── splitSseBuffer ────────────────────────────────────────────

describe("splitSseBuffer", () => {
  it("splits on newlines and preserves leftover", () => {
    const r = splitSseBuffer("a\nb\nc");
    expect(r.lines).toEqual(["a", "b"]);
    expect(r.leftover).toBe("c");
  });

  it("returns empty leftover when buffer ends on newline", () => {
    const r = splitSseBuffer("a\nb\n");
    expect(r.lines).toEqual(["a", "b"]);
    expect(r.leftover).toBe("");
  });

  it("handles empty buffer", () => {
    const r = splitSseBuffer("");
    expect(r.lines).toEqual([]);
    expect(r.leftover).toBe("");
  });

  it("treats single line with no newline as leftover", () => {
    const r = splitSseBuffer("partial-event");
    expect(r.lines).toEqual([]);
    expect(r.leftover).toBe("partial-event");
  });
});
