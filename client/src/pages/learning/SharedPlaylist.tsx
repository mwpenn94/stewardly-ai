/**
 * SharedPlaylist.tsx — Public share viewer for playlists
 *
 * Pass 64d. Allows users to view a shared playlist via a share token.
 * Shows playlist name, description, and all items in order.
 */
import { useRoute, Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, ListMusic, BookOpen, Clock, User,
} from "lucide-react";
import { motion } from "framer-motion";

export default function SharedPlaylist() {
  const [, params] = useRoute("/learning/shared/:shareToken");
  const shareToken = params?.shareToken ?? "";

  const playlistQ = trpc.learningSocial.playlists.getShared.useQuery(
    { shareToken },
    { enabled: !!shareToken, retry: false },
  );
  const playlist = playlistQ.data ?? null;
  const isLoading = playlistQ.isLoading;
  const isError = playlistQ.isError;

  return (
    <LearningShell>
      <SEOHead title={playlist?.title ? `Shared: ${playlist.title}` : "Shared Playlist"} description="View a shared study playlist" />
      <div className="min-h-screen">
        <div className="px-4 sm:px-6 lg:px-10 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <motion.div whileHover={{ x: -2 }} className="p-1.5 rounded-lg hover:bg-accent transition-colors">
                <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              </motion.div>
            </Link>
            <ListMusic className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>Shared Playlist</h1>
              <p className="text-xs text-muted-foreground font-mono">{shareToken.slice(0, 8)}...</p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 lg:px-10 py-6 max-w-2xl mx-auto">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          ) : isError || !playlist ? (
            <div className="text-center py-20">
              <ListMusic className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h2 className="text-lg font-semibold mb-1">Playlist Not Found</h2>
              <p className="text-sm text-muted-foreground mb-4">This shared playlist may have expired or been removed.</p>
              <Link href="/learning"><Button variant="outline" size="sm">Back to Learning</Button></Link>
            </div>
          ) : (
            <>
              {/* Playlist header */}
              <Card className="mb-6">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <ListMusic className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg">{playlist.title}</CardTitle>
                      {playlist.description && (
                        <p className="text-sm text-muted-foreground mt-1">{playlist.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {playlist.ownerName && (
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> {playlist.ownerName}</span>
                        )}
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {playlist.items?.length ?? 0} items</span>
                        {playlist.createdAt && (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(playlist.createdAt).toLocaleDateString()}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Playlist items */}
              <div className="space-y-2">
                {(playlist.items ?? []).map((item: any, i: number) => (
                  <motion.div
                    key={item.id ?? i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.5) }}
                  >
                    <Card className="hover:border-primary/20 transition-colors">
                      <CardContent className="p-4 flex items-center gap-3">
                        <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium">{item.title ?? item.term ?? `Item ${i + 1}`}</h3>
                          {item.definition && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.definition}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[9px] shrink-0">{item.type ?? "card"}</Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {(playlist.items ?? []).length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">This playlist is empty.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </LearningShell>
  );
}
