/**
 * ToolPermissionsPopover — fine-grained per-tool allowlist (Pass 213).
 *
 * Lets users narrow what tools the ReAct loop can call. Defaults to
 * "all read tools on, write tools depend on admin + write mode".
 * Useful for:
 *   - Answering questions without letting the agent run bash
 *   - Admins who want the agent to edit files but never shell out
 *   - Debugging which specific tools are pulling their weight
 *
 * The server-side codeChatStream endpoint intersects this list with
 * the role-based allowlist, so toggling a write tool on without
 * admin+write-mode is a no-op on the server regardless of what the
 * UI sent.
 */

import { X, ShieldCheck } from "lucide-react";

interface ToolSpec {
  id: string;
  label: string;
  description: string;
  mutation: boolean;
}

export const CODE_TOOL_SPECS: ToolSpec[] = [
  {
    id: "read_file",
    label: "Read file",
    description: "Read up to 256KB of a workspace file",
    mutation: false,
  },
  {
    id: "list_directory",
    label: "List directory",
    description: "Enumerate files + subdirectories at a path",
    mutation: false,
  },
  {
    id: "grep_search",
    label: "Grep search",
    description: "Pattern search across the workspace (ripgrep)",
    mutation: false,
  },
  {
    id: "write_file",
    label: "Write file",
    description: "Create or overwrite a file (admin + write mode)",
    mutation: true,
  },
  {
    id: "edit_file",
    label: "Edit file",
    description: "Find+replace inside a file (admin + write mode)",
    mutation: true,
  },
  {
    id: "multi_edit",
    label: "Multi-edit",
    description:
      "Atomic batch of edits on a single file; all-or-nothing (Parity P2, admin + write)",
    mutation: true,
  },
  {
    id: "run_bash",
    label: "Run bash",
    description: "Shell command with 30s timeout (admin + write mode)",
    mutation: true,
  },
  {
    id: "update_todos",
    label: "Update todos",
    description: "Emit live progress updates (Pass 237, read-only)",
    mutation: false,
  },
  {
    id: "find_symbol",
    label: "Find symbol",
    description: "Look up where a symbol is defined (Pass 242, read-only)",
    mutation: false,
  },
  {
    id: "web_fetch",
    label: "Web fetch",
    description:
      "Fetch external http(s) docs/APIs, SSRF-guarded, 512KB cap (Parity P1, read-only)",
    mutation: false,
  },
  {
    id: "git_blame",
    label: "Git blame",
    description:
      "Per-line git blame with author + timestamp + commit summary (Parity P9, read-only)",
    mutation: false,
  },
];

export const DEFAULT_ENABLED_TOOLS: string[] = [
  "read_file",
  "list_directory",
  "grep_search",
  "write_file",
  "edit_file",
  "multi_edit",
  "run_bash",
  "update_todos",
  "find_symbol",
  "web_fetch",
  "git_blame",
];

export default function ToolPermissionsPopover({
  open,
  onClose,
  enabled,
  onChange,
  canMutate,
}: {
  open: boolean;
  onClose: () => void;
  enabled: string[];
  onChange: (next: string[]) => void;
  canMutate: boolean;
}) {
  if (!open) return null;

  const toggle = (id: string) => {
    const set = new Set(enabled);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange(Array.from(set));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Tool permissions"
    >
      <div
        className="relative w-full max-w-md max-h-[80vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close tool permissions"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-accent" /> Tool permissions
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Narrow the set of tools the agent can call for this session.
          Write tools require admin + write mode regardless of what's
          toggled here.
        </p>

        <ul className="space-y-1.5">
          {CODE_TOOL_SPECS.map((spec) => {
            const isEnabled = enabled.includes(spec.id);
            const isMutationBlocked = spec.mutation && !canMutate;
            return (
              <li
                key={spec.id}
                className={`flex items-start gap-3 px-3 py-2 rounded border ${
                  isEnabled && !isMutationBlocked
                    ? "border-accent/40 bg-accent/5"
                    : "border-border/40"
                }`}
              >
                <input
                  id={`tool-${spec.id}`}
                  type="checkbox"
                  checked={isEnabled}
                  disabled={isMutationBlocked}
                  onChange={() => toggle(spec.id)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`tool-${spec.id}`}
                  className={`flex-1 cursor-pointer text-xs ${
                    isMutationBlocked ? "opacity-50" : ""
                  }`}
                >
                  <div className="font-mono font-medium text-foreground">
                    {spec.label}
                    {spec.mutation && (
                      <span className="ml-1 text-[9px] uppercase tracking-wide text-amber-500">
                        write
                      </span>
                    )}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {spec.description}
                  </div>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between text-[10px]">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => onChange(DEFAULT_ENABLED_TOOLS)}
          >
            Reset to defaults
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() =>
              onChange(
                CODE_TOOL_SPECS.filter((s) => !s.mutation).map((s) => s.id),
              )
            }
          >
            Read-only preset
          </button>
        </div>
      </div>
    </div>
  );
}
