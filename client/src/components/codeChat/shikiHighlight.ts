/**
 * shikiHighlight — lazy-loaded Shiki highlighter for Code Chat
 * code blocks (Pass 207).
 *
 * Shiki is ~1MB of JS + WASM for the themes/grammars, so we
 * dynamically import it on first use and cache the highlighter
 * singleton. Pre-loaded languages match the stack this app actually
 * writes code in + a handful of common companions.
 *
 * Returns HTML (trusted shiki output) or null on failure — callers
 * fall back to the plain `<code>` render.
 *
 * Pass v5 #81: transient import failures (flaky network, CDN hiccup)
 * no longer poison the session. When the inner factory resolves to
 * null, we reset the cached promise so the next call retries, capped
 * at MAX_RETRIES attempts to avoid storming a broken endpoint.
 * Pass v5 #82: expanded BUNDLED_LANGS to cover Dockerfile, GraphQL,
 * HCL, Prisma, Proto, Nginx, Vue, Svelte.
 */

type Highlighter = {
  codeToHtml: (
    code: string,
    opts: { lang: string; theme: string },
  ) => string;
};

let _highlighter: Promise<Highlighter | null> | null = null;
let _retryCount = 0;
const MAX_RETRIES = 3;
let _failureToastedThisPageLoad = false;

/** Optional hook for callers (MarkdownMessage) to surface a one-time
 *  toast. Set via `setShikiFailureNotifier()`. */
let _failureNotifier: (() => void) | null = null;

export function setShikiFailureNotifier(fn: (() => void) | null): void {
  _failureNotifier = fn;
}

/**
 * Test-only hook so unit tests can inject a stubbed highlighter
 * factory without poking at the dynamic `import("shiki")` call. The
 * factory receives the bundled langs and theme name and is expected
 * to return a Highlighter (or throw to simulate a load failure).
 */
type HighlighterFactory = () => Promise<Highlighter>;
let _factoryOverride: HighlighterFactory | null = null;

export function __setShikiFactoryForTests(
  factory: HighlighterFactory | null,
): void {
  _factoryOverride = factory;
}

const BUNDLED_LANGS = [
  "ts",
  "tsx",
  "js",
  "jsx",
  "json",
  "bash",
  "shell",
  "sql",
  "python",
  "go",
  "rust",
  "yaml",
  "html",
  "css",
  "diff",
  "markdown",
  "java",
  "kotlin",
  "swift",
  "ruby",
  "php",
  // Pass v5 #82
  "dockerfile",
  "graphql",
  "hcl",
  "prisma",
  "proto",
  "nginx",
  "vue",
  "svelte",
] as const;

const LANG_ALIASES: Record<string, string> = {
  typescript: "ts",
  javascript: "js",
  py: "python",
  sh: "bash",
  zsh: "bash",
  md: "markdown",
  yml: "yaml",
  rs: "rust",
  rb: "ruby",
  // Pass v5 #82 aliases
  docker: "dockerfile",
  gql: "graphql",
  terraform: "hcl",
  tf: "hcl",
  protobuf: "proto",
};

const DARK_THEME = "github-dark-dimmed";

/**
 * Reset the cached highlighter state. Exposed for tests; production
 * code relies on the automatic retry path inside `getHighlighter`.
 */
export function __resetShikiForTests(): void {
  _highlighter = null;
  _retryCount = 0;
  _failureToastedThisPageLoad = false;
}

/**
 * Lazy-initialize the Shiki highlighter. Uses the `createHighlighter`
 * bundled-languages API so we don't pay for all 200+ Shiki grammars.
 *
 * Pass v5 #81: after a transient failure, we reset the cached promise
 * so the next call retries. A max-retries counter prevents a retry
 * storm against a persistently broken endpoint. A one-time toast is
 * shown via `_failureNotifier` so the user knows highlighting will
 * auto-retry on the next code block.
 */
async function getHighlighter(): Promise<Highlighter | null> {
  if (_highlighter) return _highlighter;
  if (_retryCount >= MAX_RETRIES) return null;
  _highlighter = (async () => {
    try {
      if (_factoryOverride) {
        return await _factoryOverride();
      }
      const shiki = await import("shiki");
      const hl = await shiki.createHighlighter({
        themes: [DARK_THEME],
        langs: BUNDLED_LANGS as unknown as string[],
      });
      return hl as Highlighter;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[codeChat] shiki highlighter failed to load:", err);
      return null;
    }
  })();
  const resolved = await _highlighter;
  if (resolved === null) {
    // Pass v5 #81: reset the cached promise so the next call retries.
    _highlighter = null;
    _retryCount += 1;
    if (!_failureToastedThisPageLoad && _failureNotifier) {
      _failureToastedThisPageLoad = true;
      try {
        _failureNotifier();
      } catch {
        /* notifier is best-effort */
      }
    }
  }
  return resolved;
}

export function normalizeLanguage(lang: string | undefined): string {
  if (!lang) return "text";
  const lower = lang.toLowerCase();
  const aliased = LANG_ALIASES[lower] ?? lower;
  return (BUNDLED_LANGS as readonly string[]).includes(aliased)
    ? aliased
    : "text";
}

/**
 * Highlight a code block. Returns the Shiki-produced HTML string on
 * success, or null if the highlighter is unavailable / the language
 * isn't in the pre-loaded set. Callers should render null results as
 * plain text.
 */
export async function highlightCode(
  code: string,
  lang: string | undefined,
): Promise<string | null> {
  const normalized = normalizeLanguage(lang);
  if (normalized === "text") return null;
  try {
    const hl = await getHighlighter();
    if (!hl) return null;
    return hl.codeToHtml(code, { lang: normalized, theme: DARK_THEME });
  } catch {
    return null;
  }
}
