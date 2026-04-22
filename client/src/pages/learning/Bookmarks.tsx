/**
 * Bookmarks.tsx — Cross-content bookmarking with notes
 *
 * Pass 36. Users can bookmark any learning content (definitions,
 * flashcards, questions, cases) and add personal notes.
 */
import { useState, useMemo, useCallback } from "react";
import { useOptimisticRemove } from "@/hooks/useOptimisticMutation";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Bookmark, ArrowLeft, Search, Trash2, Edit2,
  MessageSquare, BookOpen, Loader2, Plus,
} from "lucide-react";
import { toast } from "sonner";

export default function Bookmarks() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNote, setEditNote] = useState("");

  const bookmarksQ = trpc.learningSocial.bookmarks.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const utils = trpc.useUtils();
  const removeCallbacks = useOptimisticRemove({
    queryUtils: utils.learningSocial.bookmarks.list as any,
    removeItem: (data: any, id) => (Array.isArray(data) ? data.filter((b: any) => b.id !== id) : data),
    successMessage: "Bookmark removed",
    errorPrefix: "Failed to remove bookmark",
  });
  const removeMut = trpc.learningSocial.bookmarks.remove.useMutation(removeCallbacks);
  // @ts-expect-error — property access on loosely typed object
  const updateMut = trpc.learningSocial.bookmarks.update.useMutation({
    onSuccess: () => { bookmarksQ.refetch(); setEditingId(null); toast.success("Note updated"); },
    onError: () => toast.error("Failed to update note"),
  });

  const filteredBookmarks = useMemo(() => {
    const items = bookmarksQ.data ?? [];
    if (!searchTerm) return items;
    const q = searchTerm.toLowerCase();
    return items.filter((b: any) =>
      (b.title ?? "").toLowerCase().includes(q) ||
      (b.note ?? "").toLowerCase().includes(q) ||
      (b.contentType ?? "").toLowerCase().includes(q)
    );
  }, [bookmarksQ.data, searchTerm]);

  const handleEdit = useCallback((id: number, currentNote: string) => {
    setEditingId(id);
    setEditNote(currentNote ?? "");
  }, []);

  const handleSaveNote = useCallback(() => {
    if (editingId == null) return;
    updateMut.mutate({ id: editingId, note: editNote });
  }, [editingId, editNote, updateMut]);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Bookmarks" description="Your saved learning content" />
        <div className="container py-16 text-center space-y-4">
          <Bookmark className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Bookmarks</h1>
          <p className="text-muted-foreground">Sign in to view your bookmarks.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/bookmarks")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const total = bookmarksQ.data?.length ?? 0;

  return (
    <AppShell>
      <SEOHead title="Bookmarks" description="Your saved learning content" />
      <div className="container max-w-3xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-primary" />
              Bookmarks
            </h1>
            <p className="text-sm text-muted-foreground">{total} saved items</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search bookmarks..." className="pl-9" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {/* List */}
        {bookmarksQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : filteredBookmarks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bookmark className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p>{searchTerm ? "No bookmarks match your search" : "No bookmarks yet. Bookmark content from any learning page."}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredBookmarks.map((bm: any) => (
              <Card key={bm.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs capitalize">{bm.contentType ?? "item"}</Badge>
                        {bm.discipline && <Badge variant="secondary" className="text-xs">{bm.discipline}</Badge>}
                      </div>
                      <h3 className="font-medium truncate">{bm.title ?? `Item #${bm.contentId}`}</h3>
                      {bm.note && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                          <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          {bm.note}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Saved {bm.createdAt ? new Date(bm.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(bm.id, bm.note)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMut.mutate({ id: bm.id })} disabled={removeMut.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Edit Note Dialog */}
        <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Note</DialogTitle></DialogHeader>
            <Textarea placeholder="Add a personal note..." value={editNote} onChange={(e) => setEditNote(e.target.value)} rows={4} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={handleSaveNote} disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
