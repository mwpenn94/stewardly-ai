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
import { useLocation, useRouter } from "wouter";

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
  "/wealth-engine": {
    title: "Unified Wealth Engine",
    description: "56 interactive panels across 6 groups — Practice Management, Client Planning, Advanced, Advisory, Data, and References. All panels cascade data up/down/forward/back.",
    tips: [
      { title: "Panel Navigation", description: "Use the sidebar groups to navigate between panels. Each group contains related tools that share data through the cascade engine.", category: "tip" },
      { title: "Save & Load Sessions", description: "Click Save to preserve your current session state. Load previous sessions to compare scenarios. All actions are WORM audit-logged.", category: "tip" },
      { title: "Export Options", description: "Export as PDF, CSV, or JSON. Share sessions with colleagues or import data from external sources.", category: "tip" },
      { title: "Cascade Alerts", description: "The Advisory > Cascade Alerts panel monitors cross-panel data for misalignments, stale profiles, and suitability gaps.", category: "tip" },
      { title: "Deep Link", description: "Append ?panel=myplan (or any panel ID) to the URL to jump directly to a specific panel.", category: "shortcut" },
      { title: "Health Score", description: "The sidebar shows a real-time Health Score computed from your 12-dimension financial scorecard.", category: "tip" },
      { title: "How do panels cascade?", description: "Changes in Client Profile flow to all panels. Tax results feed Cash Flow, which feeds Protection, Growth, Retirement, Estate, and Education.", category: "faq" },
      { title: "What is the Planning Hierarchy?", description: "A tree-structured planning framework where goals, strategies, and tactics roll up into a unified plan with automated scoring.", category: "faq" },
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
  "/lead-pipeline": {
    title: "Lead Pipeline",
    description: "AI-powered lead management with scoring, enrichment, and conversion tracking.",
    tips: [
      { title: "Score History", description: "Click any lead to see their propensity score history over time, showing how engagement and fit have evolved.", category: "tip" },
      { title: "Lead Enrichment", description: "The system automatically enriches leads with firmographic data, social profiles, and behavioral signals.", category: "tip" },
      { title: "Conversion Tracking", description: "Track leads through stages: New → Contacted → Qualified → Proposal → Won/Lost. Each transition is logged.", category: "tip" },
      { title: "Source Analytics", description: "View lead source performance with connector health badges showing sync status and data quality.", category: "tip" },
    ],
  },
  "/compliance-audit": {
    title: "Compliance Audit",
    description: "Live compliance review queue with FINRA 2210, SEC, Reg BI, and jurisdictional awareness.",
    tips: [
      { title: "Content Review", description: "Submit any AI-generated content for automated compliance review. The system checks FINRA 2210, SEC rules, and Reg BI requirements.", category: "tip" },
      { title: "Reg BI Documentation", description: "Generate Regulation Best Interest documentation packages with one click for any client recommendation.", category: "tip" },
      { title: "Jurisdictional Coverage", description: "Scroll down to see the full regulatory compliance coverage across Federal (10 regulations), State (4 frameworks), and International (3 awareness).", category: "tip" },
      { title: "WORM Audit Trail", description: "All calculator interactions are logged to a tamper-evident WORM audit trail compliant with SEC 17a-4.", category: "faq" },
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
    title: "Message Campaigns",
    description: "Create, manage, and send personalized in-app message campaigns to clients.",
    tips: [
      { title: "AI Content Generation", description: "Click 'AI Generate' when creating a campaign. Describe your purpose and the AI writes professional message content.", category: "tip" },
      { title: "Personalization", description: "Use {{recipientName}} in your message body for automatic personalization.", category: "tip" },
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
  "/agent": {
    title: "Financial Agent",
    description: "AI-powered financial calculator agent — 7 tools wired into the chat for instant projections.",
    tips: [
      { title: "Calculator Tools", description: "The agent has 7 calculator tools: Retirement, Tax, Protection, Monte Carlo, Estate, Entity Comparison, and Income Projection.", category: "tip" },
      { title: "Quick Prompts", description: "Click any tool card or quick prompt to start a conversation with pre-filled context.", category: "tip" },
      { title: "Natural Language", description: "Ask questions in plain English — the agent automatically selects and runs the right calculator tool.", category: "tip" },
      { title: "How accurate are the projections?", description: "Projections use industry-standard formulas and current tax brackets. Always verify with a licensed professional.", category: "faq" },
    ],
  },
  "/comparables": {
    title: "Competitive Analysis",
    description: "Gap analysis across 8 domains comparing WealthBridge to industry competitors.",
    tips: [
      { title: "Parity Dashboard", description: "Scroll to the bottom to see the Parity Capability Dashboard showing live/beta/planned coverage across all domains.", category: "tip" },
      { title: "Deep Dive", description: "Click any comparable to see detailed scoring across all axes with source notes.", category: "tip" },
      { title: "Priority Recommendations", description: "The top section highlights areas where WealthBridge trails competitors — these are prioritized for development.", category: "tip" },
    ],
  },
  "/manus-next": {
    title: "Manus-Next Dashboard",
    description: "Platform capability validation surface — verify all capabilities and track extraction progress.",
    tips: [
      { title: "Validate Capabilities", description: "Click 'Validate' on any testable capability to verify its endpoint is responsive.", category: "tip" },
      { title: "Domain Filters", description: "Filter capabilities by domain (Calculators, Data, Platform, Manus-Next) to focus on specific areas.", category: "tip" },
      { title: "Extraction Progress", description: "The Extraction tab shows the monolith-to-monorepo journey with phase-by-phase progress.", category: "tip" },
    ],
  },
  "/learning": {
    title: "Learning Hub",
    description: "Structured learning tracks, exam prep, CE credits, and professional development — also accessible via chat.",
    tips: [
      { title: "Exam Prep", description: "Practice for Series 6, 7, 63, 65, 66, SIE, CFP, CLU, ChFC and more with AI-generated questions.", category: "tip" },
      { title: "Study Buddy", description: "Use the Study Buddy for interactive flashcards and spaced repetition.", category: "tip" },
      { title: "CE Credits", description: "Track your continuing education requirements by state and designation.", category: "tip" },
      { title: "Chat Integration", description: "Ask the AI to quiz you or explain concepts — just say 'quiz me on Series 65' in chat.", category: "faq" },
    ],
  },
  "/people": {
    title: "People Hub",
    description: "Manage your client relationships, leads, and professional network — also accessible via chat.",
    tips: [
      { title: "Client Profiles", description: "View and manage detailed client profiles with financial summaries and interaction history.", category: "tip" },
      { title: "Pipeline Management", description: "Track leads through your sales pipeline with stage-based organization.", category: "tip" },
      { title: "Chat Integration", description: "Ask the AI to draft follow-up emails or prioritize your pipeline — just describe what you need in chat.", category: "faq" },
    ],
  },
  "/operations": {
    title: "Operations Hub",
    description: "Active work items, AI agent management, compliance reviews, and execution history.",
    tips: [
      { title: "Active Tasks", description: "View and manage your pending tasks, compliance reviews, and scheduled actions.", category: "tip" },
      { title: "Agent Status", description: "Monitor AI agents running background tasks like market monitoring and data updates.", category: "tip" },
      { title: "Execution History", description: "Review past actions and their outcomes for audit trail purposes.", category: "tip" },
    ],
  },
  "/financial-twin": {
    title: "Digital Financial Twin",
    description: "Your comprehensive financial model — a living digital representation of your complete financial picture.",
    tips: [
      { title: "Data Sources", description: "Connect accounts via Plaid and SnapTrade for real-time data, or enter information manually.", category: "tip" },
      { title: "What-If Scenarios", description: "Run projections by adjusting assumptions like income growth, market returns, or major life events.", category: "tip" },
      { title: "Chat Integration", description: "Ask the AI 'what if I retire at 55?' and it will use your twin data for accurate projections.", category: "faq" },
    ],
  },
  "/my-plan": {
    title: "My Financial Plan",
    description: "Your personalized financial plan with goals, milestones, and progress tracking.",
    tips: [
      { title: "Goal Setting", description: "Set specific financial goals with target amounts and dates.", category: "tip" },
      { title: "Progress Tracking", description: "Track your progress toward each goal with visual indicators and milestone markers.", category: "tip" },
      { title: "Plan Updates", description: "Your plan updates automatically as your financial twin data changes.", category: "tip" },
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

  // Hide on chat pages — the chat page has its own help in the sidebar
  const hiddenPaths = ["/chat"];
  const isHidden = hiddenPaths.some(p => location.startsWith(p));

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
      {/* Floating help button — hidden on chat pages to avoid overlapping input bar */}
      {!isHidden && (
        <Button
          variant="outline"
          size="icon" aria-label="Toggle help"
          className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full shadow-lg bg-primary text-primary-foreground hover:bg-primary/90 border-0"
          onClick={() => setIsOpen(true)}
          title="Help & Tips (Ctrl+/)"
          aria-label="Help & Tips"
        >
          <HelpCircle className="w-5 h-5" />
        </Button>
      )}

      {/* Help panel */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/20" role="presentation" onClick={() => setIsOpen(false)} />
          <Card className="fixed bottom-20 right-6 z-50 w-96 max-h-[60vh] shadow-2xl border-primary/20 overflow-hidden flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <CardTitle className="text-sm">Help & Tips</CardTitle>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Close help" onClick={() => setIsOpen(false)}>
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
            <CardContent className="p-0 flex-1 overflow-hidden">
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
