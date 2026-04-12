# Automation Subsystem

Scope: AI chat + agentic capabilities including browser / device / other
automation. This subsystem is the foundation Stewardly will build on to
excel beyond Claude, Manus, and comparable agent platforms.

Status as of **pass 7** of the hybrid build loop (commit `615e51b`):

- 391 tests passing across the automation surface
- 5 code-chat agent tools exposed: `web_read`, `web_extract`, `web_crawl`,
  `web_search`, plus the supporting file/grep/symbol/bash tools from the
  existing Code Chat stack
- End-to-end observability: per-step telemetry events fan out through a
  pluggable bus, stream to admin clients over SSE, and render in the
  `AutomationActivityStrip` live panel

For the ongoing list of open capability gaps (and which passes closed
which), see [`docs/PARITY.md`](./PARITY.md).

## Architecture

```
┌─────────────────────────────── Code Chat Agent (LLM) ─────────────────┐
│                                                                        │
│  ReAct loop →  dispatchCodeTool(call)                                  │
│                      │                                                 │
│                      ▼                                                 │
│          ┌───────────────────────────────┐                             │
│          │  codeChatExecutor dispatch    │                             │
│          └──┬────────┬────────┬──────────┘                             │
│             │        │        │                                       │
│             ▼        ▼        ▼                                       │
│       web_read  web_extract  web_crawl  web_search                     │
│             │        │        │             │                         │
│             └────────┴────┬───┘             │                         │
│                           │                 │                         │
│                           ▼                 ▼                         │
│                   ┌───────────────┐   ┌──────────────┐                 │
│                   │ WebNavigator  │   │ webSearchTool │                │
│                   │  singleton    │   │ Tavily/Brave/ │                │
│                   │ (webTool.ts)  │   │ Manus/LLM     │                │
│                   └───────┬───────┘   └──────────────┘                 │
│                           │                                           │
│           ┌───────────────┼───────────────┬─────────────┬───────────┐  │
│           ▼               ▼               ▼             ▼           ▼  │
│    ResponseCache   RobotsChecker   PageFetcher   RateLimiter   Telemetry│
│    (LRU + ETag)    (robots.txt)    (fetch API)   (token       sink     │
│                                                   bucket)     (bus)    │
│                                                                │       │
└────────────────────────────────────────────────────────────────┼───────┘
                                                                 │
                                                                 ▼
                                           ┌────────────────────────────┐
                                           │  AutomationTelemetryBus    │
                                           │  (global singleton)        │
                                           └──┬─────────────────────────┘
                                              │
                                              ▼
                                           ┌────────────────────────────┐
                                           │ /api/automation/telemetry/ │
                                           │         stream  (SSE)      │
                                           └──┬─────────────────────────┘
                                              │
                                              ▼
                                           ┌────────────────────────────┐
                                           │ useAutomationTelemetry     │
                                           │ Stream (React hook) →      │
                                           │ AutomationActivityStrip    │
                                           └────────────────────────────┘
```

## Primitives

All automation primitives live under `server/shared/automation/` so
they can be reused by any server service, not only code chat.

### 1. `webNavigator.ts` (pass 1)

Pure-TypeScript, fetch-based URL reader. No headless browser. Exposes:

- `WebNavigator` class with `fetchPage(url)` and `readPage(url)` methods.
- Pluggable `PageFetcher` adapter interface — the default implementation
  wraps global `fetch`. A future Playwright adapter can slot in without
  touching callers.
- SSRF defense: private-IP hosts (loopback, RFC 1918, link-local,
  `.local`, `.internal`) are refused before any network call.
- Host allow/deny lists (suffix match).
- Per-domain token-bucket rate limiter (default 30 req/min).
- Response size cap (default 2 MB).
- Navigation history log.

Parsed output (`PageView`) contains title, description, canonical URL,
language, visible text, headings (level + text), links (href + text +
nofollow), images (src + alt), and forms (action + method + fields).

### 2. `webExtractor.ts` (pass 2)

Schema-guided structured extraction on top of `PageView`. The agent
supplies a schema like:

```ts
{
  title: { selector: "title" },
  price: { selector: "regex:\\$([0-9,]+(?:\\.[0-9]+)?)", type: "number" },
  sections: { selector: "h2", type: "string[]" },
  limits: { selector: "table", type: "table[]" }
}
```

and gets back a typed object. Supported selectors:

| Selector | Returns |
| --- | --- |
| `title` / `description` / `text` | PageView metadata |
| `h1`..`h6` / `heading` | Headings |
| `link` / `links` | Anchor hrefs + text |
| `image` / `images` | Image src + alt |
| `form` / `forms` | Form action + method + field count |
| `table` / `tables` | Structured `{headers, rows}` |
| `regex:<PATTERN>` | Capture-group-1 matches |
| `css:<TAG>` | Inner text of named HTML tag |

Supported types: `string`, `string[]`, `number`, `number[]`, `boolean`,
`date`, `url`, `url[]`, `table`, `table[]`.

Schema validation runs up-front via `validateSchema()`.

### 3. `robotsPolicy.ts` (pass 2)

Minimal robots.txt parser + `RobotsChecker` with a TTL-cached per-host
policy store. Implements the REP subset most sites actually use:

- Per-`User-agent` groups with `*` fallback
- `Allow:` / `Disallow:` with wildcards + `$` anchor
- Google's longest-match rule resolution
- `Crawl-delay:` hints
- `Sitemap:` extraction

Enabled by default on `WebNavigator` singletons (toggle with
`WEB_TOOL_HONOR_ROBOTS=false`). Blocked URLs throw
`NavigationError` with `code: "BLOCKED_BY_ROBOTS"`.

### 4. `responseCache.ts` (pass 3)

LRU + ETag + stale-while-revalidate HTTP response cache.

- `lookup(url)` returns `miss` | `hit-fresh` | `hit-stale`.
- `absorbResponse(url, res)` stores 2xx responses respecting
  `Cache-Control` / `Expires` / `ETag` / `Last-Modified`. Refuses
  `no-store` and non-2xx.
- 304 Not Modified responses refresh `fetchedAt` on the existing entry.
- `buildRevalidationHeaders(url)` produces `If-None-Match` +
  `If-Modified-Since` for conditional GETs.
- Pure w.r.t. a virtual clock for deterministic unit tests.

`WebNavigator` calls the cache in this order: lookup → fresh-hit
short-circuit → robots check → rate limit → adapter fetch → absorb →
emit telemetry.

### 5. `crawlSession.ts` (pass 4)

Bounded BFS over any `PageReader`-shaped object. Caps:

- `maxPages` default 10, hard cap 100
- `maxDepth` default 2, hard cap 5
- Same-origin by default
- Allow-host suffix list when crossing origins
- Regex include/exclude filters
- Canonicalizing dedupe (strip fragment, trim trailing slash, sort
  query params) so `/x`, `/x/`, `/x#foo`, `/x?b=2&a=1`, `/x?a=1&b=2`
  all collapse to a single visit
- SSRF hardening: refuses `javascript:`, `file:`, `data:` and other
  non-http(s) schemes at enqueue time
- `onPage` callback for streaming; swallows callback errors so a bad
  sink can't halt the crawl

### 6. `automationTelemetry.ts` (pass 5)

Fan-out event bus for `NavigationTelemetryEvent`. Multiple sinks
(OTel, SSE, logs) subscribe to the same underlying events. Features:

- `subscribe(fn, { types })` with event-type filter
- `subscribeOnce(fn)` auto-unsubscribes after first event
- Ring buffer (`snapshot(n)`) for debug inspection
- Swallows both sync throws and async rejections from sinks so bad
  downstream code can't break navigation

Process-global singleton via `getAutomationTelemetryBus()`.

## Agent Tools

The following tools are exposed to the Code Chat ReAct loop via
`CODE_CHAT_TOOL_DEFINITIONS` in `server/services/codeChat/codeChatExecutor.ts`:

| Tool | Since | Mutation | Role gate | Description |
| --- | --- | --- | --- | --- |
| `web_read` | pass 1 | no | all | Fetch URL → structured `PageView` |
| `web_extract` | pass 2 | no | all | Fetch URL + schema-guided extraction |
| `web_crawl` | pass 4 | no | all | Bounded BFS crawl (max 100 pages / depth 5) |
| `web_search` | pass 5 | no | all | Cascading search (Tavily → Brave → Manus → LLM) |

All four are on the server's `READ_ONLY_TOOLS` allow-list so non-admin
users get them by default. Clients can narrow with the
`ToolPermissionsPopover` (admin can also toggle the write tools).

## HTTP Surfaces

### `POST /api/codechat/stream`

Existing Code Chat ReAct streaming endpoint. The new web_* tools
dispatch through the standard tool pipeline — no route changes needed
beyond the `READ_ONLY_TOOLS` allowlist.

### `GET /api/automation/telemetry/stream` (pass 6)

Server-Sent Events endpoint that subscribes each client to the global
`AutomationTelemetryBus`. Admin-only. Query params:

- `types=request.network,request.blocked` — event-type filter
- `replay=20` — emit last N events from the ring buffer on connect

Emits a `__hello` envelope as the first frame so the client knows the
connection is alive. Heartbeats every 15s. Always cleans up the bus
subscription + heartbeat interval on client disconnect.

## Client UI

### `useAutomationTelemetryStream` (pass 7)

React hook at `client/src/hooks/useAutomationTelemetryStream.ts`.
Handles EventSource lifecycle, exponential-backoff reconnect
(1s → 2s → 4s → 8s → 16s → 30s cap), and a ring buffer. Returns
`{events, connected, error, reconnectAttempt, clear}`.

### `AutomationActivityStrip` (pass 7)

Compact collapsible panel at
`client/src/components/codeChat/AutomationActivityStrip.tsx`. Shows
the most recent events newest-first with per-type icon + color,
header counts for net/cache/blocked/error, connection badge, clear
button. `role="log" aria-live="polite"` so screen readers announce
new entries as the agent works. Toggle from the Code Chat config bar
via the Globe button.

## Environment Variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `WEB_TOOL_ALLOW_HOSTS` | _(unset)_ | Comma-separated host suffixes allowed |
| `WEB_TOOL_DENY_HOSTS` | _(unset)_ | Comma-separated host suffixes denied |
| `WEB_TOOL_RATE_LIMIT_PER_MIN` | `30` | Per-domain request budget |
| `WEB_TOOL_MAX_BYTES` | `2000000` | Per-response size cap (bytes) |
| `WEB_TOOL_HONOR_ROBOTS` | `true` | Set to `false` to disable robots.txt checks |
| `WEB_TOOL_CACHE` | `true` | Set to `false` to disable response caching |
| `WEB_TOOL_CACHE_MAX_ENTRIES` | `256` | LRU cache size |
| `WEB_TOOL_CACHE_MAX_AGE_MS` | `300000` | Default max-age when server omits Cache-Control |
| `WEB_TOOL_CACHE_STALE_MS` | `600000` | Default stale-while-revalidate window |
| `WEB_TOOL_TELEMETRY` | `true` | Set to `false` to disable the bus sink |

## Extension Points

### Adding a new read adapter (e.g. Playwright)

Implement the `PageFetcher` interface from `webNavigator.ts`:

```ts
import type { PageFetcher } from "./webNavigator";

export class PlaywrightAdapter implements PageFetcher {
  async fetch(url: string, opts: { headers, timeoutMs }) {
    const page = await this.browser.newPage();
    await page.setExtraHTTPHeaders(opts.headers);
    const response = await page.goto(url, { timeout: opts.timeoutMs });
    const body = await page.content();
    return {
      status: response.status(),
      finalUrl: page.url(),
      headers: response.headers(),
      body,
      bytes: new TextEncoder().encode(body).length,
      truncated: false,
      redirects: response.request().redirectChain().length,
    };
  }
}
```

Then wire it into `webTool.ts`:

```ts
const nav = new WebNavigator({
  ...buildNavigatorConfigFromEnv(),
  adapter: new PlaywrightAdapter(),
});
```

No changes to `webExtractor`, `crawlSession`, or any agent tool are
required — they all depend on the `PageView` shape only.

### Adding a new agent tool

1. Add the new case to `CodeToolName` + `CodeToolResult` in
   `codeChatExecutor.ts`.
2. Add a `case` to `dispatchCodeTool`.
3. Add an entry to `CODE_CHAT_TOOL_DEFINITIONS`.
4. Add a branch to `summarizeStep` in `autonomousCoding.ts`.
5. Add to `READ_ONLY_TOOLS` in `codeChatStream.ts` if it's safe for
   non-admin users.
6. Add a `ToolSpec` + `DEFAULT_ENABLED_TOOLS` entry in
   `ToolPermissionsPopover.tsx`.
7. Bump the tool count badge in `CodeChat.tsx` (`N/12 → N/13`).
8. Write dispatcher tests in `codeChat.test.ts`.

A future pass should consolidate these into a single catalog
manifest so new tools only require editing one file.

## Open Gaps

See [`docs/PARITY.md`](./PARITY.md) for the full gap matrix. The
currently-open highest-value items are:

- **G7** — Playwright adapter for JS-rendered pages
- **G9** — DOM click/type/scroll action layer
- **G10** — Form-filling with schema detection
- **G11** — Multi-tab session state
- **G14** — Computer-use vision loop (screenshot → plan → click)
- **G19** — Multi-agent browser orchestration

These are the gaps the next several build-loop passes will target.
