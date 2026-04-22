/**
 * StudyGroups.tsx — Collaborative study spaces
 *
 * Pass 36. Users can create/join study groups with invite codes,
 * share progress, and collaborate on learning goals.
 */
import { useState, useCallback } from "react";
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
  Users, ArrowLeft, Plus, Copy, UserPlus,
  Crown, Loader2, LogIn, Settings,
} from "lucide-react";
import { toast } from "sonner";

export default function StudyGroups() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const groupsQ = trpc.learningSocial.groups.list.useQuery(undefined, { enabled: !!isAuthenticated });
  const createMut = trpc.learningSocial.groups.create.useMutation({
    onSuccess: () => { groupsQ.refetch(); setShowCreate(false); setNewName(""); setNewDesc(""); toast.success("Study group created!"); },
    onError: () => toast.error("Failed to create group"),
  });
  const joinMut = trpc.learningSocial.groups.join.useMutation({
    onSuccess: () => { groupsQ.refetch(); setShowJoin(false); setJoinCode(""); toast.success("Joined group!"); },
    onError: (err) => toast.error(err.message || "Failed to join group"),
  });
  const leaveMut = trpc.learningSocial.groups.leave.useMutation({
    onSuccess: () => { groupsQ.refetch(); toast.success("Left group"); },
    onError: () => toast.error("Failed to leave group"),
  });

  const handleCreate = useCallback(() => {
    if (!newName.trim()) { toast.error("Name is required"); return; }
    createMut.mutate({ name: newName.trim(), description: newDesc.trim() || undefined });
  }, [newName, newDesc, createMut]);

  const handleJoin = useCallback(() => {
    if (!joinCode.trim()) { toast.error("Invite code is required"); return; }
    joinMut.mutate({ inviteCode: joinCode.trim() });
  }, [joinCode, joinMut]);

  const copyInviteCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Invite code copied!");
  }, []);

  // Auth guard
  if (authLoading) {
    return <AppShell><div className="container py-8"><Skeleton className="h-64 w-full" /></div></AppShell>;
  }
  if (!isAuthenticated) {
    return (
      <AppShell>
        <SEOHead title="Study Groups" description="Collaborative study spaces" />
        <div className="container py-16 text-center space-y-4">
          <Users className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Study Groups</h1>
          <p className="text-muted-foreground">Sign in to create or join study groups.</p>
          <Button onClick={() => window.location.href = getLoginUrl("/learning/groups")}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const groups = groupsQ.data ?? [];

  return (
    <AppShell>
      <SEOHead title="Study Groups" description="Collaborative study spaces" />
      <div className="container max-w-3xl py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/learning"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Study Groups
            </h1>
            <p className="text-sm text-muted-foreground">{groups.length} groups</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowJoin(true)}>
              <LogIn className="mr-2 h-4 w-4" /> Join
            </Button>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" /> Create
            </Button>
          </div>
        </div>

        {/* List */}
        {groupsQ.isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 opacity-30 mb-3" />
            <p>No study groups yet. Create one or join with an invite code.</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button variant="outline" onClick={() => setShowJoin(true)}>
                <LogIn className="mr-2 h-4 w-4" /> Join Group
              </Button>
              <Button onClick={() => setShowCreate(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Group
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((g: any) => {
              const isOwner = g.ownerId === user?.id;
              return (
                <Card key={g.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium">{g.name}</h3>
                          {isOwner && <Badge variant="default" className="text-xs"><Crown className="h-3 w-3 mr-1" /> Owner</Badge>}
                        </div>
                        {g.description && <p className="text-sm text-muted-foreground">{g.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span><Users className="inline h-3 w-3 mr-1" />{g.memberCount ?? 1} members</span>
                          <span>Created {g.createdAt ? new Date(g.createdAt).toLocaleDateString() : ""}</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {g.inviteCode && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => copyInviteCode(g.inviteCode)}>
                            <Copy className="h-3 w-3 mr-1" /> {g.inviteCode}
                          </Button>
                        )}
                        {!isOwner && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive" onClick={() => leaveMut.mutate({ groupId: g.id })} disabled={leaveMut.isPending}>
                            Leave
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Create Dialog */}
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Study Group</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
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

        {/* Join Dialog */}
        <Dialog open={showJoin} onOpenChange={setShowJoin}>
          <DialogContent>
            <DialogHeader><DialogTitle>Join Study Group</DialogTitle></DialogHeader>
            <Input placeholder="Enter invite code" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowJoin(false)}>Cancel</Button>
              <Button onClick={handleJoin} disabled={joinMut.isPending || !joinCode.trim()}>
                {joinMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                Join
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
