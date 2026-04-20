/**
 * useUndoHistory — Undo/Redo ring buffer for any serializable state.
 *
 * Tracks state changes and allows stepping backward/forward through
 * the history. Designed for Wealth Engine calculator inputs where
 * users frequently experiment with different values.
 *
 * Features:
 *   - Configurable max history depth (default 50)
 *   - Debounced push to avoid flooding on rapid changes
 *   - Ctrl+Z / Ctrl+Shift+Z keyboard integration (opt-in)
 *   - Exposes canUndo/canRedo for UI indicators
 *   - Serialization-safe (deep clones via structuredClone)
 *   - Timestamped entries for session replay timeline (v8 Pass 5)
 *   - jumpTo(index) for timeline scrubber navigation
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface UndoHistoryOptions {
  /** Maximum number of history entries to keep. Default: 50 */
  maxDepth?: number;
  /** Minimum ms between pushes (debounce). Default: 300 */
  debounceMs?: number;
  /** Whether to listen for Ctrl+Z / Ctrl+Shift+Z globally. Default: false */
  enableKeyboard?: boolean;
}

export interface HistoryEntry<T> {
  state: T;
  timestamp: number;
  label?: string;
}

export interface UndoHistoryReturn<T> {
  /** Push a new state snapshot onto the history stack */
  push: (state: T, label?: string) => void;
  /** Step backward in history. Returns the previous state or null if at start. */
  undo: () => T | null;
  /** Step forward in history. Returns the next state or null if at end. */
  redo: () => T | null;
  /** Jump to a specific position in the history. Returns the state at that position. */
  jumpTo: (index: number) => T | null;
  /** Whether there are entries to undo */
  canUndo: boolean;
  /** Whether there are entries to redo */
  canRedo: boolean;
  /** Current position in the history (0-indexed) */
  position: number;
  /** Total number of entries in the history */
  length: number;
  /** Clear all history */
  clear: () => void;
  /** Get all timestamped entries for the session replay timeline */
  entries: HistoryEntry<T>[];
}

export function useUndoHistory<T>(
  initialState: T,
  options: UndoHistoryOptions = {},
): UndoHistoryReturn<T> {
  const { maxDepth = 50, debounceMs = 300, enableKeyboard = false } = options;

  // History is stored as a ref to avoid re-renders on every push
  const historyRef = useRef<HistoryEntry<T>[]>([
    { state: structuredClone(initialState), timestamp: Date.now() },
  ]);
  const positionRef = useRef(0);
  const lastPushTimeRef = useRef(0);

  // Force re-render trigger
  const [, setTick] = useState(0);
  const tick = useCallback(() => setTick(t => t + 1), []);

  const push = useCallback((state: T, label?: string) => {
    const now = Date.now();
    if (now - lastPushTimeRef.current < debounceMs) {
      // Debounce: replace the current entry instead of adding a new one
      historyRef.current[positionRef.current] = {
        state: structuredClone(state),
        timestamp: now,
        label: label || historyRef.current[positionRef.current]?.label,
      };
      tick();
      return;
    }
    lastPushTimeRef.current = now;

    // Truncate any "future" entries beyond current position
    historyRef.current = historyRef.current.slice(0, positionRef.current + 1);

    // Push new entry
    historyRef.current.push({
      state: structuredClone(state),
      timestamp: now,
      label,
    });

    // Enforce max depth
    if (historyRef.current.length > maxDepth) {
      historyRef.current = historyRef.current.slice(historyRef.current.length - maxDepth);
    }

    positionRef.current = historyRef.current.length - 1;
    tick();
  }, [maxDepth, debounceMs, tick]);

  const undo = useCallback((): T | null => {
    if (positionRef.current <= 0) return null;
    positionRef.current -= 1;
    tick();
    return structuredClone(historyRef.current[positionRef.current].state);
  }, [tick]);

  const redo = useCallback((): T | null => {
    if (positionRef.current >= historyRef.current.length - 1) return null;
    positionRef.current += 1;
    tick();
    return structuredClone(historyRef.current[positionRef.current].state);
  }, [tick]);

  const jumpTo = useCallback((index: number): T | null => {
    if (index < 0 || index >= historyRef.current.length || index === positionRef.current) return null;
    positionRef.current = index;
    tick();
    return structuredClone(historyRef.current[index].state);
  }, [tick]);

  const clear = useCallback(() => {
    const current = historyRef.current[positionRef.current];
    historyRef.current = [{ state: structuredClone(current.state), timestamp: Date.now() }];
    positionRef.current = 0;
    tick();
  }, [tick]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!enableKeyboard) return;
    const handler = (e: KeyboardEvent) => {
      // Skip if user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey ||
        (e.metaKey || e.ctrlKey) && e.key === 'y'
      ) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enableKeyboard, undo, redo]);

  // Also listen for the PIL undo event
  useEffect(() => {
    if (!enableKeyboard) return;
    const handler = () => { undo(); };
    window.addEventListener('pil:undo', handler);
    return () => window.removeEventListener('pil:undo', handler);
  }, [enableKeyboard, undo]);

  return {
    push,
    undo,
    redo,
    jumpTo,
    canUndo: positionRef.current > 0,
    canRedo: positionRef.current < historyRef.current.length - 1,
    position: positionRef.current,
    length: historyRef.current.length,
    clear,
    entries: historyRef.current,
  };
}
