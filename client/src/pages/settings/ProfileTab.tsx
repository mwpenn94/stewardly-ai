import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  Sparkles, User, Brain, Trash2, Plus, Loader2,
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

export default function ProfileTab() {
  const { user } = useAuth();
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

  const memories = memoriesQuery.data || [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-semibold mb-1">Profile & Style</h2>
        <p className="text-sm text-muted-foreground">Manage your avatar, communication style, and memories that personalize your AI.</p>
      </div>

      {/* ─── AVATAR ─── */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Camera className="w-4 h-4 text-accent" /> AI Avatar</CardTitle>
          <CardDescription className="text-xs">
            Upload an image for your AI's talking avatar. It animates during voice responses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="relative group">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-border bg-secondary flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="AI Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center">
                    <ImageIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-0.5" />
                    <p className="text-[9px] text-muted-foreground">No avatar</p>
                  </div>
                )}
              </div>
              {avatarPreview && (
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => removeAvatar.mutate()}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="space-y-2 flex-1">
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              <Button
                size="sm"
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadAvatar.isPending}
              >
                {uploadAvatar.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Camera className="w-3.5 h-3.5 mr-1.5" />}
                {avatarPreview ? "Change" : "Upload"}
              </Button>
              <p className="text-[10px] text-muted-foreground">JPG, PNG, GIF, WebP. Max 5MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── COMMUNICATION STYLE ─── */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Fingerprint className="w-4 h-4 text-accent" /> Communication Style</CardTitle>
          <CardDescription className="text-xs">
            Describe how you communicate so the AI can match your style — tone, vocabulary, formality, patterns.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={styleProfile}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setStyleProfile(e.target.value)}
            placeholder="Example: I communicate in a direct, professional tone. I use bullet points frequently. I prefer concise answers but appreciate thorough explanations for complex topics."
            className="bg-secondary border-border min-h-[140px] text-sm"
          />
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">More detail = better personalization</p>
            <Button
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs"
              onClick={() => updateStyle.mutate({ profile: styleProfile })}
              disabled={updateStyle.isPending}
            >
              {updateStyle.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Fingerprint className="w-3.5 h-3.5 mr-1" />}
              Save Style
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── MEMORIES ─── */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-accent" /> Memories</CardTitle>
          <CardDescription className="text-xs">
            Teach your AI facts about you — preferences, goals, relationships. These persist across conversations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={memoryCategory} onValueChange={(v) => setMemoryCategory(v as typeof memoryCategory)}>
              <SelectTrigger className="w-36 bg-secondary border-border h-8 text-xs">
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
            <div className="flex gap-1.5 flex-1 min-w-0">
              <Input
                value={newMemory}
                onChange={(e) => setNewMemory(e.target.value)}
                placeholder="e.g., I have two children, ages 8 and 12"
                className="bg-secondary border-border h-8 text-xs flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && newMemory.trim()) addMemory.mutate({ category: memoryCategory, content: newMemory }); }}
              />
              <Button
                size="sm" className="h-8 bg-accent text-accent-foreground hover:bg-accent/90 text-xs px-2.5"
                onClick={() => newMemory.trim() && addMemory.mutate({ category: memoryCategory, content: newMemory })}
                disabled={addMemory.isPending || !newMemory.trim()}
              >
                {addMemory.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              </Button>
            </div>
          </div>

          {memories.length > 0 ? (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-1.5">
                {memories.map((mem: any) => {
                  const cat = MEMORY_CATEGORIES.find(c => c.value === mem.category);
                  return (
                    <div key={mem.id} className="flex items-start gap-2 p-2.5 rounded-lg border border-border/50 bg-secondary/30">
                      <Badge variant="secondary" className="text-[9px] shrink-0 mt-0.5 gap-1">
                        {cat?.icon} {cat?.label || mem.category}
                      </Badge>
                      <p className="text-xs flex-1">{mem.content}</p>
                      <Button
                        variant="ghost" size="sm" className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteMemory.mutate({ id: mem.id })}
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Brain className="w-6 h-6 mx-auto mb-1.5 opacity-30" />
              <p className="text-xs">No memories yet — add facts to personalize your AI</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── PROFILE INFO ─── */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><User className="w-4 h-4 text-accent" /> Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] mb-1 block text-muted-foreground">Name</Label>
              <Input value={user?.name || ""} disabled className="bg-secondary border-border h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] mb-1 block text-muted-foreground">Email</Label>
              <Input value={user?.email || ""} disabled className="bg-secondary border-border h-8 text-xs" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
