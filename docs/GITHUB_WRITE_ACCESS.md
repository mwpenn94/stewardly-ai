# GitHub Write Access & Background Jobs (Pass 201)

Stewardly's Code Chat now ships full Claude-Code-style GitHub cloud parity:

- **Read** — repository metadata, open PRs, file contents at any ref
- **Write** — list repos, create/delete branches, atomic multi-file commits,
  create/update/merge pull requests
- **Background** — long-running autonomous sessions and fire-and-forget
  GitHub push jobs with cooperative-cancel + per-user concurrency caps
- **Terminal UI** — streaming tool visualization + inline file editing in
  the admin workspace file browser

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
