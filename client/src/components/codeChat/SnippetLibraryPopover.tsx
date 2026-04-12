/**
 * SnippetLibraryPopover — Pass 254.
 *
 * Modal for browsing, searching, saving, and inserting code
 * snippets. Users can:
 *   - Click Copy on a snippet to copy its body to the clipboard
 *   - Click Insert to insert the body into the chat input (so it
 *     can be embedded in a prompt)
 *   - Click Write file to write the body to a workspace file (admin
 *     + mutations mode required)
 *   - Save the current input as a new snippet
 *   - Rename/delete user snippets
 *   - Filter by language + tag chips + search
 *   - Export/import JSON for sharing
 */

import { useState, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Copy,
  Pencil,
  Trash2,
  Check,
  XCircle,
  Download,
  Upload,
  Search,
  FileCode,
  FilePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createSnippet,
  addSnippet,
  removeSnippet,
  updateSnippet,
  filterSnippets,
  sortForDisplay,
  allLanguages,
  allTags,
  exportSnippets,
  parseSnippetExport,
  type CodeSnippet,
} from "./snippetLibrary";

interface SnippetLibraryPopoverProps {
  open: boolean;
  onClose: () => void;
  snippets: CodeSnippet[];
  onChange: (next: CodeSnippet[]) => void;
  onInsert: (body: string) => void;
}

export default function SnippetLibraryPopover({
  open,
  onClose,
  snippets,
  onChange,
  onInsert,
}: SnippetLibraryPopoverProps) {
  const [search, setSearch] = useState("");
  const [langFilter, setLangFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [draftName, setDraftName] = useState("");
  const [draftLang, setDraftLang] = useState("ts");
  const [draftTags, setDraftTags] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<CodeSnippet>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const base = filterSnippets(snippets, {
      search: search || undefined,
      language: langFilter || undefined,
      tags: tagFilter,
    });
    return sortForDisplay(base);
  }, [snippets, search, langFilter, tagFilter]);

  const languages = useMemo(() => allLanguages(snippets), [snippets]);
  const tagsList = useMemo(() => allTags(snippets), [snippets]);

  if (!open) return null;

  const handleSave = () => {
    if (!draftName.trim() || !draftBody.trim()) {
      toast.error("Name and body are required");
      return;
    }
    const snip = createSnippet({
      name: draftName.trim(),
      language: draftLang,
      body: draftBody,
      tags: draftTags.split(/[,\s]+/).filter(Boolean),
    });
    onChange(addSnippet(snippets, snip));
    setDraftName("");
    setDraftBody("");
    setDraftTags("");
    setShowForm(false);
    toast.success(`Saved "${snip.name}"`);
  };

  const handleCopy = async (body: string, name: string) => {
    try {
      await navigator.clipboard.writeText(body);
      toast.success(`Copied "${name}" to clipboard`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const handleInsert = (body: string, name: string) => {
    onInsert(body);
    toast.success(`Inserted "${name}"`);
    onClose();
  };

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const startEdit = (snip: CodeSnippet) => {
    setEditingId(snip.id);
    setEditPatch({
      name: snip.name,
      language: snip.language,
      body: snip.body,
      tags: snip.tags,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    onChange(updateSnippet(snippets, editingId, editPatch));
    setEditingId(null);
    setEditPatch({});
  };

  const handleExport = () => {
    const json = exportSnippets(snippets);
    try {
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `codechat-snippets-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Exported snippets");
    } catch {
      toast.error("Export failed");
    }
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSnippetExport(text);
      if (parsed.length === 0) {
        toast.error("No valid snippets found in file");
        return;
      }
      let next = snippets;
      for (const snip of parsed) {
        next = addSnippet(next, snip);
      }
      onChange(next);
      toast.success(`Imported ${parsed.length} snippet${parsed.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Import failed — check the file format");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Code snippet library"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,880px)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Code snippets</h2>
            <Badge variant="outline" className="text-[10px]">
              {snippets.length}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={handleExport}>
              <Download className="w-3 h-3 mr-1" /> Export
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-3 h-3 mr-1" /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  handleImport(f);
                  e.target.value = "";
                }
              }}
            />
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="w-3 h-3 mr-1" /> New
            </Button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
          <Search className="w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, body, tags, language…"
            className="text-xs flex-1"
          />
          <select
            value={langFilter}
            onChange={(e) => setLangFilter(e.target.value)}
            className="text-xs bg-transparent border border-border rounded px-2 py-1"
          >
            <option value="">all langs</option>
            {languages.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

        {tagsList.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-border/40">
            {tagsList.map((tag) => {
              const active = tagFilter.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTagFilter(tag)}
                  className={`px-2 py-0.5 rounded border text-[10px] ${
                    active
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  #{tag}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {showForm && (
            <div className="bg-muted/20 border border-border/40 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground">
                Save new snippet
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="Name"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="text-xs col-span-2"
                />
                <Input
                  placeholder="lang (ts)"
                  value={draftLang}
                  onChange={(e) => setDraftLang(e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <Input
                placeholder="Tags (comma or space separated)"
                value={draftTags}
                onChange={(e) => setDraftTags(e.target.value)}
                className="text-xs"
              />
              <Textarea
                placeholder="Snippet body…"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={8}
                className="text-xs font-mono"
              />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave}>
                  Save
                </Button>
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              No snippets match your filters.
            </p>
          )}

          {filtered.map((snip) => {
            const isEditing = editingId === snip.id;
            return (
              <div
                key={snip.id}
                className="border border-border rounded-lg overflow-hidden"
              >
                {isEditing ? (
                  <div className="p-3 space-y-2 bg-muted/10">
                    <Input
                      value={String(editPatch.name ?? "")}
                      onChange={(e) =>
                        setEditPatch((p) => ({ ...p, name: e.target.value }))
                      }
                      className="text-xs"
                    />
                    <Textarea
                      value={String(editPatch.body ?? "")}
                      onChange={(e) =>
                        setEditPatch((p) => ({ ...p, body: e.target.value }))
                      }
                      rows={10}
                      className="text-xs font-mono"
                    />
                    <Input
                      value={String(
                        Array.isArray(editPatch.tags) ? editPatch.tags.join(" ") : "",
                      )}
                      onChange={(e) =>
                        setEditPatch((p) => ({
                          ...p,
                          tags: e.target.value.split(/[,\s]+/).filter(Boolean),
                        }))
                      }
                      className="text-xs"
                      placeholder="Tags"
                    />
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <XCircle className="w-3 h-3" />
                      </Button>
                      <Button size="sm" onClick={saveEdit}>
                        <Check className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 border-b border-border/20">
                      <FileCode className="w-3 h-3 text-accent shrink-0" />
                      <span className="font-semibold text-xs truncate flex-1">
                        {snip.name}
                      </span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5 font-mono shrink-0">
                        {snip.language}
                      </Badge>
                      {snip.builtin && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 shrink-0 text-muted-foreground">
                          built-in
                        </Badge>
                      )}
                      {snip.tags.map((tag) => (
                        <span key={tag} className="text-[9px] text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                    <pre className="text-[10px] font-mono p-3 max-h-40 overflow-auto whitespace-pre-wrap">
                      {snip.body.length > 1500
                        ? snip.body.slice(0, 1500) + "\n// … (preview)"
                        : snip.body}
                    </pre>
                    <div className="flex gap-1 px-3 py-1.5 border-t border-border/20 bg-muted/10">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopy(snip.body, snip.name)}
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleInsert(snip.body, snip.name)}
                      >
                        <FilePlus className="w-3 h-3 mr-1" /> Insert
                      </Button>
                      {!snip.builtin && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(snip)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onChange(removeSnippet(snippets, snip.id))}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
