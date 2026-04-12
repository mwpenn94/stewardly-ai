/**
 * Client-side re-export of the shared life event detector in
 * `shared/lifeEventDetector.ts`. Keep this file as a thin
 * barrel — do NOT add new event types or detector logic here.
 * The shared module is the source of truth so server + client
 * see identical events.
 */

export type {
  LifeEvent,
  LifeEventKey,
  LifeEventSeverity,
} from "@shared/lifeEventDetector";
export {
  detectLifeEvents,
  summarizeEvents,
} from "@shared/lifeEventDetector";
