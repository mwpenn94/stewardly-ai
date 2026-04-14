import { Button } from "@/components/ui/button";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Search, MessageSquare, Shield, Sparkles, BookOpen,
  HelpCircle, ChevronDown, ChevronUp, Send, Loader2, Keyboard,
  Brain, FileText, Users, Settings, Monitor, Mic, Globe,
  Calculator, BarChart3, Mail, ExternalLink, CheckCircle,
  Zap, Database, Link2, TrendingUp, Package, Activity,
  RefreshCw, Building2, Briefcase, HeartPulse, Eye,
  Lock, Layers, Server, Cpu, Bell, Palette, Camera,
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
    question: "What is Stewardly?",
    answer: "Stewardly is an AI-powered digital financial twin platform that provides personalized financial guidance, education, and advisory services. It combines advanced AI with your financial profile to deliver tailored insights across investing, budgeting, retirement planning, tax strategy, and more.",
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
    question: "Can I use Stewardly without an account?",
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
    answer: "The Knowledge Base lets you upload documents (PDFs, financial statements, etc.) that the AI uses as context when answering your questions. This enables highly personalized advice based on your actual financial documents. Files are auto-categorized by AI.",
    category: "AI Features",
    tags: ["knowledge", "documents", "upload", "RAG"],
  },
  {
    question: "Can I go live with video or screen share?",
    answer: "Yes! Use the plus (+) menu in the chat input area to start a live session. Choose 'Go live — Video' for camera-based interaction or 'Go live — Screen' to share your screen with the AI for real-time analysis.",
    category: "AI Features",
    tags: ["live", "video", "screen share", "camera"],
  },
  {
    question: "How does Voice Mode work?",
    answer: "Toggle voice mode for a hands-free experience. The AI listens via your microphone, responds with natural Edge TTS speech, and can automatically continue the conversation. Configure voice settings in Settings > Voice & Speech.",
    category: "AI Features",
    tags: ["voice", "speech", "tts", "microphone"],
  },

  // Financial Tools
  {
    question: "What calculators are available?",
    answer: "Stewardly includes financial calculators for compound interest, loan amortization, retirement projections, IUL illustrations, premium finance ROI, and more. Access them from the Calculators page in the sidebar navigation.",
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
    question: "What is the Advisory Hub?",
    answer: "The Advisory Hub consolidates insurance quoting (COMPULIFE), estate planning benchmarks, premium finance analysis with live SOFR rates, and the product marketplace. It's your one-stop shop for client-facing advisory workflows.",
    category: "Financial Tools",
    tags: ["advisory", "insurance", "estate", "premium finance"],
  },
  {
    question: "How does Product Intelligence work?",
    answer: "Product Intelligence provides IUL crediting rate history, market index tracking, risk profiling (Nitrogen/Riskalyze adapter), and eSignature tracking (DocuSign adapter). It helps you make data-driven product recommendations.",
    category: "Financial Tools",
    tags: ["product", "IUL", "risk", "esignature"],
  },

  // Integrations
  {
    question: "What integrations are available?",
    answer: "Stewardly integrates with Plaid (bank accounts), Canopy Connect (insurance policies), SnapTrade (brokerage accounts), COMPULIFE (insurance quotes), SOFR (premium finance rates), credit bureaus, CRM systems (Wealthbox, Redtail), and government data APIs (BLS, FRED, Census, SEC EDGAR, FINRA, BEA).",
    category: "Integrations",
    tags: ["plaid", "canopy", "snaptrade", "compulife", "integration"],
  },
  {
    question: "How do Passive Actions work?",
    answer: "Passive Actions let you enable automated background operations for any data source. Once enabled, the system automatically refreshes data, syncs accounts, monitors for changes, and sends alerts — all running silently in the background.",
    category: "Integrations",
    tags: ["passive", "automation", "background", "sync"],
  },
  {
    question: "How do I connect my bank accounts?",
    answer: "Go to Integrations and use the Plaid Link button to securely connect your bank accounts. Plaid uses bank-level encryption and never stores your login credentials. Transaction data is automatically categorized and analyzed.",
    category: "Integrations",
    tags: ["plaid", "bank", "accounts", "connect"],
  },
  {
    question: "What is Integration Health?",
    answer: "Integration Health monitors the status of all connected services and data pipelines. It shows uptime, error rates, last sync times, and alerts you to any issues. Available to advisors and admins.",
    category: "Integrations",
    tags: ["health", "monitoring", "status", "uptime"],
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
    answer: "Go to Settings > Notifications to configure in-app alert preferences and notification frequency. All notifications are delivered within the platform — no external emails are sent.",
    category: "Account & Settings",
    tags: ["notifications", "alerts", "in-app"],
  },
  {
    question: "How do I delete my account or data?",
    answer: "Contact support using the form below. We'll process your request within 48 hours. You can also delete individual conversations and memories from the chat sidebar and Settings respectively.",
    category: "Account & Settings",
    tags: ["delete", "account", "data", "privacy"],
  },
  {
    question: "What are Connected Accounts?",
    answer: "Connected Accounts (Settings > Connected Accounts) lets you link your LinkedIn, Google, or other social accounts for profile enrichment. This helps the AI understand your professional background and provide more relevant advice.",
    category: "Account & Settings",
    tags: ["connected", "linkedin", "google", "social"],
  },

  // Documents & Knowledge
  {
    question: "How does the Deep Context RAG system work?",
    answer: "Every AI response across the entire platform draws from your uploaded documents, knowledge base articles, suitability profile, conversation history, and connected data sources. This happens automatically — the system assembles relevant context for each request across 34+ service modules including compliance, meetings, recommendations, and more.",
    category: "AI Features",
    tags: ["rag", "context", "knowledge", "intelligence"],
  },
  {
    question: "How do I annotate documents?",
    answer: "Open any document from the Documents page and scroll to the Annotations section. You can add comments, questions, or action items. Each annotation can be resolved or deleted. All team members with access to the document can see and respond to annotations.",
    category: "Financial Tools",
    tags: ["annotations", "documents", "comments", "collaboration"],
  },
  {
    question: "What is the Knowledge Base Health Score?",
    answer: "The Health Score (0-100) on the Knowledge Admin analytics tab measures your platform's knowledge quality across four dimensions: coverage (breadth of topics), freshness (how recently articles were updated), gap analysis (missing topic areas), and tool health (integration status). A higher score means the AI has better context for responses.",
    category: "AI Features",
    tags: ["health", "knowledge", "score", "quality"],
  },
  {
    question: "Are notifications sent via email?",
    answer: "No. All notifications are delivered exclusively within the platform via the in-app notification system. No emails, SMS, or external notifications are sent. You can configure notification preferences in Settings > Notifications.",
    category: "Account & Settings",
    tags: ["notifications", "email", "in-app", "alerts"],
  },

  // Keyboard Shortcuts
  {
    question: "What keyboard shortcuts are available?",
    answer: "Press the ? key (when not typing in an input field) to see all available keyboard shortcuts. Key shortcuts include Ctrl+Shift+N for new conversation, Ctrl+K for search, and / to focus the chat input.",
    category: "Keyboard Shortcuts",
    tags: ["keyboard", "shortcuts", "hotkey"],
  },

  // PDF Export
  {
    question: "How do I export calculator results as a PDF?",
    answer: "Every calculator panel has an 'Export PDF' button in its header. Click it to generate a branded PDF report with your results, charts, and a compliance disclaimer footer. The PDF downloads automatically to your device.",
    category: "Financial Tools",
    tags: ["pdf", "export", "download", "calculator", "report"],
  },

  // Income Streams
  {
    question: "What is the Income Streams calculator?",
    answer: "The Income Streams panel lets you model multiple income sources (salary, business income, investments, rental, etc.) with individual growth rates, tax treatments, and frequencies. Each stream shows its contribution to the Plan/Protect/Grow pillars, and the data feeds into your holistic financial score.",
    category: "Financial Tools",
    tags: ["income", "streams", "calculator", "salary", "business"],
  },

  // Onboarding Tour
  {
    question: "How do I restart the onboarding tour?",
    answer: "The Spotlight Tour automatically appears for first-time users. If you dismissed it and want to restart, clear your browser's local storage for this site, or open the browser console and run: localStorage.removeItem('onboarding_tour_completed'). Then refresh the page.",
    category: "Getting Started",
    tags: ["tour", "onboarding", "spotlight", "guide", "walkthrough"],
  },

  // Multi-Model Synthesis
  {
    question: "What is Multi-Model Synthesis?",
    answer: "Multi-Model Synthesis queries multiple AI perspectives simultaneously (Conservative, Growth, Balanced, Tax-Optimized) and merges their responses into a unified answer with confidence scoring. Toggle it on in the chat toolbar to get cross-verified financial guidance.",
    category: "AI Features",
    tags: ["multi-model", "synthesis", "ensemble", "verification"],
  },
];

const CATEGORIES = Array.from(new Set(FAQ_DATA.map(f => f.category)));

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Getting Started": <BookOpen className="w-4 h-4" />,
  "AI Features": <Brain className="w-4 h-4" />,
  "Financial Tools": <Calculator className="w-4 h-4" />,
  "Integrations": <Link2 className="w-4 h-4" />,
  "Account & Settings": <Settings className="w-4 h-4" />,
  "Keyboard Shortcuts": <Keyboard className="w-4 h-4" />,
};

// ─── PLATFORM GUIDE DATA ─────────────────────────────────────────
interface GuideSection {
  title: string;
  icon: React.ReactNode;
  description: string;
  features: { name: string; desc: string; route?: string }[];
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: "AI Chat & Conversation",
    icon: <MessageSquare className="w-5 h-5" />,
    description: "The core of Stewardly — your AI-powered digital financial twin that understands both general topics and deep financial advisory.",
    features: [
      { name: "Multi-Focus Modes", desc: "Switch between General, Financial, and Study modes to steer the AI's expertise. Combine modes for hybrid responses.", route: "/chat" },
      { name: "Advisory Modes", desc: "Client Advisor, Professional Coach, and Manager Dashboard modes for role-specific interactions.", route: "/chat" },
      { name: "Voice Mode", desc: "Hands-free conversation with Edge TTS speech synthesis and microphone input. iOS-compatible.", route: "/chat" },
      { name: "Live Video & Screen Share", desc: "Share your camera or screen for real-time AI analysis of visual content.", route: "/chat" },
      { name: "Document & Image Analysis", desc: "Upload PDFs, images, charts, and financial documents for AI-powered analysis.", route: "/chat" },
      { name: "Conversation History", desc: "Full conversation history with search, pinning, and export capabilities.", route: "/chat" },
      { name: "AI Memory", desc: "The AI remembers key facts across conversations for increasingly personalized advice.", route: "/settings/profile" },
      { name: "Deep Context RAG", desc: "Every AI response draws from your documents, knowledge base, suitability profile, and platform data for deeply contextual answers.", route: "/chat" },
      { name: "Self-Discovery Mode", desc: "Enable continuous learning — the AI explores topics deeper after periods of inactivity.", route: "/settings/ai-tuning" },
    ],
  },
  {
    title: "Operations Hub",
    icon: <Zap className="w-5 h-5" />,
    description: "Centralized operational command center for workflows, compliance, agent operations, and licensed review.",
    features: [
      { name: "Workflow Orchestrator", desc: "Event-driven workflow engine with configurable triggers, conditions, and automated actions.", route: "/operations" },
      { name: "Compliance Engine", desc: "Built-in Reg BI documentation, dynamic disclaimers, compliance prescreening, and audit trails.", route: "/operations" },
      { name: "Agentic Execution", desc: "AI agents that autonomously execute multi-step tasks with human-in-the-loop review.", route: "/operations" },
      { name: "Licensed Review Queue", desc: "Review queue for AI-generated financial advice requiring licensed professional approval.", route: "/operations" },
      { name: "BCP (Business Continuity)", desc: "Business continuity planning dashboard with disaster recovery procedures.", route: "/admin/bcp" },
      { name: "Email Campaigns", desc: "AI-generated email campaigns with audience segmentation, scheduling, and performance tracking.", route: "/email-campaigns" },
      { name: "Carrier Connector", desc: "Connect to insurance carriers for application submission and status tracking.", route: "/carrier-connector" },
    ],
  },
  {
    title: "Intelligence Hub",
    icon: <Brain className="w-5 h-5" />,
    description: "Data intelligence, analytics, and AI-powered insights from multiple data sources.",
    features: [
      { name: "Data Intelligence", desc: "Ingest data from web scraping, RSS feeds, CSV uploads, and API feeds. AI learns from ingested data.", route: "/intelligence-hub" },
      { name: "Analytics Dashboard", desc: "Ingestion volume, quality trends, insight distribution, and data pipeline health monitoring.", route: "/intelligence-hub" },
      { name: "Model Results", desc: "Statistical models, predictive insights, and AI model performance tracking.", route: "/intelligence-hub" },
      { name: "Government Data Pipelines", desc: "Automated data from BLS, FRED, BEA, Census, SEC EDGAR, and FINRA BrokerCheck.", route: "/intelligence-hub" },
      { name: "Fairness Testing", desc: "AI fairness and bias testing dashboard to ensure equitable outcomes.", route: "/admin/fairness" },
      { name: "Admin Intelligence", desc: "Platform-wide AI intelligence monitoring, model performance, and context quality metrics.", route: "/admin/intelligence" },
    ],
  },
  {
    title: "Advisory Hub",
    icon: <Package className="w-5 h-5" />,
    description: "Client-facing advisory tools including insurance quoting, estate planning, premium finance, and product marketplace.",
    features: [
      { name: "Insurance Quoting (COMPULIFE)", desc: "Real-time life insurance quotes from 100+ carriers via COMPULIFE integration.", route: "/advisory" },
      { name: "Estate Planning", desc: "Estate planning benchmarks, trust planning guidance, TCJA sunset analysis, and charitable giving strategies.", route: "/advisory" },
      { name: "Premium Finance", desc: "Premium finance analysis with live SOFR rates, ROI calculations, and sparkline visualization.", route: "/advisory" },
      { name: "Product Marketplace", desc: "Browse financial products with AI-powered suitability scoring and side-by-side comparison.", route: "/advisory" },
      { name: "Product Intelligence", desc: "IUL crediting rates, market indices, risk profiling, and eSignature tracking.", route: "/product-intelligence" },
    ],
  },
  {
    title: "Relationships & CRM",
    icon: <Users className="w-5 h-5" />,
    description: "Client relationship management, professional networking, and message campaigns.",
    features: [
      { name: "Contact Management", desc: "Manage client contacts with enrichment from Clearbit and FullContact.", route: "/relationships" },
      { name: "COI Network", desc: "Center of Influence network management for professional referrals and collaboration.", route: "/relationships" },
      { name: "Message Campaigns", desc: "Create and send personalized in-app message campaigns with AI-generated content.", route: "/relationships" },
      { name: "Professional Directory", desc: "Verified professional directory with SEC IAPD, CFP Board, and state bar verification badges.", route: "/relationships" },
      { name: "CRM Sync", desc: "Bidirectional sync with Wealthbox and Redtail CRM systems.", route: "/integrations" },
      { name: "Meeting Intelligence", desc: "Meeting scheduling, transcription, and AI-powered meeting insights.", route: "/relationships" },
    ],
  },
  {
    title: "Market Data & Research",
    icon: <TrendingUp className="w-5 h-5" />,
    description: "Real-time market data, economic indicators, and research tools.",
    features: [
      { name: "Market Quotes", desc: "Live stock quotes, indices, and financial market data.", route: "/market-data" },
      { name: "Economic Indicators", desc: "BLS employment data, FRED interest rates, Census demographics, and BEA GDP data.", route: "/market-data" },
      { name: "SEC EDGAR Filings", desc: "Company financials and SEC filing data for AAPL, MSFT, GOOGL, AMZN, TSLA, and more.", route: "/market-data" },
      { name: "FINRA BrokerCheck", desc: "Broker-dealer information and registration data from FINRA.", route: "/market-data" },
    ],
  },
  {
    title: "Financial Planning Tools",
    icon: <Calculator className="w-5 h-5" />,
    description: "Comprehensive financial calculators and planning tools.",
    features: [
      { name: "Compound Interest Calculator", desc: "Calculate compound growth with customizable parameters.", route: "/calculators" },
      { name: "Loan Amortization", desc: "Full amortization schedules with payment breakdowns.", route: "/calculators" },
      { name: "Retirement Projections", desc: "Monte Carlo simulations with configurable scenarios and success rates.", route: "/calculators" },
      { name: "IUL Illustrations", desc: "Indexed Universal Life back-testing with S&P 500 historical data.", route: "/calculators" },
      { name: "Premium Finance ROI", desc: "Premium finance return-on-investment analysis with SOFR-based rates.", route: "/calculators" },
      { name: "What-If Scenarios", desc: "Scenario modeling for financial decisions with side-by-side comparison.", route: "/calculators" },
      { name: "Tax Projector", desc: "Multi-year tax projection with Roth conversion analysis and bracket optimization.", route: "/calculators" },
      { name: "Social Security Optimizer", desc: "Optimize Social Security claiming strategy with spousal benefit analysis.", route: "/calculators" },
      { name: "Medicare Navigator", desc: "Navigate Medicare enrollment windows, Part D plans, and IRMAA surcharges.", route: "/calculators" },
      { name: "HSA Optimizer", desc: "Health Savings Account contribution and investment strategy optimization.", route: "/calculators" },
      { name: "Divorce Analysis", desc: "Asset division modeling, alimony projections, and equitable distribution analysis.", route: "/calculators" },
      { name: "Education Planner", desc: "529 plan projections and education funding strategy with financial aid impact.", route: "/calculators" },
      { name: "Charitable Giving", desc: "Donor-advised fund, QCD, and charitable remainder trust strategy optimization.", route: "/calculators" },
      { name: "Income Streams", desc: "Model multiple income sources with growth rates, tax treatments, and pillar contributions.", route: "/calculators" },
      { name: "PDF Export", desc: "Export any calculator result as a branded PDF report with compliance disclaimers.", route: "/calculators" },
    ],
  },
  {
    title: "Integrations & Data Sources",
    icon: <Link2 className="w-5 h-5" />,
    description: "Connect external services and data sources to enrich your financial intelligence.",
    features: [
      { name: "Plaid (Bank Accounts)", desc: "Securely connect bank accounts for transaction categorization and budget analysis.", route: "/integrations" },
      { name: "Canopy Connect", desc: "Link insurance policies for comprehensive coverage analysis.", route: "/integrations" },
      { name: "SnapTrade (Brokerage)", desc: "Connect brokerage accounts for portfolio tracking and analysis.", route: "/integrations" },
      { name: "Credit Bureau (Soft Pull)", desc: "FICO 8 and VantageScore 3.0 with DTI analysis and insurance impact assessment.", route: "/integrations" },
      { name: "Passive Actions", desc: "Enable automated background operations for any data source — auto-refresh, sync, monitoring, and alerts.", route: "/passive-actions" },
      { name: "Integration Health", desc: "Monitor status, uptime, and error rates for all connected services.", route: "/integration-health" },
    ],
  },
  {
    title: "Document Management",
    icon: <FileText className="w-5 h-5" />,
    description: "Upload, analyze, preview, and annotate financial documents with AI-powered extraction.",
    features: [
      { name: "Document Upload & Analysis", desc: "Upload PDFs, images, and documents for AI text extraction, tagging, and categorization.", route: "/documents" },
      { name: "Inline Document Preview", desc: "Preview PDFs and images directly in the document details dialog without downloading.", route: "/documents" },
      { name: "Collaborative Annotations", desc: "Add comments, questions, and action items on documents. Resolve and track annotation threads.", route: "/documents" },
      { name: "Version History", desc: "Track document versions with diff comparison and rollback capability.", route: "/documents" },
      { name: "AI Auto-Categorization", desc: "Documents are automatically tagged and categorized by the AI upon upload.", route: "/documents" },
    ],
  },
  {
    title: "Settings & Personalization",
    icon: <Settings className="w-5 h-5" />,
    description: "Customize every aspect of your Stewardly experience.",
    features: [
      { name: "Profile & Style", desc: "Avatar, communication style, and AI memory management.", route: "/settings/profile" },
      { name: "Connected Accounts", desc: "Link LinkedIn, Google, and other social accounts for profile enrichment.", route: "/settings/connected-accounts" },
      { name: "Financial Profile", desc: "Suitability assessment for personalized, risk-appropriate advice.", route: "/settings/suitability" },
      { name: "Knowledge Base", desc: "Upload documents that train your AI with drag-and-drop and AI auto-categorization.", route: "/settings/knowledge" },
      { name: "AI Tuning", desc: "5-layer personalization cascade for fine-grained AI behavior control.", route: "/settings/ai-tuning" },
      { name: "Voice & Speech", desc: "Edge TTS voice selection, speech rate, and microphone settings.", route: "/settings/voice" },
      { name: "Notifications", desc: "In-app alert preferences and notification frequency.", route: "/settings/notifications" },
      { name: "Appearance", desc: "Theme (dark/light), colors, font size, and UI density.", route: "/settings/appearance" },
      { name: "Privacy & Data", desc: "Data rights, consent management, export, and deletion.", route: "/settings/privacy" },
      { name: "Data Sharing", desc: "Granular control over who sees what financial data.", route: "/settings/data-sharing" },
    ],
  },
  {
    title: "Administration",
    icon: <Shield className="w-5 h-5" />,
    description: "Admin-only tools for platform management, compliance, and oversight.",
    features: [
      { name: "Global Admin", desc: "Platform-wide administration, user management, and system configuration.", route: "/admin" },
      { name: "Manager Dashboard", desc: "Team performance KPIs, briefings, and advisor oversight.", route: "/manager" },
      { name: "Organizations", desc: "Multi-org support with custom branding, AI configuration, and member management.", route: "/organizations" },
      { name: "Org Branding Editor", desc: "Customize organization landing pages, logos, and color schemes.", route: "/org-branding" },
      { name: "Knowledge Admin", desc: "Manage platform-wide knowledge base content and categories.", route: "/admin/knowledge" },
      { name: "Admin Integrations", desc: "Configure platform-level API credentials and integration settings.", route: "/admin/integrations" },
      { name: "Improvement Engine", desc: "AI self-improvement tracking, prompt A/B testing, and capability expansion.", route: "/improvement" },
      { name: "Proficiency Dashboard", desc: "Track your progress and proficiency across platform features.", route: "/proficiency" },
      { name: "Suitability Panel", desc: "Review and manage client suitability assessments with compliance documentation.", route: "/suitability-panel" },
      { name: "Knowledge Base Health", desc: "Composite health score (0-100) tracking coverage, freshness, gaps, and tool health.", route: "/admin/knowledge" },
    ],
  },
];

// ─── ARCHITECTURE DATA ───────────────────────────────────────────
const ARCHITECTURE_LAYERS = [
  {
    name: "Layer 1 — Foundation",
    icon: <Server className="w-4 h-4" />,
    items: [
      "Web scraping engine with rate limiting and caching",
      "Adaptive rate management for API calls",
      "Foundation data layer with resilient DB operations",
      "Encryption service for sensitive credential storage",
      "Infrastructure resilience with retry logic and circuit breakers",
    ],
  },
  {
    name: "Layer 2 — Intelligence",
    icon: <Brain className="w-4 h-4" />,
    items: [
      "LLM integration with multi-model failover",
      "Knowledge graph with dynamic entity relationships",
      "Predictive insights engine with statistical models",
      "Adaptive context management for conversation quality",
      "Prompt A/B testing for continuous improvement",
    ],
  },
  {
    name: "Layer 3 — Advisory",
    icon: <Briefcase className="w-4 h-4" />,
    items: [
      "COMPULIFE insurance quoting integration",
      "SOFR-based premium finance calculations",
      "Credit bureau soft-pull with DTI analysis",
      "Estate planning benchmarks and knowledge base",
      "Product suitability scoring engine",
    ],
  },
  {
    name: "Layer 4 — Compliance",
    icon: <Shield className="w-4 h-4" />,
    items: [
      "Reg BI documentation and audit trails",
      "Dynamic disclaimers based on conversation context",
      "Compliance prescreening for financial advice",
      "Graduated autonomy with human-in-the-loop review",
      "Fairness testing and bias detection",
    ],
  },
  {
    name: "Layer 5 — Continuous Improvement",
    icon: <Activity className="w-4 h-4" />,
    items: [
      "Deep context RAG assembler across 34+ service files",
      "Exponential improvement engine with prompt A/B testing",
      "Knowledge base health scoring and gap analysis",
      "Collaborative annotations for document review",
      "TF-IDF relevance scoring for document search",
      "Multi-model synthesis with cross-verification",
      "Spotlight onboarding tour for new users",
      "In-app notification system (zero external emails)",
    ],
  },
];

export default function Help() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedGuide, setExpandedGuide] = useState<Set<number>>(new Set());

  // Contact form
  const [contactName, setContactName] = useState(user?.name || "");
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const notifyMutation = trpc.system.notifyOwner.useMutation({ onError: (e) => toast.error(`Failed to send: ${e.message}`) });

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

  const toggleGuideSection = (index: number) => {
    setExpandedGuide(prev => {
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
      toast.error("Your message couldn't be sent — please check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AppShell title="Help & Support">
      <SEOHead title="Help & Support" description="Help documentation and support resources" />
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <HelpCircle className="w-4 h-4 text-accent shrink-0" />
          <h1 className="text-sm font-semibold truncate">Help & Platform Guide</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto">
            <BookOpen className="w-7 h-7 text-accent" />
          </div>
          <h2 className="text-2xl font-bold">Stewardly Platform Guide</h2>
          <p className="text-muted-foreground text-sm max-w-lg mx-auto">
            Comprehensive guide to all 62 pages, 102 services, and 53 API routers powering your digital financial twin.
          </p>
        </div>

        {/* Tabs: Guide / FAQ / Architecture / Contact */}
        <Tabs defaultValue="guide" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-lg mx-auto">
            <TabsTrigger value="guide" className="text-xs gap-1"><BookOpen className="w-3 h-3" /> Guide</TabsTrigger>
            <TabsTrigger value="faq" className="text-xs gap-1"><HelpCircle className="w-3 h-3" /> FAQ</TabsTrigger>
            <TabsTrigger value="architecture" className="text-xs gap-1"><Layers className="w-3 h-3" /> Architecture</TabsTrigger>
            <TabsTrigger value="contact" className="text-xs gap-1"><Send className="w-3 h-3" /> Contact</TabsTrigger>
          </TabsList>

          {/* ─── GUIDE TAB ─── */}
          <TabsContent value="guide" className="mt-6 space-y-4">
            <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto">
              Click any section to expand and see all features. Click a feature name to navigate directly to that page.
            </p>
            {GUIDE_SECTIONS.map((section, si) => {
              const isOpen = expandedGuide.has(si);
              return (
                <Card key={si} className="overflow-hidden">
                  <button
                    onClick={() => toggleGuideSection(si)}
                    className="w-full flex items-start gap-3 p-4 text-left hover:bg-secondary/20 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0 p-1.5 rounded-md bg-accent/10 text-accent">
                      {section.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{section.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                      <Badge variant="outline" className="mt-1.5 text-[9px]">{section.features.length} features</Badge>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pl-14 space-y-2">
                      {section.features.map((feat, fi) => (
                        <div
                          key={fi}
                          className={`flex items-start gap-2 p-2 rounded-md ${feat.route ? "hover:bg-accent/5 cursor-pointer" : ""}`}
                          onClick={() => feat.route && navigate(feat.route)}
                        >
                          <CheckCircle className="w-3.5 h-3.5 text-accent shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium flex items-center gap-1.5">
                              {feat.name}
                              {feat.route && <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />}
                            </p>
                            <p className="text-[11px] text-muted-foreground">{feat.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-accent">62</p>
                  <p className="text-[10px] text-muted-foreground">Pages</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-accent">102</p>
                  <p className="text-[10px] text-muted-foreground">Services</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-accent">53</p>
                  <p className="text-[10px] text-muted-foreground">API Routers</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold font-mono tabular-nums text-accent">1,627+</p>
                  <p className="text-[10px] text-muted-foreground">Tests Passing</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ─── FAQ TAB ─── */}
          <TabsContent value="faq" className="mt-6 space-y-6">
            {/* Search */}
            <div className="relative max-w-lg mx-auto">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search help topics..."
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
          </TabsContent>

          {/* ─── ARCHITECTURE TAB ─── */}
          <TabsContent value="architecture" className="mt-6 space-y-6">
            <div className="text-center space-y-2 mb-6">
              <h3 className="text-lg font-semibold">4-Layer Architecture</h3>
              <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                Stewardly implements a comprehensive 4-layer architecture: Foundation, Intelligence, Advisory, and Compliance.
              </p>
            </div>

            <div className="space-y-4">
              {ARCHITECTURE_LAYERS.map((layer, li) => (
                <Card key={li}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-accent/10 text-accent">{layer.icon}</div>
                      <CardTitle className="text-sm">{layer.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <ul className="space-y-1.5">
                      {layer.items.map((item, ii) => (
                        <li key={ii} className="flex items-start gap-2 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-accent shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tech Stack */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-accent/10 text-accent"><Cpu className="w-4 h-4" /></div>
                  <CardTitle className="text-sm">Technology Stack</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: "Interface", value: "Modern, responsive design with real-time updates" },
                    { label: "AI Engine", value: "Multi-model intelligence with automatic failover (17+ models)" },
                    { label: "Voice", value: "Natural speech input and text-to-speech output" },
                    { label: "Security", value: "Enterprise-grade encryption and OAuth authentication" },
                    { label: "Data Sources", value: "6 government APIs with automated daily sync" },
                    { label: "Reliability", value: "3,200+ automated tests, 99.9% uptime target" },
                  ].map((tech, ti) => (
                    <div key={ti} className="p-2 rounded-md bg-secondary/30">
                      <p className="text-[10px] text-muted-foreground font-medium">{tech.label}</p>
                      <p className="text-xs">{tech.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Key Integrations */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-accent/10 text-accent"><Globe className="w-4 h-4" /></div>
                  <CardTitle className="text-sm">External Integrations</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    "Plaid (Banking)", "Canopy Connect (Insurance)", "SnapTrade (Brokerage)",
                    "COMPULIFE (Quoting)", "SOFR (Rates)", "Credit Bureaus",
                    "DocuSign (eSignature)", "Wealthbox CRM", "Redtail CRM",
                    "Clearbit (Enrichment)", "FullContact", "n8n (Workflows)",
                    "BLS API", "FRED API", "BEA API",
                    "Census API", "SEC EDGAR", "FINRA BrokerCheck",
                  ].map((name, ni) => (
                    <div key={ni} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle className="w-3 h-3 text-accent shrink-0" />
                      {name}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ─── CONTACT TAB ─── */}
          <TabsContent value="contact" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5 text-accent" />
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </AppShell>
  );
}
