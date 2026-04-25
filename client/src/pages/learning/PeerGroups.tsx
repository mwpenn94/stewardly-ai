/**
 * PeerGroups.tsx — Compliant Professional Peer Groups
 *
 * KE-inherited design: group cards with 2px accent bars, compliance badges,
 * member/post counts in font-mono, search with rounded-xl input,
 * font-display headings, motion animations, rich empty states.
 */
import { useState, useMemo } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SEOHead } from "@/components/SEOHead";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Shield, Search, MessageSquare, Lock,
  CheckCircle2, AlertTriangle, ArrowLeft, LogIn,
  Globe, UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import LearningShell from "@/components/LearningShell";

const GROUP_COLORS = ["#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#6366F1", "#EC4899", "#14B8A6"];

export default function PeerGroups() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const groupsQ = trpc.learning.peerGroups.list.useQuery(undefined, { retry: false, enabled: !!isAuthenticated });
  const joinMutation = trpc.learning.peerGroups.join.useMutation({
    onSuccess: () => {
      toast.success("Joined group", { description: "You've been added to the peer group." });
      groupsQ.refetch();
    },
    onError: (err) => {
      toast.error("Error", { description: err.message });
    },
  });

  const groups = useMemo(() => {
    // @ts-expect-error — property access on loosely typed object
    const all = groupsQ.data?.groups ?? [];
    if (!searchQuery.trim()) return all;
    const q = searchQuery.toLowerCase();
    return all.filter((g: any) =>
      g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q)
    );
  }, [groupsQ.data, searchQuery]);

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
        <SEOHead title="Peer Groups" description="Join compliant professional peer groups" />
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="text-center max-w-md">
            <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>
              Peer Groups
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              Sign in to join compliance-screened professional discussion groups.
            </p>
            <a
              href="/api/oauth/login"
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
      <SEOHead title="Peer Groups" description="Join compliant professional peer groups for collaborative learning" />
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
              <Users className="w-5 h-5" style={{ color: "var(--primary-foreground)" }} />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                Peer Groups
              </h1>
              <p className="text-xs text-muted-foreground">
                Compliance-screened professional discussion groups
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-emerald-400">Compliance Active</span>
            </div>
          </div>
        </motion.div>

        {/* Search — KE pattern */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search peer groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Groups Grid */}
        {groupsQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              No peer groups found
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {searchQuery ? "Try adjusting your search criteria." : "Check back later for new professional discussion groups."}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group: any, i: number) => {
              const color = GROUP_COLORS[i % GROUP_COLORS.length];
              return (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="group relative bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-all"
                >
                  {/* Accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-xl" style={{ background: color }} />

                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
                      <Users className="w-4 h-4" style={{ color }} />
                    </div>
                    {group.complianceGated && (
                      <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-amber-500/30 text-amber-400 bg-amber-500/5">
                        <Lock className="h-3 w-3" />
                        Gated
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
                    {group.name}
                  </h3>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 mb-3">
                    {group.description || "Professional discussion group"}
                  </p>

                  {/* Stats */}
                  <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {group.memberCount ?? 0} members
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      {group.postCount ?? 0} posts
                    </span>
                  </div>

                  {/* Compliance status */}
                  <div className="flex items-center gap-1.5 text-[10px] font-mono mb-4">
                    {group.complianceStatus === "approved" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Compliance approved</span>
                      </>
                    ) : group.complianceStatus === "review" ? (
                      <>
                        <AlertTriangle className="h-3 w-3 text-amber-400" />
                        <span className="text-amber-400">Under review</span>
                      </>
                    ) : (
                      <>
                        <Shield className="h-3 w-3 text-muted-foreground" />
                        <span>Standard screening</span>
                      </>
                    )}
                  </div>

                  {/* Action */}
                  {group.isMember ? (
                    <div className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-400 text-xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Joined
                    </div>
                  ) : (
                    <motion.button
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => joinMutation.mutate({ groupId: group.id })}
                      disabled={joinMutation.isPending}
                      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg border border-border bg-card text-sm font-medium hover:border-primary/30 hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Join Group
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </LearningShell>
  );
}
