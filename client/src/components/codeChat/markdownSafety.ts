/**
 * Markdown safety helpers — Build-loop Pass 7 (G20 XSS audit).
 *
 * The Code Chat agent ingests untrusted content (file contents, grep
 * results, web_fetch HTML, web_search snippets) and pipes it through
 * MarkdownMessage. react-markdown@10 ships a `defaultUrlTransform`
 * that already blocks `javascript:` URLs, but we layer additional
 * protection on top:
 *
 *   1. **Stricter URL allowlist.** Only relative URLs and the
 *      explicit set of safe protocols (`https`, `http`, `mailto`,
 *      `tel`, anchor `#`) survive. `data:`, `vbscript:`, `blob:`,
 *      `file:`, and any proprietary scheme are dropped.
 *
 *   2. **Link prop filter.** When react-markdown spreads `{...props}`
 *      onto an `<a>`, the spread can include unwanted hast attributes
 *      (`title` is fine; future plugins might inject others). Pass
 *      props through `safeLinkProps` to keep only the known-safe
 *      attribute set.
 *
 *   3. **Image src filter.** Same urlTransform handles `<img>` src;
 *      this module's `safeImageSrc` adds an explicit final-mile check
 *      so `data:` images can be opted in by the caller if needed.
 *
 * These functions are pure — easy to unit-test against payloads that
 * try common XSS vectors.
 */

const ALLOWED_LINK_PROTOCOLS = new Set([
  "http",
  "https",
  "mailto",
  "tel",
]);

/**
 * Strict URL transform — returns the URL unchanged if it's safe,
 * otherwise returns an empty string (which causes react-markdown to
 * render `<a>` without an `href`, neutralizing the link).
 *
 * Rules:
 *   - Empty / null / undefined → ""
 *   - Anchor links (`#section`) → unchanged (always safe)
 *   - Relative paths (`./foo`, `/foo`, `foo.html`) → unchanged
 *   - Allowed protocols (http, https, mailto, tel) → unchanged
 *   - Anything else → ""
 *
 * Case-insensitive on the protocol so `JaVaScRiPt:` is also blocked.
 * Strips leading whitespace + control chars before parsing because
 * `\u0000javascript:` and `\tjavascript:` are classic bypass tricks.
 */
export function safeMarkdownUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  // Strip leading control chars + whitespace (newlines, tabs, NUL)
  // to prevent obfuscation tricks like `\tjavascript:alert(1)`.
  const cleaned = value.replace(/^[\s\u0000-\u001F\u007F]+/, "");
  if (cleaned === "") return "";
  // Pure anchor link
  if (cleaned.startsWith("#")) return cleaned;
  // Relative path / absolute path / query string
  if (
    cleaned.startsWith("/") ||
    cleaned.startsWith("./") ||
    cleaned.startsWith("../") ||
    cleaned.startsWith("?")
  ) {
    return cleaned;
  }
  // Look for a protocol — if there's a `:` before any `/`, `?`, or
  // `#`, we treat the prefix as a protocol candidate.
  const colon = cleaned.indexOf(":");
  if (colon === -1) {
    // No colon — relative URL, allow.
    return cleaned;
  }
  const slash = cleaned.indexOf("/");
  const question = cleaned.indexOf("?");
  const hash = cleaned.indexOf("#");
  const otherFirst = Math.min(
    slash === -1 ? Infinity : slash,
    question === -1 ? Infinity : question,
    hash === -1 ? Infinity : hash,
  );
  if (colon > otherFirst) {
    // The colon comes after a delimiter, so it's not a protocol —
    // e.g. `/path?key=value:foo` is fine.
    return cleaned;
  }
  const protocol = cleaned.slice(0, colon).toLowerCase();
  if (ALLOWED_LINK_PROTOCOLS.has(protocol)) {
    return cleaned;
  }
  return "";
}

/**
 * Allow `data:image/...` for explicit image opt-in. Mirrors
 * `safeMarkdownUrl` but adds `data:image/png` etc to the allowlist.
 *
 * NB: `data:image/svg+xml` is NOT allowed because SVG can carry
 * scripts via `<script>` blocks or `xlink:href=javascript:`.
 */
export function safeImageSrc(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/^[\s\u0000-\u001F\u007F]+/, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("data:")) {
    // Only allow whitelisted image MIME prefixes; reject SVG entirely.
    if (
      /^data:image\/(png|jpe?g|gif|webp|avif|x-icon);base64,/i.test(cleaned)
    ) {
      return cleaned;
    }
    return "";
  }
  return safeMarkdownUrl(cleaned);
}

const ALLOWED_LINK_PROPS = new Set([
  "href",
  "title",
  "children",
  "className",
  "id",
  // React-internal — never an XSS vector but the type system needs it
  "key",
]);

/**
 * Filter spread props going onto an `<a>` to a known-safe set so a
 * future remark plugin can't inject (e.g.) an `onclick` attribute
 * that React would render. Returns a fresh object — never mutates
 * the input.
 */
export function safeLinkProps<T extends Record<string, unknown>>(
  props: T,
): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    if (ALLOWED_LINK_PROPS.has(key)) {
      // Special-case: also pass href through the URL transform so a
      // raw `href` injected by a non-standard plugin still gets
      // sanitized.
      if (key === "href") {
        out[key] = safeMarkdownUrl(props[key]);
      } else {
        out[key] = props[key];
      }
    }
  }
  return out as Partial<T>;
}

/**
 * Tag a Shiki HTML string as trusted ONLY if its shape matches what
 * Shiki actually emits — no inline event handlers, no script tags,
 * no `javascript:` URIs. Returns null if the input fails any check
 * so the caller can fall back to the plain `<pre>` rendering instead
 * of risking an XSS via a corrupted Shiki output.
 *
 * Shiki's output shape is `<pre class="shiki ..."><code>...</code></pre>`
 * with `<span>` elements inside, no other tags.
 */
export function trustedShikiHtml(html: unknown): string | null {
  if (typeof html !== "string" || !html) return null;
  // Reject anything containing a script tag or inline event handler.
  if (/<script\b/i.test(html)) return null;
  if (/\bon[a-z]+\s*=/i.test(html)) return null;
  if (/javascript\s*:/i.test(html)) return null;
  // Quick shape check: must start with <pre and end with </pre>.
  const trimmed = html.trim();
  if (!trimmed.startsWith("<pre")) return null;
  if (!trimmed.endsWith("</pre>")) return null;
  return html;
}
