/**
 * Community — Forum for authenticated professionals.
 * Post list → post detail → reply. Uses trpc.communityForum.
 */
import { useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  MessageSquare, Plus, ArrowLeft, ThumbsUp, Clock,
  Loader2, Users, Search, Tag,
} from "lucide-react";

const CATEGORIES = ["General", "Tax Planning", "Insurance", "Estate", "Compliance", "Technology", "Practice Management"];

export default function Community() {
  const { user, loading: authLoading } = useAuth();
  const [selectedPost, setSelectedPost] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [replyText, setReplyText] = useState("");

  const utils = trpc.useUtils();

  // Try to use communityForum.list if it exists, otherwise show placeholder
  const postsQuery = trpc.communityForum.listPosts.useQuery(
    { limit: 20 },
    { enabled: !!user, retry: false, staleTime: 30_000 }
  );

  const createPostMut = trpc.communityForum.createPost.useMutation({
    onSuccess: () => {
      toast.success("Post created!");
      setNewPostOpen(false);
      setNewTitle("");
      setNewBody("");
      utils.communityForum.listPosts.invalidate();
    },
    onError: () => toast.error("Your post couldn't be published — please try again"),
  });

  if (authLoading) {
    return (
      <AppShell title="Community">
      <SEOHead title="Community" description="Professional community discussions and networking" />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell title="Community">
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Users className="w-12 h-12 text-primary" />
          <p className="text-muted-foreground">Sign in to join the professional community</p>
          <Button onClick={() => { window.location.href = getLoginUrl(); }}>Sign In</Button>
        </div>
      </AppShell>
    );
  }

  const posts = postsQuery.data ?? [];

  return (
    <AppShell title="Community">
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Professional Community</h1>
            <p className="text-muted-foreground">Connect, share insights, and learn from peers</p>
          </div>
          <Dialog open={newPostOpen} onOpenChange={setNewPostOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> New Post</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Input placeholder="Post title" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                <select
                  className="w-full border rounded-md p-2 bg-background text-foreground"
                  value={newCategory}
                  onChange={e => setNewCategory(e.target.value)}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <Textarea placeholder="Share your thoughts..." value={newBody} onChange={e => setNewBody(e.target.value)} rows={6} />
                <Button
                  className="w-full"
                  disabled={!newTitle.trim() || !newBody.trim() || createPostMut.isPending}
                  onClick={() => createPostMut.mutate({ title: newTitle, content: newBody, communityType: newCategory })}
                >
                  {createPostMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Post
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search posts..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge
              variant={category === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setCategory("all")}
            >All</Badge>
            {CATEGORIES.map(c => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(c)}
              >{c}</Badge>
            ))}
          </div>
        </div>

        {postsQuery.isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No posts yet. Be the first to start a discussion!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {posts
              .filter((p: any) => {
                const matchSearch = !search || p.title?.toLowerCase().includes(search.toLowerCase());
                const matchCat = category === "all" || p.category === category;
                return matchSearch && matchCat;
              })
              .map((post: any) => (
                <Card key={post.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setSelectedPost(post.id)}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h3 className="font-semibold">{post.title}</h3>
                        <p className="text-sm text-muted-foreground line-clamp-2">{post.body}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {post.category && <Badge variant="outline" className="text-xs"><Tag className="w-3 h-3 mr-1" />{post.category}</Badge>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(post.createdAt).toLocaleDateString()}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.replyCount ?? 0}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
