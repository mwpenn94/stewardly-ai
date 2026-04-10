/**
 * DiffView — renders a line-level diff using shared/lineDiff.ts
 *
 * Pass 202. Shows a GitHub-style unified diff with:
 *  - Green background for added lines
 *  - Red background for deleted lines
 *  - Tab-separated old/new line numbers in a two-column gutter
 *  - Hunk headers (`@@ -oldStart,count +newStart,count @@`)
 *  - A compact stats strip (`+X / -Y lines, NN% similar`)
 *
 * Used by:
 *  - CodeChat inline file editor (live preview while editing)
 *  - Tool result viewer for edit_file / write_file results
 *  - Future: GitHub PR "view changes" tab
 */

import { useMemo } from "react";
import { lineDiff } from "@shared/lineDiff";

export interface DiffViewProps {
  oldText: string;
  newText: string;
  pathA?: string;
  pathB?: string;
  contextLines?: number;
  /** Height class for the scrollable area (tailwind). Default max-h-[500px] */
  heightClass?: string;
  /** Hide the header stats strip */
  hideStats?: boolean;
  /** Hide the line-number gutter */
  hideGutter?: boolean;
}

export default function DiffView({
  oldText,
  newText,
  pathA,
  pathB,
  contextLines = 3,
  heightClass = "max-h-[500px]",
  hideStats = false,
  hideGutter = false,
}: DiffViewProps) {
  const result = useMemo(
    () => lineDiff(oldText, newText, { contextLines }),
    [oldText, newText, contextLines],
  );

  if (result.stats.added === 0 && result.stats.deleted === 0) {
    return (
      <div className="text-xs text-muted-foreground italic p-3 bg-muted/30 rounded font-mono">
        No changes
      </div>
    );
  }

  return (
    <div className="border border-border/40 rounded overflow-hidden">
      {!hideStats && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/40 bg-muted/20 text-[10px] font-mono">
          <span className="text-emerald-500">+{result.stats.added}</span>
          <span className="text-destructive">−{result.stats.deleted}</span>
          <span className="text-muted-foreground">
            {Math.round(result.stats.similarity * 100)}% similar
          </span>
          {(pathA || pathB) && (
            <span className="text-muted-foreground ml-auto truncate">
              {pathA ?? "a"} → {pathB ?? "b"}
            </span>
          )}
        </div>
      )}
      <div className={`overflow-auto font-mono text-[11px] ${heightClass}`}>
        {result.hunks.map((hunk, i) => (
          <div key={i}>
            <div className="bg-chart-3/10 text-chart-3 px-2 py-0.5">
              @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},
              {hunk.newCount} @@
            </div>
            {hunk.entries.map((entry, j) => (
              <div
                key={j}
                className={`flex ${
                  entry.op === "add"
                    ? "bg-emerald-500/10"
                    : entry.op === "delete"
                      ? "bg-destructive/10"
                      : ""
                }`}
              >
                {!hideGutter && (
                  <>
                    <span className="inline-block w-10 shrink-0 text-right pr-1.5 text-muted-foreground/60 select-none tabular-nums">
                      {entry.oldLine ?? ""}
                    </span>
                    <span className="inline-block w-10 shrink-0 text-right pr-1.5 text-muted-foreground/60 select-none tabular-nums border-r border-border/30">
                      {entry.newLine ?? ""}
                    </span>
                  </>
                )}
                <span className="inline-block w-5 shrink-0 text-center select-none">
                  {entry.op === "add" ? (
                    <span className="text-emerald-500">+</span>
                  ) : entry.op === "delete" ? (
                    <span className="text-destructive">−</span>
                  ) : (
                    <span className="text-muted-foreground/40"> </span>
                  )}
                </span>
                <span
                  className={`flex-1 whitespace-pre pr-2 ${
                    entry.op === "add"
                      ? "text-emerald-600 dark:text-emerald-300"
                      : entry.op === "delete"
                        ? "text-destructive"
                        : "text-foreground/80"
                  }`}
                >
                  {entry.text || " "}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
