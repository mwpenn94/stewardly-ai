# Stewardly Phase 4 — Unified AI Surface (Chat + Code + Agent)

> **Target repo:** `mwpenn94/stewardly-ai`
> **Phase:** 4 of 8
> **Scope:** ONE unified AI surface consolidating conversational AI (Claude.ai parity), code capabilities (Claude Code parity), and autonomous agent (Manus parity) — with progressive disclosure modes, infrastructure-first build order, and functional benchmarks
> **Prior phases:** Phase 1 (UI shell), Phase 2 (learning), Phase 3 (wealth engine surfaces the agent orchestrates). Read prior `PHASE_*_EXIT.md` files.
> **Executor:** Manus (or any agentic executor with browser, terminal, and file-system access)

---

## CORE RULES

1. **Run continuously.** Assess → optimize/build → validate → ship, repeated.
2. **Every pass ships observable work.**
3. **Self-score honestly.** 5-8 criteria, must-have default. Exit at all must-have ≥8 × 3 consecutive.
4. **Visual evidence.** Screenshots at 3 viewports.
5. **Anti-regression absolute.** Phases 1-3 must not regress.
6. **Act as a real user.** Virtual-user walkthrough every pass.
7. **Commits:** `pass-[N] · phase-4 · [description]`
8. **Build-from-zero:** score 1-3 = construct.

**Termination:** (1) User stop. (2) Platform limit → `HANDOFF.md`. (3) Merge-gate → `BLOCKED_ON.md`. (4) 1-hour active stall with ≥6 novel attempts → `STALLED.md`.

---

## KNOWN EXECUTION FAILURES — THE THREE MOST SEVERE FROM PRIOR RUNS

These failures make Phase 4 the highest-risk phase. Read them carefully.

### ❌ FAILURE 1: "AI Studio" does nothing except reroute users
In prior runs, the AI surface was a SHELL. Clicking it redirected to other parts of the app or showed a placeholder page. It did NOT:
- Accept text input from the user
- Send anything to an LLM backend
- Stream any response tokens
- Display any AI-generated content

**This is a complete Phase 4 failure.** A redirect page or placeholder is NOT an AI surface — it scores 1 (absent). The AI surface must be a WORKING conversational AI from its very first functional pass. Even with a mock LLM backend (per Rule 12), the UI must accept input and stream mock responses token-by-token.

### ❌ FAILURE 2: Manus clone (Mode 3 Agent) was not functional and did not mirror Manus UI/UX
In prior runs, there was:
- No task input area where user describes what they want done
- No plan display showing decomposed steps
- No real-time execution view with browser screenshots / terminal output / tool calls
- No artifact delivery panel showing completed deliverables
- None of the defining Manus UX elements existed at all

**The fix:** Open manus.im. Screenshot every UI element. Build functional equivalents. Even with mock backends, the UI must look and behave like Manus — task input, plan display, streaming execution view, artifact panel.

### ❌ FAILURE 3: Claude Code clone (Mode 2 Code) did not mirror Claude Code UI/UX
In prior runs, there was:
- No terminal-style dark-background code rendering
- No syntax-highlighted code blocks with line numbers
- No diff view showing before/after changes
- No file tree panel showing project structure
- No inline execution output panel

**The fix:** Open Claude Code (or Cursor/Windsurf for reference). Screenshot the interface. Build: terminal aesthetic, syntax highlighting, diff rendering, file tree, execution output panel.

---

## MANDATORY BUILD ORDER — Phase 4a substeps

**Do NOT build all 3 modes simultaneously as shells. Build each to functional completion before starting the next.** The shell-of-everything-that-works-for-nothing pattern is the root cause of the prior failures.

### Phase 4a-0: Infrastructure (must complete before ANY mode)
Build the backend plumbing that all 3 modes share:
- **LLM API client with streaming** — connect to Claude API (or OpenAI, or mock per Rule 12). Send a prompt. Receive streaming tokens. The client must handle: connection, streaming, error recovery, timeout.
- **WebSocket/SSE transport** — streaming tokens from server to client in real time.
- **Message persistence** — save conversation history to database. Load on page refresh.
- **Conversation state management** — track current conversation, message list, mode, context.
- **Mock LLM fallback** — if no API key available, mock responses that: (a) stream token-by-token with realistic inter-token delay (30-80ms per token), (b) produce context-relevant mock content (not just "Hello world"), (c) respect conversation history. Mock must be indistinguishable from a real response in terms of UX behavior.

**Validation test for 4a-0:** Send a hardcoded prompt from the browser console → receive streaming tokens → see them appear one-by-one in a basic UI element. If this doesn't work, NOTHING ELSE in Phase 4 will work. Do not proceed.

### Phase 4a-1: Mode 1 — Chat (Claude.ai parity)
This is the FIRST functional deliverable. Build to parity with Claude.ai before touching Mode 2 or Mode 3.

**What Claude.ai looks like (the executor must match this):**
- Clean, white/light message area with clear user/assistant message distinction
- User message: right-aligned or left-aligned with user avatar
- Assistant message: left-aligned with Claude avatar, streaming in word-by-word
- **Markdown rendering:** headings, bold, italic, links, inline code, code blocks with syntax highlighting + copy button
- **Conversation sidebar:** list of past conversations, searchable, deletable
- **New conversation button** prominently placed
- **Input area:** multi-line text input at bottom, send button, file upload button
- **Edit and regenerate:** click a prior user message to edit, response regenerates from that point
- **Conversation branching:** when you edit a prior message, you can switch between response branches
- **Copy button** on assistant messages
- **Streaming indicator** while response is generating
- **Stop generation** button during streaming

**Stewardly-specific additions (AFTER base parity is achieved):**
- Inline calculator/engine previews: "here's a Roth conversion analysis" renders a mini wealth-engine surface inline
- Context-aware of user's role, clients, platform features
- Tool use: can search, calculate, fetch data, open engine surfaces from within chat
- Cross-link to learning modules when answering educational questions

**Benchmarks:** Parity or superiority vs Claude.ai on ≥5 representative conversations (general Q&A, code generation, document analysis, multi-turn reasoning, advisor-specific query).

### Phase 4a-2: Mode 2 — Code (Claude Code parity)
Build on top of Mode 1's infrastructure. Same conversation thread — user doesn't navigate to a different page.

**What Claude Code looks like (the executor must match this):**
- **Terminal-native aesthetic:** dark background, monospace font, terminal-style UI
- **Syntax-highlighted code blocks** with language detection, line numbers, copy button
- **Diff view:** side-by-side or unified diff showing before/after changes (green for additions, red for deletions)
- **File tree panel:** project directory structure, expandable/collapsible, clickable to open files
- **Inline execution output:** when code runs, output appears inline (stdout, stderr, exit code)
- **Multi-file editing:** user can reference and modify multiple files in a single conversation
- **Context-aware** of the stewardly-ai codebase specifically

**Mode switch UX:** user is in Chat mode. They paste code or ask a coding question. Mode 2 either auto-activates (if coding context detected) or the user clicks the "Code" toggle. The conversation thread is the same — no page navigation. The visual treatment shifts to terminal aesthetic for code content.

**Agent handoff:** for complex multi-step coding tasks, Mode 2 can hand off to Mode 3 ("this is too complex for a single response — let me run this as an agent task").

**Benchmarks:** Parity or superiority vs Claude Code on ≥5 coding tasks (fix a bug, add a feature, refactor, write tests, explain code).

### Phase 4a-3: Mode 3 — Agent (Manus parity)
Build on top of Modes 1+2 infrastructure. The defining shift: from conversational to autonomous execution.

**What Manus looks like (the executor MUST open manus.im and match this):**

**Task input:** clean, prominent text area or chat-like input where the user describes what they want done. Supports natural language, file uploads, URL references.

**Plan display:** after task submission, Manus shows its decomposed plan — a list of steps it will take, displayed before or as execution begins. User can review the plan and optionally modify it.

**Real-time execution view (the signature Manus UX element):**
- A live panel showing what the agent is doing RIGHT NOW
- Browser screenshots updating in real time as the agent navigates pages
- Terminal output streaming as the agent runs commands
- Tool call display showing which tools are being invoked
- Intermediate results appearing as the agent produces them
- The user can watch this live OR navigate away and return later

**Artifact delivery:**
- Completed work presented as downloadable files, rendered previews, structured data
- Clear "done" state with summary of what was accomplished
- File downloads, HTML previews, image previews, structured JSON

**Task persistence:** submitted tasks are saved. User can: view history of submitted tasks, see status (running/complete/failed), re-run a task, view artifacts from past tasks.

**Approval workflow:** reversible actions auto-execute; irreversible actions (sending communications, modifying live data) pause for explicit user approval before proceeding.

**Advisor-specific task templates (progressive disclosure Level 2+):**
- "Monday-morning client review" — agent reviews client book, flags urgent items, drafts advisor brief
- "Batch IPS generation" — agent walks through each client's plan, generates Investment Policy Statements
- "Quarterly review outreach for RMD clients" — agent identifies RMD-relevant clients, drafts personalized emails
- "Analyze prospect from uploaded documents" — agent reads uploaded financials, produces prospect summary

**Agent infrastructure (build these):**
- Headless browser (Playwright) for browser-operator capability
- Sandboxed code execution (Docker container) for safe code running
- Task queue with async execution (user submits → navigates away → returns to completed work)
- Artifact storage (files, screenshots, rendered HTML, structured data)
- WebSocket/SSE for real-time progress streaming

**Benchmarks:** Parity or superiority on ≥8 tasks:
1. "Build me a landing page for a retirement planning seminar"
2. "Analyze this CSV of client data and produce a summary report with charts"
3. "Go to [website], fill out this form, submit it, screenshot confirmation"
4. "Review my top 5 clients' retirement readiness using the wealth engine"
5. "Research latest SECURE Act 2.0 changes, summarize implications for my book"
6. "Set up a new calculator surface for student loan optimization from the taxonomy spec"
7. "Draft quarterly review emails for all clients with upcoming RMD events"
8. "Launch a recruiting campaign for AZ Region 3 — full lifecycle through the agent"

### Phase 4a-4: Mode switching + context preservation
After all 3 modes work independently, build smooth transitions:
- **Mode indicator in header:** "Chat" / "Code" / "Agent" — one-click toggle
- **Context carries across modes:** chat about a client → switch to Agent → agent has full chat context. Agent writes code → switch to Code → code is in the editor.
- **Progressive disclosure governs mode visibility:**
  - Level 1: Chat only (clean, Claude.ai-like)
  - Level 2: Chat + Code toggle
  - Level 3: Chat + Code + Agent
  - Level 4: Full orchestration (multi-agent, scheduled tasks, batch operations)
- **One URL, one surface, one conversation thread.** User NEVER navigates to a different page for different AI capabilities.

---

## SCORE CRITERIA

- **Infrastructure functional:** can a message be sent to LLM (or mock) and streaming tokens received and displayed?
- **Mode 1 (Chat) parity:** is the chat surface visually and functionally comparable to Claude.ai? Streaming, markdown, code blocks, conversation management, edit-and-regenerate?
- **Mode 2 (Code) parity:** terminal aesthetic, syntax highlighting, diff view, file tree, inline execution?
- **Mode 3 (Agent) parity:** task input, plan display, real-time execution view, artifact delivery, task persistence?
- **Mode switching:** smooth transitions, context preserved, mode indicator visible?
- **Progressive disclosure:** Level 1 shows only Chat? Level 3 shows all modes? Consistent with Phase 1 framework?
- **Async execution:** user submits agent task, navigates away, returns to completed deliverable?

---

## EXIT CRITERIA

- [ ] All must-have criteria ≥8 × 3 consecutive passes
- [ ] Mode 1 (Chat) functional and at parity with Claude.ai on ≥5 conversations
- [ ] Mode 2 (Code) functional and at parity with Claude Code on ≥5 coding tasks
- [ ] Mode 3 (Agent) functional and at parity with Manus on ≥8 benchmark tasks
- [ ] Mode switching smooth with context preservation demonstrated
- [ ] Async Mode 3 demonstrated (submit → leave → return to completed deliverable)
- [ ] AI conversations/artifacts shareable per Rule 15
- [ ] Progressive disclosure Level 1 shows only Chat; Level 3 shows all modes
- [ ] Phases 1-3 have not regressed
- [ ] NO redirect pages, NO placeholder pages, NO non-functional shells

**Emit `PHASE_4_EXIT.md`.**

---

Begin. Read prior `PHASE_*_EXIT.md` files. Assess the current AI surface. If it's a redirect/placeholder, score 1. Build infrastructure first (4a-0). Then Mode 1 Chat to parity. Then Mode 2 Code. Then Mode 3 Agent. Then mode switching. Ship observable work every pass. Continue.
