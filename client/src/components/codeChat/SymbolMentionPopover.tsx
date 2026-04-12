/**
 * SymbolMentionPopover — `#symbol` autocomplete (Build-loop Pass 13 / G23).
 *
 * Cursor-style inline jump-to-definition picker. When the user types
 * `#useAuth` in the Code Chat input, this popover opens above the
 * textarea showing matching workspace symbols (functions, classes,
 * interfaces, types, consts) ranked by the symbol index.
 *
 * Symmetric with `FileMentionPopover` from Pass 206 — same keyboard
 * navigation contract (parent owns Arrow up/down, Tab/Enter, Esc),
 * same dropdown shape, same `onSelect` event.
 */

import { Sparkles } from "lucide-react";

export interface SymbolMentionHit {
  name: string;
  kind: string;
  path: string;
  line: number;
  snippet: string;
  exported: boolean;
}

const KIND_BADGE: Record<string, { label: string; color: string }> = {
  function: { label: "fn", color: "text-emerald-400" },
  class: { label: "cls", color: "text-amber-400" },
  interface: { label: "if", color: "text-sky-400" },
  type: { label: "ty", color: "text-purple-400" },
  enum: { label: "en", color: "text-orange-400" },
  const: { label: "c", color: "text-muted-foreground" },
  let: { label: "l", color: "text-muted-foreground" },
  var: { label: "v", color: "text-muted-foreground" },
};

function kindBadge(kind: string) {
  return KIND_BADGE[kind] ?? { label: kind.slice(0, 2), color: "text-muted-foreground" };
}

export default function SymbolMentionPopover({
  symbols,
  activeIndex,
  onSelect,
  loading,
}: {
  symbols: SymbolMentionHit[];
  activeIndex: number;
  onSelect: (hit: SymbolMentionHit) => void;
  loading?: boolean;
}) {
  if (symbols.length === 0 && !loading) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-lg overflow-hidden max-h-64 overflow-y-auto z-10">
      <div className="px-3 py-1.5 border-b border-border/30 bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        {loading ? "Searching symbols…" : `Symbols — ${symbols.length}`}
      </div>
      <ul role="listbox">
        {symbols.map((sym, idx) => {
          const badge = kindBadge(sym.kind);
          return (
            <li
              key={`${sym.name}-${sym.path}-${sym.line}`}
              role="option"
              aria-selected={idx === activeIndex}
              aria-label={`${sym.name} (${sym.kind}) at ${sym.path}:${sym.line}`}
              className={`flex items-center gap-2 px-3 py-1 cursor-pointer text-xs font-mono ${
                idx === activeIndex ? "bg-accent/10" : "hover:bg-secondary/40"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(sym);
              }}
            >
              <span
                className={`text-[9px] uppercase tabular-nums w-5 shrink-0 ${badge.color}`}
                title={sym.kind}
              >
                {badge.label}
              </span>
              <span className="text-foreground shrink-0">{sym.name}</span>
              {sym.exported && (
                <span className="text-[9px] text-accent/80 shrink-0">export</span>
              )}
              <span className="text-muted-foreground truncate flex-1 text-right">
                {sym.path}:{sym.line}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
