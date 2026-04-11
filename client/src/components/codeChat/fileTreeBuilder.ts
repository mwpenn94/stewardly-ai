/**
 * File tree builder (Pass 215).
 *
 * Converts the flat file list returned by `codeChat.listWorkspaceFiles`
 * into a nested tree suitable for hierarchical rendering, and computes
 * codebase statistics (file count, LOC estimate, top languages).
 *
 * Pure functions — no DOM, no tRPC, no React — so the tree builder is
 * unit-testable and reusable from any surface that has a list of
 * POSIX-style relative paths.
 */

export interface FileTreeNode {
  name: string;
  path: string; // full POSIX-style path from the workspace root
  type: "file" | "directory";
  children?: FileTreeNode[];
}

/**
 * Build a nested tree from a flat list of POSIX paths.
 *
 * Directories are sorted first (alphabetically), then files
 * (alphabetically), matching `ls -la` intuition. The root has
 * `path: ""`.
 */
export function buildFileTree(files: string[]): FileTreeNode {
  const root: FileTreeNode = {
    name: "",
    path: "",
    type: "directory",
    children: [],
  };

  for (const file of files) {
    const parts = file.split("/").filter(Boolean);
    if (parts.length === 0) continue;
    let parent = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isLeaf = i === parts.length - 1;
      const expectedType: FileTreeNode["type"] = isLeaf ? "file" : "directory";
      const path = parts.slice(0, i + 1).join("/");
      if (!parent.children) parent.children = [];
      let existing = parent.children.find((c) => c.name === name);
      if (existing) {
        if (existing.type !== expectedType && existing.type === "file" && isLeaf) {
          // Same file seen twice — no-op
          continue;
        }
        if (!existing.children && expectedType === "directory") {
          existing = { ...existing, type: "directory", children: [] };
          // Replace in parent
          const idx = parent.children.indexOf(parent.children.find((c) => c.name === name)!);
          parent.children[idx] = existing;
        }
      } else {
        existing = {
          name,
          path,
          type: expectedType,
          children: expectedType === "directory" ? [] : undefined,
        };
        parent.children.push(existing);
      }
      if (!isLeaf) parent = existing;
    }
  }

  sortTree(root);
  return root;
}

function sortTree(node: FileTreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    if (child.type === "directory") sortTree(child);
  }
}

// ─── Stats ────────────────────────────────────────────────────────────

export interface CodebaseStats {
  totalFiles: number;
  totalDirs: number;
  topLanguages: Array<{ ext: string; count: number; pct: number }>;
  topDirs: Array<{ dir: string; count: number }>;
}

/**
 * Summarize a flat file list into displayable stats. Language
 * breakdown is by extension (not LOC) — cheap, deterministic, and
 * accurate enough for the Files tab header.
 */
export function computeStats(files: string[], topN = 5): CodebaseStats {
  if (files.length === 0) {
    return { totalFiles: 0, totalDirs: 0, topLanguages: [], topDirs: [] };
  }

  const extCounts = new Map<string, number>();
  const dirCounts = new Map<string, number>();
  const uniqueDirs = new Set<string>();

  for (const file of files) {
    const parts = file.split("/");
    // Extension
    const base = parts[parts.length - 1];
    const dotIdx = base.lastIndexOf(".");
    const ext = dotIdx > 0 ? base.slice(dotIdx) : "(no ext)";
    extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1);
    // Top-level directory
    if (parts.length > 1) {
      const topDir = parts[0];
      dirCounts.set(topDir, (dirCounts.get(topDir) ?? 0) + 1);
      // Track every intermediate dir for totalDirs
      for (let i = 1; i < parts.length; i++) {
        uniqueDirs.add(parts.slice(0, i).join("/"));
      }
    }
  }

  const topLanguages = Array.from(extCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([ext, count]) => ({
      ext,
      count,
      pct: Math.round((count / files.length) * 100),
    }));

  const topDirs = Array.from(dirCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([dir, count]) => ({ dir, count }));

  return {
    totalFiles: files.length,
    totalDirs: uniqueDirs.size,
    topLanguages,
    topDirs,
  };
}
