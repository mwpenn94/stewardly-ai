/**
 * Markdown table-of-contents generator — Pass 271.
 *
 * Parses markdown headings (h1-h6) from a string and produces a
 * hierarchical TOC tree. Used by the assistant message renderer
 * to show a navigable outline beside long replies, and by the
 * Files tab to render a jump-list for README files.
 *
 * Pure, no DOM.
 */

export interface TocEntry {
  level: number;
  title: string;
  /** URL-safe anchor derived from the title */
  slug: string;
  /** 1-indexed line number in the original markdown */
  line: number;
  children: TocEntry[];
}

export interface TocResult {
  entries: TocEntry[];
  /** Flat list in source order for quick lookup */
  flat: TocEntry[];
}

/**
 * Convert a heading title into a slug-safe anchor. Lowercase,
 * strips punctuation, collapses whitespace to dashes.
 */
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Parse a markdown string into a TOC. Handles:
 *   - ATX headings (#, ##, ###, etc.)
 *   - Setext headings (line followed by === or ---)
 *   - Code fences (```) to skip headings inside them
 *
 * Returns both a hierarchical tree and a flat list in source order.
 */
export function parseMarkdownToc(md: string): TocResult {
  if (!md) return { entries: [], flat: [] };
  const lines = md.split(/\r?\n/);
  const flat: TocEntry[] = [];
  let inFence = false;
  let fenceChar = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Detect code fence toggles
    const fenceMatch = line.match(/^(```|~~~)/);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1];
      } else if (fenceChar === fenceMatch[1]) {
        inFence = false;
        fenceChar = "";
      }
      continue;
    }
    if (inFence) continue;

    // ATX heading
    const atx = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (atx) {
      const level = atx[1].length;
      const title = atx[2].trim();
      if (!title) continue;
      flat.push({
        level,
        title,
        slug: slugify(title),
        line: i + 1,
        children: [],
      });
      continue;
    }

    // Setext heading: current line + next line === or ---
    const next = lines[i + 1];
    if (line.trim().length > 0 && next) {
      if (/^=+\s*$/.test(next)) {
        flat.push({
          level: 1,
          title: line.trim(),
          slug: slugify(line.trim()),
          line: i + 1,
          children: [],
        });
        i++; // consume the underline
      } else if (/^-+\s*$/.test(next) && line.trim().length >= 1) {
        // Only treat as setext if the line isn't the first line of a
        // list / thematic break — keep it simple and require the
        // underline to be ≥ 3 dashes
        if (next.trim().length >= 3) {
          flat.push({
            level: 2,
            title: line.trim(),
            slug: slugify(line.trim()),
            line: i + 1,
            children: [],
          });
          i++;
        }
      }
    }
  }

  // Build the tree by walking flat entries and grouping by level
  const entries: TocEntry[] = [];
  const stack: TocEntry[] = [];
  for (const entry of flat) {
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      entries.push(entry);
    } else {
      stack[stack.length - 1].children.push(entry);
    }
    stack.push(entry);
  }

  return { entries, flat };
}

/**
 * Count total entries (including nested children) in a TOC.
 */
export function countEntries(entries: TocEntry[]): number {
  let count = 0;
  for (const e of entries) {
    count++;
    count += countEntries(e.children);
  }
  return count;
}

/**
 * Return the maximum nesting depth of a TOC. 0 for empty.
 */
export function maxDepth(entries: TocEntry[]): number {
  if (entries.length === 0) return 0;
  let max = 0;
  for (const e of entries) {
    const child = maxDepth(e.children);
    if (1 + child > max) max = 1 + child;
  }
  return max;
}

/**
 * Flatten a tree back to a linear list in source order.
 */
export function flattenToc(entries: TocEntry[]): TocEntry[] {
  const out: TocEntry[] = [];
  const walk = (list: TocEntry[]) => {
    for (const e of list) {
      out.push(e);
      walk(e.children);
    }
  };
  walk(entries);
  return out;
}
