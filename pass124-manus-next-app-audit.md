# Manus-Next-App Repo Audit — Key Findings for Integration

## Architecture
- React 19 + Tailwind 4 + Express 4 + tRPC 11 + SSE (same stack as WealthBridge)
- 12 DB tables, 8 agent tools, 166 tests
- SSE-based agentic loop with tool calling (server/agentStream.ts)
- Server-side task scheduler with 60s polling (server/scheduler.ts)
- LLM-powered memory auto-extraction (server/memoryExtractor.ts)

## Key Components to Reference
1. **agentStream.ts** — SSE agentic loop with multi-turn tool calling (up to 8 turns)
2. **agentTools.ts** — 8 tools: web_search, read_webpage, browse_web, wide_research, execute_code, analyze_data, generate_image, generate_document
3. **scheduler.ts** — Cron/interval task scheduling with server-side polling
4. **memoryExtractor.ts** — Auto-extract facts from conversations
5. **ShareDialog** — Task sharing with signed URLs, password, expiry
6. **ModeToggle** — Speed/Quality mode toggle
7. **Cost visibility** — Per-task estimated cost in header
8. **Session Replay** — Recorded interaction playback
9. **NotificationCenter** — In-app notifications with unread tracking
10. **KeyboardShortcutsDialog** — Global shortcuts

## 32 Live Capabilities
Chat Mode, Agent Mode, Speed/Quality Mode, Cost Visibility, Cross-Session Memory, Memory Auto-Extraction, Task Sharing, Task Scheduling, Session Replay, Conversation Regenerate, Notifications, Data Analysis, Image Generation, Web Search, Wide Research, Enhanced Browsing, Auth, SEO, Code Execution, Voice STT, Document Generation, Task Management, Workspace Artifacts, Bridge Integration, Preferences, Identity Rule, Research Nudge, GitHub Integration, Mobile Responsive, System Prompt Customization, Keyboard Shortcuts, PWA Installability

## Integration Strategy for WealthBridge
- WealthBridge already has: AI chat, voice, image gen, document gen, memory, notifications, scheduling
- Key NEW capabilities to integrate from manus-next-app:
  1. **Agent Mode** — multi-turn tool-calling loop (agentStream.ts pattern)
  2. **Wide Research** — parallel multi-query search
  3. **Enhanced Browsing** — deep URL analysis
  4. **Code Execution** — sandboxed JS
  5. **Task Sharing** — signed URLs with password/expiry
  6. **Session Replay** — interaction playback
  7. **Cost Visibility** — per-task cost indicator
  8. **Speed/Quality Mode** — toggle
  9. **Keyboard Shortcuts** — global shortcuts
  10. **PWA** — installable web app
- Wrap all with advisor context (compliance + audit + jurisdiction)
