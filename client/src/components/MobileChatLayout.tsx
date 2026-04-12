/**
 * MobileChatLayout.tsx — Mobile-first chat layout
 *
 * Pass 95. Wraps chat on screens < 768px.
 */

import { useState, useRef, useEffect } from "react";
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Switch } from "@/components/ui/switch";
import {
  SlidersHorizontal, Send, Menu, MessageSquare, Repeat, Brain, Code, Mic, MicOff,
} from "lucide-react";

interface MobileChatLayoutProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  focusMode: string;
  onFocusModeChange: (mode: string) => void;
  chatMode: "single" | "loop" | "consensus" | "codechat";
  onChatModeChange: (mode: string) => void;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  messageList: React.ReactNode;
  conversationSidebar: React.ReactNode;
  typingIndicator?: React.ReactNode;
}

const FOCUS_MODES = [
  { key: "general", label: "General", emoji: "💬" },
  { key: "financial", label: "Financial", emoji: "💰" },
  { key: "insurance", label: "Insurance", emoji: "🛡️" },
  { key: "estate", label: "Estate", emoji: "🏛️" },
  { key: "premium-finance", label: "Premium Finance", emoji: "📊" },
];

const CHAT_MODES = [
  { key: "single", label: "Single", icon: MessageSquare, desc: "One model responds" },
  { key: "loop", label: "Loop", icon: Repeat, desc: "Iterative refinement" },
  { key: "consensus", label: "Consensus", icon: Brain, desc: "Multi-model agreement" },
  { key: "codechat", label: "Code", icon: Code, desc: "Edit code with AI" },
];

export default function MobileChatLayout({
  inputValue, onInputChange, onSend, isStreaming,
  focusMode, onFocusModeChange, chatMode, onChatModeChange,
  voiceEnabled, onVoiceToggle,
  messageList, conversationSidebar, typingIndicator,
}: MobileChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
  };

  const activeFocus = FOCUS_MODES.find((m) => m.key === focusMode);
  const activeMode = CHAT_MODES.find((m) => m.key === chatMode);

  return (
    <div className="flex flex-col h-[100dvh] bg-background">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm flex-none">
        <button onClick={() => setSidebarOpen(true)} className="flex items-center justify-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer" aria-label="Open conversations">
          <Menu className="w-5 h-5" />
        </button>
        <button onClick={() => setOptionsOpen(true)} className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card/60 text-sm cursor-pointer">
          <span>{activeFocus?.emoji}</span>
          <span className="text-muted-foreground">{activeFocus?.label}</span>
          <span className="text-border mx-1">·</span>
          {activeMode && <activeMode.icon className="w-3.5 h-3.5 text-primary" />}
          <span className="text-muted-foreground">{activeMode?.label}</span>
        </button>
        <div className="w-9" />
      </header>

      <main className="flex-1 overflow-y-auto overscroll-contain">
        {messageList}
        {typingIndicator}
      </main>

      <div className="flex-none border-t border-border bg-card/80 backdrop-blur-sm px-3 py-2 pb-[env(safe-area-inset-bottom,8px)]">
        <div className="flex items-end gap-2">
          <Sheet open={optionsOpen} onOpenChange={setOptionsOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-card/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex-none" aria-label="Chat options">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto">
              <SheetHeader className="pb-2"><SheetTitle className="text-base">Chat Options</SheetTitle></SheetHeader>
              <div className="space-y-6 pb-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Focus</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {FOCUS_MODES.map((mode) => (
                      <button key={mode.key} onClick={() => onFocusModeChange(mode.key)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border cursor-pointer transition-colors
                          ${focusMode === mode.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                        <span>{mode.emoji}</span>{mode.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">Mode</label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {CHAT_MODES.map((mode) => (
                      <button key={mode.key} onClick={() => onChatModeChange(mode.key)}
                        className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm border cursor-pointer transition-colors text-left
                          ${chatMode === mode.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                        <mode.icon className="w-4 h-4 flex-none" />
                        <div><div className="font-medium">{mode.label}</div><div className="text-xs opacity-70">{mode.desc}</div></div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    {voiceEnabled ? <Mic className="w-4 h-4 text-primary" /> : <MicOff className="w-4 h-4 text-muted-foreground" />}
                    <span className="text-sm">Voice input</span>
                  </div>
                  <Switch checked={voiceEnabled} onCheckedChange={onVoiceToggle} />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          <div className="flex-1 relative">
            <textarea ref={inputRef} value={inputValue} onChange={(e) => onInputChange(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Message Steward..." rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-[120px]"
              disabled={isStreaming} />
          </div>
          <button onClick={onSend} disabled={!inputValue.trim() || isStreaming}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity flex-none" aria-label="Send message">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
          <VisuallyHidden asChild><SheetTitle>Conversations</SheetTitle></VisuallyHidden>
          {conversationSidebar}
        </SheetContent>
      </Sheet>
    </div>
  );
}
