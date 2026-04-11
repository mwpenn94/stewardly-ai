# Code Chat Cloud Parity (Passes 201-211)

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
