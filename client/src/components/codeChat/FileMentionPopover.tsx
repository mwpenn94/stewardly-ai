/**
 * FileMentionPopover — @file autocomplete (Pass 206).
 *
 * Renders an inline workspace-file picker above the Code Chat input
 * when the user types `@` followed by a query. Files come from the
 * `codeChat.listWorkspaceFiles` tRPC query which walks the workspace
 * once per minute and fuzzy-filters in memory.
 *
 * The parent owns keyboard nav (Arrow up/down, Tab/Enter to select,
 * Esc to close) because the textarea is there.
 */

import { FileCode } from "lucide-react";

export default function FileMentionPopover({
  files,
  activeIndex,
  onSelect,
}: {
  files: string[];
  activeIndex: number;
  onSelect: (file: string) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-64 overflow-y-auto z-10">
      <div className="px-3 py-1.5 border-b border-border/30 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <FileCode className="h-3 w-3" /> Files — {files.length}
      </div>
      <ul role="listbox">
        {files.map((file, idx) => {
          const parts = file.split("/");
          const base = parts.pop();
          const dir = parts.join("/");
          return (
            <li
              key={file}
              role="option"
              aria-selected={idx === activeIndex}
              className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-xs font-mono ${
                idx === activeIndex ? "bg-accent/10" : "hover:bg-secondary/40"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(file);
              }}
            >
              <span className="text-foreground shrink-0">{base}</span>
              {dir && (
                <span className="text-muted-foreground truncate">{dir}/</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
