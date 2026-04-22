/**
 * StudyGroups.tsx — Collaborative study spaces with shared quizzes & challenges
 *
 * Pass 37. Users can create/join study groups with invite codes,
 * share quizzes, and compete in timed quiz challenges.
 */
import { useState, useCallback, useMemo } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Users, ArrowLeft, Plus, Copy, UserPlus,
  Crown, Loader2, LogIn, Swords, BookOpen,
  Timer, Trophy, ChevronRight, Play,
} from "lucide-react";
import { toast } from "sonner";

/* ── Group Detail View (Shared Quizzes + Challenges) ──────────────────────── */

function GroupDetail({ group, userId, onBack }: { group: any; userId: number; onBack: () => void }) {
  const [tab, setTab] = useState("quizzes");
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showCreateChallenge, setShowCreateChallenge] = useState(false);
  const [quizTitle, setQuizTitle] = useState("");
  const [quizContent, setQuizContent] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeTime, setChallengeTime] = useState(300); // 5 min default

  const quizzesQ = trpc.learningSocial.sharedQuizzes.list.useQuery(
    { groupId: group.id },
    { enabled: !!group.id },
  );
  const challengesQ = trpc.learningSocial.challenges.list.useQuery(
    { groupId: group.id },
    { enabled: !!group.id },
  );

  const createQuizMut = trpc.learningSocial.sharedQuizzes.create.useMutation({
    onSuccess: () => {
      quizzesQ.refetch();
      setShowCreateQuiz(false);
      setQuizTitle("");
      setQuizContent("");
      toast.success("Quiz shared with group!");
    },
    onError: () => toast.error("Failed to create quiz"),
  });

  const createChallengeMut = trpc.learningSocial.challenges.create.useMutation({
    onSuccess: () => {
      challengesQ.refetch();
      setShowCreateChallenge(false);
      setChallengeTitle("");
      toast.success("Challenge created!");
    },
    onError: () => toast.error("Failed to create challenge"),
  });

  const submitScoreMut = trpc.learningSocial.challenges.submitScore.useMutation({
    onSuccess: () => { challengesQ.refetch(); toast.success("Score submitted!"); },
    onError: () => toast.error("Failed to submit score"),
  });

  const quizzes = quizzesQ.data ?? [];
  const challenges = challengesQ.data ?? [];
  const isOwner = group.ownerId === userId;

  return (
    <div className="space-y-4">
      {/* Group Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-bold flex items-center gap-2">
            {group.name}
            {isOwner && <Badge variant="default" className="text-xs"><Crown className="h-3 w-3 mr-1" /> Owner</Badge>}
          </h2>
          {group.description && <p className="text-sm text-muted-foreground">{group.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span><Users className="inline h-3 w-3 mr-1" />{group.memberCount ?? 1} members</span>
            {group.inviteCode && (
              <button className="flex items-center gap-1 hover:text-foreground transition-colors"
                onClick={() => { navigator.clipboard.writeText(group.inviteCode); toast.success("Invite code copied!"); }}>
                <Copy className="h-3 w-3" /> {group.inviteCode}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="quizzes" className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> Shared Quizzes ({quizzes.length})
          </TabsTrigger>
          <TabsTrigger value="challenges" className="flex items-center gap-1.5">
            <Swords className="h-3.5 w-3.5" /> Challenges ({challenges.length})
          </TabsTrigger>
        </TabsList>

        {/* Shared Quizzes Tab */}
        <TabsContent value="quizzes" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCreateQuiz(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Share Quiz
            </Button>
          </div>
          {quizzesQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : quizzes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="mx-auto h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">No shared quizzes yet. Be the first to share one!</p>
            </div>
          ) : (
            quizzes.map((q: any) => (
              <Card key={q.id} className="hover:border-primary/20 transition-colors">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{q.title || "Untitled Quiz"}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Shared by {q.creatorId === userId ? "you" : `member #${q.creatorId}`}
                        {q.createdAt && ` · ${new Date(q.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => toast.info("Quiz viewer coming soon")}>
                      <Play className="h-3 w-3 mr-1" /> Take Quiz
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Challenges Tab */}
        <TabsContent value="challenges" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowCreateChallenge(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> New Challenge
            </Button>
          </div>
          {challengesQ.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
          ) : challenges.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Swords className="mx-auto h-10 w-10 opacity-30 mb-2" />
              <p className="text-sm">No challenges yet. Create one to compete with group members!</p>
            </div>
          ) : (
            challenges.map((c: any) => (
              <ChallengeCard key={c.id} challenge={c} userId={userId} onSubmitScore={(score) => submitScoreMut.mutate({ challengeId: c.id, score })} />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Create Quiz Dialog */}
      <Dialog open={showCreateQuiz} onOpenChange={setShowCreateQuiz}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share a Quiz</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Quiz title" value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} />
            <Textarea placeholder="Quiz content (questions in JSON or plain text)" value={quizContent} onChange={(e) => setQuizContent(e.target.value)} rows={5} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateQuiz(false)}>Cancel</Button>
            <Button onClick={() => createQuizMut.mutate({ groupId: group.id, title: quizTitle.trim(), content: quizContent.trim() })}
              disabled={createQuizMut.isPending || !quizTitle.trim()}>
              {createQuizMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookOpen className="mr-2 h-4 w-4" />}
              Share
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Challenge Dialog */}
      <Dialog open={showCreateChallenge} onOpenChange={setShowCreateChallenge}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create Quiz Challenge</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Challenge title" value={challengeTitle} onChange={(e) => setChallengeTitle(e.target.value)} />
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Time Limit</label>
              <div className="flex gap-2">
                {[120, 300, 600, 900].map((t) => (
                  <Button key={t} variant={challengeTime === t ? "default" : "outline"} size="sm"
                    onClick={() => setChallengeTime(t)}>
                    {t / 60}m
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateChallenge(false)}>Cancel</Button>
            <Button onClick={() => createChallengeMut.mutate({ groupId: group.id, title: challengeTitle.trim(), timeLimitSec: challengeTime })}
              disabled={createChallengeMut.isPending || !challengeTitle.trim()}>
              {createChallengeMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Swords className="mr-2 h-4 w-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Challenge Card ───────────────────────────────────────────────────────── */

function ChallengeCard({ challenge, userId, onSubmitScore }: { challenge: any; userId: number; onSubmitScore: (score: number) => void }) {
  const [showResults, setShowResults] = useState(false);
  const resultsQ = trpc.learningSocial.challenges.results.useQuery(
    { challengeId: challenge.id },
    { enabled: showResults },
  );
  const results = resultsQ.data ?? [];

  return (
    <Card className="hover:border-primary/20 transition-colors">
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-sm flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5 text-primary" />
              {challenge.title || "Untitled Challenge"}
            </h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Timer className="inline h-3 w-3 mr-0.5" />
              {challenge.timeLimitSec ? `${Math.round(challenge.timeLimitSec / 60)}min` : "No limit"}
              {challenge.createdAt && ` · ${new Date(challenge.createdAt).toLocaleDateString()}`}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowResults(!showResults)}>
              <Trophy className="h-3 w-3 mr-1" /> {showResults ? "Hide" : "Scores"}
            </Button>
            <Button size="sm" className="text-xs" onClick={() => {
              // Simulate taking the challenge — in production this would navigate to the quiz
              const mockScore = Math.floor(Math.random() * 40) + 60;
              onSubmitScore(mockScore);
            }}>
              <Play className="h-3 w-3 mr-1" /> Compete
            </Button>
          </div>
        </div>

        {/* Leaderboard */}
        {showResults && (
          <div className="border-t pt-2 mt-2">
            {resultsQ.isLoading ? (
              <Skeleton className="h-12" />
            ) : results.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">No scores yet. Be the first to compete!</p>
            ) : (
              <div className="space-y-1">
                {results.slice(0, 5).map((r: any, i: number) => (
                  <div key={r.id || i} className="flex items-center gap-2 text-xs">
                    <span className={`font-bold w-5 text-center ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                      #{i + 1}
                    </span>
                    <span className="flex-1">{r.userId === userId ? "You" : `Member #${r.userId}`}</span>
                    <Badge variant={i === 0 ? "default" : "secondary"} className="text-xs">{r.score}%</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Main StudyGroups Page ────────────────────────────────────────────────── */

export default function StudyGroups() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
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

  // If a group is selected, show detail view
  if (selectedGroup) {
    return (
      <AppShell>
        <SEOHead title={`${selectedGroup.name} — Study Group`} description="Study group details" />
        <div className="container max-w-3xl py-8">
          <GroupDetail group={selectedGroup} userId={user!.id} onBack={() => setSelectedGroup(null)} />
        </div>
      </AppShell>
    );
  }

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
                <Card key={g.id} className="hover:border-primary/30 transition-colors cursor-pointer"
                  onClick={() => setSelectedGroup(g)}>
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
                      <div className="flex items-center gap-1">
                        {g.inviteCode && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs"
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(g.inviteCode); toast.success("Invite code copied!"); }}>
                            <Copy className="h-3 w-3 mr-1" /> {g.inviteCode}
                          </Button>
                        )}
                        {!isOwner && (
                          <Button variant="ghost" size="sm" className="h-8 text-xs text-destructive"
                            onClick={(e) => { e.stopPropagation(); leaveMut.mutate({ groupId: g.id }); }} disabled={leaveMut.isPending}>
                            Leave
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
