/**
 * sttSupport.ts — Browser capability probe for Web Speech Recognition
 *
 * Build Loop Pass 2 (G59). Prior to this module, every STT call site silently
 * returned when `SpeechRecognition` was undefined (Firefox desktop, Firefox
 * Android, pre-iOS-14.5 Safari, in-app WebViews) or when the combination of
 * options (`continuous: true`) wasn't actually supported (Safari iOS up to
 * 17.x silently rejects the toggle). Users saw a hands-free button that
 * "did nothing" — the worst kind of failure because they can't tell the
 * difference between "broken" and "mic blocked".
 *
 * This module centralizes:
 * 1. Feature detection (constructor presence)
 * 2. Per-browser capability hints (continuous, interim, push-to-talk)
 * 3. User-visible fallback copy (the "why it's not working" message)
 *
 * Pure-function module — takes a `navigator`-shaped argument + a `window`-
 * shaped argument so the tests can inject fakes. No direct `window` / `navigator`
 * access inside the exported helpers.
 */

export type SttMode =
  | "full"        // continuous listening, interim results, hands-free loop OK
  | "ptt_only"    // push-to-talk one-shot (single final result, no loop)
  | "unsupported"; // no SpeechRecognition constructor at all

export interface SttCapabilities {
  mode: SttMode;
  hasConstructor: boolean;
  supportsContinuous: boolean;
  supportsInterim: boolean;
  /** Stable UA family for the copy layer ("firefox" / "safari_ios" / "chrome" / "other"). */
  browserFamily: "chrome" | "firefox" | "safari_ios" | "safari_desktop" | "edge" | "unknown";
  /** Copy surfaced in the fallback banner. */
  userMessage: string;
  /** Longer recovery copy for the help tooltip / banner expansion. */
  recoveryHint: string;
}

interface ProbeWindow {
  SpeechRecognition?: unknown;
  webkitSpeechRecognition?: unknown;
}

interface ProbeNavigator {
  userAgent?: string;
  maxTouchPoints?: number;
}

/**
 * Detect the browser family from a user-agent string. Conservative: if we're
 * not confident, return "unknown" so the fallback copy stays generic.
 */
export function detectBrowserFamily(nav: ProbeNavigator): SttCapabilities["browserFamily"] {
  const ua = (nav.userAgent || "").toLowerCase();
  if (!ua) return "unknown";

  // Edge (Chromium) identifies as "edg/" — check before Chrome.
  if (ua.includes("edg/")) return "edge";

  // Firefox desktop + mobile.
  if (ua.includes("firefox") || ua.includes("fxios")) return "firefox";

  // iOS Safari — iPad on iOS 13+ reports as "Macintosh" with touch, so we
  // also check maxTouchPoints as a second signal.
  const isIOS =
    ua.includes("iphone") ||
    ua.includes("ipad") ||
    ua.includes("ipod") ||
    (ua.includes("macintosh") && (nav.maxTouchPoints ?? 0) > 1);
  if (isIOS && (ua.includes("safari") || ua.includes("crios") || ua.includes("fxios"))) {
    // Chrome for iOS + Firefox for iOS also run on Safari WebKit; the STT
    // constraints are the same so we bucket them together.
    return "safari_ios";
  }

  // Safari desktop.
  if (ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium")) {
    return "safari_desktop";
  }

  // Chrome / Chromium / Brave / Opera.
  if (ua.includes("chrome") || ua.includes("chromium") || ua.includes("crios")) {
    return "chrome";
  }

  return "unknown";
}

/**
 * Compute capabilities from a window + navigator shape.
 *
 * Rules:
 * - Firefox (any platform) has no SpeechRecognition constructor → unsupported.
 * - Safari iOS has webkitSpeechRecognition but `continuous: true` silently
 *   fails → ptt_only.
 * - Safari desktop works but doesn't support `continuous` reliably until
 *   17.4 → treat as ptt_only (conservative).
 * - Chrome / Edge / Chromium: full support.
 * - Anything else with a constructor: assume ptt_only (safe fallback).
 */
export function computeSttCapabilities(
  win: ProbeWindow,
  nav: ProbeNavigator,
): SttCapabilities {
  const family = detectBrowserFamily(nav);
  const hasConstructor =
    typeof win.SpeechRecognition !== "undefined" ||
    typeof win.webkitSpeechRecognition !== "undefined";

  if (!hasConstructor) {
    return {
      mode: "unsupported",
      hasConstructor: false,
      supportsContinuous: false,
      supportsInterim: false,
      browserFamily: family,
      userMessage:
        family === "firefox"
          ? "Firefox doesn't support browser speech recognition yet."
          : "Your browser doesn't support speech recognition.",
      recoveryHint:
        family === "firefox"
          ? "Open this page in Chrome, Edge, or Safari to use voice input. You can still type or use keyboard shortcuts — press ? to see them."
          : "Try Chrome, Edge, or Safari, or use keyboard input. Press ? for shortcuts.",
    };
  }

  if (family === "safari_ios" || family === "safari_desktop") {
    return {
      mode: "ptt_only",
      hasConstructor: true,
      supportsContinuous: false,
      supportsInterim: family === "safari_desktop",
      browserFamily: family,
      userMessage:
        family === "safari_ios"
          ? "Hold-to-talk voice input is supported on iOS Safari."
          : "Hold-to-talk voice input is supported on Safari.",
      recoveryHint:
        "Hands-free continuous listening isn't available. Hold the mic button while you speak, release to send. Press ? for shortcuts.",
    };
  }

  if (family === "chrome" || family === "edge") {
    return {
      mode: "full",
      hasConstructor: true,
      supportsContinuous: true,
      supportsInterim: true,
      browserFamily: family,
      userMessage: "Hands-free voice mode available.",
      recoveryHint: "Tap the mic button or say a command.",
    };
  }

  // Unknown browser with a constructor — be conservative and offer PTT.
  return {
    mode: "ptt_only",
    hasConstructor: true,
    supportsContinuous: false,
    supportsInterim: false,
    browserFamily: family,
    userMessage: "Push-to-talk voice input available.",
    recoveryHint:
      "Continuous listening isn't confirmed for this browser. Hold the mic button while speaking.",
  };
}

/**
 * Runtime-convenience wrapper that reads from the global `window` / `navigator`.
 * Safe to call in SSR paths (returns "unsupported" if window is undefined).
 */
export function detectStt(): SttCapabilities {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      mode: "unsupported",
      hasConstructor: false,
      supportsContinuous: false,
      supportsInterim: false,
      browserFamily: "unknown",
      userMessage: "Speech recognition unavailable.",
      recoveryHint: "This environment doesn't support speech recognition.",
    };
  }
  return computeSttCapabilities(
    window as unknown as ProbeWindow,
    navigator as unknown as ProbeNavigator,
  );
}

/**
 * Convenience — true if the user can at minimum push-to-talk.
 */
export function canUseAnySstMode(caps: SttCapabilities): boolean {
  return caps.mode !== "unsupported";
}
