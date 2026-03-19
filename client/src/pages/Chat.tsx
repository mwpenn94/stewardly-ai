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
  AlertTriangle, ArrowUp, BarChart3, Bot, Briefcase, Building2, Calculator, Check, CheckCircle,
  ChevronDown, FileText, Image, Loader2, LogOut, Menu, MessageSquare,
  Mic, MicOff, Monitor, Package, Paperclip, Phone, PhoneOff, Plus,
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

const SUGGESTED_PROMPTS = [
  { text: "Help me think through a career decision", icon: "💡", category: "general" },
  { text: "Analyze my retirement readiness", icon: "📊", category: "financial" },
  { text: "What should I know about IUL policies?", icon: "🛡️", category: "financial" },
  { text: "Help me plan my week effectively", icon: "📋", category: "general" },
  { text: "Compare term vs whole life insurance", icon: "⚖️", category: "financial" },
  { text: "Help me write a professional email", icon: "✉️", category: "general" },
];

// Role hierarchy for access checks
const ROLE_HIERARCHY: Record<UserRole, number> = { user: 0, advisor: 1, manager: 2, admin: 3 };
function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole as UserRole ?? "user"] >= ROLE_HIERARCHY[minRole];
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

  // ─── ENHANCED TTS ─────────────────────────────────────────────
  const tts = useTTS({
    enabled: ttsEnabled,
    rate: 1.0,
    onStart: () => {},
    onEnd: () => {
      // In hands-free mode, restart listening after TTS completes
      if (handsFreeActive) {
        setTimeout(() => voice.start(), 600);
      }
    },
  });

  // ─── ENHANCED VOICE RECOGNITION ───────────────────────────────
  const voice = useVoiceRecognition({
    enabled: handsFreeActive,
    silenceTimeout: 1500,
    lang: "en-US",
    onTranscript: (text) => {
      // Auto-send in hands-free mode
      handleSendRef.current(text);
    },
    onInterim: (text) => {
      if (handsFreeActive) setInput(text);
    },
    guardRef: tts.guardRef,
  });

  // Derive voice state for UI
  const voiceState: "idle" | "listening" | "processing" | "speaking" = 
    tts.isSpeaking ? "speaking" : 
    voice.isListening ? "listening" : 
    isStreaming ? "processing" : "idle";

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
    }
  };;

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
  // Condensed sidebar groups
  const toolsNav = [
    { icon: <Calculator className="w-3.5 h-3.5" />, label: "Calculators", href: "/calculators", minRole: "user" as UserRole },
    { icon: <Package className="w-3.5 h-3.5" />, label: "Products", href: "/products", minRole: "user" as UserRole },
    { icon: <Calendar className="w-3.5 h-3.5" />, label: "Meetings", href: "/meetings", minRole: "user" as UserRole },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Insights", href: "/insights", minRole: "user" as UserRole },
    { icon: <DollarSign className="w-3.5 h-3.5" />, label: "Planning", href: "/planning", minRole: "user" as UserRole },
    { icon: <Brain className="w-3.5 h-3.5" />, label: "Coach", href: "/coach", minRole: "user" as UserRole },
    { icon: <Shield className="w-3.5 h-3.5" />, label: "Compliance", href: "/compliance", minRole: "user" as UserRole },
    { icon: <Users className="w-3.5 h-3.5" />, label: "Marketplace", href: "/marketplace", minRole: "user" as UserRole },
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
        fixed lg:relative z-50 h-full w-72 bg-card border-r border-border flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-3 flex items-center justify-between border-b border-border shrink-0">
          <Button variant="ghost" size="sm" className="gap-2 text-xs flex-1 justify-start" onClick={handleNewConversation}>
            <Plus className="w-3.5 h-3.5" /> New Conversation
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Scrollable conversation list — grows to fill available space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-2 space-y-0.5">
            {conversationsQuery.data?.map((conv: any) => (
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
            ))}
            {conversationsQuery.isLoading && (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            )}
          </div>
        </div>

        {/* Fixed navigation options — always visible at bottom */}
        <div className="border-t border-border p-2 shrink-0">
          {/* Tools section */}
          <p className="px-3 pt-1 pb-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Tools</p>
          {toolsNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
            <button
              key={item.href}
              onClick={() => { navigate(item.href); setSidebarOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
            >
              {item.icon} {item.label}
            </button>
          ))}
          {/* Admin section — only visible to managers+ */}
          {adminNav.filter(item => hasMinRole(userRole, item.minRole)).length > 0 && (
            <>
              <p className="px-3 pt-2 pb-0.5 text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">Admin</p>
              {adminNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
                <button
                  key={item.href}
                  onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </>
          )}
          {/* Settings — single entry */}
          <button
            onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
          >
            <Fingerprint className="w-3.5 h-3.5" /> Settings
          </button>
          <Separator className="my-1" />
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs truncate block">{user?.name || "User"}</span>
              <span className="text-[10px] text-muted-foreground capitalize">{userRole}</span>
            </div>
            <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium hidden sm:inline">Financial Intelligence</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Focus selector (always visible) + Mode selector (role-gated) */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8" onClick={() => setShowFocusPicker(!showFocusPicker)}>
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{focusLabel}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
              {showFocusPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFocusPicker(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-1 w-56">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Focus</p>
                    {FOCUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedFocus.includes(opt.value) ? "bg-accent/10 text-accent" : "hover:bg-secondary/50"
                        }`}
                        onClick={() => toggleFocus(opt.value)}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                          selectedFocus.includes(opt.value) ? "bg-accent border-accent text-white" : "border-muted-foreground/40"
                        }`}>
                          {selectedFocus.includes(opt.value) && <Check className="w-2.5 h-2.5" />}
                        </div>
                        {opt.icon}
                        <div className="text-left">
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                        </div>
                      </button>
                    ))}

                    {/* Mode section — only visible to advisor+ roles */}
                    {showModes && (
                      <>
                        <Separator className="my-1" />
                        <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Advisory Mode</p>
                        {availableModes.map(opt => (
                          <button
                            key={opt.value}
                            className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors ${
                              mode === opt.value ? "bg-accent/10 text-accent" : "hover:bg-secondary/50"
                            }`}
                            onClick={() => { setMode(opt.value); setShowFocusPicker(false); }}
                          >
                            <div className="text-left">
                              <div className="font-medium">{opt.label}</div>
                              <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                            </div>
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Hands-free toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={handsFreeActive ? "default" : "ghost"}
                  size="icon"
                  className={`h-8 w-8 ${handsFreeActive ? "bg-accent text-accent-foreground" : ""}`}
                  onClick={toggleHandsFree}
                >
                  {handsFreeActive ? <PhoneOff className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{handsFreeActive ? "End hands-free" : "Start hands-free conversation"}</TooltipContent>
            </Tooltip>

            {/* Audio playback toggle (default ON) */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                  setTtsEnabled(!ttsEnabled);
                  tts.cancel();
                }}>
                  {ttsEnabled ? <Volume2 className="w-4 h-4 text-accent" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{ttsEnabled ? "Mute audio responses" : "Enable audio responses"}</TooltipContent>
            </Tooltip>
          </div>
        </header>

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
            <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
              <div className="max-w-2xl w-full text-center">
                {avatarUrl ? (
                  <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-5 ring-2 ring-accent/20">
                    <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                    <Sparkles className="w-7 h-7 text-accent" />
                  </div>
                )}
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">
                  Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8 max-w-lg mx-auto">
                  I'm your AI assistant. Ask me anything — from general questions to financial planning, or switch to Study and learn mode to review documents and data.
                  I adapt to your preferences over time.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {SUGGESTED_PROMPTS.filter(p => selectedFocus.length === FOCUS_OPTIONS.length || selectedFocus.includes(p.category as FocusMode)).slice(0, 4).map((prompt, i) => (
                    <button
                      key={i}
                      className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-accent/30 transition-all text-left text-sm"
                      onClick={() => { setInput(prompt.text); textareaRef.current?.focus(); }}
                    >
                      <span className="text-accent shrink-0">{prompt.icon}</span>
                      <span className="text-foreground/80 text-xs leading-snug">{prompt.text}</span>
                    </button>
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground mt-6">
                  Press <Phone className="w-3 h-3 inline" /> for hands-free voice &middot; <Volume2 className="w-3 h-3 inline" /> audio is {ttsEnabled ? "on" : "off"}
                </p>
              </div>
            </div>
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
          <div className="flex items-center justify-center gap-3 py-2.5 bg-accent/5 border-t border-accent/20">
            <VoiceOrb state={voiceState} size={32} />
            <span className="text-xs text-muted-foreground">
              {voiceState === "speaking" ? "Speaking..." : voiceState === "listening" ? "Listening..." : voiceState === "processing" ? "Thinking..." : "Ready — speak anytime"}
            </span>
            {voice.interimText && (
              <span className="text-xs text-foreground/60 italic max-w-[200px] truncate">
                "{voice.interimText}"
              </span>
            )}
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={toggleHandsFree}>End</Button>
          </div>
        )}

        {/* ─── INPUT AREA ─────────────────────────────────────── */}
        <div className="border-t border-border p-3 sm:p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/50 rounded-lg px-2.5 py-1 text-xs">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="relative flex items-end gap-2 bg-secondary/30 rounded-2xl border border-border focus-within:border-accent/40 transition-colors p-2">
              <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml" onChange={handleFileSelect} />
                <input ref={imageInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handleFileSelect} />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Attach files</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors" onClick={() => imageInputRef.current?.click()}>
                      <Image className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Attach image</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={`p-1.5 rounded-lg transition-colors ${visualMutation.isPending ? "bg-accent/20 text-accent" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"}`}
                      onClick={async () => {
                        const prompt = input.trim();
                        if (!prompt) { toast.info("Type a description for the visual you want to generate"); return; }
                        try {
                          const result = await visualMutation.mutateAsync({ prompt: `Create a clear, professional visual: ${prompt}` });
                          if (result.url) {
                            const imgMsg = { role: "assistant" as const, content: `Here's the visual I created for: **${prompt}**`, metadata: { imageUrl: result.url }, createdAt: new Date() };
                            setMessages(prev => [...prev, { role: "user" as const, content: `Generate visual: ${prompt}`, createdAt: new Date() }, imgMsg]);
                            setInput("");
                          }
                        } catch (e: any) { toast.error(e.message || "Failed to generate visual"); }
                      }}
                      disabled={visualMutation.isPending}
                    >
                      {visualMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Generate visual / chart</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={`p-1.5 rounded-lg transition-colors hidden sm:flex items-center gap-1 ${
                        liveSessionActive ? "bg-red-500/20 text-red-400" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setLiveSessionActive(!liveSessionActive)}
                    >
                      <Video className="w-4 h-4" />
                      {liveSessionActive && <span className="text-[10px] font-medium">LIVE</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{liveSessionActive ? "End live session" : "Go Live — camera or screen with voice"}</TooltipContent>
                </Tooltip>
              </div>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={handsFreeActive && voice.isListening ? "Listening..." : "Ask anything..."}
                className="flex-1 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[40px] max-h-[160px] text-sm py-2 px-1"
                rows={1}
                disabled={isStreaming}
              />

              <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
                {!handsFreeActive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className={`p-1.5 rounded-lg transition-colors ${
                          voice.isListening ? "bg-red-500/20 text-red-400" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={voice.isListening ? voice.stop : voice.start}
                      >
                        {voice.isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{voice.isListening ? "Stop listening" : "Voice input"}</TooltipContent>
                  </Tooltip>
                )}

                <Button
                  size="icon"
                  className="h-8 w-8 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"
                  disabled={(!input.trim() && attachments.length === 0) || isStreaming}
                  onClick={handleSend}
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground text-center mt-2">
              AI responses may contain errors. Verify important information independently.
            </p>
          </div>
        </div>
      </main>


    </div>
  );
}
