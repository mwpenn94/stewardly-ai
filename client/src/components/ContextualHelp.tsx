/**
 * Contextual Help System
 * Provides page-specific tips, keyboard shortcuts, FAQ, and quick actions.
 * Appears as a floating help panel that adapts to the current page context.
 */
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  HelpCircle, X, Lightbulb, Keyboard, MessageSquare,
  ChevronRight, ExternalLink, BookOpen, Sparkles, Search,
} from "lucide-react";
import { useLocation } from "wouter";

interface HelpTip {
  title: string;
  description: string;
  category: "tip" | "shortcut" | "faq";
}

interface PageHelp {
  title: string;
  description: string;
  tips: HelpTip[];
}

const PAGE_HELP: Record<string, PageHelp> = {
  "/chat": {
    title: "AI Chat",
    description: "Your digital financial twin — ask anything about finances, planning, or advisory.",
    tips: [
      { title: "Focus Modes", description: "Switch between General, Financial, or Both modes using the focus selector above the chat input. Financial mode gives deeper advisory responses.", category: "tip" },
      { title: "Voice Mode", description: "Click the microphone icon for hands-free conversation. The AI listens, responds with speech, and auto-continues.", category: "tip" },
      { title: "Share Context", description: "Use the paperclip icon to attach documents, screenshots, or images. The AI analyzes them in context.", category: "tip" },
      { title: "Conversation History", description: "Your conversations are saved in the sidebar. Click any past conversation to continue it.", category: "tip" },
      { title: "Quick Commands", description: "Type / to see available commands like /calculate, /research, or /plan.", category: "shortcut" },
      { title: "New Conversation", description: "Click the + button in the sidebar or press Ctrl+N to start a fresh conversation.", category: "shortcut" },
      { title: "Can the AI access my accounts?", description: "The AI works with data you provide. Upload statements or enter details manually for personalized advice.", category: "faq" },
      { title: "Is my data private?", description: "All conversations are encrypted and stored securely. Only you can access your data.", category: "faq" },
    ],
  },
  "/calculators": {
    title: "Financial Calculators",
    description: "Professional-grade calculators for retirement, tax, insurance, and more.",
    tips: [
      { title: "Save Scenarios", description: "Each calculator lets you save and compare multiple scenarios. Use the 'Save' button after running a calculation.", category: "tip" },
      { title: "AI Analysis", description: "After running a calculation, click 'Analyze with AI' to get personalized insights and recommendations.", category: "tip" },
      { title: "Export Results", description: "Export calculation results as PDF or share them with your advisor through the chat.", category: "tip" },
      { title: "Which calculator should I use?", description: "Start with the Retirement Planner for long-term goals, or the Tax Projector for immediate tax planning needs.", category: "faq" },
    ],
  },
  "/products": {
    title: "Product Marketplace",
    description: "Browse and compare financial products with AI-powered suitability matching.",
    tips: [
      { title: "Suitability Scoring", description: "Each product shows a suitability score based on your profile. Higher scores mean better fit for your situation.", category: "tip" },
      { title: "Compare Products", description: "Select multiple products and click 'Compare' to see a side-by-side analysis.", category: "tip" },
      { title: "AI Recommendations", description: "The AI suggests products based on your financial profile and goals. Check the 'Recommended' tab.", category: "tip" },
    ],
  },
  "/data-intelligence": {
    title: "Data Intelligence Hub",
    description: "Manage data sources, scraping schedules, and AI-powered insights.",
    tips: [
      { title: "Add Data Sources", description: "Connect APIs, RSS feeds, or paste URLs to start ingesting data. The system automatically categorizes and scores quality.", category: "tip" },
      { title: "Scheduled Scraping", description: "Set up automatic data refresh on schedules from every 15 minutes to monthly. Use the Schedules tab.", category: "tip" },
      { title: "Insight Actions", description: "AI-generated insights can automatically create tasks and send notifications. Check the Actions tab.", category: "tip" },
      { title: "CSV Upload", description: "Bulk import data via CSV. Paste your data, map columns, and the system processes it automatically.", category: "tip" },
      { title: "Analytics Dashboard", description: "The Analytics tab shows ingestion volume, quality trends, and insight distribution over time.", category: "tip" },
    ],
  },
  "/email-campaigns": {
    title: "Email Campaigns",
    description: "Create, manage, and send personalized email campaigns to clients.",
    tips: [
      { title: "AI Content Generation", description: "Click 'AI Generate' when creating a campaign. Describe your purpose and the AI writes professional email content.", category: "tip" },
      { title: "Personalization", description: "Use {{recipientName}} and {{recipientEmail}} in your email body for automatic personalization.", category: "tip" },
      { title: "Bulk Recipients", description: "Add recipients by pasting a list: one per line, format: email, name (name optional).", category: "tip" },
    ],
  },
  "/insights": {
    title: "AI Insights",
    description: "AI-generated financial insights and market analysis.",
    tips: [
      { title: "Insight Categories", description: "Insights are categorized by type: market, regulatory, product, and client-specific. Filter by category to focus.", category: "tip" },
      { title: "Action Items", description: "High-severity insights automatically generate action items. Check your task list for pending actions.", category: "tip" },
    ],
  },
  "/settings": {
    title: "Settings",
    description: "Customize your profile, AI behavior, knowledge base, and appearance.",
    tips: [
      { title: "AI Tuning", description: "Adjust the AI's personality, response style, and focus areas in the AI Tuning tab.", category: "tip" },
      { title: "Knowledge Base", description: "Upload documents to train the AI on your specific situation. The more context, the better the advice.", category: "tip" },
      { title: "Appearance", description: "Switch between light and dark themes, and customize the interface to your preference.", category: "tip" },
    ],
  },
};

const GLOBAL_SHORTCUTS: HelpTip[] = [
  { title: "Ctrl + N", description: "Start a new conversation", category: "shortcut" },
  { title: "Ctrl + K", description: "Quick search across the platform", category: "shortcut" },
  { title: "Ctrl + /", description: "Toggle this help panel", category: "shortcut" },
  { title: "Escape", description: "Close current dialog or panel", category: "shortcut" },
];

const GLOBAL_FAQ: HelpTip[] = [
  { title: "How do I get started?", description: "Start by chatting with the AI on the main chat page. Ask about your financial goals, and the AI will guide you to the right tools and features.", category: "faq" },
  { title: "Can I use this without signing in?", description: "Yes! Guest users can explore all features. Your data is saved for the session. Sign in to save permanently and access across devices.", category: "faq" },
  { title: "How does the AI learn about me?", description: "The AI learns from your conversations, uploaded documents, and settings. You control what information it has access to.", category: "faq" },
  { title: "Is this financial advice?", description: "The AI provides information and analysis, not regulated financial advice. Always consult a licensed professional for important decisions.", category: "faq" },
  { title: "How do I contact support?", description: "Use the chat to ask for help, or reach out through the feedback button in the sidebar.", category: "faq" },
];

export function ContextualHelp() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  // Determine current page context
  const currentPage = useMemo(() => {
    const basePath = "/" + (location.split("/")[1] || "chat");
    return PAGE_HELP[basePath] || PAGE_HELP["/chat"];
  }, [location]);

  // Keyboard shortcut to toggle help
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  const pageTips = currentPage?.tips.filter(t => t.category === "tip") || [];
  const pageFaq = currentPage?.tips.filter(t => t.category === "faq") || [];
  const pageShortcuts = currentPage?.tips.filter(t => t.category === "shortcut") || [];

  return (
    <>
      {/* Floating help button */}
      <Button
        variant="outline"
        size="icon"
        className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
        onClick={() => setIsOpen(true)}
        title="Help & Tips (Ctrl+/)"
      >
        <HelpCircle className="w-5 h-5" />
      </Button>

      {/* Help panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" onClick={() => setIsOpen(false)} />
          <Card className="fixed bottom-20 right-6 z-50 w-96 max-h-[70vh] shadow-2xl border-primary/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Help & Tips</CardTitle>
                </div>
                <Button variant="ghost" size="icon-sm" onClick={() => setIsOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              {currentPage && (
                <div className="mt-1">
                  <Badge variant="secondary" className="text-xs">{currentPage.title}</Badge>
                  <p className="text-xs text-muted-foreground mt-1">{currentPage.description}</p>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="tips">
                <TabsList className="w-full rounded-none border-b bg-transparent h-8">
                  <TabsTrigger value="tips" className="text-xs h-7 gap-1">
                    <Lightbulb className="w-3 h-3" /> Tips
                  </TabsTrigger>
                  <TabsTrigger value="shortcuts" className="text-xs h-7 gap-1">
                    <Keyboard className="w-3 h-3" /> Shortcuts
                  </TabsTrigger>
                  <TabsTrigger value="faq" className="text-xs h-7 gap-1">
                    <MessageSquare className="w-3 h-3" /> FAQ
                  </TabsTrigger>
                </TabsList>

                <ScrollArea className="max-h-[45vh]">
                  <TabsContent value="tips" className="p-3 space-y-2 mt-0">
                    {pageTips.length > 0 ? pageTips.map((tip, i) => (
                      <div key={i} className="flex gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <Lightbulb className="w-3.5 h-3.5 text-yellow-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium">{tip.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{tip.description}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-xs text-muted-foreground text-center py-4">No specific tips for this page yet.</p>
                    )}
                  </TabsContent>

                  <TabsContent value="shortcuts" className="p-3 space-y-2 mt-0">
                    {pageShortcuts.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This Page</p>
                        {pageShortcuts.map((s, i) => (
                          <div key={`page-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="text-xs">{s.description}</span>
                            <kbd className="text-[10px] bg-background border rounded px-1.5 py-0.5 font-mono">{s.title}</kbd>
                          </div>
                        ))}
                        <div className="border-t my-2" />
                      </>
                    )}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Global</p>
                    {GLOBAL_SHORTCUTS.map((s, i) => (
                      <div key={`global-${i}`} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <span className="text-xs">{s.description}</span>
                        <kbd className="text-[10px] bg-background border rounded px-1.5 py-0.5 font-mono">{s.title}</kbd>
                      </div>
                    ))}
                  </TabsContent>

                  <TabsContent value="faq" className="p-3 space-y-2 mt-0">
                    {pageFaq.length > 0 && (
                      <>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">This Page</p>
                        {pageFaq.map((f, i) => (
                          <details key={`page-${i}`} className="group">
                            <summary className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer text-xs font-medium">
                              <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                              {f.title}
                            </summary>
                            <p className="text-xs text-muted-foreground px-7 py-1.5">{f.description}</p>
                          </details>
                        ))}
                        <div className="border-t my-2" />
                      </>
                    )}
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">General</p>
                    {GLOBAL_FAQ.map((f, i) => (
                      <details key={`global-${i}`} className="group">
                        <summary className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer text-xs font-medium">
                          <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                          {f.title}
                        </summary>
                        <p className="text-xs text-muted-foreground px-7 py-1.5">{f.description}</p>
                      </details>
                    ))}
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}
