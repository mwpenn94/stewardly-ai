/**
 * automationTelemetry — pass 5, scope: browser/device automation parity.
 *
 * Fan-out event bus for the `NavigationTelemetryEvent` union (and any
 * future automation events — crawl steps, computer-use clicks, device
 * actions). Multiple sinks can subscribe at once, so a single fetch
 * emits to:
 *
 *   - An OpenTelemetry span exporter
 *   - The codeChat SSE stream (so the user watches fetches happen live)
 *   - A lightweight in-process logger
 *   - A debug panel that keeps the last N events
 *
 * The bus is:
 *   - Pure in-process (no queue persistence). Crash-resetting is fine.
 *   - Synchronous per sink, so a slow sink doesn't block a fast one —
 *     each sink is invoked inside a try/catch and never interrupts
 *     navigation.
 *   - `subscribe()` returns an unsubscribe handle. `subscribeOnce()`
 *     auto-unsubscribes after the first event.
 *   - Supports event-type filters: `subscribe({ types: ["request.network"] })`.
 *   - `snapshot()` returns the most recent N events stored in a ring
 *     buffer for debugging — the default buffer size is 200.
 */

import type { NavigationTelemetryEvent, NavigationTelemetrySink } from "./webNavigator";

export type AutomationEvent = NavigationTelemetryEvent;

export interface Subscription {
  id: number;
  unsubscribe(): void;
}

export interface SubscribeOptions {
  /** Only invoke sink for events whose `type` appears in this set. */
  types?: string[];
}

export interface AutomationTelemetryBusConfig {
  /** Ring buffer size for snapshot/debug inspection. Default 200. */
  bufferSize?: number;
}

type SinkFn = (ev: AutomationEvent) => void | Promise<void>;

interface Listener {
  id: number;
  fn: SinkFn;
  types: Set<string> | null;
}

export class AutomationTelemetryBus implements NavigationTelemetrySink {
  private listeners: Listener[] = [];
  private buffer: AutomationEvent[] = [];
  private readonly bufferSize: number;
  private nextId = 1;
  private droppedSinkErrors = 0;

  constructor(cfg: AutomationTelemetryBusConfig = {}) {
    this.bufferSize = Math.max(1, cfg.bufferSize ?? 200);
  }

  /** NavigationTelemetrySink contract — called by WebNavigator. */
  onEvent(event: AutomationEvent): void {
    this.publish(event);
  }

  publish(event: AutomationEvent): void {
    this.buffer.push(event);
    if (this.buffer.length > this.bufferSize) this.buffer.shift();
    for (const listener of this.listeners) {
      if (listener.types && !listener.types.has(event.type)) continue;
      try {
        const result = listener.fn(event);
        if (result && typeof (result as Promise<void>).catch === "function") {
          (result as Promise<void>).catch(() => {
            this.droppedSinkErrors++;
          });
        }
      } catch {
        this.droppedSinkErrors++;
      }
    }
  }

  subscribe(fn: SinkFn, opts: SubscribeOptions = {}): Subscription {
    const id = this.nextId++;
    const types = opts.types && opts.types.length > 0 ? new Set(opts.types) : null;
    this.listeners.push({ id, fn, types });
    return {
      id,
      unsubscribe: () => {
        const i = this.listeners.findIndex((l) => l.id === id);
        if (i >= 0) this.listeners.splice(i, 1);
      },
    };
  }

  subscribeOnce(fn: SinkFn, opts: SubscribeOptions = {}): Subscription {
    const sub = this.subscribe((ev) => {
      try {
        fn(ev);
      } finally {
        sub.unsubscribe();
      }
    }, opts);
    return sub;
  }

  snapshot(limit?: number): AutomationEvent[] {
    if (limit === undefined) return this.buffer.slice();
    const n = Math.max(0, limit);
    return this.buffer.slice(-n);
  }

  clear(): void {
    this.buffer = [];
  }

  listenerCount(): number {
    return this.listeners.length;
  }

  getStats(): { listeners: number; buffered: number; droppedSinkErrors: number } {
    return {
      listeners: this.listeners.length,
      buffered: this.buffer.length,
      droppedSinkErrors: this.droppedSinkErrors,
    };
  }
}

// ─── Process-global singleton ─────────────────────────────────────────

let _globalBus: AutomationTelemetryBus | null = null;

export function getAutomationTelemetryBus(): AutomationTelemetryBus {
  if (!_globalBus) _globalBus = new AutomationTelemetryBus();
  return _globalBus;
}

export function __resetAutomationTelemetryBus(): void {
  _globalBus = null;
}
