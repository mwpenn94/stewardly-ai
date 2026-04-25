/**
 * LearningSettings.tsx — SRS & Study Preferences Panel
 *
 * Allows users to configure:
 * - Daily review cap (max items per review session)
 * - New card quota (max new items introduced per session)
 * - Daily study goal (minutes)
 * - Nudge/reminder preferences
 */
import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import LearningShell from "@/components/LearningShell";
import { SEOHead } from "@/components/SEOHead";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Settings, ArrowLeft, Clock, Brain, Zap, Bell,
  Target, BookOpen, Save, RotateCcw, LogIn,
} from "lucide-react";
import { motion } from "framer-motion";

/* ── Setting keys ── */
const KEYS = {
  REVIEW_CAP: "srs_daily_review_cap",
  NEW_QUOTA: "srs_new_card_quota",
  DAILY_GOAL: "srs_daily_goal_minutes",
  NUDGE_ENABLED: "srs_nudge_enabled",
  NUDGE_TIME: "srs_nudge_time",
  AUTO_PLAY_AUDIO: "srs_auto_play_audio",
  SHOW_HINTS: "srs_show_hints",
} as const;

/* ── Defaults ── */
const DEFAULTS = {
  [KEYS.REVIEW_CAP]: 20,
  [KEYS.NEW_QUOTA]: 10,
  [KEYS.DAILY_GOAL]: 15,
  [KEYS.NUDGE_ENABLED]: false,
  [KEYS.NUDGE_TIME]: "09:00",
  [KEYS.AUTO_PLAY_AUDIO]: true,
  [KEYS.SHOW_HINTS]: true,
};

type SettingsState = typeof DEFAULTS;

function SettingCard({ icon: Icon, title, description, children, delay = 0 }: {
  icon: any; title: string; description: string; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200, damping: 20 }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ fontFamily: "var(--font-display)" }}>{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </motion.div>
  );
}

export default function LearningSettings() {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const allSettingsQ = trpc.learningSocial.settings.getAll.useQuery(undefined, {
    enabled: !!isAuthenticated,
    staleTime: 30_000,
  });

  const upsertMut = trpc.learningSocial.settings.upsert.useMutation();

  // Local state
  const [settings, setSettings] = useState<SettingsState>({ ...DEFAULTS });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Hydrate from server
  useEffect(() => {
    if (!allSettingsQ.data) return;
    const next = { ...DEFAULTS } as any;
    for (const row of allSettingsQ.data) {
      if (row.settingKey in DEFAULTS) {
        try {
          const val = typeof row.settingValue === "string" ? JSON.parse(row.settingValue) : row.settingValue;
          next[row.settingKey] = val;
        } catch {
          // keep default
        }
      }
    }
    setSettings(next);
    setDirty(false);
  }, [allSettingsQ.data]);

  const update = useCallback(<K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const promises = Object.entries(settings).map(([key, value]) =>
        upsertMut.mutateAsync({ settingKey: key, settingValue: JSON.stringify(value) }),
      );
      await Promise.all(promises);
      toast.success("Settings saved", { description: "Your study preferences have been updated." });
      setDirty(false);
      allSettingsQ.refetch();
    } catch (err: any) {
      toast.error("Error", { description: err.message ?? "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings({ ...DEFAULTS });
    setDirty(true);
  };

  // Auth guard
  if (authLoading) {
    return (
      <LearningShell title="Study Settings">
        <SEOHead title="Study Settings" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </LearningShell>
    );
  }

  if (!isAuthenticated) {
    return (
      <LearningShell title="Study Settings">
        <SEOHead title="Study Settings" />
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <Settings className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "var(--font-display)" }}>Sign in to manage settings</h2>
          <p className="text-sm text-muted-foreground mb-6">Customize your study experience with personalized preferences.</p>
          <a href={getLoginUrl("/learning/settings")}>
            <Button><LogIn className="w-4 h-4 mr-2" />Sign In</Button>
          </a>
        </div>
      </LearningShell>
    );
  }

  return (
    <LearningShell title="Study Settings">
      <SEOHead title="Study Settings" />
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/learning">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Study Settings</h1>
              <p className="text-xs text-muted-foreground">Configure your SRS review and study preferences</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={saving}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>

        {dirty && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            You have unsaved changes
          </motion.div>
        )}

        <div className="space-y-4">
          {/* Review Session Settings */}
          <SettingCard
            icon={Brain}
            title="Review Session"
            description="Control how many items appear in each review session"
            delay={0.1}
          >
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">Daily Review Cap</Label>
                  <Badge variant="outline" className="font-mono text-xs">{settings[KEYS.REVIEW_CAP]}</Badge>
                </div>
                <Slider
                  value={[settings[KEYS.REVIEW_CAP]]}
                  onValueChange={([v]) => update(KEYS.REVIEW_CAP, v)}
                  min={5}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Maximum items per review session (5–100)</p>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs">New Card Quota</Label>
                  <Badge variant="outline" className="font-mono text-xs">{settings[KEYS.NEW_QUOTA]}</Badge>
                </div>
                <Slider
                  value={[settings[KEYS.NEW_QUOTA]]}
                  onValueChange={([v]) => update(KEYS.NEW_QUOTA, v)}
                  min={0}
                  max={50}
                  step={5}
                />
                <p className="text-[10px] text-muted-foreground mt-1">New items introduced per session (0 = review-only mode)</p>
              </div>
            </div>
          </SettingCard>

          {/* Daily Goal */}
          <SettingCard
            icon={Target}
            title="Daily Study Goal"
            description="Set your target study time to build consistent habits"
            delay={0.2}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Minutes per day</Label>
                <Badge variant="outline" className="font-mono text-xs">{settings[KEYS.DAILY_GOAL]} min</Badge>
              </div>
              <Slider
                value={[settings[KEYS.DAILY_GOAL]]}
                onValueChange={([v]) => update(KEYS.DAILY_GOAL, v)}
                min={5}
                max={120}
                step={5}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>5 min</span>
                <span>Quick: 15m · Standard: 30m · Intensive: 60m+</span>
                <span>120 min</span>
              </div>
            </div>
          </SettingCard>

          {/* Reminders */}
          <SettingCard
            icon={Bell}
            title="Study Reminders"
            description="Get nudged to maintain your streak"
            delay={0.3}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Enable Reminders</Label>
                  <p className="text-[10px] text-muted-foreground">Receive a daily nudge to study</p>
                </div>
                <Switch
                  checked={settings[KEYS.NUDGE_ENABLED] as boolean}
                  onCheckedChange={(v) => update(KEYS.NUDGE_ENABLED, v)}
                />
              </div>
              {settings[KEYS.NUDGE_ENABLED] && (
                <div>
                  <Label className="text-xs mb-1 block">Preferred Time</Label>
                  <input
                    type="time"
                    value={settings[KEYS.NUDGE_TIME] as string}
                    onChange={(e) => update(KEYS.NUDGE_TIME, e.target.value)}
                    className="bg-muted/40 border border-border rounded-md px-3 py-1.5 text-sm"
                  />
                </div>
              )}
            </div>
          </SettingCard>

          {/* Study Experience */}
          <SettingCard
            icon={Zap}
            title="Study Experience"
            description="Fine-tune your learning session behavior"
            delay={0.4}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Auto-play Audio</Label>
                  <p className="text-[10px] text-muted-foreground">Automatically play audio in hands-free mode</p>
                </div>
                <Switch
                  checked={settings[KEYS.AUTO_PLAY_AUDIO] as boolean}
                  onCheckedChange={(v) => update(KEYS.AUTO_PLAY_AUDIO, v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs">Show Hints</Label>
                  <p className="text-[10px] text-muted-foreground">Display hint buttons on flashcards and quiz questions</p>
                </div>
                <Switch
                  checked={settings[KEYS.SHOW_HINTS] as boolean}
                  onCheckedChange={(v) => update(KEYS.SHOW_HINTS, v)}
                />
              </div>
            </div>
          </SettingCard>
        </div>

        {/* Bottom save bar (sticky on mobile) */}
        {dirty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="sticky bottom-4 mt-6 flex justify-end gap-2"
          >
            <Button variant="outline" onClick={handleReset} disabled={saving}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />Reset to Defaults
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-3.5 h-3.5 mr-1.5" />{saving ? "Saving…" : "Save All Changes"}
            </Button>
          </motion.div>
        )}
      </div>
    </LearningShell>
  );
}
