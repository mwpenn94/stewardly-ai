/**
 * AppearanceTab — Build Loop Pass 4 (G51 rewrite)
 *
 * Before: six controls that wrote localStorage and a "Save Preferences"
 * button that triggered a success toast while nothing in the app actually
 * changed. Users picking "Light" theme got a confirmation and no visual
 * effect. G51 called this a Potemkin UI.
 *
 * After: every control directly calls `useTheme().updateSettings(...)`,
 * which persists AND applies instantly. There is no save button because
 * there's nothing to "save" — your click already took effect. The accent
 * color selector is gone (the Stewardship Gold brand is intentional — we
 * don't let users pick a different primary hex).
 *
 * Accessibility:
 * - Every option button has an explicit `aria-label`.
 * - The current selection is marked with `aria-pressed="true"` so SR
 *   users hear "Dark theme, pressed" instead of just "Dark theme".
 * - Descriptive helper text per section explains what the setting does.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Type,
  Monitor,
  Moon,
  Sun,
  Check,
  MessageSquare,
  Eye,
  Accessibility,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import type {
  ChatDensity,
  ColorBlindMode,
  FontScale,
  ThemePreference,
} from "@/lib/appearanceSettings";

const FONT_SIZES: Array<{ label: string; value: FontScale; pct: string }> = [
  { label: "Compact", value: "compact", pct: "90%" },
  { label: "Default", value: "default", pct: "100%" },
  { label: "Comfortable", value: "comfortable", pct: "110%" },
  { label: "Large", value: "large", pct: "120%" },
  { label: "X-Large", value: "xlarge", pct: "135%" },
];

const CHAT_DENSITIES: Array<{ label: string; value: ChatDensity; desc: string }> = [
  { label: "Compact", value: "compact", desc: "Tighter message spacing" },
  { label: "Default", value: "default", desc: "Balanced" },
  { label: "Spacious", value: "spacious", desc: "Roomier, easier to scan" },
];

const COLOR_BLIND_MODES: Array<{ label: string; value: ColorBlindMode; desc: string }> = [
  { label: "Off", value: "off", desc: "Default palette" },
  { label: "Deuteranopia", value: "deuteranopia", desc: "Red/green (most common)" },
  { label: "Protanopia", value: "protanopia", desc: "Red weakness" },
  { label: "Tritanopia", value: "tritanopia", desc: "Blue weakness" },
  { label: "All adornments", value: "all", desc: "Pattern + shifted palette" },
];

export default function AppearanceTab() {
  const { settings, updateSettings, preference } = useTheme();

  const pickTheme = (theme: ThemePreference) => updateSettings({ theme });
  const pickFont = (fontScale: FontScale) => updateSettings({ fontScale });
  const pickDensity = (chatDensity: ChatDensity) => updateSettings({ chatDensity });
  const pickColorBlind = (colorBlindMode: ColorBlindMode) => updateSettings({ colorBlindMode });

  return (
    <div className="max-w-2xl space-y-6" data-testid="appearance-tab">
      <div>
        <h2 className="text-lg font-semibold mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground">
          Customize the look and feel of your workspace. Changes apply instantly — no save required.
        </p>
      </div>

      {/* Theme */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" aria-hidden="true" /> Theme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            role="radiogroup"
            aria-label="Theme preference"
          >
            {(
              [
                {
                  id: "dark",
                  label: "Dark",
                  icon: <Moon className="w-5 h-5" />,
                  desc: "Easy on the eyes",
                },
                {
                  id: "light",
                  label: "Light",
                  icon: <Sun className="w-5 h-5" />,
                  desc: "Classic bright",
                },
                {
                  id: "system",
                  label: "System",
                  icon: <Monitor className="w-5 h-5" />,
                  desc: "Match OS",
                },
              ] as const
            ).map((opt) => {
              const active = preference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${opt.label} theme — ${opt.desc}`}
                  onClick={() => pickTheme(opt.id)}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-lg border transition-all card-lift ${
                    active
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
                  }`}
                >
                  {active && (
                    <Check
                      className="absolute top-2 right-2 w-3 h-3 text-accent"
                      aria-hidden="true"
                    />
                  )}
                  {opt.icon}
                  <span className="text-xs font-medium">{opt.label}</span>
                  <span className="text-[9px] text-muted-foreground">{opt.desc}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            The Stewardship Gold brand accent stays consistent across both modes. "System"
            tracks your OS dark-mode setting automatically.
          </p>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Type className="w-4 h-4 text-accent" aria-hidden="true" /> Font Size
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Font size">
            {FONT_SIZES.map((fs) => {
              const active = settings.fontScale === fs.value;
              return (
                <button
                  key={fs.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${fs.label} font size, ${fs.pct}`}
                  onClick={() => pickFont(fs.value)}
                  className={`min-w-[88px] px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span>{fs.label}</span>
                    <span className="text-[9px] opacity-70">{fs.pct}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Scales the root font-size so all rem-based spacing follows. Affects text,
            buttons, and padding across the entire app. X-Large is intended for low-vision
            users — it increases text by 35%.
          </p>
        </CardContent>
      </Card>

      {/* Chat Density */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-accent" aria-hidden="true" /> Chat Message Density
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2" role="radiogroup" aria-label="Chat density">
            {CHAT_DENSITIES.map((d) => {
              const active = settings.chatDensity === d.value;
              return (
                <button
                  key={d.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${d.label} chat density — ${d.desc}`}
                  onClick={() => pickDensity(d.value)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span>{d.label}</span>
                    <span className="text-[9px] opacity-70">{d.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Color-blind mode — Pass 10 (G13) */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Eye className="w-4 h-4 text-accent" aria-hidden="true" /> Color vision
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color vision mode">
            {COLOR_BLIND_MODES.map((m) => {
              const active = settings.colorBlindMode === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={`${m.label} — ${m.desc}`}
                  onClick={() => pickColorBlind(m.value)}
                  className={`min-w-[130px] px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    active
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex flex-col items-start gap-0.5">
                    <span>{m.label}</span>
                    <span className="text-[9px] opacity-70">{m.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground mt-3">
            Non-"Off" modes add ✓ / ✕ / ! pattern adornments next to status
            colors so red/green isn't the only signal, bump focus rings to
            3px, and shift chart colors to a color-blind-safe palette. Every
            critical state indicator is readable without relying on hue alone.
          </p>
        </CardContent>
      </Card>

      {/* Toggles */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Accessibility className="w-4 h-4 text-accent" aria-hidden="true" /> Accessibility
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Label htmlFor="appearance-reduced-motion" className="text-sm font-medium">
                Reduced motion
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Disable non-essential animations — pulse glows, card lifts, message fade-ins.
                Your OS setting is also respected automatically.
              </p>
            </div>
            <Switch
              id="appearance-reduced-motion"
              checked={settings.reducedMotion}
              onCheckedChange={(v) => updateSettings({ reducedMotion: v })}
              aria-label="Toggle reduced motion"
            />
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Label htmlFor="appearance-sidebar-compact" className="text-sm font-medium">
                Compact sidebar
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Show icons only in the sidebar navigation. Frees up horizontal space for
                wider chat messages.
              </p>
            </div>
            <Switch
              id="appearance-sidebar-compact"
              checked={settings.sidebarCompact}
              onCheckedChange={(v) => updateSettings({ sidebarCompact: v })}
              aria-label="Toggle compact sidebar"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-accent/20 bg-accent/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex items-start gap-2">
            <Eye className="w-4 h-4 text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Live preview.</span> Every
              change applies instantly. To reset, pick each control's "Default" option.
              Your choices sync across tabs in this browser.
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
