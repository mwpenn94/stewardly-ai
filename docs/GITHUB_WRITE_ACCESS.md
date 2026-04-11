# Code Chat Cloud Parity (Passes 201-231)

Stewardly's Code Chat ships full Claude-Code-style terminal cloud parity:

- **Read** — repository metadata, open PRs, file contents at any ref
- **Write** — list repos, create/delete branches, atomic multi-file commits,
  create/update/merge pull requests (Pass 201)
- **Background** — long-running autonomous sessions and fire-and-forget
  GitHub push jobs with cooperative-cancel + per-user concurrency caps (Pass 201)
- **Inline diff preview** — live diff between draft and saved content in the
  file editor, GitHub-style two-column gutter (Pass 202)
- **Slash commands** — `/clear`, `/cancel`, `/help`, `/write`, `/iterations`,
  `/model`, `/diff`, `/explain`, `/find` with keyboard nav + rewrite-to-prompt
  (Pass 203)
- **Rich markdown responses** — `react-markdown` + GFM tables + fenced code
  with per-block Copy button and language label (Pass 204)
- **Streaming tool-result diffs** — edit_file / write_file results carry
  64KB before/after snapshots that auto-render as inline diffs in the
  trace viewer (Pass 205)
- **`@file` mentions** — workspace file autocomplete in the chat input,
  server-side file expansion so the LLM gets mentioned files as context
  without a round-trip (Pass 206)
- **Shiki syntax highlighting** — lazy-loaded GitHub-dark-dimmed theme
  with bundled grammars for ts/tsx/python/go/rust/etc (Pass 207)
- **Message action bar** — hover-revealed Copy / Export-markdown /
  Regenerate buttons on every assistant response (Pass 208)
- **Input draft autosave + shortcuts overlay** — in-progress input
  persists across refreshes; press `?` (or click the keyboard icon)
  to see every shortcut + slash command (Pass 209)
- **Token & cost telemetry** — per-message token counts + USD cost
  for priced models + running session total in the config bar
  (Pass 210)
- **Error banner with Retry** — failed ReAct loops leave a sticky
  banner with Retry / Dismiss instead of a fire-and-forget toast
  (Pass 211)
- **Saved sessions library** — name/save/rename/delete conversation
  snapshots with localStorage persistence (Pass 212)
- **Per-tool permission toggles** — fine-grained allowlist of the
  6 Code Chat tools, intersected server-side with role gating
  (Pass 213)
- **Prompt template library** — 5 built-in templates + user-created
  macros with save/search/insert (Pass 214)
- **Hierarchical file tree + codebase stats** — collapsible workspace
  tree with top-language pills in the Files tab (Pass 215)
- **Ctrl+R command history search** — terminal-style reverse-i-search
  with fuzzy matching and highlighted matches (Pass 216)
- **Per-message tool-call summary** — "read 4 · grep 2 · edit 1"
  chip row under every assistant response with files-touched tooltip
  (Pass 217)
- **Template variables `{{name}}`** — insert-time form asks for
  placeholder values before applying a template (Pass 218)
- **Export conversation to GitHub Gist** — one-click publish as a
  secret Gist owned by the caller, auto-copies URL to clipboard
  (Pass 219)
- **Conversation fork at any message** — clone the conversation up to
  an assistant turn into a new session for exploring alternate paths
  (Pass 220)
- **Cross-session full-text search** — search across every saved
  session's message content with highlighted match snippets (Pass 221)
- **Session cost budget guardrail** — set a USD limit per session;
  warns at 50% and blocks sends at 100% with an override prompt
  (Pass 222)
- **Silent auto-checkpoint** — conversations auto-save to the
  sessions library every 4 turns; no more lost work from refresh
  or crash (Pass 223)
- **Pinned files working set** — keep a small set of files in
  context across every prompt via auto-injected `@path` references
  (Pass 224)
- **Grep result quick-jump** — clickable per-line rows under every
  grep trace step that open the file at the matched line (Pass 225)
- **Session stats dashboard** — aggregate totals (sessions /
  messages / tool calls) + top-6 tool-kind chips in the sessions
  popover (Pass 226)
- **Vim-style chord shortcuts** — `g c` / `g f` / `g r` / `g d` /
  `g h` / `g w` / `g j` for instant tab navigation (Pass 227)
- **Session library JSON import** — round-trip the sessions export
  file back into the library with merge or replace modes (Pass 228)
- **Session tags** — per-session tag chips with inline editing + a
  top-level tag filter row for AND-combined filtering (Pass 229)
- **Context window usage meter** — `ctx NN%` pill that flips amber
  at 60% and red at 80% of the active model's context limit
  (Pass 230)
- **Prompt template JSON import/export** — share user templates
  across teams/devices with merge (dedup by name+body) or replace
  modes; built-ins are always re-hydrated from code (Pass 231)

This document walks through the architecture, the tRPC surface, the
safety model, and the UI. For setup (tokens, connection flow) see
[ENV_SETUP.md § GitHub](./ENV_SETUP.md#github-code-chat-read--multi-repo-write).

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ client/src/pages/CodeChat.tsx                                │
│  ├── Chat tab  (ReAct loop + SSE streaming)                  │
│  ├── Files tab (admin inline editor + Save)                  │
│  ├── Roadmap / Diff / GitHub-read tabs                       │
│  ├── Git Write tab — GitHubWritePanel                        │
│  └── Jobs tab — BackgroundJobsPanel                          │
└──────────────────────────────────────────────────────────────┘
                            │
                            ▼ tRPC
┌──────────────────────────────────────────────────────────────┐
│ server/routers/codeChat.ts                                    │
│  ├── dispatch / chat (local sandboxed workspace)              │
│  ├── roadmap procs                                            │
│  ├── github* procs (read)                                     │
│  ├── github*{Create,Commit,Merge,Update,Delete}* (write)      │
│  └── background job procs                                     │
└──────────────────────────────────────────────────────────────┘
                            │
                 ┌──────────┴──────────┐
                 ▼                     ▼
┌──────────────────────────┐  ┌────────────────────────────────┐
│ services/codeChat/       │  │ services/codeChat/             │
│  githubClient.ts         │  │  backgroundJobs.ts             │
│  - loadCredsForUser      │  │  - enqueueJob / runJob         │
│  - list repos/branches   │  │  - per-user concurrency cap    │
│  - blob→tree→commit→ref  │  │  - cooperative cancel flag     │
│  - merge/update/delete   │  │  - ring-buffer event log       │
└──────────────────────────┘  └────────────────────────────────┘
```

## Credential resolution (user-scoped)

Every write procedure calls
`loadGitHubCredentialsForUser(ctx.user.id)` before touching the GitHub
API. Resolution order:

1. `integration_connections` row where `providerId = github` and
   `userId = ctx.user.id`, `status != disconnected` — credentials
   decrypted through `encryption.decryptCredentials()`
2. Process-wide `GITHUB_TOKEN` env var — the same shared token every
   caller uses (single-operator deployments)
3. `null` → the procedure returns `{ ok: false, error: "not_connected" }`
   so the UI can surface a "connect your account" prompt

The `githubMe` procedure exposes the resolved identity + source to the
client so the Git Write tab can render "Connected as @handle" with the
credential-source badge. This makes it obvious whose token is about to
commit.

## Write-side tRPC procedures

All procedures live on `codeChat.*` and accept explicit `owner` +
`repo` strings. No procedure defaults to the Stewardly app repo.

| Procedure | Gate | Purpose |
|---|---|---|
| `githubMe` | `protectedProcedure` | Returns authenticated user + source |
| `githubListMyRepos` | `protectedProcedure` | Lists pushable repos (paginated, sortable) |
| `githubListBranches` | `protectedProcedure` | Branches for a repo |
| `githubListPullRequests` | `protectedProcedure` | Open PRs for an arbitrary repo |
| `githubGetPullRequest` | `protectedProcedure` | PR detail incl. mergeable state |
| `githubGetFile` | `protectedProcedure` | Single file at a ref |
| `githubCreateBranch` | `protectedProcedure` | New branch off `fromBranch` or default |
| `githubCommitFiles` | `protectedProcedure` | Atomic multi-file commit |
| `githubCreatePullRequest` | `protectedProcedure` | Opens a PR |
| `githubUpdatePullRequest` | `protectedProcedure` | Edit title/body/base/state |
| `githubMergePullRequest` | `protectedProcedure` | merge / squash / rebase |
| `githubDeleteBranch` | `protectedProcedure` | Refuses to delete main/master/develop |

### Safety rails

- **Push-access pre-flight.** `githubCreateBranch` and `githubCommitFiles`
  both run `verifyPushAccess(creds, owner, repo)` before mutating. This
  surfaces a clean "no push access" error instead of a cryptic 403 mid-
  commit.
- **Protected branch refusal.** `githubDeleteBranch` refuses to delete
  literal `main`, `master`, or `develop` regardless of GitHub's own
  protection state — a belt-and-braces guard against the most common
  accidental destructive click.
- **405-aware merge.** `githubMergePullRequest` intercepts GitHub's 405
  "Pull Request is not mergeable" response and returns it as a clean
  `Not mergeable: <reason>` error the UI can show without a stack trace.
- **Audit logs.** Every write logs `{ userId, owner, repo, action, ... }`
  through the standard logger so ops can trace who did what.

### Multi-file commit flow (Git Data API)

`commitMultipleFiles` doesn't use the simpler single-file `contents`
endpoint — it walks the full 5-step Git Data API so dozens of files can
land in a single atomic commit:

```
1. GET  /repos/:o/:r/git/refs/heads/:branch     → baseCommitSha
2. GET  /repos/:o/:r/git/commits/:sha           → baseTreeSha
3. POST /repos/:o/:r/git/blobs      (× N files) → blob SHAs
4. POST /repos/:o/:r/git/trees      (base_tree) → newTreeSha
5. POST /repos/:o/:r/git/commits    (parents)   → newCommitSha
6. PATCH /repos/:o/:r/git/refs/heads/:branch    → fast-forward branch
```

File deletions are represented as `{ path, content: "", deleted: true }`
which inserts a `{ sha: null }` tree entry — the same shape `git rm`
produces under the hood.

## Background jobs

`server/services/codeChat/backgroundJobs.ts` is an in-memory job store
designed for developer-tool workloads (not persistent workflow state).

### API

```ts
enqueueJob({ userId, kind, title, runner }) → BackgroundJob
listJobs(userId) → BackgroundJob[]
getJob(id, userId) → BackgroundJob | null
cancelJob(id, userId) → boolean
jobStats() → { total, running, queued, succeeded, failed, cancelled }
```

Runners are `async (ctx) => unknown` closures. The context exposes:

- `ctx.append({ level, message, data? })` — emit an event (ring-buffered
  at 500 per job)
- `ctx.isCancelled()` — cooperative cancel check; runners should poll
  this between steps
- `ctx.jobId` / `ctx.userId` — identity

### Concurrency + trimming

- `MAX_CONCURRENT_PER_USER = 2` — new jobs queue behind active ones
- `MAX_HISTORY_PER_USER = 50` — terminal jobs are trimmed FIFO
- `MAX_EVENTS_PER_JOB = 500` — event log is a sliding window

### Exposed job kinds

| tRPC proc | Gate | Runner |
|---|---|---|
| `startAutonomousJob` | `adminProcedure` | `runAutonomousCoding` against the local workspace with strict budgets (max 4 subtasks, 30 writes, 10 min wall clock by default) |
| `startGitHubPushJob` | `protectedProcedure` | Verifies push access → creates branch if missing → multi-file commit → optional PR open |
| `listBackgroundJobs` | `protectedProcedure` | Caller's own jobs only |
| `getBackgroundJob` | `protectedProcedure` | Caller's own job, with event log |
| `cancelBackgroundJob` | `protectedProcedure` | Sets `_cancelRequested` flag |
| `backgroundJobStats` | `adminProcedure` | Aggregate stats across all users |

## Client surface

### CodeChat.tsx — new tabs

- **Git Write** — `GitHubWritePanel` renders repo picker → branches /
  commit-&-push / PRs / create-PR cards in a 2×2 grid. Each card is
  wired to the matching tRPC procedure and invalidates the others on
  success so the display stays in sync.
- **Jobs** — `BackgroundJobsPanel` lists active + historical jobs with
  auto-polling (2s when active, 10s when idle), per-job expand panel
  with live event log, cancel button, and an admin-only "Start
  autonomous session" form at the top.

### FileBrowser inline edit

The existing Code Chat Files tab gained an **Edit** button (admin
only). Clicking it swaps the `<pre>` viewer for a `<Textarea>` bound
to a `draft` state. Save dispatches
`codeChat.dispatch({ call: { name: 'write_file', … }, allowMutations: true, confirmDangerous: true })`
and invalidates the file content on success. Cancel rolls back the
draft. The feature is gated on `user.role === 'admin'` because it
writes to the live workspace under `CODE_CHAT_WORKSPACE_ROOT`.

## Tests

| File | Tests | Coverage |
|---|---|---|
| `server/services/codeChat/githubClient.test.ts` | 17 | parseRepoString, getAuthenticatedUser, listUserRepositories (pushable filter), listBranches, createBranch, commitMultipleFiles (full flow + deletions + empty guard), mergePullRequest (success + 405), updatePullRequest, verifyPushAccess (grant / deny / 404), deleteBranch URL encoding |
| `server/services/codeChat/backgroundJobs.test.ts` | 8 | enqueue/run success, error capture, cross-user isolation, listJobs ordering, cooperative cancel, cross-user cancel refusal, concurrency cap, jobStats |

Both test files use stubbed `fetch` / in-memory state so they run
offline. `pnpm test -- githubClient backgroundJobs` runs them in under
2 seconds.

## Verification checklist

- [ ] `/code-chat` → **Git Write** tab shows "Connected as @handle"
- [ ] Repo dropdown includes a non-Stewardly repo your token can push to
- [ ] Create a branch from a non-default base, verify it shows in the list
- [ ] Stage a file with the inline editor, commit + push, check the commit on GitHub
- [ ] Open a PR from the commit form card
- [ ] Merge the PR with squash, confirm the branch is deleted from the list
- [ ] `/code-chat` → **Jobs** tab — admin starts an autonomous session, watches events stream, cancels mid-flight
- [ ] `/code-chat` → **Files** tab — admin clicks Edit on a file, changes a character, Save, verify the file changed on disk

## Cloud parity features (Passes 202-206)

### Inline diff preview (Pass 202)

The Code Chat Files tab now includes a live diff preview when editing
files. Click **Edit** → make changes in the Textarea → click **Diff**
to swap the Textarea for a GitHub-style two-column unified diff:

- Green background with `+` prefix for additions
- Red background with `-` prefix for deletions
- Two-column gutter showing old/new line numbers
- Hunk headers (`@@ -10,3 +10,5 @@`)
- Stats strip (`+X / −Y / NN% similar`)

The underlying diff engine is `shared/lineDiff.ts` — a pure-function
LCS diff that normalizes CRLF, groups entries into hunks with
configurable context (default 3 lines), and exposes `formatUnifiedDiff()`
for CLI output. Reused by the tool-result viewer in Pass 205 and
available to any client component via `import DiffView from
"@/components/codeChat/DiffView"`.

### Slash commands (Pass 203)

Type `/` at the start of the Code Chat input to open a fuzzy-filtered
popover of built-in commands. Arrow up/down to navigate, Tab or Enter
to select, Esc to close. Pressing Enter on a complete command with its
args runs it immediately.

| Command | Aliases | Description |
|---|---|---|
| `/clear` | `/c` | Clear chat history (keeps command history) |
| `/cancel` | `/stop`, `/abort` | Abort the running ReAct loop |
| `/help` | `/h`, `/?` | Show the command list |
| `/write on\|off` | `/w` | Toggle write mode (admin only) |
| `/iterations <n>` | `/iter`, `/i` | Set max ReAct iterations (1-10) |
| `/model <id>` | `/m` | Override model for the next message |
| `/diff <path>` | — | Expands into a "show unified diff" prompt |
| `/explain <path>` | `/e` | Expands into an "explain this file" prompt |
| `/find <pattern>` | `/grep`, `/search` | Expands into a grep prompt |

Commands are pure data in `slashCommands.ts` — to add one, append a
`SlashCommand` entry. 28 unit tests lock in the parser, registry
lookup, fuzzy filter, and every built-in handler.

### Markdown + code rendering (Pass 204)

Assistant responses render via `react-markdown` + `remark-gfm`:

- Headings (`# ## ###`) with the Stewardship Gold heading font
- Lists, tables, blockquotes, emphasized text
- Inline code with subtle background
- Fenced code blocks with language label + one-click Copy button
- External links open in a new tab with `rel="noopener noreferrer"`

Syntax highlighting is exposed as CSS classes (`language-ts`, etc.)
so Shiki or Prism can be layered on later without touching the
component.

### Tool result diffs (Pass 205)

When the ReAct loop executes `write_file` or `edit_file`, the result
now includes 64KB `before` and `after` snapshots (capped — set
`diffTruncated: true` when either was trimmed). The SSE endpoint
streams the JSON payload to the client as a `tool_result` event. The
`TraceView` component auto-detects edit/write tool kinds, parses the
JSON preview, and renders an inline `DiffView` in place of the raw
observation dump. Expanded trace steps show a green `diff` badge so
users know at a glance which tool calls produced file changes.

### `@file` mentions (Pass 206)

Type `@` in the Code Chat input to open a fuzzy-filtered workspace
file picker:

- `codeChat.listWorkspaceFiles` tRPC query returns up to 15 ranked
  matches from a 60-second cached file index (`fileIndex.ts`)
- Basename matches rank above path substring matches; exact basename
  hits rank highest
- `@server/routers/codeChat.ts` inserts the path at the cursor
- `@{path with spaces.ts}` is supported via bracket syntax
- Bare `@usernames` (no slash, no extension) are skipped so
  `@bob take a look` doesn't trigger the picker

The SSE streaming endpoint parses `@`-mentions out of the outgoing
message, reads each file (capped at 5 refs per message, 32KB per
file), and appends the contents to the user message as context
blocks before handing off to the ReAct loop. The client sees a
`mentions_resolved` SSE event so it can display which files were
attached.

**Why this matters:** before Pass 206, telling the agent "compare
these three files" required three separate `code_read_file` tool
calls. Now the agent gets all three file contents inline in the
first message and can answer in a single turn.

## Polish passes (207-211)

### Shiki syntax highlighting (Pass 207)

Code blocks inside assistant responses now render with GitHub-Dark-Dimmed
syntax highlighting via [Shiki](https://shiki.style). Shiki is
~1MB (highlighter + grammars + themes) so we lazy-load it on first use
via `client/src/components/codeChat/shikiHighlight.ts` — the plain
`<pre>` renders instantly, then the highlighted version swaps in as
soon as the WASM loader resolves. Bundled languages cover the stack
this app writes (ts/tsx/js/jsx/json/bash/sql/python/go/rust/yaml/html/
css/diff/markdown/java/kotlin/swift/ruby/php). Aliases like
`typescript`, `yml`, and `py` are normalized via a lookup table. A
unit test file (`shikiHighlight.test.ts`, 5 tests) locks in the
normalizer so future language additions don't break existing
mappings.

### Message action bar (Pass 208)

Every assistant message grows a hover-revealed action row with:

- **Copy** — writes `msg.content` to the clipboard
- **Export** — downloads a markdown snapshot of that single turn
  including trace + metadata (`exportSingleMessageAsMarkdown`)
- **Regenerate** — only shown on the last assistant message; calls
  `regenerateLast()` which trims back to the most-recent user turn
  and re-sends with the current model override / iterations

The config bar also grows a full-conversation **Export** button that
dumps every turn as a single markdown file (`code-chat-YYYY-MM-DD.md`)
via `exportConversationAsMarkdown`. Both exporters render tool calls
as collapsible `<details>` blocks so the prose stays readable on
GitHub, Slack, or email. 9 unit tests cover title rendering, metadata,
trace inclusion/exclusion, truncation of long arg values, and the
single-message variants.

### Keyboard shortcuts overlay + draft autosave (Pass 209)

Press `?` when the input is empty (or click the keyboard icon in the
config bar) to open a modal listing every chat shortcut and every
slash command. Arrow up/down history, `@`, `/`, Tab, Esc, Shift+Enter —
all documented in one place so new users can see what's possible
without hunting through docs.

Alongside the overlay, the chat input draft is now autosaved to
`localStorage['stewardly-codechat-draft']` on every keystroke and
cleared when the input becomes empty. Refreshing the page restores
whatever was half-typed, matching the muscle memory of most modern
chat apps.

### Token & cost telemetry (Pass 210)

`tokenEstimator.ts` provides a client-side estimator using a
conservative `chars / 3.8` ratio (most tokenizers average ~3.8 chars
per token for English prose, and the accuracy at our "round to the
nearest 100 tokens" display is plenty — an exact count would require
shipping tiktoken/anthropic-tokenizer WASM which doesn't earn its
~500KB at this resolution). A `MODEL_PRICING` table carries rough
$/1M in/out prices for the 8 models we actively route to, with a
`costUSD: null` fallback for unknown models.

Per-message display: `3.4kt ($0.012)` alongside the existing
model/iterations/duration meta line. Session total: a `12kt · $0.08`
pill next to the Code Chat title in the config bar, with a
`n in / m out` tooltip. 16 unit tests cover the ratio math,
priced/unpriced mixed sums, and all formatter edge cases.

### Error banner with Retry (Pass 211)

When the ReAct loop errors (network failure, LLM timeout, tool
crash) the previous behavior was a single fire-and-forget toast
that vanished after a few seconds — leaving the user with no way
to understand what happened or recover. Pass 211 replaces that
with a persistent `AlertTriangle` banner above the input that:

- Surfaces the full error message (not truncated)
- Offers a **Retry** button that calls `regenerateLast()` with the
  same prompt + config (model override, iterations, write mode)
- Offers a **Dismiss** button that clears the banner without
  retrying
- Auto-clears when the user sends a new prompt

Combined with the message-level Regenerate button from Pass 208,
this gives three levels of recovery: reset the last turn, retry
a failure, or clear everything with `/clear`.

## Session management & productivity (Passes 212-215)

### Saved sessions library (Pass 212)

The **Sessions** button in the config bar opens a modal listing every
saved conversation snapshot. Each snapshot stores a name, the full
message array, and created/updated timestamps. Users can:

- Save the current conversation with a custom name (or accept the
  auto-generated name derived from the first user prompt)
- Click any saved session to restore its messages in place via
  `loadMessages()` on the stream hook
- Rename inline with a checkmark/cancel toggle
- Delete (with confirm)
- Export the entire library as a JSON file for backup/transfer

Storage is localStorage-only by design — this is a developer tool,
not a compliance-relevant audit surface. The `sessionLibrary.ts`
module is pure functions + a thin localStorage adapter so the same
API shape could migrate to a `code_chat_sessions` drizzle table if
cross-device sync becomes a requirement. 21 unit tests cover the
parser (invalid JSON, wrong version, malformed entries), upsert
(dedup + sort), delete (idempotent), rename (trim + reject empty),
auto-name (truncation + multi-line handling), and the 50-session
overflow trim.

### Per-tool permission toggles (Pass 213)

Before Pass 213 the only tool-level gate was "all or nothing via
write mode". Pass 213 adds a fine-grained allowlist — the
**ShieldCheck** button in the config bar opens a modal with a
checkbox for each of the 6 tools (read_file, list_directory,
grep_search, write_file, edit_file, run_bash). Defaults to
"everything on"; users can flip individual tools off or use the
"Read-only preset" quick action.

The `enabledTools: string[]` array flows through `useCodeChatStream`
into the SSE POST body, and the server-side `codeChatStream.ts`
endpoint intersects it with the role-based allowlist:

```ts
const toolDefs = CODE_CHAT_TOOL_DEFINITIONS
  .filter((t) => canMutate || READ_ONLY_TOOLS.has(t.name))     // role gate
  .filter((t) => (userAllowed ? userAllowed.has(t.name) : true)); // UI gate
```

This means a non-admin sending `enabledTools: ["run_bash"]` still
gets bash stripped — the role gate runs first.

### Prompt template library (Pass 214)

The **Templates** button in the config bar opens a popover with:

- 5 built-in templates (review recent changes, refactor a file,
  explain a module, write tests, debug an error) — each uses
  `@{path}` placeholders so users get a head start on how to
  reference files
- User-created templates with save/search/delete
- A "Save current" shortcut that pre-fills the create form with
  the current input
- Search box that filters on both name and body

Built-ins are flagged `builtin: true` and the parser explicitly
refuses to let storage override them — a future schema change to
a built-in is honored regardless of what's in localStorage.
18 unit tests cover the parser, add/delete, filter, and the
"built-ins can't be overridden" security property.

### Hierarchical file tree + codebase stats (Pass 215)

The Files tab Workspace card now has a **List ↔ Tree** toggle. Tree
mode renders:

- A stats strip: total files, total dirs, top-5 language pills with
  counts + percentages
- A collapsible tree rooted at the workspace root. Click folders to
  expand/collapse, click files to open in the adjacent viewer.

`buildFileTree` is a pure function that converts a flat POSIX path
list into a sorted nested structure (directories before files at
each level). `computeStats` computes language breakdown by extension
and top-directory frequency. Both are fully unit-tested (13 tests
covering nesting, sorting, dedup, extensionless files, and the topN
cap).

The server-side `codeChat.listWorkspaceFiles` tRPC query grew an
`all: true` option that bypasses fuzzy filtering and returns the
full 5000-file cap so the tree view has the whole workspace in one
fetch. Indexing is cached for 60s so tab switching stays cheap.

## Terminal classics & power features (Passes 216-219)

### Ctrl+R command history search (Pass 216)

Press **Ctrl+R** (or **Cmd+R** on Mac) anywhere in the Code Chat —
including from inside the input textarea — to open a terminal-style
reverse-i-search modal over the command history. The popover:

- Fuzzy-matches against every past prompt (substring first, falling
  back to subsequence)
- Highlights the matched characters in accent color
- Arrow up/down to navigate, Enter to insert, Esc to close
- Shows `N matches / total history` in the footer

The matching logic lives in `commandHistorySearch.ts` as pure
functions — 13 unit tests cover the scoring model, dedup, case
insensitivity, highlight-segment builder, and empty-query pass-
through.

### Per-message tool-call summary (Pass 217)

Every assistant message now shows a chip row under the response with
a running receipt of what the agent actually did during that turn —
`read 4 · grep 2 · edit 1 · bash 1 · errors 1`. Chips are color-coded:
info (neutral) for read-only tools, warn (amber) for mutating tools,
error (red) for failed calls. A `N files` suffix (with a tooltip
listing exact paths) shows how many unique files the agent touched.

`toolSummary.ts` is a pure-function aggregator — 12 tests cover the
kind counts, error detection, duration sums, unique-file collection,
chip filtering, and the human-readable `summarySentence()` output
used for exports.

### Template variables (Pass 218)

Prompt templates can now contain `{{variable}}` placeholders that
get filled in at insert time. When a user picks a template with
placeholders, the popover opens a form above the template list
asking for values, then substitutes them into the body before
insertion. An "Insert raw" escape hatch leaves the placeholders
intact for users who want to fill them manually.

Variable extraction is pure: `{{ file }}` and `{{file}}` match the
same name, malformed placeholders (`{{123}}`, `{{-bad}}`, `{file}`)
are ignored, and unknown variables are left as-is on substitution
so the user sees exactly what they forgot to fill in. Template list
rows show a `N vars` badge when placeholders are present, with a
hover tooltip listing the variable names.

### Export conversation to GitHub Gist (Pass 219)

The **Gist** button next to Export in the config bar publishes the
current conversation as a GitHub Gist owned by the caller's own
identity. Defaults to **secret** (not public) so users can share via
URL without accidentally broadcasting their work. The description is
auto-derived from the first user message (truncated to 200 chars).

On success, the gist URL is copied to the clipboard automatically
and a toast surfaces with an "Open" link. Failures surface the
GitHub API error message inline.

Server-side: `createGist` is a thin wrapper around `POST /gists` in
`server/services/codeChat/githubClient.ts`. The tRPC mutation
(`codeChat.exportToGist`) validates content size (≤1MB), sanitizes
the filename with a regex allowlist, and logs every export with
`{ userId, gistId, public }` so ops can track who published what.
2 new primitive tests cover the POST body shape and 422 validation
error handling.

## Session power features (Passes 220-223)

### Fork conversation at any message (Pass 220)

Every assistant message has a **GitFork** button in its hover action
bar. Clicking it creates a new saved session with the conversation
truncated to and including that message, then immediately switches
the active session to the fork so the user can continue from there
without touching the original. Great for "what if I had asked this
differently?" exploration.

`forkMessagesAt(messages, forkMessageId)` is a pure function that
returns the inclusive slice up to the target id, or the original
list unchanged if the id isn't found. The fork is named
`Fork: <auto-derived title>` via the same `autoName()` helper used
for manual saves.

### Cross-session full-text search (Pass 221)

The Sessions popover grew a top-level search input that scans every
saved session's message content (not just names). Results render in
a compact list above the session rows with:

- Session name + message index + role as the header
- A ~120-char snippet window around the match with the matched
  substring highlighted in accent color
- Click to load the matching session into the live hook

`searchSessions` is case-insensitive, ordered by session
`updatedAt` newest-first, capped at 50 results. 10 new unit tests
cover the snippet window, match-position tracking, role metadata,
ordering, and the empty-query passthrough.

### Cost budget guardrail (Pass 222)

The token/cost pill in the config bar is now clickable — click it
to set a USD session budget (empty = no limit). The pill colors
itself by budget status:

- Neutral: under the warn threshold (default 50% of limit)
- Amber: between warn threshold and limit
- Red: at or over the limit

When the budget is blocked, `handleSend` short-circuits with a
toast so users can't accidentally spend beyond the cap. The limit
persists to `localStorage['stewardly-codechat-budget']` across
refreshes.

`evaluateBudget()` is a pure function: returns `{status, pct,
remainingUSD}`. 8 unit tests cover no-limit, unpriced models,
threshold crossings, zero-clamping over-budget remaining, and the
"limit ≤ 0 means no limit" edge.

### Silent auto-checkpoint (Pass 223)

Conversations now save themselves. A `useEffect` watches
`messages` and calls `upsertSession()` every 4 new messages
(configurable) with a stable `auto-${uuid}` session id so repeated
saves update the same row. Key properties:

- Waits until there's ≥1 assistant reply before the first save
  (avoids saving empty prompts)
- Reuses `currentSessionId` when set, so manual saves and
  auto-checkpoints share the same snapshot
- Resets state on `messages.length === 0` (after `/clear`) so the
  next conversation gets a fresh auto-id
- `shouldCheckpoint()` is a pure function with 6 unit tests
  covering delta math, the assistant-required rule, and the
  everyN ≤ 0 "disabled" case

Result: users never lose work to a refresh or tab crash, and the
sessions library quietly accumulates a complete history without
anyone having to remember to click Save.

## Workflow power features (Passes 224-227)

### Pinned files working set (Pass 224)

A small set of files you want kept in context across every prompt.
Pin from the FileBrowser viewer via the **Pin** button; the pins
render as chips above the chat input with per-chip unpin buttons.

On every send, `applyPinnedToMessage()` prepends `@path` references
for the pinned files to the user message so the existing
`extractFileMentions()` server expander reads them and inlines the
file contents as context. Already-mentioned paths are skipped so
user-explicit `@` references always win.

State persists to `localStorage['stewardly-codechat-pinned-files']`,
capped at 10 entries with oldest-drops-first overflow. 21 unit
tests cover parsing, dedup, toggle, path-with-spaces bracketing,
and the "skip already-mentioned" rule.

### Grep result quick-jump (Pass 225)

`grep_search` trace steps now render clickable match rows under
each result. Matches are grouped by file with a line-number gutter;
clicking any row dispatches a `codechat-open-file` custom event
that switches to the Files tab and reads the file at the matched
line.

The Tabs component is now controlled (`activeTab` state hoisted
into `CodeChatPage`) so any code path can navigate to another tab.
`FileBrowser` reads a pending-open target from localStorage on
mount since it re-mounts when the user switches tabs.

`extractGrepMatches()` is a pure parser — 7 tests cover the JSON
shape, malformed entries, non-grep tool kinds, and the truncated
flag. `groupMatchesByFile()` is 3 more tests.

### Session stats dashboard (Pass 226)

The Sessions popover grew an aggregated stats strip showing:

- Total sessions, messages, tool calls, distinct models used
- Top-6 tool-kind chips (read_file / grep_search / edit_file / ...)

`aggregateSessions(library)` is a pure function — 3 unit tests
cover the zero-library case, the full shape, and the
no-toolEvents fallback.

### Vim-style chord shortcuts (Pass 227)

Two-key chord sequences for instant tab navigation matching the
GitHub "g p / g i / g c" convention that power users already know:

| Chord | Destination |
|---|---|
| `g c` | Chat tab |
| `g f` | Files tab |
| `g r` | Roadmap tab |
| `g d` | Diff tab |
| `g h` | GitHub (read) tab |
| `g w` | Git Write tab |
| `g j` | Jobs tab |

The chord state machine (`stepChord`) lives in `keyChords.ts` as a
pure function — 10 unit tests cover every chord, the wrong-second-
key reset, the 1.5-second timeout, and ignore behavior for
unrelated keys. The listener in `CodeChatPage` skips text fields so
typing `g` as part of a prompt doesn't trigger the chord.

## Sharing + organization + context awareness (Passes 228-231)

### Session library JSON import (Pass 228)

The Sessions popover footer now has an **Import** button alongside
the existing Export library button. Clicking it prompts the user to
pick a previously-exported `codechat-sessions-*.json` file, then
asks whether to **merge** (skip duplicate ids) or **replace** (discard
the current library entirely).

`importLibrary()` is pure: it routes the incoming payload through
the same `parseLibrary()` validator used for disk loads, so
malformed sessions drop silently rather than corrupting state.
6 unit tests cover both modes, the malformed-JSON path, the
skip-duplicate rule, and the empty-library-on-garbage-in case.

### Session tags (Pass 229)

Sessions can now be tagged for organization. Each session row has a
**Tag** button in the action bar that opens an inline input; typing
a tag and pressing Enter adds it. Tags render as chips below the
row title with per-chip unpin buttons.

Above the session list, a tag-filter chip row shows every distinct
tag in the library. Clicking a tag toggles it in the active filter;
the session list then AND-combines the filter so a session must
match *every* selected tag to appear. Sessions without tags are
excluded from any filtered view.

Tag normalization is strict (`normalizeTag` trims, lowercases,
strips a leading `#`, and rejects whitespace / special chars
except `_ - / .`) so tags stay URL- and filename-safe. 5+7+5
unit tests cover normalization, add/remove idempotency, and the
filter algebra.

### Context window usage meter (Pass 230)

A new `ctx NN%` pill in the config bar shows how much of the
active model's context window the session has consumed. Thresholds:

- Under 60% — neutral (no highlight)
- 60–80% — amber warning
- 80%+ — red critical (user should `/clear` or fork the conversation)

`MODEL_CONTEXT_LIMITS` covers every model in `MODEL_PRICING` — Claude
Opus 4.6 / Sonnet 4.6 at 1M tokens, Haiku 4.5 at 200K, GPT-5 at 400K,
GPT-4o at 128K, Gemini 2.5 Pro at 2M, and so on. Unknown models
fall back to `DEFAULT_CONTEXT_LIMIT = 128K` and surface
`modelKnown: false` in the tooltip so users know the limit is
approximate.

The active model is resolved from `modelOverride` first, then from
the most recent assistant message's `.model` field — so the meter
always reflects what the server actually routed to, not just what's
in the model picker. 9 unit tests cover the threshold buckets, the
fallback limit, and the large-number formatting helper.

### Prompt template JSON import/export (Pass 231)

Templates are now portable. The **Export** button in the Templates
popover footer dumps user templates (built-ins are skipped — they're
re-hydrated on load from code) as a `{version, templates}` JSON
wrapper. The **Import** button reverses the flow: it parses either
the wrapper or a bare array (matching the localStorage format),
strips any `builtin: true` overrides for safety, and prompts the
user to merge (dedupe by `name + body`) or replace (keep built-ins,
swap user templates).

This closes the team-sharing loop — you can now email a templates
file to a teammate and they can drop it straight into their Code
Chat without any manual recreation. 3+5+5 unit tests cover
export/parse/import with all edge cases.

## Known limitations

- **No OAuth flow.** Path A uses a pasted PAT stored in
  `integration_connections`. A proper GitHub OAuth App flow would land
  cleanly behind the existing `ResolvedGitHubCredentials` type but is
  not yet implemented.
- **No commit signing.** Commits use the token's default identity; no
  GPG signing is supported.
- **In-memory job store.** Background jobs do not survive server
  restarts. This is intentional — the surface is for developer-tool
  workloads, not persistent workflow state. A `code_chat_jobs` table
  would slot behind the same API if persistence becomes a requirement.
- **Heuristic autonomous planner.** The built-in `startAutonomousJob`
  runner emits a single exploration subtask then stops. Wiring a real
  LLM planner is a one-line change inside the `subtaskPlanner` /
  `toolPlanner` callbacks but isn't done here to keep the primitive
  honest without a live API key.
