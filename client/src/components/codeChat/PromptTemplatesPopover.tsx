/**
 * PromptTemplatesPopover — save / insert Code Chat prompt templates
 * (Pass 214).
 */

import { useState, useEffect, useMemo } from "react";
import {
  loadTemplates,
  saveTemplates,
  addTemplate,
  deleteTemplate,
  filterTemplates,
  extractTemplateVariables,
  applyTemplateVariables,
  type PromptTemplate,
} from "./promptTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  LibraryBig,
  Plus,
  Trash2,
  X,
  Search,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

export default function PromptTemplatesPopover({
  open,
  onClose,
  currentInput,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  currentInput: string;
  onInsert: (body: string) => void;
}) {
  const [templates, setTemplates] = useState<PromptTemplate[]>(() =>
    loadTemplates(),
  );
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");

  // Pass 218: variable-substitution form state
  const [pendingTemplate, setPendingTemplate] = useState<PromptTemplate | null>(
    null,
  );
  const [pendingVars, setPendingVars] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTemplates(loadTemplates());
      setQuery("");
      setShowCreate(false);
      setPendingTemplate(null);
      setPendingVars({});
    }
  }, [open]);

  const handleSelectTemplate = (t: PromptTemplate) => {
    const vars = extractTemplateVariables(t.body);
    if (vars.length === 0) {
      onInsert(t.body);
      onClose();
      toast.success(`Inserted "${t.name}"`);
      return;
    }
    // Open the variable form
    setPendingTemplate(t);
    const init: Record<string, string> = {};
    for (const v of vars) init[v] = "";
    setPendingVars(init);
  };

  const handleApplyPending = () => {
    if (!pendingTemplate) return;
    const body = applyTemplateVariables(pendingTemplate.body, pendingVars);
    onInsert(body);
    onClose();
    toast.success(`Inserted "${pendingTemplate.name}"`);
  };

  const filtered = useMemo(
    () => filterTemplates(templates, query),
    [templates, query],
  );

  if (!open) return null;

  const handleAdd = () => {
    const next = addTemplate(templates, { name: newName, body: newBody });
    if (next === templates) {
      toast.error("Name and body are required");
      return;
    }
    setTemplates(next);
    saveTemplates(next);
    setNewName("");
    setNewBody("");
    setShowCreate(false);
    toast.success("Template saved");
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this template?")) return;
    const next = deleteTemplate(templates, id);
    setTemplates(next);
    saveTemplates(next);
  };

  const saveFromInput = () => {
    if (!currentInput.trim()) {
      toast.info("Type a prompt first, then save it as a template");
      return;
    }
    setShowCreate(true);
    setNewBody(currentInput);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Prompt templates"
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close templates"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <LibraryBig className="h-4 w-4 text-accent" /> Prompt templates
        </h2>
        <p className="text-[11px] text-muted-foreground mb-4">
          Reusable macros. Click one to insert it into the input.
          Supports @file refs and slash commands.
        </p>

        {/* Pass 218: variable form (shown when a template with vars is picked) */}
        {pendingTemplate && (
          <div className="mb-4 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-wide text-amber-500">
                Fill in variables for "{pendingTemplate.name}"
              </div>
              <button
                type="button"
                onClick={() => {
                  setPendingTemplate(null);
                  setPendingVars({});
                }}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Cancel variable form"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            {Object.keys(pendingVars).map((name) => (
              <div key={name} className="space-y-1">
                <Label className="text-[10px] font-mono">{`{{${name}}}`}</Label>
                <Input
                  value={pendingVars[name]}
                  onChange={(e) =>
                    setPendingVars((prev) => ({
                      ...prev,
                      [name]: e.target.value,
                    }))
                  }
                  placeholder={`Value for ${name}`}
                  className="h-8 text-xs"
                  autoFocus={name === Object.keys(pendingVars)[0]}
                />
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleApplyPending}
                className="h-7 text-[10px]"
              >
                Insert with values
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (pendingTemplate) {
                    onInsert(pendingTemplate.body);
                    onClose();
                    toast.info("Inserted raw (placeholders left)");
                  }
                }}
                className="h-7 text-[10px]"
              >
                Insert raw
              </Button>
            </div>
          </div>
        )}

        {/* Search + actions */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="h-7 text-xs pl-7"
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={saveFromInput}
            className="h-7 text-[10px]"
          >
            <Plus className="h-3 w-3 mr-1" /> Save current
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowCreate(!showCreate);
              setNewBody("");
              setNewName("");
            }}
            className="h-7 text-[10px]"
          >
            <Plus className="h-3 w-3 mr-1" /> New
          </Button>
        </div>

        {/* Create form */}
        {showCreate && (
          <div className="mb-3 p-3 rounded border border-accent/30 bg-accent/5 space-y-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My refactor helper"
                className="h-8 text-xs"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Body</Label>
              <Textarea
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Read @file and…"
                rows={4}
                className="text-xs font-mono"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleAdd}
                className="h-7 text-[10px]"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCreate(false)}
                className="h-7 text-[10px]"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Template list */}
        <div className="space-y-1.5">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              No templates match "{query}"
            </p>
          ) : (
            filtered.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-2 px-3 py-2 rounded border border-border/40 hover:bg-secondary/20 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => handleSelectTemplate(t)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground truncate">
                      {t.name}
                    </span>
                    {t.builtin && (
                      <span className="text-[9px] uppercase tracking-wide text-accent">
                        built-in
                      </span>
                    )}
                    {(() => {
                      const vars = extractTemplateVariables(t.body);
                      if (vars.length === 0) return null;
                      return (
                        <span
                          className="text-[9px] uppercase tracking-wide text-amber-500"
                          title={`Variables: ${vars.join(", ")}`}
                        >
                          {vars.length} var{vars.length === 1 ? "" : "s"}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80 font-mono truncate">
                    {t.body.slice(0, 140)}
                    {t.body.length > 140 ? "…" : ""}
                  </div>
                </button>
                {!t.builtin && (
                  <button
                    type="button"
                    onClick={() => handleDelete(t.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${t.name}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/30 text-[10px] text-muted-foreground">
          {templates.length} template{templates.length === 1 ? "" : "s"} ·{" "}
          {templates.filter((t) => t.builtin).length} built-in /{" "}
          {templates.filter((t) => !t.builtin).length} custom
        </div>
      </div>
    </div>
  );
}
