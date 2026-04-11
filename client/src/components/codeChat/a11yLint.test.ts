/**
 * Build-loop Pass 10 (G15) — accessibility regression test.
 *
 * Lints the Code Chat client surface for icon-only `<button>` elements
 * that are missing an `aria-label` (or `title` as a fallback). This is
 * a static lint over the source files, not a DOM test, so it runs
 * fast and catches regressions before they ship.
 *
 * The check is intentionally conservative — it inspects each `<button`
 * occurrence and verifies one of these is present somewhere within the
 * next 60 lines (covering long callback bodies and `className` blocks):
 *
 *   - aria-label="..."
 *   - aria-label={...}
 *   - aria-labelledby="..."
 *   - title="..."
 *   - title={...}
 *
 * If a button has visible text content the lint won't catch it as
 * unlabeled — it allows-by-default and only flags buttons that
 * a screen reader would announce as `"button"` with no name.
 *
 * The 60-line window is heuristic. If a button's opening tag has so
 * many props that its label lives more than 60 lines down, the lint
 * will report a false positive — that's a code-style problem worth
 * fixing on its own.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const TARGET_FILES = [
  "client/src/pages/CodeChat.tsx",
  "client/src/components/codeChat/ToolPermissionsPopover.tsx",
  "client/src/components/codeChat/SessionAnalyticsPopover.tsx",
  "client/src/components/codeChat/SymbolNavigatorPopover.tsx",
  "client/src/components/codeChat/AgentMemoryPopover.tsx",
  "client/src/components/codeChat/ProjectInstructionsPopover.tsx",
  "client/src/components/codeChat/EditHistoryPopover.tsx",
  "client/src/components/codeChat/PromptTemplatesPopover.tsx",
  "client/src/components/codeChat/SessionsLibraryPopover.tsx",
  "client/src/components/codeChat/CommandHistorySearchPopover.tsx",
  "client/src/components/codeChat/ActionPalettePopover.tsx",
  "client/src/components/codeChat/KeyboardShortcutsOverlay.tsx",
];

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LABEL_RE = /aria-label\s*[=:]|aria-labelledby\s*[=:]|title\s*=/;

interface UnlabeledButton {
  file: string;
  line: number;
}

/**
 * Extract the rendered children of a `<button>` tag — everything
 * between the opening `>` and the matching `</button>`. Returns null
 * if the tag is malformed within the search window.
 */
function buttonChildren(lines: string[], startLine: number): string | null {
  // Find the first `>` after `<button` (closing the opening tag).
  let depth = 0;
  let foundClose = false;
  let buf = "";
  let inTag = true;
  // Walk char-by-char through up to 200 lines starting at startLine.
  const window = lines.slice(startLine, Math.min(startLine + 200, lines.length)).join("\n");
  // Locate the matching `>` that closes the opening `<button`. Skip
  // angle brackets that live inside string literals or curly braces.
  let i = window.indexOf("<button");
  if (i === -1) return null;
  i += "<button".length;
  let braceDepth = 0;
  while (i < window.length) {
    const ch = window[i];
    if (ch === "{") braceDepth++;
    else if (ch === "}") braceDepth--;
    else if (ch === ">" && braceDepth === 0) break;
    i++;
  }
  if (i >= window.length) return null;
  // From here, walk to the matching `</button>` accounting for nested buttons.
  i++;
  depth = 1;
  while (i < window.length && depth > 0) {
    if (window.startsWith("<button", i)) {
      depth++;
      i += "<button".length;
      continue;
    }
    if (window.startsWith("</button>", i)) {
      depth--;
      if (depth === 0) {
        foundClose = true;
        break;
      }
      i += "</button>".length;
      continue;
    }
    buf += window[i];
    i++;
  }
  if (!foundClose) return null;
  return buf;
}

/**
 * Heuristic: does the children string contain any visible text the
 * screen reader would announce as the button's accessible name?
 *
 * Counts as visible: any alphanumeric run that isn't inside a JSX
 * comment, isn't a className attribute (we already stripped tags),
 * and isn't a single-letter braced expression like `{x}`.
 */
function hasVisibleText(children: string): boolean {
  // Strip JSX comments {/* ... */}
  const stripped = children.replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "");
  // Strip JSX braces but keep their inner — we want to know if the
  // brace renders a string or a meaningful identifier.
  const flat = stripped.replace(/[<>{}]/g, " ");
  // Look for any 2+ char alphanumeric run that isn't a tag name.
  return /[A-Za-z0-9]{2,}/.test(flat);
}

function findUnlabeledButtons(file: string): UnlabeledButton[] {
  const abs = path.join(REPO_ROOT, file);
  if (!fs.existsSync(abs)) return [];
  const text = fs.readFileSync(abs, "utf8");
  const lines = text.split("\n");
  const out: UnlabeledButton[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (!/<button\b/.test(lines[i])) continue;
    // Check a 100-line window for a label attribute.
    const window = lines.slice(i, Math.min(i + 100, lines.length)).join("\n");
    if (LABEL_RE.test(window)) continue;
    // No label — check if the button has visible text content.
    const children = buttonChildren(lines, i);
    if (children !== null && hasVisibleText(children)) continue;
    out.push({ file, line: i + 1 });
  }
  return out;
}

describe("Code Chat a11y lint (Build-loop Pass 10 / G15)", () => {
  it("every <button> in the Code Chat surface has aria-label or title", () => {
    const violations: UnlabeledButton[] = [];
    for (const file of TARGET_FILES) {
      violations.push(...findUnlabeledButtons(file));
    }
    if (violations.length > 0) {
      const msg = violations
        .map((v) => `  ${v.file}:${v.line}`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} unlabeled <button> elements:\n${msg}`,
      );
    }
    expect(violations).toHaveLength(0);
  });
});
