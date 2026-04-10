/**
 * Event Bus — In-memory typed event system for cross-module communication
 */
import { EventEmitter } from "events";

export type EventType =
  | "prompt.scored"
  | "goal.completed"
  | "provider.benchmarked"
  | "compliance.flagged"
  | "improvement.signal"
  | "autonomy.changed"
  | "memory.stored"
  | "config.updated";

export interface StewardlyEvent {
  type: EventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

class StewardlyEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit(type: EventType, payload: Record<string, unknown> = {}): void {
    const event: StewardlyEvent = { type, timestamp: Date.now(), payload };
    this.emitter.emit(type, event);
    this.emitter.emit("*", event); // wildcard for global listeners
  }

  on(type: EventType | "*", handler: (event: StewardlyEvent) => void): void {
    this.emitter.on(type, handler);
  }

  off(type: EventType | "*", handler: (event: StewardlyEvent) => void): void {
    this.emitter.off(type, handler);
  }

  once(type: EventType, handler: (event: StewardlyEvent) => void): void {
    this.emitter.once(type, handler);
  }
}

/** Singleton event bus */
export const eventBus = new StewardlyEventBus();

// ── Proactive Insights Listener ────────────────────────────────────
// Generates proactive_insights entries from compliance and memory events
// so the Chat welcome screen can surface actionable alerts.
eventBus.on("compliance.flagged", async (e) => {
  try {
    const { getDb } = await import("../../db");
    const { proactiveInsights } = await import("../../../drizzle/schema");
    const db = await getDb();
    if (!db) return;
    const userId = e.payload.userId as number;
    const flagged = e.payload.flagged as string[] | undefined;
    await db.insert(proactiveInsights).values({
      userId,
      category: "compliance",
      priority: "high",
      title: `Compliance flag: ${flagged?.join(", ") || "review needed"}`,
      description: "A compliance issue was detected in your recent conversation. Please review.",
      status: "new",
    });
  } catch { /* non-fatal — insight generation should never block */ }
});
