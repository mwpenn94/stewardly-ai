/**
 * §P1-4 Compliant Professional Peer Groups — UI
 * Lists available peer groups, shows compliance status, and allows joining.
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Shield, Search, MessageSquare, Lock, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import LearningShell from "@/components/LearningShell";
export default function PeerGroups() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const groupsQ = trpc.learning.peerGroups.list.useQuery(undefined, { retry: false });
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

  return (
    <LearningShell title="Peer Groups">
      <SEOHead title="Peer Groups" description="Join compliant professional peer groups for collaborative learning" />
      <div className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Peer Groups
            </h1>
            <p className="text-muted-foreground mt-1">
              Compliance-screened professional discussion groups
            </p>
          </div>
          <Badge variant="outline" className="border-green-500/30 text-green-400 gap-1">
            <Shield className="h-3 w-3" />
            Compliance Active
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search peer groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Groups grid */}
        {groupsQ.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mb-3 opacity-40" />
              <p className="font-medium">No peer groups found</p>
              <p className="text-sm">Check back later or adjust your search.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group: any) => (
              <Card key={group.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.complianceGated && (
                      <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                        <Lock className="h-3 w-3 mr-1" />
                        Gated
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {group.description || "Professional discussion group"}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
                  <div className="flex items-center gap-1 text-xs">
                    {group.complianceStatus === "approved" ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                        <span className="text-green-400">Compliance approved</span>
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

                  {group.isMember ? (
                    <Button variant="outline" size="sm" className="w-full" disabled>
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Joined
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => joinMutation.mutate({ groupId: group.id })}
                      disabled={joinMutation.isPending}
                    >
                      Join Group
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </LearningShell>
  );
}
