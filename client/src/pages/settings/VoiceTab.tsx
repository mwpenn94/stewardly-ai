/**
 * VoiceTab — Edge TTS voice selection, preview, and voice settings.
 * Accessible to both guests (localStorage) and authenticated users (server sync).
 */
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import {
  Mic, Play, Square, Loader2, Volume2, VolumeX, Headphones,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// ─── LOCAL STORAGE KEYS ──────────────────────────────────────────
const LS_VOICE = "tts-voice";
const LS_TTS_ENABLED = "tts-enabled";
const LS_HANDS_FREE = "hands-free-default";
const LS_SPEECH_RATE = "tts-speech-rate";
const LS_AUTO_PLAY = "tts-auto-play";

// ─── LOCALE LABELS ───────────────────────────────────────────────
const LOCALE_LABELS: Record<string, string> = {
  "en-US": "American",
  "en-GB": "British",
  "en-AU": "Australian",
  "en-IE": "Irish",
  "en-IN": "Indian",
  "en-CA": "Canadian",
};

export default function VoiceTab() {
  const { user } = useAuth();
  const voicesQuery = trpc.voice.voices.useQuery(undefined, { staleTime: 60_000 });
  const speakMutation = trpc.voice.speak.useMutation();

  // ─── Voice selection state ─────────────────────────────────────
  const [selectedVoice, setSelectedVoice] = useState<string>(() =>
    localStorage.getItem(LS_VOICE) || "aria"
  );
  const [previewPlaying, setPreviewPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [localeFilter, setLocaleFilter] = useState<string>("all");

  // ─── Voice behavior settings ───────────────────────────────────
  const [ttsEnabled, setTtsEnabled] = useState<boolean>(() =>
    localStorage.getItem(LS_TTS_ENABLED) !== "false"
  );
  const [autoPlay, setAutoPlay] = useState<boolean>(() =>
    localStorage.getItem(LS_AUTO_PLAY) === "true"
  );
  const [handsFreeDefault, setHandsFreeDefault] = useState<boolean>(() =>
    localStorage.getItem(LS_HANDS_FREE) === "true"
  );
  const [speechRate, setSpeechRate] = useState<number>(() => {
    const stored = localStorage.getItem(LS_SPEECH_RATE);
    return stored ? parseFloat(stored) : 1.0;
  });

  // ─── Persist to localStorage ───────────────────────────────────
  useEffect(() => { localStorage.setItem(LS_VOICE, selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem(LS_TTS_ENABLED, String(ttsEnabled)); }, [ttsEnabled]);
  useEffect(() => { localStorage.setItem(LS_AUTO_PLAY, String(autoPlay)); }, [autoPlay]);
  useEffect(() => { localStorage.setItem(LS_HANDS_FREE, String(handsFreeDefault)); }, [handsFreeDefault]);
  useEffect(() => { localStorage.setItem(LS_SPEECH_RATE, String(speechRate)); }, [speechRate]);

  // ─── Sync to server for authenticated users ────────────────────
  const updatePrefs = trpc.aiLayers.updateUserPreferences.useMutation();
  useEffect(() => {
    if (user) {
      // Debounced sync to server
      const timer = setTimeout(() => {
        updatePrefs.mutate({
          ttsVoice: selectedVoice,
          autoPlayVoice: autoPlay,
          handsFreeMode: handsFreeDefault,
        });
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [selectedVoice, autoPlay, handsFreeDefault, user]);

  // ─── Voice list ────────────────────────────────────────────────
  const voices = voicesQuery.data || [];
  const locales = Array.from(new Set(voices.map(v => v.locale))).sort();
  const filteredVoices = localeFilter === "all"
    ? voices
    : voices.filter(v => v.locale === localeFilter);

  // ─── Preview ───────────────────────────────────────────────────
  const handlePreview = useCallback((voiceId: string, label: string) => {
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
      {
        text: `Hi, I'm ${label}. I'll be your financial advisor's voice assistant. How can I help you today?`,
        voice: voiceId,
      },
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
  }, [previewPlaying, speakMutation]);

  const handleSelect = useCallback((voiceId: string) => {
    setSelectedVoice(voiceId);
    toast.success("Voice preference saved");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const rateLabel = speechRate <= 0.7 ? "Slow" : speechRate <= 1.1 ? "Normal" : speechRate <= 1.5 ? "Fast" : "Very Fast";

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mic className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Voice & Speech</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Choose your AI assistant's voice and configure speech behavior.
          {!user && " Preferences are saved locally in your browser."}
        </p>
      </div>

      {/* ─── VOICE BEHAVIOR SETTINGS ─────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-accent" /> Voice Behavior
          </CardTitle>
          <CardDescription className="text-xs">
            Control when and how the AI speaks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* TTS Enabled */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              {ttsEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium">Text-to-Speech</p>
                <p className="text-xs text-muted-foreground">Enable voice responses from the AI</p>
              </div>
            </div>
            <Switch checked={ttsEnabled} onCheckedChange={setTtsEnabled} />
          </div>

          {/* Auto-Play */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <Play className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Auto-Play Responses</p>
                <p className="text-xs text-muted-foreground">Automatically read AI responses aloud</p>
              </div>
            </div>
            <Switch checked={autoPlay} onCheckedChange={setAutoPlay} />
          </div>

          {/* Hands-Free Default */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <Headphones className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Default Hands-Free Mode</p>
                <p className="text-xs text-muted-foreground">Start chat sessions in hands-free mode</p>
              </div>
            </div>
            <Switch checked={handsFreeDefault} onCheckedChange={setHandsFreeDefault} />
          </div>

          {/* Speech Rate */}
          <div className="p-3 rounded-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Speech Rate</Label>
              <Badge variant="outline" className="text-[10px]">{rateLabel} ({speechRate.toFixed(1)}x)</Badge>
            </div>
            <Slider
              value={[speechRate]}
              onValueChange={([v]) => setSpeechRate(v)}
              min={0.5}
              max={2.0}
              step={0.1}
              className="w-full"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Slow</span><span>Normal</span><span>Fast</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* ─── VOICE SELECTION ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Mic className="w-4 h-4 text-accent" /> Voice Selection
          </CardTitle>
          <CardDescription className="text-xs">
            Choose the voice for your AI assistant. Click the play button to preview, then select your preferred voice.
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
                {LOCALE_LABELS[loc] || loc}
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
                          {isSelected && <span className="ml-1.5 text-accent text-[10px]">{"\u2713"} Active</span>}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {v.description} {"\u00b7"} {LOCALE_LABELS[v.locale] || v.locale}
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

          {!voicesQuery.isLoading && filteredVoices.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No voices available for this locale.</p>
          )}
        </CardContent>
      </Card>

      {/* Storage info */}
      <p className="text-xs text-muted-foreground text-center">
        {user
          ? "Voice preferences are synced to your account and saved locally."
          : "Voice preferences are saved in your browser and persist across sessions."}
      </p>
    </div>
  );
}
