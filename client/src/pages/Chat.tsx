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
  ArrowUp, Bot, Calculator, ChevronDown, FileText, Globe,
  DollarSign, Brain, Loader2, LogOut, Mic, MicOff, MessageSquare,
  Paperclip, Plus, Settings, Shield, Sparkles, ThumbsUp, ThumbsDown,
  Trash2, User, BarChart3, Image, Video, Monitor, Package,
  Menu, X, Volume2, VolumeX, Phone, PhoneOff, AlertTriangle, CheckCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { Streamdown } from "streamdown";
import { toast } from "sonner";
import type { FocusMode, AdvisoryMode } from "@shared/types";

const FOCUS_OPTIONS: { value: FocusMode; icon: React.ReactNode; label: string; desc: string }[] = [
  { value: "both", icon: <Brain className="w-4 h-4" />, label: "Both", desc: "General + Financial" },
  { value: "general", icon: <Globe className="w-4 h-4" />, label: "General", desc: "Any topic" },
  { value: "financial", icon: <DollarSign className="w-4 h-4" />, label: "Financial", desc: "Expert advice" },
];

const MODE_OPTIONS: { value: AdvisoryMode; label: string; desc: string }[] = [
  { value: "client", label: "Client Advisor", desc: "Clear, accessible guidance" },
  { value: "coach", label: "Professional Coach", desc: "Industry-level strategy" },
  { value: "manager", label: "Manager Brief", desc: "High-level summaries" },
];

const SUGGESTED_PROMPTS = [
  { icon: <Brain className="w-4 h-4" />, text: "Help me think through a complex decision", category: "general" as const },
  { icon: <DollarSign className="w-4 h-4" />, text: "Compare IUL vs whole life insurance for my situation", category: "financial" as const },
  { icon: <Calculator className="w-4 h-4" />, text: "Walk me through a retirement projection", category: "financial" as const },
  { icon: <Globe className="w-4 h-4" />, text: "Explain a technical concept in simple terms", category: "general" as const },
  { icon: <Shield className="w-4 h-4" />, text: "Review my financial suitability profile", category: "financial" as const },
  { icon: <Sparkles className="w-4 h-4" />, text: "Help me draft a professional communication", category: "general" as const },
];

export default function Chat() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [matchChat, paramsChat] = useRoute("/chat/:id");
  const utils = trpc.useUtils();

  // State
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<number | null>(
    matchChat && paramsChat?.id ? parseInt(paramsChat.id) : null
  );
  const [focus, setFocus] = useState<FocusMode>("both");
  const [mode, setMode] = useState<AdvisoryMode>("client");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);

  // Hands-free
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const recognitionRef = useRef<any>(null);
  const handsFreeRef = useRef(false);
  const inputBufferRef = useRef("");

  // Attachments
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep handsFreeRef in sync
  useEffect(() => { handsFreeRef.current = handsFreeActive; }, [handsFreeActive]);

  // Queries
  const conversationsQuery = trpc.conversations.list.useQuery(undefined, { enabled: isAuthenticated });
  const messagesQuery = trpc.conversations.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId && isAuthenticated }
  );

  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const avatarUrl = settingsQuery.data?.avatarUrl || null;

  const sendMutation = trpc.chat.send.useMutation();
  const createConversation = trpc.conversations.create.useMutation();
  const deleteConversation = trpc.conversations.delete.useMutation();
  const feedbackMutation = trpc.feedback.submit.useMutation();

  // Update conversationId when route changes
  useEffect(() => {
    if (matchChat && paramsChat?.id) {
      setConversationId(parseInt(paramsChat.id));
    }
  }, [matchChat, paramsChat?.id]);

  // Load messages when conversation changes
  useEffect(() => {
    if (messagesQuery.data && conversationId) {
      setMessages(messagesQuery.data.map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        confidenceScore: m.confidenceScore,
        complianceStatus: m.complianceStatus,
        createdAt: m.createdAt,
      })));
    }
  }, [messagesQuery.data, conversationId]);

  // Clear messages when no conversation
  useEffect(() => {
    if (!conversationId) setMessages([]);
  }, [conversationId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isStreaming]);

  // TTS
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const stripped = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/\n+/g, ". ").slice(0, 3000);
    const utterance = new SpeechSynthesisUtterance(stripped);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      setIsSpeaking(false);
      // In hands-free mode, start listening again after speaking
      if (handsFreeRef.current) {
        setTimeout(() => startListeningInternal(), 400);
      }
    };
    window.speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  // Speech Recognition
  const startListeningInternal = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }
    try {
      recognitionRef.current?.abort();
    } catch {}
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalTranscript = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      inputBufferRef.current = (finalTranscript + interim).trim();
      setInput(inputBufferRef.current);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => {
      setIsListening(false);
      const text = inputBufferRef.current.trim();
      if (handsFreeRef.current && text) {
        // Auto-send in hands-free mode
        inputBufferRef.current = "";
        handleSendDirect(text);
      }
    };
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, []);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setIsListening(false);
  }, []);

  const toggleHandsFree = useCallback(() => {
    if (handsFreeActive) {
      setHandsFreeActive(false);
      stopListening();
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
    } else {
      setHandsFreeActive(true);
      startListeningInternal();
    }
  }, [handsFreeActive, startListeningInternal, stopListening]);

  // Send message (direct, for hands-free auto-send)
  const handleSendDirect = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;
    setIsStreaming(true);
    setInput("");
    const userMsg = { role: "user" as const, content: text, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);

    try {
      let convId = conversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({ mode, title: text.slice(0, 60) });
        convId = conv.id;
        setConversationId(convId);
        navigate(`/chat/${convId}`, { replace: true });
      }
      const result = await sendMutation.mutateAsync({ conversationId: convId, content: text, focus, mode });
      const assistantMsg = {
        id: result.id,
        role: "assistant" as const,
        content: result.content,
        confidenceScore: result.confidenceScore,
        complianceStatus: result.complianceStatus,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      utils.conversations.list.invalidate();
      // Speak response in hands-free mode
      if (handsFreeRef.current) speak(result.content);
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  }, [conversationId, focus, mode, isStreaming, speak]);

  // Send message (from input)
  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    setAttachments([]);
    handleSendDirect(text);
  }, [input, attachments, handleSendDirect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (idx: number) => setAttachments(prev => prev.filter((_, i) => i !== idx));

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

  // Auth gate
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background px-4">
        <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-6">
          <Sparkles className="w-7 h-7 text-accent" />
        </div>
        <h1 className="text-2xl font-semibold mb-2">Your Personal AI</h1>
        <p className="text-muted-foreground text-sm mb-6 text-center max-w-md">
          An intelligent assistant that learns your style, knows your documents, and combines general knowledge with financial expertise.
        </p>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => window.location.href = getLoginUrl()}>
          Sign In to Get Started
        </Button>
      </div>
    );
  }

  const isWelcome = messages.length === 0 && !conversationId;
  const currentFocus = FOCUS_OPTIONS.find(f => f.value === focus)!;

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:relative z-50 h-full w-72 bg-card border-r border-border flex flex-col
        transition-transform duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <div className="p-3 flex items-center justify-between border-b border-border">
          <Button variant="ghost" size="sm" className="gap-2 text-xs flex-1 justify-start" onClick={handleNewConversation}>
            <Plus className="w-3.5 h-3.5" /> New Conversation
          </Button>
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
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
        </ScrollArea>

        <div className="border-t border-border p-2 space-y-0.5">
          {[
            { icon: <Calculator className="w-3.5 h-3.5" />, label: "Calculators", href: "/calculators" },
            { icon: <FileText className="w-3.5 h-3.5" />, label: "Knowledge Base", href: "/documents" },
            { icon: <Package className="w-3.5 h-3.5" />, label: "Products", href: "/products" },
            { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Market Data", href: "/market" },
            { icon: <Shield className="w-3.5 h-3.5" />, label: "Suitability", href: "/suitability" },
            { icon: <Settings className="w-3.5 h-3.5" />, label: "Settings", href: "/settings" },
          ].map(item => (
            <button
              key={item.href}
              onClick={() => { navigate(item.href); setSidebarOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
            >
              {item.icon} {item.label}
            </button>
          ))}
          {user?.role === "admin" && (
            <button
              onClick={() => { navigate("/manager"); setSidebarOpen(false); }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Manager Dashboard
            </button>
          )}
          <Separator className="my-1" />
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
              {user?.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <span className="text-xs truncate flex-1">{user?.name || "User"}</span>
            <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main chat area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-border flex items-center justify-between px-3 shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium hidden sm:inline">Personal AI</span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Focus + Mode selector */}
            <div className="relative">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5 h-8" onClick={() => setShowFocusPicker(!showFocusPicker)}>
                {currentFocus.icon}
                <span className="hidden sm:inline">{currentFocus.label}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>
              {showFocusPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFocusPicker(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-popover text-popover-foreground border border-border rounded-lg shadow-lg p-1 w-52">
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Focus</p>
                    {FOCUS_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={`flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs transition-colors ${
                          focus === opt.value ? "bg-accent/10 text-accent" : "hover:bg-secondary/50"
                        }`}
                        onClick={() => { setFocus(opt.value); setShowFocusPicker(false); }}
                      >
                        {opt.icon}
                        <div className="text-left">
                          <div className="font-medium">{opt.label}</div>
                          <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                        </div>
                      </button>
                    ))}
                    <Separator className="my-1" />
                    <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Mode</p>
                    {MODE_OPTIONS.map(opt => (
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

            {/* TTS toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setTtsEnabled(!ttsEnabled); window.speechSynthesis?.cancel(); }}>
                  {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{ttsEnabled ? "Mute voice" : "Enable voice"}</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto">
          {isWelcome ? (
            <div className="h-full flex flex-col items-center justify-center px-4 pb-32">
              <div className="max-w-2xl w-full text-center">
                <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-5">
                  <Sparkles className="w-7 h-7 text-accent" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-semibold mb-2">
                  Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base mb-8 max-w-lg mx-auto">
                  I'm your personal AI assistant. Ask me anything — from general questions to financial planning.
                  I learn from your documents and adapt to your preferences.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
                  {SUGGESTED_PROMPTS.filter(p => focus === "both" || p.category === focus).slice(0, 4).map((prompt, i) => (
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
                  Press the <Phone className="w-3 h-3 inline" /> button for hands-free voice conversation
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg: any, i: number) => (
                <div key={msg.id || i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5 ${isSpeaking && i === messages.length - 1 ? 'avatar-talking' : ''} ${avatarUrl ? '' : 'bg-accent/10'}`}>
                      {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                    </div>
                  )}
                  <div className={`max-w-[85%] ${msg.role === "user" ? "" : ""}`}>
                    {msg.role === "user" ? (
                      <div className="bg-accent/15 rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div>
                        <div className="prose-chat text-sm">
                          <Streamdown>{msg.content}</Streamdown>
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
                              {msg.complianceStatus === "flagged" && (
                                <span className="text-red-400 ml-1">Review</span>
                              )}
                            </span>
                          )}
                          {msg.id && (
                            <div className="flex items-center gap-0.5">
                              <button
                                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-green-400 transition-colors"
                                onClick={() => handleFeedback(msg.id, "up")}
                              >
                                <ThumbsUp className="w-3 h-3" />
                              </button>
                              <button
                                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors"
                                onClick={() => handleFeedback(msg.id, "down")}
                              >
                                <ThumbsDown className="w-3 h-3" />
                              </button>
                              {ttsEnabled && (
                                <button
                                  className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors"
                                  onClick={() => speak(msg.content)}
                                >
                                  <Volume2 className="w-3 h-3" />
                                </button>
                              )}
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
                  <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 ${avatarUrl ? '' : 'bg-accent/10'}`}>
                    {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                    <div className="w-1.5 h-1.5 rounded-full bg-accent typing-dot" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Hands-free status bar */}
        {handsFreeActive && (
          <div className="flex items-center justify-center gap-3 py-2 bg-accent/5 border-t border-accent/20">
            <div className={`w-2 h-2 rounded-full ${isListening ? "bg-red-400 animate-pulse" : isSpeaking ? "bg-accent animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-xs text-muted-foreground">
              {isListening ? "Listening..." : isSpeaking ? "Speaking..." : isStreaming ? "Thinking..." : "Hands-free active"}
            </span>
            <Button variant="ghost" size="sm" className="text-xs h-6" onClick={toggleHandsFree}>End</Button>
          </div>
        )}

        {/* Input area */}
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
                    <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors hidden sm:block" onClick={() => toast.info("Screen sharing coming soon")}>
                      <Monitor className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Share screen</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors hidden sm:block" onClick={() => toast.info("Video sharing coming soon")}>
                      <Video className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Share video</TooltipContent>
                </Tooltip>
              </div>

              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={handsFreeActive && isListening ? "Listening..." : "Ask anything..."}
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
                          isListening ? "bg-red-500/20 text-red-400" : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={isListening ? stopListening : startListeningInternal}
                      >
                        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{isListening ? "Stop listening" : "Voice input"}</TooltipContent>
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
