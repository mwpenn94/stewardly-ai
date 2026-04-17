/**
 * SettingsHub — Settings page with the exact Wealth Engine sidebar pattern.
 */
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Brain, Shield, FileText, Sparkles, User,
  Loader2, Settings2, Bell, Palette, Mic, Link2, Keyboard,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLocation, useRoute } from "wouter";

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

type SettingsTab = "profile" | "suitability" | "knowledge" | "ai-tuning" | "voice" | "notifications" | "appearance" | "guest-prefs" | "privacy" | "data-sharing" | "connected-accounts" | "shortcuts";

interface NavItem { id: SettingsTab; label: string; icon: React.ElementType; slug: string; }
interface NavSection { group: string; items: NavItem[]; }

const NAV_SECTIONS: NavSection[] = [
  { group: "Account", items: [
    { id: "profile", label: "Profile & Style", icon: User, slug: "profile" },
    { id: "connected-accounts", label: "Connected Accounts", icon: Link2, slug: "connected-accounts" },
    { id: "suitability", label: "Financial Profile", icon: Shield, slug: "suitability" },
  ]},
  { group: "AI & Knowledge", items: [
    { id: "knowledge", label: "Knowledge Base", icon: FileText, slug: "knowledge" },
    { id: "ai-tuning", label: "AI Tuning", icon: Sparkles, slug: "ai-tuning" },
    { id: "voice", label: "Voice & Speech", icon: Mic, slug: "voice" },
  ]},
  { group: "Preferences", items: [
    { id: "notifications", label: "Notifications", icon: Bell, slug: "notifications" },
    { id: "appearance", label: "Appearance", icon: Palette, slug: "appearance" },
    { id: "guest-prefs", label: "Guest Preferences", icon: Sparkles, slug: "guest-prefs" },
    { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard, slug: "shortcuts" },
  ]},
  { group: "Privacy", items: [
    { id: "privacy", label: "Privacy & Data", icon: Shield, slug: "privacy" },
    { id: "data-sharing", label: "Data Sharing", icon: Shield, slug: "data-sharing" },
  ]},
];

const ALL_ITEMS = NAV_SECTIONS.flatMap(s => s.items);
const ANONYMOUS_TABS: SettingsTab[] = ["appearance", "guest-prefs", "voice", "shortcuts"];

export default function SettingsHub() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [matchTab, paramsTab] = useRoute("/settings/:tab");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initialTab = (matchTab && paramsTab?.tab && ALL_ITEMS.find(t => t.slug === paramsTab.tab))
    ? (ALL_ITEMS.find(t => t.slug === paramsTab.tab)!.id)
    : "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    const slug = ALL_ITEMS.find(t => t.id === activeTab)?.slug || "profile";
    navigate(`/settings/${slug}`, { replace: true });
  }, [activeTab, navigate]);

  useEffect(() => {
    if (matchTab && paramsTab?.tab) {
      const tab = ALL_ITEMS.find(t => t.slug === paramsTab.tab);
      if (tab && tab.id !== activeTab) setActiveTab(tab.id);
    }
  }, [matchTab, paramsTab?.tab]);

  const isAuthenticated = !!user;

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

  const needsAuth = !isAuthenticated && !ANONYMOUS_TABS.includes(activeTab);

  return (
    <AppShell title="Settings">
      <SEOHead title="Settings" description="Account settings and preferences" />
      <div className="flex min-h-full bg-background relative">
        {/* ─── MOBILE SIDEBAR OVERLAY ─── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} role="presentation" aria-hidden="true" />
        )}

        {/* ─── SIDEBAR ─── */}
        <aside role="complementary" aria-label="Settings navigation sidebar" className={`
          fixed inset-y-0 left-0 lg:sticky lg:top-0 z-50 lg:z-auto
          w-56 shrink-0 border-r border-border bg-card flex flex-col
          max-h-[100dvh] lg:max-h-screen lg:self-start
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}>
          <div className="p-3 border-b border-border/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Settings</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Preferences & Account</p>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden h-7 w-7" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
              <PanelLeftClose className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
            <nav className="p-2 space-y-3" role="navigation" aria-label="Settings sections">
              {NAV_SECTIONS.map(section => (
                <div key={section.group} role="group" aria-label={section.group}>
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider px-2 mb-1">{section.group}</p>
                  <div role="list">
                    {section.items.map(item => {
                      const Icon = item.icon;
                      const tabRequiresAuth = !isAuthenticated && !ANONYMOUS_TABS.includes(item.id);
                      return (
                        <button type="button" key={item.id} role="listitem"
                          onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                          aria-current={activeTab === item.id ? 'page' : undefined}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                            activeTab === item.id
                              ? 'bg-primary/10 text-primary border border-primary/30'
                              : tabRequiresAuth
                                ? 'text-muted-foreground/40 hover:text-muted-foreground/60 border border-transparent'
                                : 'text-muted-foreground hover:bg-background hover:text-foreground border border-transparent'
                          }`}>
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          {item.label}
                          {tabRequiresAuth && <span className="text-[9px] bg-muted/50 text-muted-foreground px-1 py-0.5 rounded ml-auto">Sign in</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </ScrollArea>
          <div className="p-3 border-t border-border/50 bg-background">
            <div className="text-center text-[9px] text-muted-foreground/30">Settings · {ALL_ITEMS.length} sections</div>
          </div>
        </aside>

        {/* ─── MAIN CONTENT ─── */}
        <main className="flex-1 min-w-0" role="main" aria-label="Settings content">
          <div className="max-w-5xl mx-auto p-3 sm:p-4 lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 bg-card rounded-lg border border-border px-3 py-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8 shrink-0" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar">
                  <PanelLeftOpen className="w-4 h-4" />
                </Button>
                <span className="text-sm font-medium text-foreground">{ALL_ITEMS.find(t => t.id === activeTab)?.label}</span>
              </div>
            </div>
            {needsAuth ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                  <User className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-lg font-semibold mb-2">Sign in to access {ALL_ITEMS.find(t => t.id === activeTab)?.label}</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  This setting requires an account. Sign in to personalize your experience, or explore the Appearance tab as a guest.
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => { window.location.href = getLoginUrl(); }} className="gap-2">
                    <User className="w-4 h-4" /> Sign In
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("appearance")}>
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
          </div>
        </main>
      </div>
    </AppShell>
  );
}
