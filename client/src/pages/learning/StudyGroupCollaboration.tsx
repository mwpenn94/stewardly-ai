/**
 * StudyGroupCollaboration.tsx — Full study group collaboration features
 *
 * All 4 panels wired to real tRPC endpoints:
 *   Discussion → peerGroups.messages / postMessage
 *   Goals → social.groups.listGoals / addGoal / toggleGoal
 *   Notes → social.groups.listNotes / addNote / updateNote
 *   Activity → social.groups.listActivity
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Target, MessageSquare, FileText, Activity,
  Plus, Send, CheckCircle2, Clock, Pencil,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Discussion Panel (wired to peerGroups.messages) ─── */
export function DiscussionPanel({ groupId }: { groupId: number }) {
  const { user } = useAuth();
  const [newPost, setNewPost] = useState("");
  const utils = trpc.useUtils();

  const messagesQ = trpc.learning.peerGroups.messages.useQuery(
    { groupId, limit: 50 },
    { enabled: !!groupId },
  );

  const postMut = trpc.learning.peerGroups.postMessage.useMutation({
    onSuccess: () => {
      utils.learning.peerGroups.messages.invalidate({ groupId });
      setNewPost("");
      toast.success("Posted to discussion");
    },
    onError: (err) => toast.error(err.message),
  });

  const messages = messagesQ.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          <MessageSquare className="h-5 w-5 text-blue-400" />
          Discussion
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Share insights and ask questions</p>
      </div>
      <div className="p-5">
        {user && (
          <div className="flex gap-2 mb-4">
            <Textarea
              placeholder="Share a thought or question..."
              value={newPost}
              onChange={e => setNewPost(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              size="icon"
              className="shrink-0 self-end"
              disabled={postMut.isPending || !newPost.trim()}
              onClick={() => {
                if (newPost.trim()) postMut.mutate({ groupId, content: newPost.trim() });
              }}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
        {messagesQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg: any) => (
              <div key={msg.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {msg.userId === user?.id ? "You" : msg.userName ?? `Member #${msg.userId}`}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {msg.createdAt ? new Date(msg.createdAt).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    }) : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Shared learning goals Panel (wired to groups.listGoals / addGoal / toggleGoal) ─── */
export function SharedGoalsPanel({ groupId }: { groupId: number }) {
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const utils = trpc.useUtils();

  const goalsQ = trpc.learningSocial.groups.listGoals.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const addMut = trpc.learningSocial.groups.addGoal.useMutation({
    onSuccess: () => {
      utils.learning.social.groups.listGoals.invalidate({ groupId });
      utils.learning.social.groups.listActivity.invalidate({ groupId });
      setTitle(""); setDesc(""); setShowAdd(false);
      toast.success("Goal added");
    },
    onError: (err) => toast.error(err.message),
  });

  const toggleMut = trpc.learningSocial.groups.toggleGoal.useMutation({
    onSuccess: () => {
      utils.learning.social.groups.listGoals.invalidate({ groupId });
      toast.success("Goal updated");
    },
  });

  const goals = goalsQ.data ?? [];
  const activeGoals = goals.filter((g: any) => g.status === "active");
  const completedGoals = goals.filter((g: any) => g.status === "completed");

  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              <Target className="h-5 w-5 text-teal-400" />
              Shared Goals
              {activeGoals.length > 0 && (
                <Badge variant="secondary" className="text-xs">{activeGoals.length} active</Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Track group learning objectives together</p>
          </div>
          {user && (
            <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4 mr-1" /> Add Goal
            </Button>
          )}
        </div>
      </div>
      <div className="p-5">
        {showAdd && (
          <div className="space-y-2 mb-4 p-3 border rounded-lg bg-muted/30">
            <Input
              placeholder="Goal title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Description (optional)..."
              value={desc}
              onChange={e => setDesc(e.target.value)}
              className="min-h-[50px]"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={addMut.isPending || !title.trim()}
                onClick={() => addMut.mutate({ groupId, title: title.trim(), description: desc.trim() || undefined })}
              >
                {addMut.isPending ? "Adding..." : "Add Goal"}
              </Button>
            </div>
          </div>
        )}

        {goalsQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Target className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">No goals yet. Set a shared learning objective!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeGoals.map((g: any) => (
              <div key={g.id} className="flex items-start gap-3 p-3 border rounded-lg">
                <Checkbox
                  checked={false}
                  onCheckedChange={() => toggleMut.mutate({ goalId: g.id, status: "completed" })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{g.title}</p>
                  {g.description && <p className="text-xs text-muted-foreground mt-0.5">{g.description}</p>}
                  {g.targetDate && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Due {new Date(g.targetDate).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {completedGoals.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground mt-3 mb-1 font-medium">Completed ({completedGoals.length})</p>
                {completedGoals.map((g: any) => (
                  <div key={g.id} className="flex items-center gap-3 p-2 border rounded-lg opacity-60">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-sm line-through">{g.title}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Activity Feed Panel (wired to groups.listActivity) ─── */
export function ActivityFeedPanel({ groupId }: { groupId: number }) {
  const activityQ = trpc.learningSocial.groups.listActivity.useQuery(
    { groupId, limit: 50 },
    { enabled: !!groupId },
  );

  const items = activityQ.data ?? [];

  const actionLabel = (action: string) => {
    switch (action) {
      case "added_goal": return "set a new goal";
      case "added_note": return "shared a note";
      case "completed_goal": return "completed a goal";
      case "joined": return "joined the group";
      default: return action.replace(/_/g, " ");
    }
  };

  const actionIcon = (action: string) => {
    switch (action) {
      case "added_goal": return <Target className="h-3.5 w-3.5 text-teal-400" />;
      case "added_note": return <FileText className="h-3.5 w-3.5 text-purple-400" />;
      case "completed_goal": return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
      default: return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="flex items-center gap-2 font-semibold" style={{ fontFamily: "var(--font-display)" }}>
          <Activity className="h-5 w-5 text-green-400" />
          Group Activity
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">Recent activity from group members</p>
      </div>
      <div className="p-5">
        {activityQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">No activity yet. Goals and notes will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item: any) => (
              <div key={item.id} className="flex items-start gap-2 p-2 border rounded-lg">
                <div className="mt-0.5">{actionIcon(item.action)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">Member #{item.userId}</span>{" "}
                    {actionLabel(item.action)}
                    {item.detail && <span className="text-muted-foreground"> — {item.detail}</span>}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString([], {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    }) : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Collaborative Notes Panel (wired to groups.listNotes / addNote) ─── */
export function CollaborativeNotesPanel({ groupId }: { groupId: number }) {
  const { user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const utils = trpc.useUtils();

  const notesQ = trpc.learningSocial.groups.listNotes.useQuery(
    { groupId },
    { enabled: !!groupId },
  );

  const addMut = trpc.learningSocial.groups.addNote.useMutation({
    onSuccess: () => {
      utils.learning.social.groups.listNotes.invalidate({ groupId });
      utils.learning.social.groups.listActivity.invalidate({ groupId });
      setTitle(""); setContent(""); setShowAdd(false);
      toast.success("Note shared");
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMut = trpc.learningSocial.groups.updateNote.useMutation({
    onSuccess: () => {
      utils.learning.social.groups.listNotes.invalidate({ groupId });
      setEditingId(null); setEditContent("");
      toast.success("Note updated");
    },
  });

  const notes = notesQ.data ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card/80 overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 font-semibold" style={{ fontFamily: "var(--font-display)" }}>
              <FileText className="h-5 w-5 text-purple-400" />
              Shared Notes
              {notes.length > 0 && (
                <Badge variant="secondary" className="text-xs">{notes.length}</Badge>
              )}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Collaborative study notes for the group</p>
          </div>
          {user && (
            <Button size="sm" variant="outline" onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-4 w-4 mr-1" /> Add Note
            </Button>
          )}
        </div>
      </div>
      <div className="p-5">
        {showAdd && (
          <div className="space-y-2 mb-4 p-3 border rounded-lg bg-muted/30">
            <Input
              placeholder="Note title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Note content (markdown supported)..."
              value={content}
              onChange={e => setContent(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={addMut.isPending || !title.trim() || !content.trim()}
                onClick={() => addMut.mutate({ groupId, title: title.trim(), content: content.trim() })}
              >
                {addMut.isPending ? "Sharing..." : "Share Note"}
              </Button>
            </div>
          </div>
        )}

        {notesQ.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        ) : notes.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <FileText className="mx-auto h-10 w-10 opacity-30 mb-2" />
            <p className="text-sm">No shared notes yet. Start collaborating!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notes.map((note: any) => (
              <div key={note.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium">{note.title}</h4>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">
                      {note.updatedAt ? new Date(note.updatedAt).toLocaleDateString() : ""}
                    </span>
                    {user && note.userId === user.id && editingId !== note.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => { setEditingId(note.id); setEditContent(note.content); }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                {editingId === note.id ? (
                  <div className="space-y-2 mt-2">
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button
                        size="sm"
                        disabled={updateMut.isPending}
                        onClick={() => updateMut.mutate({ noteId: note.id, content: editContent })}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Collaboration Hub ─── */
export default function StudyGroupCollaboration({ groupId }: { groupId: number }) {
  return (
    <Tabs defaultValue="discussion" className="mt-4">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="discussion"><MessageSquare className="h-4 w-4 mr-1" /> Discussion</TabsTrigger>
        <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1" /> Goals</TabsTrigger>
        <TabsTrigger value="notes"><FileText className="h-4 w-4 mr-1" /> Notes</TabsTrigger>
        <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="discussion"><DiscussionPanel groupId={groupId} /></TabsContent>
      <TabsContent value="goals"><SharedGoalsPanel groupId={groupId} /></TabsContent>
      <TabsContent value="notes"><CollaborativeNotesPanel groupId={groupId} /></TabsContent>
      <TabsContent value="activity"><ActivityFeedPanel groupId={groupId} /></TabsContent>
    </Tabs>
  );
}
