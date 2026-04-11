/**
 * CodeSnippetsPopover — code snippets library (Pass 254).
 *
 * A modal dialog where users browse + search + insert code snippets.
 * Complements `PromptTemplatesPopover` (Pass 214) which stores prompt
 * text; this one stores actual code blocks.
 */

import { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Copy,
  Trash2,
  Save,
  Code2,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  allSnippets,
  addSnippet,
  removeSnippet,
  filterSnippets,
  toMarkdownFence,
  loadUserSnippets,
  saveUserSnippets,
  validateSnippet,
  computeSnippetStats,
  type CodeSnippet,
  type SnippetCategory,
} from "./codeSnippets";

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * Called with the rendered markdown fence when the user picks Insert.
   * The parent typically appends to the chat input.
   */
  onInsert?: (markdown: string) => void;
}

const CATEGORIES: SnippetCategory[] = [
  "react",
  "trpc",
  "test",
  "shell",
  "sql",
  "config",
  "other",
];

export default function CodeSnippetsPopover({ open, onClose, onInsert }: Props) {
  const [userSnippets, setUserSnippets] = useState<CodeSnippet[]>([]);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SnippetCategory | "all">(
    "all",
  );
  const [creating, setCreating] = useState(false);

  // Create form state
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("typescript");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");

  // Load user snippets when opened
  useEffect(() => {
    if (open) {
      setUserSnippets(loadUserSnippets());
    }
  }, [open]);

  // Persist on every mutation
  useEffect(() => {
    if (open) {
      saveUserSnippets(userSnippets);
    }
  }, [userSnippets, open]);

  // Close on Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const visible = useMemo(() => {
    const combined = allSnippets(userSnippets);
    return filterSnippets(combined, {
      query: query || undefined,
      category: activeCategory === "all" ? undefined : activeCategory,
    });
  }, [userSnippets, query, activeCategory]);

  const stats = useMemo(
    () => computeSnippetStats(allSnippets(userSnippets)),
    [userSnippets],
  );

  const handleCreate = () => {
    try {
      const snippet = validateSnippet({
        name,
        code,
        language,
        description: description || undefined,
        tags: tagsRaw
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setUserSnippets((prev) => addSnippet(prev, snippet));
      toast.success("Snippet saved");
      setName("");
      setCode("");
      setDescription("");
      setTagsRaw("");
      setCreating(false);
    } catch (err: any) {
      toast.error(err.message ?? "Invalid snippet");
    }
  };

  const handleDelete = (id: string) => {
    setUserSnippets((prev) => removeSnippet(prev, id));
    toast.success("Snippet removed");
  };

  const handleCopy = async (snippet: CodeSnippet) => {
    try {
      await navigator.clipboard.writeText(snippet.code);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleInsert = (snippet: CodeSnippet) => {
    if (onInsert) {
      onInsert(toMarkdownFence(snippet));
      toast.success(`Inserted "${snippet.name}"`);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Code snippets library"
    >
      <div
        className="bg-background border border-border rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Code2 className="h-5 w-5 text-accent shrink-0" />
          <h2 className="font-semibold text-base">Code Snippets</h2>
          <Badge variant="outline" className="text-[10px] font-mono">
            {stats.userCount} user · {stats.builtinCount} built-in
          </Badge>
          <Button
            size="sm"
            variant={creating ? "default" : "outline"}
            className="ml-auto h-7 px-2 text-xs"
            onClick={() => setCreating((c) => !c)}
          >
            <Plus className="h-3 w-3 mr-1" />
            {creating ? "Cancel" : "New"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {creating && (
          <div className="p-4 border-b border-border space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Snippet name"
                aria-label="Snippet name"
              />
              <Input
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="Language (typescript, bash, sql…)"
                aria-label="Snippet language"
              />
            </div>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              aria-label="Snippet description"
            />
            <Input
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Tags (comma or space separated)"
              aria-label="Snippet tags"
            />
            <Textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste code here…"
              rows={8}
              className="font-mono text-xs"
              aria-label="Snippet code"
            />
            <Button
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim() || !code.trim()}
            >
              <Save className="h-3 w-3 mr-1.5" />
              Save snippet
            </Button>
          </div>
        )}

        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, or tag…"
              className="h-8 text-xs"
              aria-label="Search snippets"
              autoFocus
            />
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveCategory("all")}
              className={`px-2 py-0.5 rounded-full border transition ${
                activeCategory === "all"
                  ? "bg-accent/10 text-accent border-accent/40"
                  : "text-muted-foreground border-border/60"
              }`}
            >
              all · {stats.total}
            </button>
            {CATEGORIES.map((cat) => {
              const count = stats.categories[cat];
              if (count === 0) return null;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-0.5 rounded-full border transition capitalize ${
                    activeCategory === cat
                      ? "bg-accent/10 text-accent border-accent/40"
                      : "text-muted-foreground border-border/60"
                  }`}
                >
                  {cat} · {count}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/60">
          {visible.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No snippets match your filters.
            </div>
          ) : (
            visible.map((snippet) => (
              <div key={snippet.id} className="p-3 hover:bg-muted/30 transition">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="font-medium text-sm truncate">
                        {snippet.name}
                      </div>
                      {snippet.builtin && (
                        <Badge variant="outline" className="text-[10px]">
                          built-in
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono capitalize"
                      >
                        {snippet.category}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {snippet.language}
                      </span>
                    </div>
                    {snippet.description && (
                      <div className="text-xs text-muted-foreground mb-1">
                        {snippet.description}
                      </div>
                    )}
                    <pre className="font-mono text-[11px] bg-muted/50 rounded p-2 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {snippet.code}
                    </pre>
                    {snippet.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {snippet.tags.map((t) => (
                          <Badge
                            key={t}
                            variant="outline"
                            className="text-[10px] py-0 h-4"
                          >
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {onInsert && (
                      <Button
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleInsert(snippet)}
                      >
                        Insert
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => handleCopy(snippet)}
                      aria-label="Copy to clipboard"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    {!snippet.builtin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-destructive"
                        onClick={() => handleDelete(snippet.id)}
                        aria-label="Delete snippet"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
