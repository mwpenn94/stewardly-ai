import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  ArrowLeft, Sparkles, User, Brain, Trash2, Plus, Loader2,
  Fingerprint, BookOpen, Heart, Target, Users, Clock, DollarSign,
  Camera, X, ImageIcon,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

const MEMORY_CATEGORIES = [
  { value: "fact", label: "Fact", icon: <BookOpen className="w-3 h-3" />, desc: "Things about you" },
  { value: "preference", label: "Preference", icon: <Heart className="w-3 h-3" />, desc: "What you like/dislike" },
  { value: "goal", label: "Goal", icon: <Target className="w-3 h-3" />, desc: "What you're working toward" },
  { value: "relationship", label: "Relationship", icon: <Users className="w-3 h-3" />, desc: "People in your life" },
  { value: "financial", label: "Financial", icon: <DollarSign className="w-3 h-3" />, desc: "Financial details" },
  { value: "temporal", label: "Temporal", icon: <Clock className="w-3 h-3" />, desc: "Time-sensitive info" },
];

export default function Settings() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: !!user });
  const memoriesQuery = trpc.memories.list.useQuery(undefined, { enabled: !!user });

  const updateStyle = trpc.settings.updateStyleProfile.useMutation({
    onSuccess: () => { toast.success("Communication style saved"); utils.settings.get.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const uploadAvatar = trpc.settings.uploadAvatar.useMutation({
    onSuccess: (data) => { toast.success("Avatar updated"); setAvatarPreview(data.url); utils.settings.get.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const removeAvatar = trpc.settings.removeAvatar.useMutation({
    onSuccess: () => { toast.success("Avatar removed"); setAvatarPreview(null); utils.settings.get.invalidate(); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const addMemory = trpc.memories.add.useMutation({
    onSuccess: () => { toast.success("Memory added"); utils.memories.list.invalidate(); setNewMemory(""); },
    onError: (e: { message: string }) => toast.error(e.message),
  });
  const deleteMemory = trpc.memories.delete.useMutation({
    onSuccess: () => { utils.memories.list.invalidate(); toast.success("Memory removed"); },
  });

  const [styleProfile, setStyleProfile] = useState("");
  const [newMemory, setNewMemory] = useState("");
  const [memoryCategory, setMemoryCategory] = useState<"fact" | "preference" | "goal" | "relationship" | "financial" | "temporal">("fact");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (settingsQuery.data?.styleProfile) setStyleProfile(settingsQuery.data.styleProfile);
    if (settingsQuery.data?.avatarUrl) setAvatarPreview(settingsQuery.data.avatarUrl);
  }, [settingsQuery.data?.styleProfile, settingsQuery.data?.avatarUrl]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      uploadAvatar.mutate({ content: base64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  const memories = memoriesQuery.data || [];

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Settings</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <Tabs defaultValue="avatar" className="space-y-6">
          <TabsList className="bg-secondary flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="avatar" className="gap-1.5 text-xs"><Camera className="w-3.5 h-3.5" /> Avatar</TabsTrigger>
            <TabsTrigger value="style" className="gap-1.5 text-xs"><Fingerprint className="w-3.5 h-3.5" /> Personalize</TabsTrigger>
            <TabsTrigger value="memories" className="gap-1.5 text-xs"><Brain className="w-3.5 h-3.5" /> Memories</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 text-xs"><User className="w-3.5 h-3.5" /> Profile</TabsTrigger>
          </TabsList>

          {/* Avatar */}
          <TabsContent value="avatar">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">AI Avatar</CardTitle>
                <CardDescription className="text-xs">
                  Upload an image to use as your AI's talking avatar. This can be a photo of yourself, someone else,
                  a cartoon character, or any image you'd like. The avatar will animate during voice responses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  {/* Avatar preview */}
                  <div className="relative group">
                    <div className="w-32 h-32 rounded-2xl overflow-hidden border-2 border-border bg-secondary flex items-center justify-center">
                      {avatarPreview ? (
                        <img src={avatarPreview} alt="AI Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-center">
                          <ImageIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-1" />
                          <p className="text-[10px] text-muted-foreground">No avatar</p>
                        </div>
                      )}
                    </div>
                    {avatarPreview && (
                      <button
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeAvatar.mutate()}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-3 flex-1">
                    <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadAvatar.isPending}
                    >
                      {uploadAvatar.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
                      {avatarPreview ? "Change Avatar" : "Upload Avatar"}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Supports JPG, PNG, GIF, WebP. Max 5MB. Square images work best.
                    </p>
                    <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                      <p className="text-xs text-accent">
                        Your avatar will appear in the chat interface and animate with a subtle talking effect
                        when the AI speaks using voice output.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Communication Style */}
          <TabsContent value="style">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Communication Style</CardTitle>
                <CardDescription className="text-xs">
                  Describe how you communicate so the AI can personalize its responses to match your style.
                  Include tone, vocabulary preferences, sentence structure, formality level, and any distinctive patterns.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={styleProfile}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStyleProfile(e.target.value)}
                  placeholder="Example: I communicate in a direct, professional tone. I use bullet points frequently. I prefer concise answers but appreciate thorough explanations for complex topics. I often use analogies to explain financial concepts."
                  className="bg-secondary border-border min-h-[200px] text-sm"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    The more detail you provide, the better the AI personalizes to your style.
                  </p>
                  <Button
                    className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm"
                    onClick={() => updateStyle.mutate({ profile: styleProfile })}
                    disabled={updateStyle.isPending}
                  >
                    {updateStyle.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Fingerprint className="w-4 h-4 mr-1.5" />}
                    Save Style
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border mt-4">
              <CardHeader>
                <CardTitle className="text-base">Auto-Analyze Style</CardTitle>
                <CardDescription className="text-xs">
                  Upload documents or past communications and the AI will analyze your writing style automatically.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="text-sm" onClick={() => navigate("/documents")}>
                  <BookOpen className="w-4 h-4 mr-1.5" /> Upload Documents for Analysis
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Memories */}
          <TabsContent value="memories">
            <Card className="bg-card border-border mb-4">
              <CardHeader>
                <CardTitle className="text-base">Add Memory</CardTitle>
                <CardDescription className="text-xs">
                  Teach your AI facts about you, your preferences, goals, and relationships.
                  These memories persist across conversations to personalize every interaction.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={memoryCategory} onValueChange={(v) => setMemoryCategory(v as typeof memoryCategory)}>
                    <SelectTrigger className="w-40 bg-secondary border-border h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEMORY_CATEGORIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>
                          <span className="flex items-center gap-1.5">{c.icon} {c.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMemory}
                    onChange={(e) => setNewMemory(e.target.value)}
                    placeholder="e.g., I have two children, ages 8 and 12"
                    className="bg-secondary border-border h-9 text-sm flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && newMemory.trim()) addMemory.mutate({ category: memoryCategory, content: newMemory }); }}
                  />
                  <Button
                    size="sm" className="h-9 bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
                    onClick={() => newMemory.trim() && addMemory.mutate({ category: memoryCategory, content: newMemory })}
                    disabled={addMemory.isPending || !newMemory.trim()}
                  >
                    {addMemory.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Stored Memories ({memories.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {memories.length > 0 ? (
                  <ScrollArea className="max-h-[400px]">
                    <div className="space-y-2">
                      {memories.map((mem: any) => {
                        const cat = MEMORY_CATEGORIES.find(c => c.value === mem.category);
                        return (
                          <div key={mem.id} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-secondary/30">
                            <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5 gap-1">
                              {cat?.icon} {cat?.label || mem.category}
                            </Badge>
                            <p className="text-sm flex-1">{mem.content}</p>
                            <Button
                              variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => deleteMemory.mutate({ id: mem.id })}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No memories yet</p>
                    <p className="text-xs mt-1">Add facts about yourself to personalize your AI</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Profile */}
          <TabsContent value="profile">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-base">Your Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs mb-1.5 block">Name</Label>
                    <Input value={user?.name || ""} disabled className="bg-secondary border-border h-9 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1.5 block">Email</Label>
                    <Input value={user?.email || ""} disabled className="bg-secondary border-border h-9 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Avatar</p>
                    <p className="text-sm font-medium">{avatarPreview ? "Set" : "Not set"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Suitability</p>
                    <p className="text-sm font-medium">{settingsQuery.data?.suitabilityCompleted ? "Completed" : "Pending"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Style</p>
                    <p className="text-sm font-medium">{settingsQuery.data?.styleProfile ? "Active" : "Not set"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                    <p className="text-[10px] text-muted-foreground mb-0.5">Memories</p>
                    <p className="text-sm font-medium">{memories.length} stored</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
