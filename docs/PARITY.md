## Parity Matrix — AI Chat & Agentic Automation

Scope: Optimize AI chat and agentic capabilities (browser/device/other automation)
to achieve and excel beyond Claude, Manus, and other top comparables.

This file is the **two-way sync doc** between the build loop and parallel
assessment processes. Rows describe a capability gap vs. top comparables,
current depth (0=missing → 10=parity+), and status. When a row is closed,
record the commit SHA.

Protected improvements (never weaken) and Known-Bad (dead ends) are at the
bottom. The Build Loop Pass Log at the very bottom is append-only.

## Gap Matrix

| ID  | Capability                                                 | Comparable                | Before | After | Status       | Owner   | Commit(s)        |
| --- | ---------------------------------------------------------- | ------------------------- | -----: | ----: | ------------ | ------- | ---------------- |
| G1  | Fetch + read a URL without a headless browser (read-only)  | Manus browser_read        |      0 |     5 | done · P1    | build   | pass-1           |
| G2  | Extract structured page view (title/text/links/headings)   | Claude computer-use read  |      0 |     5 | done · P1    | build   | pass-1           |
| G3  | Per-domain rate limiting for outbound fetches              | defensive infra           |      0 |     5 | done · P1    | build   | pass-1           |
| G4  | Allow/deny domain list for browser-read tool               | security ceiling          |      0 |     5 | done · P1    | build   | pass-1           |
| G5  | Navigation history record (back/forward trace)             | browser-use               |      0 |     4 | done · P1    | build   | pass-1           |
| G6  | Pluggable page-fetcher adapter (fetch → future playwright) | future-proofing           |      0 |     3 | done · P1    | build   | pass-1           |
| G7  | Headless browser (Playwright) adapter for JS-rendered pgs  | Claude computer-use       |      0 |     0 | open         |         |                  |
| G8  | Visual screenshot + OCR for vision-driven clicks           | Claude computer-use       |      0 |     0 | open         |         |                  |
| G9  | DOM click/type/scroll action layer                         | Manus automate_browser    |      0 |     0 | open         |         |                  |
| G10 | Form-filling with schema detection                         | AutoGPT / Manus           |      0 |     0 | open         |         |                  |
| G11 | Multi-tab session state                                    | browser-use               |      0 |     0 | open         |         |                  |
| G12 | Cookies + auth hand-off from user session                  | browser-use               |      0 |     0 | open         |         |                  |
| G13 | Device-automation shell (mobile/desktop UI automation)     | Manus / ADB               |      0 |     0 | open         |         |                  |
| G14 | Computer-use vision loop (screenshot→plan→click)           | Claude computer-use       |      0 |     0 | open         |         |                  |
| G15 | Structured data extraction (schema-guided LLM)             | LlamaExtract / Manus      |      0 |     0 | open         |         |                  |
| G16 | Download files from navigated page                         | browser-use               |      0 |     0 | open         |         |                  |
| G17 | Browser-tool telemetry (step-level spans, timings)         | observability             |      0 |     0 | open         |         |                  |
| G18 | Agent replay of browser sessions                           | Manus replay              |      0 |     0 | open         |         |                  |
| G19 | Multi-agent browser orchestration                          | AutoGen / Manus           |      0 |     0 | open         |         |                  |
| G20 | Compliance guardrails on web-retrieved content             | Stewardly-specific        |      0 |     0 | open         |         |                  |
| G21 | Chat agent exposes `web_read` tool end-to-end              | parity w/ Manus chat      |      0 |     5 | done · P1    | build   | pass-1           |
| G22 | Chat agent exposes `web_extract` structured extraction     | parity w/ Manus chat      |      0 |     6 | done · P2    | build   | pass-2           |
| G23 | SSE streaming of browser events to UI                      | Claude computer-use UI    |      0 |     0 | open         |         |                  |
| G24 | Browser read result caching with ETag/stale-while-revalid  | performance               |      0 |     0 | open         |         |                  |
| G25 | Robots.txt honoring                                        | defensive infra           |      0 |     6 | done · P2    | build   | pass-2           |

Legend: `open` = not started; `in-progress` = under active work by build or
parallel process; `done · P<N>` = shipped in pass N. Depth scores are rough
self-assessments, 0=missing, 5=usable parity, 10=exceeds comparables.

## Protected Improvements

These are load-bearing upgrades the build loop has shipped in this chat that
must not be weakened by any subsequent pass (this applies to every parallel
process reading PARITY.md, not just next-pass-self).

- **webNavigator service** — pass 1. Pure-TS, fetch-based URL reader with
  domain allow/deny lists + per-domain rate limiting + HTML → PageView
  extraction + pluggable adapter interface. File:
  `server/shared/automation/webNavigator.ts`. Tests:
  `server/shared/automation/webNavigator.test.ts`. Do not inline an HTTP
  library, do not drop the adapter interface, do not remove rate limits.
- **webExtractor service** — pass 2. Schema-guided structured extraction
  over PageView. Supports `title`/`description`/`h1..h6`/`heading`/`link`/
  `image`/`form`/`table`/`regex:`/`css:` selectors with string|number|
  date|url|boolean|table coercion. File: `server/shared/automation/
  webExtractor.ts`. Do not collapse into webNavigator, do not drop
  schema validation.
- **robotsPolicy service** — pass 2. REP parser + RobotsChecker with a
  TTL-cached per-host policy store. WebNavigator honors policy decisions
  when given a checker. File: `server/shared/automation/robotsPolicy.ts`.
  Do not remove the `honorRobots` default-true path.

## Known-Bad

Dead ends future passes should not re-attempt without new evidence.

_(empty — populate as the loop discovers them)_

## Reconciliation Log

Conflicts between build-loop writes and parallel process writes get logged
here with the resolution rationale. Resolved by evidence recency + git log.

_(empty)_

## Build Loop Pass Log

Append-only log of what each pass accomplished. Format:
`Pass N · angle · queue · commit SHA · items completed · items deferred`

- Pass 1 · correctness-first · [bootstrap PARITY + G1..G6, G21] · 8baaeed · webNavigator service + 30 tests + code_web_read tool + client popover entry · deferred: G7 (playwright adapter), G9 (click/type layer), G22 (web_extract schema-guided), G25 (robots.txt)
- Pass 2 · graceful-degradation + input-validation · [G22, G25, G20 partial] · (pending commit) · webExtractor + robotsPolicy + code_web_extract tool + robotsChecker wired into WebNavigator + 35 new tests · deferred: G7 (playwright), G9 (click/type), G23 (SSE streaming of browser events), G17 (OTel spans for automation)
