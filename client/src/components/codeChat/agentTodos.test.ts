/**
 * Tests for agentTodos.ts (Pass 237).
 */

import { describe, it, expect } from "vitest";
import {
  parseTodosPayload,
  mergeTodoList,
  todoProgress,
  currentTodo,
  type AgentTodoItem,
} from "./agentTodos";

const mk = (overrides: Partial<AgentTodoItem> = {}): AgentTodoItem => ({
  id: "t-1",
  content: "Do thing",
  activeForm: "Doing thing",
  status: "pending",
  ...overrides,
});

describe("parseTodosPayload", () => {
  it("returns [] for non-array inputs", () => {
    expect(parseTodosPayload(null)).toEqual([]);
    expect(parseTodosPayload("nope")).toEqual([]);
    expect(parseTodosPayload({})).toEqual([]);
    expect(parseTodosPayload(42)).toEqual([]);
  });

  it("parses a well-formed array", () => {
    const out = parseTodosPayload([
      { id: "a", content: "Read code", activeForm: "Reading code", status: "pending" },
      { id: "b", content: "Write tests", activeForm: "Writing tests", status: "in_progress" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("a");
    expect(out[1].status).toBe("in_progress");
  });

  it("drops entries with empty content", () => {
    const out = parseTodosPayload([
      { content: "" },
      { content: "   " },
      { content: "valid", activeForm: "Working", status: "pending" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].content).toBe("valid");
  });

  it("backfills activeForm from content when missing", () => {
    const out = parseTodosPayload([{ content: "Step 1" }]);
    expect(out[0].activeForm).toBe("Step 1");
  });

  it("defaults invalid status to pending", () => {
    const out = parseTodosPayload([
      { content: "A", status: "nope" },
      { content: "B" },
    ]);
    expect(out[0].status).toBe("pending");
    expect(out[1].status).toBe("pending");
  });

  it("auto-generates ids when missing or empty", () => {
    const out = parseTodosPayload([
      { content: "A" },
      { content: "B", id: "" },
      { content: "C", id: 42 },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0].id).toBe("t-1");
    expect(out[1].id).toBe("t-2");
    expect(out[2].id).toBe("t-3");
  });

  it("dedupes identical ids", () => {
    const out = parseTodosPayload([
      { content: "A", id: "same" },
      { content: "B", id: "same" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe("same");
    expect(out[1].id).not.toBe("same");
  });

  it("caps at 50 items", () => {
    const raw = Array.from({ length: 60 }, (_, i) => ({
      content: `Item ${i}`,
      status: "pending",
    }));
    expect(parseTodosPayload(raw)).toHaveLength(50);
  });

  it("trims whitespace from content and activeForm", () => {
    const out = parseTodosPayload([
      { content: "  A  ", activeForm: "  Doing A  " },
    ]);
    expect(out[0].content).toBe("A");
    expect(out[0].activeForm).toBe("Doing A");
  });
});

describe("mergeTodoList", () => {
  it("uses the new list as authoritative order", () => {
    const existing: AgentTodoItem[] = [mk({ id: "a" }), mk({ id: "b" })];
    const next: AgentTodoItem[] = [mk({ id: "b" }), mk({ id: "a" })];
    const merged = mergeTodoList(existing, next);
    expect(merged.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("drops items not in the new list", () => {
    const existing: AgentTodoItem[] = [
      mk({ id: "a" }),
      mk({ id: "b" }),
      mk({ id: "c" }),
    ];
    const next: AgentTodoItem[] = [mk({ id: "a" })];
    expect(mergeTodoList(existing, next)).toHaveLength(1);
  });

  it("new list wins on content/activeForm/status", () => {
    const existing: AgentTodoItem[] = [
      mk({ id: "a", content: "old", status: "pending" }),
    ];
    const next: AgentTodoItem[] = [
      mk({ id: "a", content: "new", status: "completed" }),
    ];
    const merged = mergeTodoList(existing, next);
    expect(merged[0].content).toBe("new");
    expect(merged[0].status).toBe("completed");
  });

  it("treats new ids as fresh items", () => {
    const merged = mergeTodoList([], [mk({ id: "a" }), mk({ id: "b" })]);
    expect(merged).toHaveLength(2);
  });
});

describe("todoProgress", () => {
  it("returns zero state for empty list", () => {
    const p = todoProgress([]);
    expect(p.total).toBe(0);
    expect(p.pct).toBe(0);
    expect(p.allDone).toBe(false);
  });

  it("counts by status", () => {
    const todos: AgentTodoItem[] = [
      mk({ id: "a", status: "pending" }),
      mk({ id: "b", status: "in_progress" }),
      mk({ id: "c", status: "completed" }),
      mk({ id: "d", status: "completed" }),
    ];
    const p = todoProgress(todos);
    expect(p.pending).toBe(1);
    expect(p.inProgress).toBe(1);
    expect(p.completed).toBe(2);
    expect(p.total).toBe(4);
    expect(p.pct).toBe(0.5);
    expect(p.allDone).toBe(false);
  });

  it("reports allDone when every item is completed", () => {
    const todos: AgentTodoItem[] = [
      mk({ id: "a", status: "completed" }),
      mk({ id: "b", status: "completed" }),
    ];
    const p = todoProgress(todos);
    expect(p.allDone).toBe(true);
    expect(p.pct).toBe(1);
  });
});

describe("currentTodo", () => {
  it("returns the first in_progress item", () => {
    const todos: AgentTodoItem[] = [
      mk({ id: "a", status: "pending" }),
      mk({ id: "b", status: "in_progress" }),
      mk({ id: "c", status: "in_progress" }),
    ];
    expect(currentTodo(todos)?.id).toBe("b");
  });

  it("falls back to the first pending item when nothing is running", () => {
    const todos: AgentTodoItem[] = [
      mk({ id: "a", status: "completed" }),
      mk({ id: "b", status: "pending" }),
    ];
    expect(currentTodo(todos)?.id).toBe("b");
  });

  it("returns null when all items are completed", () => {
    const todos: AgentTodoItem[] = [
      mk({ id: "a", status: "completed" }),
      mk({ id: "b", status: "completed" }),
    ];
    expect(currentTodo(todos)).toBeNull();
  });

  it("returns null for empty list", () => {
    expect(currentTodo([])).toBeNull();
  });
});
