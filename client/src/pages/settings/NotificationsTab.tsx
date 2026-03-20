import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Mail, MessageSquare, TrendingUp, Shield, Calendar, Save } from "lucide-react";
import { toast } from "sonner";

const NOTIFICATION_GROUPS = [
  {
    title: "Chat & AI",
    icon: <MessageSquare className="w-4 h-4" />,
    items: [
      { key: "chatMentions", label: "Chat mentions", desc: "When someone mentions you in a conversation" },
      { key: "aiInsights", label: "AI-generated insights", desc: "Proactive insights about your finances or clients" },
      { key: "studyReminders", label: "Study reminders", desc: "Reminders to continue learning sessions" },
    ],
  },
  {
    title: "Financial",
    icon: <TrendingUp className="w-4 h-4" />,
    items: [
      { key: "marketAlerts", label: "Market alerts", desc: "Significant market movements relevant to your portfolio" },
      { key: "goalProgress", label: "Goal milestones", desc: "When you reach financial goal milestones" },
      { key: "complianceAlerts", label: "Compliance alerts", desc: "Compliance review results and flagged items" },
    ],
  },
  {
    title: "Professional",
    icon: <Calendar className="w-4 h-4" />,
    items: [
      { key: "clientActivity", label: "Client activity", desc: "When clients complete suitability or upload documents" },
      { key: "meetingReminders", label: "Meeting reminders", desc: "Upcoming meeting briefs and follow-up reminders" },
      { key: "teamUpdates", label: "Team updates", desc: "Team member activity and performance summaries" },
    ],
  },
  {
    title: "System",
    icon: <Shield className="w-4 h-4" />,
    items: [
      { key: "securityAlerts", label: "Security alerts", desc: "Login from new device, password changes" },
      { key: "productUpdates", label: "Product updates", desc: "New features and platform improvements" },
    ],
  },
];

export default function NotificationsTab() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem("wb_notification_prefs");
    if (saved) return JSON.parse(saved);
    // Default all to true
    const defaults: Record<string, boolean> = {};
    NOTIFICATION_GROUPS.forEach(g => g.items.forEach(i => { defaults[i.key] = true; }));
    return defaults;
  });

  const [emailDigest, setEmailDigest] = useState<"none" | "daily" | "weekly">(() => {
    return (localStorage.getItem("wb_email_digest") as any) || "weekly";
  });

  const toggle = (key: string) => {
    setPrefs(p => ({ ...p, [key]: !p[key] }));
  };

  const save = () => {
    localStorage.setItem("wb_notification_prefs", JSON.stringify(prefs));
    localStorage.setItem("wb_email_digest", emailDigest);
    toast.success("Notification preferences saved");
  };

  const enabledCount = Object.values(prefs).filter(Boolean).length;
  const totalCount = Object.keys(prefs).length;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose which notifications you receive. {enabledCount}/{totalCount} enabled.
        </p>
      </div>

      {/* Email Digest */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" /> Email Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(["none", "daily", "weekly"] as const).map(opt => (
              <button
                key={opt}
                onClick={() => setEmailDigest(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  emailDigest === opt
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt === "none" ? "Off" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            {emailDigest === "none" ? "No email summaries." : `Receive a ${emailDigest} summary of your notifications.`}
          </p>
        </CardContent>
      </Card>

      {/* Notification Groups */}
      {NOTIFICATION_GROUPS.map(group => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <span className="text-accent">{group.icon}</span> {group.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.items.map(item => (
              <div key={item.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <Label className="text-sm font-medium">{item.label}</Label>
                  <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch checked={!!prefs[item.key]} onCheckedChange={() => toggle(item.key)} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Button onClick={save} className="gap-2">
        <Save className="w-4 h-4" /> Save Preferences
      </Button>
    </div>
  );
}
