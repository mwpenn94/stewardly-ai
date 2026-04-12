/**
 * DEFAULT_ENABLED_TOOLS — split out from ToolPermissionsPopover so the
 * popover component itself can be lazy-loaded without dragging the
 * constant (which is needed eagerly to seed React state) into the
 * deferred chunk.
 *
 * Build-loop Pass 12 (G17) — bundle size optimization.
 */

export const DEFAULT_ENABLED_TOOLS: string[] = [
  "read_file",
  "multi_read",
  "list_directory",
  "grep_search",
  "glob_files",
  "web_fetch",
  "web_search",
  "task",
  "write_file",
  "edit_file",
  "run_bash",
  "update_todos",
  "find_symbol",
];
