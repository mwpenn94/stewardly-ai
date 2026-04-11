/**
 * FileTreePanel — hierarchical workspace file tree + codebase stats
 * (Pass 215).
 *
 * Replaces the flat listing in the Code Chat Files tab with:
 *   - A stats strip (total files, total dirs, top 5 languages)
 *   - A collapsible tree view rooted at the workspace root
 *   - Click-to-select filenames that bubble up to a parent handler
 *     (the existing FileBrowser file viewer)
 *
 * The tree state (which folders are expanded) lives entirely in
 * local state — no persistence beyond the session because users
 * rarely want their tree layout cached across tabs.
 */

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { buildFileTree, computeStats, type FileTreeNode } from "./fileTreeBuilder";
import {
  ChevronRight,
  ChevronDown,
  File as FileIcon,
  Folder,
  FolderOpen,
  Loader2,
} from "lucide-react";

export default function FileTreePanel({
  onFileClick,
}: {
  onFileClick: (path: string) => void;
}) {
  const query = trpc.codeChat.listWorkspaceFiles.useQuery(
    { all: true, limit: 5000 },
    { staleTime: 60_000, retry: false },
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([""]));

  const files = query.data?.files ?? [];
  const stats = useMemo(() => computeStats(files), [files]);
  const tree = useMemo(() => buildFileTree(files), [files]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  if (query.isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
        <Loader2 className="h-3 w-3 animate-spin" /> Indexing workspace…
      </div>
    );
  }

  if (query.error || files.length === 0) {
    return (
      <p className="text-xs text-muted-foreground italic p-4">
        No files found. {query.error?.message}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      <div className="rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <span className="font-mono">
            <span className="text-foreground font-medium">{stats.totalFiles}</span>{" "}
            <span className="text-muted-foreground">files</span>
          </span>
          <span className="font-mono">
            <span className="text-foreground font-medium">{stats.totalDirs}</span>{" "}
            <span className="text-muted-foreground">dirs</span>
          </span>
        </div>
        {stats.topLanguages.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {stats.topLanguages.map((l) => (
              <span
                key={l.ext}
                className="px-2 py-0.5 rounded-full border border-border/40 bg-background/60 text-[10px] font-mono tabular-nums"
                title={`${l.count} files (${l.pct}%)`}
              >
                {l.ext} · {l.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tree */}
      <div className="rounded-lg border border-border/40 overflow-auto max-h-[500px]">
        <TreeNode
          node={tree}
          depth={0}
          expanded={expanded}
          onToggle={toggle}
          onFileClick={onFileClick}
        />
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  expanded,
  onToggle,
  onFileClick,
}: {
  node: FileTreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onFileClick: (path: string) => void;
}) {
  if (node.type === "file") {
    return (
      <button
        type="button"
        onClick={() => onFileClick(node.path)}
        className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-secondary/30 text-[11px] font-mono text-left"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <FileIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="text-foreground truncate">{node.name}</span>
      </button>
    );
  }

  const isRoot = node.path === "";
  const isOpen = expanded.has(node.path);

  return (
    <div>
      {!isRoot && (
        <button
          type="button"
          onClick={() => onToggle(node.path)}
          className="flex items-center gap-1.5 w-full px-2 py-1 hover:bg-secondary/30 text-[11px] font-mono text-left"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {isOpen ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="h-3 w-3 shrink-0 text-accent" />
          ) : (
            <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
          )}
          <span className="text-foreground truncate">{node.name}</span>
        </button>
      )}
      {(isRoot || isOpen) &&
        node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={isRoot ? 0 : depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onFileClick={onFileClick}
          />
        ))}
    </div>
  );
}
