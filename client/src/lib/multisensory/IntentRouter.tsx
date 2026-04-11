/**
 * IntentRouter — bridges `multisensory-intent` CustomEvents onto real
 * side-effects (navigation, PIL calls, TTS, focus management).
 *
 * Mounted once inside PILProvider so it has access to:
 *   - usePlatformIntelligence() for hands-free / audio / feedback
 *   - useLocation() (wouter) for navigation
 *   - useTTS() for speech
 *
 * The rest of the app dispatches intents via `dispatchIntent()` from
 * `useGlobalShortcuts.ts` (keyboard source), from the Chat slash-command
 * interceptor (text source), or programmatically from anywhere.
 *
 * This component renders nothing — it's an effect-only bridge.
 */

import { useEffect } from "react";
import { useLocation } from "wouter";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { announce } from "./LiveAnnouncer";
import { friendlyRouteName } from "./intentParser";
import type { IntentDetail } from "./useGlobalShortcuts";
import type { ShortcutIntent } from "./shortcuts";

const NAV_ROUTE_MAP: Partial<Record<ShortcutIntent, string>> = {
  "nav.chat": "/chat",
  "nav.operations": "/operations",
  "nav.intelligence": "/intelligence-hub",
  "nav.advisory": "/advisory",
  "nav.relationships": "/relationships",
  "nav.market_data": "/market-data",
  "nav.documents": "/documents",
  "nav.integrations": "/integrations",
  "nav.settings": "/settings",
  "nav.help": "/help",
  "nav.learning": "/learning",
  "nav.wealth_engine": "/wealth-engine",
  "nav.leads": "/leads",
  "nav.audio_settings": "/settings/audio",
};

export function IntentRouter() {
  const [, navigate] = useLocation();
  const pil = usePlatformIntelligence();
  const audioCompanion = useAudioCompanion();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<IntentDetail>).detail;
      if (!detail?.intent) return;

      // ── Navigation intents ──
      const route = NAV_ROUTE_MAP[detail.intent];
      if (route) {
        navigate(route);
        const label = friendlyRouteName(route);
        announce(`Navigated to ${label}`, "polite");
        pil.giveFeedback("navigate.success", { route, label });
        return;
      }

      switch (detail.intent) {
        // ── Chat actions ──
        case "chat.new":
          window.dispatchEvent(new CustomEvent("chat:new"));
          announce("New conversation started", "polite");
          return;

        case "chat.focus_input": {
          const input =
            document.querySelector<HTMLTextAreaElement>(
              "[data-testid='chat-input'], textarea[data-chat-input], textarea[name='chatInput']",
            ) ||
            document.querySelector<HTMLTextAreaElement>("main textarea");
          if (input) {
            input.focus();
            announce("Chat input focused", "polite");
          }
          return;
        }

        case "chat.toggle_sidebar":
          window.dispatchEvent(new CustomEvent("chat:toggle-sidebar"));
          return;

        // ── Audio actions ──
        case "audio.toggle_tts":
          if (audioCompanion.playing) {
            audioCompanion.pause();
            announce("Audio paused", "polite");
          } else {
            audioCompanion.resume();
            announce("Audio resumed", "polite");
          }
          return;

        case "audio.read_page":
          audioCompanion.readCurrentPage();
          announce("Reading page aloud", "polite");
          return;

        case "audio.stop_speech":
          audioCompanion.pause();
          // Guard against older browsers that expose `speechSynthesis` but
          // not `.cancel()`, and against SSR (no window).
          if (typeof window !== "undefined") {
            try {
              window.speechSynthesis?.cancel?.();
            } catch {
              /* cancel can throw on some Safari builds — fail silent */
            }
          }
          announce("Speech stopped", "assertive");
          return;

        // ── Voice actions ──
        case "voice.toggle_hands_free":
          if (pil.handsFreeActive) {
            pil.exitHandsFree();
            announce("Hands-free mode off", "assertive");
          } else {
            pil.enterHandsFree();
            announce("Hands-free mode on. Say go to, followed by a page name.", "assertive");
          }
          return;

        case "voice.toggle_listening":
          // Pass 2: push-to-talk — listens for a single utterance, routes
          // it through PIL.processIntent, then stops. No-ops if hands-free
          // is already running so we don't interrupt the continuous loop.
          announce("Listening for one command", "polite");
          void pil.listenOnce();
          return;

        // ── Accessibility ──
        case "a11y.show_shortcuts":
          window.dispatchEvent(new CustomEvent("toggle-help"));
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "?", bubbles: true }),
          );
          return;

        case "a11y.focus_main": {
          // Chat.tsx uses #chat-main, AppShell uses #main-content; both
          // are <main> landmarks. Pick whichever exists, then fall back
          // to the first <main> on the page.
          const main =
            document.querySelector<HTMLElement>("#main-content") ||
            document.querySelector<HTMLElement>("#chat-main") ||
            document.querySelector<HTMLElement>("main");
          if (main) {
            // Ensure focusable even if the element predates tabIndex
            if (!main.hasAttribute("tabindex")) {
              main.setAttribute("tabindex", "-1");
            }
            main.focus({ preventScroll: false });
            announce("Main content focused", "polite");
          } else {
            announce("No main content landmark found on this page", "assertive");
          }
          return;
        }

        case "a11y.focus_nav": {
          const nav =
            document.querySelector<HTMLElement>("nav[aria-label='Primary']") ||
            document.querySelector<HTMLElement>("nav[role='navigation']") ||
            document.querySelector<HTMLElement>("nav");
          if (nav) {
            nav.setAttribute("tabindex", "-1");
            nav.focus({ preventScroll: false });
            announce("Navigation focused", "polite");
          }
          return;
        }

        // ── General ──
        case "palette.open":
          window.dispatchEvent(new CustomEvent("toggle-command-palette"));
          return;
      }
    };

    window.addEventListener("multisensory-intent", handler);
    return () => window.removeEventListener("multisensory-intent", handler);
  }, [navigate, pil, audioCompanion]);

  return null;
}
