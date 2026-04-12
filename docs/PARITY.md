# PARITY.md — Stewardly Build Loop Work Queue

> Canonical parity tracking doc. Written in parallel by multiple build-loop
> processes. Always re-read immediately before writing. Merge, don't overwrite.
>
> This file carries **three independent tracks** that build-loop passes run
> against. Each track has its own ID namespace — multisensory uses `G1..G68`
> (no dash), learning uses `G-1..G-N` (with dash), automation uses
> `AU-1..AU-N`. Passes from any track append to their own section and
> leave the others alone.

## Tracks

- **Track A — Multisensory / Accessibility** — voice + keyboard + screen
  reader + touch + haptics. Branches: `claude/multisensory-accessible-ui-zmjLP`,
  `claude/parity-accessibility-optimization-wPhiw`.
- **Track B — Learning Experience** — SRS flow, cross-track study, quiz
  and flashcard runners, importer resilience, agent tool coverage.
  Branches: learning track build loops.
- **Track C — AI Chat + Agentic Automation** — browser/device automation
  primitives (WebNavigator, webExtractor, robotsPolicy, responseCache,
  crawlSession, telemetry bus, SSE stream, parallelFetch) to push beyond
  Claude/Manus comparables. Branch: `claude/ai-chat-optimization-loop-unMju`.
  Uses `AU-1..AU-N` ID namespace.

---

# Track A — Multisensory / Accessibility

## Meta

- **Last updated:** 2026-04-11 by `claude/multisensory-accessible-ui-zmjLP` Build Loop Pass 1 (seeded from `claude/parity-accessibility-optimization-wPhiw` Pass 3)
- **Comparable benchmark:** best-in-industry multisensory + accessibility leaders — ChatGPT Advanced Voice, Google Gemini Live, Claude.ai voice mode, Linear, Superhuman, Raycast, Arc Browser, Apple VoiceOver + Voice Control, Google TalkBack, NVDA / JAWS, Speechify / Eleven Labs, Perplexity voice, Notion
- **Core purpose:** A 5-layer AI financial advisory platform that every user — sighted, blind, deaf, low-vision, motor-impaired, or hands-busy — can operate fluently via voice, keyboard, screen reader, touch, or any combination, with delight on every modality.
- **Target user:** Financial advisors, clients, and learners across the full accessibility spectrum, including users operating the app hands-free (driving, cooking, walking) and users on assistive tech (VoiceOver, TalkBack, NVDA, JAWS, Voice Control).
- **Success metric:** Every critical task (send chat, read response, navigate, take a recommended action, celebrate a win) is completable — and feels delightful — via voice alone, keyboard alone, screen reader alone, touch alone, or any mix, without requiring modality switches.
- **Starting baseline commit (Pass 1):** `6086236a24bc4532140ea7f4261902b50c169404`
- **Current parity score:** **54%** (Pass 3 — further downgraded after adversarial pass surfaced 10 new gaps including 2 CRITICAL: Firefox/Safari-iOS silent-fail STT paths and WCAG 2.4.3 focus-lost-on-nav failure. This is an honest re-baseline, not a code regression.)
- **Dimension scorecard (v2 ten dimensions):**
  - CoreFunction: 8.0 — app accomplishes its core advisory purpose reliably
  - UI: 8.0 — Stewardship Gold visual identity is late-stage polished
  - UX: 7.0 — many delightful flows but multisensory layer is inert AND Settings surface lies to users
  - Usability: 5.5 — Pass 2 depth finding: AppearanceTab writes 6 keys that nothing reads (theme / accent / font / density / motion / sidebar all silent-fail)
  - Digestibility: 7.5 — nav architecture is clear; PersonaSidebar5 is a differentiator
  - Delightfulness: 5.5 — 30 feedback event keys defined, 0 dispatched
  - Flexibility: 5.5 — Pass 2 finding: user customization surface is Potemkin
  - Performance: 8.0 — builds clean, bundle split, SSE streaming is fast
  - Robustness: 7.0 — 3,103+ tests but user-visible "Save Preferences" button creates false confidence
  - CodeQuality: 8.0 — consistent patterns but dead code (AppShell sidebarContent unreachable)
  - **Composite (Pass 3):** 6.75 (−0.25 from Pass 2 after adversarial surfacing of 10 hidden failures; 2 now CRITICAL for WCAG + cross-browser)

## Gap Matrix

Legend: Priority P0 (ship-blocker) → P3 (polish). Effort: S (≤1 day) / M (1–3 days) / L (1 week) / XL (>1 week). Aligned: does closing this gap serve the core purpose?

| ID | Feature | Present? | Depth | Priority | Effort | Aligned | Owner | Status |
|----|---------|----------|-------|----------|--------|---------|-------|--------|
| G1 | Multisensory feedback layer actually triggered | ⚠ Chat + PIL + 10 learning/engine/onboarding consumers wired (Build Loop P1 + P16) | 7/10 | P0 | M | Yes | Build Loop | in_progress |
| G2 | Theme actually switchable (light / dark / system) | ✓ fixed (Build Loop P4) | 9/10 | P0 | M | Yes | Build Loop | done |
| G3 | aria-live announces actual streamed content (not just "AI is responding") | ✓ fixed (Build Loop P5) | 9/10 | P0 | S | Yes | Build Loop | done |
| G4 | Captions / visible transcript during TTS playback (WCAG 1.2.1-A) | ✓ fixed (Build Loop P5) | 8/10 | P0 | S | Yes | Build Loop | done |
| G5 | Voice command dispatch beyond navigation (send, new chat, bookmark, open palette, cancel, stop, undo) | ⚠ partial — send/new_chat/palette/cancel/stop/undo shipped, bookmark still open | 7/10 | P0 | M | Yes | Build Loop | in_progress |
| G6 | Realtime conversational voice mode (full-duplex, interruptible) | ❌ | 0/10 | P1 | XL | Yes | — | open |
| G7 | Push-to-talk / hold-to-dictate one-shot mode | ✓ shipped `usePushToTalk` + `PushToTalkButton` (Build Loop P10) | 9/10 | P1 | S | Yes | Build Loop | done |
| G8 | PIL context consumed anywhere in app | ⚠ 10 new consumers via sendFeedback helper (Build Loop P16) — Chat, PIL, PTT, Quiz, Flashcard, DueReview, Exam, CaseStudy, Onboarding, AudioPrefs, CodeChat, Retirement, FinancialTwin | 7/10 | P0 | S | Yes | Build Loop | in_progress |
| G9 | Light theme CSS tokens | ✓ fixed (Build Loop P4) | 9/10 | P1 | M | Yes | Build Loop | done |
| G10 | `@media (prefers-contrast: more)` override | ✓ fixed (Build Loop P4) | 7/10 | P1 | S | Yes | Build Loop | done |
| G11 | `@media (forced-colors: active)` override (Windows HC mode) | ✓ fixed (Build Loop P4) | 7/10 | P1 | S | Yes | Build Loop | done |
| G12 | User-adjustable text size / zoom / density | ✓ fixed (Build Loop P4) | 8/10 | P1 | M | Yes | Build Loop | done |
| G13 | Color-blind friendly mode / color-independent state indicators | ✓ shipped 5-mode picker + pattern adornments + chart recolor (Build Loop P10) | 8/10 | P2 | M | Partial | Build Loop | done |
| G14 | ROUTE_MAP covers every major destination | ⚠ improved in P7 (CommandPalette now covers nav+extras; PIL ROUTE_MAP still independent) | 7/10 | P1 | S | Yes | Build Loop | in_progress |
| G15 | Global "read this page aloud" keyboard shortcut | ✓ fixed (Build Loop P6) | 9/10 | P1 | S | Yes | Build Loop | done |
| G16 | "Open command palette" voice command | ❌ | 0/10 | P1 | S | Yes | — | open |
| G17 | Voice input inside CommandPalette (say query instead of type) | ✓ PTT hold + Shift+Space (Build Loop P13) | 9/10 | P1 | S | Yes | Build Loop | done |
| G18 | Universal focus trap / restore for modals | ⚠ cmdk only | 5/10 | P1 | M | Yes | — | open |
| G19 | Landmark roles beyond `<main>` / `<nav>` | ✓ AppShell header=banner + main aria-label + Chat main aria-label (Build Loop P14) | 8/10 | P2 | S | Partial | Build Loop | done |
| G20 | Icon-only button aria-label coverage on newer components | ⚠ 30+ added in prior passes, spot audit due | 7/10 | P2 | S | Yes | — | open |
| G21 | Haptic feedback actually triggered | ⚠ wired, zero callers | 1/10 | P1 | S | Yes | — | open |
| G22 | Celebration on non-learning wins (goal completed, compliance passed, report generated) | ✓ 4 new feedback specs + compliance.check_passed upgraded to celebration (Build Loop P11) | 8/10 | P1 | S | Yes | Build Loop | done |
| G23 | Audio earcons on send / receive / error / navigation | ⚠ defined, never fires | 2/10 | P1 | S | Yes | — | open |
| G24 | Discoverable hands-free button (always visible in Chat input bar) | ⚠ hidden when user types | 5/10 | P1 | S | Yes | — | open |
| G25 | Keyboard shortcut to toggle hands-free from anywhere | ✓ fixed Shift+V (Build Loop P6) | 9/10 | P1 | S | Yes | Build Loop | done |
| G26 | Global keyboard shortcut for "read current page" | ✓ fixed Shift+R (Build Loop P6) | 9/10 | P1 | S | Yes | Build Loop | done |
| G27 | Shortcut hints rendered inside tooltips (not just in overlay) | ⚠ partial | 5/10 | P2 | M | Yes | — | open |
| G28 | Word-level highlighting during TTS (karaoke) | ❌ | 0/10 | P2 | M | Yes | — | open |
| G29 | TTS resume-from-position across page reloads | ❌ | 0/10 | P3 | M | No | — | open |
| G30 | Download TTS audio as MP3 for offline listening | ❌ | 0/10 | P3 | S | No | — | open |
| G31 | i18n library + translation keys | ❌ | 0/10 | P2 | XL | Partial | — | open |
| G32 | RTL support | ❌ | 0/10 | P3 | L | Partial | — | open |
| G33 | CommandPalette indexes ALL pages (derived from navigation.ts) | ✓ fixed (Build Loop P7) | 9/10 | P2 | S | Yes | Build Loop | done |
| G34 | CommandPalette surfaces recent pages (not just conversations) | ✓ fixed + role-filtered (Build Loop P7) | 9/10 | P2 | S | Yes | Build Loop | done |
| G35 | aria-busy on React Query loading regions | ✓ Chat main + AppShell global pil:busy/pil:idle signal (Build Loop P14) | 8/10 | P2 | S | Yes | Build Loop | done |
| G36 | role="tablist" / tabpanel on custom tab UIs | ⚠ shadcn yes, bespoke no | 6/10 | P2 | S | Yes | — | open |
| G37 | aria-describedby linking form errors to inputs | ✓ `FormField` render-prop wrapper (Build Loop P13) — per-page migration ongoing | 7/10 | P2 | M | Yes | Build Loop | in_progress |
| G38 | Skip-to-content link renders on every page (incl. Chat, non-AppShell pages) | ⚠ AppShell only | 7/10 | P2 | S | Yes | — | open |
| G39 | Focus ring not clipped by `overflow: hidden` containers | ⚠ untested | 8/10 | P3 | S | Yes | — | open |
| G40 | Pull-to-refresh on mobile list views | ❌ | 0/10 | P3 | M | No | — | open |
| G41 | Mobile bottom tab quick-access to Voice / Audio | ✓ Voice tab in mobile bottom bar (Build Loop P12) | 9/10 | P2 | S | Yes | Build Loop | done |
| G42 | Earcon on keyboard chord trigger / palette open | ✓ `earcons.ts` + playEarconById on chord_primed / chord_matched / palette_open / palette_close (Build Loop P12) | 9/10 | P3 | S | Yes | Build Loop | done |
| G43 | Audible token-streaming tick | ❌ | 0/10 | P3 | M | No | — | open |
| G44 | Voice barge-in during in-progress TTS | ⚠ `stop` word only | 5/10 | P2 | M | Yes | — | open |
| G45 | System font-scale / dynamic type inheritance verified at 200% zoom | ⚠ untested | 6/10 | P2 | S | Yes | — | open |
| G46 | Color contrast audit across all tokens (muted-foreground, destructive, chart-3/4/5) | ✓ muted-foreground + destructive bumped for WCAG AA (Build Loop P14) | 9/10 | P2 | S | Yes | Build Loop | done |
| G47 | First-run voice onboarding moment | ✓ shipped `VoiceOnboardingCoach` (Build Loop P11) | 9/10 | P2 | S | Yes | Build Loop | done |
| G48 | `::selection` color styling in brand palette | ❌ | 0/10 | P3 | S | No | — | open |
| G49 | Error boundary audio cue + "reload" voice command | ✓ TTS on catch + R-key + voice "reload/retry/try again" (Build Loop P11) | 9/10 | P3 | S | Yes | Build Loop | done |
| G50 | Voice onboarding tutorial inside OnboardingFlow | ❌ | 0/10 | P2 | M | Yes | — | open |
| G51 | AppearanceTab Potemkin UI — 6 controls save to `wb_*` keys that nothing reads (`AppearanceTab.tsx:47-55`) | ✓ fixed (Build Loop P4) | 9/10 | P0 | M | Yes | Build Loop | done |
| G52 | CommandPalette `PAGES` list drifts from `navigation.ts` — missing ~15 routes (/financial-twin, /code-chat, /learning, /workflows, /consensus, /achievements, /my-work, /settings/* subroutes) (`CommandPalette.tsx:45-67`) | ✓ fixed (Build Loop P7) | 10/10 | P1 | S | Yes | Build Loop | done |
| G53 | CommandPalette shows "G R / G M / G D / G N / G A" shortcut hints (`CommandPalette.tsx:50-55`) but only `g+h / g+s / g+c / g+i / g+l / g+o` are wired in `useKeyboardShortcuts.ts:20-32` — **hints are lies** | ✓ KeyboardShortcuts overlay now only lists wired shortcuts (Build Loop P6); CommandPalette PAGES list still needs P7 | 6/10 | P1 | S | Yes | Build Loop | in_progress |
| G54 | PIL bypasses its own dispatcher — `PlatformIntelligence.tsx:333-348` calls `SOUNDS.mode_activate()` + `speakShort()` directly instead of `dispatchFeedback("handsfree.activated")`; architecturally inconsistent (provider consumes itself but not via the public API) | ✓ fixed (Build Loop P1) | 8/10 | P1 | S | Yes | Build Loop | done |
| G55 | Dual chord handlers — `useKeyboardShortcuts.ts:57-61` AND `AppShell.tsx:185-215` both watch for "g" chords; should consolidate into `useCustomShortcuts` (which is customizable) | ⚠ redundant | 5/10 | P2 | M | Yes | — | open |
| G56 | `AppShell.tsx` has ~200 lines of `sidebarContent` / `renderNavItem` render code (lines 322-528) that's unreachable because `PersonaSidebar5` replaced it at line 552 — dead code | ✓ deleted (Build Loop P9) — 300 lines removed + 40 unused imports | 10/10 | P2 | S | No | Build Loop | done |
| G57 | Accent color selector offers 6 colors (`AppearanceTab.tsx:10-17`) that don't exist in the Stewardship Gold theme — selecting "Rose" does nothing | ✓ removed in Build Loop P4 (brand-locked) | 10/10 | P1 | S | No | Build Loop | done |
| G58 | No keyboard shortcut to open CommandPalette documented in `useKeyboardShortcuts.ts` — Ctrl+K is wired inside `CommandPalette.tsx:147` only; not listed in the `?` help overlay as a chord | ✓ fixed (Build Loop P6) | 9/10 | P2 | S | Yes | Build Loop | done |
| G59 | **CRITICAL — Firefox has zero SpeechRecognition support; Safari iOS blocks `recognition.continuous=true`** (`useVoiceRecognition.ts:147-150` silently returns; `PlatformIntelligence.tsx:290-291` silently returns; `LiveChatMode.tsx:96-99` sets internal error but no toast/banner for users) — hands-free button in Firefox is a dead button | ✓ fixed Chat surface (Build Loop P2) · other consumers still need update | 7/10 | P0 | M | Yes | Build Loop | in_progress |
| G60 | **CRITICAL — Keyboard focus is not restored to `#main-content` after route change** (`AppShell.tsx:131-134` closes mobile sidebar + records page visit but never calls `document.getElementById("main-content")?.focus()`); SR users navigating via g-chord hear nothing about the new page — WCAG 2.4.3 Focus Order failure | ✓ fixed (Build Loop P3) | 9/10 | P0 | S | Yes | Build Loop | done |
| G61 | Voice "stop" command pauses TTS playback but does **not** abort SSE stream (`PlatformIntelligence.tsx:232-234` → `audioCompanion.pause()` → `AudioCompanion.tsx:184-188` only cancels `speechSynthesis` + HTML audio; `Chat.tsx:873-990` SSE loop keeps running); user says "stop" then a new prompt → answers interleave | ✓ fixed (Build Loop P5) | 8/10 | P1 | M | Yes | Build Loop | done |
| G62 | Network drop mid-SSE-stream → infinite spinner; no `navigator.onLine` check, no timeout, aria-live region stays stuck on "AI is responding…" (`Chat.tsx:873-990`, `Chat.tsx:1818`); `OfflineBanner.tsx` exists but isn't wired into Chat streaming | ✓ fixed (Build Loop P8) | 9/10 | P1 | M | Yes | Build Loop | done |
| G63 | Dual keyboard chord handlers on "g" create a race (`AppShell.tsx:184-215` AND `useKeyboardShortcuts.ts:57-61` both attach `window.keydown`); neither calls `preventDefault()` on match → possible double-navigation | ✓ fixed (Build Loop P8) | 9/10 | P1 | S | Yes | Build Loop | done |
| G64 | `framer-motion` animations ignore `prefers-reduced-motion` unless explicitly wrapped in ReducedMotion context (`AudioCompanion.tsx:287,319` use `<motion.div>` without `reduceMotion="user"` prop); OS-level preference is honored by CSS but not by framer-motion components | ✓ fixed via useReducedMotion hook (Build Loop P9) | 9/10 | P1 | S | Yes | Build Loop | done |
| G65 | AudioCompanion queue is in-memory `useState` only (`AudioCompanion.tsx:74-84`); navigating routes doesn't lose it (provider is at App.tsx root) but a full page reload discards queue + position → user re-starts from scratch on every refresh | ✓ fixed with localStorage + defensive parse + 50-item cap (Build Loop P9) | 9/10 | P2 | M | No | Build Loop | done |
| G66 | Disabled button state color contrast likely fails WCAG AA (`opacity-50` default from shadcn/ui button yields ~3.8:1 against `--card` — below 4.5:1 threshold); no explicit disabled-state token in `index.css` | ✓ bumped to opacity 0.65 + dashed border pattern in color-blind mode (Build Loop P10) | 9/10 | P2 | S | Yes | Build Loop | done |
| G67 | CommandPalette doesn't filter PAGES by user role — user with `user` role sees "Global Admin" and "Manager Dashboard" entries (`CommandPalette.tsx:45-67` has no `hasMinRole` filter unlike `AppShell.tsx:219-220`); clicking them leads to 403 pages | ✓ fixed (Build Loop P7) | 10/10 | P2 | S | Yes | Build Loop | done |
| G68 | Focus trap stack conflict — CommandPalette synthesizes a `?` keydown (`CommandPalette.tsx:95-98`) to open KeyboardShortcutsOverlay; both dialogs mount simultaneously and both try to trap focus; whichever mounts last wins and the other's trap is broken | ✓ fixed (Build Loop P8) | 9/10 | P2 | M | Yes | Build Loop | done |

**Summary (Pass 3 updated):** P0 = 8 (G1, G2, G3, G4, G8, G51, **G59, G60**) · P1 = 26 (+G61, G62, G63, G64) · P2 = 24 (+G65, G66, G67, G68) · P3 = 8 · **Total = 66**

### Pass 3 Adversarial Insight — Cross-browser, Focus-on-Nav, Offline

The adversarial pass surfaced 10 silent-failure classes that earlier passes missed because they assumed Chrome-on-desktop, online, sighted-mouse users. The **two CRITICAL items (G59, G60)** directly violate the parity target "max accessibility via conversational hands-free and text navigation":
- G59 (Firefox / Safari iOS): the hands-free button exists but fails silently for ~25% of real users. **The feature the comparable target is named after doesn't work in a quarter of browsers.**
- G60 (Focus on nav): SR users navigating with g-chords get zero announcement of where they arrived. **Keyboard + SR users cannot orient themselves in the app.** This is a WCAG 2.4.3 Level A failure — a ship blocker for any accessibility claim.

The remaining 8 gaps are HIGH/MED and form a "robustness under real-world conditions" theme: streaming abort doesn't abort, network drop hangs forever, chord handlers race, framer-motion ignores user motion preference, disabled states fail contrast. These are the classes of bugs that only surface when someone actively tries to break the app — hence why no prior optimization pass caught them.

**Critical insight — the P0 cluster is actually ONE root cause:** G1, G8, G21, and G23 all fail because `usePlatformIntelligence` / `giveFeedback` have zero consumers. Fixing the PIL consumer pattern (5–10 call sites in Chat.tsx, handleSend, TTS onEnd, error toasts, action completions, celebrations) unlocks haptics + earcons + celebrations + voice-driven feedback simultaneously. Highest leverage fix in the matrix.

**Pass 2 Depth Insight — 30 event specs, 0 call sites:** `client/src/lib/feedbackSpecs.ts` defines 30 fully-designed multimodal feedback specs (`chat.sent`, `chat.streaming_start`, `chat.error`, `learning.answer_correct`, `learning.exam_complete`, `compliance.check_passed`, `document.uploaded`, `audio.speed_changed`, `voice.listening_started`, `advisor.recommendation_delivered`, `calculator.result`, `codechat.connected`, `onboarding.step_complete`, etc.) — each with visual + audio + haptic triads. Zero of them are dispatched. File-level recipe to unlock all 30 in ~14 call sites across ~12 files:

| Feedback key | Dispatch site | File |
|---|---|---|
| `chat.sent` | `handleSend` after user message append | `pages/Chat.tsx` |
| `chat.streaming_start` / `chat.streaming_end` | SSE start / done handlers | `pages/Chat.tsx` |
| `chat.error` | error toast path | `pages/Chat.tsx` |
| `chat.new_conversation` | createConversation mutation success | `pages/Chat.tsx` |
| `learning.answer_correct` / `learning.answer_incorrect` | quiz answer submit | `pages/learning/LearningQuizRunner.tsx` |
| `learning.exam_complete` | `finishExam()` | `pages/ExamSimulator.tsx` |
| `learning.case_complete` | case study final scene | `pages/CaseStudySimulator.tsx` |
| `learning.flashcard_flip` / `learning.srs_rating` / `learning.mastered` | flip / rate handlers | `pages/learning/LearningFlashcardStudy.tsx` |
| `learning.achievement_earned` | earned event handler | `pages/AchievementSystem.tsx` |
| `compliance.check_passed` / `compliance.flag_raised` | compliance pipeline | `pages/ComplianceAudit.tsx`, service layer |
| `document.uploaded` / `document.analyzed` | upload + analyze handlers | `pages/Documents*.tsx` |
| `audio.speed_changed` / `audio.preferences_saved` | adjustSpeed / save | `components/AudioCompanion.tsx`, `pages/settings/AudioPreferences.tsx` |
| `voice.listening_started` / `voice.listening_stopped` / `voice.not_understood` | hook callbacks | `components/PlatformIntelligence.tsx`, `hooks/useVoiceRecognition.ts` |
| `handsfree.activated` / `handsfree.deactivated` | PIL methods (currently bypass the dispatcher — G54) | `components/PlatformIntelligence.tsx` |
| `client.twin_updated` / `client.visibility_changed` | MyFinancialTwin mutations | `pages/MyFinancialTwin.tsx` |
| `advisor.client_added` / `advisor.recommendation_delivered` | client create / rec deliver | `pages/*Advisor*.tsx` |
| `calculator.result` | calculator compute | `pages/wealth-engine/*.tsx` |
| `codechat.connected` | github connect success | `pages/CodeChat.tsx` |
| `onboarding.step_complete` / `onboarding.complete` | OnboardingFlow transitions | `components/OnboardingFlow.tsx` |

**Pass 2 Depth Insight — AppearanceTab needs SEVEN fixes, not one:**
1. Wire `wb_theme` through to `ThemeProvider` (consume the localStorage key that's being written)
2. Add light-mode CSS token block (`:root:not(.dark)` or dedicated `.light` class) — currently `.dark` and `:root` are identical
3. Delete the accent color selector (or remove the 6 irrelevant colors and replace with just "Stewardship Gold" — the theme can only be one thing under the brand)
4. Wire font-size selector via `html { font-size: var(--user-scale, 16px) }` and set the CSS var from the localStorage value on mount
5. Wire chat density via a `--chat-density-scale` CSS var consumed by Chat message padding
6. Fix sidebar compact key mismatch — AppShell reads `appshell-collapsed`; AppearanceTab writes `wb_sidebar_compact`. Either rename the key in AppShell or have AppearanceTab write the correct key.
7. Remove or promote the reduced-motion toggle — either delete (CSS media query handles OS-level preference) or use it as a per-user override that wins over the media query.

## Beyond-Parity Opportunities

- **BP1. Five-layer persona navigation** (Person / Client / Advisor / Manager / Steward) — `PersonaSidebar5`. Role-aware IA most comparables never attempt. Keep + deepen (voice-dispatchable layer switching: "switch to manager view").
- **BP2. Edge TTS with 25+ neural voices** served from `/api/tts` — exceeds Web-Speech-only competitors. Add: inline voice preview in CommandPalette, per-content-type voice overrides in `AudioPreferences`.
- **BP3. Financial-term STT post-processing dictionary** (`useVoiceRecognition.ts:6-38`) with IUL / 401(k) / EBITDA / ChFC / IRMAA normalization — no general-purpose voice UI has this domain enrichment. Extend: server-side re-scoring of ambiguous terms against recent chat context.
- **BP4. Code Chat keyboard parity with VS Code** (⌘K palette, Plan Mode, /compact, bookmarks, outline rail, agent memory, 450+ tests, CLAUDE.md auto-loading) exceeds Cursor / Cline / Cloud-native agents. Backport the ⌘K action palette pattern to main Chat.
- **BP5. Stewardship Gold focus halo** (`index.css:207-215`) — dual-ring + 12px glow focus-visible — more delightful than browser default. Promote to a design system primitive and document in `docs/`.
- **BP6. G-chord chord navigation** (g+c, g+h, g+i …) with user rebinding — Linear / GitHub parity. Extend by accepting chord triggers via voice ("say g c").
- **BP7. Anonymous / guest chat mode** with graceful upgrade path — competitors force signup before any interaction; Stewardly lets visitors ask a question immediately then offers account creation on compelling output.

## Anti-Parity Rejections

- **AP1.** ChatGPT "Ask anything" hero with zero affordances — too minimalist for a compliance-sensitive advisor tool. The current role-aware WelcomeScreen with suggestion chips is correct.
  - *Rationale:* financial-advisor users need visible entry points to compliance / suitability / calculator flows, not a blank canvas.
- **AP2.** Always-listening background microphone (Cluely / Recall-style) — privacy + compliance nightmare for financial advice under SEC/FINRA recordkeeping. Explicit hands-free toggle is the correct model.
- **AP3.** Premium voice paywall (Speechify / Eleven Labs tier gating) — Edge TTS already delivers equivalent quality for free.
- **AP4.** Arc Browser replacing URL bar with command bar — we don't own a URL bar; CommandPalette as an overlay is correct.
- **AP5.** Fully autonomous voice dispatch of destructive actions (delete client, send outbound message, archive case) — under graduated autonomy + compliance review, destructive verbs MUST require a spoken confirmation phrase ("say 'confirm' to proceed") or a visible confirmation dialog. Do NOT copy general-purpose voice assistants' lax confirmation patterns for financial actions.
- **AP6.** Dark-pattern growth loops (forced email, pre-checked consent) — financial compliance + fair dealing.

## Reconciliation Log

_(append-only, one line per merge event)_

- 2026-04-11 · Pass 1 · no prior doc · no reconciliation needed
- 2026-04-11 · Pass 2 · no concurrent edits detected (sole writer) · no reconciliation needed
- 2026-04-11 · Pass 3 · no concurrent edits detected (sole writer) · no reconciliation needed

## Protected Improvements (anti-regression)

These behaviours must not be weakened without explicit user approval. Each line
references the pass that shipped it.

- **Build Loop Pass 14 — landmarks + busy signal + contrast:**
  - AppShell `<header role="banner">` + `<main aria-label>` +
    `aria-busy={globalBusy}` must stay. Landmark navigation is
    how SR users (VoiceOver Rotor / NVDA D-key / JAWS R-key) jump
    around the page without tabbing through every element.
  - `pil:busy` / `pil:idle` window events are the canonical busy
    signal. Pages with React Query long-poll should `dispatchEvent`
    these, not mutate component-local state.
  - `--muted-foreground` + `--destructive` MUST keep their Pass 14
    lightness bumps (0.68 from 0.62). Reverting pulls them below
    WCAG AA (4.5:1) on card backgrounds.
- **Build Loop Pass 13 — bi-modal input + form accessibility:**
  - `CommandPalette` must keep the PTT voice-input affordance +
    Shift+Space hold shortcut. Removing it regresses the bi-modal
    parity G17 established (voice is first-class, not bolt-on).
  - `FormField` must remain the canonical form-field wrapper. Don't
    add parallel error-rendering paths that skip the aria-describedby
    wiring — that's exactly what G37 catches.
  - The `role="alert"` + `aria-live="polite"` combination on the
    FormField error slot is intentional. role=alert makes SR users
    hear the error the instant it appears; polite means they won't
    be interrupted mid-word.
- **Build Loop Pass 12 — mobile thumb-reach + earcon layer:**
  - `client/src/lib/earcons.ts` is the ONLY place UI earcons should
    be synthesized. Don't re-introduce inline `new AudioContext()`
    calls in components — use `playEarconById(id)` so the user's
    `earconsMuted` setting is respected consistently.
  - `useKeyboardShortcuts` chord_primed + chord_matched earcons
    must keep firing. Removing them regresses the keyboard-only UX
    signal flow (users can't see chord state).
  - `AppShell` mobile bottom tab bar must keep the Voice tab.
    Replacing it with a generic "Menu" reintroduces G41 (no
    thumb-reach voice access on mobile). 44px min touch targets
    are WCAG 2.5.5 hard requirement — don't drop below.
- **Build Loop Pass 11 — onboarding + error recovery + delight depth:**
  - `VoiceOnboardingCoach` must keep its localStorage + STT-mode +
    route-suppression guards. Showing it on SignIn / Terms / Welcome
    reintroduces a confusing auth-interrupting flow.
  - `ErrorBoundary.componentDidCatch` TTS + voice listener setup must
    stay. Blind users + motor-impaired users rely on the spoken
    announcement + voice reload affordance when the app crashes.
  - `ErrorBoundary.componentWillUnmount` + state-transition teardown
    must stay — otherwise the speech recognition instance leaks
    across route changes.
  - `compliance.check_passed` must remain a `success_celebration`,
    not a plain toast. That was the Pass 11 upgrade fixing G22.
- **Build Loop Pass 10 — motor-impairment + color-independent indicators:**
  - `usePushToTalk` must keep `continuous=false`. Flipping it back
    to true reintroduces the Safari iOS silent-fail path G59 fixed.
  - `PushToTalkButton` must keep the 44×44 min touch target and the
    drag-off-cancels semantics (global pointerup / touchcancel
    listeners). Those are the WCAG 2.5.5 + natural-PTT UX contracts.
  - `body.color-blind-mode` ::after adornments must remain. Stripping
    them reintroduces G13 (red/green as only signal) regressions.
  - Disabled button opacity must stay at 0.65, NOT the shadcn default
    of 0.5 which fails WCAG AA against `--card` backgrounds.
- **Build Loop Pass 9 — dead code purge + persistence + reduced-motion:**
  - AppShell.tsx MUST NOT grow a parallel sidebar implementation —
    PersonaSidebar5 is the real sidebar. Re-introducing the old
    render helpers would reintroduce the G56 bundle bloat + the drift
    between two independent nav paths.
  - AudioCompanion `<motion.div>` initial/animate/transition props
    MUST keep the `useReducedMotion`-derived conditional. Pulling
    that guard reintroduces G64 (OS-level reduced-motion preference
    silently ignored by framer-motion).
  - AudioCompanion MUST NOT auto-play on mount. Rehydrate to PAUSED
    + MINIMIZED only. Auto-play is a UX anti-pattern and most
    browsers block it anyway.
- **Build Loop Pass 8 — offline resilience + single-winner keyboard race:**
  - Chat.tsx SSE pipeline MUST keep the offline short-circuit, the
    60s idle watchdog (reset on every token), and the offline-event
    listener that aborts the AbortController. Removing any of the
    three reintroduces G62 (infinite spinner on network drop).
  - `useKeyboardShortcuts` AND `AppShell` keydown handlers must keep
    the `e.defaultPrevented` guard. It's the only thing preventing
    both handlers from double-navigating on g-chord matches now that
    AppShell uses `useCustomShortcuts` and useKeyboardShortcuts has
    its own (smaller) canonical chord list.
  - `CommandPalette` "Keyboard shortcuts" action must dispatch
    `toggle-help` on document (not synthesize a `?` keydown). The
    setTimeout(…,0) + setOpen(false)-first ordering is the G68 fix.
  - `KeyboardShortcuts` help overlay must keep BOTH the `?` keydown
    listener AND the `toggle-help` CustomEvent listener — one is the
    direct user shortcut, the other is the programmatic open path.
- **Build Loop Pass 7 — CommandPalette single source of truth:**
  - `commandPaletteData.buildPages` must keep deriving from
    `TOOLS_NAV` / `ADMIN_NAV` / `UTILITY_NAV`. Do NOT re-introduce a
    parallel hardcoded PAGES list — that's the drift G33 + G52 fixed.
  - `hasMinRole(userRole, page.minRole)` filtering must remain on both
    the Pages section AND the Recent section (demoted users should not
    see entries they can no longer access — that's the G67 fix).
  - Shortcut hints must ONLY render for entries whose href is in
    `WIRED_G_CHORDS`. Fabricating G R / G M / G D / G N / G A hints
    again would re-introduce G53 (help overlay lies).
- **Build Loop Pass 6 — discoverable multisensory keybinds:**
  - Shift+V, Shift+R, Ctrl/Cmd+K must remain wired. They're the only
    non-g-chord keyboard shortcuts for the multisensory layer; removing
    them would invisibly break keyboard-first users.
  - `useKeyboardShortcuts` dispatches window events (`pil:toggle-
    handsfree` / `chat:toggle-handsfree` / `pil:read-page` /
    `toggle-command-palette`) instead of calling hooks directly — this
    pattern must be preserved so the same events carry voice commands
    AND keyboard shortcuts. A unified event bus is the whole point.
  - `KeyboardShortcuts.tsx SHORTCUTS` array must match the actually-
    wired shortcut set in `useKeyboardShortcuts.ts`. The help overlay
    lying to users (G53) is the specific regression we fixed.
- **Build Loop Pass 5 — live-streamed a11y + voice stop must abort:**
  - `liveAnnouncer.ts` helpers must stay pure (no DOM / no React hook
    access) so they remain unit-testable without jsdom.
  - Chat.tsx aria-live region must NOT revert to the stale "AI is
    responding…" stub — it must render `liveAnnouncement` so SR users
    get the answer sentence-by-sentence.
  - `pil:stop-stream` event handler in Chat must keep the
    `streamAbortRef.current?.abort()` + `setIsStreaming(false)` branch
    — removing either reintroduces the G61 interleaving bug.
  - `PlatformIntelligence.processIntent` voice verb regexes must stay
    above the generic "navigate" catch-all — pulling them below breaks
    voice vocabulary dispatch for hands-free users.
- **Build Loop Pass 4 — appearance settings as the single source of truth:**
  - All five appearance knobs (theme / fontScale / chatDensity /
    reducedMotion / sidebarCompact) MUST flow through
    `client/src/lib/appearanceSettings.ts`. Do not add parallel
    localStorage writes, do not add separate `useState` shadow copies in
    other components, do not re-introduce the `wb_accent_color` key —
    the Stewardship Gold brand accent is intentional and brand-locked.
  - The `.light` CSS token block in `index.css` must remain a *neutrals
    flip only*: background, card, popover, secondary, muted, border,
    input, sidebar. The semantic accents (primary/accent/destructive/
    chart-*) stay in the same family so the brand identity is
    unmistakable across modes.
  - `@media (prefers-contrast: more)` and `@media (forced-colors: active)`
    overrides must remain (G10/G11 regression guard — Windows HC mode
    users cannot operate the app without them).
  - `AppearanceTab` must NOT reintroduce a "Save Preferences" button.
    Instant-apply is the fix for G51 — a save button creates false
    confidence even when the code is correct.
- **Build Loop Pass 3 — focus-on-route-change (WCAG 2.4.3):**
  - `useFocusOnRouteChange` must remain wired into both AppShell (`main-content`) and Chat.tsx (`chat-main`). Removing either breaks
    keyboard + SR users who navigate via g-chord.
  - `focusMainRegion` must keep its active-input guard: if a user is
    typing in an `<input>` / `<textarea>` / `contenteditable`, we do NOT
    steal focus. Removing the guard causes HMR + route-replace bugs that
    throw the user's caret out of the chat input.
  - `announceRoute` must continue to clear + re-set the live region text
    so screen readers re-read identical labels (e.g. returning to /chat
    from /chat/123 both describe as "Chat" and SR should still announce).
- **Build Loop Pass 2 — cross-browser STT capability probe:**
  - `client/src/lib/sttSupport.ts` is the single source of truth for which
    STT mode the current browser can run. Do not add independent browser
    sniffing elsewhere — call `detectStt()` or accept `capabilities` from
    the `useVoiceRecognition` hook.
  - `useVoiceRecognition` **must not** silently return when the probe says
    unsupported; it must log a structured warning AND the caller must
    surface a user-visible banner via `VoiceSupportBanner` or an equivalent.
  - `Chat.tsx toggleHandsFree` **must not** activate hands-free on
    `mode === "unsupported"` — replacing the toast with a silent no-op is
    the specific regression G59 describes.
  - `recognition.continuous` / `recognition.interimResults` must be derived
    from the capability probe, not hard-coded to `true`.
- **Build Loop Pass 1 — PIL dispatcher consumer wire-up:**
  - `Chat.tsx handleSendWithText` now calls `pil.giveFeedback("chat.sent")`,
    `"chat.streaming_start"`, `"chat.streaming_end"`, `"chat.new_conversation"`,
    and `"chat.error"` (with auto-classified `code: NETWORK|RATE_LIMIT|AUTH_EXPIRED|GENERIC`).
    Do not remove or no-op these calls.
  - `PlatformIntelligence.tsx enterHandsFree / exitHandsFree / processIntent
    (voice not understood) / startListening / stopListening` now route
    through `giveFeedback` instead of calling `SOUNDS.*` / `speakShort`
    directly. Do not re-introduce the direct calls without also removing
    the dispatcher path — the consistency guarantee is the feature.

## Build Loop Pass Log

Append one line per pass: `Pass N · angle · queue · commit SHA · shipped · deferred`.

Pass 1 · angle: delightfulness + architectural-consistency · queue: G1 (PIL consumer pattern), G54 (PIL self-bypass) · commit SHA: 2d3fe3d · shipped: Chat.tsx 5 feedback dispatch sites + PlatformIntelligence.tsx 5 dispatcher-routed call sites + seed PARITY.md onto multisensory branch · deferred: G2–G68 remainder
Pass 2 · angle: cross-browser robustness + graceful degradation · queue: G59 (Firefox/Safari iOS STT silent-fail) · commit SHA: aa7c449 · shipped: `client/src/lib/sttSupport.ts` capability probe (chrome/firefox/edge/safari_ios/safari_desktop/unknown bucketing, 22 pure-function tests covering 8 real-world UA strings) + `client/src/components/VoiceSupportBanner.tsx` dismissible fallback banner (full + compact variants, role=status + aria-live=polite) + `useVoiceRecognition` hook returns `capabilities` + `isAvailable` + sets `continuous`/`interimResults` from capability probe + defence-in-depth warn-on-unsupported + `Chat.tsx` banner rendered above input bar, mic button rejects hands-free-activation on unsupported, warns once on PTT-only · deferred: PlatformIntelligence.tsx bare STT path (needs same guard), LiveSession/LiveChatMode consumers (still silent-fail), `MobileChatLayout` dead mic icon (OI5)

Pass 3 · angle: keyboard + screen-reader accessibility · queue: G60 (WCAG 2.4.3 focus restoration after nav) · commit SHA: fb63ce2 · shipped: `client/src/hooks/useFocusOnRouteChange.ts` pure-function helpers (describePath with longest-prefix match across 27 routes, focusMainRegion with active-input protection + SSR safety, announceRoute with lazy live-region creation + reuse) + React hook wired via `useLocation` + `requestAnimationFrame` defer so it fires after the new page mounts. Wired into AppShell.tsx (mainId="main-content") and Chat.tsx (mainId="chat-main"). `client/src/hooks/useFocusOnRouteChange.test.ts` — 15 unit tests with DI fakes for Document/active element/live region (pure-function hook helpers are testable without jsdom) · deferred: mobile route audit at 44px+ touch targets (G39), role=tablist audit (G36)

Pass 4 · angle: flexibility + customization (Potemkin UI fix) · queue: G2 / G9 / G10 / G11 / G12 / G51 / G57 · commit SHA: 06668b2 · shipped: `client/src/lib/appearanceSettings.ts` pure module (load/save/apply + computeBodyClassList pure helper + subscribeSystemTheme for prefers-color-scheme tracking) · `client/src/lib/appearanceSettings.test.ts` (9 tests covering system-resolved theme, explicit theme override, per-flag class list, combined flags, no duplication) · `client/src/contexts/ThemeContext.tsx` full rewrite — now consumes `wb_theme` key AppearanceTab actually writes, exposes settings/updateSettings/setTheme/preference, subscribes to OS dark-mode toggles for `system` preference · `client/src/pages/settings/AppearanceTab.tsx` full rewrite — every control is now directly wired to updateSettings, no save button lies, accent color selector deleted, every option has aria-label + aria-pressed via role="radio"/aria-checked, X-Large font scale added for low-vision users · `client/src/index.css` light-theme token block (cream background, deeper gold accent for contrast vs white, rewired chart-1..5, sidebar overrides, gold-tinted body gradient) + font-scale body classes (compact/default/comfortable/large/xlarge via calc(16px * var(--font-scale))) + chat-density body classes + reduced-motion-user class + @media (prefers-contrast: more) border/muted bumps + @media (forced-colors: active) override using CanvasText/Canvas/Highlight · deferred: PersonaSidebar5 compact mode CSS consumption (currently only AppShell-collapsed key is read by the old sidebar path; PersonaSidebar5 has its own collapsed prop), OS-level reduced-motion + user-level merge validation

Pass 5 · angle: screen reader + deaf/HoH accessibility + voice command depth · queue: G3 (aria-live streamed content), G4 (TTS captions WCAG 1.2.1-A), G5 (voice vocabulary depth), G61 (voice stop must abort SSE) · commit SHA: 93144f0 · shipped: `client/src/lib/liveAnnouncer.ts` (sentence-chunked incremental announcer — pure functions extractNewSentences / stripMarkdownForSpeech / shouldEmitChunk / finalChunk / createAnnouncerState) + `client/src/lib/liveAnnouncer.test.ts` (21 pure-function tests covering terminators, markdown strip, min-chunk-length guard, min-interval guard, state advance, finalChunk tail flush) + Chat.tsx wiring: announcerRef + liveAnnouncement + captionText state, SSE token loop feeds shouldEmitChunk, aria-live region now renders live sentences (debounced 800ms), visible caption panel above chat input renders during streaming AND TTS playback with dismiss button + AudioLines icon + role=region + aria-label. PIL event bus: `pil:stop-stream` (fixes G61 interleaving bug — voice "stop" now aborts SSE, clears streaming, stops captions, announces "Stopped"), `pil:send`, `pil:new-chat`, `pil:undo` added to PlatformIntelligence processIntent with regex fallbacks. Chat subscribes + handles send / new-chat live. `toggle-command-palette` existing event reused for "open palette / search / find" voice vocabulary. G5 voice vocabulary: 5 new verb families (send, new_chat, palette, undo, cancel) · deferred: bookmark voice verb (needs an edit-history consumer on the page, which Chat doesn't have yet), multi-language announcement (en only), chunker min-interval adaptive tuning

Pass 6 · angle: ergonomics + discoverable keybinds · queue: G15, G25, G26, G58, G53 (partial) · commit SHA: 85415e3 · shipped: `useKeyboardShortcuts.ts` expanded to handle Shift+letter modifier branch + Ctrl/Cmd+K always-routes-to-palette + Shift+V → hands-free toggle (location-aware: Chat vs PIL) + Shift+R → read-page. PlatformIntelligence.tsx subscribes to `pil:toggle-handsfree` + `pil:read-page` via window event listener (cleanup on unmount, actionsRef for stable binding). Chat.tsx subscribes to `chat:toggle-handsfree`. `KeyboardShortcuts.tsx` help overlay pruned to actually-wired shortcuts only (removes G53 lies: G+M/G+D/G+N/G+A/G+R were listed but never wired) + adds new Voice & Audio category with Shift+V, Shift+R, Say stop, Say send + documents Ctrl+K + keeps Chat / General sections · deferred: G53 CommandPalette.tsx PAGES list still drifts from navigation.ts (needs P7), Shift+V toggling between chat mode and nav mode cross-navigation (works on each page separately)

Pass 7 · angle: correctness + dev ergonomics (drift elimination) · queue: G33, G34, G52, G67, G53 (tail), G14 (partial) · commit SHA: dd4f1fa · shipped: `client/src/components/commandPaletteData.ts` (pure data module — buildPages derives 40+ pages from TOOLS_NAV + ADMIN_NAV + UTILITY_NAV + 16 EXTRA_PAGES with dedup-by-href, WIRED_G_CHORDS constant limits shortcut hints to the 6 actually-wired g-chords so no more lies) + `CommandPalette.tsx` full rewrite — useMemo-hosted role filter via hasMinRole(), recent-pages are also role-filtered so demoted users don't see phantom history, icon map centralized, palette actions now include "Toggle hands-free voice" and "Read current page aloud" so keyboard-only users can trigger multisensory features without memorizing Shift+V / Shift+R + `client/src/components/CommandPalette.test.ts` (10 tests — sidebar coverage, extras coverage, dedup, shortcut-hints-only-wired, role filter at user/advisor/manager/admin tiers) · deferred: G14 PIL ROUTE_MAP still separate from CommandPalette pages (both should source from a single shared route registry, out of scope here), CommandPalette voice-input (G17) still open

Pass 8 · angle: race conditions + offline resilience · queue: G62 (offline network-drop infinite spinner), G63 (dual chord race), G68 (focus trap stack conflict) · commit SHA: 484fa87 · shipped: Chat.tsx SSE stream pipeline now (a) fails fast when `navigator.onLine === false` with an instant error toast, (b) runs a 60s idle watchdog that resets on every token and aborts on silence, (c) listens for `offline` events mid-stream and aborts immediately, (d) releases both the watchdog and the offline listener on every exit path (success + error + AbortError). useKeyboardShortcuts + AppShell now both check `e.defaultPrevented` before processing so whichever handler fires first wins and the other no-ops — eliminates the double-navigation race when both were reacting to the same g-chord. KeyboardShortcuts.tsx help overlay listens for a `toggle-help` CustomEvent on document (in addition to the direct `?` keydown); CommandPalette "Keyboard shortcuts" action now dispatches that event via `setTimeout(…, 0)` after its own onSelect has already called setOpen(false) so the palette's focus trap fully unwinds before the help overlay mounts — no more two-dialog focus trap competition · deferred: MobileChatLayout dead mic icon (OI5), persistent test harness for the watchdog + offline abort paths (would need jsdom + MSW which are not in the current test env)

Pass 9 · angle: dead code + persistence + reduced-motion · queue: G56 (dead sidebarContent), G64 (framer-motion ignoring reduced-motion), G65 (TTS queue lost on reload) · commit SHA: efc807e · shipped: AppShell.tsx — deleted 300 lines of unreachable sidebarContent / renderNavItem / renderSectionedTools + ICON_MAP + getIcon + 40 now-unused imports (TOOLS_NAV / ADMIN_NAV / UTILITY_NAV / NAV_SECTION_ORDER / NAV_SECTION_LABELS / NavItemDef / NavSection / prefetchRoute / ScrollArea / Tooltip / 30+ lucide icons). PersonaSidebar5 has been the real sidebar since Pass 136 but the old code shipped in every bundle. AudioCompanion.tsx — `useReducedMotion` from framer-motion now controls `<motion.div>` initial/animate/transition props for both minimized + expanded variants; OS-level prefers-reduced-motion AND user-level body.reduced-motion-user class now properly suppress the slide-up + fade animation. AudioCompanion queue persistence — loadPersistedState / savePersistedState pure helpers with 50-item cap + defensive-parse rejecting malformed JSON; player rehydrates on mount in PAUSED + MINIMIZED state (no auto-play — UX anti-pattern + browser-blocked) so the user sees a "tap to resume" affordance. useEffect saves on every queue/currentItem/speed mutation · deferred: position (timestamp) resume — would need per-chunk seek + fresh TTS re-synth; not worth the complexity for P3

Pass 10 · angle: motor-impairment + color-independent state indicators · queue: G7, G13, G66 · commit SHA: 429ac5e · shipped: `client/src/hooks/usePushToTalk.ts` (single-shot STT hook — continuous=false forces Safari iOS compatibility, minHoldMs guard prevents accidental taps, interim results when supported, full cancel semantics for drag-off / escape / unmount) + `client/src/components/PushToTalkButton.tsx` (mouse + touch + keyboard hold-and-release with global pointerup / touchcancel listeners so drag-off cancels, 44×44 WCAG 2.5.5 touch target, haptics, aria-pressed + aria-live interim announcement + aria-label reflecting state, respects reduced-motion via animate-pulse-glow class) + `client/src/hooks/usePushToTalk.test.ts` (3 type-safe API surface tests locking the hook contract) + PlatformIntelligence.tsx `pil:send-feedback` window-event listener so buttons can fire designed feedback specs without importing the PIL context. G13 color-blind mode: added `colorBlindMode: "off" | "deuteranopia" | "protanopia" | "tritanopia" | "all"` field to AppearanceSettings, ThemeContext applies body classes, AppearanceTab adds a 5-option picker with descriptions. CSS: `body.color-blind-mode` adds `::after` ✓/✕/! adornments to status-classed elements + bumps focus rings to 3px + shifts chart-2/3/4 hues per-deficiency. G66: disabled-button opacity bumped from default 0.5 → 0.65 globally for WCAG AA, + dashed border pattern in color-blind mode for color-independent state signal. +3 new pure-function tests (colorBlindMode class list coverage) · deferred: RGB filter polyfill for true deuteranopia/protanopia simulation (nice-to-have but heavy), per-chart symbol markers (shape alongside hue for data series)

Pass 11 · angle: onboarding + error recovery + delight depth · queue: G22 (celebration on non-learning wins), G47 (first-run voice onboarding), G49 (error recovery voice cue) · commit SHA: 5059eb8 · shipped: `client/src/components/VoiceOnboardingCoach.tsx` (dismissible floating coach card — only mounts when STT is supported, skipped on auth/marketing routes, localStorage-gated one-time dismiss, "Try it now" button dispatches pil:toggle-handsfree so the user experiences it, role=dialog + aria-labelledby + Escape-to-close). Wired into App.tsx PIL provider. ErrorBoundary upgraded — `componentDidCatch` now fires Web Speech TTS announcement, installs window keydown listener for R/Enter→reload + Escape→cancel-TTS, installs a fresh single-shot SpeechRecognition instance that listens for "reload" / "retry" / "try again" / "reboot" and auto-reloads, restarts itself on `onend` so users get multiple chances. All listeners torn down in componentWillUnmount + on state transition. role=alert + aria-live=assertive on the error panel so SR users hear the announcement. Auto-focuses the Reload button. Adds a visible keyboard + voice hint ("Press R or say 'reload' to retry"). feedbackSpecs.ts: 4 new entries (goal.completed, report.generated, engine.calculation_complete, milestone.reached) + upgraded compliance.check_passed from a toast to a full success_celebration. +5 new tests locking the new specs · deferred: wiring the new specs into actual call sites (ComplianceAudit, EngineDashboard, WealthEngineReports) — the specs + dispatch path are ready; consumers can opt-in as they're touched

Pass 12 · angle: mobile thumb-reach + discoverability polish · queue: G41 (mobile Voice tab), G42 (chord/palette earcons) · commit SHA: e1b34ff · shipped: `client/src/lib/earcons.ts` (5-spec inventory — palette_open/close chirps, chord_primed tick, chord_matched confirm tone, send tone — Web Audio synth with sub-200ms envelopes, DI-testable factory, body.earcons-muted opt-out class) + `client/src/lib/earcons.test.ts` (7 pure-function tests with fake AudioContext). Wired: `useKeyboardShortcuts.ts` fires chord_primed on first "g" press + chord_matched on successful chord→nav dispatch, `CommandPalette.tsx` fires palette_open/close on state transitions. AppShell.tsx mobile bottom tab bar: replaced 4-tab + Menu layout with 4-tab + Voice + Menu. The Voice tab dispatches chat:toggle-handsfree on /chat and pil:toggle-handsfree elsewhere (same routing as Shift+V keyboard shortcut). Every tab now has explicit min-h-[44px] for WCAG 2.5.5 compliance. earconsMuted field added to AppearanceSettings + AppearanceTab toggle + body class gate on earcons.ts playback. 5 new feedbackSpecs tests verifying the G22 celebration specs · deferred: G17 (CommandPalette voice input via Web Speech), G44 (voice barge-in beyond just "stop"), G23 (@symbol mention), G27 (shortcut hints in component-level tooltips — too broad for one pass, will pick off per-component)

Pass 13 · angle: bi-modal input parity + form a11y · queue: G17 (palette voice), G37 (form aria-describedby) · commit SHA: e5364fb · shipped: CommandPalette.tsx integrates usePushToTalk — hold the new mic button (44×44 WCAG 2.5.5) or hold Shift+Space while the palette is open to capture a spoken query that populates the input live via onInterim + commits on release. Placeholder dynamically reflects voice state ("Listening…" when active). Mic button aria-pressed reflects isActive, aria-label describes hold/release semantics, focus-visible ring kept with 44px min touch target. sr-only span + aria-describedby on CommandInput for SR users. `client/src/components/FormField.tsx` new reusable form-field wrapper with useId-based stable ids, auto-wires htmlFor/aria-describedby/aria-invalid/aria-required from caller-provided error + description props, render-prop pattern lets any input primitive (shadcn Input, plain input, Textarea) drop in. Error slot is role="alert" + aria-live="polite" + AlertCircle icon for color-independent signal · deferred: per-page FormField migration (AppearanceTab, SignIn, ContentStudio, etc.) — the helper is ready; consumers migrate opportunistically. G37 stays in_progress until the dozen largest forms are migrated.

Pass 14 · angle: semantic HTML + loading state + contrast · queue: G19 (landmark roles), G35 (aria-busy), G46 (contrast audit) · commit SHA: TBD · shipped: AppShell.tsx — mobile header rewritten as `<header role="banner">` with aria-label, `<main>` landmark grew `aria-label="Main content"` + `aria-busy={globalBusy}`, new useState + useEffect bus listener for `pil:busy` / `pil:idle` window events so any page can signal loading without drilling state down. Chat.tsx — `<main id="chat-main">` grew `aria-label="Chat"` + `aria-busy={isStreaming}` so SR users hear "busy" during streaming + know the main region is a chat surface. index.css — `--muted-foreground` bumped from oklch(0.62 0.014 80) → oklch(0.68 0.014 80) so text-muted-foreground hits WCAG AA 4.5:1 against --card backgrounds (previously ~4.1:1 — below threshold). `--destructive` bumped from oklch(0.62) → oklch(0.68) for the same reason (text-destructive was ~3.9:1 on card backgrounds, now ~4.6:1). --destructive-foreground lightened accordingly. Both changes maintain the Stewardship Gold hue relationship so the brand palette doesn't drift · deferred: G45 (200% zoom audit needs real browser), G39 (overflow-hidden focus ring clipping also needs real browser), G20 (icon-only aria-label spot audit), G36 (role=tablist on custom tab UIs)

Pass 26 · angle: doc sync (CLAUDE.md) · queue: A1 (update page/component/nav counts), A2 (document new wealth engine pages + components) · commit SHA: TBD · shipped: CLAUDE.md synced: pages 128→131, components 142→144, nav items 39→46. Documented new wealth engine pages (Sensitivity, ReferenceHub, TeamBuilder), new components (GuardrailBadge, PremiumEstimator), new agent tools

Pass 25 · angle: quick quoting capability (premium estimator) · queue: A1 (PremiumEstimator component), A2 (wire into QuickQuote step 3) · commit SHA: f70c364 · shipped: `client/src/components/wealth-engine/PremiumEstimator.tsx` — multi-product premium comparison table showing estimated annual/monthly premiums for Term, IUL, Whole Life, DI, and LTC based on client age + coverage amount. Uses `wealthEngine.estimatePremium` tRPC query per product type. Wired into QuickQuote step 3 results page so users get instant premium quotes alongside their protection assessment. Total annual + monthly sum shown. Calculator UI coverage ~58% → ~63%

Pass 24 · angle: dead code + dev ergonomics · queue: A1 (scan new files for dead code), A2 (fix unused imports) · commit SHA: af49562 · shipped: Removed unused `useMemo` import from Calculators.tsx. Scanned all new wealth engine pages + GuardrailBadge component — all clean (no unused imports, no console.log, no unreachable code) · deferred: broader dead code sweep across all 100+ pages

Pass 23 · angle: agentic calculator tools · queue: A1 (we_sensitivity_sweep), A2 (we_guardrail_check), A3 (we_roll_up_team) · commit SHA: 8d5fa81 · shipped: 3 new agent tools in `aiToolCalling.ts` WEALTH_ENGINE_TOOLS array: `we_sensitivity_sweep` (2D what-if parameter sweep via HE engine, 3-10 grid, returns full grid + axes), `we_guardrail_check` (batch validate assumptions against SCUI guardrail rules), `we_roll_up_team` (aggregate team income by role-count pairs via BIE rollUp). All 3 have full dispatch handlers + TRPC_MAP entries in registerEngineTools.ts. The AI can now run what-if analyses, validate assumptions, and aggregate team economics from chat. Total wealth engine agent tools: 6→9 · deferred: we_roll_down_org (inverse of roll_up — cascading targets)

Pass 22 · angle: responsive + mobile UX (new pages) · queue: A1 (Sensitivity page mobile), A2 (TeamBuilder mobile), A3 (heat map cell sizing) · commit SHA: 3c724e7 · shipped: Sensitivity page base assumptions grid now stacks on mobile (grid-cols-1 sm:grid-cols-3), heat map cells reduced min-w on mobile (56px vs 72px). TeamBuilder role cards use flex-wrap + full-width select on mobile, roll-down target input stacks vertically on mobile, economics controls stack vertically on mobile

Pass 21 · angle: test coverage (new code) · queue: A1 (sensitivity sweep + guardrail tests), A2 (reference data integrity tests), A3 (SCUI backtesting tests) · commit SHA: 8360e32 · shipped: `server/shared/calculators/__tests__/sensitivitySweep.test.ts` — 19 new tests across 4 groups: (A) guardrail validation (7 tests: valid ranges, below-min, above-max, near-threshold warn, unknown key, all 6 keys present, rule structure), (B) sweep grid generation (3 tests: linear steps, non-zero range, 3×3 HE engine grid with monotonicity + positivity assertions), (C) reference data integrity (6 tests: 14 product types, src+benchmark presence, benchmarks keys, methodology engines, SP500 1928-2025 span, 3 stress scenarios structure), (D) SCUI backtesting+stress (3 tests: valid backtest summary, GFC stress result, null for unknown scenario). All 19 passing. Total suite: 4,613 passing + 19 new = 4,632

Pass 20 · angle: error states + graceful degradation · queue: A1 (error toasts for wealth engine mutations), A2 (inline error display), A3 (mutation error handling) · commit SHA: 2a233e8 · shipped: Added `onError` toast handlers to all 5 wealth engine mutations across Sensitivity + TeamBuilder pages. Added inline error message display near action buttons so users see what went wrong without scrolling. All mutation failures now surface via both toast (global) and inline (contextual) · deferred: loading skeletons for Reference Hub (existing loading text is sufficient), retry-on-failure buttons

Pass 19 · angle: input validation + guardrails (calculator UX safety) · queue: A1 (GuardrailBadge component), A2 (Sensitivity page guardrail badges), A3 (Reference Hub guardrails tab) · commit SHA: af2da71 · shipped: `client/src/components/wealth-engine/GuardrailBadge.tsx` — reusable validation badge that calls `wealthEngine.checkGuardrail` tRPC and renders color-coded warn/error/ok badges; `GuardrailsSummary` component showing all 6 guardrail rules with visual range bars + default markers. Wired into Sensitivity page (shows guardrail status for rate-based sweep parameters). Added Guardrails tab to Reference Hub with full assumption validation panel · deferred: per-field guardrail validation in Retirement + StrategyComparison pages

Pass 18 · angle: cross-app cohesion (navigation gaps) · queue: A1 (nav items for wealth engine + leads + CRM + compliance), A2 (admin nav for data freshness + rate mgmt), A3 (PersonaSidebar5 + LEARN_ITEM sync) · commit SHA: 1f40213 · shipped: Added 7 new nav items across `navigation.ts` TOOLS_NAV (Calculators, Lead Pipeline, CRM Sync, Compliance Audit) + ADMIN_NAV (API Keys, Webhooks, Team). Updated `PersonaSidebar5.tsx` advisor layer with Lead Pipeline + CRM Sync, steward layer with Data Freshness + Rate Management. Extended LEARN_ITEM match patterns to cover review/search/flashcards/quiz sub-routes. Unreachable routes reduced from 36 to ~25 · deferred: remaining unreachable routes (tax-planning, estate, insurance-analysis, social-security, medicare, import, suitability-panel) are intentionally sub-routes or advanced features

Pass 17 · angle: learning content wiring (demo→DB) · queue: A1 (ExamSimulator DB fetch), A2 (DisciplineDeepDive cases/FS apps DB), A3 (ConnectionMap DB) · commit SHA: b8b98ee · shipped: Added 3 new service functions (`listCases`, `listFsApplications`, `listConnections`) in `server/services/learning/content.ts` + 3 new tRPC procedures in `server/routers/learning.ts`. Wired `ExamSimulator.tsx` to self-fetch questions from `learning.content.listQuestions` when no props provided (was rendering empty). Wired `DisciplineDeepDive.tsx` cases + FS apps tabs to `learning.content.listCases` / `listFsApplications` with static fallback when DB empty. Wired `ConnectionMap.tsx` to fetch definitions + connections from DB (builds concept graph nodes from `listDefinitions`, edges from `listConnections`) with DEMO fallback. All three pages now show DB content when available, gracefully fall back to demo data when DB is empty. 0 TS errors, 0 regressions · deferred: formulas still static (FORMULA_REGISTRY client-side), study groups/playlists/challenges have schema but no UI

Pass 16 · angle: feature completeness (BIE TeamBuilder) · queue: A1 (TeamBuilder page with roll-up/roll-down/economics) · commit SHA: a4a23e0 · shipped: `client/src/pages/wealth-engine/TeamBuilder.tsx` — full team composition editor with role picker (9 roles), count controls, 7 quick presets, 3-tab analysis view: Roll-Up tab aggregates all team members into org totals (GDC, income, override, AUM, by-role and by-stream breakdowns via `wealthEngine.rollUpTeam`), Roll-Down tab cascades an org income target to per-person quotas with activity funnels (daily approaches → placed, via `wealthEngine.rollDownOrg`), Economics tab shows CAC/LTV/margins/ROI for the leader strategy (via `wealthEngine.calcBizEconomics`). Wired into App.tsx routing + Calculators grid. Calculator UI coverage ~45% → ~58% · deferred: channel spend allocation UI, campaign period management, seasonality profile editor

Pass 15-build · angle: feature completeness (calculator UI gap) · queue: A1 (WhatIf Sensitivity page), A2 (Reference Hub page), A3 (routing + nav wiring) · commit SHA: 28ae379 · shipped: `client/src/pages/wealth-engine/Sensitivity.tsx` — 2D parameter sweep heat map; users pick two parameters (savings rate / investment return / tax rate / age / income / horizon) and a result metric (total value / net value / ROI / savings / product cash value), sweep runs server-side via new `wealthEngine.sensitivitySweep` tRPC mutation (N×N holistic simulations in one call, ~50-200ms for 7×7), renders a color-coded heat map (red→yellow→green) with click-to-select cell detail. `client/src/pages/wealth-engine/ReferenceHub.tsx` — standalone 5-tab reference page (Products / Benchmarks / Methodology / S&P 500 History / Stress Scenarios) consuming existing `calculatorEngine.*` queries; products show source citations + benchmark snippets per product type; history tab includes mini bar chart + decade grid with color coding; stress scenarios show crash timelines with return badges. Both pages wired into `App.tsx` lazy routing + `Calculators.tsx` Wealth Engine grid (2 new entry buttons). Server: `sensitivitySweep` procedure added to `wealthEngineRouter` with full Zod validation. Build clean, TS 0 new errors (3 pre-existing infra), 171/191 test files pass (20 pre-existing env-dependent), 0 regressions · deferred: TeamBuilder page (BIE team composition UI — roll-up/roll-down), interactive drill-down from sensitivity cells to full strategy detail

Build Loop Pass 1 (claude/continuous-build-loop-BGi1e) · angle: rich reference integration + calculator depth (user-flagged critical) · queue: [A1 StrategyComparison lacks stress/backtest/benchmarks/detail-table, A2 Retirement lacks stress/backtest context] · completed: PARITY-CALC-0001 (StrategyComparison.tsx enriched with stress test panel for 3 scenarios via calculatorEngine.stressTest, historical backtest panel with survival/best/worst/median via calculatorEngine.historicalBacktest, industry benchmarks context strip, year-by-year detail table from milestones, guardrail warnings strip; Retirement.tsx enriched with GFC stress test, backtest, benchmark context, all auto-fire after goal projection). 4 new PARITY rows (CALC-0001..0004). · deferred: CALC-0002 (Monte Carlo bands), CALC-0003 (product refs inline), CALC-0004 (guardrails on all pages) · tests: TS clean, 0 regressions · build: ✓
Build Loop Pass 2 (claude/continuous-build-loop-BGi1e) · angle: cross-app cohesion + dead links + product references · queue: [A1 Calculators.tsx dead link /financial-protection-score, A2 benchmark data shape rendering bug, A3 product references not surfaced on StrategyComparison (CALC-0003)] · completed: fixed dead link, fixed benchmark rendering for heterogeneous Record shape on both pages, added 14-product references panel to StrategyComparison. CALC-0001 depth 2→3, CALC-0003 done. · deferred: CALC-0002 (Monte Carlo bands), CALC-0004 (guardrails on all pages) · tests: TS clean, 0 regressions · build: ✓
Build Loop Pass 3 (claude/continuous-build-loop-BGi1e) · angle: input validation + guardrails + product reference context · queue: [A1 reusable GuardrailWarning component, A2 WhatIfSensitivity guardrail context, A3 QuickQuoteFlow score-based product insights (CALC-0004 partial)] · completed: new GuardrailWarning.tsx component (client-side guardrail checks mirroring server), WhatIfSensitivity guardrail context note with industry refs, QuickQuoteFlow ScoreInsights component (shows weak-area product references with citations). CALC-0004 depth 0→2. · deferred: TeamBuilder guardrail integration, CALC-0002 (Monte Carlo bands) · tests: TS clean, 0 regressions · build: ✓
Build Loop Pass 4 (claude/continuous-build-loop-BGi1e) · angle: rich reference depth — income stream breakdown + year-by-year detail · queue: [A1 PracticeToWealth lacks income stream visibility (user flagged "roll-up, roll-down, across all hierarchy and channels"), A2 learning audit (confirmed 95% complete)] · completed: PracticeToWealth.tsx enriched with IncomeStreamBreakdown component showing per-stream bars (13 BIE streams: personal WB core, expanded platform, team override, gen2 override, AUM trail, 4 affiliates, channel revenue, partner, renewal, bonus), year-by-year summary strip sampling every Nth year with team size. · deferred: CALC-0002 (Monte Carlo bands) · tests: TS clean, 0 regressions · build: ✓
<!-- PASS_LOG_APPEND_HERE -->

## Changelog

_(append-only, most recent first)_

- **Build Loop Pass 26** (claude/continuous-build-loop-HT6uC) · Documentation sync: CLAUDE.md updated with new counts (131 pages, 144 components, 46 nav items) and documented all new wealth engine pages + components.
- **Build Loop Pass 25** (claude/continuous-build-loop-HT6uC) · Quick quoting: PremiumEstimator component with multi-product premium comparison (Term/IUL/WL/DI/LTC). Wired into QuickQuote step 3 results. Age + coverage sliders, annual + monthly premiums, total sum. Calculator UI ~58% → ~63%.
- **Build Loop Pass 24** (claude/continuous-build-loop-HT6uC) · Dead code cleanup: removed unused useMemo import from Calculators.tsx. All new wealth engine files verified clean.
- **Build Loop Pass 23** (claude/continuous-build-loop-HT6uC) · Agentic calculator tools: 3 new wealth engine agent tools (we_sensitivity_sweep, we_guardrail_check, we_roll_up_team) with full dispatch handlers. AI can now run what-if analyses, validate assumptions, and aggregate team economics from chat. Total tools 6→9.
- **Build Loop Pass 22** (claude/continuous-build-loop-HT6uC) · Mobile responsiveness: Sensitivity page stacks controls on mobile, heat map cells reduced min-w. TeamBuilder role cards wrap, controls stack vertically on narrow viewports.
- **Build Loop Pass 21** (claude/continuous-build-loop-HT6uC) · Test coverage: 19 new tests for sensitivity sweep (guardrail validation, grid generation, reference data integrity, SCUI backtesting). All passing.
- **Build Loop Pass 20** (claude/continuous-build-loop-HT6uC) · Error states + graceful degradation: onError toast handlers on all 5 wealth engine mutations + inline error display near action buttons in Sensitivity + TeamBuilder pages.
- **Build Loop Pass 19** (claude/continuous-build-loop-HT6uC) · Calculator input validation: GuardrailBadge component calls wealthEngine.checkGuardrail with color-coded warn/error/ok badges. GuardrailsSummary shows all 6 guardrail rules with visual range bars. Wired into Sensitivity page for rate params. Guardrails tab added to Reference Hub.
- **Build Loop Pass 18** (claude/continuous-build-loop-HT6uC) · Cross-app navigation cohesion: 7 new nav items (Calculators, Lead Pipeline, CRM Sync, Compliance Audit, API Keys, Webhooks, Team) across TOOLS_NAV + ADMIN_NAV. PersonaSidebar5 advisor layer gains Lead Pipeline + CRM Sync. Steward layer gains Data Freshness + Rate Management. Unreachable routes reduced from 36 to ~25.
- **Build Loop Pass 17** (claude/continuous-build-loop-HT6uC) · Learning content wiring (demo→DB): ExamSimulator self-fetches questions from DB, DisciplineDeepDive cases + FS apps wired to tRPC, ConnectionMap builds concept graph from definitions + connections tables. 3 new service functions + 3 new tRPC procedures. All pages gracefully fallback to demo data when DB empty.
- **Build Loop Pass 16** (claude/continuous-build-loop-HT6uC) · TeamBuilder page (/wealth-engine/team-builder) with role composition (9 roles), roll-up aggregation (by-role + by-stream), roll-down target distribution (with activity funnels), and business economics (CAC/LTV/margins/ROI). 7 quick presets. Calculator UI coverage ~45% → ~58%.
- **Build Loop Pass 15** (claude/continuous-build-loop-HT6uC) · Calculator UI gap closure: What-If Sensitivity Analysis page (/wealth-engine/sensitivity) with 2D heat map + Reference Hub (/wealth-engine/references) with products, benchmarks, methodology, S&P 500 history, stress scenarios. Server-side sensitivitySweep procedure. Two new Calculators grid entries. Calculator UI coverage ~28% → ~45%.
- **Build Loop Pass 4** (claude/continuous-build-loop-BGi1e) · Income stream breakdown on PracticeToWealth. New `IncomeStreamBreakdown` component surfaces all 13 BIE income streams (personal production, team override, gen2 override, AUM trail, 4 affiliate tracks, channel revenue, partner income, renewal, bonus) with proportional bar visualization + year-by-year summary strip with team size. Directly addresses the user's request for "roll-up, roll-down, across all hierarchy and channels" visibility. Learning system audit confirmed 95% feature-complete with all 13 pages accessible.
- **Build Loop Pass 3** (claude/continuous-build-loop-BGi1e) · Guardrail validation + product reference context. New reusable `GuardrailWarning.tsx` component (client-side guardrail checks mirroring server benchmarks.ts). WhatIfSensitivity: guardrail context note with industry references below heat map. QuickQuoteFlow: score-based contextual product insights — shows the user's weakest areas with relevant product citations and industry benchmarks (e.g., "1 in 4 workers becomes disabled before 67" for low protection scores).
- **Build Loop Pass 2** (claude/continuous-build-loop-BGi1e) · Cross-app cohesion + product references. Fixed `/financial-protection-score` → `/protection-score` dead link in Calculators.tsx. Fixed INDUSTRY_BENCHMARKS rendering on both StrategyComparison and Retirement to handle the actual Record<string, heterogeneous> data shape. Added 14-product references panel to StrategyComparison with inline citations and benchmarks per product type.
- **Build Loop Pass 1** (claude/continuous-build-loop-BGi1e) · Rich reference integration on wealth-engine pages. StrategyComparison.tsx enriched with: stress test panel (Dot-Com, GFC, COVID — auto-fires on comparison completion), historical backtest with survival rate + best/worst/median over 98 years of S&P 500 data, industry benchmarks context strip, collapsible year-by-year detail table from milestones data, guardrail warnings. Retirement.tsx enriched with: GFC stress test, historical backtest (auto-fires after goal projection), benchmark context strip. All new panels are collapsible for clean UX. 4 new PARITY gap rows (CALC-0001 through 0004) tracking remaining calculator enrichment work. Zero new regressions.
- **Build Loop Pass 15** (claude/continuous-build-loop-7BZQr) · Mass PIL feedback dispatch wire-up. 10 new consumer call sites across learning (quiz, flashcard, due-review, exam, case study), onboarding, audio preferences, financial twin, code chat, and wealth engine. New `sendFeedback()` helper in feedbackSpecs.ts gives any component fire-and-forget access to the PIL feedback bus without needing the `usePlatformIntelligence` hook. G1 depth 4→7, G8 depth 0→7. Fixed stale uxPolish.test.ts (was checking AppShell for code removed in Pass 9). 4,596 passing tests, 0 regressions.
- **Build Loop Pass 14** (claude/multisensory-accessible-ui-zmjLP) · Semantic landmarks + aria-busy signal + WCAG AA contrast bumps. G19 / G35 / G46 resolved. AppShell mobile header is now `<header role="banner">`, `<main>` carries `aria-label` + `aria-busy` tied to a pil:busy/pil:idle window-event bus any page can emit. muted-foreground + destructive tokens bumped to hit 4.5:1 on card backgrounds. Stewardship Gold brand palette preserved.
- **Build Loop Pass 13** (claude/multisensory-accessible-ui-zmjLP) · CommandPalette voice input (hold the mic or Shift+Space to speak a query) + FormField a11y wrapper with auto-wired aria-describedby / aria-invalid / aria-required. G17 resolved; G37 advanced to in_progress (helper ready, per-page migration ongoing).
- **Build Loop Pass 12** (claude/multisensory-accessible-ui-zmjLP) · Earcon layer + mobile Voice tab. 5 sub-200ms Web Audio synth tones wired into g-chord navigation + command palette open/close. Mobile bottom tab bar replaces generic Menu with dedicated thumb-reach Voice tab (routes through same window events as Shift+V keyboard shortcut). User-level earconsMuted opt-out in AppearanceTab. G41 / G42 resolved. 117 passing tests (110 prior + 7 new earcons tests).
- **Build Loop Pass 11** (claude/multisensory-accessible-ui-zmjLP) · Voice onboarding coach + error boundary voice recovery + 4 new non-learning celebration specs. G22 / G47 / G49 resolved. 110 passing tests (105 prior + 5 new feedbackSpecs tests).
- **Build Loop Pass 10** (claude/multisensory-accessible-ui-zmjLP) · Motor-impairment + color-independent state indicators. usePushToTalk hook + PushToTalkButton component ship the hold-to-dictate UX so Safari iOS users (G59 ptt_only capability bucket) + motor-impaired users + privacy-conscious users all have a voice entry point that doesn't require continuous listening. 5-mode color-blind picker in AppearanceTab with pattern adornments + chart recolors per deficiency. Disabled button opacity bumped to 0.65 for WCAG AA. G7 / G13 / G66 resolved. 105 passing tests (99 prior + 3 usePushToTalk + 3 colorBlindMode additions to appearanceSettings.test.ts).
- **Build Loop Pass 9** (claude/multisensory-accessible-ui-zmjLP) · Dead code purge (-300 lines AppShell unreachable sidebar) + framer-motion now respects reduced-motion + AudioCompanion queue persists across reloads. G56 / G64 / G65 resolved. 576 passing tests (up from 99 — the existing codeChat tests also run now that the filter patterns are stable).
- **Build Loop Pass 8** (claude/multisensory-accessible-ui-zmjLP) · Network resilience + keyboard-race elimination. Chat SSE pipeline no longer hangs on network drop: pre-flight navigator.onLine check, 60s idle watchdog, mid-stream offline-event abort. Dual g-chord handler race resolved via defaultPrevented guard on both AppShell and useKeyboardShortcuts handlers. Focus trap stack conflict resolved via dedicated `toggle-help` CustomEvent dispatch (setTimeout-deferred so palette closes first). G62 / G63 / G68 resolved.
- **Build Loop Pass 7** (claude/multisensory-accessible-ui-zmjLP) · CommandPalette drift eliminated. PAGES now derive from navigation.ts + 16 EXTRA_PAGES that cover the settings sub-routes and beyond-parity features. Role filter via hasMinRole at both Pages + Recent sections. Palette actions include multisensory triggers (Toggle hands-free, Read page aloud) so keyboard-only users don't need to memorize Shift+V / Shift+R. G33/G34/G52/G67 resolved; G53 tail fixed (shortcut hints now only render for wired g-chords); G14 improved but PIL ROUTE_MAP still separate (deferred).
- **Build Loop Pass 6** (claude/multisensory-accessible-ui-zmjLP) · Discoverable keyboard shortcuts for the multisensory layer. Shift+V toggles hands-free (location-aware — Chat vs PIL), Shift+R reads current page aloud, Ctrl/Cmd+K opens command palette (previously wired in palette itself, now also in useKeyboardShortcuts for discoverability). KeyboardShortcuts help overlay rewritten to only list actually-wired shortcuts + new Voice & Audio category. G15, G25, G26, G58 resolved; G53 partial (help overlay fixed; CommandPalette PAGES list deferred to Pass 7).
- **Build Loop Pass 5** (claude/multisensory-accessible-ui-zmjLP) · G3/G4/G5/G61 resolved. Sentence-chunked aria-live announcer streams the actual AI response to SR users in real time (not just the stub "AI is responding…"). Visible caption panel above chat input for deaf / HoH users per WCAG 1.2.1-A. Voice "stop" now aborts SSE (fixes interleaving bug). 5 new voice verb families: send / new_chat / open_palette / cancel / undo — all wired via a PIL → window-event bus so other pages can subscribe without touching PIL. +21 pure-function tests.
- **Build Loop Pass 4** (claude/multisensory-accessible-ui-zmjLP) · AppearanceTab is no longer a Potemkin UI. `appearanceSettings.ts` centralizes load/save/apply for all 5 user knobs; ThemeContext rewritten to consume it; AppearanceTab rewrites to live-update on click; `.light` theme + font-scale + chat-density + reduced-motion + contrast/forced-colors media overrides added to `index.css`. G2/G9/G10/G11/G12/G51/G57 all flip to done. Accent color selector deleted (brand-locked gold). OS dark-mode toggles now propagate live to users on "system" preference via `subscribeSystemTheme`. +9 new pure-function tests.
- **Build Loop Pass 3** (claude/multisensory-accessible-ui-zmjLP) · G60 WCAG 2.4.3 resolved. Every route change now focuses the main content region AND announces the new page name via an aria-live=polite region that's lazily created on first use. Added 15 unit tests for pure-function helpers (DI-testable Document fake). describePath uses longest-prefix matching so `/settings/audio` → "Audio Preferences" (not "Settings"). focusMainRegion refuses to steal focus from an active input to protect the chat caret + HMR flows.
- **Build Loop Pass 2** (claude/multisensory-accessible-ui-zmjLP) · Cross-browser STT silent-fail fixed. `sttSupport.ts` capability probe module (22 tests, 8 real-world UA strings) centralizes the Firefox/Safari iOS/desktop Safari bucketing. `VoiceSupportBanner.tsx` + `Chat.tsx` integration + `useVoiceRecognition` hook upgrade now give Firefox + iOS Safari users a visible "why doesn't this work" banner with recovery copy. G59 depth 0→7; now properly in_progress (PIL + LiveSession consumers still need the same guard, deferred to a later pass). Added `client/src/lib/sttSupport.test.ts` + `client/src/lib/feedbackSpecs.test.ts` to `vitest.config.ts` include array so the ever-growing client-side shared lib can carry its own tests.
- **Build Loop Pass 1** (claude/multisensory-accessible-ui-zmjLP) · PIL dispatcher consumer pattern now live in Chat + PlatformIntelligence. G1 depth 1→4 (Chat.tsx is the single highest-volume call site in the app; hooking it up alone unblocks ~70% of user-facing feedback). G54 resolved (dispatcher self-consistency). Seeded PARITY.md onto the multisensory branch from the parity-accessibility branch so the build loop and assessment loop share a single doc going forward.
- **Pass 3** (Claude Code, Adversarial, 58%→54%) · +10 new gaps (G59–G68) with 2 CRITICAL: G59 Firefox/Safari-iOS STT silent-fail (comparable target is named after the feature that dies in a quarter of browsers); G60 WCAG 2.4.3 Focus Order failure (keyboard+SR users get no announcement of where they arrived after g-chord navigation). Additional HIGH items: G61 voice "stop" doesn't abort SSE stream, G62 offline network-drop → infinite spinner, G63 dual chord handler race, G64 framer-motion ignores prefers-reduced-motion. Adversarial pass specifically hunted silent failures under non-Chrome/non-online/non-sighted conditions that earlier passes assumed away.
- **Pass 2** (Claude Code, Depth, 62%→58%) · +8 new gaps (G51–G58); `feedbackSpecs.ts` contains 30 fully-designed multimodal feedback events with 0 dispatch sites; produced 14-file dispatch recipe; discovered `AppearanceTab.tsx` is a Potemkin UI (6 controls, 6 silent failures on `wb_*` keys that nothing reads); discovered `CommandPalette` PAGES list drifts from `navigation.ts` by ~15 routes and shows "G R / G M / G D" shortcut hints that were never wired; discovered dead `sidebarContent` (200+ lines) in `AppShell.tsx` replaced by `PersonaSidebar5`. Score downgraded 62→58% not because of regression but because Pass 1 over-valued infrastructure-that-exists at the expense of infrastructure-that-works; honest re-baseline.
- **Pass 1** (Claude Code, Landscape, n/a→62%) · Initial audit; 50-item gap matrix; 7 beyond-parity wins; 6 anti-parity rejections. Root-cause insight: PIL consumer pattern unlocks the P0 cluster (G1/G8/G21/G23).

## Known-Bad Approaches

_(carries v2 KNOWN_BAD_APPROACHES across passes)_

- _(empty — Pass 1 is the first)_

## Open Issues (v2 parity)

_(problems not yet tracked as gaps but worth raising; either promote to Gap Matrix or resolve in a later pass)_

- OI1 — `AppearanceTab.tsx:27` allows users to pick light/system theme but the setting is inert (no CSS tokens for light). Users think they set the theme but nothing happens. **User-visible bug**, captured in G2/G9.
- OI2 — `AudioPreferences.tsx:228` UI copy says "Say 'go to clients' to navigate by voice", which only works when the user is already in hands-free mode. Copy should mention the activation step or a PTT alternative.
- OI3 — Chat.tsx hands-free button disappears on text entry (`Chat.tsx:2659`), a discoverability regression for voice users who type-and-talk. Captured in G24.
- OI4 — **Three separate STT implementations coexist** — `hooks/useVoiceRecognition.ts` (the "canonical" hook, used by Chat), `components/PlatformIntelligence.tsx:288-323` (PIL's own STT for nav commands), `components/LiveSession.tsx:174+` (live session STT), `components/LiveChatMode.tsx:96+` (live chat mode STT), and a Mic toggle button in `components/MobileChatLayout.tsx` that imports Mic icons but no STT. Four independent speech-recognition surfaces competing for the same microphone resource. Risk: one may cancel another; no arbitration; users who click the Chat hands-free button then navigate to LiveSession will see two conflicting listeners. **Critical — should consolidate around `useVoiceRecognition`.**
- OI5 — `MobileChatLayout.tsx` imports `Mic, MicOff` icons but the mobile chat layout has no voice input — rendering a mic icon that does nothing is a discoverability bug.

## Parallel Tracks

_(only populated when Manus dispatches independent tracks)_

- _(not applicable — single-platform optimization)_

## Merge Status

_(not applicable — no parallel tracks dispatched)_


---

# Track B — Learning Experience
# Stewardly PARITY — Build Loop Work Queue

**Purpose.** Bidirectional work ledger for the continuous build loop. Two
kinds of rows live here:

1. **External recommendations** fed in by parallel assessment processes
   or prior build-loop passes. The build loop reads these, prioritizes
   open ones, and marks them done with a commit SHA.
2. **Build-loop findings** — gaps the build loop's own assessment stage
   noticed. The assessment loop then decides whether to re-verify, and
   future passes can pick them up.

**Scope for this file.** Learning experience optimization against the
`mwpenn94/emba_modules` repo content — SRS flow, cross-track study,
quiz and flashcard runners, importer resilience, agent tool coverage,
accessibility, cost, observability.

## Protected improvements (do not weaken)

These landed in prior passes and must not be regressed. Referenced by
`hybrid: pass N — …` commit prefixes in git log.

| # | Improvement | Landed | Protects |
|---|---|---|---|
| P-1 | `embaImport.ts` handles OBJECT-keyed `disciplines` map + `key`/`correct`/`correct_index` aliases (pass 76) | pass 76 | Import from GitHub does not crash on real emba_modules JSON shape. |
| P-2 | `LearningFlashcardStudy` / `LearningQuizRunner` wire answers into `mastery.recordReview` with 0-5 ladder (pass 58) | pass 58 | Every review advances confidence; `masterySummary.dueNow` counter moves. |
| P-3 | `LearningTrackDetail` lazy-loads subsections via `content.listSubsections` | pass 58 | Large tracks render without N+1 subsection fetches. |
| P-4 | Seed is idempotent (dedup by slug) and distinguishes inserted vs skipped (pass 76) | pass 76 | Re-running Seed does not double-insert disciplines/tracks. |
| P-5 | `CelebrationEngine` heavy/medium wired into quiz + flashcard completion | pass 155 | 100% / 80%+ completions trigger the particle effect. |
| P-6 | Quiz/flashcard `CompletionCard` uses a11y-friendly message tiers (100%/80%/60%) | pass 58 | No exclamation-only messaging; always a substantive wrap-up sentence. |
| P-7 | Cross-track due-review deck — `getDueReviewDeck()` + `LearningDueReview.tsx` + `learning.mastery.dueReview` tRPC query | pass 1 (build loop) | Learners can run a single mixed session over everything SRS-due across every track. |
| P-8 | `assessTrackReadiness` resolves track→content→mastery (NOT prefix match) — readiness=mastered/totalItems | pass 2 (build loop) | Agent's `assess_readiness` and `check_exam_readiness` tools return correct numbers. |
| P-9 | `start_review_session` agent tool exposes `learning.mastery.dueReview` to ReAct loop | pass 2 (build loop) | Agent can answer "what's due today" with real data. |
| P-10 | Pure `deckBuilder.ts` (mulberry32 + Fisher-Yates + 3 modes) drives flashcard + quiz runners with pre-session config | pass 3 (build loop) | Shuffle is seeded + reproducible, session caps work, weakest-first mode prioritizes weak material. |
| P-11 | `embaImport` persists every run to `.stewardly/learning_import_history.json` via `recordImportRun()` — best-effort, never throws | pass 4 (build loop) | Admins can audit "when did we last pull" + per-run inserts/skips/errors without log scraping. |
| P-12 | `LearningTrackDetail` shows per-chapter mastery progress via pure `buildTrackProgress` rollup | pass 5 (build loop) | Learners see exactly how much of each chapter they've covered + mastered. |
| P-13 | Flashcard flip surface in both `LearningDueReview` + `LearningFlashcardStudy` is a real semantic button (role/tabIndex/aria-pressed/keyboard) | pass 6 (build loop) | Keyboard + screen reader users can flip cards. |
| P-14 | Quiz components support digit-key (1..N) selection + Enter to submit/advance | pass 6 (build loop) | Power-user + keyboard-first study sessions. |
| P-15 | Pure `studyStreak.ts` engine + `<StreakCard>` on LearningHome + `recordStudyNow()` in every review handler | pass 7 (build loop) | Habit formation feedback loop — learners see consecutive days + get an amber "save your streak" nudge when yesterday's session is the most recent. |
| P-16 | `searchContent` matches body text + practice questions; pure `searchRank.ts` 5-tier scorer + highlighter; `LearningSearch` page at /learning/search | pass 8 (build loop) | All 366+ imported definitions / flashcards / questions / tracks are discoverable by keyword, not just drill-down. |

## Gap matrix

Status: `open` · `in-progress` · `done`
Source: `assessment` (parallel audit process) · `build` (this loop's own
assessment step) · `external` (user or upstream process)

| ID | Title | Scope | Source | Status | Depth | Owner | Notes |
|---|---|---|---|---|---|---|---|
| G-1 | No cross-track due-review deck — learners can see `dueNow` count but have no UI to actually review mixed SRS items across tracks | learning | build | done | 6 | pass 1 | Landed pass 1; see `LearningDueReview.tsx` + `server/services/learning/dueReview.ts` |
| G-2 | `assessTrackReadiness` looks for itemKey prefix `track:${slug}:` but flashcard/quiz runners store keys as `flashcard:${id}` / `question:${id}` — readiness always returns 0 tracked | learning | build | done | 6 | pass 2 | Resolver now loads track→flashcards+questions, builds expected-key set, and matches mastery rows. Pure `computeReadiness` with 10 new tests. Legacy prefix still accepted so prior data isn't dropped. Shape also gained `totalItems` + `coverage`. |
| G-3 | Flashcard / quiz runners iterate entire deck — no session-size control (e.g. "review 10 cards") + no shuffle | learning | build | done | 6 | pass 3 | New pure `client/src/pages/learning/lib/deckBuilder.ts` (mulberry32 PRNG, Fisher-Yates shuffle, 3 modes: sequential / shuffle / weakest-first) + 32 unit tests. Wired into both `LearningFlashcardStudy` and `LearningQuizRunner` with a pre-session configure card (size 10/20/50/All, mode picker, mastery-aware "Weakest" mode disabled until user has prior history). |
| G-4 | LearningHome "Start review →" links to `tracks[0].slug/study` (first track alphabetically) — not to actual due items | learning | build | done | 6 | pass 1 | Now links to `/learning/review` |
| G-5 | Due-items hydrator has no agent-tool exposure — ReAct agent cannot start or describe a review session for the current user | learning | build | done | 4 | pass 2 | `start_review_session` tool added to `LEARNING_AGENT_TOOLS`, routed to `learning.mastery.dueReview`. Wiring test updated to 12-tool minimum. |
| G-6 | `embaImport` does not capture last-import-run metadata — admins cannot see when content was last pulled or what changed | learning | build | done | 6 | pass 4 | New `server/services/learning/importHistory.ts` persists every run to `.stewardly/learning_import_history.json` (50-entry ring buffer, defensive parser, pure summarizer). 19 unit tests + tmpdir round-trip. New `learning.importHistory` admin tRPC query. New `ImportHistoryPanel` in Content Studio with last-run / last-success / per-run delta + error samples. No schema migration. |
| G-7 | Track detail shows flashcard / question counts but not **chapter completion %** — no sense of where the learner is in the material | learning | build | done | 6 | pass 5 | New pure `client/src/pages/learning/lib/trackProgress.ts` (chapter bucketing, mastered/inProgress/unseen classification, completion + attempted percentages, completionStatus tier function). 21 unit tests covering empty inputs, bucketing edge cases, classification rules, totals integrity, percent rounding, status tiers, format helpers. New `<TrackProgressCard>` in `LearningTrackDetail` with track-level progress bar + per-chapter rows + unchaptered fallback. |
| G-8 | Pass 1-5 shipped components had no keyboard accessibility on the flashcard flip surface (clickable div, no role/tabIndex/keyboard handler) and no aria-labels on Progress bars / quiz answer feedback buttons | learning | build | done | 5 | pass 6 | Both `LearningDueReview` and `LearningFlashcardStudy` `FlashcardCard` components now use `role="button" tabIndex={0} aria-pressed aria-label` with Space/Enter handlers and visible focus ring; correct/incorrect buttons gained aria-labels; track + chapter Progress bars in `TrackProgressCard` carry aria-label with mastered/total counts; quiz components added digit-key (1..N) + Enter shortcuts with hint text. |
| G-9 | `LearningHome` docstring has promised "Mastery snapshot (overall pct, due now, streak)" since pass 58, but the streak half was never shipped. Zero habit-formation feedback loop for daily learners. | learning | build | done | 6 | pass 7 | New pure `client/src/pages/learning/lib/studyStreak.ts` (UTC-anchored day keys, 90-day ring buffer, markStudyDay idempotence, currentStreak with today-or-yesterday window, streakStatus 4-tier classification, defensive parser, localStorage I/O). 36 unit tests. `recordStudyNow()` called from every review handler in all 3 runners. New `<StreakCard>` in LearningHome with tone shifts (accent-active, amber-at-risk, muted-broken) + "Save your streak →" CTA. Grid goes from 3 → 4 columns. |
| G-10 | 366+ definitions imported from emba_modules have no search UI. The `learning.content.search` tRPC proc exists but nothing in the client calls it. Learners who know a term but not the track can't look it up. | learning | build | done | 6 | pass 8 | Extended `searchContent` server-side to match body text (definition body, flashcard body, track subtitle/description, question prompt/explanation) and include practice questions — previously only matched term/name. New pure `client/src/pages/learning/lib/searchRank.ts` with 5-tier relevance scoring (exact title → prefix → word prefix → title substring → snippet substring), type bias, grouping helper, pure highlighter. 23 unit tests. New `LearningSearch` page at `/learning/search` with 200ms-debounced query, grouped results (Definitions/Flashcards/Tracks/Questions), `<mark>`-highlighted matches, track-row deep-link to detail page. Search button added to LearningHome header. |

## Reconciliation log

_Conflicts resolved during merge of parallel process edits._

_(empty — first pass)_

## Known-Bad

_Dead ends. Do not re-attempt without new information._

_(empty — first pass)_

## Build Loop Pass Log

_One line per build-loop pass, newest at bottom. `angle · queue summary ·
commit SHA · items completed · items deferred`._

Pass 1 · angle: correctness + study pedagogy · queue: [G-1 cross-track due-review deck, G-4 Home "Start review" link target] · completed: G-1 G-4 (new `dueReview.ts` pure parser+selector, `LearningDueReview.tsx` mixed-deck session UI, `learning.mastery.dueReview` tRPC query, `/learning/review` route, LearningHome button now deep-links) · deferred: G-2 G-3 G-5 G-6 G-7 · tests: +23 dueReview → 88 learning tests green · build: ✓
Pass 2 · angle: correctness — agent readiness scoring & tool coverage · queue: [G-2 readiness resolver P0 bug, G-5 `start_review_session` agent tool] · completed: G-2 G-5 (rewrote `assessTrackReadiness` to resolve track→content→mastery, added pure `computeReadiness`, added `totalItems`+`coverage` to return shape, new `start_review_session` agent tool) · deferred: G-3 G-6 G-7 · tests: +10 computeReadiness → 98 learning tests green · build: ✓
Pass 3 · angle: study pedagogy — deck ordering + session size · queue: [G-3 no shuffle/no session size in flashcard+quiz runners] · completed: G-3 (new pure `client/src/pages/learning/lib/deckBuilder.ts` with mulberry32 PRNG + Fisher-Yates + 3 modes [sequential/shuffle/weakest], 32 unit tests, wired into both `LearningFlashcardStudy` + `LearningQuizRunner` with pre-session configure card; vitest config extended to include `client/src/pages/learning/lib/`) · deferred: G-6 G-7 · tests: +32 deckBuilder → 130 tests green across 9 files · build: ✓
Pass 4 · angle: observability + import resilience · queue: [G-6 import-run history persistence] · completed: G-6 (new `importHistory.ts` with 50-entry ring buffer, defensive parser, pure summarizer + tmpdir round-trip tests; `embaImport` calls `recordImportRun()` after every run; new admin `learning.importHistory` tRPC query; new `ImportHistoryPanel` in Content Studio with last-run / last-success / per-run inserts / error samples) · deferred: G-7 · tests: +19 importHistory → 149 tests green across 10 files · build: ✓
Pass 5 · angle: visibility — track + chapter progress · queue: [G-7 track detail no completion %] · completed: G-7 (new pure `client/src/pages/learning/lib/trackProgress.ts` with `buildTrackProgress` chapter bucketing + classification + percent rounding + completionStatus tiers; 21 unit tests; new `<TrackProgressCard>` in LearningTrackDetail showing track-level mastered/inProgress/unseen rollup + per-chapter rows with completion bars + unchaptered fallback bucket) · deferred: — (initial gap matrix complete; future passes will rotate to fresh angles) · tests: +21 trackProgress → 170 tests green across 11 files · build: ✓
Pass 6 · angle: accessibility (FRESH) · queue: [A1 flashcard flip surface is clickable div not button — fails WCAG 2.1.1; A2 Progress bars + quiz feedback buttons missing aria-labels] · completed: G-8 (FlashcardCard in `LearningDueReview` + `LearningFlashcardStudy` now `role="button" tabIndex={0} aria-pressed` with Space/Enter handlers + focus ring; correct/incorrect buttons + chapter/track Progress bars gained descriptive aria-labels; both quiz components added digit-key + Enter shortcuts with on-screen hint) · deferred: — · tests: 170 green (no test changes; pure UI a11y) · build: ✓
Pass 7 · angle: motivation + habit formation (FRESH) · queue: [A1 `LearningHome` docstring has promised streak since pass 58 but never shipped the UI half; A2 zero habit-formation signal for daily learners] · completed: G-9 (new `studyStreak.ts` with UTC-anchored day keys, 90-day ring cap, idempotent same-day markStudyDay, today-or-yesterday window on currentStreak, 4-tier streakStatus, defensive parser, localStorage I/O; 36 unit tests; `recordStudyNow()` wired into every review handler across `LearningDueReview`, `LearningFlashcardStudy`, `LearningQuizRunner`; new `<StreakCard>` on LearningHome with tone-aware paint + "Save your streak →" CTA) · deferred: — · tests: +36 studyStreak → 206 tests green across 12 files · build: ✓ (22.57s)
Pass 8 · angle: content discovery (FRESH) · queue: [A1 `learning.content.search` tRPC proc exists but has zero consumers in the client; A2 366+ emba_modules definitions unreachable by keyword] · completed: G-10 (extended `searchContent` server-side to match body text + practice questions; new pure `searchRank.ts` with 5-tier scoring + grouping + pure `highlightMatches`; 23 unit tests; new `LearningSearch` page at `/learning/search` with 200ms debounced query, grouped results sections, `<mark>` highlighted matches, tracks click-through to detail; Search button added to LearningHome header) · deferred: — · tests: +23 searchRank → 229 tests green across 13 files · build: ✓ (19.98s)


---

# Track C — AI Chat + Agentic Automation

## Meta

- **Scope:** Optimize AI chat + agentic capabilities (browser/device/
  other automation) to achieve and excel beyond Claude, Manus, and
  other top comparables.
- **Comparable benchmark:** Claude Code (VS-Code Go-to-Symbol, TodoWrite,
  project instructions auto-load, computer-use), Manus (automate_browser,
  multi-URL research, agent replay), browser-use, AutoGen, Perplexity.
- **Core purpose:** Give the Code Chat ReAct loop (and any other
  agentic caller) a safe, observable, production-quality browser
  primitive stack without requiring a headless browser. Future
  Playwright / computer-use adapters slot in behind the same
  `PageFetcher` interface without touching callers.
- **ID namespace:** `AU-1..AU-N`.

## Gap Matrix

| ID  | Capability                                                 | Comparable                | Before | After | Status       | Owner   | Commit(s)        |
| --- | ---------------------------------------------------------- | ------------------------- | -----: | ----: | ------------ | ------- | ---------------- |
| AU-1  | Fetch + read a URL without a headless browser (read-only)  | Manus browser_read        |      0 |     5 | done · P1    | build   | pass-1           |
| AU-2  | Extract structured page view (title/text/links/headings)   | Claude computer-use read  |      0 |     5 | done · P1    | build   | pass-1           |
| AU-3  | Per-domain rate limiting for outbound fetches              | defensive infra           |      0 |     5 | done · P1    | build   | pass-1           |
| AU-4  | Allow/deny domain list for browser-read tool               | security ceiling          |      0 |     5 | done · P1    | build   | pass-1           |
| AU-5  | Navigation history record (back/forward trace)             | browser-use               |      0 |     4 | done · P1    | build   | pass-1           |
| AU-6  | Pluggable page-fetcher adapter (fetch → future playwright) | future-proofing           |      0 |     3 | done · P1    | build   | pass-1           |
| AU-7  | Headless browser (Playwright) adapter for JS-rendered pgs  | Claude computer-use       |      0 |     0 | open         |         |                  |
| AU-8  | Visual screenshot + OCR for vision-driven clicks           | Claude computer-use       |      0 |     0 | open         |         |                  |
| AU-9  | DOM click/type/scroll action layer                         | Manus automate_browser    |      0 |     0 | open         |         |                  |
| AU-10 | Form-filling with schema detection                         | AutoGPT / Manus           |      0 |     0 | open         |         |                  |
| AU-11 | Multi-tab session state                                    | browser-use               |      0 |     0 | open         |         |                  |
| AU-12 | Cookies + auth hand-off from user session                  | browser-use               |      0 |     0 | open         |         |                  |
| AU-13 | Device-automation shell (mobile/desktop UI automation)     | Manus / ADB               |      0 |     0 | open         |         |                  |
| AU-14 | Computer-use vision loop (screenshot→plan→click)           | Claude computer-use       |      0 |     0 | open         |         |                  |
| AU-15 | Structured data extraction (schema-guided LLM)             | LlamaExtract / Manus      |      0 |     0 | open         |         |                  |
| AU-16 | Download files from navigated page                         | browser-use               |      0 |     0 | open         |         |                  |
| AU-17 | Browser-tool telemetry (step-level spans, timings)         | observability             |      0 |     5 | done · P3    | build   | pass-3           |
| AU-18 | Agent replay of browser sessions                           | Manus replay              |      0 |     0 | open         |         |                  |
| AU-19 | Multi-agent browser orchestration                          | AutoGen / Manus           |      0 |     0 | open         |         |                  |
| AU-20 | Compliance guardrails on web-retrieved content             | Stewardly-specific        |      0 |     0 | open         |         |                  |
| AU-21 | Chat agent exposes `web_read` tool end-to-end              | parity w/ Manus chat      |      0 |     5 | done · P1    | build   | pass-1           |
| AU-22 | Chat agent exposes `web_extract` structured extraction     | parity w/ Manus chat      |      0 |     6 | done · P2    | build   | pass-2           |
| AU-23 | SSE streaming of browser events to UI                      | Claude computer-use UI    |      0 |     7 | done · P6+7  | build   | pass-6, pass-7   |
| AU-30 | Client-side hook + component consuming the SSE stream      | Claude/Manus activity UI  |      0 |     5 | done · P7    | build   | pass-7           |
| AU-31 | Architecture doc covering every automation primitive       | dev-onboarding            |      0 |     6 | done · P8    | build   | pass-8           |
| AU-32 | Parallel multi-URL fetch primitive (concurrency limited)   | Manus batch / Claude      |      0 |     6 | done · P9    | build   | pass-9           |
| AU-33 | Crawl BFS level-batched parallelism (concurrency option)   | browser-use / crawler     |      0 |     5 | done · P9    | build   | pass-9           |
| AU-24 | Browser read result caching with ETag/stale-while-revalid  | performance               |      0 |     6 | done · P3    | build   | pass-3           |
| AU-25 | Robots.txt honoring                                        | defensive infra           |      0 |     6 | done · P2    | build   | pass-2           |
| AU-26 | Bounded crawl session (BFS + depth + dedupe + budget)      | browser-use / Manus       |      0 |     5 | done · P4    | build   | pass-4           |
| AU-27 | Hostile-input resilience on URL inputs (found by build)    | security / SSRF           |      0 |     5 | done · P4    | build   | pass-4           |
| AU-28 | Chat agent exposes `web_search` (find URLs you don't know) | Manus / Claude search     |      0 |     6 | done · P5    | build   | pass-5           |
| AU-29 | Automation telemetry fan-out bus (multi-sink)              | observability infra       |      0 |     6 | done · P5    | build   | pass-5           |

Legend: `open` = not started; `in-progress` = under active work by build or
parallel process; `done · P<N>` = shipped in pass N. Depth scores are rough
self-assessments, 0=missing, 5=usable parity, 10=exceeds comparables.

## Protected Improvements

These are load-bearing upgrades the build loop has shipped in this chat that
must not be weakened by any subsequent pass (this applies to every parallel
process reading PARITY.md, not just next-pass-self).

- **webNavigator service** — pass 1. Pure-TS, fetch-based URL reader with
  domain allow/deny lists + per-domain rate limiting + HTML → PageView
  extraction + pluggable adapter interface. File:
  `server/shared/automation/webNavigator.ts`. Tests:
  `server/shared/automation/webNavigator.test.ts`. Do not inline an HTTP
  library, do not drop the adapter interface, do not remove rate limits.
- **webExtractor service** — pass 2. Schema-guided structured extraction
  over PageView. Supports `title`/`description`/`h1..h6`/`heading`/`link`/
  `image`/`form`/`table`/`regex:`/`css:` selectors with string|number|
  date|url|boolean|table coercion. File: `server/shared/automation/
  webExtractor.ts`. Do not collapse into webNavigator, do not drop
  schema validation.
- **robotsPolicy service** — pass 2. REP parser + RobotsChecker with a
  TTL-cached per-host policy store. WebNavigator honors policy decisions
  when given a checker. File: `server/shared/automation/robotsPolicy.ts`.
  Do not remove the `honorRobots` default-true path.
- **responseCache service** — pass 3. LRU + ETag + stale-while-revalidate
  cache. Wired into WebNavigator.fetchPage so fresh hits skip the entire
  fetch pipeline (adapter, rate limiter, robots), stale hits trigger
  conditional GETs, and 304 responses short-circuit back to the stored
  body. File: `server/shared/automation/responseCache.ts`. Do not
  collapse into WebNavigator, do not break 304 → cached-body handling.
- **NavigationTelemetrySink** — pass 3. Pluggable per-step telemetry
  contract (request.start / request.cached / request.network /
  request.blocked / request.error). Never let a sink throw interrupt
  navigation (the emit helper wraps sinks in try/catch). File:
  `server/shared/automation/webNavigator.ts`. Do not remove the
  try/catch wrapper, do not drop the start→network lifecycle pairing.
- **AutomationTelemetryBus** — pass 5. Fan-out event bus for the
  NavigationTelemetryEvent stream. Multiple sinks (OTel, SSE, logs)
  subscribe to the same underlying events. Type filters via
  `subscribe({ types: [...] })`. `subscribeOnce` auto-unsubscribes.
  Swallows both sync throws and async rejections from sinks so bad
  downstream code can't break navigation. Ring buffer for snapshot
  debugging. File: `server/shared/automation/automationTelemetry.ts`.
  Do not drop the try/catch wrappers, do not expose `publish` to
  untrusted code paths.
- **automationTelemetryStream route** — pass 6. SSE bridge at
  `GET /api/automation/telemetry/stream` that subscribes each client
  to the global bus. Admin-only (role gate), heartbeats every 15s,
  supports `types=` filter + `replay=N` ring-buffer replay. Always
  cleans up the bus subscription + heartbeat interval on client
  disconnect. File: `server/routes/automationTelemetryStream.ts`.
  Do not weaken the admin gate, do not drop the close→unsubscribe
  cleanup.
- **useAutomationTelemetryStream hook + AutomationActivityStrip** —
  pass 7. Client-side consumer for the pass-6 SSE route. Hook exposes
  live events + connection state + exponential-backoff reconnect
  (1s → 30s cap) + ring buffer. Strip component renders the most
  recent events newest-first with per-type icon + color, event-type
  counts in the header, `role="log" aria-live="polite"` so screen
  readers announce new entries. Files:
  `client/src/hooks/useAutomationTelemetryStream.ts`,
  `client/src/components/codeChat/AutomationActivityStrip.tsx`. Do
  not drop the backoff, do not drop the aria-live region.
- **parallelFetch primitive + crawlSession concurrency option** —
  pass 9. Bounded worker pool for batch URL reads. Preserves input
  order, isolates per-URL failures, dedupes inputs, respects
  `perUrlTimeoutMs`. Hard cap 10 concurrency / 200 URLs. crawlSession
  layered concurrency on top (default 1 for back-compat, cap 6) via
  level-batched Promise.all with sequential child-enqueue to keep
  dedupe invariants correct. Files:
  `server/shared/automation/parallelFetch.ts`,
  `server/shared/automation/crawlSession.ts`. Do not drop the hard
  caps, do not parallelize the child-enqueue step (races the
  visited set).
- **crawlSession primitive** — pass 4. Bounded BFS over any PageReader
  shape (duck-typed so a future Playwright adapter can plug in). Hard
  caps: maxPages=100, maxDepth=5. Canonicalizing dedupe (fragment,
  trailing slash, query sort), same-origin guard, allowHosts suffix
  check, include/exclude regex filters, SSRF-safe protocol filter
  (http/https only — javascript:, file:, data: are refused), swallows
  onPage callback errors. File:
  `server/shared/automation/crawlSession.ts`. Do not drop the hard
  caps, do not drop the non-http(s) protocol refusal, do not drop the
  canonicalizing dedupe.

## Known-Bad

Dead ends future passes should not re-attempt without new evidence.

_(empty — populate as the loop discovers them)_

## Reconciliation Log

Conflicts between build-loop writes and parallel process writes get logged
here with the resolution rationale. Resolved by evidence recency + git log.

_(empty)_

## Build Loop Pass Log

Append-only log of what each pass accomplished. Format:
`Pass N · angle · queue · commit SHA · items completed · items deferred`

- Pass 1 · correctness-first · [bootstrap PARITY + AU-1..AU-6, AU-21] · 8baaeed · webNavigator service + 30 tests + code_web_read tool + client popover entry · deferred: AU-7 (playwright adapter), AU-9 (click/type layer), AU-22 (web_extract schema-guided), AU-25 (robots.txt)
- Pass 2 · graceful-degradation + input-validation · [AU-22, AU-25, AU-20 partial] · d0a82b9 · webExtractor + robotsPolicy + code_web_extract tool + robotsChecker wired into WebNavigator + 35 new tests · deferred: AU-7 (playwright), AU-9 (click/type), AU-23 (SSE streaming of browser events), AU-17 (OTel spans for automation)
- Pass 3 · observability + dead-code-prevention · [AU-17, AU-24] · afb47b5 · responseCache (LRU + ETag + SWR) + NavigationTelemetrySink + cache/telemetry wired through fetchPage + env-driven singletons in webTool · 25 new tests · deferred: AU-7, AU-9, AU-23, AU-16 (download files), AU-19 (multi-agent browser orchestration)
- Pass 4 · accessibility + hostile-input-security · [AU-26+AU-27 new gaps, AU-19 groundwork] · c06a175 · crawlSession primitive + code_web_crawl tool + canonicalizing dedupe + SSRF protocol filter + client popover entry · 23 new tests · deferred: AU-7 (playwright still not started), AU-9 (click/type layer), AU-14 (computer-use vision), AU-23 (SSE of browser events)
- Pass 5 · edge-cases + bundle-size · [AU-28+AU-29 new, AU-17 extension] · 3493822 · AutomationTelemetryBus (sync+async sink error isolation, type filter, ring buffer) + wired as the default telemetry sink for the WebNavigator singleton + code_web_search tool bridging to existing executeWebSearch (Tavily/Brave/Manus/LLM fallback) + vi.mock in codeChat test · 13 new tests · deferred: AU-7, AU-9, AU-14, AU-23 (SSE bridge for telemetry events)
- Pass 6 · type-safety + dev-ergonomics · [AU-23] · 3780225 · automationTelemetryStream SSE route + admin gate + types=/replay= query params + client-disconnect cleanup + mounted in _core/index.ts auth middleware + 10 tests via in-process fake req/res harness · deferred: AU-7, AU-9, AU-14, AU-16 (download files), AU-19 (multi-agent browser orchestration)
- Pass 7 · responsive + i18n · [AU-23 extension, AU-30 new gap] · 615e51b · useAutomationTelemetryStream hook (EventSource consumer with exponential backoff reconnect + ring buffer) + pure helpers (summarizeEvent, eventBadgeColor, formatBytes) + AutomationActivityStrip component with per-event icons + aria-live log + config-bar Browser button in CodeChat page + vitest include pattern extended to client/src/hooks · 17 new tests · deferred: AU-7 (playwright), AU-9 (click/type), AU-14 (vision), AU-16 (downloads)
- Pass 8 · migration-safety + docs-staleness · [AU-31 new, doc sync] · 4931c39 · docs/AUTOMATION.md (architecture diagram, per-primitive API reference, env vars table, extension points for Playwright adapter, agent tool catalog, open gap list) + CLAUDE.md automation subsystem section (points at the new doc) · zero new tests (doc-only) · deferred: AU-7, AU-9, AU-14, AU-16, AU-19
- Pass 9 · race-conditions + slow-network · [AU-32+AU-33 new] · bdb1dae · parallelFetch primitive (worker pool, per-URL failure isolation, input-order preservation, auto dedupe across inputs, per-URL timeout wrap, onProgress callback with error isolation, hard caps: 10 concurrency / 200 URLs) + crawlSession BFS level-batched parallelism (opts.concurrency, default 1 for back-compat, cap 6, preserves dedupe invariants via sequential child-enqueue step) + code_web_crawl tool schema now accepts concurrency · 13 new tests (11 parallelFetch + 2 crawl concurrency) · deferred: AU-7, AU-9, AU-14, AU-16, AU-19

---

# PARITY.md — Hybrid Build Loop Sync Doc

> **Purpose.** Bidirectional sync surface between the hybrid build loop
> (`claude/hybrid-build-loop-A29RE`) and any parallel assessment processes
> that want to suggest work or verify progress. The build loop reads this
> doc every pass and writes back what it shipped, what it deferred, and
> what new gaps it found.
>
> **Scope for this branch.** Best existing and planned comparables overall
> to Stewardly as an app — per `STEWARDLY_COMPREHENSIVE_GUIDE.md`.
>
> **How to interact.**
> - Add rows to the gap matrix if you want the build loop to work on
>   something new. Use status `open` and priority `P1|P2|P3`.
> - Flip rows to `done` once shipped — the build loop will bump depth
>   score and attach a commit SHA.
> - Append to **Known-Bad** if a dead-end was tried — stops retries.
> - Append to **Reconciliation Log** on any write conflict.

---

## 1. Protected improvements (do not weaken)

| #   | Improvement                                                                                 | Locked in commit |
| --- | ------------------------------------------------------------------------------------------- | ---------------- |
| P1  | Comparables scoring helpers are PURE (no DB/fetch) — unit-testable offline                  | Pass 1           |
| P2  | Comparables catalog is DATA-ONLY in `data.ts`; scoring logic lives in `scoring.ts`          | Pass 1           |
| P3  | Every comparable feature score is clamped to 0..3 rubric                                    | Pass 1           |
| P4  | `/comparables` is `protectedProcedure` gated (not public) — strategy-sensitive notes        | Pass 1           |
| P5  | Portfolio rebalancing math is PURE (no DB/fetch); tests run offline                          | Pass 2           |
| P6  | Rebalance proposals are CASH-NEUTRAL (sum of buys = sum of sells)                            | Pass 2           |
| P7  | Meeting note extractor is PURE and deterministic — no LLM cost, offline tests                 | Pass 3           |
| P8  | `extractNotesOffline` gives the meetings router a zero-cost fallback path                      | Pass 3           |
| P9  | Tax projector math is PURE, offline, year-rangeclamped (2024+)                                 | Pass 4           |
| P10 | Tax projector sanitizes negative/NaN income to 0 with warnings instead of throwing            | Pass 4           |
| P11 | Ledger preserves the cost-basis invariant: realized cost + remaining cost = original cost     | Pass 5           |
| P12 | Ledger emits SHORT_POSITION warnings instead of throwing on oversell (graceful degradation)    | Pass 5           |
| P13 | /api/v1 bearer tokens must match `stwly_(live\|test)_<24-128>` format before any DB lookup      | Pass 6           |
| P14 | /api/v1 endpoints are rate-limited via token bucket before any handler work                    | Pass 6           |
| P15 | /api/v1 handlers delegate to the pure services (no DB access in route layer)                   | Pass 6           |
| P16 | Estate document parser is PURE and OCR-free — caller supplies text                             | Pass 7           |
| P17 | Catalog catalog entries are immutable data (no runtime mutation) and invariant-checked in tests  | Pass 8           |
| P18 | Wash sale detector handles both pre-sale and post-sale 30-day windows                            | Pass 9           |
| P19 | Wash sale detector computes partial disallowance when replacement shares < sold shares           | Pass 9           |
| P20 | State tax module is a PURE additive extension — federal projector is untouched                  | Pass 10          |
| P21 | Webhook signer uses constant-time comparison to resist timing attacks                           | Pass 12          |
| P22 | Dispatch state machine is a PURE reducer — HTTP fetch is injected by the caller                 | Pass 12          |
| P23 | Short-position tracker is a PURE additive extension — ledger.ts is untouched                    | Pass 13          |
| P24 | Fiduciary report generator is PURE and handles partial input (every section optional)           | Pass 14          |

---

## 2. Gap matrix — comparable features vs Stewardly

Columns:

- `id` — short stable id (PARITY-<area>-<n>)
- `scope` — which comparable app/feature family
- `axis` — FeatureAxisId used in `server/services/comparables/data.ts`
- `status` — `open` | `in_progress` | `done` | `wontfix`
- `priority` — `P1` (blocker) | `P2` (should) | `P3` (nice)
- `added_by` — `assessment` | `build` (so assessment loop knows whether
  to re-verify). `build` means "I the build loop found this while
  shipping something else".
- `depth` — 0..3, same rubric as the catalog. 0 = nothing, 3 = first
  class. Mirrors the catalog's Stewardly score on this axis.
- `last_commit` — SHA when last touched (empty until shipped)
- `notes` — one-line evidence

| id                    | scope                                    | axis                 | status       | priority | added_by   | depth | last_commit | notes                                                                                     |
| --------------------- | ---------------------------------------- | -------------------- | ------------ | -------- | ---------- | ----- | ----------- | ----------------------------------------------------------------------------------------- |
| PARITY-SEED-0001      | Bootstrap comparables subsystem          | n/a                  | done         | P1       | build      | 3     | 19a7b05     | Catalog, scoring, tests, router, page, nav, route — all shipped Pass 1.                    |
| PARITY-REPORT-0001    | Fiduciary compliance report composer     | n/a                  | done         | P2       | build      | 3     | (Pass 14)   | Pass 14: cross-module composer that combines Pass 2 (rebalancing) + Pass 4 (federal tax) + Pass 5 (ledger) + Pass 9 (wash sale) + Pass 10 (state tax) + Pass 13 (shorts) + comparables into a single markdown fiduciary report, 14 tests, reportsFiduciary.build tRPC procedure. |
| PARITY-REBAL-0001     | Portfolio rebalancing / drift alerts     | rebalancing          | in_progress  | P1       | build      | 1     | (Pass 2)    | Pass 2: pure drift engine + cash-neutral proposals + tax-aware sells + 35 tests. Live portfolio ingestion still pending — see PARITY-REBAL-0002. |
| PARITY-REBAL-0002     | Live portfolio ingestion for rebalancer  | rebalancing          | open         | P1       | build      | 0     |             | Follow-up to PARITY-REBAL-0001. Wire Plaid/custodian feed → stored positions → cron that calls `computeDrift` and creates proactive_insights.    |
| PARITY-REBAL-0003     | Rebalancer UI page                       | rebalancing          | done         | P2       | build      | 2     | (Pass 3)    | Pass 3: `/rebalancing` page with holdings + targets editor, options (drift threshold / cash buffer / tax-aware / new cash), results split (drift table + trade proposals) + aria-live status region + skip link. |
| PARITY-MEET-0001      | Automated meeting transcription + notes  | meeting_transcription | in_progress  | P1       | build      | 2     | (Pass 3)    | Pass 3: pure offline note extractor (action items / decisions / concerns / dates / participants / compliance flags), 45 tests, meetings.extractNotesOffline tRPC procedure. Live audio capture + CRM push still open — see PARITY-MEET-0002. |
| PARITY-MEET-0002      | Live audio capture + CRM push            | meeting_transcription | open         | P2       | build      | 0     |             | Follow-up to PARITY-MEET-0001. Browser mic → streamed transcript → extractor → optional LLM synth → CRM write.            |
| PARITY-PORT-0001      | Portfolio accounting ledger              | portfolio_mgmt       | in_progress  | P2       | build      | 2     | (Pass 5)    | Pass 5: pure cost-basis ledger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot methods, lot tracking, realized/unrealized P&L, splits + dividends, loss harvest picker + 49 tests. Live multi-custodian aggregation open — see PARITY-PORT-0002. |
| PARITY-PORT-0002      | Live custodian aggregation into ledger   | portfolio_mgmt       | open         | P2       | build      | 0     |             | Follow-up to PARITY-PORT-0001. Wire Plaid / Addepar / BlackDiamond transaction feeds into the ledger via a nightly cron.                                                                                                                   |
| PARITY-MOBILE-0001    | Native mobile app shell                  | mobile_app           | open         | P2       | build      | 0     |             | Wealthfront/Betterment/Farther all ship native. No Capacitor/RN shell in repo yet.         |
| PARITY-API-0001       | Versioned public REST API                | api_first            | done         | P3       | build      | 3     | (Pass 6)    | Pass 6: /api/v1 mounted on Express with bearer auth (stwly_ prefix), token-bucket rate limiter (60 burst / 60 rpm), OpenAPI 3.1 spec, 6 endpoints (health, openapi.json, comparables/summary, comparables/gaps, rebalancing/simulate, tax/project-year, portfolio-ledger/run), 41 new unit tests (auth + rate-limit + openapi). |
| PARITY-TAX-0001       | Multi-year tax projection + basis track  | tax_planning         | in_progress  | P2       | build      | 3     | (Pass 4)    | Pass 4: pure projector (multi-year, Roth ladder, RMD, IRMAA, LTCG 0/15/20 stack), 46 tests, `tax.*` tRPC router. Basis tracking per-lot still open — see PARITY-TAX-0002. |
| PARITY-TAX-0002       | Per-lot basis tracking                   | tax_planning         | done         | P3       | build      | 3     | (Pass 5)    | Closed by Pass 5 — ledger.ts provides per-lot basis via `runLedger` with 6 cost-basis methods + holding period computation + lossHarvestCandidates picker. Shared primitive with PARITY-PORT-0001. |
| PARITY-ESTATE-0001    | Estate doc OCR + flow-chart              | estate_planning      | in_progress  | P3       | build      | 3     | (Pass 7)    | Pass 7: pure offline text parser (estate/documentParser.ts) — extracts testators, executors, trustees, beneficiaries (w/ per-stirpes + %/amount), specific bequests, guardians, governing state, trust kind. 32 tests. OCR pipeline still external — caller supplies text. |
| PARITY-ESTATE-0002    | OCR pipeline + visual flowchart          | estate_planning      | open         | P3       | build      | 0     |             | Follow-up to PARITY-ESTATE-0001. Add OCR adapter (Textract / doctr) + d3 flowchart component that renders the parsed structure.                                                                                                                                                              |
| PARITY-CATALOG-0001   | Catalog freshness — quarterly refresh    | n/a                  | in_progress  | P3       | build      | n/a   | (Pass 8)    | Pass 8: catalog grew from 18 → 24 apps (Addepar, Tamarac, Black Diamond, Morningstar Office, AdvicePay, Catchlight). Quarterly sourceNotes refresh cadence still open. |
| PARITY-CATALOG-0002   | Non-US comparables                       | n/a                  | done         | P3       | build      | n/a   | (Pass 11)   | Pass 11: added 6 non-US comparables — SJP (UK), Schroders (UK), AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. |
| PARITY-TAX-0003       | State tax tables (NY/CA/IL/TX)           | tax_planning         | done         | P2       | build      | 3     | (Pass 10)   | Pass 10: pure state tax projector (CA progressive with MH surcharge, NY progressive with optional NYC surcharge, IL 4.95% flat, TX zero), 15 tests, tax.projectStateTax tRPC proc, combinedEffectiveRate helper, SUPPORTED_STATES constant. Pure additive extension — federal projector untouched. |
| PARITY-REBAL-0004     | Wash sale detector                       | rebalancing          | done         | P2       | build      | 3     | (Pass 9)    | Pass 9: pure wash sale detector (washSale.ts), 17 tests, detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase helpers. Wired into portfolioLedger router. |
| PARITY-PORT-0003      | Short-position ledger tracking           | portfolio_mgmt       | done         | P3       | build      | 3     | (Pass 13)   | Pass 13: server/services/portfolio/shortPositions.ts — pure additive extension that tracks short lots opened by over-sells, covers them FIFO on subsequent buys, records cover gains (long-term + short-term), handles splits, multi-symbol isolation, valueShortPositions helper. 19 tests. portfolioLedger.trackShorts/valueShorts tRPC procs. |
| PARITY-API-0002       | Webhook delivery (outbound events)       | api_first            | in_progress  | P3       | build      | 2     | (Pass 12)   | Pass 12: server/api/v1/webhooks.ts — HMAC-SHA256 signer (Stripe-compatible `t=<ts>,v1=<hex>` header), constant-time verifier, exponential backoff with jitter (5s → 5min), retry/abandon policy (5xx + transport = retry, 4xx = abandon, max 5 attempts), pure reducer-style state machine (pending/in_flight/delivered/failed_retry/abandoned) with injected fetch — 33 tests. Delivery cron + persistence still open. |
| PARITY-PLAN-0001      | Planning pages wired to real calculators | financial_planning   | done         | P1       | build      | 3     | (Hybrid P1) | Hybrid Pass 1: TaxPlanning wired to taxProjector.project/multiYear/rothComparison tRPC, EstatePlanning rebuilt with interactive estate tax math (current law + sunset scenarios + growth projection), RiskAssessment replaced with 7-question weighted questionnaire + 5-tier risk profiles, IncomeProjection rebuilt with configurable sources + SS optimizer + Monte Carlo + year-by-year projection, InsuranceAnalysis rebuilt with DIME-method needs calculator + policy tracker + gap analysis. All 5 pages were previously hardcoded stubs. |
| PARITY-PLAN-0002      | Cross-calculator data bridge              | financial_planning   | done         | P1       | build      | 2     | (Hybrid P3) | Hybrid Pass 3: useFinancialProfile shared hook (localStorage-backed cross-page financial profile), wired into TaxPlanning (read+write), EstatePlanning (read+write), IncomeProjection (read), InsuranceAnalysis (read). Users enter income on Tax Planning → it auto-populates on Insurance Analysis. Cross-tab sync via StorageEvent. |
| PARITY-NAV-0001       | Planning page nav + route activation      | navigation           | done         | P1       | build      | 3     | (Hybrid P2) | Hybrid Pass 2: FinancialPlanning.tsx route activated (was orphaned), broken /financial-protection-score link fixed, 7 planning pages + Calculators added to sidebar navigation. |
| PARITY-CALC-0001      | Calculator rich reference context        | wealth_engine        | done         | P1       | build      | 3     | (Pass 16)   | Pass 16: CalculatorContextBar component (guardrail warnings + industry benchmark grid), Retirement page auto-runs 3 stress scenarios + historical backtest after projection, ReferenceHub surfaces live 98-year S&P 500 table with decade averages + sort/filter + interactive backtest calculator, StrategyComparison gains context bar. |
| PARITY-CALC-0002      | Calculator Monte Carlo fan chart on projections | wealth_engine  | done         | P2       | build      | 3     | (Pass 17)   | MonteCarloFan wired into Retirement page via `wealthEngine.monteCarloSim`; auto-runs after goal projection with matching horizon; 1000-trial fan chart with p10/25/50/75/90 bands. |
| PARITY-CALC-0003      | Income stream breakdown visualization    | wealth_engine        | done         | P2       | build      | 3     | (Pass 17)   | IncomeStreamBreakdown wired into PracticeToWealth page; shows 13-stream stacked bar + donut breakdown + year-over-year growth chart + year selector from BIE results. |
| PARITY-CALC-0004      | BIE back-plan activity funnel UI         | wealth_engine        | done         | P1       | build      | 3     | (Pass 18)   | BackPlan tab added to TeamBuilder with BackPlanFunnel visualization. Advisors enter target income + role, see full approaches→placed funnel + daily/weekly/monthly activity cadence + GDC bracket info. |
| PARITY-CALC-0005      | Calculator pages consistent brand + a11y | wealth_engine        | done         | P2       | build      | 2     | (Pass 19)   | QuickQuote StepBar + ScoreRing #e2e8f0 replaced with `hsl(var(--muted))` semantic token. Dead rolesQ query removed from TeamBuilder. Preset quick-start templates added to Compose tab. |
| PARITY-NAV-0001       | Calculator pages missing from sidebar nav | navigation           | done         | P1       | build      | 3     | (Pass 20)   | 4 core wealth-engine pages (Retirement, Strategy Compare, Quick Quote, Practice→Wealth) added to TOOLS_NAV Intelligence section. Previously only reachable through Engine Dashboard deep link. All 10 tests in CommandPalette.test.ts still pass. |
| PARITY-LEARN-0001     | ExamSimulator shows no real questions     | learning             | done         | P1       | build      | 3     | (Pass 21)   | ExamSimulatorPage wrapper resolves moduleSlug→trackId, fetches questions, transforms to Question[] format. Clear error states for missing tracks/empty pools. |
| PARITY-LEARN-0002     | CaseStudySimulator uses hardcoded demo    | learning             | open         | P2       | build      | 0     |             | CaseStudySimulator.tsx still renders DEMO_CASE. No backend for case studies exists (learningCases table imported but unused). |
| PARITY-MOBILE-0001    | Calculator pages mobile responsiveness    | wealth_engine        | done         | P1       | build      | 2     | (Pass 22)   | TeamBuilder tabs collapse to 3-col on mobile with icon-only labels. ReferenceHub + CalculatorContextBar grids collapse to 1-col on <640px. ProjectionChart 780px width still hardcoded. |
| PARITY-CALC-0001      | IUL/PremFin/Retirement calcs use real UWE engine | calculators    | done         | P1       | build      | 3     | (CBLP1)     | Continuous Build Loop Pass 1: replaced simplified calculator stubs with real UWE engine calls (IUL product model with cap/floor/COI, PremFin loan-advance model, Retirement via 401k product + savings growth). |
| PARITY-CALC-0002      | SCUI stress test + Monte Carlo in Calculator UI  | calculators    | done         | P2       | build      | 2     | (CBLP1)     | CBLP1: added Stress Test (S&P 500 backtest + crisis scenarios) and Monte Carlo (1000-trial probability envelope) panels to Calculators.tsx, wired to calculatorEngine SCUI/MC endpoints. |
| PARITY-CALC-0003      | Dedicated UWE/BIE configurator UIs               | calculators    | in_progress  | P2       | build      | 2     | (CBLP8)     | CBLP8: BIE configurator page at /wealth-engine/business-income with role picker, income streams, team config, year projection, back-planning. Linked from Calculators page. UWE configurator still pending. |
| PARITY-CALC-0004      | Planning stub pages disconnected from backends   | calculators    | done         | P1       | build      | 3     | (CBLP6)     | All 6 planning pages now wired: Tax Planning → tax.projectYear + projectStateTax (CBLP2). Estate Planning → UWE estate model + estate.parseDocumentOffline (CBLP2). Income Projection → UWE.simulate + Monte Carlo (CBLP2). Insurance Analysis → calculatorEngine.uweEstPrem for 4 product types (CBLP6). Risk Assessment → rebalancing.simulate drift engine with interactive holdings/targets (CBLP6). Protection Score already functional (interactive quiz). |
| PARITY-CALC-0005      | Protection Score route mismatch fixed            | calculators    | done         | P0       | build      | 3     | (CBLP2)     | Calculators.tsx linked /financial-protection-score but App.tsx only had /protection-score. Added dual route. |
| PARITY-NAV-0001       | Persona labels pluralized                        | navigation     | done         | P2       | build      | 3     | (CBLP1)     | CBLP1: Person→People, Client→Clients, Advisor→Professionals, Manager→Leaders, Steward→Stewards across PersonaSidebar5 + Chat.tsx sidebar. |
| PARITY-MOBILE-0002    | GlobalFooter overlaps mobile tab bar              | mobile_ux      | done         | P1       | build      | 3     | (CBLP3)     | GlobalFooter now hidden on mobile (`hidden lg:block`) for authenticated pages where AppShell's tab bar is active. Public pages still show footer. |
| PARITY-MOBILE-0003    | Chat page missing mobile bottom tab navigation    | mobile_ux      | done         | P1       | build      | 3     | (CBLP3)     | Chat page now has matching mobile bottom tab bar (Chat/Tools/Insights/Learn) with 44px+ touch targets, `pb-16 lg:pb-0` content padding. Consistent with AppShell's mobile nav. |
| PARITY-MOBILE-0004    | Chat model picker inaccessible on mobile          | mobile_ux      | done         | P1       | build      | 3     | (CBLP3)     | Added always-visible model indicator button on mobile + bottom-sheet model picker with 44px touch targets and Done button. Previously hidden behind `hidden md:flex` More/Less toggle. |
| PARITY-SEO-0001       | 47 pages missing SEOHead metadata                  | seo            | done         | P1       | build      | 3     | (CBLP4)     | Added SEOHead with title + description to all 47 pages (41 main + 6 learning) that had AppShell but no SEO metadata. Fixed CodeChat title from "Prompt templates" to "Code Chat". |
| PARITY-NAV-0002       | /documents nav redirect eliminated                 | navigation     | done         | P2       | build      | 3     | (CBLP4)     | Changed navigation.ts Documents href from /documents (redirect to /settings/knowledge) to direct /settings/knowledge. Eliminates unnecessary redirect hop. |
| PARITY-NAV-0003       | Duplicate Brain icon for Concept Map               | navigation     | done         | P2       | build      | 3     | (CBLP4)     | Changed Concept Map icon from Brain (duplicate of Intelligence Hub) to GitBranch. More semantically appropriate for a connection graph. |
| PARITY-AGENT-0001     | Autonomous coding planner stubbed (not wired to LLM) | agentic      | done         | P0       | build      | 3     | (CBLP5)     | subtaskPlanner + toolPlanner in startAutonomousJob now call contextualLLM. Subtask planner decomposes goals into steps with history-aware prompting. Tool planner returns structured JSON tool calls. Graceful fallback on LLM failure. |
| PARITY-AGENT-0002     | Proactive insights generation not automated         | agentic        | done         | P1       | build      | 2     | (CBLP5)     | coaching-generation cron (6h interval) now queries active users and generates role-appropriate insights (productivity for advisors, financial for clients, learning for all). 5-insight cap per user, 7-day recency window. |
| PARITY-AGENT-0003     | Workflow tool_call steps don't dispatch tools       | agentic        | done         | P1       | build      | 2     | (CBLP5)     | tool_call case in executeWorkflow now dispatches to real services: deepContextAssembler, notifications, systemHealthEvents, reportExporter, or falls back to contextualLLM for unknown tools. |
| PARITY-AGENT-0004     | Improvement engine hypothesis generation missing    | agentic        | open         | P2       | build      | 0     |             | Signal detection works but hypothesis generation + test execution loop not wired. Needs contextualLLM to propose improvements from detected signals. |
| PARITY-A11Y-0001      | Learning feedback events wired (G21/G23 partial)   | accessibility  | done         | P1       | build      | 2     | (CBLP7)     | LearningQuizRunner + LearningFlashcardStudy now call pil.giveFeedback() on correct/incorrect/flip/complete. Haptic + earcon feedback fires on supported devices. |
| PARITY-A11Y-0002      | Calculator feedback events wired (G21/G23 partial) | accessibility  | done         | P2       | build      | 1     | (CBLP7)     | Calculators.tsx IUL Calculate button fires pil.giveFeedback("engine.calculation_complete"). |
| PARITY-A11Y-0003      | ::selection styled in brand palette (G48)           | accessibility  | done         | P3       | build      | 3     | (CBLP7)     | Added ::selection and ::-moz-selection with Stewardship Gold (oklch 0.76 0.14 80 / 0.30) + deep navy text. |

---

## 3. Known-Bad (dead-ends — do not retry)

_Empty — nothing has been tried and failed yet on this branch._

---

## 4. Reconciliation Log

_Empty — no three-way merge conflicts yet._

Log format when first conflict occurs:

```
YYYY-MM-DD · Pass N · file · cause · resolution
```

---

## 5. Build Loop Pass Log

One-line summary per pass. Next-pass-you reads this to find out what
prior-pass-you did and didn't finish.

| Pass | Angle            | Queue summary                                                            | Commit SHA | Items completed                                                                                                                                                            | Items deferred                                                                                                     |
| ---- | ---------------- | ------------------------------------------------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 1    | fresh-assessment | Bootstrap comparables subsystem — catalog, scoring, router, page, nav   | 19a7b05    | data.ts (18 apps × 18 axes), scoring.ts (pure helpers), 46 unit tests, comparables tRPC router, `/comparables` page, AppShell + PersonaSidebar5 nav entry, PARITY.md scaffold | PARITY-REBAL/MEET/PORT/MOBILE/API/TAX/ESTATE/CATALOG rows added as OPEN gap items for future passes and assessment. |
| 2    | correctness      | Portfolio rebalancing drift engine — pure math + tRPC simulate endpoint | d5cf2dd    | rebalancing.ts (computeDrift + simulateWithNewCash + validateTargetAllocation + tax-aware sell ordering + cash buffer rule), 35 unit tests, rebalancing tRPC router, catalog bump from 0→1, PARITY-REBAL-0002 + PARITY-REBAL-0003 follow-up rows                   | Live portfolio ingestion (PARITY-REBAL-0002) and UI page (PARITY-REBAL-0003) deferred to later passes.                                                                                                                    |
| 3    | integration      | /rebalancing UI page + meetings.extractNotesOffline (2 gap closures)    | c0db55d    | noteExtractor.ts (pure regex/heuristic extractor) + 45 tests, meetings.extractNotesOffline tRPC procedure, Rebalancing.tsx page (holdings + targets editor + drift table + proposals + aria-live status + skip link), PARITY-REBAL-0003 done, PARITY-MEET-0001 bumped 1→2 + PARITY-MEET-0002 follow-up row, Scale icon added to AppShell + PersonaSidebar5 advisor layer | PARITY-MEET-0002 (live audio), PARITY-REBAL-0002 (live ingestion) still open — both require external infra. |
| 4    | type-safety + input-validation | Multi-year tax projector pure module + tRPC router | c373379    | projector.ts (projectYear/projectYears/projectRothLadder/computeRMD/irmaaTier/summarizeYears/inflationFactor) with full MFJ/MFS/HOH/single bracket tables for 2024 current-law + post-TCJA-sunset model, 46 unit tests, server/routers/tax.ts mounted as appRouter.tax, tax_planning catalog score bumped 2→3, PARITY-TAX-0002 follow-up row for basis tracking | PARITY-TAX-0002 (per-lot basis) deferred. |
| 5    | test coverage + graceful degradation | Cost-basis ledger + per-lot basis + loss harvest (2 gap closures) | 5407792    | ledger.ts (runLedger with 6 methods, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router, portfolio_mgmt catalog bump 1→2, PARITY-TAX-0002 closed via shared primitive, PARITY-PORT-0002 follow-up row | PARITY-PORT-0002 (live feed) deferred. |
| 6    | security + dev ergonomics | Public versioned REST /api/v1 surface with bearer auth + rate limit + OpenAPI spec | 875ea7f    | api/v1/* (auth, rateLimit, openapi, router), 41 unit tests, mounted on /api/v1 ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed | none — closed in full this pass. |
| 7    | offline (zero external deps) | Estate document pure text parser | 2a4d6f4    | estate/documentParser.ts + 32 tests, estate.parseDocumentOffline tRPC proc, estate_planning catalog bump 2→3, PARITY-ESTATE-0001 in_progress depth 3, PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 deferred. |
| 8    | accessibility + docs-staleness | Catalog expansion + Comparables a11y audit | bbf249e    | 6 new comparables, Comparables.tsx skip-link + aria-live + aria-labels, P17 added | Quarterly sourceNotes refresh cadence still open. |
| 9    | edge cases | Wash sale detector + 5 new PARITY rows found during builds | 2f5277e    | washSale.ts + 17 tests + 2 tRPC procs, 5 new PARITY rows | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued. |
| 10   | migration safety | State tax tables (CA/NY/IL/TX) as additive extension | 05ea24a    | stateTax.ts (projectStateTax + combinedEffectiveRate + SUPPORTED_STATES) + 15 tests, tax.projectStateTax + tax.supportedStates tRPC procs, PARITY-TAX-0003 closed done depth 3, P20 added (pure additive extension) | 3 remaining P3 rows (CATALOG-0002, PORT-0003, API-0002) queued. |
| 11   | i18n | Non-US comparables added to catalog | bb74643    | 6 new comparables (SJP/Schroders/AJ Bell/Nomura/Netwealth/Scalable), invariants still pass, PARITY-CATALOG-0002 closed done | — |
| 12   | observability | Outbound webhook signer + dispatch state machine | 19d15ef    | api/v1/webhooks.ts (HMAC-SHA256 Stripe-compat signer, constant-time verifier, backoff, reducer state machine with injected fetch) + 33 tests, P21 + P22 added, PARITY-API-0002 in_progress depth 2 | Delivery cron + persistence still open. |
| 13   | dead-code + race-conditions | Short-position ledger pure extension | 923198b    | shortPositions.ts + 19 tests + trackShorts/valueShorts tRPC procs, P23, PARITY-PORT-0003 closed done depth 3 | — |
| 14   | error states | Cross-module fiduciary compliance report composer | 6dba344    | reports/fiduciaryReport.ts + 14 tests + reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone combining Passes 2/4/5/9/10/13 | — |
| 15   | integration (Pass 6 × Pass 14) | Expose fiduciary report through public /api/v1 | 6833d51    | /api/v1/reports/fiduciary POST endpoint wiring buildFiduciaryReport behind the Pass 6 bearer auth + rate limit. OpenAPI spec updated. 1 new test covering the endpoint in the spec. | — |
| BL-1 | rich reference integration + calculator depth | PARITY-CALC-0001: enrich StrategyComparison + Retirement with stress test, backtest, benchmarks, year-by-year detail | 7c2cdbc | StrategyComparison: +stress test panel (3 scenarios), historical backtest (survival/best/worst/median), industry benchmarks strip, year-by-year detail table, guardrail warnings. Retirement: +GFC stress test, historical backtest, benchmark context strip. 4 new PARITY rows (CALC-0001 through 0004). | CALC-0002 (Monte Carlo bands), CALC-0003 (product refs inline), CALC-0004 (guardrails on all pages) |
| BL-2 | cross-app cohesion + dead links + product references | Fix Calculators.tsx dead link + benchmark rendering + product references panel | (pending) | Fixed /financial-protection-score → /protection-score dead link in Calculators.tsx hub. Fixed INDUSTRY_BENCHMARKS rendering to handle actual Record<string, heterogeneous> shape (not array). Added 14-product references panel to StrategyComparison. CALC-0001 depth 2→3, CALC-0003 closed. | CALC-0002 (Monte Carlo bands), CALC-0004 (guardrails on all pages) || reports/fiduciaryReport.ts (buildFiduciaryReport) + 14 tests, reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone module combining Passes 2/4/5/9/10/13 + comparables into a single markdown report. | — || shortPositions.ts (trackShortPositions + valueShortPositions + ShortLot tracking w/ FIFO cover + splits + multi-symbol isolation + over-cover warning), 19 tests, portfolioLedger.trackShorts + valueShorts tRPC procs, P23 (pure additive — ledger.ts untouched), PARITY-PORT-0003 closed done depth 3 | — || api/v1/webhooks.ts (signWebhookBody, verifyWebhookSignature, parseSignatureHeader, buildSignatureHeader, backoffMs, shouldRetry, initDispatchState, stepDispatchState, isTerminal, isReadyNow), 33 tests, PARITY-API-0002 in_progress depth 2, P21 + P22 added | Delivery cron + persistence layer still open. || 6 new apps — SJP + Schroders + AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. PARITY-CATALOG-0002 closed done. 46 scoring tests still pass (invariants hold). | PARITY-PORT-0003 and PARITY-API-0002 still queued. || washSale.ts (detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase) + 17 unit tests, portfolioLedger.detectWashSales/canHarvest tRPC procs, new PARITY rows for CATALOG-0002/TAX-0003/REBAL-0004/PORT-0003/API-0002, PARITY-REBAL-0004 closed same pass | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued for future passes. || Catalog grew 18→24 apps (Addepar / Tamarac / Black Diamond / Morningstar Office / AdvicePay / Catchlight), Comparables.tsx got skip-link + aria-live status + aria-label on every axis leader + catalog card + exemplar button, PARITY-CATALOG-0001 in_progress | Quarterly sourceNotes refresh cadence still open. || estate/documentParser.ts (parseEstateDocument + renderEstateMarkdown), 32 unit tests covering document kind detection, trust kind, governing state, testators, executors (incl successor), trustees, guardians, beneficiaries (dollar + percentage + per stirpes), specific bequests, residuary reference, defensive handling, end-to-end realistic will. estate.parseDocumentOffline tRPC procedure. estate_planning catalog bump 2→3. PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 (OCR + flowchart) deferred. || api/v1/auth.ts (bearer token format check + resolver + middleware), api/v1/rateLimit.ts (token bucket), api/v1/openapi.ts (3.1 spec builder), api/v1/router.ts (Express sub-router wiring 7 endpoints), 41 unit tests across auth + rateLimit + openapi, mounted on /api/v1 in server/_core/index.ts ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed done | none — PARITY-API-0001 closed in full this pass. || ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |

| 16   | planning-page-activation | Wire 5 stub planning pages to real calculator backends (PARITY-PLAN-0001) | abf388d | TaxPlanning.tsx → taxProjector tRPC, EstatePlanning.tsx → estate tax math, RiskAssessment.tsx → 7-question questionnaire, IncomeProjection.tsx → Monte Carlo + SS optimizer, InsuranceAnalysis.tsx → DIME method. 0 regressions. | — |
| 17   | navigation-cohesion | Activate FinancialPlanning + fix nav gaps (PARITY-NAV-0001) | 5c381a8 | /financial-planning route, broken /financial-protection-score link fix, 7 planning pages + Calculators added to sidebar. Nav reachability 6/6. | — |
| 18   | cross-calculator-data-bridge | Shared financial profile for cross-page data persistence (PARITY-PLAN-0002) | 0867e7b | useFinancialProfile hook (localStorage cross-tab sync), wired into TaxPlanning (r/w), EstatePlanning (r/w), IncomeProjection (r), InsuranceAnalysis (r). Users enter data once, flows everywhere. | — |
| 19   | test-coverage | 42 tests for planning calculations + shared profile | 5b3d393 | planningCalculations.test.ts (27: estate tax, DIME, risk scoring, Monte Carlo) + useFinancialProfile.test.ts (15: profileValue, localStorage). 4638 passing total. | — |
| 20   | accessibility | aria-labels + input linkage on planning pages | 200318f | Slider aria-labels on ~30 sliders across 5 pages, EstatePlanning toggle labels, IncomeProjection + InsuranceAnalysis input id/htmlFor linkage. | — |
| 21   | dead-code + correctness | Fix useMemo misuse + unused refs | d811a8c | EstatePlanning useMemo→useEffect for debounced sync, TaxPlanning unused ref/import cleanup. | — |
| 22   | cross-page-navigation | PlanningCrossNav + cross-calculator insights | 5326fbf | Shared nav bar on all 5 planning pages showing related tools + data indicators. Cross-page estate/insurance insights on TaxPlanning. | — |
| 23   | learning-data-wiring | ExamSimulator fetches real questions from backend | ac36d57 | useParams → getTrackBySlug → listQuestions → mapDbQuestion. Loading/error/empty states in AppShell. | — |
| 24   | learning-achievements | AchievementSystem wired to real mastery data | bc6e9d7 | mastery.summary + mastery.dueNow → deriveAchievements(). Streak via localStorage. AppShell wrapped. | — |
| 25   | graceful-degradation | Client-side tax fallback + 10 tests | 68cca8c | projectTaxClientSide (2026 MFJ/Single/HOH brackets), auto-fallback on server failure, amber banner. 37 planning tests total. | — |
| 16   | correctness + completeness (calculator UI richness) | Calculator pages enriched with contextual reference data + stress testing + historical backtest | 748d4ba | CalculatorContextBar component (guardrail warnings + benchmark context), Retirement page gains auto stress test + historical backtest + context bar, ReferenceHub gains live 98-year S&P 500 table with decade analysis + sortable/filterable view + interactive backtest calculator, StrategyComparison gains context bar | PARITY-CALC-0002, PARITY-CALC-0003 queued. |
| 17   | integration + completeness (visualization wire-up) | Monte Carlo fan chart + income stream breakdown | 477a04c | MonteCarloFan wired into Retirement (auto-runs 1000 trials after projection), IncomeStreamBreakdown wired into PracticeToWealth (13-stream stacked visualization from BIE data), CalculatorContextBar added to PracticeToWealth. PARITY-CALC-0002 + PARITY-CALC-0003 closed done depth 3 | — |
| 18   | accessibility + input-validation (BackPlan + QuickQuote) | BIE back-plan UI + QuickQuote context bar | 1968c8a | BackPlan tab added to TeamBuilder (6th tab) with BackPlanFunnel visualization wired to `calculatorEngine.bieBackPlan` — advisors enter target income + role, see the full activity funnel (approaches→set→held→apps→placed + daily/weekly/monthly cadence). QuickQuote step 3 gains CalculatorContextBar showing savings rate guardrails + industry benchmarks. PARITY-CALC-0004 closed done | — |
| 19   | dead code + brand consistency (calculator polish) | Dead code removal + brand token fix + preset templates | bc721b7 | Removed unused `rolesQ` query from TeamBuilder (eliminated unnecessary network request), replaced hardcoded `#e2e8f0` in QuickQuote with `hsl(var(--muted))` semantic token, added 4 quick-start preset buttons to TeamBuilder Compose tab (Solo/Exp/Director+3/MD Team). PARITY-CALC-0005 closed done | — |
| 20   | cross-app cohesion + surfacing (nav coverage) | Calculator pages surfaced in navigation | 2b618ee | Added 4 missing wealth-engine pages to sidebar navigation (Retirement, Strategy Compare, Quick Quote, Practice→Wealth) — previously only reachable through Engine Dashboard. Users can now navigate directly to any calculator from the sidebar Intelligence section. PARITY-NAV-0001 closed | — |
| 21   | data pipeline + learning content depth | ExamSimulator wired to real DB questions | 4669ce6 | Created ExamSimulatorPage wrapper that resolves moduleSlug → trackId via getTrackBySlug, fetches questions via listQuestions, transforms DB rows into ExamSimulator Question[] format. Users now see real imported questions instead of empty placeholder. Clear error states for missing tracks and empty question pools. PARITY-LEARN-0001 closed | CaseStudySimulator still hardcoded (PARITY-LEARN-0002 open) |
| 22   | responsive + mobile UX (calculator pages) | Mobile responsiveness fixes across calculators | b6ccb96 | TeamBuilder 6-tab grid now responsive (grid-cols-3 md:grid-cols-6, text labels hidden on mobile showing icons only). ReferenceHub decade/stats grids collapse to single column on small screens. CalculatorContextBar benchmark grid responsive. PARITY-MOBILE-0001 closed | Chart width overflow (780px hardcoded) remains — requires ProjectionChart component change |
| 23   | test coverage + type safety | calculatorHelpers pure module + 33 unit tests | TBD | Extracted pure helpers (formatBenchmarkValue, transformDbQuestion, transformDbQuestions, sanitizeGuardrailParams) from CalculatorContextBar + ExamSimulatorPage into `calculatorHelpers.ts`. 33 unit tests covering all benchmark formats, question transformation edge cases, and parameter sanitization. vitest config extended to include wealth-engine component tests. | — || reports/fiduciaryReport.ts (buildFiduciaryReport) + 14 tests, reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone module combining Passes 2/4/5/9/10/13 + comparables into a single markdown report. | — || shortPositions.ts (trackShortPositions + valueShortPositions + ShortLot tracking w/ FIFO cover + splits + multi-symbol isolation + over-cover warning), 19 tests, portfolioLedger.trackShorts + valueShorts tRPC procs, P23 (pure additive — ledger.ts untouched), PARITY-PORT-0003 closed done depth 3 | — || api/v1/webhooks.ts (signWebhookBody, verifyWebhookSignature, parseSignatureHeader, buildSignatureHeader, backoffMs, shouldRetry, initDispatchState, stepDispatchState, isTerminal, isReadyNow), 33 tests, PARITY-API-0002 in_progress depth 2, P21 + P22 added | Delivery cron + persistence layer still open. || 6 new apps — SJP + Schroders + AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. PARITY-CATALOG-0002 closed done. 46 scoring tests still pass (invariants hold). | PARITY-PORT-0003 and PARITY-API-0002 still queued. || washSale.ts (detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase) + 17 unit tests, portfolioLedger.detectWashSales/canHarvest tRPC procs, new PARITY rows for CATALOG-0002/TAX-0003/REBAL-0004/PORT-0003/API-0002, PARITY-REBAL-0004 closed same pass | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued for future passes. || Catalog grew 18→24 apps (Addepar / Tamarac / Black Diamond / Morningstar Office / AdvicePay / Catchlight), Comparables.tsx got skip-link + aria-live status + aria-label on every axis leader + catalog card + exemplar button, PARITY-CATALOG-0001 in_progress | Quarterly sourceNotes refresh cadence still open. || estate/documentParser.ts (parseEstateDocument + renderEstateMarkdown), 32 unit tests covering document kind detection, trust kind, governing state, testators, executors (incl successor), trustees, guardians, beneficiaries (dollar + percentage + per stirpes), specific bequests, residuary reference, defensive handling, end-to-end realistic will. estate.parseDocumentOffline tRPC procedure. estate_planning catalog bump 2→3. PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 (OCR + flowchart) deferred. || api/v1/auth.ts (bearer token format check + resolver + middleware), api/v1/rateLimit.ts (token bucket), api/v1/openapi.ts (3.1 spec builder), api/v1/router.ts (Express sub-router wiring 7 endpoints), 41 unit tests across auth + rateLimit + openapi, mounted on /api/v1 in server/_core/index.ts ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed done | none — PARITY-API-0001 closed in full this pass. || ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |
| 16   | test coverage | Calculator capability parity — pure-function unit tests for 6 untested calculator engines | TBD | ssOptimizer.test.ts (37 tests: PIA calc, FRA, benefit reduction/increase, break-even, NPV, spousal/survivor, taxation, recommendations), hsaOptimizer.test.ts (22 tests: strategies, limits, Medicare coord, triple tax advantage, edge cases), charitableGiving.test.ts (23 tests: 5 vehicles, bunching, effective giving), charitableOptimizer.test.ts (26 tests: vehicles, AGI limits, bunching, recommendations), divorceFinancial.test.ts (30 tests: scenarios, after-tax, property classification, support, lifestyle, timeline), educationPlanner.test.ts (36 tests: cost projection, 5 vehicles, funding gap, strategies). **174 new tests total, 0 regressions.** | SCUI stress testing UI (data exists in server/engines/scui.ts but no consumer UI); Medicare/LTC engines also untested (lower priority — they have DB dependencies). || reports/fiduciaryReport.ts (buildFiduciaryReport) + 14 tests, reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone module combining Passes 2/4/5/9/10/13 + comparables into a single markdown report. | — || shortPositions.ts (trackShortPositions + valueShortPositions + ShortLot tracking w/ FIFO cover + splits + multi-symbol isolation + over-cover warning), 19 tests, portfolioLedger.trackShorts + valueShorts tRPC procs, P23 (pure additive — ledger.ts untouched), PARITY-PORT-0003 closed done depth 3 | — || api/v1/webhooks.ts (signWebhookBody, verifyWebhookSignature, parseSignatureHeader, buildSignatureHeader, backoffMs, shouldRetry, initDispatchState, stepDispatchState, isTerminal, isReadyNow), 33 tests, PARITY-API-0002 in_progress depth 2, P21 + P22 added | Delivery cron + persistence layer still open. || 6 new apps — SJP + Schroders + AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. PARITY-CATALOG-0002 closed done. 46 scoring tests still pass (invariants hold). | PARITY-PORT-0003 and PARITY-API-0002 still queued. || washSale.ts (detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase) + 17 unit tests, portfolioLedger.detectWashSales/canHarvest tRPC procs, new PARITY rows for CATALOG-0002/TAX-0003/REBAL-0004/PORT-0003/API-0002, PARITY-REBAL-0004 closed same pass | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued for future passes. || Catalog grew 18→24 apps (Addepar / Tamarac / Black Diamond / Morningstar Office / AdvicePay / Catchlight), Comparables.tsx got skip-link + aria-live status + aria-label on every axis leader + catalog card + exemplar button, PARITY-CATALOG-0001 in_progress | Quarterly sourceNotes refresh cadence still open. || estate/documentParser.ts (parseEstateDocument + renderEstateMarkdown), 32 unit tests covering document kind detection, trust kind, governing state, testators, executors (incl successor), trustees, guardians, beneficiaries (dollar + percentage + per stirpes), specific bequests, residuary reference, defensive handling, end-to-end realistic will. estate.parseDocumentOffline tRPC procedure. estate_planning catalog bump 2→3. PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 (OCR + flowchart) deferred. || api/v1/auth.ts (bearer token format check + resolver + middleware), api/v1/rateLimit.ts (token bucket), api/v1/openapi.ts (3.1 spec builder), api/v1/router.ts (Express sub-router wiring 7 endpoints), 41 unit tests across auth + rateLimit + openapi, mounted on /api/v1 in server/_core/index.ts ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed done | none — PARITY-API-0001 closed in full this pass. || ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |
| CBL1 | calculator-wiring + persona-naming | [A1: pluralize personas, A2: wire calc stubs to UWE, A3: SCUI+MC UI] | f8aa97c | Persona labels pluralized (People/Clients/Professionals/Leaders/Stewards) across PersonaSidebar5 + Chat.tsx. IUL/PremFin/Retirement stubs replaced with real UWE engine (cap/floor COI, loan-advance, 401k product models). Stress Test + Monte Carlo panels added to Calculators.tsx (SCUI backtest + crisis scenarios, 1000-trial MC probability envelope). 6 PARITY rows added (3 done, 2 open gaps, 1 nav done). | PARITY-CALC-0003 (dedicated UWE/BIE configurators), PARITY-CALC-0004 (planning stub→backend wiring). |
| CBL2 | correctness + route wiring | [R1: fix protection score 404, A1: wire Tax Planning, A2: wire Estate Planning, A3: wire Income Projection] | 05dfab1 | Fixed Protection Score /financial-protection-score 404 (dual route). Tax Planning rewritten from hardcoded to interactive with tax.projectYear + projectStateTax + RMD (filing status, state, income, deductions). Estate Planning gains interactive estate tax calculator via UWE estate model + document parser via estate.parseDocumentOffline. Income Projection gains editable sources + UWE portfolio sustainability + Monte Carlo probability. PARITY-CALC-0004 bumped 0→2. | PARITY-CALC-0004 remaining: Risk Assessment, Insurance Analysis stubs still hardcoded. |
| CBL3 | mobile UX consistency | [A1: hide GlobalFooter on mobile, A2: Chat bottom tab bar, A3: Chat mobile model picker] | 9dd818a | GlobalFooter hidden on mobile for authenticated pages (avoids double-nav with AppShell tab bar). Chat page gains matching bottom tab bar (Chat/Tools/Insights/Learn, 44px touch targets, WCAG compliant). Chat model picker now accessible on mobile via always-visible Brain button + bottom-sheet modal with Done button. 3 PARITY-MOBILE rows closed. | — |
| CBL4 | SEO + navigation cohesion | [A1: 47 pages SEOHead, A2: /documents redirect fix, A3: duplicate icon fix] | f045d8b | Added SEOHead to 47 pages (41 main + 6 learning) with proper titles + descriptions. Fixed Documents nav to point directly to /settings/knowledge instead of redirect. Changed Concept Map icon from duplicate Brain to GitBranch. PARITY-SEO-0001 + PARITY-NAV-0002 + PARITY-NAV-0003 all closed. | — |
| CBL5 | agentic capabilities | [A1: autonomous planner → LLM, A2: proactive insights cron, A3: workflow tool dispatch] | dc1ede8 | Autonomous coding planner wired to contextualLLM (subtask decomposition + tool call generation with fallback). Coaching-generation cron now generates role-aware proactive insights for active users every 6h. Workflow executeWorkflow tool_call steps now dispatch to real services (deepContextAssembler, notifications, reporting) or LLM fallback. PARITY-AGENT-0001..0003 closed. | PARITY-AGENT-0004 (improvement engine hypothesis generation) deferred. |
| CBL6 | remaining calc stubs + insurance/risk wiring | [A1: Insurance Analysis → UWE premiums, A2: Risk Assessment → drift engine] | 87e986f | Insurance Analysis rewritten with interactive profile inputs + real UWE premium estimation for term/IUL/DI/LTC products. Risk Assessment rewritten with editable risk factors + holdings/targets + real rebalancing.simulate drift analysis (drift alerts + trade proposals). PARITY-CALC-0004 closed (all 6 planning pages now wired to real backends). | LearningHome enhancement deferred to CBL7. |
| CBL7 | accessibility + feedback wiring | [A1: learning feedback, A2: calc feedback, A3: ::selection] | 404d06b | Wired pil.giveFeedback into LearningQuizRunner (correct/incorrect/complete) + LearningFlashcardStudy (correct/incorrect/flip/complete) + Calculators IUL (engine.calculation_complete). Added ::selection CSS in Stewardship Gold. 3 PARITY-A11Y rows + G48 closed. | Remaining 25+ feedback specs still unwired across other feature areas. |
| CBL8 | BIE configurator UI | [A1: BIE page, A2: link from Calculators] | (prior) |
| CBL9 | correctness + input validation (Chat SSE pipeline) | [A1: SSE message validation, A2: merge-corrupted files, A3: dead imports, A4: tool call null safety, A5: maxIterations cap, A6: abort signal propagation, A7: TS error fixes] | 6d28a3d | 7 merge-corrupted pages restored, 5 SSE hardening fixes, 3 server type fixes, 2 dead imports removed. 0 TS errors (from 79+), build 19.33s. | — |
| CBL10 | test coverage + dead code audit | [A1: 21 SSE validation tests, A2: dead code audit] | f63141d | 21 new tests, dead code audit (server clean, client ~40 orphan files documented). | PARITY-DEADCODE-0001 deferred (P3, XL). |
| CBL11 | cross-app cohesion + data pipeline | [A1: calculator-to-chat context bridge, A2: wire TaxPlanning + EstatePlanning persistCalculation] | 66dfdb1 | calculatorContext.ts pure module + 21 tests. TaxPlanning + EstatePlanning auto-persist. Chat.tsx injects calc context as system message. | Wire remaining planning pages in future pass. |
| CBL12 | agentic capabilities + continuous improvement | [A1: platform self-assessment module, A2: hypothesis generation] | af60872 | platformSelfAssessment.ts + 24 tests. 4 health assessors + hypothesis generator + markdown formatter. | LLM refinement deferred. |
| CBL13 | cross-app cohesion (complete calc bridge) | [A1: wire persistCalculation to Income/Insurance/Risk pages] | 72cb889 | All 5 planning pages auto-persist results. Full bridge complete. | — |
| CBL14 | correctness (learning) + cleanup | [A1: fix flashcard double-count bug, A2: remove duplicate feedback dispatch, A3: vitest config cleanup] | (pending) | LearningFlashcardStudy had merge-corrupted counter code: correct/incorrect counts were incremented TWICE per answer (lines 134-142 had two parallel if/else blocks). Also had duplicate pil.giveFeedback calls alongside sendFeedback. Fixed to single increment + single feedback path. | — | Created /wealth-engine/business-income page with role picker (11 roles), income streams config, team size/FYC, AUM inputs, multi-year BIE projection table, back-planning (target income → required GDC), presets list. Wired to calculatorEngine.bieSimulate + bieBackPlan + bieRoles + biePresets. Added to App.tsx routes + Calculators Wealth Engine grid. PARITY-CALC-0003 bumped 0→2. | UWE product configurator still pending. || reports/fiduciaryReport.ts (buildFiduciaryReport) + 14 tests, reportsFiduciary.build tRPC proc, P24, PARITY-REPORT-0001 closed done depth 3. Capstone module combining Passes 2/4/5/9/10/13 + comparables into a single markdown report. | — || shortPositions.ts (trackShortPositions + valueShortPositions + ShortLot tracking w/ FIFO cover + splits + multi-symbol isolation + over-cover warning), 19 tests, portfolioLedger.trackShorts + valueShorts tRPC procs, P23 (pure additive — ledger.ts untouched), PARITY-PORT-0003 closed done depth 3 | — || api/v1/webhooks.ts (signWebhookBody, verifyWebhookSignature, parseSignatureHeader, buildSignatureHeader, backoffMs, shouldRetry, initDispatchState, stepDispatchState, isTerminal, isReadyNow), 33 tests, PARITY-API-0002 in_progress depth 2, P21 + P22 added | Delivery cron + persistence layer still open. || 6 new apps — SJP + Schroders + AJ Bell (UK), Nomura Wealth (JP), Netwealth (AU), Scalable Capital (DE). Catalog now 30 apps across 3 continents. PARITY-CATALOG-0002 closed done. 46 scoring tests still pass (invariants hold). | PARITY-PORT-0003 and PARITY-API-0002 still queued. || washSale.ts (detectWashSales + canHarvestWithoutWashSale + earliestSafeRepurchase) + 17 unit tests, portfolioLedger.detectWashSales/canHarvest tRPC procs, new PARITY rows for CATALOG-0002/TAX-0003/REBAL-0004/PORT-0003/API-0002, PARITY-REBAL-0004 closed same pass | CATALOG-0002/TAX-0003/PORT-0003/API-0002 queued for future passes. || Catalog grew 18→24 apps (Addepar / Tamarac / Black Diamond / Morningstar Office / AdvicePay / Catchlight), Comparables.tsx got skip-link + aria-live status + aria-label on every axis leader + catalog card + exemplar button, PARITY-CATALOG-0001 in_progress | Quarterly sourceNotes refresh cadence still open. || estate/documentParser.ts (parseEstateDocument + renderEstateMarkdown), 32 unit tests covering document kind detection, trust kind, governing state, testators, executors (incl successor), trustees, guardians, beneficiaries (dollar + percentage + per stirpes), specific bequests, residuary reference, defensive handling, end-to-end realistic will. estate.parseDocumentOffline tRPC procedure. estate_planning catalog bump 2→3. PARITY-ESTATE-0002 follow-up row for OCR + flowchart | PARITY-ESTATE-0002 (OCR + flowchart) deferred. || api/v1/auth.ts (bearer token format check + resolver + middleware), api/v1/rateLimit.ts (token bucket), api/v1/openapi.ts (3.1 spec builder), api/v1/router.ts (Express sub-router wiring 7 endpoints), 41 unit tests across auth + rateLimit + openapi, mounted on /api/v1 in server/_core/index.ts ahead of /api/trpc, api_first catalog bump 2→3, PARITY-API-0001 closed done | none — PARITY-API-0001 closed in full this pass. || ledger.ts (runLedger with FIFO/LIFO/HIFO/LCFO/avgCost/specific-lot, valuePositions, splitRealized, lossHarvestCandidates), 49 tests including method-invariant checks, portfolioLedger tRPC router (run / valueWithPrices / lossHarvest), portfolio_mgmt catalog bump 1→2, PARITY-PORT-0001 in_progress depth 2, PARITY-TAX-0002 closed as done (depth 3 via shared primitive), PARITY-PORT-0002 follow-up row for live custodian aggregation | PARITY-PORT-0002 (live feed) deferred. |

---

## 6. How the build loop reads this doc

On each pass, the loop:

1. **Reads** sections 2 and 3 for its work queue.
2. **Priority rules**:
   - Rows with `status=open` + `added_by=assessment` get priority 1.
   - Rows with `status=open` + `added_by=build` get priority 2.
   - Fresh-assessment items found this pass get priority 3.
3. **Writes** back at end of pass:
   - `done` + bumped depth + commit SHA for shipped rows
   - New `open` rows for gaps discovered mid-build
   - New Known-Bad entries on dead-ends
   - New Pass Log line

When the assessment loop is running in parallel, it can ADD new rows
with `added_by=assessment` — the build loop will pick them up on its
next pass. When two processes edit the same row concurrently, resolve
by **evidence recency** (latest sourceNotes or commit SHA wins), and
log the conflict in section 4.

