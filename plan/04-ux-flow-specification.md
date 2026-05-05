# plan/04 — UX Flow Specification

**Generated:** 2026-05-05 | **Pass:** Phase 1 Plan

---

## 1. Surface Types

| Surface | Description | When Used |
|---------|-------------|-----------|
| **Chat** | Primary conversational interface with streaming, voice, tier indicators | Default entry point; cross-engine queries; quick questions |
| **Engine UI** | Dedicated feature pages (calculators, learning modules, lead pipeline) | Deep feature interaction; structured workflows |
| **Contextual Chat** | Chat scoped to current engine/page context | Questions about current view; in-context help |
| **Workspace Panel** | Side panel showing artifacts (reports, documents, calculations) | During agentic workflows; showing AI output |
| **Settings** | Configuration pages (BYO, preferences, billing) | Account management; system configuration |
| **Admin** | Platform administration (spectrum console, improvement engine) | Platform operators; compliance review |

---

## 2. Persona × Primary Task × Surface Matrix

### 2.1 Client Persona (non-technical, mobile-first)

| Primary Task | Surface | Flow |
|-------------|---------|------|
| Check portfolio status | Chat → Engine UI | Ask in chat → drill into Wealth Engine |
| Run "what-if" scenario | Engine UI (calculators) | Direct navigation to calculator |
| Review financial plan | Engine UI → Workspace | Open plan → view PDF in workspace |
| Ask financial question | Chat | Conversational with tier indicator |
| Study for certification | Engine UI (learning) | Direct navigation to study module |
| Review progress | Engine UI (learning dashboard) | Direct navigation |
| Upload document | Chat (drag-drop) | Upload → document-intelligence processes → workspace shows result |
| Voice interaction | Chat (push-to-talk) | Voice in → AI processes → voice out (hands-free mode) |

### 2.2 Advisor Persona (power user, daily use)

| Primary Task | Surface | Flow |
|-------------|---------|------|
| Cross-engine query | Chat | "What's the tax impact on Client X's portfolio given market conditions?" |
| Generate client report | Chat → Workspace | Request in chat → report appears in workspace panel |
| Review compliance | Engine UI (compliance dashboard) | Direct navigation |
| Manage lead pipeline | Engine UI (people) | Direct navigation |
| Run cadence | Engine UI (cadence) | Direct navigation → contextual chat for adjustments |
| Research product | Chat → Engine UI | Ask in chat → drill into product comparison |
| Prepare meeting | Chat → Workspace | Request prep → workspace shows agenda + talking points |
| Configure BYO model | Settings (BYO) | Setup agent guides through single-button-press flow |
| Keyboard workflow | Command palette (Cmd+K) | Quick navigation, search, actions |

### 2.3 Assistant Persona (delegated power)

| Primary Task | Surface | Flow |
|-------------|---------|------|
| Schedule client meetings | Chat | Conversational scheduling |
| Prepare documents | Chat → Workspace | Request → document appears in workspace |
| Update CRM records | Engine UI (people) | Direct navigation |
| Run reports | Chat → Workspace | Request → report in workspace |
| Compliance pre-check | Engine UI (compliance) | Direct navigation |

### 2.4 Supervisor Persona (compliance-aware, audit-focused)

| Primary Task | Surface | Flow |
|-------------|---------|------|
| Review compliance queue | Engine UI (compliance) | Direct navigation |
| Approve/reject actions | Engine UI (gate reviews) | Direct navigation |
| Audit trail search | Admin (audit logs) | Direct navigation |
| Review spectrum positions | Admin (spectrum console) | Direct navigation |
| Sign-off on recommendations | Engine UI (compliance) → contextual chat | Review → ask questions in context |

### 2.5 Admin Persona (technical, full exposure)

| Primary Task | Surface | Flow |
|-------------|---------|------|
| Monitor system health | Admin (dashboard) | Direct navigation |
| Manage spectrum positions | Admin (spectrum console) | Direct navigation |
| Configure integrations | Settings (integrations) | Direct navigation |
| Review improvement proposals | Admin (improvement engine) | Direct navigation |
| Manage BYO infrastructure | Settings (BYO) → Admin | Configuration + monitoring |
| View cost attribution | Admin (M&V dashboard) | Direct navigation |
| Manage users/roles | Admin (users) | Direct navigation |

---

## 3. Chat Surface Behavior

### 3.1 Default State

```
┌─────────────────────────────────────────────────────────────────┐
│ [Tier Badge: AUTO]  [Connection: ●]  [Voice: 🎤]  [Cmd+K]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Welcome back, [Name]. How can I help today?                    │
│                                                                  │
│  [Suggested: "Check my portfolio" | "Run a scenario" | ...]     │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ [📎] [Type a message...                              ] [Send]   │
│ [Push-to-talk]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 During Agentic Execution

```
┌─────────────────────────────────────────────────────────────────┐
│ [Tier: CLOUD]  [●]  [🎤]  [Cmd+K]                              │
├──────────────────────────────────┬──────────────────────────────┤
│  Chat Messages                   │  Workspace                   │
│                                  │                              │
│  User: Generate a tax report     │  📄 Tax Report 2026.pdf     │
│                                  │  ├─ Page 1: Summary          │
│  AI: [Thinking...]               │  ├─ Page 2: Deductions       │
│  ├─ 🔍 Searching tax data...     │  └─ Page 3: Recommendations  │
│  ├─ 📊 Running calculations...   │                              │
│  └─ 📝 Generating report...      │  [Download] [Share]          │
│                                  │                              │
├──────────────────────────────────┴──────────────────────────────┤
│ [📎] [Type a message...                              ] [Send]   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Tier Indicator Behavior

| Tier | Badge Color | Tooltip | When |
|------|-------------|---------|------|
| LOCAL | Green | "Processing locally — data stays on device" | Classifier detects NPI/PII/ePHI |
| AUTO | Blue | "Optimal routing selected" | Default for Operational content |
| CLOUD | Orange | "Using cloud AI for best quality" | User explicitly requests or content is Operational |

### 3.4 Voice Interaction (Hands-Free Mode)

Per project knowledge: hands-free mode defaults to audio playback with user toggle.

1. User activates push-to-talk (or continuous listening if toggled)
2. Audible cue indicates listening started
3. Speech → Whisper transcription → displayed in chat
4. AI processes (audible processing cue per project knowledge)
5. Response streams in chat + read aloud via Edge TTS
6. Audible cue indicates response complete

---

## 4. Navigation Structure (PersonaSidebar5 Extensions)

### 4.1 New Items (additive to existing)

| Section | New Item | Min Role | Purpose |
|---------|----------|----------|---------|
| Platform | BYO Settings | user | Bring-your-own model configuration |
| Platform | M&V Dashboard | admin | Cost measurement and savings |
| Platform | Spectrum Console | admin | Administrative spectrum management |

### 4.2 Command Palette (Cmd+K)

Categories:
- **Navigate** — Jump to any page (fuzzy search on page titles)
- **Actions** — Quick actions (new chat, run calculator, start study session)
- **Search** — Full-text search across knowledge base, conversations, documents
- **Settings** — Quick toggles (theme, voice, tier preference)

---

## 5. Mobile-Specific Flows

Per project knowledge: responsive across mobile and desktop.

| Flow | Mobile Adaptation |
|------|------------------|
| Chat | Full-screen; workspace collapses to bottom sheet |
| Engine UI | Single-column layout; tabs for sub-sections |
| Voice | Prominent push-to-talk button; haptic feedback |
| Command palette | Full-screen overlay |
| Workspace panel | Bottom sheet (swipe up to expand) |
| Navigation | Sheet drawer (existing PersonaSidebar5 mobile pattern) |

---

## 6. Progressive Disclosure Integration

The existing 4-level progressive disclosure system gates feature visibility:

| Level | Unlocks | Trigger |
|-------|---------|---------|
| 1 (Basic) | Chat, basic calculators, learning browse | Account creation |
| 2 (Intermediate) | Full calculators, portfolio, study sessions | First meaningful interaction |
| 3 (Advanced) | Agentic workflows, workspace, BYO settings | Demonstrated proficiency |
| 4 (Expert) | Admin surfaces, spectrum console, M&V dashboard | Admin role assignment |

New features (workspace panel, tier indicators, command palette) are gated:
- Tier indicators: Level 1 (always visible — transparency requirement)
- Workspace panel: Level 2 (appears after first agentic workflow)
- Command palette: Level 2 (available to all active users)
- BYO settings: Level 3 (requires demonstrated proficiency)
- Spectrum console: Level 4 (admin only)
