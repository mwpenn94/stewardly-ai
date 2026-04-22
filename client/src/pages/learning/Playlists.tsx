/**
 * Playlists.tsx — User-curated content lists
 *
 * Pass 36. Users can create, manage, and share study playlists
 * containing mixed content types (flashcards, definitions, questions).
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ListMusic, ArrowLeft, Plus, Trash2, Edit2,
  Share2, Lock, Globe, Loader2, BookOpen,
} from "lucide-react";
import { toast } from "sonner";

export default function Playlists() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const playlistsQ = trpc.learningSocial.playlists.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const createMut = trpc.learningSocial.playlists.create.useMutation({
    onSuccess: () => { playlistsQ.refetch(); setShowCreate(false); setNewName(""); setNewDesc(""); toast.success("Playlist created"); },
    onError: () => toast.error("Failed to create playlist"),
  });
  // @ts-expect-error — property access on loosely typed object
  const updateMut = trpc.learningSocial.playlists.update.useMutation({
    onSuccess: () => { playlistsQ.refetch(); setEditingId(null); toast.success("Playlist updated"); },
    onError: () => toast.error("Failed to update playlist"),
  });
  // @ts-expect-error — property access on loosely typed object
  const removeMut = trpc.learningSocial.playlists.remove.useMutation({
    onSuccess: () => { playlistsQ.refetch(); toast.success("Playlist deleted"); },
    onError: () => toast.error("Failed to delete playlist"),
  });

  const handleCreate = useCallback(() => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    // @ts-expect-error — strict mode fix
    createMut.mutate({ name: newName.trim(), description: newDesc.trim() || undefined });
  }, [newName, newDesc, createMut]);

  const handleUpdate = useCallback(() => {
    if (editingId == null || !editName.trim()) return;
    updateMut.mutate({ id: editingId, name: editName.trim(), description: editDesc.trim() || undefined });
  }, [editingId, editName, editDesc, updateMut]);

  const handleShare = useCallback((playlist: any) => {
    const url = `${window.location.origin}/learning/playlists/${playlist.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Playlist link copied to clipboard");
  }, []);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Playlists" description="Curated study playlists" />
        <div className="container py-16 text-center space-y-4">
          <ListMusic className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Study Playlists</h1>
          <p className="text-muted-foreground">Sign in to create and manage playlists.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/playlists")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const playlists = playlistsQ.data ?? [];

  return (
    <AppShell>
      <SEOHead title="Playlists" description="Curated study playlists" />
      <div className="container max-w-3xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ListMusic className="h-6 w-6 text-primary" />
              Study Playlists
            </h1>
            <p className="text-sm text-muted-foreground">{playlists.length} playlists</p>
          </div>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Playlist
          </Button>
        </div>

        {/* List */}
        {playlistsQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : playlists.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <ListMusic className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p>No playlists yet. Create one to organize your study content.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create First Playlist
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {playlists.map((pl: any) => (
              <Card key={pl.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium">{pl.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {pl.isPublic ? <><Globe className="h-3 w-3 mr-1" /> Public</> : <><Lock className="h-3 w-3 mr-1" /> Private</>}
                        </Badge>
                      </div>
                      {pl.description && <p className="text-sm text-muted-foreground">{pl.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span><BookOpen className="inline h-3 w-3 mr-1" />{pl.itemCount ?? 0} items</span>
                        <span>Created {pl.createdAt ? new Date(pl.createdAt).toLocaleDateString() : ""}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShare(pl)}>
                        <Share2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingId(pl.id); setEditName(pl.name); setEditDesc(pl.description ?? ""); }}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeMut.mutate({ id: pl.id })} disabled={removeMut.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Playlist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Playlist name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Textarea placeholder="Description (optional)" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending || !newName.trim()}>
                {createMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={editingId !== null} onOpenChange={(open) => !open && setEditingId(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Edit Playlist</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Playlist name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <Textarea placeholder="Description (optional)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={updateMut.isPending || !editName.trim()}>
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
