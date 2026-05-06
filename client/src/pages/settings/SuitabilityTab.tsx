import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle, Loader2, Send, RotateCcw } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { Streamdown } from "streamdown";

type ChatMessage = { role: "user" | "assistant"; content: string; buttons?: string[] };

const INITIAL_GREETING = "Hi! I'd love to learn a bit about your financial situation so I can personalize your experience. We'll keep this conversational — answer however feels natural, and you can stop anytime. Ready to get started?";
const INITIAL_BUTTONS = ["Let's go!", "Sure, keep it quick", "I'll just type freely"];

export default function SuitabilityTab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const existing = trpc.suitability.get.useQuery();
  const chatMutation = trpc.suitability.chat.useMutation({ onError: (e) => toast.error(`Suitability chat failed: ${e.message}`) });
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
      if (result.isComplete) setIsComplete(true);
    } catch {
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

  // ─── COMPLETED STATE ───
  if (existing.data?.completedAt && !isSaved && messages.length <= 1) {
    const d = existing.data;
    return (
      <div className="max-w-2xl">
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-1">Financial Profile</h2>
          <p className="text-sm text-muted-foreground">Your suitability assessment personalizes AI advice to your situation.</p>
        </div>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h3 className="text-sm font-semibold">Profile Active</h3>
              <p className="text-xs text-muted-foreground mt-1">Your suitability profile is active and personalizing your AI experience.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mb-6">
              {d.riskTolerance && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Risk Tolerance</p>
                  <p className="text-sm font-medium capitalize">{d.riskTolerance}</p>
                </div>
              )}
              {d.investmentHorizon && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Horizon</p>
                  <p className="text-sm font-medium">{d.investmentHorizon}</p>
                </div>
              )}
              {d.investmentExperience && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Experience</p>
                  <p className="text-sm font-medium capitalize">{d.investmentExperience}</p>
                </div>
              )}
              {d.annualIncome && (
                <div className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="text-[10px] text-muted-foreground">Income</p>
                  <p className="text-sm font-medium">{d.annualIncome}</p>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs gap-1.5" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" /> Update Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── CHAT ASSESSMENT ───
  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-1">Financial Profile</h2>
        <p className="text-sm text-muted-foreground">Have a quick conversation to build your suitability profile. Share as much or as little as you'd like.</p>
      </div>

      {/* Chat area */}
      <Card className="bg-card/50 border-border/50 overflow-hidden">
        <div ref={scrollRef} className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%] space-y-1.5">
                <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-accent-foreground rounded-br-md"
                    : "bg-secondary border border-border/50 rounded-bl-md"
                }`}>
                  {msg.role === "assistant" ? <Streamdown>{msg.content}</Streamdown> : msg.content}
                </div>

                {msg.role === "assistant" && msg.buttons && msg.buttons.length > 0 && i === messages.length - 1 && !isComplete && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.buttons.map((btn, j) => (
                      <Button
                        key={j}
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7 rounded-full border-accent/30 hover:bg-accent/10 hover:border-accent/50"
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

          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-secondary border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-accent/60 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          {isSaved && (
            <div className="text-center py-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
              </div>
              <p className="text-sm font-medium">Profile Saved!</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Your AI will now use this to personalize guidance.</p>
            </div>
          )}
        </div>

        {/* Input */}
        {!isSaved && (
          <div className="border-t border-border/50 p-3">
            {isComplete ? (
              <div className="flex items-center gap-2">
                <Button
                  className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90 text-sm h-9 gap-1.5"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Save My Profile
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-9" onClick={() => { setIsComplete(false); sendMessage("I'd like to add more details."); }}>
                  Continue
                </Button>
              </div>
            ) : (
              <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer or tap a button above..."
                  className="flex-1 h-9 px-3.5 rounded-full bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-accent/50 placeholder:text-muted-foreground"
                  disabled={chatMutation.isPending}
                />
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 w-9 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 p-0 shrink-0"
                  disabled={!input.trim() || chatMutation.isPending}
                >
                  {chatMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </form>
            )}
            <p className="text-[9px] text-muted-foreground text-center mt-1.5">
              Share as much or as little as you'd like. All information is used solely to personalize your AI experience.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
