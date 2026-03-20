import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Palette, Type, Monitor, Moon, Sun, Save, Check } from "lucide-react";
import { toast } from "sonner";

const ACCENT_COLORS = [
  { name: "Sky", value: "sky", hsl: "199 89% 48%" },
  { name: "Emerald", value: "emerald", hsl: "160 84% 39%" },
  { name: "Violet", value: "violet", hsl: "263 70% 50%" },
  { name: "Amber", value: "amber", hsl: "38 92% 50%" },
  { name: "Rose", value: "rose", hsl: "350 89% 60%" },
  { name: "Cyan", value: "cyan", hsl: "189 94% 43%" },
];

const FONT_SIZES = [
  { label: "Compact", value: "compact", scale: 0.9 },
  { label: "Default", value: "default", scale: 1.0 },
  { label: "Comfortable", value: "comfortable", scale: 1.1 },
  { label: "Large", value: "large", scale: 1.2 },
];

export default function AppearanceTab() {
  const [theme, setTheme] = useState<"dark" | "light" | "system">(() => {
    return (localStorage.getItem("wb_theme") as any) || "dark";
  });
  const [accentColor, setAccentColor] = useState(() => {
    return localStorage.getItem("wb_accent_color") || "sky";
  });
  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem("wb_font_size") || "default";
  });
  const [reducedMotion, setReducedMotion] = useState(() => {
    return localStorage.getItem("wb_reduced_motion") === "true";
  });
  const [sidebarCompact, setSidebarCompact] = useState(() => {
    return localStorage.getItem("wb_sidebar_compact") === "true";
  });
  const [chatDensity, setChatDensity] = useState<number[]>(() => {
    const saved = localStorage.getItem("wb_chat_density");
    return saved ? [parseInt(saved)] : [2];
  });

  const save = () => {
    localStorage.setItem("wb_theme", theme);
    localStorage.setItem("wb_accent_color", accentColor);
    localStorage.setItem("wb_font_size", fontSize);
    localStorage.setItem("wb_reduced_motion", String(reducedMotion));
    localStorage.setItem("wb_sidebar_compact", String(sidebarCompact));
    localStorage.setItem("wb_chat_density", String(chatDensity[0]));
    toast.success("Appearance preferences saved");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your workspace.
        </p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" /> Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {([
              { id: "dark", label: "Dark", icon: <Moon className="w-5 h-5" />, desc: "Easy on the eyes" },
              { id: "light", label: "Light", icon: <Sun className="w-5 h-5" />, desc: "Classic bright" },
              { id: "system", label: "System", icon: <Monitor className="w-5 h-5" />, desc: "Match OS" },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                  theme === opt.id
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                }`}
              >
                {theme === opt.id && <Check className="absolute top-2 right-2 w-3 h-3 text-accent" />}
                {opt.icon}
                <span className="text-xs font-medium">{opt.label}</span>
                <span className="text-[9px] text-muted-foreground">{opt.desc}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accent Color */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Palette className="w-4 h-4 text-accent" /> Accent Color
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {ACCENT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => setAccentColor(color.value)}
                className={`relative w-10 h-10 rounded-full border-2 transition-all ${
                  accentColor === color.value ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: `hsl(${color.hsl})` }}
                title={color.name}
              >
                {accentColor === color.value && <Check className="absolute inset-0 m-auto w-4 h-4 text-white" />}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Selected: {ACCENT_COLORS.find(c => c.value === accentColor)?.name || "Sky"}
          </p>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Type className="w-4 h-4 text-accent" /> Font Size
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {FONT_SIZES.map(fs => (
              <button
                key={fs.value}
                onClick={() => setFontSize(fs.value)}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                  fontSize === fs.value
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {fs.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chat Density */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Chat Message Density</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Slider value={chatDensity} onValueChange={setChatDensity} min={1} max={3} step={1} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Compact</span>
            <span>Default</span>
            <span>Spacious</span>
          </div>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Reduced motion</Label>
              <p className="text-[10px] text-muted-foreground">Minimize animations and transitions</p>
            </div>
            <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Compact sidebar</Label>
              <p className="text-[10px] text-muted-foreground">Show icons only in the sidebar navigation</p>
            </div>
            <Switch checked={sidebarCompact} onCheckedChange={setSidebarCompact} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} className="gap-2">
        <Save className="w-4 h-4" /> Save Preferences
      </Button>
    </div>
  );
}
