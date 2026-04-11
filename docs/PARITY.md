# PARITY.md

> Canonical parity tracking doc. Written in parallel by multiple processes.
> Always re-read immediately before writing. Merge, don't overwrite.

## Meta

- **Last updated:** 2026-04-11T00:00Z by `claude/parity-accessibility-optimization-wPhiw` Pass 1
- **Comparable benchmark:** best-in-industry multisensory + accessibility leaders — ChatGPT Advanced Voice, Google Gemini Live, Claude.ai voice mode, Linear, Superhuman, Raycast, Arc Browser, Apple VoiceOver + Voice Control, Google TalkBack, NVDA / JAWS, Speechify / Eleven Labs, Perplexity voice, Notion
- **Core purpose:** A 5-layer AI financial advisory platform that every user — sighted, blind, deaf, low-vision, motor-impaired, or hands-busy — can operate fluently via voice, keyboard, screen reader, touch, or any combination, with delight on every modality.
- **Target user:** Financial advisors, clients, and learners across the full accessibility spectrum, including users operating the app hands-free (driving, cooking, walking) and users on assistive tech (VoiceOver, TalkBack, NVDA, JAWS, Voice Control).
- **Success metric:** Every critical task (send chat, read response, navigate, take a recommended action, celebrate a win) is completable — and feels delightful — via voice alone, keyboard alone, screen reader alone, touch alone, or any mix, without requiring modality switches.
- **Starting baseline commit (Pass 1):** `6086236a24bc4532140ea7f4261902b50c169404`
- **Current parity score:** **62%** (composite weighted by core-purpose alignment)
- **Dimension scorecard (v2 ten dimensions):**
  - CoreFunction: 8.0 — app accomplishes its core advisory purpose reliably
  - UI: 8.0 — Stewardship Gold visual identity is late-stage polished
  - UX: 7.5 — many delightful flows but multisensory layer is inert
  - Usability: 6.5 — keyboard + touch strong; voice command surface is narrow; theme is locked
  - Digestibility: 7.5 — nav architecture is clear; PersonaSidebar5 is a differentiator
  - Delightfulness: 5.5 — animations exist, celebrations only in learning, feedback layer never fires
  - Flexibility: 6.0 — theme/font/density not user-adjustable
  - Performance: 8.0 — builds clean, bundle split, SSE streaming is fast
  - Robustness: 7.5 — 3,103+ tests, error boundaries, guardrails
  - CodeQuality: 8.5 — consistent patterns, comprehensive test coverage
  - **Composite:** 7.30

## Gap Matrix

Legend: Priority P0 (ship-blocker) → P3 (polish). Effort: S (≤1 day) / M (1–3 days) / L (1 week) / XL (>1 week). Aligned: does closing this gap serve the core purpose?

| ID | Feature | Present? | Depth | Priority | Effort | Aligned | Owner | Status |
|----|---------|----------|-------|----------|--------|---------|-------|--------|
| G1 | Multisensory feedback layer actually triggered | ⚠ built, zero consumers | 1/10 | P0 | M | Yes | — | open |
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

**Summary:** P0 = 5 (G1, G2, G3, G4, G8) · P1 = 19 · P2 = 18 · P3 = 8 · Total = 50

**Critical insight — the P0 cluster is actually ONE root cause:** G1, G8, G21, and G23 all fail because `usePlatformIntelligence` / `giveFeedback` have zero consumers. Fixing the PIL consumer pattern (5–10 call sites in Chat.tsx, handleSend, TTS onEnd, error toasts, action completions, celebrations) unlocks haptics + earcons + celebrations + voice-driven feedback simultaneously. Highest leverage fix in the matrix.

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

## Changelog

_(append-only, most recent first)_

- **Pass 1** (Claude Code, Landscape, n/a→62%) · Initial audit; 50-item gap matrix; 7 beyond-parity wins; 6 anti-parity rejections. Root-cause insight: PIL consumer pattern unlocks the P0 cluster (G1/G8/G21/G23).

## Known-Bad Approaches

_(carries v2 KNOWN_BAD_APPROACHES across passes)_

- _(empty — Pass 1 is the first)_

## Open Issues (v2 parity)

_(problems not yet tracked as gaps but worth raising; either promote to Gap Matrix or resolve in a later pass)_

- OI1 — `AppearanceTab.tsx:27` allows users to pick light/system theme but the setting is inert (no CSS tokens for light). Users think they set the theme but nothing happens. **User-visible bug**, captured in G2/G9.
- OI2 — `AudioPreferences.tsx:228` UI copy says "Say 'go to clients' to navigate by voice", which only works when the user is already in hands-free mode. Copy should mention the activation step or a PTT alternative.
- OI3 — Chat.tsx hands-free button disappears on text entry (`Chat.tsx:2659`), a discoverability regression for voice users who type-and-talk. Captured in G24.

## Parallel Tracks

_(only populated when Manus dispatches independent tracks)_

- _(not applicable — single-platform optimization)_

## Merge Status

_(not applicable — no parallel tracks dispatched)_
