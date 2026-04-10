/**
 * AudioPreferences.tsx — Audio & Voice settings page
 *
 * Pass 119. Located at /settings/audio.
 */

import { useState, useCallback } from "react";
import {
  Volume2, Mic, Sliders, Headphones,
  Play, Globe, Zap, Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

/* ── types ─────────────────────────────────────────────────────── */

interface VoiceOption {
  id: string;
  name: string;
  gender: string;
  style: string;
}

interface AudioPrefs {
  voiceId: string;
  speed: number;
  pitch: string;
  expandAcronyms: boolean;
  simplifyLanguage: boolean;
  includeExamples: boolean;
  verbosityLevel: "concise" | "standard" | "detailed";
  enableNavigationAudio: boolean;
  enableActionFeedback: boolean;
  enableSoundEffects: boolean;
  autoRefineScripts: boolean;
}

interface Props {
  preferences?: AudioPrefs;
  onSave?: (prefs: AudioPrefs) => void;
  voices?: VoiceOption[];
  isLoading?: boolean;
}

const DEFAULT_PREFS: AudioPrefs = {
  voiceId: "en-US-GuyNeural",
  speed: 1.0,
  pitch: "default",
  expandAcronyms: true,
  simplifyLanguage: false,
  includeExamples: true,
  verbosityLevel: "standard",
  enableNavigationAudio: true,
  enableActionFeedback: true,
  enableSoundEffects: true,
  autoRefineScripts: true,
};

const DEFAULT_VOICES: VoiceOption[] = [
  { id: "en-US-GuyNeural", name: "Guy", gender: "male", style: "Conversational" },
  { id: "en-US-JennyNeural", name: "Jenny", gender: "female", style: "Friendly" },
  { id: "en-US-AriaNeural", name: "Aria", gender: "female", style: "Professional" },
  { id: "en-US-DavisNeural", name: "Davis", gender: "male", style: "Calm" },
];

export default function AudioPreferences({ preferences, onSave, voices, isLoading }: Props) {
  const { isAuthenticated } = useAuth();
  // Self-sufficient mode: fetch/save via tRPC when no props provided
  const prefsQ = trpc.audio.getPreferences.useQuery(undefined, {
    enabled: isAuthenticated && !preferences,
    retry: false,
  });
  const saveMut = trpc.audio.updatePreferences.useMutation({
    onSuccess: () => { toast.success("Audio preferences saved"); prefsQ.refetch(); },
    onError: () => toast.error("Failed to save preferences"),
  });
  const initialPrefs = preferences ?? (prefsQ.data as AudioPrefs | undefined) ?? DEFAULT_PREFS;
  const [prefs, setPrefs] = useState<AudioPrefs>(initialPrefs);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const audio = useAudioCompanion();
  const voiceList = voices ?? DEFAULT_VOICES;

  const update = <K extends keyof AudioPrefs>(key: K, value: AudioPrefs[K]) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
  };

  const previewVoice = useCallback(() => {
    setPreviewPlaying(true);
    audio.play({
      id: "voice-preview",
      type: "page_narration",
      title: "Voice Preview",
      script: "This is how I sound when reading your financial documents and study materials. I can adjust my speed, pitch, and style to match your preferences.",
    });
    setTimeout(() => setPreviewPlaying(false), 4000);
  }, [audio]);

  const handleSave = () => {
    if (onSave) {
      onSave(prefs);
    } else if (isAuthenticated) {
      saveMut.mutate(prefs);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-20 md:pb-6 space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold mb-1">Audio & Voice</h1>
        <p className="text-sm text-muted-foreground">
          Configure how Steward sounds and how audio features work across the platform.
        </p>
      </div>

      {/* Voice Selection */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          <Headphones className="w-3.5 h-3.5" /> Voice
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {voiceList.map(voice => (
              <button key={voice.id}
                onClick={() => update("voiceId", voice.id)}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-colors
                  ${prefs.voiceId === voice.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/20"}`}>
                <div className="text-sm font-medium">{voice.name}</div>
                <div className="text-[10px] text-muted-foreground">{voice.gender} · {voice.style}</div>
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 cursor-pointer" onClick={previewVoice} disabled={previewPlaying}>
            <Play className="w-3.5 h-3.5" />{previewPlaying ? "Playing..." : "Preview Voice"}
          </Button>
        </div>
      </section>

      {/* Speed & Pitch */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          <Sliders className="w-3.5 h-3.5" /> Speed & Pitch
        </h2>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm">Speed</label>
              <span className="text-sm font-mono tabular-nums text-primary">{prefs.speed.toFixed(2)}x</span>
            </div>
            <Slider value={[prefs.speed]} onValueChange={([v]) => update("speed", v)} min={0.5} max={2.5} step={0.25} className="cursor-pointer" />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0.5x Slow</span><span>1.0x Normal</span><span>2.5x Fast</span>
            </div>
          </div>
          <div>
            <label className="text-sm">Pitch</label>
            <div className="flex gap-2 mt-2">
              {["low", "default", "high"].map(p => (
                <button key={p} onClick={() => update("pitch", p)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-colors capitalize
                    ${prefs.pitch === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Content Style */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          <Globe className="w-3.5 h-3.5" /> Content Style
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Expand acronyms</div>
              <div className="text-[10px] text-muted-foreground">"IUL — that's Indexed Universal Life"</div>
            </div>
            <Switch checked={prefs.expandAcronyms} onCheckedChange={v => update("expandAcronyms", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Simplify language</div>
              <div className="text-[10px] text-muted-foreground">Use plainer words for complex concepts</div>
            </div>
            <Switch checked={prefs.simplifyLanguage} onCheckedChange={v => update("simplifyLanguage", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm">Include examples</div>
              <div className="text-[10px] text-muted-foreground">Add practical illustrations after definitions</div>
            </div>
            <Switch checked={prefs.includeExamples} onCheckedChange={v => update("includeExamples", v)} />
          </div>
          <div>
            <div className="text-sm mb-2">Detail level</div>
            <div className="flex gap-2">
              {(["concise", "standard", "detailed"] as const).map(level => (
                <button key={level} onClick={() => update("verbosityLevel", level)}
                  className={`flex-1 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-colors
                    ${prefs.verbosityLevel === level ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  <div className="font-medium capitalize">{level}</div>
                  <div className="text-[10px] opacity-60">
                    {level === "concise" && "Key facts only"}
                    {level === "standard" && "Full explanation"}
                    {level === "detailed" && "With context"}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Navigation & Feedback */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          <Zap className="w-3.5 h-3.5" /> Navigation & Feedback
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Voice navigation</div><div className="text-[10px] text-muted-foreground">Say "go to clients" to navigate by voice</div></div>
            <Switch checked={prefs.enableNavigationAudio} onCheckedChange={v => update("enableNavigationAudio", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Action feedback</div><div className="text-[10px] text-muted-foreground">Hear confirmation when actions complete</div></div>
            <Switch checked={prefs.enableActionFeedback} onCheckedChange={v => update("enableActionFeedback", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><div className="text-sm">Sound effects</div><div className="text-[10px] text-muted-foreground">Subtle sounds for sends, correct answers, etc.</div></div>
            <Switch checked={prefs.enableSoundEffects} onCheckedChange={v => update("enableSoundEffects", v)} />
          </div>
        </div>
      </section>

      {/* AI Script Quality */}
      <section>
        <h2 className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
          <Settings className="w-3.5 h-3.5" /> Audio Quality
        </h2>
        <div className="flex items-center justify-between">
          <div><div className="text-sm">Auto-refine audio scripts</div><div className="text-[10px] text-muted-foreground">AI improves scripts based on your listening patterns</div></div>
          <Switch checked={prefs.autoRefineScripts} onCheckedChange={v => update("autoRefineScripts", v)} />
        </div>
      </section>

      <Button className="w-full cursor-pointer" onClick={handleSave}>Save Audio Preferences</Button>
    </div>
  );
}
