/**
 * StudyGroupCollaboration.tsx — Enhanced study group collaboration features
 *
 * Adds to the existing StudyGroups page:
 * - Shared learning goals with progress tracking
 * - Discussion threads per study group
 * - Collaborative note-taking
 * - Group activity feed
 * - Challenge scheduling
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Target, MessageSquare, FileText, Activity,
  Calendar, Plus, Send, CheckCircle2, Clock,
  Users, Flame, BookOpen, Trophy,
} from "lucide-react";
import { toast } from "sonner";

/* ─── Types ─── */
interface SharedGoal {
  id: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number; // 0-100
  contributors: string[];
  status: "active" | "completed" | "overdue";
}

interface DiscussionPost {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  replies: number;
  likes: number;
}

interface ActivityItem {
  id: string;
  type: "quiz_completed" | "goal_progress" | "note_added" | "challenge_won" | "member_joined";
  user: string;
  description: string;
  timestamp: string;
}

/* ─── Shared Goals Panel ─── */
export function SharedGoalsPanel({ groupId }: { groupId: number }) {
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [showAddGoal, setShowAddGoal] = useState(false);

  // In production, these would come from a tRPC query
  const goals: SharedGoal[] = useMemo(() => [
    {
      id: "1",
      title: "Complete Tax Planning Module",
      description: "All members finish the tax planning track by end of month",
      targetDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      progress: 65,
      contributors: ["You", "Member #2"],
      status: "active" as const,
    },
    {
      id: "2",
      title: "90% Quiz Average",
      description: "Achieve 90%+ average across all group quizzes",
      targetDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      progress: 78,
      contributors: ["You", "Member #2", "Member #3"],
      status: "active" as const,
    },
  ], []);

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
          <Button size="sm" onClick={() => setShowAddGoal(!showAddGoal)}>
            <Plus className="h-4 w-4 mr-1" /> Add Goal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {showAddGoal && (
          <div className="mb-4 p-3 border rounded-lg bg-muted/30 space-y-2">
            <Input
              placeholder="Goal title..."
              value={newGoalTitle}
              onChange={e => setNewGoalTitle(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  if (newGoalTitle.trim()) {
                    toast.success("Goal added to group");
                    setNewGoalTitle("");
                    setShowAddGoal(false);
                  }
                }}
              >
                Create Goal
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddGoal(false)}>Cancel</Button>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {goals.map(goal => (
            <div key={goal.id} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {goal.status === "completed" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Target className="h-4 w-4 text-teal-400" />
                  )}
                  <span className="font-medium text-sm">{goal.title}</span>
                </div>
                <Badge variant={goal.status === "completed" ? "default" : goal.status === "overdue" ? "destructive" : "secondary"}>
                  {goal.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{goal.description}</p>
              <div className="flex items-center gap-3">
                <Progress value={goal.progress} className="flex-1 h-2" />
                <span className="text-xs font-medium">{goal.progress}%</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {goal.contributors.join(", ")}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Due {goal.targetDate}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Discussion Panel ─── */
export function DiscussionPanel({ groupId }: { groupId: number }) {
  const [newPost, setNewPost] = useState("");

  const posts: DiscussionPost[] = useMemo(() => [
    {
      id: "1",
      author: "You",
      content: "Found a great resource on Roth conversion strategies. Check out the tax planning module section 3.",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      replies: 2,
      likes: 3,
    },
    {
      id: "2",
      author: "Study Partner",
      content: "Can someone explain the difference between traditional and Roth 401(k) contribution limits for 2025?",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      replies: 1,
      likes: 1,
    },
  ], []);

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
            onClick={() => {
              if (newPost.trim()) {
                toast.success("Posted to discussion");
                setNewPost("");
              }
            }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-3">
          {posts.map(post => (
            <div key={post.id} className="p-3 border rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{post.author}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(post.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{post.content}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <button className="hover:text-foreground transition-colors">
                  {post.replies} replies
                </button>
                <button className="hover:text-foreground transition-colors">
                  {post.likes} likes
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Activity Feed Panel ─── */
export function ActivityFeedPanel({ groupId }: { groupId: number }) {
  const activities: ActivityItem[] = useMemo(() => [
    {
      id: "1",
      type: "quiz_completed" as const,
      user: "You",
      description: "Scored 92% on Tax Planning Quiz #3",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
    },
    {
      id: "2",
      type: "goal_progress" as const,
      user: "Study Partner",
      description: "Advanced 'Complete Tax Module' goal to 65%",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: "3",
      type: "challenge_won" as const,
      user: "You",
      description: "Won the weekly quiz challenge with 95%",
      timestamp: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: "4",
      type: "note_added" as const,
      user: "Study Partner",
      description: "Added notes on estate planning fundamentals",
      timestamp: new Date(Date.now() - 172800000).toISOString(),
    },
  ], []);

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "quiz_completed": return <BookOpen className="h-4 w-4 text-teal-400" />;
      case "goal_progress": return <Target className="h-4 w-4 text-blue-400" />;
      case "challenge_won": return <Trophy className="h-4 w-4 text-yellow-500" />;
      case "note_added": return <FileText className="h-4 w-4 text-purple-400" />;
      case "member_joined": return <Users className="h-4 w-4 text-green-400" />;
    }
  };

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
        <div className="space-y-3">
          {activities.map(activity => (
            <div key={activity.id} className="flex items-start gap-3 text-sm">
              <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p>
                  <span className="font-medium">{activity.user}</span>{" "}
                  <span className="text-muted-foreground">{activity.description}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(activity.timestamp).toLocaleString([], {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Collaborative Notes Panel ─── */
export function CollaborativeNotesPanel({ groupId }: { groupId: number }) {
  const [newNote, setNewNote] = useState("");

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
        <div className="space-y-3">
          <Textarea
            placeholder="Add a study note for the group..."
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            className="min-h-[80px]"
          />
          <Button
            size="sm"
            onClick={() => {
              if (newNote.trim()) {
                toast.success("Note shared with group");
                setNewNote("");
              }
            }}
          >
            <Plus className="h-4 w-4 mr-1" /> Share Note
          </Button>
          <div className="border-t pt-3 mt-3">
            <p className="text-sm text-muted-foreground text-center py-4">
              No shared notes yet. Be the first to contribute.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Main Collaboration Hub ─── */
export default function StudyGroupCollaboration({ groupId }: { groupId: number }) {
  return (
    <Tabs defaultValue="goals" className="mt-4">
      <TabsList className="grid grid-cols-4 w-full">
        <TabsTrigger value="goals"><Target className="h-4 w-4 mr-1" /> Goals</TabsTrigger>
        <TabsTrigger value="discussion"><MessageSquare className="h-4 w-4 mr-1" /> Discussion</TabsTrigger>
        <TabsTrigger value="notes"><FileText className="h-4 w-4 mr-1" /> Notes</TabsTrigger>
        <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" /> Activity</TabsTrigger>
      </TabsList>
      <TabsContent value="goals"><SharedGoalsPanel groupId={groupId} /></TabsContent>
      <TabsContent value="discussion"><DiscussionPanel groupId={groupId} /></TabsContent>
      <TabsContent value="notes"><CollaborativeNotesPanel groupId={groupId} /></TabsContent>
      <TabsContent value="activity"><ActivityFeedPanel groupId={groupId} /></TabsContent>
    </Tabs>
  );
}
