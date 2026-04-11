# PARITY.md

> Canonical parity tracking doc. Written in parallel by multiple processes.
> Always re-read immediately before writing. Merge, don't overwrite.

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
| G1 | Multisensory feedback layer actually triggered | ⚠ partial — Chat + PIL wired (Build Loop P1) | 4/10 | P0 | M | Yes | Build Loop | in_progress |
| G2 | Theme actually switchable (light / dark / system) | ⚠ UI exists but hard-locked to dark | 2/10 | P0 | M | Yes | — | open |
| G3 | aria-live announces actual streamed content (not just "AI is responding") | ⚠ stub only | 2/10 | P0 | S | Yes | — | open |
| G4 | Captions / visible transcript during TTS playback (WCAG 1.2.1-A) | ❌ | 0/10 | P0 | S | Yes | — | open |
| G5 | Voice command dispatch beyond navigation (send, new chat, bookmark, open palette, cancel, stop, undo) | ⚠ partial | 4/10 | P0 | M | Yes | — | open |
| G6 | Realtime conversational voice mode (full-duplex, interruptible) | ❌ | 0/10 | P1 | XL | Yes | — | open |
| G7 | Push-to-talk / hold-to-dictate one-shot mode | ❌ | 0/10 | P1 | S | Yes | — | open |
| G8 | PIL context consumed anywhere in app | ❌ | 0/10 | P0 | S | Yes | — | open |
| G9 | Light theme CSS tokens | ❌ | 0/10 | P1 | M | Yes | — | open |
| G10 | `@media (prefers-contrast: more)` override | ❌ | 0/10 | P1 | S | Yes | — | open |
| G11 | `@media (forced-colors: active)` override (Windows HC mode) | ❌ | 0/10 | P1 | S | Yes | — | open |
| G12 | User-adjustable text size / zoom / density | ❌ | 0/10 | P1 | M | Yes | — | open |
| G13 | Color-blind friendly mode / color-independent state indicators | ❌ | 0/10 | P2 | M | Partial | — | open |
| G14 | ROUTE_MAP covers every major destination | ⚠ 25 entries / 40+ pages | 6/10 | P1 | S | Yes | — | open |
| G15 | Global "read this page aloud" keyboard shortcut | ⚠ function exists, no hotkey | 3/10 | P1 | S | Yes | — | open |
| G16 | "Open command palette" voice command | ❌ | 0/10 | P1 | S | Yes | — | open |
| G17 | Voice input inside CommandPalette (say query instead of type) | ❌ | 0/10 | P1 | S | Yes | — | open |
| G18 | Universal focus trap / restore for modals | ⚠ cmdk only | 5/10 | P1 | M | Yes | — | open |
| G19 | Landmark roles beyond `<main>` / `<nav>` | ⚠ minimal | 4/10 | P2 | S | Partial | — | open |
| G20 | Icon-only button aria-label coverage on newer components | ⚠ 30+ added in prior passes, spot audit due | 7/10 | P2 | S | Yes | — | open |
| G21 | Haptic feedback actually triggered | ⚠ wired, zero callers | 1/10 | P1 | S | Yes | — | open |
| G22 | Celebration on non-learning wins (goal completed, compliance passed, report generated) | ❌ quizzes only | 3/10 | P1 | S | Yes | — | open |
| G23 | Audio earcons on send / receive / error / navigation | ⚠ defined, never fires | 2/10 | P1 | S | Yes | — | open |
| G24 | Discoverable hands-free button (always visible in Chat input bar) | ⚠ hidden when user types | 5/10 | P1 | S | Yes | — | open |
| G25 | Keyboard shortcut to toggle hands-free from anywhere | ❌ | 0/10 | P1 | S | Yes | — | open |
| G26 | Global keyboard shortcut for "read current page" | ❌ | 0/10 | P1 | S | Yes | — | open |
| G27 | Shortcut hints rendered inside tooltips (not just in overlay) | ⚠ partial | 5/10 | P2 | M | Yes | — | open |
| G28 | Word-level highlighting during TTS (karaoke) | ❌ | 0/10 | P2 | M | Yes | — | open |
| G29 | TTS resume-from-position across page reloads | ❌ | 0/10 | P3 | M | No | — | open |
| G30 | Download TTS audio as MP3 for offline listening | ❌ | 0/10 | P3 | S | No | — | open |
| G31 | i18n library + translation keys | ❌ | 0/10 | P2 | XL | Partial | — | open |
| G32 | RTL support | ❌ | 0/10 | P3 | L | Partial | — | open |
| G33 | CommandPalette indexes ALL pages (derived from navigation.ts) | ⚠ 20 hardcoded + recent conv | 4/10 | P2 | S | Yes | — | open |
| G34 | CommandPalette surfaces recent pages (not just conversations) | ⚠ signal recorded, palette blind to it | 5/10 | P2 | S | Yes | — | open |
| G35 | aria-busy on React Query loading regions | ⚠ rare | 3/10 | P2 | S | Yes | — | open |
| G36 | role="tablist" / tabpanel on custom tab UIs | ⚠ shadcn yes, bespoke no | 6/10 | P2 | S | Yes | — | open |
| G37 | aria-describedby linking form errors to inputs | ⚠ partial | 5/10 | P2 | M | Yes | — | open |
| G38 | Skip-to-content link renders on every page (incl. Chat, non-AppShell pages) | ⚠ AppShell only | 7/10 | P2 | S | Yes | — | open |
| G39 | Focus ring not clipped by `overflow: hidden` containers | ⚠ untested | 8/10 | P3 | S | Yes | — | open |
| G40 | Pull-to-refresh on mobile list views | ❌ | 0/10 | P3 | M | No | — | open |
| G41 | Mobile bottom tab quick-access to Voice / Audio | ❌ | 0/10 | P2 | S | Yes | — | open |
| G42 | Earcon on keyboard chord trigger / palette open | ❌ | 0/10 | P3 | S | Yes | — | open |
| G43 | Audible token-streaming tick | ❌ | 0/10 | P3 | M | No | — | open |
| G44 | Voice barge-in during in-progress TTS | ⚠ `stop` word only | 5/10 | P2 | M | Yes | — | open |
| G45 | System font-scale / dynamic type inheritance verified at 200% zoom | ⚠ untested | 6/10 | P2 | S | Yes | — | open |
| G46 | Color contrast audit across all tokens (muted-foreground, destructive, chart-3/4/5) | ⚠ primary known AAA; others unverified | 7/10 | P2 | S | Yes | — | open |
| G47 | First-run voice onboarding moment | ❌ | 0/10 | P2 | S | Yes | — | open |
| G48 | `::selection` color styling in brand palette | ❌ | 0/10 | P3 | S | No | — | open |
| G49 | Error boundary audio cue + "reload" voice command | ⚠ visible only | 5/10 | P3 | S | Yes | — | open |
| G50 | Voice onboarding tutorial inside OnboardingFlow | ❌ | 0/10 | P2 | M | Yes | — | open |
| G51 | AppearanceTab Potemkin UI — 6 controls save to `wb_*` keys that nothing reads (`AppearanceTab.tsx:47-55`) | ❌ all inert | 0/10 | P0 | M | Yes | — | open |
| G52 | CommandPalette `PAGES` list drifts from `navigation.ts` — missing ~15 routes (/financial-twin, /code-chat, /learning, /workflows, /consensus, /achievements, /my-work, /settings/* subroutes) (`CommandPalette.tsx:45-67`) | ⚠ 21/40+ | 5/10 | P1 | S | Yes | — | open |
| G53 | CommandPalette shows "G R / G M / G D / G N / G A" shortcut hints (`CommandPalette.tsx:50-55`) but only `g+h / g+s / g+c / g+i / g+l / g+o` are wired in `useKeyboardShortcuts.ts:20-32` — **hints are lies** | ⚠ 3/8 wired | 3/10 | P1 | S | Yes | — | open |
| G54 | PIL bypasses its own dispatcher — `PlatformIntelligence.tsx:333-348` calls `SOUNDS.mode_activate()` + `speakShort()` directly instead of `dispatchFeedback("handsfree.activated")`; architecturally inconsistent (provider consumes itself but not via the public API) | ✓ fixed (Build Loop P1) | 8/10 | P1 | S | Yes | Build Loop | done |
| G55 | Dual chord handlers — `useKeyboardShortcuts.ts:57-61` AND `AppShell.tsx:185-215` both watch for "g" chords; should consolidate into `useCustomShortcuts` (which is customizable) | ⚠ redundant | 5/10 | P2 | M | Yes | — | open |
| G56 | `AppShell.tsx` has ~200 lines of `sidebarContent` / `renderNavItem` render code (lines 322-528) that's unreachable because `PersonaSidebar5` replaced it at line 552 — dead code | ⚠ dead | 4/10 | P2 | S | No | — | open |
| G57 | Accent color selector offers 6 colors (`AppearanceTab.tsx:10-17`) that don't exist in the Stewardship Gold theme — selecting "Rose" does nothing | ❌ | 0/10 | P1 | S | No | — | open |
| G58 | No keyboard shortcut to open CommandPalette documented in `useKeyboardShortcuts.ts` — Ctrl+K is wired inside `CommandPalette.tsx:147` only; not listed in the `?` help overlay as a chord | ⚠ wired, undocumented | 6/10 | P2 | S | Yes | — | open |
| G59 | **CRITICAL — Firefox has zero SpeechRecognition support; Safari iOS blocks `recognition.continuous=true`** (`useVoiceRecognition.ts:147-150` silently returns; `PlatformIntelligence.tsx:290-291` silently returns; `LiveChatMode.tsx:96-99` sets internal error but no toast/banner for users) — hands-free button in Firefox is a dead button | ✓ fixed Chat surface (Build Loop P2) · other consumers still need update | 7/10 | P0 | M | Yes | Build Loop | in_progress |
| G60 | **CRITICAL — Keyboard focus is not restored to `#main-content` after route change** (`AppShell.tsx:131-134` closes mobile sidebar + records page visit but never calls `document.getElementById("main-content")?.focus()`); SR users navigating via g-chord hear nothing about the new page — WCAG 2.4.3 Focus Order failure | ✓ fixed (Build Loop P3) | 9/10 | P0 | S | Yes | Build Loop | done |
| G61 | Voice "stop" command pauses TTS playback but does **not** abort SSE stream (`PlatformIntelligence.tsx:232-234` → `audioCompanion.pause()` → `AudioCompanion.tsx:184-188` only cancels `speechSynthesis` + HTML audio; `Chat.tsx:873-990` SSE loop keeps running); user says "stop" then a new prompt → answers interleave | ⚠ incomplete | 3/10 | P1 | M | Yes | — | open |
| G62 | Network drop mid-SSE-stream → infinite spinner; no `navigator.onLine` check, no timeout, aria-live region stays stuck on "AI is responding…" (`Chat.tsx:873-990`, `Chat.tsx:1818`); `OfflineBanner.tsx` exists but isn't wired into Chat streaming | ❌ | 0/10 | P1 | M | Yes | — | open |
| G63 | Dual keyboard chord handlers on "g" create a race (`AppShell.tsx:184-215` AND `useKeyboardShortcuts.ts:57-61` both attach `window.keydown`); neither calls `preventDefault()` on match → possible double-navigation | ⚠ race | 4/10 | P1 | S | Yes | — | open |
| G64 | `framer-motion` animations ignore `prefers-reduced-motion` unless explicitly wrapped in ReducedMotion context (`AudioCompanion.tsx:287,319` use `<motion.div>` without `reduceMotion="user"` prop); OS-level preference is honored by CSS but not by framer-motion components | ⚠ partial | 5/10 | P1 | S | Yes | — | open |
| G65 | AudioCompanion queue is in-memory `useState` only (`AudioCompanion.tsx:74-84`); navigating routes doesn't lose it (provider is at App.tsx root) but a full page reload discards queue + position → user re-starts from scratch on every refresh | ⚠ in-memory | 4/10 | P2 | M | No | — | open |
| G66 | Disabled button state color contrast likely fails WCAG AA (`opacity-50` default from shadcn/ui button yields ~3.8:1 against `--card` — below 4.5:1 threshold); no explicit disabled-state token in `index.css` | ⚠ untested, likely fails | 5/10 | P2 | S | Yes | — | open |
| G67 | CommandPalette doesn't filter PAGES by user role — user with `user` role sees "Global Admin" and "Manager Dashboard" entries (`CommandPalette.tsx:45-67` has no `hasMinRole` filter unlike `AppShell.tsx:219-220`); clicking them leads to 403 pages | ❌ | 0/10 | P2 | S | Yes | — | open |
| G68 | Focus trap stack conflict — CommandPalette synthesizes a `?` keydown (`CommandPalette.tsx:95-98`) to open KeyboardShortcutsOverlay; both dialogs mount simultaneously and both try to trap focus; whichever mounts last wins and the other's trap is broken | ⚠ | 4/10 | P2 | M | Yes | — | open |

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

Pass 3 · angle: keyboard + screen-reader accessibility · queue: G60 (WCAG 2.4.3 focus restoration after nav) · commit SHA: TBD · shipped: `client/src/hooks/useFocusOnRouteChange.ts` pure-function helpers (describePath with longest-prefix match across 27 routes, focusMainRegion with active-input protection + SSR safety, announceRoute with lazy live-region creation + reuse) + React hook wired via `useLocation` + `requestAnimationFrame` defer so it fires after the new page mounts. Wired into AppShell.tsx (mainId="main-content") and Chat.tsx (mainId="chat-main"). `client/src/hooks/useFocusOnRouteChange.test.ts` — 15 unit tests with DI fakes for Document/active element/live region (pure-function hook helpers are testable without jsdom) · deferred: mobile route audit at 44px+ touch targets (G39), role=tablist audit (G36)

<!-- PASS_LOG_APPEND_HERE -->

## Changelog

_(append-only, most recent first)_

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
