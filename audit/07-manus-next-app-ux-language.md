# audit/07 — manus-next-app UX Language

**Generated:** 2026-05-05 | **Pass:** Phase 0 Audit

---

## 1. Purpose

Per v2.0.1, stewardly-ai inherits manus-next-app's UX language — the interaction patterns, visual vocabulary, and design philosophy that make the platform feel like a cohesive product. This document catalogs the patterns for absorption.

---

## 2. Design Token Comparison

### 2.1 manus-next-app Tokens (Light-first)

| Token | manus-next-app | stewardly-ai | Delta |
|-------|---------------|-------------|-------|
| Background | oklch(0.98 0.003 80) warm cream | oklch(0.135 0.018 260) deep navy | **Inverted** — stewardly is dark-first |
| Primary | oklch(0.608 0.1937 254) Manus blue | oklch(0.76 0.14 80) Stewardship Gold | **Different brand** |
| Font heading | Instrument Serif / Libre Baskerville | DM Serif Display | Different serif |
| Font body | System sans (-apple-system) | Plus Jakarta Sans | Different sans |
| Radius | 0.5rem | 0.625rem | Slightly larger |

### 2.2 Absorption Decision

**Stewardly-ai retains its own brand identity** (Stewardship Gold, DM Serif Display, dark-first). The UX language absorption is about **interaction patterns and layout philosophy**, not color/font replacement. Per v2.0.1, the inheritance is behavioral, not visual.

---

## 3. Interaction Patterns to Absorb

### 3.1 Agent Action Indicators

**manus-next-app pattern:**
```typescript
type AgentAction =
  | { type: "browsing"; url: string; status: "active" | "done" | "error" }
  | { type: "scrolling"; status: "active" | "done" | "error" }
  | { type: "clicking"; element: string; status: "active" | "done" | "error" }
  | { type: "executing"; command: string; status: "active" | "done" | "error" }
  | { type: "creating"; file: string; status: "active" | "done" | "error" }
  | { type: "searching"; query: string; status: "active" | "done" | "error" }
  | { type: "generating"; description: string; status: "active" | "done" | "error" }
  | { type: "thinking"; status: "active" | "done" | "error" }
  | { type: "writing"; label?: string; status: "active" | "done" | "error" }
  | { type: "researching"; label?: string; status: "active" | "done" | "error" }
```

**Stewardly-ai current:** No agent action indicators in chat UI.

**Absorption:** Add action indicator component to chat surface. Show what the agent is doing in real-time during agentic execution (ReAct loop steps).

### 3.2 Workspace Artifacts Panel

**manus-next-app pattern:** Three-panel layout (sidebar, chat, workspace). Workspace shows generated artifacts: browser screenshots, code files, terminal output, documents.

**Stewardly-ai current:** Chat is full-width. No workspace panel.

**Absorption:** Add collapsible workspace panel to chat view. Show generated reports, calculations, documents as artifacts. Particularly relevant for Wealth Engine reports and compliance reviews.

### 3.3 Connection Quality Indicator

**manus-next-app pattern:** WebSocket bridge with latency measurement, reconnect count, uptime display.

**Stewardly-ai current:** SSE streaming without quality indicators.

**Absorption:** Add connection quality badge to chat header. Show streaming status and latency.

### 3.4 Progressive Disclosure (Already Absorbed)

**manus-next-app pattern:** Features reveal as user demonstrates capability.

**Stewardly-ai current:** ✅ Already implemented via DisclosureContext (4 levels) and PersonaSidebar5 disclosure levels.

### 3.5 Empty States with CTAs

**manus-next-app pattern:** Branded empty states with clear call-to-action buttons and helpful descriptions.

**Stewardly-ai current:** ⚠️ Partial — some pages have empty states, others show blank content.

**Absorption:** Audit all list/table pages for empty state handling. Add consistent empty state component with contextual CTAs.

### 3.6 Command Palette / Quick Actions

**manus-next-app pattern:** Keyboard-accessible command palette for power users.

**Stewardly-ai current:** ✅ Keyboard shortcuts exist (g-chord navigation, /, ?). No unified command palette.

**Absorption:** Add command palette (Cmd+K) that aggregates all keyboard shortcuts + quick navigation + search.

---

## 4. Layout Patterns to Absorb

### 4.1 Task View (Three-Panel)

**manus-next-app layout:**
```
┌─────────────┬──────────────────┬──────────────────┐
│  Sidebar    │     Chat         │   Workspace      │
│  (convos)   │  (messages)      │  (artifacts)     │
│             │                  │                  │
└─────────────┴──────────────────┴──────────────────┘
```

**Stewardly-ai current:**
```
┌─────────────┬──────────────────────────────────────┐
│  Sidebar    │     Content                          │
│  (nav)      │  (full-width page)                   │
│             │                                      │
└─────────────┴──────────────────────────────────────┘
```

**Absorption:** For chat view specifically, add workspace panel. Other pages retain current full-width layout.

### 4.2 Settings Page (Tabbed)

**manus-next-app pattern:** Settings with left-side tab navigation, content area on right.

**Stewardly-ai current:** Settings page exists. Structure to be verified.

**Absorption:** Ensure settings page follows tabbed pattern. Add BYO settings tab.

---

## 5. Component Patterns to Absorb

### 5.1 Brand Avatar

**manus-next-app:** Custom avatar component for AI responses (not generic robot icon).

**Stewardly-ai:** Should use Stewardship Gold branded avatar for AI messages.

### 5.2 Error Boundary with Recovery

**manus-next-app:** ErrorBoundary component wrapping major sections with retry capability.

**Stewardly-ai:** Verify error boundaries exist. Add if missing.

### 5.3 File Upload with Progress

**manus-next-app:** Drag-and-drop multi-file upload with individual progress bars.

**Stewardly-ai:** File upload exists in file processing. Verify UX matches pattern.

### 5.4 Streaming Markdown Renderer

**manus-next-app:** Real-time markdown rendering as tokens stream in.

**Stewardly-ai:** Uses `<Streamdown>` component from streamdown library. ✅ Already aligned.

---

## 6. Behavioral Patterns to Absorb

### 6.1 Optimistic Updates

**manus-next-app pattern:** Immediate UI feedback on mutations, rollback on error.

**Stewardly-ai current:** tRPC mutations with invalidation. Some optimistic updates.

**Absorption:** Audit all list mutations for optimistic update pattern.

### 6.2 Skeleton Loading

**manus-next-app pattern:** Content-shaped skeletons during data loading.

**Stewardly-ai current:** DashboardLayoutSkeleton exists. Per-page skeletons unclear.

**Absorption:** Add skeleton states to all major data-loading pages.

### 6.3 Toast Notifications (sonner)

**Both use sonner.** ✅ Already aligned.

---

## 7. Patterns NOT to Absorb (Stewardly-specific)

These stewardly-ai patterns are superior to or different from manus-next-app and should be preserved:

| Pattern | Stewardly-ai | Why Keep |
|---------|-------------|----------|
| Stewardship Gold brand | Deep navy + gold | Distinct brand identity for financial services |
| DM Serif Display headings | Editorial gravitas | Appropriate for wealth management |
| Role-based progressive disclosure | 5 roles × 4 levels | Financial services requires role separation |
| G-chord keyboard navigation | Vim-inspired shortcuts | Power user efficiency |
| Pomodoro timer | Productivity tool | Advisor workflow support |
| Notification bell + Changelog bell | Dual notification | Professional communication |
| i18n (react-i18next) | Multi-language | Global advisor base |

---

## 8. Absorption Priority

| Pattern | Priority | Effort | Impact |
|---------|----------|--------|--------|
| Agent action indicators | P1 | Medium | High — shows AI working |
| Workspace artifacts panel | P2 | High | High — shows AI output |
| Command palette (Cmd+K) | P2 | Medium | Medium — power user efficiency |
| Connection quality indicator | P3 | Low | Low — nice-to-have |
| Empty states audit | P3 | Low | Medium — polish |
| Skeleton loading audit | P3 | Low | Medium — polish |
