/**
 * SessionsLibraryPopover — save / load / rename / delete saved
 * Code Chat sessions (Pass 212).
 *
 * Anchored popover triggered from the config bar. Reads the library
 * directly from localStorage via the sessionLibrary helpers so it
 * stays consistent across multiple open popovers in different tabs.
 */

import { useState, useEffect, useMemo } from "react";
import {
  loadLibrary,
  saveLibrary,
  upsertSession,
  deleteSession,
  renameSession,
  autoName,
  searchSessions,
  aggregateSessions,
  type SessionLibrary,
  type SessionSnapshot,
  type SessionSearchHit,
} from "./sessionLibrary";
import type { CodeChatMessage } from "@/hooks/useCodeChatStream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BookMarked,
  Save,
  Trash2,
  Pencil,
  Download,
  X,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";

export default function SessionsLibraryPopover({
  open,
  onClose,
  currentMessages,
  currentSessionId,
  onLoadSession,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  currentMessages: CodeChatMessage[];
  currentSessionId: string | null;
  onLoadSession: (session: SessionSnapshot) => void;
  onSaved: (sessionId: string) => void;
}) {
  const [library, setLibrary] = useState<SessionLibrary>(() => loadLibrary());
  const [newName, setNewName] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // Pass 221: cross-session full-text search
  const [searchQuery, setSearchQuery] = useState("");
  const searchHits: SessionSearchHit[] = useMemo(
    () => searchSessions(library, searchQuery, 50),
    [library, searchQuery],
  );
  // Pass 226: aggregated library stats
  const stats = useMemo(() => aggregateSessions(library), [library]);

  // Reload from storage when the popover opens so cross-tab changes
  // show up.
  useEffect(() => {
    if (open) {
      setLibrary(loadLibrary());
      setSearchQuery("");
    }
  }, [open]);

  const canSave = currentMessages.length > 0;
  const defaultName = useMemo(
    () => autoName(currentMessages),
    [currentMessages],
  );

  if (!open) return null;

  const handleSave = () => {
    if (!canSave) return;
    const now = Date.now();
    const id = currentSessionId ?? crypto.randomUUID();
    const name = (newName.trim() || defaultName).slice(0, 80);
    const existing = library.sessions.find((s) => s.id === id);
    const snapshot: SessionSnapshot = {
      id,
      name,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      messages: currentMessages,
    };
    const next = upsertSession(library, snapshot);
    setLibrary(next);
    saveLibrary(next);
    setNewName("");
    onSaved(id);
    toast.success(`Saved "${name}"`);
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this saved session?")) return;
    const next = deleteSession(library, id);
    setLibrary(next);
    saveLibrary(next);
    toast.success("Session deleted");
  };

  const handleRename = (id: string) => {
    const next = renameSession(library, id, renameDraft);
    setLibrary(next);
    saveLibrary(next);
    setRenamingId(null);
    setRenameDraft("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sessions library"
    >
      <div
        className="relative w-full max-w-xl max-h-[80vh] overflow-auto rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground"
          aria-label="Close sessions library"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="font-heading text-lg font-semibold text-foreground mb-1 flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-accent" /> Saved sessions
        </h2>
        <p className="text-[11px] text-muted-foreground mb-3">
          Snapshot the current conversation and switch between saved
          sessions. Stored in your browser (localStorage).
        </p>

        {/* Pass 226: aggregate stats strip */}
        {stats.totalSessions > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-border/40 bg-muted/10">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] font-mono tabular-nums">
              <span>
                <span className="text-foreground font-medium">
                  {stats.totalSessions}
                </span>{" "}
                <span className="text-muted-foreground">sessions</span>
              </span>
              <span>
                <span className="text-foreground font-medium">
                  {stats.totalMessages}
                </span>{" "}
                <span className="text-muted-foreground">messages</span>
              </span>
              <span>
                <span className="text-foreground font-medium">
                  {stats.totalToolCalls}
                </span>{" "}
                <span className="text-muted-foreground">tool calls</span>
              </span>
              {stats.modelsUsed.length > 0 && (
                <span>
                  <span className="text-foreground font-medium">
                    {stats.modelsUsed.length}
                  </span>{" "}
                  <span className="text-muted-foreground">models</span>
                </span>
              )}
            </div>
            {Object.keys(stats.toolCallsByKind).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {Object.entries(stats.toolCallsByKind)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([kind, count]) => (
                    <span
                      key={kind}
                      className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/40 bg-background/60 font-mono text-muted-foreground"
                    >
                      {kind} {count}
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Save current */}
        <div className="mb-4 p-3 rounded-lg border border-border/40 bg-muted/20 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Save current conversation
          </div>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={defaultName || "Name this session…"}
              className="h-8 text-xs"
              disabled={!canSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
            />
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!canSave}
              className="h-8 text-[10px]"
            >
              <Save className="h-3 w-3 mr-1" />
              Save
            </Button>
          </div>
          {!canSave && (
            <p className="text-[10px] text-muted-foreground italic">
              Send a message first to save a session.
            </p>
          )}
        </div>

        {/* Pass 221: cross-session search */}
        <div className="mb-3">
          <div className="relative">
            <Search className="h-3 w-3 absolute left-2 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search across saved sessions…"
              className="h-7 text-xs pl-7"
            />
          </div>
          {searchQuery.trim() && searchHits.length > 0 && (
            <div className="mt-2 space-y-1 max-h-40 overflow-y-auto rounded border border-border/40 p-2 bg-muted/10">
              {searchHits.map((hit, i) => {
                const session = library.sessions.find(
                  (s) => s.id === hit.sessionId,
                );
                return (
                  <button
                    key={`${hit.sessionId}-${hit.messageIndex}-${i}`}
                    type="button"
                    className="w-full text-left px-2 py-1 rounded hover:bg-secondary/40 transition-colors"
                    onClick={() => {
                      if (!session) return;
                      onLoadSession(session);
                      toast.success(`Loaded "${hit.sessionName}"`);
                    }}
                  >
                    <div className="text-[10px] text-accent font-medium truncate">
                      {hit.sessionName}{" "}
                      <span className="text-muted-foreground/60">
                        · msg {hit.messageIndex + 1} ({hit.messageRole})
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground font-mono truncate">
                      {hit.snippet.slice(0, hit.matchAt)}
                      <span className="bg-accent/30 text-accent-foreground font-medium">
                        {hit.snippet.slice(
                          hit.matchAt,
                          hit.matchAt + hit.matchLen,
                        )}
                      </span>
                      {hit.snippet.slice(hit.matchAt + hit.matchLen)}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {searchQuery.trim() && searchHits.length === 0 && (
            <p className="mt-2 text-[10px] text-muted-foreground italic">
              No matches in any saved session.
            </p>
          )}
        </div>

        {/* Session list */}
        <div className="space-y-1.5">
          {library.sessions.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">
              No saved sessions yet.
            </p>
          ) : (
            library.sessions.map((s) => (
              <div
                key={s.id}
                className={`flex items-center gap-2 px-2 py-1.5 rounded border text-xs ${
                  s.id === currentSessionId
                    ? "border-accent/50 bg-accent/5"
                    : "border-border/40 hover:bg-secondary/20"
                }`}
              >
                {renamingId === s.id ? (
                  <>
                    <Input
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      className="h-6 text-xs flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRename(s.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(s.id)}
                      aria-label="Confirm rename"
                      className="text-emerald-500 hover:text-emerald-400"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      aria-label="Cancel rename"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="flex-1 text-left min-w-0"
                      onClick={() => {
                        onLoadSession(s);
                        toast.success(`Loaded "${s.name}"`);
                      }}
                    >
                      <div className="truncate font-medium text-foreground">
                        {s.name}
                      </div>
                      <div className="text-[9px] text-muted-foreground/60 font-mono">
                        {s.messages.length} message
                        {s.messages.length === 1 ? "" : "s"} ·{" "}
                        {new Date(s.updatedAt).toLocaleString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingId(s.id);
                        setRenameDraft(s.name);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Rename ${s.name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${s.name}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {library.sessions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border/30 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {library.sessions.length} saved session
              {library.sessions.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1"
              onClick={() => {
                const payload = JSON.stringify(library, null, 2);
                const blob = new Blob([payload], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `codechat-sessions-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
            >
              <Download className="h-3 w-3" /> Export library
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
