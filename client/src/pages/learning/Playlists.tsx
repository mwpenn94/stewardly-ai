/**
 * Playlists.tsx — User-curated content lists
 *
 * KE-inherited design: playlist cards with color accents, item counts,
 * visibility badges, create/edit dialogs, share functionality,
 * font-display headings, font-mono metadata, motion animations.
 */
import { useState, useCallback } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ListMusic, ArrowLeft, Plus, Trash2, Edit2,
  Share2, Lock, Globe, Loader2, BookOpen,
  Play, Copy, LogIn, Users, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

const PLAYLIST_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#EC4899", "#14B8A6", "#F97316"];

export default function Playlists() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const playlistsQ = trpc.learningSocial.playlists.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const utils = trpc.useUtils();

  const createMut = trpc.learningSocial.playlists.create.useMutation({
    onSuccess: () => { utils.learningSocial.playlists.list.invalidate(); setShowCreate(false); setNewName(""); setNewDesc(""); toast.success("Playlist created"); },
    onError: () => toast.error("Failed to create playlist"),
  });
  // @ts-expect-error — property access on loosely typed object
  const updateMut = trpc.learningSocial.playlists.update.useMutation({
    onSuccess: () => { utils.learningSocial.playlists.list.invalidate(); setEditingId(null); toast.success("Playlist updated"); },
    onError: () => toast.error("Failed to update playlist"),
  });
  // @ts-expect-error — property access on loosely typed object
  const removeMut = trpc.learningSocial.playlists.remove.useMutation({
    onSuccess: () => { utils.learningSocial.playlists.list.invalidate(); toast.success("Playlist deleted"); },
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
    return (
      <LearningShell>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell>
        <SEOHead title="Playlists" description="Curated study playlists" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <ListMusic className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Study Playlists
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to create and manage curated study playlists.
            </p>
            <a
              href={getLoginUrl("/learning/playlists")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium bg-primary text-primary-foreground"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </a>
          </div>
        </div>
      </LearningShell>
    );
  }

  const playlists = playlistsQ.data ?? [];

  return (
    <LearningShell>
      <SEOHead title="Playlists" description="Curated study playlists" />
      <div className="min-h-screen px-6 lg:px-10 py-8">
        {/* Header — KE pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <ListMusic className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Study Playlists
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                {playlists.length} playlists
              </p>
            </div>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> New Playlist
            </motion.button>
          </div>
        </motion.div>

        {/* Playlists Grid */}
        {playlistsQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
          </div>
        ) : playlists.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <ListMusic className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              No playlists yet
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
              Create a playlist to organize your study content into curated collections.
            </p>
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Create First Playlist
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {playlists.map((pl: any, i: number) => {
              const color = PLAYLIST_COLORS[i % PLAYLIST_COLORS.length];
              return (
                <motion.div
                  key={pl.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all"
                >
                  {/* Accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl" style={{ background: color }} />

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                      <ListMusic className="w-4 h-4" style={{ color }} />
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleShare(pl)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Copy link"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditingId(pl.id); setEditName(pl.name); setEditDesc(pl.description ?? ""); }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeMut.mutate({ id: pl.id })}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
                        title="Delete"
                        disabled={removeMut.isPending}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    {pl.name}
                  </h3>
                  {pl.description && (
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">{pl.description}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {pl.itemCount ?? 0} items
                    </span>
                    <span className="flex items-center gap-1">
                      {pl.isPublic ? (
                        <><Globe className="w-3 h-3 text-emerald-400" /> Public</>
                      ) : (
                        <><Lock className="w-3 h-3" /> Private</>
                      )}
                    </span>
                    {pl.createdAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(pl.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Create Dialog — KE styled */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Create Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <input
                placeholder="Playlist name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
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
            <DialogHeader>
              <DialogTitle style={{ fontFamily: "var(--font-display)" }}>Edit Playlist</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <input
                placeholder="Playlist name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <textarea
                placeholder="Description (optional)"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
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
    </LearningShell>
  );
}
