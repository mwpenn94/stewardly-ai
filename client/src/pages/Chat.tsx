import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { useLocation, useParams } from "wouter";
import {
  MessageSquare, Plus, Send, Mic, MicOff, Trash2, ThumbsUp, ThumbsDown,
  Menu, ArrowLeft, Brain, Briefcase, Users, Globe, DollarSign, Blend,
  Calculator, FileText, Shield, ChevronDown, Sparkles, Bot, User,
  Loader2, AlertTriangle, CheckCircle, Fingerprint, Settings,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import type { FocusMode, AdvisoryMode } from "@shared/types";

const FOCUS_OPTIONS: { value: FocusMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "both", label: "Both", icon: <Blend className="w-3.5 h-3.5" />, desc: "General + Financial" },
  { value: "general", label: "General", icon: <Globe className="w-3.5 h-3.5" />, desc: "General knowledge" },
  { value: "financial", label: "Financial", icon: <DollarSign className="w-3.5 h-3.5" />, desc: "Financial expertise" },
];

const MODE_OPTIONS: { value: AdvisoryMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "client", label: "Client Advisor", icon: <Users className="w-3.5 h-3.5" />, desc: "Clear, accessible" },
  { value: "coach", label: "Pro Coach", icon: <Briefcase className="w-3.5 h-3.5" />, desc: "Industry-level" },
  { value: "manager", label: "Manager", icon: <Brain className="w-3.5 h-3.5" />, desc: "Strategic briefing" },
];

function ConfidenceBadge({ score, status }: { score?: number | null; status?: string | null }) {
  if (!score) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 85 ? "text-emerald-400" : pct >= 60 ? "text-amber-400" : "text-red-400";
  const icon = pct >= 85 ? <CheckCircle className="w-3 h-3" /> : pct >= 60 ? <AlertTriangle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 text-xs ${color}`}>
          {icon} {pct}%
          {status === "flagged" && <Badge variant="destructive" className="text-[10px] px-1 py-0">Review</Badge>}
        </span>
      </TooltipTrigger>
      <TooltipContent>Confidence: {pct}% | Compliance: {status || "approved"}</TooltipContent>
    </Tooltip>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <Bot className="w-4 h-4 text-accent mr-2" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/60" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/60" />
      <span className="typing-dot w-1.5 h-1.5 rounded-full bg-accent/60" />
    </div>
  );
}

export default function Chat() {
  const { user, loading: authLoading } = useAuth({ redirectOnUnauthenticated: true });
  const [, navigate] = useLocation();
  const params = useParams<{ id?: string }>();
  const conversationId = params.id ? parseInt(params.id) : null;

  const [input, setInput] = useState("");
  const [focus, setFocus] = useState<FocusMode>("both");
  const [mode, setMode] = useState<AdvisoryMode>("client");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const utils = trpc.useUtils();
  const convList = trpc.conversations.list.useQuery(undefined, { enabled: !!user });
  const convMessages = trpc.conversations.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId, refetchInterval: false }
  );

  const createConv = trpc.conversations.create.useMutation({
    onSuccess: (data) => {
      utils.conversations.list.invalidate();
      navigate(`/chat/${data.id}`);
    },
  });

  const deleteConv = trpc.conversations.delete.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      navigate("/chat");
    },
  });

  const sendMessage = trpc.chat.send.useMutation({
    onSuccess: () => {
      utils.conversations.messages.invalidate({ conversationId: conversationId! });
      utils.conversations.list.invalidate();
      setIsSending(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setIsSending(false);
    },
  });

  const submitFeedback = trpc.feedback.submit.useMutation({
    onSuccess: () => toast.success("Feedback recorded"),
  });

  const uploadAudio = trpc.voice.uploadAudio.useMutation();
  const transcribe = trpc.voice.transcribe.useMutation();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [convMessages.data, isSending, scrollToBottom]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isSending) return;
    let activeConvId = conversationId;
    if (!activeConvId) {
      try {
        const newConv = await createConv.mutateAsync({ mode, title: input.substring(0, 50) });
        activeConvId = newConv.id;
      } catch { return; }
    }
    setIsSending(true);
    const msg = input;
    setInput("");
    sendMessage.mutate({ conversationId: activeConvId!, content: msg, mode, focus });
  }, [input, isSending, conversationId, mode, focus, createConv, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleVoice = useCallback(async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 16 * 1024 * 1024) { toast.error("Recording too large (max 16MB)"); return; }
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64 = (reader.result as string).split(",")[1];
            const { url } = await uploadAudio.mutateAsync({ content: base64, mimeType: "audio/webm" });
            const result = await transcribe.mutateAsync({ audioUrl: url, language: "en" });
            setInput(prev => prev + (prev ? " " : "") + result.text);
            inputRef.current?.focus();
          };
        } catch (err: any) { toast.error("Transcription failed: " + err.message); }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch { toast.error("Microphone access denied"); }
  }, [isRecording, uploadAudio, transcribe]);

  const currentFocus = useMemo(() => FOCUS_OPTIONS.find(f => f.value === focus)!, [focus]);
  const currentMode = useMemo(() => MODE_OPTIONS.find(m => m.value === mode)!, [mode]);
  const messages = convMessages.data || [];

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }

  const ConversationSidebar = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        <span className="font-semibold text-sm text-sidebar-foreground">Conversations</span>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => { createConv.mutate({ mode }); setSidebarOpen(false); }}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {convList.data?.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                conv.id === conversationId ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50 text-sidebar-foreground"
              }`}
              onClick={() => { navigate(`/chat/${conv.id}`); setSidebarOpen(false); }}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{conv.title || "New Conversation"}</span>
              <Button
                size="sm" variant="ghost"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); deleteConv.mutate({ id: conv.id }); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          ))}
          {(!convList.data || convList.data.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-8">No conversations yet</p>
          )}
        </div>
      </ScrollArea>
      <Separator className="bg-sidebar-border" />
      <div className="p-3 space-y-2">
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => navigate("/calculators")}>
          <Calculator className="w-4 h-4" /> Calculators
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => navigate("/documents")}>
          <FileText className="w-4 h-4" /> Documents
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => navigate("/suitability")}>
          <Shield className="w-4 h-4" /> Suitability
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => navigate("/settings")}>
          <Settings className="w-4 h-4" /> Settings
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex w-64 border-r border-border shrink-0">
        <ConversationSidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="p-0 w-72 bg-sidebar border-sidebar-border">
          <ConversationSidebar />
        </SheetContent>
      </Sheet>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>

          <div className="flex-1 flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-accent shrink-0" />
            <span className="font-medium text-sm truncate">
              {conversationId ? (convList.data?.find(c => c.id === conversationId)?.title || "Chat") : "New Chat"}
            </span>
          </div>

          {/* Focus mode selector */}
          <div className="relative">
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-xs bg-transparent border-border"
              onClick={() => { setShowFocusMenu(!showFocusMenu); setShowModeMenu(false); }}
            >
              {currentFocus.icon} {currentFocus.label} <ChevronDown className="w-3 h-3" />
            </Button>
            {showFocusMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-popover border border-border rounded-lg shadow-xl z-50 py-1">
                {FOCUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors ${focus === opt.value ? "text-accent" : "text-popover-foreground"}`}
                    onClick={() => { setFocus(opt.value); setShowFocusMenu(false); }}
                  >
                    {opt.icon} <span>{opt.label}</span> <span className="text-xs text-muted-foreground ml-auto">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Advisory mode selector */}
          <div className="relative hidden sm:block">
            <Button
              variant="outline" size="sm"
              className="h-8 gap-1.5 text-xs bg-transparent border-border"
              onClick={() => { setShowModeMenu(!showModeMenu); setShowFocusMenu(false); }}
            >
              {currentMode.icon} {currentMode.label} <ChevronDown className="w-3 h-3" />
            </Button>
            {showModeMenu && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-popover border border-border rounded-lg shadow-xl z-50 py-1">
                {MODE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors ${mode === opt.value ? "text-accent" : "text-popover-foreground"}`}
                    onClick={() => { setMode(opt.value); setShowModeMenu(false); }}
                  >
                    {opt.icon} <span>{opt.label}</span> <span className="text-xs text-muted-foreground ml-auto">{opt.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-1">
            {messages.length === 0 && !isSending && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                  <Sparkles className="w-8 h-8 text-accent" />
                </div>
                <h2 className="text-xl font-semibold mb-2">WealthBridge AI</h2>
                <p className="text-muted-foreground text-sm max-w-md mb-6">
                  Your digital twin — {focus === "general" ? "a general-purpose AI assistant" : focus === "financial" ? "a financial professional at your service" : "combining general intelligence with financial expertise"}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {[
                    focus !== "financial" && "What are the latest trends in AI?",
                    focus !== "general" && "Compare IUL vs whole life insurance",
                    focus !== "financial" && "Help me plan my weekly schedule",
                    focus !== "general" && "Run a retirement projection for me",
                  ].filter(Boolean).slice(0, 4).map((prompt, i) => (
                    <button
                      key={i}
                      className="text-left px-4 py-3 rounded-lg border border-border bg-card hover:bg-secondary transition-colors text-sm text-foreground"
                      onClick={() => setInput(prompt as string)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`animate-message-in flex gap-3 py-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-4 h-4 text-accent" />
                  </div>
                )}
                <div className={`max-w-[85%] ${msg.role === "user" ? "bg-secondary rounded-2xl rounded-br-md px-4 py-2.5" : "flex-1 min-w-0"}`}>
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="prose-chat">
                      <Streamdown>{msg.content}</Streamdown>
                    </div>
                  )}
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-2 mt-2">
                      <ConfidenceBadge score={msg.confidenceScore} status={msg.complianceStatus} />
                      <div className="flex items-center gap-0.5 ml-auto">
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-emerald-400"
                          onClick={() => msg.id && conversationId && submitFeedback.mutate({ messageId: msg.id, conversationId, rating: "up" })}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                          onClick={() => msg.id && conversationId && submitFeedback.mutate({ messageId: msg.id, conversationId, rating: "down" })}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isSending && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm px-4 py-3">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={focus === "general" ? "Ask me anything..." : focus === "financial" ? "Ask about finances, insurance, retirement..." : "Ask about anything — general or financial..."}
                  className="pr-10 bg-secondary border-border h-11 text-sm placeholder:text-muted-foreground"
                  disabled={isSending}
                />
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm" className="h-11 w-11 p-0 shrink-0"
                    onClick={handleVoice}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isRecording ? "Stop recording" : "Voice input"}</TooltipContent>
              </Tooltip>
              <Button
                size="sm" className="h-11 w-11 p-0 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={handleSend}
                disabled={!input.trim() || isSending}
              >
                {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              AI responses may contain errors. {focus !== "general" && "Financial guidance requires human advisor review."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
