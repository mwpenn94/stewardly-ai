/**
 * usePopupQueue — Centralized popup priority system.
 *
 * Prevents multiple popups from stacking on top of each other,
 * especially on mobile where they block interaction. Only one popup
 * is shown at a time; dismissing it advances to the next in priority order.
 *
 * Priority (highest first):
 *   1. ConsentBanner  — legal requirement, must be shown first
 *
 * GuidedTour and WhatsNewModal have been removed. What's New content
 * is now surfaced through the ChangelogBell notification system, and
 * onboarding is handled via the notification bell.
 */
import { useSyncExternalStore } from "react";

type PopupId = "consent";

// Priority order — lower index = higher priority
const PRIORITY_ORDER: PopupId[] = ["consent"];

// ── Shared store (singleton outside React) ──────────────────────────

type PopupState = {
  /** Which popups want to show (have content/haven't been dismissed) */
  registered: Set<PopupId>;
  /** Which popup is currently active (visible) */
  active: PopupId | null;
};

let state: PopupState = {
  registered: new Set(),
  active: null,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function recalcActive() {
  // Find the highest-priority registered popup
  for (const id of PRIORITY_ORDER) {
    if (state.registered.has(id)) {
      state.active = id;
      emit();
      return;
    }
  }
  state.active = null;
  emit();
}

/** A popup calls this when it has content to show */
export function registerPopup(id: PopupId) {
  if (state.registered.has(id)) return;
  state.registered = new Set(state.registered);
  state.registered.add(id);
  recalcActive();
}

/** A popup calls this when it's been dismissed */
export function dismissPopup(id: PopupId) {
  if (!state.registered.has(id)) return;
  state.registered = new Set(state.registered);
  state.registered.delete(id);
  recalcActive();
}

function getSnapshot(): PopupId | null {
  return state.active;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// ── React hook ──────────────────────────────────────────────────────

/**
 * Returns whether this popup is allowed to render right now.
 * Usage:
 *   const canShow = usePopupSlot("consent");
 *   // In useEffect: registerPopup("consent") when you want to show
 *   // On dismiss:   dismissPopup("consent")
 */
export function usePopupSlot(id: PopupId): boolean {
  const active = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return active === id;
}
