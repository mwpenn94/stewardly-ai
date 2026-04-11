/**
 * ScratchpadPanel — side drawer notepad for Code Chat (Pass 240).
 *
 * Drawer on the right edge of the Code Chat that hosts a persistent
 * notes buffer. Auto-saves on every keystroke (throttled), keeps a
 * live char/word/line counter, and offers quick actions to inject
 * the full content or a selection into the chat input.
 *
 * UX intent:
 *   - Stays open while the user chats so notes are always one click
 *     away
 *   - No modal overlay that steals focus
 *   - Keyboard shortcut hint in the header
 *   - "Send to chat" sends the text to the parent's input handler
 *     via `onInsertIntoPrompt` (parent is responsible for positioning
 *     the text into the chat input)
 */

import { useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  StickyNote,
  Send,
  Trash2,
  Download,
  Copy,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import {
  setContent,
  clear as clearScratchpad,
  scratchpadStats,
  extractLines,
  type ScratchpadState,
} from "./scratchpad";

interface ScratchpadPanelProps {
  open: boolean;
  onClose: () => void;
  state: ScratchpadState;
  onChange: (next: ScratchpadState) => void;
  onInsertIntoPrompt: (text: string) => void;
}

export default function ScratchpadPanel({
  open,
  onClose,
  state,
  onChange,
  onInsertIntoPrompt,
}: ScratchpadPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionText, setSelectionText] = useState<string>("");

  const stats = scratchpadStats(state);

  const handleChange = useCallback(
    (content: string) => {
      onChange(setContent(state, content));
    },
    [onChange, state],
  );

  const handleClear = () => {
    if (!state.content) return;
    if (confirm("Clear scratchpad? This can't be undone.")) {
      onChange(clearScratchpad());
      toast.info("Scratchpad cleared");
    }
  };

  const handleSendAll = () => {
    if (!state.content.trim()) {
      toast.info("Scratchpad is empty");
      return;
    }
    onInsertIntoPrompt(state.content);
    toast.success("Sent to chat input");
  };

  const handleSendSelection = () => {
    // Prefer the live textarea selection, fall back to a highlighted
    // selectionText captured on the last onSelect
    const el = textareaRef.current;
    let text = "";
    if (el) {
      text = state.content.slice(el.selectionStart, el.selectionEnd);
    }
    if (!text) text = selectionText;
    if (!text.trim()) {
      toast.info("Nothing selected — highlight some text first");
      return;
    }
    onInsertIntoPrompt(text);
    toast.success("Selection sent to chat input");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(state.content);
      toast.success("Scratchpad copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleDownload = () => {
    const blob = new Blob([state.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scratchpad-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleInjectFirstLine = () => {
    const first = extractLines(state, 1, 1);
    if (!first.trim()) {
      toast.info("First line is empty");
      return;
    }
    onInsertIntoPrompt(first);
    toast.success("First line sent to chat input");
  };

  if (!open) return null;

  return (
    <aside
      className="hidden md:flex flex-col w-80 border-l border-border/40 bg-card/30 overflow-hidden"
      aria-label="Scratchpad notes"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border/40 bg-background/60">
        <div className="flex items-center gap-1.5 min-w-0">
          <StickyNote className="h-3.5 w-3.5 text-accent shrink-0" />
          <span className="text-xs font-medium text-foreground">Scratchpad</span>
          <Badge
            variant="outline"
            className="text-[9px] h-4 px-1.5 border-border/60 text-muted-foreground font-mono tabular-nums"
          >
            {stats.chars.toLocaleString()}c · {stats.words}w · {stats.lines}L
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close scratchpad"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-2 min-h-0">
        <Textarea
          ref={textareaRef}
          value={state.content}
          onChange={(e) => handleChange(e.target.value)}
          onSelect={(e) => {
            const el = e.currentTarget;
            setSelectionText(state.content.slice(el.selectionStart, el.selectionEnd));
          }}
          placeholder="Notes, snippets, commands — anything you want to keep around across sessions. Auto-saved."
          className="h-full w-full resize-none text-xs font-mono bg-background/60 border-border/50"
          aria-label="Scratchpad content"
        />
      </div>

      {/* Footer action bar */}
      <div className="border-t border-border/40 px-2 py-2 space-y-1.5 bg-background/60">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendAll}
            className="h-6 text-[10px] flex-1"
            aria-label="Send full scratchpad to chat input"
            disabled={!state.content.trim()}
          >
            <Send className="h-3 w-3 mr-1" /> Send all
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendSelection}
            className="h-6 text-[10px] flex-1"
            aria-label="Send selection to chat input"
            disabled={!selectionText.trim()}
          >
            Send selection
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleInjectFirstLine}
            className="h-6 text-[10px] flex-1 text-muted-foreground"
            aria-label="Send first line to chat input"
            disabled={!state.content.trim()}
          >
            <Eraser className="h-3 w-3 mr-1" /> First line
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 text-[10px] text-muted-foreground"
            aria-label="Copy scratchpad to clipboard"
            disabled={!state.content}
          >
            <Copy className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDownload}
            className="h-6 text-[10px] text-muted-foreground"
            aria-label="Download scratchpad as markdown"
            disabled={!state.content}
          >
            <Download className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClear}
            className="h-6 text-[10px] text-destructive hover:text-destructive"
            aria-label="Clear scratchpad"
            disabled={!state.content}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div className="h-0.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              stats.pct > 0.8
                ? "bg-destructive"
                : stats.pct > 0.5
                  ? "bg-amber-500"
                  : "bg-accent"
            }`}
            style={{ width: `${Math.min(1, stats.pct) * 100}%` }}
          />
        </div>
      </div>
    </aside>
  );
}
