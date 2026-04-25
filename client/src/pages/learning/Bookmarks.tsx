/**
 * Bookmarks.tsx — Cross-content bookmarking with notes
 *
 * KE-inherited design: grouped by content type with colored section headers,
 * 2px accent bars on cards, inline note editing with AnimatePresence,
 * filter pills, font-display headings, font-mono metadata.
 */
import { useState, useMemo, useCallback } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bookmark, BookmarkCheck, ArrowLeft, Search, Trash2,
  MessageSquare, Save, X, BookOpen, Calculator,
  GitBranch, Shield, StickyNote, LogIn,
  Library, Brain, ListMusic, Edit2,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useOptimisticRemove } from "@/hooks/useOptimisticMutation";

/* ── Content type metadata (KE pattern) ── */
const CONTENT_TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  definition: { label: "Definitions", icon: BookOpen, color: "#8B5CF6" },
  formula: { label: "Formulas", icon: Calculator, color: "#10B981" },
  case: { label: "Case Studies", icon: GitBranch, color: "#F59E0B" },
  flashcard: { label: "Flashcards", icon: ListMusic, color: "#0E6655" },
  question: { label: "Practice Questions", icon: Brain, color: "#6C3483" },
  section: { label: "Track Sections", icon: Library, color: "#1B4F72" },
  item: { label: "General", icon: BookOpen, color: "#6366F1" },
};

export default function Bookmarks() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");

  const bookmarksQ = trpc.learningSocial.bookmarks.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const utils = trpc.useUtils();

  const optimisticRemoveCallbacks = useOptimisticRemove({
    queryKey: ["learningSocial", "bookmarks", "list"],
    getId: (item: any) => item.id,
  });
  const removeMut = trpc.learningSocial.bookmarks.remove.useMutation({
    ...optimisticRemoveCallbacks,
    onSuccess: (...args: any[]) => { optimisticRemoveCallbacks.onSuccess?.(...args); utils.learningSocial.bookmarks.list.invalidate(); toast.success("Bookmark removed"); },
    onError: (...args: any[]) => { optimisticRemoveCallbacks.onError?.(...args); toast.error("Failed to remove bookmark"); },
  });
  // @ts-expect-error — property access on loosely typed object
  const updateMut = trpc.learningSocial.bookmarks.update.useMutation({
    onSuccess: () => { utils.learningSocial.bookmarks.list.invalidate(); setEditingNote(null); toast.success("Note updated"); },
    onError: () => toast.error("Failed to update note"),
  });

  const bookmarks = bookmarksQ.data ?? [];

  const filtered = useMemo(() => {
    let items = bookmarks;
    if (typeFilter) {
      items = items.filter((b: any) => (b.contentType ?? "item") === typeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((b: any) =>
        (b.title ?? "").toLowerCase().includes(q) ||
        (b.note ?? "").toLowerCase().includes(q) ||
        (b.contentType ?? "").toLowerCase().includes(q) ||
        (b.discipline ?? "").toLowerCase().includes(q)
      );
    }
    return items;
  }, [bookmarks, search, typeFilter]);

  // Group by content type (KE pattern)
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filtered.forEach((b: any) => {
      const type = b.contentType ?? "item";
      if (!groups[type]) groups[type] = [];
      groups[type].push(b);
    });
    return groups;
  }, [filtered]);

  const typeKeys = Object.keys(grouped);

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
        <SEOHead title="Bookmarks" description="Your saved learning content" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Bookmark className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Content Bookmarks
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to save bookmarks and personal notes across devices.
            </p>
            <a
              href={getLoginUrl("/learning/bookmarks")}
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

  return (
    <LearningShell>
      <SEOHead title="Bookmarks" description="Your saved learning content" />
      <div className="min-h-screen px-6 lg:px-10 py-8">
        {/* Header — KE pattern */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <BookmarkCheck className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Bookmarks
              </h1>
              <p className="text-xs text-muted-foreground">
                {bookmarks.length} saved items across {Object.keys(CONTENT_TYPE_META).filter(t => grouped[t]).length} categories
              </p>
            </div>
          </div>
        </motion.div>

        {/* Search and Filter — KE pattern */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search bookmarks..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setTypeFilter(null)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                !typeFilter ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            {Object.entries(CONTENT_TYPE_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const hasItems = bookmarks.some((b: any) => (b.contentType ?? "item") === key);
              if (!hasItems && typeFilter !== key) return null;
              return (
                <button
                  key={key}
                  onClick={() => setTypeFilter(typeFilter === key ? null : key)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    typeFilter === key ? "bg-primary text-primary-foreground" : "bg-card border border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading */}
        {bookmarksQ.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          /* Empty State — KE pattern */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Bookmark className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              {bookmarks.length === 0 ? "No bookmarks yet" : "No matches found"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {bookmarks.length === 0
                ? "Bookmark definitions, flashcards, and questions as you study. Look for the bookmark icon on content cards."
                : "Try adjusting your search or filter criteria."}
            </p>
          </motion.div>
        ) : (
          /* Bookmark Groups — KE pattern */
          <div className="space-y-8">
            {typeKeys.map(type => {
              const meta = CONTENT_TYPE_META[type] || { label: type, icon: BookOpen, color: "#6366F1" };
              const Icon = meta.icon;
              const items = grouped[type];

              return (
                <motion.section
                  key={type}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}20` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: meta.color }} />
                    </div>
                    <h2 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                      {meta.label}
                    </h2>
                    <span className="text-[10px] font-mono text-muted-foreground">{items.length}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map((bm: any) => {
                      const isEditing = editingNote === bm.id;

                      return (
                        <motion.div
                          key={bm.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-all"
                        >
                          {/* Accent bar */}
                          <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl" style={{ background: meta.color }} />

                          {/* Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {bm.discipline && (
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-accent text-accent-foreground truncate">
                                  {bm.discipline}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => { setEditingNote(bm.id); setNoteText(bm.note ?? ""); }}
                                className="p-1 rounded text-muted-foreground hover:text-foreground"
                                title="Edit note"
                              >
                                <StickyNote className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => removeMut.mutate({ id: bm.id })}
                                className="p-1 rounded text-muted-foreground hover:text-destructive"
                                title="Remove bookmark"
                                disabled={removeMut.isPending}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-semibold mb-1 line-clamp-2" style={{ fontFamily: "var(--font-display)" }}>
                            {bm.title ?? `Item #${bm.contentId}`}
                          </h3>

                          {/* Note — KE inline editing pattern */}
                          <AnimatePresence mode="wait">
                            {isEditing ? (
                              <motion.div
                                key="editing"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-2"
                              >
                                <textarea
                                  value={noteText}
                                  onChange={e => setNoteText(e.target.value)}
                                  placeholder="Add your notes..."
                                  className="w-full h-16 text-xs bg-background border border-border rounded-md p-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-1 mt-1">
                                  <button
                                    onClick={() => setEditingNote(null)}
                                    className="px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => updateMut.mutate({ id: bm.id, note: noteText || undefined })}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground"
                                    disabled={updateMut.isPending}
                                  >
                                    <Save className="w-3 h-3" />
                                    Save
                                  </button>
                                </div>
                              </motion.div>
                            ) : bm.note ? (
                              <motion.div
                                key="note"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="mt-2 p-2 rounded-md bg-accent/50 border border-border/50"
                              >
                                <div className="flex items-start gap-1.5">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                                  <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">
                                    {bm.note}
                                  </p>
                                </div>
                              </motion.div>
                            ) : null}
                          </AnimatePresence>

                          {/* Timestamp */}
                          <p className="text-[9px] text-muted-foreground/60 mt-2 font-mono">
                            {bm.createdAt ? new Date(bm.createdAt).toLocaleDateString() : ""}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.section>
              );
            })}
          </div>
        )}
      </div>
    </LearningShell>
  );
}
