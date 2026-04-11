# Code Chat — User Guide

Stewardly's **Code Chat** is a Claude-Code-style conversational coding
agent embedded in the app. It can read, search, edit, run, and reason
about your workspace, mirror Claude Code's terminal experience inside
the browser, and persist context across sessions.

> Where to find it: `/code-chat` in the Stewardly app sidebar.
> Admin-gated for write tools (file edits, bash); read tools work for
> any authenticated user.

This guide covers everything: tools, slash commands, keyboard
shortcuts, panels, settings, and the design behind each piece.

---

## Quick start

1. Open `/code-chat`.
2. Type a question (`how does the lead pipeline scoring work?`) and
   press Enter. The agent reads, greps, and summarises automatically.
3. Want a multi-step plan first? Type `/plan rename getCwd to
   getCurrentWorkingDirectory across the project` — the agent emits
   a numbered plan you can edit and approve before it executes.
4. Press `?` for the keyboard shortcuts overlay any time.
5. Press `Ctrl/Cmd+K` for the action palette (every command in one
   fuzzy search).

---

## Tools (12)

The agent has access to twelve tools. Read tools work in any session;
write tools require admin + write mode (`/write on`).

| Tool             | Kind     | Description                                                                 |
|------------------|----------|-----------------------------------------------------------------------------|
| `read_file`      | read     | Read up to 256KB of a workspace file.                                       |
| `multi_read`     | read     | Batch-read up to 10 files in one call (saves LLM round-trips).              |
| `list_directory` | read     | List files + directories at a path.                                         |
| `grep_search`    | read     | Pattern search across the workspace via ripgrep.                            |
| `glob_files`     | read     | Find files by glob (e.g. `src/**/*.tsx`); brace + negation + character classes. |
| `find_symbol`    | read     | Jump to a function/class/interface/type definition by name.                 |
| `web_fetch`      | read     | Fetch an allowlisted URL → HTML-to-text. SSRF-safe.                         |
| `web_search`     | read     | Tavily → Brave → Google → LLM cascade for fresh search results.             |
| `update_todos`   | progress | Stream a live todo list to the UI mid-execution.                            |
| `write_file`     | write    | Create or overwrite a file (admin + `/write on`).                           |
| `edit_file`      | write    | Find/replace a unique substring inside a file.                              |
| `run_bash`       | write    | Run a shell command (30s timeout, denylist-filtered).                       |

Open the **Tool Permissions** popover (shield icon, top-right of the
chat configuration bar) to narrow the active set per session.

---

## Slash commands

Type `/` at the start of the input to open the slash popover. Tab
or Enter selects.

| Command         | Aliases           | What it does                                                                  |
|-----------------|-------------------|--------------------------------------------------------------------------------|
| `/clear`        | `/c`              | Clear the chat history (keeps command history).                               |
| `/cancel`       | `/stop`, `/abort` | Abort the currently running ReAct loop.                                       |
| `/help`         | `/h`, `/?`        | List every slash command in a toast.                                          |
| `/write on\|off`| `/w`              | Toggle write mode (admin only).                                               |
| `/iterations N` | `/iter`, `/i`     | Set max ReAct iterations (1–10).                                              |
| `/model <id>`   | `/m`              | Override the model for the next message; empty arg clears.                    |
| `/diff <path>`  |                   | Ask the agent to diff a file against the last commit.                         |
| `/explain <p>`  | `/e`              | Ask the agent to explain a file's purpose.                                    |
| `/find <p>`     | `/grep`, `/search`| Pattern search across the codebase.                                           |
| `/compact [n]`  |                   | Summarise older turns into one synthetic message; keeps `n` recent (default 4). |
| `/plan <task>`  | `/p`              | Generate a numbered plan, review/edit it inline, then approve to execute.     |
| `/undo`         | `/u`              | Revert the most-recent edit from the history ring buffer.                     |
| `/redo`         | `/r`              | Re-apply the most-recently undone edit.                                       |
| `/remember <f>` | `/mem`            | Save a fact to long-term agent memory.                                        |

---

## Keyboard shortcuts

### Global
| Keys                  | Action                                 |
|-----------------------|----------------------------------------|
| `Ctrl/Cmd+K`          | Open the action palette (one-stop ⌘K). |
| `Ctrl/Cmd+T`          | Open the symbol navigator (Go to Symbol). |
| `Ctrl+R` / `Cmd+R`    | Reverse-i-search over command history. |
| `?`                   | Open the keyboard shortcuts overlay.   |
| `Esc`                 | Cancel a running loop / close popovers. |

### Edit history
| Keys             | Action                                 |
|------------------|----------------------------------------|
| `Ctrl/Cmd+Z`     | Undo most-recent edit (also `/undo`).  |
| `Ctrl/Cmd+Shift+Z` | Redo most-recent undone edit (also `/redo`). |

### Vim-style chord shortcuts (press `g`, then within 1.5s:)
| Chord  | Action          |
|--------|-----------------|
| `g c`  | Go to Chat tab  |
| `g f`  | Go to Files tab |
| `g r`  | Go to Roadmap tab |
| `g d`  | Go to Diff tab  |
| `g h`  | Go to GitHub tab |
| `g w`  | Go to Git Write tab |
| `g j`  | Go to Jobs tab  |

---

## @file mentions

Type `@` followed by a fuzzy filename and Code Chat opens a popover
of matching workspace files. Press Tab/Enter to insert the path. The
file's contents are auto-resolved server-side and inlined into the
prompt as context — saving the agent a `read_file` round-trip.

You can also **pin** files via the Files tab → ⋯ → Pin, and pinned
files are auto-prepended to every send so you don't need to keep
typing `@`.

---

## Plan mode

Use `/plan <task>` to enter Plan Mode. The agent:

1. Generates a numbered list of concrete, testable steps.
2. Renders an interactive review panel where you can:
   - Edit step descriptions inline
   - Reorder steps with ↑/↓
   - Add or remove steps
   - Mark steps to skip
3. Press **Approve & Execute** to run the plan. The ReAct loop expands
   `maxIterations` to match step count.

Plans persist to localStorage so they survive page refreshes.

---

## Long-term agent memory

The agent maintains a per-device memory store of facts that get
prepended to the system prompt on every send. Categories: project,
preference, fact, warning. Manage via:

- The **Brain** button in the chat config bar.
- The `/remember <fact>` slash command for quick adds.
- Long-press an existing entry to edit/delete.

The store is capped at 200 entries with newest-first ordering and
8KB hard cap on the system-prompt overlay.

---

## CLAUDE.md auto-loading

On every send, Code Chat looks for these project instruction files
in the workspace root and injects them into the system prompt:

1. `.stewardly/instructions.md` — Stewardly-specific override
2. `CLAUDE.md` — Claude Code convention
3. `AGENTS.md` — alternative agent convention

Each file is capped at 32KB. Toggle the loader off via the **Rules**
button in the config bar. Click it to see which files were loaded
this session and a 512-char preview.

---

## Sessions library

The **Sessions** button opens a library of saved conversations. You
can:

- **Save** the current conversation manually
- **Auto-checkpoint** every 4 messages (silent, behind the scenes)
- **Load** a previous session into the live hook
- **Tag** sessions for filtering
- **Search** across every saved session's full text
- **Fork** an assistant message into a new session
- **Import / Export** the entire library as JSON

Cap: 50 sessions, oldest dropped on overflow.

---

## Scratchpad

Open the **Notes** drawer (right side, desktop only) for a
persistent free-form notepad that survives across sessions. Use it
to stash file paths, exploratory prompts, multi-step instructions
you'll feed in piece by piece.

Capped at 200KB; meter turns amber at 50% and red at 80%. The
"Send selection" button pipes the highlighted region into the chat
input with smart newline spacing.

---

## Git + GitHub

| Tab           | What you can do                                                          |
|---------------|--------------------------------------------------------------------------|
| **Files**     | Tree + flat browser; inline editor with diff preview (admin).            |
| **Diff**      | Word-diff visualizer of pending changes.                                 |
| **Git Status**| Live `git status --porcelain` view + per-file diff against HEAD.         |
| **Git Write** | Multi-repo picker, branches, commit & push, create PR, merge PR.         |
| **GitHub**    | Read-side: status, open PRs, raw file viewer.                            |
| **Imports**   | Workspace import dependency graph + hot-files leaderboard + circular dep detector. |
| **TODOs**     | Project-wide TODO/FIXME/HACK/XXX scanner with severity badges.           |
| **Roadmap**   | Persisted roadmap items with priority + status tracking.                 |
| **Jobs**      | Background autonomous coding jobs (admin start; live polling).           |

---

## Cost + budget controls

The config bar shows a live cost pill: `123 tokens · $0.0123`. Click
to set a per-session USD limit. Three states:

- **Green** — under the warn threshold (default 50% of limit)
- **Amber** — between warn and hard limit
- **Red (blocked)** — at or over the hard limit; new sends are blocked

Pair with the **Stats** button to see the full session bill of
materials: per-model breakdown, top expensive turns, tool usage,
bytes I/O ratio, and per-turn latency p50/p95/p99 histogram.

---

## Streaming + tool visibility

Every tool call streams a `tool_start` and `tool_result` event over
SSE. The UI shows:

- A live trace strip under the assistant message with per-step
  duration + tool name
- Diff previews inline for `edit_file`/`write_file`
- Grep result quick-jump (click any hit to open in the file viewer)
- Live todo panel via `update_todos` for multi-step tasks
- Mid-execution abort via `Esc` or the X button

---

## Privacy + safety

- **Sandboxed paths** — every file operation is bounds-checked
  against the workspace root. Path-escape attempts return
  `OUT_OF_BOUNDS` errors.
- **Bash denylist** — destructive patterns (`rm -rf /`, fork bombs,
  `mkfs`, `dd if=/dev/zero`, `shutdown`) are blocked before exec.
- **Web fetch allowlist** — `web_fetch` only contacts a curated
  set of doc / vendor / regulatory hosts. Localhost, private IPs,
  AWS metadata endpoint, and `data:`/`file:` schemes are refused.
- **Markdown XSS hardening** — all rendered links/images go through
  a strict URL filter (only http/https/mailto/tel/anchor + relative;
  no javascript:/data:/blob:/file:; SVG images blocked because they
  carry scripts).
- **Per-tool permissions** — narrow the active tool set per session
  via the Shield popover. Mutations always require admin + write mode
  regardless of the toggle state.

---

## Build-loop changelog

The Code Chat surface is built incrementally — see the **Build Loop
Pass Log** at the bottom of `docs/PARITY.md` for a row-by-row history
of every pass and what shipped.
