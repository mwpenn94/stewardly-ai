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
  Camera, X, ImageIcon, Volume2, Play, Square, Mic, Sliders, Code2,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
  const { user, loading } = useAuth();
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
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
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
            <TabsTrigger value="voice" className="gap-1.5 text-xs"><Volume2 className="w-3.5 h-3.5" /> Voice</TabsTrigger>
            <TabsTrigger value="style" className="gap-1.5 text-xs"><Fingerprint className="w-3.5 h-3.5" /> Personalize</TabsTrigger>
            <TabsTrigger value="memories" className="gap-1.5 text-xs"><Brain className="w-3.5 h-3.5" /> Memories</TabsTrigger>
            <TabsTrigger value="profile" className="gap-1.5 text-xs"><User className="w-3.5 h-3.5" /> Profile</TabsTrigger>
            <TabsTrigger value="ai-tuning" className="gap-1.5 text-xs"><Sliders className="w-3.5 h-3.5" /> AI Tuning</TabsTrigger>
            <TabsTrigger value="embeds" className="gap-1.5 text-xs"><Code2 className="w-3.5 h-3.5" /> Embeds</TabsTrigger>
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
                              variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive shrink-0"
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
          {/* Voice */}
          <TabsContent value="voice">
            <VoiceSettings />
          </TabsContent>
          {/* AI Tuning */}
          <TabsContent value="ai-tuning">
            <AITuningSettings />
          </TabsContent>
          <TabsContent value="embeds">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-2">Calculator Embed Codes</h3>
                <p className="text-sm text-muted-foreground mb-4">Generate embed codes to add Stewardly calculators to your website. Leads generated through embedded calculators are attributed to you.</p>
                <div className="space-y-4">
                  {["retirement", "protection", "tax", "estate", "education", "premium-finance"].map(calc => (
                    <div key={calc} className="flex items-center justify-between p-3 rounded border">
                      <div>
                        <div className="font-medium text-sm capitalize">{calc.replace("-", " ")} Calculator</div>
                        <div className="text-xs text-muted-foreground">Embed on your website</div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => {
                        const code = `<iframe src="${window.location.origin}/embed/${calc}?advisorId=${user?.id}&theme=dark" width="100%" height="800" frameborder="0" style="border:none;border-radius:8px" title="Financial Calculator"></iframe>`;
                        navigator.clipboard.writeText(code);
                        toast.success("Embed code copied!");
                      }}>
                        <Code2 className="h-3 w-3 mr-1" /> Copy Code
                      </Button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-4">Footer "Powered by Stewardly | Not investment advice" is automatically included. Compliance approval required before activation.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ─── VOICE SETTINGS COMPONENT ─────────────────────────────────────
function VoiceSettings() {
  const voicesQuery = trpc.voice.voices.useQuery();
  const speakMutation = trpc.voice.speak.useMutation();
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    return localStorage.getItem("tts-voice") || "aria";
  });
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localeFilter, setLocaleFilter] = useState<string>("all");

  const voices = voicesQuery.data || [];
  const locales = Array.from(new Set(voices.map(v => v.locale))).sort();
  const localeLabels: Record<string, string> = {
    "en-US": "American", "en-GB": "British", "en-AU": "Australian",
    "en-IE": "Irish", "en-IN": "Indian", "en-CA": "Canadian",
  };

  const filteredVoices = localeFilter === "all" ? voices : voices.filter(v => v.locale === localeFilter);

  const handlePreview = (voiceId: string, label: string) => {
    // Stop any current preview
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (previewPlaying === voiceId) {
      setPreviewPlaying(null);
      return;
    }
    setPreviewPlaying(voiceId);
    speakMutation.mutate(
      { text: `Hi, I'm ${label}. I'll be your financial advisor's voice assistant. How can I help you today?`, voice: voiceId },
      {
        onSuccess: (data) => {
          if (!data.audio) { setPreviewPlaying(null); return; }
          const binaryStr = atob(data.audio);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
          const blob = new Blob([bytes], { type: "audio/webm" });
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { URL.revokeObjectURL(url); setPreviewPlaying(null); audioRef.current = null; };
          audio.onerror = () => { URL.revokeObjectURL(url); setPreviewPlaying(null); audioRef.current = null; };
          audio.play().catch(() => { setPreviewPlaying(null); });
        },
        onError: () => { setPreviewPlaying(null); toast.error("Preview failed"); },
      }
    );
  };

  const handleSelect = (voiceId: string) => {
    setSelectedVoice(voiceId);
    localStorage.setItem("tts-voice", voiceId);
    toast.success("Voice preference saved");
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Mic className="w-4 h-4 text-accent" /> Voice Assistant</CardTitle>
        <CardDescription className="text-xs">
          Choose the voice for your AI assistant. Click the play button to preview, then select your preferred voice.
          Your choice is saved locally and used for all hands-free and audio responses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Locale filter */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={localeFilter === "all" ? "default" : "outline"}
            className="cursor-pointer text-xs"
            onClick={() => setLocaleFilter("all")}
          >
            All
          </Badge>
          {locales.map(loc => (
            <Badge
              key={loc}
              variant={localeFilter === loc ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setLocaleFilter(loc)}
            >
              {localeLabels[loc] || loc}
            </Badge>
          ))}
        </div>

        {/* Voice grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredVoices.map(v => {
            const isSelected = selectedVoice === v.id;
            const isPreviewing = previewPlaying === v.id;
            return (
              <div
                key={v.id}
                className={`relative p-3 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                    : "border-border bg-secondary/30 hover:border-accent/40 hover:bg-secondary/60"
                }`}
                onClick={() => handleSelect(v.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      v.gender === "female" ? "bg-pink-500/20 text-pink-400" : "bg-blue-500/20 text-blue-400"
                    }`}>
                      {v.label[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {v.label}
                        {isSelected && <span className="ml-1.5 text-accent text-[10px]">\u2713 Active</span>}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {v.description} \u00b7 {localeLabels[v.locale] || v.locale}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 shrink-0"
                    onClick={(e) => { e.stopPropagation(); handlePreview(v.id, v.label); }}
                    disabled={speakMutation.isPending && previewPlaying !== v.id}
                  >
                    {isPreviewing ? (
                      <Square className="w-3.5 h-3.5 text-accent" />
                    ) : speakMutation.isPending && previewPlaying === v.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {voicesQuery.isLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// ─── AI TUNING SETTINGS COMPONENT ─────────────────────────────────
const THINKING_DEPTH_OPTIONS = [
  { value: "quick", label: "Quick", desc: "Fast responses, minimal deliberation" },
  { value: "standard", label: "Standard", desc: "Balanced speed and thoroughness" },
  { value: "deep", label: "Deep", desc: "Thorough multi-step analysis" },
  { value: "extended", label: "Extended", desc: "Maximum reasoning depth with full chains" },
];

const CONTEXT_DEPTH_OPTIONS = [
  { value: "recent", label: "Recent (8 msgs)", desc: "Fast, focused on latest context" },
  { value: "moderate", label: "Moderate (20 msgs)", desc: "Balanced conversation memory" },
  { value: "full", label: "Full History (50 msgs)", desc: "Maximum conversation context" },
];

const DISCLAIMER_OPTIONS = [
  { value: "minimal", label: "Minimal", desc: "Brief inline disclaimers only" },
  { value: "standard", label: "Standard", desc: "Standard compliance disclaimers" },
  { value: "comprehensive", label: "Comprehensive", desc: "Detailed regulatory disclosures" },
];

const CITATION_OPTIONS = [
  { value: "none", label: "None", desc: "No citations" },
  { value: "inline", label: "Inline", desc: "Sources cited within text" },
  { value: "footnotes", label: "Footnotes", desc: "Numbered references at end" },
];

function TuningTooltip({ text }: { text: string }) {
  return (
    <span className="ml-1 text-[10px] text-muted-foreground/60 cursor-help" title={text}>
      ⓘ
    </span>
  );
}

function AITuningSettings() {
  const prefsQuery = trpc.aiLayers.getUserPreferences.useQuery();
  const updatePrefs = trpc.aiLayers.updateUserPreferences.useMutation({
    onSuccess: () => toast.success("AI tuning saved"),
    onError: (e) => toast.error(e.message),
  });

  const [thinkingDepth, setThinkingDepth] = useState("standard");
  const [creativity, setCreativity] = useState(0.7);
  const [contextDepth, setContextDepth] = useState("moderate");
  const [disclaimerVerbosity, setDisclaimerVerbosity] = useState("standard");
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [autoFollowUpCount, setAutoFollowUpCount] = useState(1);
  const [discoveryDirection, setDiscoveryDirection] = useState("auto");
  const [discoveryIdleThreshold, setDiscoveryIdleThreshold] = useState(120000);
  const [discoveryContinuous, setDiscoveryContinuous] = useState(false);
  const [crossModelVerify, setCrossModelVerify] = useState(false);
  const [citationStyle, setCitationStyle] = useState("none");
  const [reasoningTransparency, setReasoningTransparency] = useState(false);
  const [customInstructions, setCustomInstructions] = useState("");

  // Model weighting state
  const perspectivesQuery = trpc.multiModel.perspectives.useQuery();
  const presetsQuery = trpc.multiModel.presets.useQuery();
  const [activePreset, setActivePreset] = useState("balanced");
  const [weights, setWeights] = useState<Record<string, number>>({});

  // Model selector state
  const modelsQuery = trpc.aiLayers.getAvailableModels.useQuery();
  const [primaryModel, setPrimaryModel] = useState("");
  const [fallbackModel, setFallbackModel] = useState("");
  const [synthesisModel, setSynthesisModel] = useState("");

  useEffect(() => {
    if (prefsQuery.data) {
      const p = prefsQuery.data;
      if (p.thinkingDepth) setThinkingDepth(p.thinkingDepth);
      if (p.creativity != null) setCreativity(p.creativity);
      if (p.contextDepth) setContextDepth(p.contextDepth);
      if (p.disclaimerVerbosity) setDisclaimerVerbosity(p.disclaimerVerbosity);
      setAutoFollowUp(!!p.autoFollowUp);
      if (p.autoFollowUpCount != null) setAutoFollowUpCount(p.autoFollowUpCount);
      if ((p as any).discoveryDirection) setDiscoveryDirection((p as any).discoveryDirection);
      if ((p as any).discoveryIdleThresholdMs != null) setDiscoveryIdleThreshold((p as any).discoveryIdleThresholdMs);
      setDiscoveryContinuous(!!(p as any).discoveryContinuous);
      setCrossModelVerify(!!p.crossModelVerify);
      if (p.citationStyle) setCitationStyle(p.citationStyle);
      setReasoningTransparency(!!p.reasoningTransparency);
      if (p.customPromptAdditions) setCustomInstructions(p.customPromptAdditions);
      if (p.ensembleWeights) {
        try {
          const w = typeof p.ensembleWeights === "string" ? JSON.parse(p.ensembleWeights) : p.ensembleWeights;
          if (typeof w === "object" && w) setWeights(w as Record<string, number>);
        } catch {}
      }
      if (p.modelPreferences) {
        try {
          const mp = typeof p.modelPreferences === "string" ? JSON.parse(p.modelPreferences) : p.modelPreferences;
          if (mp && typeof mp === "object") {
            if ((mp as any).primary) setPrimaryModel((mp as any).primary);
            if ((mp as any).fallback) setFallbackModel((mp as any).fallback);
            if ((mp as any).synthesis) setSynthesisModel((mp as any).synthesis);
          }
        } catch {}
      }
    }
  }, [prefsQuery.data]);

  useEffect(() => {
    if (presetsQuery.data && Array.isArray(presetsQuery.data) && activePreset) {
      const preset = presetsQuery.data.find(p => p.id === activePreset);
      if (preset && Object.keys(weights).length === 0) {
        setWeights(preset.weights);
      }
    }
  }, [presetsQuery.data, activePreset]);

  const handleSave = () => {
    updatePrefs.mutate({
      thinkingDepth: thinkingDepth as any,
      creativity,
      contextDepth: contextDepth as any,
      disclaimerVerbosity: disclaimerVerbosity as any,
      autoFollowUp,
      autoFollowUpCount,
      discoveryDirection: discoveryDirection as any,
      discoveryIdleThresholdMs: discoveryIdleThreshold,
      discoveryContinuous,
      crossModelVerify,
      citationStyle: citationStyle as any,
      reasoningTransparency,
      customPromptAdditions: customInstructions || undefined,
      ensembleWeights: Object.keys(weights).length > 0 ? weights : undefined,
      modelPreferences: (primaryModel || fallbackModel || synthesisModel) ? {
        ...(primaryModel ? { primary: primaryModel } : {}),
        ...(fallbackModel ? { fallback: fallbackModel } : {}),
        ...(synthesisModel ? { synthesis: synthesisModel } : {}),
      } : undefined,
    });
  };

  const creativityLabel = creativity <= 0.3 ? "Precise" : creativity <= 0.7 ? "Balanced" : creativity <= 1.2 ? "Creative" : "Experimental";

  return (
    <div className="space-y-4">
      {/* Thinking & Response */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-accent" /> Thinking & Response
          </CardTitle>
          <CardDescription className="text-xs">Control how deeply and creatively the AI reasons</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Thinking Depth */}
          <div>
            <Label className="text-xs font-medium">
              Thinking Depth
              <TuningTooltip text="Controls how much reasoning the AI does before responding" />
            </Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {THINKING_DEPTH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setThinkingDepth(opt.value)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    thinkingDepth === opt.value
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Creativity Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-medium">
                Creativity
                <TuningTooltip text="Higher values produce more creative but less predictable responses" />
              </Label>
              <Badge variant="outline" className="text-[10px]">{creativityLabel} ({creativity.toFixed(1)})</Badge>
            </div>
            <Slider
              value={[creativity]}
              onValueChange={([v]) => setCreativity(v)}
              min={0}
              max={2}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>Precise</span><span>Balanced</span><span>Creative</span><span>Experimental</span>
            </div>
          </div>

          {/* Context Depth */}
          <div>
            <Label className="text-xs font-medium">
              Context Window
              <TuningTooltip text="How much conversation history to include in each request" />
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {CONTEXT_DEPTH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setContextDepth(opt.value)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    contextDepth === opt.value
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Output Formatting */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Output Formatting
          </CardTitle>
          <CardDescription className="text-xs">Control disclaimers, citations, and reasoning visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Disclaimer Verbosity */}
          <div>
            <Label className="text-xs font-medium">Financial Disclaimers</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {DISCLAIMER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setDisclaimerVerbosity(opt.value)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    disclaimerVerbosity === opt.value
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Citation Style */}
          <div>
            <Label className="text-xs font-medium">Source Citations</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              {CITATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCitationStyle(opt.value)}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    citationStyle === opt.value
                      ? "border-accent bg-accent/10 ring-1 ring-accent/30"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <div className="text-xs font-medium">{opt.label}</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Reasoning Transparency */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="text-xs font-medium">Show Reasoning Chains</div>
              <div className="text-[10px] text-muted-foreground">Include "How I got here" reasoning before conclusions</div>
            </div>
            <Switch checked={reasoningTransparency} onCheckedChange={setReasoningTransparency} />
          </div>
        </CardContent>
      </Card>

      {/* Advanced */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sliders className="w-4 h-4 text-accent" /> Advanced
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Auto Follow-Up */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="text-xs font-medium">Auto Follow-Up Questions</div>
              <div className="text-[10px] text-muted-foreground">AI proactively asks follow-up questions</div>
            </div>
            <div className="flex items-center gap-3">
              {autoFollowUp && (
                <Select value={String(autoFollowUpCount)} onValueChange={v => setAutoFollowUpCount(Number(v))}>
                  <SelectTrigger className="w-16 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Switch checked={autoFollowUp} onCheckedChange={setAutoFollowUp} />
            </div>
          </div>

          {/* Self-Discovery Loop */}
          {autoFollowUp && (
            <div className="space-y-3 p-3 rounded-lg border border-primary/15 bg-primary/[0.02]">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-primary/60" />
                <span className="text-xs font-medium">Self-Discovery Loop</span>
                <span className="text-[10px] text-muted-foreground">AI explores topics deeper when you're idle</span>
              </div>

              {/* Direction */}
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">Discovery Direction</div>
                <Select value={discoveryDirection} onValueChange={setDiscoveryDirection}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (AI picks)</SelectItem>
                    <SelectItem value="deeper">Go Deeper</SelectItem>
                    <SelectItem value="broader">Explore Broader</SelectItem>
                    <SelectItem value="applied">Apply It</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Idle Threshold */}
              <div className="flex items-center justify-between">
                <div className="text-[11px] text-muted-foreground">Idle Wait Time</div>
                <Select value={String(discoveryIdleThreshold)} onValueChange={v => setDiscoveryIdleThreshold(Number(v))}>
                  <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30000">30 seconds</SelectItem>
                    <SelectItem value="60000">1 minute</SelectItem>
                    <SelectItem value="120000">2 minutes</SelectItem>
                    <SelectItem value="300000">5 minutes</SelectItem>
                    <SelectItem value="600000">10 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Continuous mode */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-muted-foreground">Continuous Mode</div>
                  <div className="text-[10px] text-muted-foreground/60">Keep exploring beyond the occurrence limit</div>
                </div>
                <Switch checked={discoveryContinuous} onCheckedChange={setDiscoveryContinuous} />
              </div>
            </div>
          )}

          {/* Cross-Model Verification */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="text-xs font-medium">Cross-Model Verification</div>
              <div className="text-[10px] text-muted-foreground">Verify responses with a second analysis pass</div>
            </div>
            <Switch checked={crossModelVerify} onCheckedChange={setCrossModelVerify} />
          </div>

          {/* Model Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="w-4 h-4 text-accent" /> Model Selection
              </CardTitle>
              <CardDescription className="text-xs">Choose which AI models handle different task types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {modelsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading models...</div>
              ) : modelsQuery.data ? (
                <>
                  {/* Primary Model */}
                  <div>
                    <Label className="text-xs font-medium">Primary Model <TuningTooltip text="The main model used for most responses. Affects quality, speed, and cost." /></Label>
                    <Select value={primaryModel || modelsQuery.data.defaultModel} onValueChange={setPrimaryModel}>
                      <SelectTrigger className="mt-1.5 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {modelsQuery.data.models.filter(m => m.enabledByDefault).map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <span>{m.displayName}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{m.costTier}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {(() => {
                      const sel = modelsQuery.data?.models.find(m => m.id === (primaryModel || modelsQuery.data?.defaultModel));
                      return sel ? <p className="text-[10px] text-muted-foreground mt-1">{sel.description}</p> : null;
                    })()}
                  </div>
                  {/* Fallback Model */}
                  <div>
                    <Label className="text-xs font-medium">Fallback Model <TuningTooltip text="Used when the primary model is unavailable or fails." /></Label>
                    <Select value={fallbackModel || "gpt-4o-mini"} onValueChange={setFallbackModel}>
                      <SelectTrigger className="mt-1.5 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {modelsQuery.data.models.filter(m => m.enabledByDefault).map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <span>{m.displayName}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{m.costTier}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Synthesis Model */}
                  <div>
                    <Label className="text-xs font-medium">Synthesis Model <TuningTooltip text="Used for multi-perspective synthesis and cross-model verification." /></Label>
                    <Select value={synthesisModel || "gemini-2.5-pro"} onValueChange={setSynthesisModel}>
                      <SelectTrigger className="mt-1.5 text-xs h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {modelsQuery.data.models.filter(m => m.enabledByDefault && (m.costTier === "premium" || m.costTier === "reasoning")).map(m => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
                              <span>{m.displayName}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0">{m.costTier}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Model Capabilities Grid */}
                  <div className="mt-2">
                    <p className="text-[10px] font-medium text-muted-foreground mb-2">Available Models ({modelsQuery.data.enabledModels.length} enabled)</p>
                    <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                      {modelsQuery.data.models.filter(m => m.enabledByDefault).map(m => (
                        <div key={m.id} className={`p-2 rounded-md border text-left transition-all ${
                          m.id === (primaryModel || modelsQuery.data?.defaultModel)
                            ? "border-accent bg-accent/10"
                            : "border-border/50 hover:border-border"
                        }`}>
                          <div className="text-[10px] font-medium truncate">{m.displayName}</div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[8px] px-1 py-0">{m.provider}</Badge>
                            <Badge variant="outline" className="text-[8px] px-1 py-0">{m.costTier}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>

          {/* Model Weighting */}
          <div>
            <Label className="text-xs font-medium mb-2 block">
              Model Perspective Weighting
              <TuningTooltip text="Adjust how much each perspective influences multi-model responses" />
            </Label>
            {presetsQuery.data && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {(Array.isArray(presetsQuery.data) ? presetsQuery.data : []).map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => { setActivePreset(preset.id); setWeights(preset.weights); }}
                    className={`px-2.5 py-1 rounded-md text-[10px] border transition-all ${
                      activePreset === preset.id
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted-foreground hover:border-accent/40"
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            )}
            {perspectivesQuery.data && (
              <div className="space-y-2">
                {(Array.isArray(perspectivesQuery.data) ? perspectivesQuery.data : []).map(p => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-[10px] w-24 text-muted-foreground">{p.name}</span>
                    <Slider
                      value={[weights[p.id] ?? p.weight]}
                      onValueChange={([v]) => setWeights(prev => ({ ...prev, [p.id]: v }))}
                      min={0}
                      max={2}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-[10px] w-8 text-right">{(weights[p.id] ?? p.weight).toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Instructions */}
          <div>
            <Label className="text-xs font-medium">Custom Instructions</Label>
            <Textarea
              value={customInstructions}
              onChange={e => setCustomInstructions(e.target.value)}
              placeholder="Add custom instructions that will be included in every AI response..."
              className="mt-1.5 text-xs min-h-[80px]"
            />
          </div>

          <Button onClick={handleSave} disabled={updatePrefs.isPending} className="w-full">
            {updatePrefs.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Save AI Tuning
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
