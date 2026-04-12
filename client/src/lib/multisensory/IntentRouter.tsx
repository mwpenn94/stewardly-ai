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
          pil.giveFeedback("navigate.success", { label: "New conversation" });
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
            pil.playSound("mic_on");
          } else {
            announce("No chat input on this page", "assertive");
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
            pil.playSound("mic_off");
          } else {
            audioCompanion.resume();
            announce("Audio resumed", "polite");
            pil.playSound("mic_on");
          }
          return;

        case "audio.read_page":
          audioCompanion.readCurrentPage();
          announce("Reading page aloud", "polite");
          pil.playSound("mic_on");
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
          pil.playSound("mic_off");
          return;

        // ── Voice actions ──
        case "voice.toggle_hands_free":
          if (pil.handsFreeActive) {
            pil.exitHandsFree();
            announce("Hands-free mode off", "assertive");
            // exitHandsFree already plays mode_deactivate via PIL
          } else {
            pil.enterHandsFree();
            announce("Hands-free mode on. Say go to, followed by a page name.", "assertive");
            // enterHandsFree already plays mode_activate via PIL
          }
          return;

        case "voice.toggle_listening":
          // Pass 2: push-to-talk — listens for a single utterance, routes
          // it through PIL.processIntent, then stops. No-ops if hands-free
          // is already running so we don't interrupt the continuous loop.
          // Pass 5: listenOnce already plays mic_on internally via PIL.
          announce("Listening for one command", "polite");
          window.dispatchEvent(new CustomEvent("pil:listen-once"));
          return;

        // ── Accessibility ──
        case "a11y.show_shortcuts":
          window.dispatchEvent(new CustomEvent("toggle-help"));
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "?", bubbles: true }),
          );
          return;

        case "a11y.focus_main": {
          // Pass 6: tiered landmark discovery. Tries the strongest
          // landmark signals first, then degrades through less specific
          // selectors, finally falling back to the first focusable
          // element under #root if a page genuinely has no landmark.
          // This guarantees Alt+M does *something* on every page even
          // if the page author forgot to add <main>.
          const tiers = [
            "#main-content", // AppShell convention (pass 91)
            "#chat-main", // Chat.tsx convention
            "main", // HTML5 landmark
            "[role='main']", // ARIA landmark
            "[data-main]", // Custom annotation
            "#root > :first-child", // SPA root fallback
          ];
          let target: HTMLElement | null = null;
          for (const sel of tiers) {
            target = document.querySelector<HTMLElement>(sel);
            if (target) break;
          }
          if (target) {
            if (!target.hasAttribute("tabindex")) {
              target.setAttribute("tabindex", "-1");
            }
            target.focus({ preventScroll: false });
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

        case "a11y.next_heading":
        case "a11y.prev_heading": {
          // Pass 7: JAWS/NVDA/VoiceOver-style heading navigation. Walks
          // every h1–h6 element in DOM order, finds the one after (or
          // before) the currently-focused element, and moves focus to
          // it. Skips headings that are display:none or visibility:hidden.
          const forward = detail.intent === "a11y.next_heading";
          const headings = Array.from(
            document.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
          ).filter((el) => {
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden") return false;
            // Skip headings inside aria-hidden containers
            if (el.closest("[aria-hidden='true']")) return false;
            return true;
          });
          if (headings.length === 0) {
            announce("No headings found on this page", "assertive");
            return;
          }
          // Find the index of the heading nearest the current focus
          const current = document.activeElement as HTMLElement | null;
          let startIdx = -1;
          if (current) {
            startIdx = headings.findIndex(
              (h) => h === current || h.contains(current),
            );
          }
          let nextIdx: number;
          if (startIdx === -1) {
            // No current heading — jump to first (forward) or last (backward)
            nextIdx = forward ? 0 : headings.length - 1;
          } else if (forward) {
            nextIdx = (startIdx + 1) % headings.length;
          } else {
            nextIdx = (startIdx - 1 + headings.length) % headings.length;
          }
          const target = headings[nextIdx];
          if (!target.hasAttribute("tabindex")) {
            target.setAttribute("tabindex", "-1");
          }
          target.focus({ preventScroll: false });
          target.scrollIntoView({ block: "start", behavior: "smooth" });
          const level = target.tagName.toLowerCase();
          const text = (target.textContent || "").trim().slice(0, 80);
          announce(`${level.toUpperCase()}: ${text}`, "polite");
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
