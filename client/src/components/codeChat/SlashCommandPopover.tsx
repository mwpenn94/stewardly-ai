/**
 * Slash-command popover (Pass 203).
 *
 * Renders an inline menu above the Code Chat input when the user
 * types `/` at the start. Keyboard nav (Arrow up/down + Enter/Tab
 * to select, Esc to close) is wired by the parent because the
 * parent owns the textarea focus.
 */

import type { SlashCommand } from "./slashCommands";
import { Zap } from "lucide-react";

export default function SlashCommandPopover({
  commands,
  activeIndex,
  onSelect,
}: {
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (cmd: SlashCommand) => void;
}) {
  if (commands.length === 0) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-64 overflow-y-auto z-10">
      <div className="px-3 py-1.5 border-b border-border/30 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Zap className="h-3 w-3" /> Slash commands
      </div>
      <ul role="listbox">
        {commands.map((cmd, idx) => (
          <li
            key={cmd.name}
            role="option"
            aria-selected={idx === activeIndex}
            className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs ${
              idx === activeIndex ? "bg-accent/10" : "hover:bg-secondary/40"
            }`}
            onMouseDown={(e) => {
              e.preventDefault(); // prevent input blur
              onSelect(cmd);
            }}
          >
            <code className="font-mono text-accent shrink-0">
              /{cmd.name}
              {cmd.args ? ` ${cmd.args}` : ""}
            </code>
            <span className="text-muted-foreground truncate">
              {cmd.description}
            </span>
            {cmd.aliases && cmd.aliases.length > 0 && (
              <span className="text-muted-foreground/50 text-[9px] ml-auto shrink-0">
                {cmd.aliases.map((a) => `/${a}`).join(" ")}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
