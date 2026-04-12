import { useAuth } from "@/_core/hooks/useAuth";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Camera, Brain, Shield, FileText, Sparkles, User,
  Loader2, Settings2, ChevronRight, Bell, Palette, Mic, Link2, Keyboard,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getLoginUrl } from "@/const";
import { useLocation, useRoute } from "wouter";

// Lazy-loaded tab content (each is a self-contained component)
import ProfileTab from "./settings/ProfileTab";
import SuitabilityTab from "./settings/SuitabilityTab";
import KnowledgeBaseTab from "./settings/KnowledgeBaseTab";
import AITuningTab from "./settings/AITuningTab";
import NotificationsTab from "./settings/NotificationsTab";
import AppearanceTab from "./settings/AppearanceTab";
import GuestPreferencesTab from "./settings/GuestPreferencesTab";
import PrivacyDataTab from "./settings/PrivacyDataTab";
import DataSharingTab from "./settings/DataSharingTab";
import VoiceTab from "./settings/VoiceTab";
import ConnectedAccountsTab from "./settings/ConnectedAccountsTab";
import ShortcutsTab from "./settings/ShortcutsTab";

// ─── TAB DEFINITIONS ─────────────────────────────────────────────
type SettingsTab = "profile" | "suitability" | "knowledge" | "ai-tuning" | "voice" | "notifications" | "appearance" | "guest-prefs" | "privacy" | "data-sharing" | "connected-accounts" | "shortcuts";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; desc: string; slug: string }[] = [
  { id: "profile", label: "Profile & Style", icon: <User className="w-4 h-4" />, desc: "Avatar, memories, communication style", slug: "profile" },
  { id: "connected-accounts", label: "Connected Accounts", icon: <Link2 className="w-4 h-4" />, desc: "Link LinkedIn, Google, email for profile enrichment", slug: "connected-accounts" },
  { id: "suitability", label: "Financial Profile", icon: <Shield className="w-4 h-4" />, desc: "Suitability assessment for personalized advice", slug: "suitability" },
  { id: "knowledge", label: "Knowledge Base", icon: <FileText className="w-4 h-4" />, desc: "Documents and files that train your AI", slug: "knowledge" },
  { id: "ai-tuning", label: "AI Tuning", icon: <Sparkles className="w-4 h-4" />, desc: "5-layer AI personalization cascade", slug: "ai-tuning" },
  { id: "voice", label: "Voice & Speech", icon: <Mic className="w-4 h-4" />, desc: "Edge TTS voice selection and speech settings", slug: "voice" },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" />, desc: "Manage in-app alerts and notification preferences", slug: "notifications" },
  { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" />, desc: "Theme, colors, font size, density", slug: "appearance" },
  { id: "guest-prefs", label: "Guest Preferences", icon: <Sparkles className="w-4 h-4" />, desc: "Customize AI responses without an account", slug: "guest-prefs" },
  { id: "privacy", label: "Privacy & Data", icon: <Shield className="w-4 h-4" />, desc: "Data rights, consent, export, and deletion", slug: "privacy" },
  { id: "data-sharing", label: "Data Sharing", icon: <Shield className="w-4 h-4" />, desc: "Control who sees what financial data", slug: "data-sharing" },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: <Keyboard className="w-4 h-4" />, desc: "Customize G-then-X navigation shortcuts", slug: "shortcuts" },
];

// Tabs accessible without authentication
const ANONYMOUS_TABS: SettingsTab[] = ["appearance", "guest-prefs", "voice", "shortcuts"];

export default function SettingsHub() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  // Deep-link support: /settings/:tab
  const [matchTab, paramsTab] = useRoute("/settings/:tab");
  const initialTab = (matchTab && paramsTab?.tab && TABS.find(t => t.slug === paramsTab.tab))
    ? paramsTab.tab as SettingsTab
    : "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Sync URL when tab changes
  useEffect(() => {
    const slug = TABS.find(t => t.id === activeTab)?.slug || "profile";
    navigate(`/settings/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  // Sync tab when URL changes externally
  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = TABS.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const isAuthenticated = !!user;

  // For anonymous users, default to appearance tab if they land on an auth-required tab
  useEffect(() => {
    if (!loading && !isAuthenticated && !ANONYMOUS_TABS.includes(activeTab)) {
      setActiveTab("appearance");
    }
  }, [loading, isAuthenticated]);

  if (loading) {
    return (
      <AppShell title="Settings">
      <SEOHead title="Settings" description="Account settings and preferences" />
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      </AppShell>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;
  const needsAuth = !isAuthenticated && !ANONYMOUS_TABS.includes(activeTab);

  return (
    <AppShell title="Settings">
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Settings2 className="w-4 h-4 text-accent shrink-0" />
          <h1 className="text-sm font-semibold truncate">Settings</h1>
          {/* Mobile tab selector */}
          <button
            className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border text-xs md:hidden"
            onClick={() => setMobileNavOpen(!mobileNavOpen)}
          >
            {currentTab.icon}
            <span className="truncate">{currentTab.label}</span>
            <ChevronRight className={`w-3 h-3 transition-transform ${mobileNavOpen ? "rotate-90" : ""}`} />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto flex min-h-[calc(100vh-3.5rem)]">
        {/* ─── SIDEBAR NAV (desktop always visible, mobile toggle) ─── */}
        <aside className={`
          ${mobileNavOpen ? "block" : "hidden"} md:block
          w-full md:w-56 lg:w-64 shrink-0 border-r border-border/30
          bg-card/20 md:bg-transparent
          fixed md:relative inset-0 top-14 z-20 md:z-0
        `}>
          <div className="p-3 space-y-1">
            {TABS.map((tab) => {
              const tabRequiresAuth = !isAuthenticated && !ANONYMOUS_TABS.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setMobileNavOpen(false); }}
                  className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? "bg-accent/10 text-accent border border-accent/20"
                      : tabRequiresAuth
                        ? "text-muted-foreground/50 hover:text-muted-foreground/70 hover:bg-card/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 ${activeTab === tab.id ? "text-accent" : ""}`}>{tab.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {tab.label}
                      {tabRequiresAuth && <span className="text-[9px] bg-muted/50 text-muted-foreground px-1.5 py-0.5 rounded">Sign in</span>}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{tab.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 top-14 z-10 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {needsAuth ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <User className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Sign in to access {currentTab.label}</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                This setting requires an account. Sign in to personalize your experience, or explore the Appearance tab as a guest.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => { window.location.href = getLoginUrl(); }}
                  className="gap-2"
                >
                  <User className="w-4 h-4" /> Sign In
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setActiveTab("appearance")}
                >
                  <Palette className="w-4 h-4 mr-1.5" /> Appearance
                </Button>
              </div>
            </div>
          ) : (
            <>
              {activeTab === "profile" && <ProfileTab />}
              {activeTab === "connected-accounts" && <ConnectedAccountsTab />}
              {activeTab === "suitability" && <SuitabilityTab />}
              {activeTab === "knowledge" && <KnowledgeBaseTab />}
              {activeTab === "ai-tuning" && <AITuningTab />}
              {activeTab === "voice" && <VoiceTab />}
              {activeTab === "notifications" && <NotificationsTab />}
              {activeTab === "appearance" && <AppearanceTab />}
              {activeTab === "guest-prefs" && <GuestPreferencesTab />}
              {activeTab === "privacy" && <PrivacyDataTab />}
              {activeTab === "data-sharing" && <DataSharingTab />}
              {activeTab === "shortcuts" && <ShortcutsTab />}
            </>
          )}
        </main>
      </div>
    </div>
    </AppShell>
  );
}
