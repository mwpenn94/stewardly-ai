import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { ArrowLeft, Shield, CheckCircle, Loader2, Sparkles, Send, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";

type ChatMessage = { role: "user" | "assistant"; content: string; buttons?: string[] };

const INITIAL_GREETING = "Hi! I'd love to learn a bit about your financial situation so I can personalize your experience. We'll keep this conversational — answer however feels natural, and you can stop anytime. Ready to get started?";
const INITIAL_BUTTONS = ["Let's go!", "Sure, keep it quick", "I'll just type freely"];

export default function Suitability() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const existing = trpc.suitability.get.useQuery();
  const chatMutation = trpc.suitability.chat.useMutation();
  const saveMutation = trpc.suitability.saveFromChat.useMutation({
    onSuccess: () => {
      utils.suitability.get.invalidate();
      toast.success("Suitability profile saved!");
    },
  });

  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: INITIAL_GREETING, buttons: INITIAL_BUTTONS },
  ]);
  const [input, setInput] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || chatMutation.isPending) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");

    try {
      const result = await chatMutation.mutateAsync({
        history: newHistory.map(m => ({ role: m.role, content: m.content })),
        userMessage: text.trim(),
      });

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.content,
        buttons: result.buttons.length > 0 ? result.buttons : undefined,
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (result.isComplete) {
        setIsComplete(true);
      }
    } catch (e: any) {
      toast.error("Something went wrong. Please try again.");
    }
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
    });
    setIsSaved(true);
  };

  const handleReset = () => {
    setMessages([{ role: "assistant", content: INITIAL_GREETING, buttons: INITIAL_BUTTONS }]);
    setIsComplete(false);
    setIsSaved(false);
  };

  // If already completed, show summary
  if (existing.data?.completedAt && !isSaved) {
    const d = existing.data;
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-[0.10]" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80) 0%, transparent 70%)' }} />
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="font-semibold text-sm">Suitability Profile</span>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Profile Active</h2>
          <p className="text-muted-foreground text-sm mb-6">Your suitability profile is active and personalizing your AI experience.</p>
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto text-left mb-8">
            {d.riskTolerance && <div className="p-3 rounded-lg bg-card border border-border"><p className="text-[10px] text-muted-foreground">Risk</p><p className="text-sm font-medium capitalize">{d.riskTolerance}</p></div>}
            {d.investmentHorizon && <div className="p-3 rounded-lg bg-card border border-border"><p className="text-[10px] text-muted-foreground">Horizon</p><p className="text-sm font-medium">{d.investmentHorizon}</p></div>}
            {d.investmentExperience && <div className="p-3 rounded-lg bg-card border border-border"><p className="text-[10px] text-muted-foreground">Experience</p><p className="text-sm font-medium capitalize">{d.investmentExperience}</p></div>}
            {d.annualIncome && <div className="p-3 rounded-lg bg-card border border-border"><p className="text-[10px] text-muted-foreground">Income</p><p className="text-sm font-medium">{d.annualIncome}</p></div>}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/")} className="text-sm">Back to Chat</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 text-sm gap-1.5" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" /> Update Profile
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Shield className="w-4 h-4 text-accent" />
          <span className="font-semibold text-sm">Financial Profile</span>
          {isComplete && !isSaved && (
            <Button
              size="sm"
              className="ml-auto bg-accent text-accent-foreground hover:bg-accent/90 text-xs h-7 gap-1"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
              Save Profile
            </Button>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] space-y-2 ${msg.role === "user" ? "" : ""}`}>
                {/* Message bubble */}
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-md"
                    : "bg-card border border-border rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? (
                    <Streamdown>{msg.content}</Streamdown>
                  ) : (
                    msg.content
                  )}
                </div>

                {/* Quick-reply buttons */}
                {msg.role === "assistant" && msg.buttons && msg.buttons.length > 0 && i === messages.length - 1 && !isComplete && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {msg.buttons.map((btn, j) => (
                      <Button
                        key={j}
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 rounded-full border-accent/30 hover:bg-accent/10 hover:border-accent/50 transition-all"
                        onClick={() => sendMessage(btn)}
                        disabled={chatMutation.isPending}
                      >
                        {btn}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {/* Completion state */}
          {isSaved && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-sm font-medium mb-1">Profile Saved!</p>
              <p className="text-xs text-muted-foreground mb-4">Your AI will now use this to personalize guidance.</p>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => navigate("/")}>
                Back to Chat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      {!isSaved && (
        <div className="border-t border-border bg-card/30 backdrop-blur-sm p-4">
          <div className="max-w-2xl mx-auto">
            {isComplete ? (
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-10 gap-1.5"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Save My Profile
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-10" onClick={() => { setIsComplete(false); sendMessage("I'd like to add more details."); }}>
                  Continue
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => { e.preventDefault(); sendMessage(input); }}
                className="flex items-center gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer or tap a button above..."
                  className="flex-1 h-10 px-4 rounded-full bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 p-0 shrink-0"
                  disabled={!input.trim() || chatMutation.isPending}
                >
                  {chatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </form>
            )}
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Share as much or as little as you'd like. All information is used solely to personalize your AI experience.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
