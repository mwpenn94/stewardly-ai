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
 */

type Highlighter = {
  codeToHtml: (
    code: string,
    opts: { lang: string; theme: string },
  ) => string;
};

let _highlighter: Promise<Highlighter | null> | null = null;

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
};

const DARK_THEME = "github-dark-dimmed";

/**
 * Lazy-initialize the Shiki highlighter. Uses the `createHighlighter`
 * bundled-languages API so we don't pay for all 200+ Shiki grammars.
 * Cached forever after the first call.
 */
async function getHighlighter(): Promise<Highlighter | null> {
  if (_highlighter) return _highlighter;
  _highlighter = (async () => {
    try {
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
  return _highlighter;
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
