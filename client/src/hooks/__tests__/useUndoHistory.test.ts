/**
 * useUndoHistory — unit tests (v8 Pass 4)
 */
import { describe, it, expect } from 'vitest';

// Test the core logic without React hooks by simulating the ring buffer behavior
describe('useUndoHistory logic', () => {
  // Simulate the ring buffer logic that the hook uses
  class UndoBuffer<T> {
    private history: T[];
    private pos: number;
    private maxDepth: number;
    private lastPush: number;
    private debounceMs: number;

    constructor(initial: T, maxDepth = 50, debounceMs = 0) {
      this.history = [structuredClone(initial)];
      this.pos = 0;
      this.maxDepth = maxDepth;
      this.lastPush = 0;
      this.debounceMs = debounceMs;
    }

    push(state: T) {
      const now = Date.now();
      if (now - this.lastPush < this.debounceMs) {
        this.history[this.pos] = structuredClone(state);
        return;
      }
      this.lastPush = now;
      this.history = this.history.slice(0, this.pos + 1);
      this.history.push(structuredClone(state));
      if (this.history.length > this.maxDepth) {
        this.history = this.history.slice(this.history.length - this.maxDepth);
      }
      this.pos = this.history.length - 1;
    }

    undo(): T | null {
      if (this.pos <= 0) return null;
      this.pos -= 1;
      return structuredClone(this.history[this.pos]);
    }

    redo(): T | null {
      if (this.pos >= this.history.length - 1) return null;
      this.pos += 1;
      return structuredClone(this.history[this.pos]);
    }

    get canUndo() { return this.pos > 0; }
    get canRedo() { return this.pos < this.history.length - 1; }
    get position() { return this.pos; }
    get length() { return this.history.length; }

    clear() {
      const current = this.history[this.pos];
      this.history = [structuredClone(current)];
      this.pos = 0;
    }
  }

  it('starts with initial state and cannot undo/redo', () => {
    const buf = new UndoBuffer({ age: 40 });
    expect(buf.canUndo).toBe(false);
    expect(buf.canRedo).toBe(false);
    expect(buf.position).toBe(0);
    expect(buf.length).toBe(1);
  });

  it('push adds entries and enables undo', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    buf.push({ age: 42 });
    expect(buf.length).toBe(3);
    expect(buf.canUndo).toBe(true);
    expect(buf.canRedo).toBe(false);
  });

  it('undo steps backward through history', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    buf.push({ age: 42 });
    const prev = buf.undo();
    expect(prev).toEqual({ age: 41 });
    expect(buf.position).toBe(1);
    expect(buf.canUndo).toBe(true);
    expect(buf.canRedo).toBe(true);
  });

  it('redo steps forward through history', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    buf.push({ age: 42 });
    buf.undo();
    const next = buf.redo();
    expect(next).toEqual({ age: 42 });
    expect(buf.canRedo).toBe(false);
  });

  it('undo at start returns null', () => {
    const buf = new UndoBuffer({ age: 40 });
    expect(buf.undo()).toBeNull();
  });

  it('redo at end returns null', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    expect(buf.redo()).toBeNull();
  });

  it('push after undo truncates future entries', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    buf.push({ age: 42 });
    buf.undo(); // back to 41
    buf.push({ age: 99 }); // should truncate 42
    expect(buf.length).toBe(3); // [40, 41, 99]
    expect(buf.redo()).toBeNull(); // no future
    buf.undo();
    expect(buf.undo()).toEqual({ age: 40 });
  });

  it('enforces maxDepth by trimming oldest entries', () => {
    const buf = new UndoBuffer(0, 5);
    for (let i = 1; i <= 10; i++) buf.push(i);
    expect(buf.length).toBe(5);
    // Oldest entries should be trimmed
    const first = buf.undo();
    expect(first).toBe(9);
  });

  it('clear resets to single entry at current position', () => {
    const buf = new UndoBuffer({ age: 40 });
    buf.push({ age: 41 });
    buf.push({ age: 42 });
    buf.clear();
    expect(buf.length).toBe(1);
    expect(buf.canUndo).toBe(false);
    expect(buf.canRedo).toBe(false);
  });

  it('deep clones state to prevent mutation', () => {
    const state = { nested: { value: 1 } };
    const buf = new UndoBuffer(state);
    state.nested.value = 999; // mutate original
    buf.push({ nested: { value: 2 } });
    const prev = buf.undo();
    expect(prev).toEqual({ nested: { value: 1 } }); // should be original, not mutated
  });

  it('debounce replaces current entry instead of adding new one', () => {
    const buf = new UndoBuffer({ age: 40 }, 50, 1000);
    // First push is always accepted (lastPush starts at 0)
    buf.push({ age: 41 });
    // Immediate second push should debounce (replace, not add)
    buf.push({ age: 42 });
    expect(buf.length).toBe(2); // [40, 42] not [40, 41, 42]
  });

  it('multiple undo/redo cycles are consistent', () => {
    const buf = new UndoBuffer('a');
    buf.push('b');
    buf.push('c');
    buf.push('d');
    expect(buf.undo()).toBe('c');
    expect(buf.undo()).toBe('b');
    expect(buf.redo()).toBe('c');
    expect(buf.undo()).toBe('b');
    expect(buf.undo()).toBe('a');
    expect(buf.undo()).toBeNull();
    expect(buf.redo()).toBe('b');
    expect(buf.redo()).toBe('c');
    expect(buf.redo()).toBe('d');
    expect(buf.redo()).toBeNull();
  });
});
