import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Search, MessageSquare, Shield, Sparkles, BookOpen,
  HelpCircle, ChevronDown, ChevronUp, Send, Loader2, Keyboard,
  Brain, FileText, Users, Settings, Monitor, Mic, Globe,
  Calculator, BarChart3, Mail, ExternalLink, CheckCircle,
} from "lucide-react";
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// ─── FAQ DATA ────────────────────────────────────────────────────
interface FAQItem {
  question: string;
  answer: string;
  category: string;
  tags: string[];
}

const FAQ_DATA: FAQItem[] = [
  // Getting Started
  {
    question: "What is Stewardry?",
    answer: "Stewardry is an AI-powered digital financial twin platform that provides personalized financial guidance, education, and advisory services. It combines advanced AI with your financial profile to deliver tailored insights across investing, budgeting, retirement planning, tax strategy, and more.",
    category: "Getting Started",
    tags: ["overview", "about", "what is"],
  },
  {
    question: "How do I get started?",
    answer: "Start by chatting with the AI on the main page. You can use it as a guest for general financial education, or sign in to unlock personalized features like suitability assessment, AI memory, document analysis, and multi-focus advisory modes.",
    category: "Getting Started",
    tags: ["start", "begin", "new user"],
  },
  {
    question: "Is my data secure?",
    answer: "Yes. All data is encrypted in transit and at rest. Your financial information is only used to personalize your AI experience and is never shared with third parties. You can delete your data at any time from Settings.",
    category: "Getting Started",
    tags: ["security", "privacy", "data"],
  },
  {
    question: "Can I use Stewardry without an account?",
    answer: "Yes! Guest users can chat with the AI for general financial education. However, signing in unlocks personalized advice, conversation history, document uploads, suitability assessment, and AI memory features.",
    category: "Getting Started",
    tags: ["guest", "anonymous", "account"],
  },

  // AI Features
  {
    question: "What are Focus Modes?",
    answer: "Focus Modes let you steer the AI's expertise. Choose from General, Financial, Study, and more. You can select multiple focus modes simultaneously — for example, combining Financial + Study mode gives you educational content with financial depth.",
    category: "AI Features",
    tags: ["focus", "mode", "expertise"],
  },
  {
    question: "What is the AI Tuning feature?",
    answer: "AI Tuning is a 5-layer personalization cascade in Settings that lets you fine-tune how the AI responds. You can adjust response depth, communication style, areas of expertise emphasis, and more. Changes take effect immediately in your conversations.",
    category: "AI Features",
    tags: ["tuning", "personalization", "customize"],
  },
  {
    question: "How does AI Memory work?",
    answer: "The AI remembers key facts from your conversations (with your permission). These memories help it provide more relevant advice over time. You can view, edit, and delete memories from your Profile settings.",
    category: "AI Features",
    tags: ["memory", "remember", "context"],
  },
  {
    question: "What is the Knowledge Base?",
    answer: "The Knowledge Base lets you upload documents (PDFs, financial statements, etc.) that the AI uses as context when answering your questions. This enables highly personalized advice based on your actual financial documents.",
    category: "AI Features",
    tags: ["knowledge", "documents", "upload", "RAG"],
  },
  {
    question: "Can I go live with video or screen share?",
    answer: "Yes! Use the plus (+) menu in the chat input area to start a live session. Choose 'Go live — Video' for camera-based interaction or 'Go live — Screen' to share your screen with the AI for real-time analysis.",
    category: "AI Features",
    tags: ["live", "video", "screen share", "camera"],
  },

  // Financial Tools
  {
    question: "What calculators are available?",
    answer: "Stewardry includes financial calculators for compound interest, loan amortization, retirement projections, and more. Access them from the Calculators page in the sidebar navigation.",
    category: "Financial Tools",
    tags: ["calculator", "compound", "loan", "retirement"],
  },
  {
    question: "What is the Suitability Assessment?",
    answer: "The Suitability Assessment in Settings evaluates your risk tolerance, investment horizon, financial goals, and experience level. This information helps the AI provide advice that's appropriate for your specific situation — similar to what a human financial advisor would assess.",
    category: "Financial Tools",
    tags: ["suitability", "risk", "assessment", "profile"],
  },
  {
    question: "Can the AI analyze charts and images?",
    answer: "Yes! You can attach images (charts, screenshots, financial documents) to your messages. The AI can analyze stock charts, portfolio screenshots, financial statements, and other visual content to provide insights.",
    category: "Financial Tools",
    tags: ["image", "chart", "visual", "analyze"],
  },

  // Account & Settings
  {
    question: "How do I change my AI's communication style?",
    answer: "Go to Settings > Profile & Style to adjust your communication style profile. You can also use AI Tuning for more granular control over response depth, tone, and format. Guest users can adjust basic preferences in Settings > Guest Preferences.",
    category: "Account & Settings",
    tags: ["style", "communication", "tone"],
  },
  {
    question: "How do I manage notifications?",
    answer: "Go to Settings > Notifications to configure email digests, alert preferences, and notification frequency. You can choose which types of updates you want to receive.",
    category: "Account & Settings",
    tags: ["notifications", "email", "alerts"],
  },
  {
    question: "How do I delete my account or data?",
    answer: "Contact support using the form below. We'll process your request within 48 hours. You can also delete individual conversations and memories from the chat sidebar and Settings respectively.",
    category: "Account & Settings",
    tags: ["delete", "account", "data", "privacy"],
  },

  // Keyboard Shortcuts
  {
    question: "What keyboard shortcuts are available?",
    answer: "Press the ? key (when not typing in an input field) to see all available keyboard shortcuts. Key shortcuts include Ctrl+Shift+N for new conversation, Ctrl+K for search, and / to focus the chat input.",
    category: "Keyboard Shortcuts",
    tags: ["keyboard", "shortcuts", "hotkey"],
  },
];

const CATEGORIES = Array.from(new Set(FAQ_DATA.map(f => f.category)));

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Getting Started": <BookOpen className="w-4 h-4" />,
  "AI Features": <Brain className="w-4 h-4" />,
  "Financial Tools": <Calculator className="w-4 h-4" />,
  "Account & Settings": <Settings className="w-4 h-4" />,
  "Keyboard Shortcuts": <Keyboard className="w-4 h-4" />,
};

export default function Help() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Contact form
  const [contactName, setContactName] = useState(user?.name || "");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const notifyMutation = trpc.system.notifyOwner.useMutation();

  const filteredFAQ = useMemo(() => {
    let items = FAQ_DATA;
    if (activeCategory) {
      items = items.filter(f => f.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(f =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.tags.some(t => t.includes(q))
      );
    }
    return items;
  }, [searchQuery, activeCategory]);

  const toggleExpand = (index: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactSubject.trim() || !contactMessage.trim()) {
      toast.error("Please fill in subject and message");
      return;
    }
    setSending(true);
    try {
      await notifyMutation.mutateAsync({
        title: `[Support] ${contactSubject}`,
        content: `From: ${contactName || "Anonymous"}\n\nSubject: ${contactSubject}\n\n${contactMessage}`,
      });
      setSent(true);
      toast.success("Message sent! We'll get back to you soon.");
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Chat</span>
          </Button>
          <Separator orientation="vertical" className="h-5" />
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-4 h-4 text-accent shrink-0" />
            <h1 className="text-sm font-semibold truncate">Help & Support</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <HelpCircle className="w-7 h-7 text-accent" />
          </div>
          <h2 className="text-2xl font-bold">How can we help?</h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            Search our FAQ, browse by category, or contact support directly.
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-lg mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search for help..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-11 text-sm bg-card border-border/50"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setActiveCategory(null)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
              !activeCategory
                ? "border-accent bg-accent/10 text-accent"
                : "border-border hover:border-accent/30 text-muted-foreground hover:text-foreground"
            }`}
          >
            All Topics
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                activeCategory === cat
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border hover:border-accent/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {CATEGORY_ICONS[cat]}
              {cat}
            </button>
          ))}
        </div>

        {/* FAQ List */}
        <div className="space-y-2">
          {filteredFAQ.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No results found for "{searchQuery}"</p>
              <p className="text-xs mt-1">Try different keywords or browse by category</p>
            </div>
          ) : (
            filteredFAQ.map((faq, i) => {
              const globalIndex = FAQ_DATA.indexOf(faq);
              const isExpanded = expandedItems.has(globalIndex);
              return (
                <Card key={globalIndex} className="overflow-hidden">
                  <button
                    onClick={() => toggleExpand(globalIndex)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/20 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0 text-accent">
                      {CATEGORY_ICONS[faq.category] || <HelpCircle className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{faq.question}</p>
                      <Badge variant="outline" className="mt-1 text-[9px]">{faq.category}</Badge>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pl-11">
                      <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>

        <Separator />

        {/* Contact Support */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent" />
              <CardTitle>Contact Support</CardTitle>
            </div>
            <CardDescription>
              Can't find what you're looking for? Send us a message and we'll get back to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-7 h-7 text-green-500" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Message Sent</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  We'll review your message and get back to you as soon as possible.
                </p>
                <Button variant="outline" size="sm" onClick={() => { setSent(false); setContactSubject(""); setContactMessage(""); }}>
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Name</Label>
                    <Input
                      placeholder="Your name"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Subject *</Label>
                    <Input
                      placeholder="What's this about?"
                      value={contactSubject}
                      onChange={(e) => setContactSubject(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Message *</Label>
                  <Textarea
                    placeholder="Describe your issue or question in detail..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={5}
                    required
                  />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={sending} className="gap-2">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Send Message
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="hover:border-accent/30 transition-colors cursor-pointer" onClick={() => navigate("/chat")}>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium">Chat with AI</p>
                <p className="text-xs text-muted-foreground">Ask the AI directly</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-accent/30 transition-colors cursor-pointer" onClick={() => navigate("/settings/guest-prefs")}>
            <CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium">Preferences</p>
                <p className="text-xs text-muted-foreground">Customize AI responses</p>
              </div>
            </CardContent>
          </Card>
          <Card className="hover:border-accent/30 transition-colors cursor-pointer" onClick={() => navigate("/settings/ai-tuning")}>
            <CardContent className="p-4 flex items-center gap-3">
              <Brain className="w-5 h-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-medium">AI Tuning</p>
                <p className="text-xs text-muted-foreground">Fine-tune your AI</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
