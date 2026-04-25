/**
 * StudyGroupCollaboration.tsx — Enhanced study group collaboration features
 *
 * Pass 81. Wires Discussion panel to real peerGroups.messages tRPC backend.
 * Goals, Notes, and Activity panels show design-preview banners (no backend yet).
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
import {
  Target, MessageSquare, FileText, Activity,
  Plus, Send, Users, BookOpen, Trophy, Info,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Design Preview Banner ─── */
function DesignPreviewBanner({ feature }: { feature: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-4">
      <Info className="h-3.5 w-3.5 shrink-0" />
      <span><strong>{feature}</strong> is a design preview — backend coming in a future pass.</span>
    </div>
  );
}

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-400" />
          Discussion
        </CardTitle>
        <CardDescription>Share insights and ask questions</CardDescription>
      </CardHeader>
      <CardContent>
        {/* New post */}
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
                if (newPost.trim()) {
                  postMut.mutate({ groupId, content: newPost.trim() });
                }
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
      </CardContent>
    </Card>
  );
}

/* ─── Shared Goals Panel (design preview) ─── */
export function SharedGoalsPanel({ groupId }: { groupId: number }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-teal-400" />
              Shared Goals
            </CardTitle>
            <CardDescription>Track group learning objectives together</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DesignPreviewBanner feature="Shared Goals" />
        <div className="text-center py-6 text-muted-foreground">
          <Target className="mx-auto h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">Set shared learning goals and track progress as a group.</p>
          <p className="text-xs mt-1">Coming soon — group goals with progress tracking and deadlines.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Activity Feed Panel (design preview) ─── */
export function ActivityFeedPanel({ groupId }: { groupId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-green-400" />
          Group Activity
        </CardTitle>
        <CardDescription>Recent activity from group members</CardDescription>
      </CardHeader>
      <CardContent>
        <DesignPreviewBanner feature="Activity Feed" />
        <div className="text-center py-6 text-muted-foreground">
          <Activity className="mx-auto h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">See quiz completions, goal progress, and member activity.</p>
          <p className="text-xs mt-1">Coming soon — real-time group activity stream.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Collaborative Notes Panel (design preview) ─── */
export function CollaborativeNotesPanel({ groupId }: { groupId: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-purple-400" />
          Shared Notes
        </CardTitle>
        <CardDescription>Collaborative study notes for the group</CardDescription>
      </CardHeader>
      <CardContent>
        <DesignPreviewBanner feature="Shared Notes" />
        <div className="text-center py-6 text-muted-foreground">
          <FileText className="mx-auto h-10 w-10 opacity-30 mb-2" />
          <p className="text-sm">Share and collaborate on study notes with your group.</p>
          <p className="text-xs mt-1">Coming soon — collaborative note-taking with markdown support.</p>
        </div>
      </CardContent>
    </Card>
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
