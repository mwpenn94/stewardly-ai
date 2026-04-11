/**
 * TODO / FIXME / HACK marker scanner for Code Chat (Pass 246).
 *
 * Walks the workspace and extracts `// TODO:` / `// FIXME:` style
 * comments so users and the agent can get a project-wide view of
 * outstanding work without running a shell grep.
 *
 * Recognized marker kinds (case-insensitive):
 *   TODO    — generic deferred work
 *   FIXME   — known defect
 *   HACK    — intentional workaround
 *   XXX     — dangerous/problematic code that needs attention
 *   NOTE    — informational callout
 *   OPTIMIZE / PERF — performance improvements deferred
 *   BUG     — known bug
 *
 * Each marker is extracted as a structured entry with file, line,
 * kind, optional author (from `TODO(alice):` form), and message.
 */

export type MarkerKind =
  | "TODO"
  | "FIXME"
  | "HACK"
  | "XXX"
  | "NOTE"
  | "OPTIMIZE"
  | "PERF"
  | "BUG";

export interface TodoMarker {
  kind: MarkerKind;
  path: string;
  line: number;
  author?: string;
  message: string;
}

// Accepts //, /*, #, ;, --, %, ' (covering JS/TS/C/Python/Rust/SQL/etc.)
const COMMENT_PREFIX = /^(?:[\s\t]*[\/\\*#;%'!-]*[\s\t]*|\s*)/;
const MARKER_KINDS: MarkerKind[] = [
  "TODO",
  "FIXME",
  "HACK",
  "XXX",
  "NOTE",
  "OPTIMIZE",
  "PERF",
  "BUG",
];
const MARKER_UNION = MARKER_KINDS.join("|");
const MARKER_REGEX = new RegExp(
  `(?:\\b|_)(${MARKER_UNION})(?:\\(([^)]+)\\))?\\s*:?\\s*(.*)$`,
  "i",
);

export function extractMarkers(content: string, path: string): TodoMarker[] {
  const out: TodoMarker[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Only look at lines that actually contain a comment-ish prefix
    // OR a marker keyword. A generous filter to keep this cheap.
    const hasComment = /[#;%]|\/\/|\/\*|<!--|--/.test(line);
    if (!hasComment && !/(?:TODO|FIXME|HACK|XXX|NOTE|BUG|OPTIMIZE|PERF)/i.test(line)) {
      continue;
    }
    // Strip leading whitespace + comment chars
    const trimmed = line.replace(COMMENT_PREFIX, "").trimStart();
    const match = MARKER_REGEX.exec(trimmed);
    if (!match) continue;
    const kindRaw = match[1].toUpperCase();
    if (!MARKER_KINDS.includes(kindRaw as MarkerKind)) continue;
    const author = match[2]?.trim() || undefined;
    const message = match[3]?.trim() ?? "";
    // Avoid capturing "NOTE: this is fine" — NOTE is allowed, just
    // filter out empty messages
    if (!message && !author) continue;
    out.push({
      kind: kindRaw as MarkerKind,
      path,
      line: i + 1,
      author,
      message: message.slice(0, 500),
    });
    if (out.length >= 1000) break; // hard cap per file
  }
  return out;
}

// ─── Aggregation ────────────────────────────────────────────────────────

export interface MarkerGroups {
  all: TodoMarker[];
  byKind: Record<MarkerKind, number>;
  byAuthor: Map<string, number>;
  byFile: Map<string, number>;
}

export function groupMarkers(markers: TodoMarker[]): MarkerGroups {
  const byKind: Record<MarkerKind, number> = {
    TODO: 0,
    FIXME: 0,
    HACK: 0,
    XXX: 0,
    NOTE: 0,
    OPTIMIZE: 0,
    PERF: 0,
    BUG: 0,
  };
  const byAuthor = new Map<string, number>();
  const byFile = new Map<string, number>();
  for (const marker of markers) {
    byKind[marker.kind]++;
    if (marker.author) {
      byAuthor.set(marker.author, (byAuthor.get(marker.author) ?? 0) + 1);
    }
    byFile.set(marker.path, (byFile.get(marker.path) ?? 0) + 1);
  }
  return { all: markers, byKind, byAuthor, byFile };
}

export interface MarkerSeverity {
  /** 0 = info, 1 = normal, 2 = warning, 3 = critical */
  level: 0 | 1 | 2 | 3;
  color: string;
}

export function markerSeverity(kind: MarkerKind): MarkerSeverity {
  switch (kind) {
    case "BUG":
    case "FIXME":
      return { level: 3, color: "destructive" };
    case "XXX":
    case "HACK":
      return { level: 2, color: "amber" };
    case "TODO":
    case "OPTIMIZE":
    case "PERF":
      return { level: 1, color: "accent" };
    case "NOTE":
    default:
      return { level: 0, color: "muted" };
  }
}

export function filterMarkers(
  markers: TodoMarker[],
  opts: {
    kinds?: MarkerKind[];
    author?: string;
    pathPrefix?: string;
    search?: string;
  } = {},
): TodoMarker[] {
  const kindSet = opts.kinds ? new Set(opts.kinds) : null;
  const searchLower = opts.search?.toLowerCase();
  return markers.filter((m) => {
    if (kindSet && !kindSet.has(m.kind)) return false;
    if (opts.author && m.author !== opts.author) return false;
    if (opts.pathPrefix && !m.path.startsWith(opts.pathPrefix)) return false;
    if (searchLower) {
      const haystack = `${m.path} ${m.message} ${m.author ?? ""}`.toLowerCase();
      if (!haystack.includes(searchLower)) return false;
    }
    return true;
  });
}
