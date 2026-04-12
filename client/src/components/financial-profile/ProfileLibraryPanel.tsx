/**
 * ProfileLibraryPanel — advisor-facing modal that lists every
 * saved client profile, lets the advisor save the current profile
 * under a new label, switch to a saved entry (making it the
 * active profile), rename, or delete. Sits alongside the active
 * profile in localStorage.
 *
 * The component is a plain modal — not a popover — so it works
 * on mobile where popovers are cramped.
 *
 * Pass 10 history: ships the UI layer for gap G8.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  BookOpen,
  Check,
  Library,
  Pencil,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import {
  PROFILE_LIBRARY_STORAGE_KEY,
  type LibraryEntry,
  type ProfileLibrary,
  deleteEntry,
  filterEntries,
  libraryStats,
  parseLibrary,
  renameEntry,
  saveEntry,
  serializeLibrary,
} from "@/stores/profileLibrary";
import { profileCompleteness } from "@shared/financialProfile";
import { cn } from "@/lib/utils";

interface ProfileLibraryPanelProps {
  open: boolean;
  onClose: () => void;
}

function readLibraryFromStorage(): ProfileLibrary {
  if (typeof window === "undefined") {
    return { version: 1, entries: [] };
  }
  try {
    return parseLibrary(window.localStorage.getItem(PROFILE_LIBRARY_STORAGE_KEY));
  } catch {
    return { version: 1, entries: [] };
  }
}

function writeLibraryToStorage(lib: ProfileLibrary) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PROFILE_LIBRARY_STORAGE_KEY,
      serializeLibrary(lib),
    );
  } catch {
    /* quota full — fall back to in-memory */
  }
}

export function ProfileLibraryPanel({ open, onClose }: ProfileLibraryPanelProps) {
  const { profile, replaceProfile } = useFinancialProfile();
  const [library, setLibrary] = useState<ProfileLibrary>(() =>
    readLibraryFromStorage(),
  );
  const [query, setQuery] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const [saveNotes, setSaveNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Refresh when the modal opens so cross-tab edits appear.
  useEffect(() => {
    if (!open) return;
    setLibrary(readLibraryFromStorage());
  }, [open]);

  // Also subscribe to storage events so a second tab's save shows up
  // live if the panel is open.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === PROFILE_LIBRARY_STORAGE_KEY) {
        setLibrary(readLibraryFromStorage());
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [open]);

  // Esc-to-close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const filtered = useMemo(() => filterEntries(library, query), [library, query]);
  const stats = useMemo(() => libraryStats(library), [library]);

  const persist = useCallback((next: ProfileLibrary) => {
    writeLibraryToStorage(next);
    setLibrary(next);
  }, []);

  const handleSave = useCallback(() => {
    if (!saveLabel.trim()) return;
    const next = saveEntry(library, {
      label: saveLabel,
      profile,
      notes: saveNotes || undefined,
    });
    persist(next);
    setSaveLabel("");
    setSaveNotes("");
  }, [saveLabel, saveNotes, library, profile, persist]);

  const handleSwitch = useCallback(
    (entry: LibraryEntry) => {
      replaceProfile(entry.profile, "advisor_intake");
      onClose();
    },
    [replaceProfile, onClose],
  );

  const handleDelete = useCallback(
    (id: string) => {
      persist(deleteEntry(library, id));
    },
    [library, persist],
  );

  const handleBeginEdit = useCallback((entry: LibraryEntry) => {
    setEditingId(entry.id);
    setEditLabel(entry.label);
    setEditNotes(entry.notes ?? "");
  }, []);

  const handleCommitEdit = useCallback(() => {
    if (!editingId) return;
    persist(renameEntry(library, editingId, { label: editLabel, notes: editNotes }));
    setEditingId(null);
    setEditLabel("");
    setEditNotes("");
  }, [editingId, editLabel, editNotes, library, persist]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditLabel("");
    setEditNotes("");
  }, []);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-library-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto bg-card border border-border rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4 text-accent" />
            <h2 id="profile-library-title" className="text-base font-semibold">
              Profile Library
            </h2>
            {stats.count > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">
                {stats.count} saved
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close profile library"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-5">
          {/* Stats strip */}
          {stats.count > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <StatBox label="Saved profiles" value={stats.count} />
              <StatBox
                label="Avg completeness"
                value={`${Math.round(stats.avgCompleteness * 100)}%`}
              />
              <StatBox label="Fully populated" value={stats.fullCount} />
              <StatBox label="Empty shells" value={stats.emptyCount} />
            </div>
          )}

          {/* Save current profile */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Save className="w-3 h-3" />
                Save current profile
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="space-y-2">
                  <Label className="text-xs">Label</Label>
                  <Input
                    value={saveLabel}
                    onChange={(e) => setSaveLabel(e.target.value)}
                    placeholder="e.g. Jane Doe — retirement prospect"
                    maxLength={200}
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={!saveLabel.trim()}
                  className="self-end"
                >
                  <Save className="w-3.5 h-3.5 mr-1" />
                  Save
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  value={saveNotes}
                  onChange={(e) => setSaveNotes(e.target.value)}
                  placeholder="Meeting context, referral source, priority, etc."
                  maxLength={2000}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Library list */}
          {library.entries.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>No saved profiles yet.</p>
              <p className="text-xs mt-1">
                Save the active profile above to build your library.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by label or notes..."
                  className="pl-7 h-8 text-xs"
                />
              </div>
              {filtered.map((entry) => {
                const c = Math.round(profileCompleteness(entry.profile) * 100);
                const isEditing = editingId === entry.id;
                return (
                  <Card key={entry.id} className={cn(isEditing && "border-accent")}>
                    <CardContent className="pt-3 space-y-2">
                      {isEditing ? (
                        <>
                          <div className="space-y-2">
                            <Label className="text-xs">Label</Label>
                            <Input
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              maxLength={200}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                              value={editNotes}
                              onChange={(e) => setEditNotes(e.target.value)}
                              rows={2}
                              maxLength={2000}
                            />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                              Cancel
                            </Button>
                            <Button size="sm" onClick={handleCommitEdit}>
                              <Check className="w-3 h-3 mr-1" /> Save
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                <p className="text-sm font-medium truncate" title={entry.label}>
                                  {entry.label}
                                </p>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-4 px-1 font-mono tabular-nums"
                                >
                                  {c}%
                                </Badge>
                              </div>
                              {entry.notes && (
                                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                  {entry.notes}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground/70 mt-1">
                                Saved {new Date(entry.savedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSwitch(entry)}
                                aria-label={`Switch to ${entry.label}`}
                              >
                                Switch
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleBeginEdit(entry)}
                                aria-label={`Edit ${entry.label}`}
                              >
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(entry.id)}
                                aria-label={`Delete ${entry.label}`}
                              >
                                <Trash2 className="w-3 h-3 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
              {filtered.length === 0 && query && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No matches for &ldquo;{query}&rdquo;.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-md border p-2 space-y-0.5">
      <p className="text-[9px] uppercase text-muted-foreground tracking-wide">
        {label}
      </p>
      <p className="text-sm font-mono tabular-nums">{value}</p>
    </div>
  );
}
