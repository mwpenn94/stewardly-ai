import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useGuestPreferences } from "@/hooks/useGuestPreferences";
import { getLoginUrl } from "@/const";
import {
  Sparkles, RotateCcw, User, MessageSquare, BookOpen,
  Gauge, Smile, Code2, ListChecks, Type, Target,
} from "lucide-react";
import { toast } from "sonner";

const FOCUS_OPTIONS = [
  { value: "general", label: "General", icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { value: "investing", label: "Investing", icon: <Target className="w-3.5 h-3.5" /> },
  { value: "budgeting", label: "Budgeting", icon: <ListChecks className="w-3.5 h-3.5" /> },
  { value: "retirement", label: "Retirement", icon: <BookOpen className="w-3.5 h-3.5" /> },
  { value: "taxes", label: "Taxes", icon: <Code2 className="w-3.5 h-3.5" /> },
  { value: "real-estate", label: "Real Estate", icon: <Type className="w-3.5 h-3.5" /> },
];

export default function GuestPreferencesTab() {
  const { preferences, setPreferences, resetPreferences } = useGuestPreferences();

  const handleReset = () => {
    resetPreferences();
    toast.success("Preferences reset to defaults");
  };

  const toggleFocusArea = (area: string) => {
    const current = preferences.focusAreas;
    if (current.includes(area)) {
      if (current.length <= 1) return; // Keep at least one
      setPreferences({ focusAreas: current.filter(a => a !== area) });
    } else {
      setPreferences({ focusAreas: [...current, area] });
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-semibold">Guest Preferences</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Customize how the AI responds to you. These preferences are saved locally in your browser.
        </p>
      </div>

      {/* Sign-in prompt */}
      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Unlock full personalization</p>
            <p className="text-xs text-muted-foreground">
              Sign in to save preferences across devices, access AI memory, style profiles, and suitability-based advice.
            </p>
          </div>
          <Button size="sm" onClick={() => { window.location.href = getLoginUrl(); }}>
            Sign In
          </Button>
        </CardContent>
      </Card>

      {/* Response Depth */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm">Response Depth</CardTitle>
          </div>
          <CardDescription className="text-xs">How detailed should AI responses be?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(["brief", "balanced", "detailed"] as const).map((depth) => (
              <button
                key={depth}
                onClick={() => setPreferences({ responseDepth: depth })}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  preferences.responseDepth === depth
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:border-accent/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {depth === "brief" && "Brief"}
                {depth === "balanced" && "Balanced"}
                {depth === "detailed" && "Detailed"}
                <p className="text-[10px] font-normal mt-0.5 opacity-70">
                  {depth === "brief" && "1-2 sentences"}
                  {depth === "balanced" && "Moderate detail"}
                  {depth === "detailed" && "Thorough"}
                </p>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tone */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm">Tone</CardTitle>
          </div>
          <CardDescription className="text-xs">How should the AI communicate with you?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {(["professional", "friendly", "casual"] as const).map((tone) => (
              <button
                key={tone}
                onClick={() => setPreferences({ tone })}
                className={`px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  preferences.tone === tone
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:border-accent/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {tone === "professional" && "Professional"}
                {tone === "friendly" && "Friendly"}
                {tone === "casual" && "Casual"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Language Style */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm">Language Style</CardTitle>
          </div>
          <CardDescription className="text-xs">How technical should the language be?</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={preferences.languageStyle}
            onValueChange={(v) => setPreferences({ languageStyle: v as any })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="simple">Simple — Avoid jargon, plain language</SelectItem>
              <SelectItem value="standard">Standard — Normal vocabulary</SelectItem>
              <SelectItem value="technical">Technical — Precise terminology</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm">Response Format</CardTitle>
          </div>
          <CardDescription className="text-xs">How should responses be structured?</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={preferences.responseFormat}
            onValueChange={(v) => setPreferences({ responseFormat: v as any })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conversational">Conversational — Natural flowing text</SelectItem>
              <SelectItem value="structured">Structured — Headers and sections</SelectItem>
              <SelectItem value="bullet-points">Bullet Points — Concise lists</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Include Examples */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-accent" />
              <div>
                <p className="text-sm font-medium">Include Examples</p>
                <p className="text-xs text-muted-foreground">Add practical examples to explanations</p>
              </div>
            </div>
            <Switch
              checked={preferences.includeExamples}
              onCheckedChange={(v) => setPreferences({ includeExamples: v })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Focus Areas */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <CardTitle className="text-sm">Focus Areas</CardTitle>
          </div>
          <CardDescription className="text-xs">Select topics you're most interested in</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleFocusArea(opt.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  preferences.focusAreas.includes(opt.value)
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border hover:border-accent/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.icon}
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Reset */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Preferences are stored in your browser and will persist across sessions.
        </p>
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
