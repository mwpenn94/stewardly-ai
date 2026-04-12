/**
 * WorkspaceBookmarksPopover — Pass 259.
 *
 * Modal for managing workspace file bookmarks. Users can:
 *   - Add a new bookmark (path + optional label + folder + color)
 *   - Filter by search
 *   - Click a bookmark to open the file in the FileBrowser
 *   - Edit label/folder/color inline
 *   - Delete
 */

import { useState, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  XCircle,
  Bookmark,
  FolderOpen,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  addBookmark,
  removeBookmark,
  updateBookmark,
  createBookmark,
  groupByFolder,
  filterBookmarks,
  allFolders,
  type WorkspaceBookmark,
  type BookmarkColor,
} from "./workspaceBookmarks";

const COLOR_CLASS: Record<BookmarkColor, string> = {
  default: "text-muted-foreground",
  red: "text-destructive",
  amber: "text-amber-500",
  green: "text-emerald-500",
  blue: "text-chart-3",
  purple: "text-chart-5",
};

const COLORS: BookmarkColor[] = ["default", "red", "amber", "green", "blue", "purple"];

interface WorkspaceBookmarksPopoverProps {
  open: boolean;
  onClose: () => void;
  bookmarks: WorkspaceBookmark[];
  onChange: (next: WorkspaceBookmark[]) => void;
}

export default function WorkspaceBookmarksPopover({
  open,
  onClose,
  bookmarks,
  onChange,
}: WorkspaceBookmarksPopoverProps) {
  const [search, setSearch] = useState("");
  const [draftPath, setDraftPath] = useState("");
  const [draftLabel, setDraftLabel] = useState("");
  const [draftFolder, setDraftFolder] = useState("");
  const [draftColor, setDraftColor] = useState<BookmarkColor>("default");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPatch, setEditPatch] = useState<Partial<WorkspaceBookmark>>({});

  const filtered = useMemo(() => filterBookmarks(bookmarks, search), [bookmarks, search]);
  const groups = useMemo(() => groupByFolder(filtered), [filtered]);
  const folders = useMemo(() => allFolders(bookmarks), [bookmarks]);

  if (!open) return null;

  const handleAdd = () => {
    if (!draftPath.trim()) return;
    onChange(
      addBookmark(
        bookmarks,
        createBookmark(draftPath, {
          label: draftLabel,
          folder: draftFolder,
          color: draftColor,
        }),
      ),
    );
    setDraftPath("");
    setDraftLabel("");
    // Keep folder+color between adds for batch-entering a group
  };

  const handleOpen = (b: WorkspaceBookmark) => {
    window.dispatchEvent(
      new CustomEvent("codechat-open-file", {
        detail: { path: b.path, line: b.line },
      }),
    );
    onClose();
  };

  const startEdit = (b: WorkspaceBookmark) => {
    setEditingId(b.id);
    setEditPatch({
      label: b.label,
      folder: b.folder,
      color: b.color,
    });
  };

  const saveEdit = () => {
    if (!editingId) return;
    onChange(updateBookmark(bookmarks, editingId, editPatch));
    setEditingId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Workspace bookmarks"
    >
      <div
        className="bg-card border border-border rounded-lg shadow-xl w-[min(95vw,760px)] max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-accent" />
            <h2 className="font-heading text-base">Workspace bookmarks</h2>
            <Badge variant="outline" className="text-[10px]">
              {bookmarks.length}
            </Badge>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border/40 bg-muted/10 space-y-2">
          <div className="text-xs font-semibold text-muted-foreground">Add bookmark</div>
          <Input
            placeholder="path (e.g. server/routers/codeChat.ts)"
            value={draftPath}
            onChange={(e) => setDraftPath(e.target.value)}
            className="text-xs font-mono"
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Label (optional)"
              value={draftLabel}
              onChange={(e) => setDraftLabel(e.target.value)}
              className="text-xs"
            />
            <Input
              placeholder="Folder (optional)"
              value={draftFolder}
              onChange={(e) => setDraftFolder(e.target.value)}
              list="bookmark-folders"
              className="text-xs"
            />
            <datalist id="bookmark-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraftColor(c)}
                  className={`w-5 h-5 rounded border ${
                    draftColor === c ? "border-accent" : "border-border"
                  }`}
                  aria-label={`Color ${c}`}
                  title={c}
                >
                  <Bookmark
                    className={`w-3 h-3 m-auto ${COLOR_CLASS[c]}`}
                    fill={draftColor === c ? "currentColor" : "none"}
                  />
                </button>
              ))}
            </div>
            <Button size="sm" onClick={handleAdd} disabled={!draftPath.trim()}>
              <Plus className="w-3 h-3 mr-1" /> Add
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
          <Search className="w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter bookmarks…"
            className="text-xs flex-1"
          />
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-3">
          {groups.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center py-8">
              No bookmarks yet. Add one above.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.folder}>
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                <FolderOpen className="w-3 h-3" />
                {group.folder}
                <span>· {group.bookmarks.length}</span>
              </div>
              <div className="space-y-1">
                {group.bookmarks.map((b) => {
                  const isEditing = editingId === b.id;
                  return (
                    <div
                      key={b.id}
                      className="p-2 rounded border border-border flex items-center gap-2 text-xs"
                    >
                      <Bookmark
                        className={`w-3 h-3 ${COLOR_CLASS[b.color]}`}
                        fill="currentColor"
                      />
                      {isEditing ? (
                        <div className="flex-1 space-y-1">
                          <Input
                            value={String(editPatch.label ?? "")}
                            onChange={(e) =>
                              setEditPatch((p) => ({ ...p, label: e.target.value }))
                            }
                            placeholder="Label"
                            className="text-xs h-7"
                          />
                          <Input
                            value={String(editPatch.folder ?? "")}
                            onChange={(e) =>
                              setEditPatch((p) => ({ ...p, folder: e.target.value }))
                            }
                            placeholder="Folder"
                            className="text-xs h-7"
                          />
                          <div className="flex gap-1">
                            {COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() =>
                                  setEditPatch((p) => ({ ...p, color: c }))
                                }
                                className={`w-5 h-5 rounded border ${
                                  editPatch.color === c
                                    ? "border-accent"
                                    : "border-border"
                                }`}
                              >
                                <Bookmark
                                  className={`w-3 h-3 m-auto ${COLOR_CLASS[c]}`}
                                  fill={editPatch.color === c ? "currentColor" : "none"}
                                />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex-1 min-w-0 text-left"
                          onClick={() => handleOpen(b)}
                          title={`Open ${b.path}`}
                        >
                          <div className="font-mono truncate">
                            {b.label || b.path}
                            {b.line != null && (
                              <span className="text-muted-foreground">:{b.line}</span>
                            )}
                          </div>
                          {b.label && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {b.path}
                            </div>
                          )}
                        </button>
                      )}
                      <div className="flex gap-1 shrink-0">
                        {isEditing ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              <XCircle className="w-3 h-3" />
                            </Button>
                            <Button size="sm" onClick={saveEdit}>
                              <Check className="w-3 h-3" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(b)}
                              aria-label="Edit bookmark"
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => onChange(removeBookmark(bookmarks, b.id))}
                              aria-label="Delete bookmark"
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
