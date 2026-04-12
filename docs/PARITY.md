# Code Chat — Claude Code Parity Tracker

> Scope: optimize the Code Chat feature inside Stewardly to achieve and
> excel beyond parity with Claude Code and other top comparables.
>
> This doc is the bidirectional work queue for the continuous build loop
> running on branch `claude/optimize-code-chat-2NBvg`. It's also read by
> parallel assessment/build processes and prior-pass-of-self.

## How this doc works

- **Gap matrix** — rows are capability gaps against Claude Code (and peers).
  Status: `open` / `in_progress` / `done` / `known_bad`.
- **Protected improvements** — features that must never be weakened.
- **Known-Bad** — dead ends, don't retry these approaches.
- **Reconciliation log** — when multiple processes edit this file, log
  three-way merge decisions here.
- **Build Loop Pass Log** — append-only tail listing every completed pass.

Each row has:
- `id` — stable short id for cross-referencing
- `capability` — one-line description
- `status` — open/in_progress/done/known_bad
- `depth` — 0..10 score of implementation completeness (0=absent, 10=best-in-class)
- `notes` — free-form
- `refs` — commit SHAs / file paths / PR numbers

---

## Gap matrix

### Agent tool capabilities

| id | capability | status | depth | notes | refs |
|---|---|---|---|---|---|
| T1 | Read file | done | 10 | Pass Round B1 | server/services/codeChat/fileTools.ts |
| T2 | Write file | done | 10 | admin+writeMode gated | server/services/codeChat/fileTools.ts |
| T3 | Edit file | done | 10 | find/replace with replaceAll | server/services/codeChat/fileTools.ts |
| T4 | Grep search | done | 9 | ripgrep via bash | server/services/codeChat/codeChatExecutor.ts |
| T5 | List directory | done | 10 | | server/services/codeChat/fileTools.ts |
| T6 | Run bash | done | 9 | denylist + 30s timeout | server/services/codeChat/fileTools.ts |
| T7 | Find symbol (Go to Symbol) | done | 9 | regex-based, 8 kinds, fuzzy rank | Pass 242 |
| T8 | Live todo tracker | done | 9 | streaming SSE events | Pass 237 |
| T9 | Web fetch (http/https docs) | done | 8 | SSRF-guarded, 512KB cap, HTML→text | P1 (this pass) |
| T10 | File mentions (@path) | done | 9 | pre-read on send | Pass 206 |
| T11 | Plan mode (`/plan`) | done | 9 | inline review panel | Pass 236 |
| T12 | Project instructions (CLAUDE.md) | done | 9 | 3 convention support + cache | Pass 238 |
| T13 | Agent memory (`/remember`) | done | 9 | client-side persistent facts | Pass 241 |
| T14 | Symbol index cache | done | 9 | 60s TTL | Pass 242 |
| T15 | Task delegation / sub-agents | open | 0 | Claude Code has `Task` tool; spawns sub-agents in isolated contexts | — |
| T16 | Multi-edit transactional | done | 9 | atomic batch edits per-file, all-or-nothing, 50-step cap, file untouched on any failure | P2 e911c50 |
| T17 | Image/screenshot attachment | open | 0 | Multimodal input — screenshots, diagrams | — |
| T18 | Git blame tool | done | 9 | git_blame tool with porcelain parser, range support, summary (authors/commits/oldest/newest/mostRecent), 15 tests, read-only (no admin needed) | P9 (this pass) |
| T19 | Notebook (.ipynb) read/edit | open | 0 | Claude Code has NotebookEdit | — |
| T20 | Hooks (pre/post tool) | open | 0 | Claude Code hooks run shell commands on events | — |
| T21 | MCP server integration | open | 0 | Model Context Protocol external tool registry | — |
| T22 | File watching / external change detect | open | 0 | Notify when files change outside the session | — |

### Session / UI capabilities

| id | capability | status | depth | notes | refs |
|---|---|---|---|---|---|
| S1 | Slash commands | done | 9 | 15+ commands | Pass 203 |
| S2 | Fuzzy command palette ⌘K | done | 10 | Pass 248 | client/src/components/codeChat/actionPalette.ts |
| S3 | Keyboard shortcuts overlay | done | 9 | Pass 209 + chord | Pass 209, Pass 227 |
| S4 | Draft autosave | done | 9 | localStorage | Pass 209 |
| S5 | Conversation export (md) | done | 9 | per-msg + full | Pass 208 |
| S6 | Sessions library (save/load/tag) | done | 9 | import/export/search | Pass 212, 228, 229 |
| S7 | Bookmarks + reactions + outline | done | 9 | Passes 233-235 | client/src/components/codeChat/messageAnnotations.ts |
| S8 | Edit undo/redo history | done | 9 | ring buffer, ⌃Z/⌃⇧Z | Pass 239 |
| S9 | Scratchpad drawer | done | 9 | persistent notes | Pass 240 |
| S10 | Session analytics dashboard | done | 9 | cost+tool breakdown | Pass 243 |
| S11 | Cost budget guardrail | done | 8 | per-session USD cap | Pass 222 |
| S12 | Context window meter | done | 8 | per-model limits | Pass 230 |
| S13 | Token/cost telemetry per message | done | 9 | Pass 210 | client/src/components/codeChat/tokenEstimator.ts |
| S14 | Git status panel | done | 8 | porcelain parser | Pass 244 |
| S15 | Import graph panel | done | 8 | Pass 245 | server/services/codeChat/importGraph.ts |
| S16 | TODO marker scanner | done | 8 | Pass 246 | server/services/codeChat/todoMarkers.ts |
| S17 | Circular dep detector | done | 8 | Tarjan's SCC | Pass 247 |
| S18 | Plan snapshot persistence | done | 9 | survives refresh | Pass 236 |
| S19 | Session replay / time travel | open | 0 | re-run a conversation turn-by-turn | — |
| S20 | PR review mode | open | 0 | read PR diff, post inline comments | — |
| S21 | Diff split-view vs inline toggle | open | 3 | have inline via `DiffView`; no side-by-side | Pass 202 |
| S22 | Voice input to chat | open | 0 | push-to-talk transcription | — |
| S23 | Session sharing via gist publish | done | 8 | /gist conversation export | Pass 219 |

### Reliability / safety / ergonomics

| id | capability | status | depth | notes | refs |
|---|---|---|---|---|---|
| R1 | Per-tool permission toggles | done | 9 | | Pass 213 |
| R2 | SSE streaming tool events | done | 10 | | Pass 201 |
| R3 | Abort button / Esc to cancel | done | 9 | | Pass 203 + stream |
| R4 | Auto-checkpoint during long runs | done | 9 | every 4 messages | Pass 223 |
| R5 | Retry-on-error banner | done | 9 | | Pass 211 |
| R6 | SSRF guard on web_fetch | done | 10 | loopback/RFC1918/metadata | P1 (web_fetch pass) |
| R7 | Dead-letter failed tool results | open | 0 | persist across refresh | — |
| R8 | Offline graceful degradation | open | 1 | errors bubble, no local fallback | — |
| R9 | Admin audit log of write ops | done | 8 | structured toolTelemetry audit events on every dispatch, path-normalized + secret-redacted + version-stamped, consumed by pino logger at INFO level | P7 (this pass) |
| R10 | Stream request input validation | done | 9 | pure validateStreamRequest + 47 tests, 64KB message cap, iteration bounds, tool list caps, memory byte cap | P4 (this pass) |
| R11 | Client-side input byte meter | done | 8 | chars-remaining indicator appears at 50% of 64KB limit, amber at 80%, red at 95% | P4 (this pass) |
| R12 | Symlink escape defense in file tools | done | 10 | resolveInsideReal fs.realpath()s target + parent, blocks inside-workspace symlinks that redirect outside; 14 security tests including write-into-symlinked-parent; protects read/write/edit/multi_edit/list | P6 (this pass) |
| R13 | SSE event parser (defensive client-side) | done | 9 | pure parseSseLine + splitSseBuffer, 44 tests covering every malformed-event branch, forward-compat unknown type fallback, CRLF tolerance, data:/data: space variants | P8 (this pass) |
| R14 | Per-user tool rate limit (token bucket) | done | 9 | pure refill/take reducer, per-user × per-kind buckets (writes 10/30·min, shell 5/10·min, network 10/20·min), retry-after computation, periodic GC of stale buckets, short-circuits before dispatch with structured RATE_LIMITED error the agent can observe | P11 (this pass) |

### Accessibility

| id | capability | status | depth | notes | refs |
|---|---|---|---|---|---|
| A1 | Screen-reader live region for tool progress | done | 9 | role=status aria-live=polite, throttled via pure reducer | P3 (this pass) |
| A2 | Keyboard shortcuts overlay | done | 9 | | Pass 209 |
| A3 | Icon button aria-labels (config bar) | done | 9 | 34 aria-labels across CodeChat.tsx | Pass 137 |
| A4 | Focus trap in modal popovers | open | 3 | dialogs use role="dialog" but no focus trap loop | — |
| A5 | Skip-to-main-content link | done | 8 | from Pass 91 | client/src/components/AppShell.tsx |
| A6 | WCAG 2.3.3 prefers-reduced-motion | done | 9 | Pass 98 | client/src/index.css |
| A7 | Announcer throttling / coalescing | done | 9 | pure ThrottleState reducer | P3 (this pass) |

---

## Protected improvements (DO NOT WEAKEN)

These are improvements from the git log that must not regress:

- SSE streaming for live tool events (`useCodeChatStream` + `codeChatStream.ts`)
- Admin + writeMode gating for `write_file`/`edit_file`/`multi_edit`/`run_bash`
- SSRF guard in `webFetch.ts` — loopback, RFC1918, link-local, metadata hosts blocked
- Symbol index 60s cache (perf regression risk)
- Plan mode `PlanReviewPanel` — approval before execution for destructive steps
- Project-instructions (CLAUDE.md) auto-loading with 32KB per-file cap
- Edit history ring buffer 50-entry cap + localStorage persistence
- Per-tool enabled list intersection on server (non-admin can't enable write tools)
- File mention expansion hard-caps to 5 files @ 32KB each
- Context window meter flipping to amber at 60%, red at 80%
- `validateStreamRequest` byte + iteration + tool-list caps (P4 — never accept unbounded input)
- Multi-edit atomicity: if any step fails, file on disk is untouched (P2)
- Live SR announcer throttle reducer: never flood AT queue with rapid tool events (P3)
- `resolveInsideReal` symlink-escape guard: every file op realpath()s through target + parent before touching disk (P6)

---

## Known-Bad (dead ends)

_empty — document approaches here that were tried and failed so future
passes don't retry them_

---

## Reconciliation log

_empty — log three-way merges here when parallel processes conflict_

---

## Build Loop Pass Log

Append-only tail. One line per completed pass:

- Pass 1 · angle: missing-tool assessment · queue: [A1 web_fetch tool] · items completed: [web_fetch tool end-to-end (server service + dispatcher + SSE route allowlist + tool def + /web slash + permission popover + action palette + badge bump 8→9 + toolSummary + autonomousCoding summarizer + tests)] · items deferred: [] · sha: 3aa8672
- Pass 2 · angle: T16 PARITY row — atomic multi-edit · queue: [R1 T16 from PARITY matrix] · items completed: [multi_edit tool (fileTools.multiEditFile with atomicity + before/after snapshots + 50-step cap + validation + TOO_LARGE guard), wired through codeChatExecutor.CodeToolName/CodeToolResult/dispatchCodeTool/CODE_CHAT_TOOL_DEFINITIONS/stats counter, autonomousCoding summarizer + stats aggregation, codeChatStream.mutation list + system prompt, ToolPermissionsPopover 9→10, CodeChat.tsx badge 9→10 + extractDiffFromTrace + edit-history capture, toolSummary counted, 17 new tests, TS clean, 794/794 suite, build 18.43s] · items deferred: [] · sha: e911c50
- Pass 3 · angle: accessibility · queue: [A1 ARIA live region + A7 throttled announcer + new Accessibility matrix section] · items completed: [a11yAnnouncer.ts pure module with buildToolStartAnnouncement/buildToolFinishAnnouncement/buildMessageAnnouncement/buildAbortAnnouncement/buildStreamErrorAnnouncement/trimPreview + throttleAnnouncement/flushPending reducer, live-region JSX in CodeChat.tsx (role=status aria-live=polite sr-only data-testid), 4 useEffect hooks wiring tool start + finish + reply + error through the throttle, 37 new tests covering every builder + throttle + reducer flush, new "Accessibility" section in PARITY.md matrix (A1-A7)] · items deferred: [A4 focus trap in modals] · sha: 22c3384
- Pass 4 · angle: input validation + graceful degradation · queue: [R10 server-side stream request validator + R11 client-side byte meter] · items completed: [requestValidation.ts pure validator (message byte cap 64KB, iteration range 1-20, enabledTools max 20 with control-char + length filters, memoryOverlay 16KB cap, model id 128-char + control-char check, discriminated union with 12 specific error codes), 47 unit tests covering every positive + negative case including emoji multi-byte size check + message exactly at limit, codeChatStream.ts integration (early exit with 400 + specific code before SSE headers open), client-side byte meter above input (appears at 50%, amber at 80%, red at 95%), PARITY.md new R10/R11 rows + updated protected improvements list] · items deferred: [] · sha: b73e91d
- Pass 5 · angle: test coverage · queue: [F1 extract extractDiffFromTrace + extractEditSnapshotsFromToolEvents from CodeChat.tsx into pure module] · items completed: [traceDiffExtractor.ts new pure module with extractDiffFromTrace (multi_edit/edit_file/write_file + error fallbacks), extractEditSnapshotsFromToolEvents (batch over message's tool events with status filter + args.path fallback + defensive JSON parse), isEditToolName predicate, diffKindLabel label mapper; 30 new tests covering every tool branch + malformed JSON + missing fields + status filtering + pathless-drop + no-dedupe semantics; CodeChat.tsx now imports + delegates, removed inline duplicate logic from useEffect and TraceView extractor, net -52 lines of inline JSX-embedded logic replaced with 1 function call + imports] · items deferred: [] · sha: f7e2bea
- Pass 6 · angle: security audit · queue: [A1 fileTools.ts symlink escape hardening] · items completed: [verified symlink escape is exploitable (reproduced `./escape.txt` -> `/etc/passwd` read bypassing resolveInside), new resolveInsideReal(root, path) async helper that fs.realpath()s the target when it exists + fs.realpath()s the parent directory when the target is a new-file path so create-a-file-through-symlinked-dir is also blocked, updated readFile + writeFile + editFile + multiEditFile + listDirectory to call resolveInsideReal, new SANDBOX_ESCAPE + REALPATH_FAILED error codes, 14 new security tests (sandboxEscape.test.ts) covering direct symlink-to-file blocks on read/write/edit/multi_edit, symlinked-dir listDirectory block, write-into-symlinked-parent block with verification that the outside file stays untouched, allowed inside-workspace symlinks (absolute + relative), plain .. regression guards, direct unit coverage of resolveInsideReal; protected improvements list updated with R12] · items deferred: [] · sha: eda8565
- Pass 7 · angle: observability · queue: [R9 audit log depth bump] · items completed: [toolTelemetry.ts pure module with classifyToolKind (buckets all 12 tools into read/write/shell/network/meta/unknown), isMutation predicate, normalizePathForAudit (strips workspace root from absolute paths, marks outside-workspace as [outside-workspace] so deployment filesystem layout never leaks into logs), redactToolArgs (masks authorization/token/secret/password/apiKey keys, truncates long string values, recursively handles nested objects + arrays, immutable), buildToolCallAuditEvent (versioned structured shape {v, eventId, timestamp, userId, sessionId, toolName, kind, mutation, resultKind, error, errorMessage, errorCode, durationMs, args, resultBytes, role, source}, auto-generates eventId when omitted, rounds + clamps numeric fields), summarizeAuditEvents (total + byKind + errors + mutations + totalDurationMs + distinctTools for dashboards); 35 new tests covering classifier/predicate/path-normalize/redactor (secret keys, truncation, nested, arrays, array-size-cap, numbers/booleans/null, no-mutate)/builder (happy path + error + truncation + clamp + auto-id + workspace-relative + secret redaction inside args)/summary (empty + mixed aggregation); wired into codeChatStream.ts so every tool dispatch emits logger.info("codechat.tool_call", {audit: event}) with the pre-redacted structured event — no more ad-hoc log.error() in the dispatch path; R9 row in PARITY bumped from depth 2 to 8] · items deferred: [db-backed audit store, per-user rate limiting on tool calls] · sha: 24c5719
- Pass 8 · angle: error states · queue: [F1 defensive SSE parser + full test suite] · items completed: [sseEventParser.ts pure module with parseSseLine discriminated-union parser (tool_start/tool_result/todos_updated/instructions_loaded/mentions_resolved/done/error/thinking/heartbeat/unknown/invalid) and splitSseBuffer framing helper; per-event validators for tool_start (stepIndex finite number, non-empty toolName, args object coerced), tool_result (stepIndex + toolName required, resultKind defaults to unknown, durationMs clamped ≥0, truncated coerced bool, preview optional), instructions_loaded (filters non-string entries, defaults to empty on non-array), mentions_resolved (per-entry path required, bytes clamped ≥0), done (optional numeric fields passed through), error (message defaults to "Unknown error"); 44 new tests covering CRLF tolerance, empty lines, null/undefined, non-data lines, empty payload, malformed JSON, top-level array/primitive, missing type, unknown type forward-compat, every event happy path + every malformed-field branch; useCodeChatStream hook refactored to use parseSseLine + splitSseBuffer — removed inline JSON.parse + ad-hoc switch, added new "mentions_resolved" case as silent no-op, forward-compat unknown/invalid events silently ignored; PARITY R13 row added at depth 9] · items deferred: [] · sha: 2d349f0
- Pass 9 · angle: gap row T18 — git_blame tool · queue: [R1 T18 from PARITY matrix] · items completed: [gitBlame.ts pure module with parseBlamePorcelain (decodes --porcelain output handling repeated-commit metadata caching, author-mail bracket stripping, uncommitted flag for 0000 commit sha, ISO timestamp, short sha derivation, stray-line tolerance), summarizeBlame (per-author counts sorted desc with top-10 cap, distinctCommits, oldest/newest authorTime, mostRecent with commit+author+summary+ISO), runGitBlame subprocess wrapper (spawn git blame --porcelain with -L range, 15s timeout via SIGKILL, 2MB stdout cap, structured error codes NOT_FOUND/NOT_A_REPO/BAD_RANGE/GIT_FAILED, honors resolveInsideReal for workspace + symlink safety), 15 new tests covering single-commit/repeated-commit/mixed-authors/uncommitted/empty/stray-lines/angle-bracket-strip/tab-in-content/short-sha-header + summary aggregation; git_blame added to CodeToolName + CodeToolResult (new blame variant + GitBlameToolResult interface) + dispatchCodeTool case (BAD_ARGS on missing path, SandboxError passthrough, range arg validation), CODE_CHAT_TOOL_DEFINITIONS entry with full JSON schema, stats.blames counter + aggregation in executeCodeChat + autonomousCoding totalStats/failure-fallback/summarizeStep; codeChatStream.ts READ_ONLY_TOOLS + system prompt; toolTelemetry READ_TOOLS classifier updated; ToolPermissionsPopover new entry + DEFAULT_ENABLED_TOOLS, badge 10→11 in CodeChat.tsx; T18 row in PARITY matrix moved from open/depth=0 to done/depth=9] · items deferred: [] · sha: 7f75bcf
- Pass 10 · angle: type safety · queue: [F1 eliminate `as any` in codeChatStream.ts + F2 add tool-name coverage test] · items completed: [new KNOWN_TOOL_NAMES Set<CodeToolName> + isCodeToolName type guard at top of codeChatStream.ts; replaced `rawName as any` cast with narrowing predicate + fallback to "finish" on unknown tool names; replaced `(dispatchResult as any).kind/error/code/result.todos` with discriminated-union narrowing (`dispatchResult.kind === "error"` flow controls errorMessage/errorCode access); new toolNameCoverage.test.ts with 7 tests — compile-time exhaustive union check via _Exhaustive type alias that blows up if CodeToolName grows without ALL_TOOL_NAMES being updated, runtime checks that CODE_CHAT_TOOL_DEFINITIONS covers everything except "finish", classifyToolKind never returns "unknown" for real tools, write/shell/network/meta bucket integrity, unknown fallback; removed 5 `as any` occurrences from the hot path] · items deferred: [] · sha: 966edf2
- Pass 11 · angle: performance (under load) · queue: [F1 per-user tool rate limiter — deferred from P7] · items completed: [toolRateLimiter.ts pure module with BucketConfig/RateLimitConfig types, DEFAULT_RATE_LIMIT_CONFIG (reads+meta unlimited, writes 30/min burst 10, shell 10/min burst 5, network 20/min burst 10, unknown uses writes config), createRateLimitConfig merge helper, refill (elapsed-time + clamp to capacity + handles now-before-updatedAt), take (refill+deduct atomic, retry-after computation from refill rate, Infinity when refillRate=0, honors cost>1), consumeFromStore (per-user × per-kind Map store with auto-init + null-config unlimited passthrough + structured RATE_LIMITED error on denial), gcStore (drops users with oldest bucket > maxAge), getGlobalRateLimitStore/resetGlobalRateLimitStore singleton for SSE route; 26 new tests covering refill (zero-time/past-time/proportional/cap/fractional), take (allowed/refill-then-take/denied/retry-after/slow-refill/cost>1/insufficient-cost/zero-refill-infinity/no-mutate), emptyBucket, consumeFromStore (null-unlimited/first-from-fresh/denial/refill-retry/per-user-isolation/per-kind-isolation), createRateLimitConfig (defaults/overrides/unlimited), gcStore (removes/retains/empty); wired into codeChatStream.ts — after mutation gate, before dispatch, consumes one token per call, denials short-circuit with structured error Payload that matches existing error-event shape, logger.warn on denial, unref'd 5-minute GC interval so tests don't hang; R14 row added at depth 9; Pass 7 deferral closed] · items deferred: [] · sha: 5bb64a9
