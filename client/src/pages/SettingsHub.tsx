import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Camera, Brain, Shield, FileText, Sparkles, User,
  Loader2, Settings2, ChevronRight, Bell, Palette,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";

// Lazy-loaded tab content (each is a self-contained component)
import ProfileTab from "./settings/ProfileTab";
import SuitabilityTab from "./settings/SuitabilityTab";
import KnowledgeBaseTab from "./settings/KnowledgeBaseTab";
import AITuningTab from "./settings/AITuningTab";
import NotificationsTab from "./settings/NotificationsTab";
import AppearanceTab from "./settings/AppearanceTab";

// ─── TAB DEFINITIONS ─────────────────────────────────────────────
type SettingsTab = "profile" | "suitability" | "knowledge" | "ai-tuning" | "notifications" | "appearance";

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode; desc: string; slug: string }[] = [
  { id: "profile", label: "Profile & Style", icon: <User className="w-4 h-4" />, desc: "Avatar, memories, communication style", slug: "profile" },
  { id: "suitability", label: "Financial Profile", icon: <Shield className="w-4 h-4" />, desc: "Suitability assessment for personalized advice", slug: "suitability" },
  { id: "knowledge", label: "Knowledge Base", icon: <FileText className="w-4 h-4" />, desc: "Documents and files that train your AI", slug: "knowledge" },
  { id: "ai-tuning", label: "AI Tuning", icon: <Sparkles className="w-4 h-4" />, desc: "5-layer AI personalization cascade", slug: "ai-tuning" },
  { id: "notifications", label: "Notifications", icon: <Bell className="w-4 h-4" />, desc: "Manage alerts and email digests", slug: "notifications" },
  { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" />, desc: "Theme, colors, font size, density", slug: "appearance" },
];

export default function SettingsHub() {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const currentTab = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Chat</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 min-w-0">
            <Settings2 className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold truncate">Settings</h1>
          </div>
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
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setMobileNavOpen(false); }}
                className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeTab === tab.id
                    ? "bg-accent/10 text-accent border border-accent/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                }`}
              >
                <span className={`mt-0.5 shrink-0 ${activeTab === tab.id ? "text-accent" : ""}`}>{tab.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{tab.label}</p>
                  <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{tab.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div className="fixed inset-0 top-14 z-10 bg-black/40 md:hidden" onClick={() => setMobileNavOpen(false)} />
        )}

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {activeTab === "profile" && <ProfileTab />}
          {activeTab === "suitability" && <SuitabilityTab />}
          {activeTab === "knowledge" && <KnowledgeBaseTab />}
          {activeTab === "ai-tuning" && <AITuningTab />}
          {activeTab === "notifications" && <NotificationsTab />}
          {activeTab === "appearance" && <AppearanceTab />}
        </main>
      </div>
    </div>
  );
}
