import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, ArrowUp, AudioLines, BarChart3, BookOpen, Bot, Briefcase, Building2, Calculator, Check, CheckCircle, ClipboardList,
  ChevronDown, ChevronUp, FileText, GraduationCap, Image, Key, Loader2, LogOut, Menu, MessageSquare,
  Mic, MicOff, Monitor, Package, PanelLeft, PanelLeftClose, Paperclip, PhoneOff, Plus,
  Settings, Sparkles, ThumbsDown, ThumbsUp, Trash2, User, Users,
  Video, Volume2, VolumeX, X, Fingerprint, TrendingUp, Palette, Globe, Calendar, DollarSign, Brain, Shield
} from "lucide-react";
import { Streamdown } from "streamdown";
import { LiveSession } from "@/components/LiveSession";
import { VoiceOrb } from "@/components/VoiceOrb";
import { ProgressiveMessage } from "@/components/ProgressiveMessage";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useTTS } from "@/hooks/useTTS";
import { useAnonymousChat } from "@/hooks/useAnonymousChat";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import type { AdvisoryMode, FocusMode, UserRole } from "@shared/types";
import { parseFocusModes, serializeFocusModes } from "@shared/types";

// ─── CONSTANTS ────────────────────────────────────────────────────
const FOCUS_OPTIONS: { value: FocusMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "general", label: "General", icon: <TrendingUp className="w-3.5 h-3.5" />, desc: "Open-ended advisory" },
  { value: "financial", label: "Financial", icon: <BarChart3 className="w-3.5 h-3.5" />, desc: "Financial planning focus" },
  { value: "study", label: "Study & Learn", icon: <FileText className="w-3.5 h-3.5" />, desc: "Guided study & learning" },
];

const MODE_OPTIONS: { value: AdvisoryMode; label: string; desc: string; minRole: UserRole }[] = [
  { value: "client", label: "Client Advisor", desc: "Speak directly to clients", minRole: "advisor" },
  { value: "coach", label: "Professional Coach", desc: "Coach financial professionals", minRole: "advisor" },
  { value: "manager", label: "Manager Dashboard", desc: "Team briefings & KPIs", minRole: "manager" },
];

// Dynamic prompt suggestions based on focus modes, user context, and progression
const PROMPT_BANK: { text: string; icon: string; category: FocusMode; tier: "new" | "returning" | "any" }[] = [
  // General prompts
  { text: "Help me think through a career decision", icon: "💡", category: "general", tier: "any" },
  { text: "Help me plan my week effectively", icon: "📋", category: "general", tier: "any" },
  { text: "Help me write a professional email", icon: "✉️", category: "general", tier: "any" },
  { text: "Brainstorm ideas for my side project", icon: "🚀", category: "general", tier: "any" },
  { text: "Help me prepare for a job interview", icon: "🎯", category: "general", tier: "returning" },
  { text: "Summarize the pros and cons of a big decision", icon: "⚖️", category: "general", tier: "any" },
  // Financial prompts
  { text: "Analyze my retirement readiness", icon: "📊", category: "financial", tier: "returning" },
  { text: "What should I know about IUL policies?", icon: "🛡️", category: "financial", tier: "any" },
  { text: "Compare term vs whole life insurance", icon: "⚖️", category: "financial", tier: "any" },
  { text: "Help me create a savings plan", icon: "💰", category: "financial", tier: "new" },
  { text: "Review my investment strategy", icon: "📈", category: "financial", tier: "returning" },
  { text: "Explain Roth conversion strategies", icon: "🔄", category: "financial", tier: "any" },
  // Study prompts
  { text: "Summarize this document for me", icon: "📖", category: "study", tier: "any" },
  { text: "Create study notes from my materials", icon: "📝", category: "study", tier: "any" },
  { text: "Quiz me on what I've uploaded", icon: "❓", category: "study", tier: "returning" },
  { text: "Compare these two documents", icon: "🔍", category: "study", tier: "any" },
];

function getDynamicPrompts(focus: FocusMode[], hasConversations: boolean): typeof PROMPT_BANK {
  const tier = hasConversations ? "returning" : "new";
  const filtered = PROMPT_BANK.filter(p => {
    const focusMatch = focus.includes(p.category);
    const tierMatch = p.tier === "any" || p.tier === tier;
    return focusMatch && tierMatch;
  });
  // Shuffle and pick 4, ensuring variety across categories
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const result: typeof PROMPT_BANK = [];
  const usedCategories = new Set<string>();
  // First pass: one from each active category
  for (const p of shuffled) {
    if (result.length >= 4) break;
    if (!usedCategories.has(p.category)) {
      result.push(p);
      usedCategories.add(p.category);
    }
  }
  // Fill remaining slots
  for (const p of shuffled) {
    if (result.length >= 4) break;
    if (!result.includes(p)) result.push(p);
  }
  return result;
}

// Role hierarchy for access checks
const ROLE_HIERARCHY: Record<UserRole, number> = { user: 0, advisor: 1, manager: 2, admin: 3 };
function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole as UserRole ?? "user"] >= ROLE_HIERARCHY[minRole];
}

// Typing animation hook
function useTypingAnimation(text: string, speed = 40) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return { displayed, done };
}

// ─── WELCOME SCREEN COMPONENT ─────────────────────────────────
function WelcomeScreen({ avatarUrl, userName, selectedFocus, hasConversations, ttsEnabled, onPromptClick }: {
  avatarUrl?: string | null;
  userName?: string | null;
  selectedFocus: FocusMode[];
  hasConversations: boolean;
  ttsEnabled: boolean;
  onPromptClick: (text: string) => void;
}) {
  const greeting = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}${userName ? `, ${userName.split(" ")[0]}` : ""}`;
  const { displayed: typedGreeting, done: greetingDone } = useTypingAnimation(greeting, 35);
  const [prompts] = useState(() => getDynamicPrompts(selectedFocus, hasConversations));

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl font-semibold mb-3">
          {typedGreeting}
          {!greetingDone && <span className="inline-block w-0.5 h-6 bg-accent ml-0.5 animate-pulse" />}
        </h1>
        <p className={`text-muted-foreground text-sm mb-8 max-w-md mx-auto transition-opacity duration-700 ${greetingDone ? "opacity-100" : "opacity-0"}`}>
          What can I help you with?
        </p>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto transition-all duration-700 ${greetingDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {prompts.map((prompt, i) => (
            <button
              key={i}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-accent/30 transition-all text-left text-sm group"
              onClick={() => onPromptClick(prompt.text)}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-accent shrink-0 group-hover:scale-110 transition-transform">{prompt.icon}</span>
              <span className="text-foreground/80 text-xs leading-snug">{prompt.text}</span>
            </button>
          ))}
        </div>


        {/* Onboarding Checklist */}
        {!hasConversations && (
          <div className={`mt-8 max-w-lg mx-auto transition-all duration-700 delay-500 ${greetingDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <OnboardingChecklist
              workflowType="professional_onboarding"
              compact
              onStepAction={(key) => {
                if (key === "suitability") onPromptClick("Help me complete my suitability assessment");
                else if (key === "first_chat") onPromptClick("Tell me about your financial planning capabilities");
                else if (key === "ai_settings") onPromptClick("How do I configure my AI preferences?");
                else if (key === "knowledge_base") onPromptClick("How do I upload documents to my knowledge base?");
                else if (key === "explore_tools") onPromptClick("Show me the financial tools available");
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [matchChat, paramsChat] = useRoute("/chat/:id");
  const utils = trpc.useUtils();

  // ─── STATE ──────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState<number | null>(
    matchChat && paramsChat?.id ? parseInt(paramsChat.id) : null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [selectedFocus, setSelectedFocus] = useState<FocusMode[]>(["general", "financial"]);
  const focusSerialized = serializeFocusModes(selectedFocus);

  const toggleFocus = (mode: FocusMode) => {
    setSelectedFocus(prev => {
      if (prev.includes(mode)) {
        // Don't allow deselecting all — keep at least one
        if (prev.length <= 1) return prev;
        return prev.filter(m => m !== mode);
      }
      return [...prev, mode];
    });
  };
  const [mode, setMode] = useState<AdvisoryMode>("client");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [liveSessionActive, setLiveSessionActive] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  // ─── HANDS-FREE & VOICE STATE ──────────────────────────────────
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true); // Default ON per spec

  // ─── REFS ──────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handleSendRef = useRef<(text: string) => void>(() => {});

  // ─── GUARD REF ─────────────────────────────────────────────────
  // Blocks voice recognition during TTS playback AND AI processing.
  // The voice hook checks this before starting/restarting.
  const guardRef = useRef(false);
  // Track hands-free processing state for UI (not a React state to avoid re-render loops)
  const processingRef = useRef(false);
  const [, forceUpdate] = useState(0);

  // ─── ENHANCED TTS ─────────────────────────────────────────────
  // Read voice preference from localStorage (set in Settings > Voice tab)
  const [ttsVoice] = useState(() => localStorage.getItem("tts-voice") || "aria");
  const tts = useTTS({
    enabled: ttsEnabled,
    voice: ttsVoice,
    rate: 1.0,
    onStart: () => {
      guardRef.current = true;
    },
    onEnd: () => {
      guardRef.current = false;
      processingRef.current = false;
      forceUpdate(n => n + 1);
      // In hands-free mode, restart listening after TTS completes
      if (handsFreeActive) {
        setTimeout(() => voice.start(), 600);
      }
    },
  });

  // ─── VOICE RECOGNITION (STATE MACHINE) ────────────────────────
  // The voice hook uses a state machine internally:
  //   IDLE → LISTENING → SENT → (wait for start()) → LISTENING
  // After sending a transcript, it moves to SENT and NEVER auto-restarts.
  // Only an explicit start() call (from tts.onEnd or the finally block) restarts it.
  const voice = useVoiceRecognition({
    enabled: handsFreeActive,
    silenceTimeout: 1800,
    lang: "en-US",
    onTranscript: (text) => {
      // Recognition already stopped itself (moved to SENT state).
      // Set guard so it can't restart, then send the message.
      guardRef.current = true;
      processingRef.current = true;
      setInput("");
      forceUpdate(n => n + 1);
      handleSendRef.current(text);
    },
    onInterim: (text) => {
      if (handsFreeActive && !processingRef.current && !tts.isSpeaking) {
        setInput(text);
      }
    },
    guardRef,
  });

  // Derive voice state for UI
  const voiceState: "idle" | "listening" | "processing" | "speaking" =
    tts.isSpeaking ? "speaking" :
    (isStreaming || processingRef.current) ? "processing" :
    voice.isListening ? "listening" :
    "idle";

  // ─── ANONYMOUS MODE ──────────────────────────────────────────
  const isAnonymous = !isAuthenticated && typeof window !== 'undefined' && localStorage.getItem('anonymousMode') === 'true';
  const allowQueries = isAuthenticated || isAnonymous;
  const anonChat = useAnonymousChat();
  const anonSendMutation = trpc.anonymousChat.send.useMutation();

  // ─── QUERIES ──────────────────────────────────────────────────
  const conversationsQuery = trpc.conversations.list.useQuery(undefined, { enabled: allowQueries });
  const messagesQuery = trpc.conversations.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId && allowQueries }
  );
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: allowQueries });
  const avatarUrl = settingsQuery.data?.avatarUrl;

  // ─── MUTATIONS ────────────────────────────────────────────────
  const sendMutation = trpc.chat.send.useMutation();
  const createConversation = trpc.conversations.create.useMutation();
  const deleteConversation = trpc.conversations.delete.useMutation();
  const feedbackMutation = trpc.feedback.submit.useMutation();
  const visualMutation = trpc.visual.generate.useMutation();

  // ─── EFFECTS ──────────────────────────────────────────────────
  useEffect(() => {
    if (matchChat && paramsChat?.id) setConversationId(parseInt(paramsChat.id));
  }, [matchChat, paramsChat?.id]);

  useEffect(() => {
    if (messagesQuery.data) setMessages(messagesQuery.data);
  }, [messagesQuery.data]);

  // Auto-scroll only when user is near bottom (IntersectionObserver pattern)
  useEffect(() => {
    const sentinel = messagesEndRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isNearBottomRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ─── HANDS-FREE TOGGLE ────────────────────────────────────────
  const toggleHandsFree = useCallback(() => {
    if (handsFreeActive) {
      // Deactivate
      setHandsFreeActive(false);
      voice.stop();
      tts.cancel();
    } else {
      // Activate — play a chime-like confirmation, then start listening
      setHandsFreeActive(true);
      setTtsEnabled(true); // Force TTS on in hands-free
      tts.speak("Hands-free mode active.");
    }
  }, [handsFreeActive, voice, tts]);

   // ─── SEND MESSAGE ───────────────────────────────────────────
  const handleSendWithText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;

    const userMsg = { role: "user" as const, content: trimmed, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      // ─── ANONYMOUS PATH ───
      if (isAnonymous) {
        // Ensure we have an active anon conversation
        if (!anonChat.activeConversation) {
          if (anonChat.atConversationLimit) {
            toast.error("You've reached the free conversation limit. Sign up to continue!");
            setIsStreaming(false);
            return;
          }
          anonChat.createConversation();
        }
        if (anonChat.atMessageLimit) {
          toast.error("Message limit reached for this conversation. Start a new one or sign up!");
          setIsStreaming(false);
          return;
        }

        anonChat.addMessage("user", trimmed);

        // Build message history for the anonymous endpoint
        const anonHistory = [...(anonChat.activeConversation?.messages || []).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })), { role: "user" as const, content: trimmed }];

        const result = await anonSendMutation.mutateAsync({
          messages: anonHistory,
          focus: selectedFocus[0] || "general",
        });

        anonChat.addMessage("assistant", typeof result.content === 'string' ? result.content : String(result.content));
        const assistantMsg = {
          role: "assistant" as const,
          content: result.content,
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (ttsEnabled) tts.speak(typeof result.content === 'string' ? result.content : String(result.content));
        return;
      }

      // ─── AUTHENTICATED PATH ───
      let activeConvId = conversationId;
      if (!activeConvId) {
        const newConv = await createConversation.mutateAsync({ mode, title: trimmed.slice(0, 80) });
        activeConvId = newConv.id;
        setConversationId(activeConvId);
        navigate(`/chat/${activeConvId}`, { replace: true });
        utils.conversations.list.invalidate();
      }

      const result = await sendMutation.mutateAsync({
        content: trimmed,
        conversationId: activeConvId,
        mode,
        focus: focusSerialized,
      });

      const assistantMsg = {
        id: result.id,
        role: "assistant" as const,
        content: result.content,
        confidenceScore: result.confidenceScore,
        complianceStatus: result.complianceStatus,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (ttsEnabled) {
        tts.speak(result.content);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsStreaming(false);
      setAttachments([]);
      // If hands-free is active and TTS is NOT about to speak (no ttsEnabled or error path),
      // release the guard and restart listening.
      // If TTS IS enabled, the guard stays on until tts.onEnd releases it and restarts listening.
      if (handsFreeActive && !ttsEnabled) {
        guardRef.current = false;
        processingRef.current = false;
        forceUpdate(n => n + 1);
        setTimeout(() => voice.start(), 600);
      }
    }
  };

  const handleSend = () => handleSendWithText(input);

  // Keep the ref in sync for voice recognition callback
  useEffect(() => {
    handleSendRef.current = handleSendWithText;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── FILE HANDLING ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  };
  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  // ─── CONVERSATION MANAGEMENT ──────────────────────────────────
  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    navigate("/");
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: number) => {
    await deleteConversation.mutateAsync({ id });
    if (conversationId === id) handleNewConversation();
    utils.conversations.list.invalidate();
  };

  const handleFeedback = async (messageId: number, rating: "up" | "down") => {
    if (!conversationId) return;
    await feedbackMutation.mutateAsync({ messageId, conversationId, rating });
    toast.success(rating === "up" ? "Thanks for the feedback!" : "Noted — we'll improve");
  };

  // ─── ROLE-BASED MODE FILTERING ────────────────────────────────
  const userRole = (user?.role as UserRole) || "user";
  const availableModes = useMemo(() => {
    return MODE_OPTIONS.filter(m => hasMinRole(userRole, m.minRole));
  }, [userRole]);
  const showModes = availableModes.length > 0;

  // ─── SIDEBAR NAV STATE (must be before auth gate to maintain hook order) ─
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  // ─── AUTH GATE ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  // Allow anonymous/guest users to use the chat

  const isWelcome = messages.length === 0 && !conversationId;
  const focusLabel = selectedFocus.length === FOCUS_OPTIONS.length
    ? "All Modes"
    : selectedFocus.map(f => FOCUS_OPTIONS.find(o => o.value === f)?.label).filter(Boolean).join(" + ");

  // ─── SIDEBAR NAV ITEMS (role-aware) ───────────────────────────

  const toolsNav = [
    { icon: <Calculator className="w-3.5 h-3.5" />, label: "Calculators", href: "/calculators", minRole: "user" as UserRole },
    { icon: <Package className="w-3.5 h-3.5" />, label: "Products", href: "/products", minRole: "user" as UserRole },
    { icon: <Calendar className="w-3.5 h-3.5" />, label: "Meetings", href: "/meetings", minRole: "user" as UserRole },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Insights", href: "/insights", minRole: "user" as UserRole },
    { icon: <DollarSign className="w-3.5 h-3.5" />, label: "Planning", href: "/planning", minRole: "user" as UserRole },
    { icon: <Brain className="w-3.5 h-3.5" />, label: "Coach", href: "/coach", minRole: "user" as UserRole },
    { icon: <Shield className="w-3.5 h-3.5" />, label: "Compliance", href: "/compliance", minRole: "user" as UserRole },
    { icon: <Users className="w-3.5 h-3.5" />, label: "Marketplace", href: "/marketplace", minRole: "user" as UserRole },
    { icon: <ClipboardList className="w-3.5 h-3.5" />, label: "Workflows", href: "/workflows", minRole: "user" as UserRole },
    { icon: <BookOpen className="w-3.5 h-3.5" />, label: "Study Buddy", href: "/study", minRole: "user" as UserRole },
    { icon: <GraduationCap className="w-3.5 h-3.5" />, label: "Education", href: "/education", minRole: "user" as UserRole },
    { icon: <GraduationCap className="w-3.5 h-3.5" />, label: "Student Loans", href: "/student-loans", minRole: "user" as UserRole },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Equity Comp", href: "/equity-comp", minRole: "user" as UserRole },
    { icon: <Key className="w-3.5 h-3.5" />, label: "Digital Assets", href: "/digital-assets", minRole: "user" as UserRole },
    { icon: <Users className="w-3.5 h-3.5" />, label: "COI Network", href: "/coi-network", minRole: "advisor" as UserRole },
  ];

  const adminNav = [
    { icon: <Briefcase className="w-3.5 h-3.5" />, label: "Portal", href: "/portal", minRole: "advisor" as UserRole },
    { icon: <Building2 className="w-3.5 h-3.5" />, label: "Organizations", href: "/organizations", minRole: "advisor" as UserRole },
    { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Manager Dashboard", href: "/manager", minRole: "manager" as UserRole },
    { icon: <Globe className="w-3.5 h-3.5" />, label: "Global Admin", href: "/admin", minRole: "admin" as UserRole },
  ];

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── SIDEBAR ──────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-50 h-full bg-card border-r border-border flex flex-col
        transition-all duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${sidebarCollapsed ? "w-14" : "w-72"}
      `}>
        <div className={`flex items-center border-b border-border shrink-0 ${sidebarCollapsed ? "p-2 justify-center" : "p-3 justify-between"}`}>
          {sidebarCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleNewConversation}>
                  <Plus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">New Conversation</TooltipContent>
            </Tooltip>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="gap-2 text-xs flex-1 justify-start" onClick={handleNewConversation}>
                <Plus className="w-3.5 h-3.5" /> New Conversation
              </Button>
              <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Scrollable conversation list — grows to fill available space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className={sidebarCollapsed ? "p-1 space-y-1" : "p-2 space-y-0.5"}>
            {conversationsQuery.data?.map((conv: any) => (
              sidebarCollapsed ? (
                <Tooltip key={conv.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${
                        conv.id === conversationId ? "bg-accent/10 text-accent" : "hover:bg-secondary/50 text-muted-foreground"
                      }`}
                      onClick={() => { setConversationId(conv.id); navigate(`/chat/${conv.id}`); setSidebarOpen(false); }}
                    >
                      <MessageSquare className="w-4 h-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{conv.title || "New Conversation"}</TooltipContent>
                </Tooltip>
              ) : (
                <div
                  key={conv.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                    conv.id === conversationId ? "bg-accent/10 text-accent" : "hover:bg-secondary/50 text-foreground"
                  }`}
                  onClick={() => { setConversationId(conv.id); navigate(`/chat/${conv.id}`); setSidebarOpen(false); }}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                  <span className="truncate flex-1">{conv.title || "New Conversation"}</span>
                  <button
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.id); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )
            ))}
            {conversationsQuery.isLoading && (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            )}
          </div>
        </div>

        {/* Compact navigation — collapsible sections to preserve conversation space */}
        <div className="border-t border-border shrink-0 max-h-[45%] overflow-y-auto">
          {sidebarCollapsed ? (
            <div className="p-1 space-y-1">
              {toolsNav.filter(item => hasMinRole(userRole, item.minRole)).slice(0, 6).map(item => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                      className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {item.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))}
              <Separator className="mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                    className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Fingerprint className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <button
                onClick={() => setToolsExpanded(!toolsExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium hover:text-muted-foreground transition-colors"
              >
                <span>Tools</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${toolsExpanded ? "rotate-180" : ""}`} />
              </button>
              {toolsExpanded && (
                <div className="px-1 pb-1 grid grid-cols-2 gap-0.5">
                  {toolsNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
                    <button
                      key={item.href}
                      onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {item.icon} <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {adminNav.filter(item => hasMinRole(userRole, item.minRole)).length > 0 && (
                <>
                  <button
                    onClick={() => setAdminExpanded(!adminExpanded)}
                    className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium hover:text-muted-foreground transition-colors"
                  >
                    <span>Admin</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${adminExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {adminExpanded && (
                    <div className="px-1 pb-1">
                      {adminNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
                        <button
                          key={item.href}
                          onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="px-1 pb-1">
                <button
                  onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                >
                  <Fingerprint className="w-3.5 h-3.5" /> Settings
                </button>
              </div>
            </>
          )}
          <Separator className="mx-2" />
          <div className={`flex items-center ${sidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"}`}>
            {sidebarCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent cursor-pointer" onClick={() => setSidebarCollapsed(false)}>
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">{user?.name || "User"} — Click to expand</TooltipContent>
              </Tooltip>
            ) : (
              <>
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent">
                  {user?.name?.charAt(0)?.toUpperCase() || "U"}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs truncate block">{user?.name || "User"}</span>
                  <span className="text-[10px] text-muted-foreground capitalize">{userRole}</span>
                </div>
                <button onClick={() => setSidebarCollapsed(true)} className="text-muted-foreground hover:text-foreground" title="Collapse sidebar">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only sidebar toggle */}
        <div className="lg:hidden flex items-center h-10 px-3 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
        </div>

        {/* ─── LIVE SESSION ──────────────────────────────────── */}
        {liveSessionActive && (
          <div className="px-4 py-3 border-b border-border">
            <LiveSession
              conversationId={conversationId}
              onConversationCreated={(id) => {
                setConversationId(id);
                navigate(`/chat/${id}`, { replace: true });
                utils.conversations.list.invalidate();
              }}
              focus={focusSerialized}
              mode={mode}
              onEnd={() => setLiveSessionActive(false)}
            />
          </div>
        )}

        {/* ─── MESSAGES AREA ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isWelcome ? (
            <WelcomeScreen
              avatarUrl={avatarUrl}
              userName={user?.name}
              selectedFocus={selectedFocus}
              hasConversations={!!conversationsQuery.data?.length}
              ttsEnabled={ttsEnabled}
              onPromptClick={(text) => { setInput(text); textareaRef.current?.focus(); }}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg: any, i: number) => (
                <div key={msg.id || i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5 ${tts.isSpeaking && i === messages.length - 1 ? "avatar-talking" : ""} ${avatarUrl ? "" : "bg-accent/10"}`}>
                      {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                    </div>
                  )}
                  <div className={`max-w-[85%]`}>
                    {msg.role === "user" ? (
                      <div className="bg-accent/15 rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="prose-chat text-sm">
                          <ProgressiveMessage
                            content={msg.content}
                            isLatest={i === messages.length - 1}
                            threshold={300}
                          />
                          {/* Render inline images if present in metadata */}
                          {msg.metadata?.imageUrl && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-border max-w-md">
                              <img src={msg.metadata.imageUrl} alt="AI generated visual" className="w-full h-auto" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {msg.confidenceScore != null && (
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${
                              msg.confidenceScore >= 0.8 ? "bg-green-500/10 text-green-400" :
                              msg.confidenceScore >= 0.6 ? "bg-yellow-500/10 text-yellow-400" :
                              "bg-red-500/10 text-red-400"
                            }`}>
                              {msg.confidenceScore >= 0.8 ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {Math.round(msg.confidenceScore * 100)}%
                              {msg.complianceStatus === "flagged" && <span className="text-red-400 ml-1">Review</span>}
                            </span>
                          )}
                          {msg.id && (
                            <div className="flex items-center gap-0.5">
                              <button className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-green-400 transition-colors" onClick={() => handleFeedback(msg.id, "up")}>
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors" onClick={() => handleFeedback(msg.id, "down")}>
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => tts.speak(msg.content)}>
                                <Volume2 className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied to clipboard"); }}>
                                <FileText className="w-3 h-3" />
                              </button>
                              <button className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-purple-400 transition-colors" onClick={async () => { toast.info("Generating infographic..."); try { const result = await visualMutation.mutateAsync({ prompt: `Create a professional infographic summarizing: ${msg.content.slice(0, 500)}` }); if (result.url) { setMessages(prev => [...prev, { role: "assistant" as const, content: `Here's the infographic:`, metadata: { imageUrl: result.url }, createdAt: new Date() }]); } } catch (e: any) { toast.error(e.message || "Failed to generate infographic"); } }} title="Generate Infographic">
                                <Palette className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}

              {isStreaming && (
                <div className="flex gap-3">
                  <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${avatarUrl ? "" : "bg-accent/10"}`}>
                    {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                  </div>
                </div>
              )}
              {/* Upgrade prompt for anonymous users */}
              {isAnonymous && anonChat.shouldPromptUpgrade && (
                <div className="px-4 py-3">
                  <UpgradePrompt
                    targetTier="email"
                    conversationCount={anonChat.conversations.length}
                    messageCount={anonChat.totalMessages}
                    compact
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Hands-free status bar with VoiceOrb */}
        {handsFreeActive && (
          <div className="flex items-center justify-center gap-3 py-2.5 bg-accent/5 border-t border-accent/20 transition-all">
            <VoiceOrb state={voiceState} size={32} />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-muted-foreground font-medium">
                {voiceState === "speaking" ? "Speaking..." : voiceState === "listening" ? "Listening..." : voiceState === "processing" ? "Thinking..." : "Ready — speak anytime"}
              </span>
              {voiceState === "listening" && voice.interimText && (
                <span className="text-[11px] text-foreground/50 italic max-w-[250px] truncate">
                  "{voice.interimText}"
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs h-6 shrink-0" onClick={toggleHandsFree}>End</Button>
          </div>
        )}

        {/* ─── INPUT AREA (Copilot-style condensed) ────────────── */}
        <div className="p-3 sm:p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1 text-xs">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml" onChange={handleFileSelect} />
            <input ref={imageInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handleFileSelect} />

            {/* Textarea — full width, rounded pill */}
            <div className="relative bg-secondary/30 rounded-2xl border border-border focus-within:border-accent/40 focus-within:shadow-[0_0_0_1px_oklch(0.68_0.16_230_/_0.15)] transition-all px-3 py-1.5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={handsFreeActive && voice.isListening ? "Listening..." : "Ask Steward anything..."}
                className="w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-[160px] text-sm py-2 px-0"
                rows={1}
                disabled={isStreaming}
              />
            </div>

            {/* Action bar below textarea — Copilot style: [+] [Mode v] ... [Audio] [hands-free/send] */}
            <div className="flex items-center gap-1.5 mt-1.5">
              {/* + Add context button */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={`p-1.5 rounded-full transition-all ${
                        showAddMenu ? "bg-accent/20 text-accent rotate-45" : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setShowAddMenu(!showAddMenu)}
                    >
                      <Plus className="w-4 h-4 transition-transform" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Add context</TooltipContent>
                </Tooltip>

                {showAddMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 w-48 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <button
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs hover:bg-secondary/60 transition-colors"
                        onClick={() => { fileInputRef.current?.click(); setShowAddMenu(false); }}
                      >
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Attach file</span>
                      </button>
                      <button
                        className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs hover:bg-secondary/60 transition-colors"
                        onClick={() => { imageInputRef.current?.click(); setShowAddMenu(false); }}
                      >
                        <Image className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Attach image</span>
                      </button>
                      <button
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs hover:bg-secondary/60 transition-colors ${visualMutation.isPending ? "opacity-50" : ""}`}
                        disabled={visualMutation.isPending}
                        onClick={async () => {
                          setShowAddMenu(false);
                          const prompt = input.trim();
                          if (!prompt) { toast.info("Type a description first, then generate a visual"); return; }
                          try {
                            const result = await visualMutation.mutateAsync({ prompt: `Create a clear, professional visual: ${prompt}` });
                            if (result.url) {
                              const imgMsg = { role: "assistant" as const, content: `Here's the visual I created for: **${prompt}**`, metadata: { imageUrl: result.url }, createdAt: new Date() };
                              setMessages(prev => [...prev, { role: "user" as const, content: `Generate visual: ${prompt}`, createdAt: new Date() }, imgMsg]);
                              setInput("");
                            }
                          } catch (e: any) { toast.error(e.message || "Failed to generate visual"); }
                        }}
                      >
                        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{visualMutation.isPending ? "Generating..." : "Generate visual"}</span>
                      </button>
                      <div className="h-px bg-border my-0.5" />
                      <button
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                          liveSessionActive ? "bg-red-500/10 text-red-400" : "hover:bg-secondary/60"
                        }`}
                        onClick={() => { setLiveSessionActive(!liveSessionActive); setShowAddMenu(false); }}
                      >
                        <Video className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{liveSessionActive ? "End live session" : "Go live (camera / screen)"}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Mode dropdown — Copilot "Smart v" style */}
              <div className="relative">
                <button
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-secondary/40 text-foreground hover:bg-secondary/60 border border-border transition-all"
                  onClick={() => setShowModeMenu(!showModeMenu)}
                >
                  {FOCUS_OPTIONS.find(o => selectedFocus.includes(o.value))?.icon || <Sparkles className="w-3 h-3" />}
                  {FOCUS_OPTIONS.find(o => selectedFocus.includes(o.value))?.label || "General"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showModeMenu ? "rotate-180" : ""}`} />
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 w-52 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Focus</div>
                      {FOCUS_OPTIONS.map(opt => (
                        <button
                          key={opt.value}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            selectedFocus.includes(opt.value) ? "bg-accent/15 text-accent" : "hover:bg-secondary/60"
                          }`}
                          onClick={() => { toggleFocus(opt.value); setShowModeMenu(false); }}
                        >
                          {opt.icon}
                          {opt.label}
                          {selectedFocus.includes(opt.value) && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                      ))}
                      {showModes && (
                        <>
                          <div className="h-px bg-border my-1" />
                          <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Advisory Mode</div>
                          {availableModes.map(opt => (
                            <button
                              key={opt.value}
                              className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                mode === opt.value ? "bg-accent/15 text-accent" : "hover:bg-secondary/60"
                              }`}
                              onClick={() => { setMode(opt.value); setShowModeMenu(false); }}
                            >
                              {opt.label}
                              {mode === opt.value && <Check className="w-3 h-3 ml-auto" />}
                            </button>
                          ))}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Spacer pushes right-side buttons to far right */}
              <div className="flex-1" />

              {/* Audio toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`p-1.5 rounded-full transition-all ${
                      ttsEnabled
                        ? "bg-accent/15 text-accent"
                        : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => { setTtsEnabled(!ttsEnabled); tts.cancel(); }}
                  >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{ttsEnabled ? "Mute audio" : "Enable audio"}</TooltipContent>
              </Tooltip>

              {/* Unified hands-free / send button (rightmost, same position always) */}
              {isStreaming ? (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all"
                  disabled
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                </Button>
              ) : (input.trim() || attachments.length > 0) ? (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all"
                  onClick={handleSend}
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
              ) : handsFreeActive ? (
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse transition-all"
                  onClick={toggleHandsFree}
                >
                  <PhoneOff className="w-4 h-4" />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all"
                      onClick={toggleHandsFree}
                    >
                      <AudioLines className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Start hands-free voice</TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </main>


    </div>
  );
}
