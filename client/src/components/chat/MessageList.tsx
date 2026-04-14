import { Bot, Copy, Palette, RefreshCw, Sparkles, ThumbsDown, ThumbsUp, User, Volume2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressiveMessage } from "@/components/ProgressiveMessage";
import { ReasoningChain } from "@/components/ReasoningChain";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { toast } from "sonner";
import { useRef, useEffect, type RefObject } from "react";

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  confidenceScore?: number;
  complianceStatus?: string;
  metadata?: Record<string, any>;
  createdAt?: Date | string;
}

interface MessageListProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  avatarUrl?: string;
  ttsIsSpeaking: boolean;
  suitabilityCompleted?: boolean;
  isAnonymous: boolean;
  shouldPromptUpgrade: boolean;
  anonConversationCount: number;
  anonMessageCount: number;
  onFeedback: (messageId: number, rating: "up" | "down") => void;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
  onRegenerate: (text: string) => void;
  onGenerateInfographic: (content: string) => Promise<void>;
  visualPending: boolean;
  messagesEndRef: RefObject<HTMLDivElement | null>;
}

export function MessageList({
  messages,
  isStreaming,
  avatarUrl,
  ttsIsSpeaking,
  suitabilityCompleted,
  isAnonymous,
  shouldPromptUpgrade,
  anonConversationCount,
  anonMessageCount,
  onFeedback,
  onCopy,
  onSpeak,
  onRegenerate,
  onGenerateInfographic,
  visualPending,
  messagesEndRef,
}: MessageListProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {messages.map((msg, i) => (
        <div key={msg.id || i} className={`group/msg flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
          {msg.role === "assistant" && (
            <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5 ${ttsIsSpeaking && i === messages.length - 1 ? "avatar-talking" : ""} ${avatarUrl ? "" : "bg-accent/10"}`}>
              {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
            </div>
          )}
          <div className="max-w-[85%]">
            {msg.role === "user" ? (
              <div className="bg-accent/15 rounded-2xl rounded-tr-sm px-4 py-2.5">
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <div>
                {/* AI Badge */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-accent/70 bg-accent/8 px-1.5 py-0.5 rounded">
                    <Sparkles className="w-2.5 h-2.5" /> AI
                  </span>
                  {msg.createdAt && <span className="text-[9px] text-muted-foreground/50">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                </div>
                <div className="prose-chat text-sm">
                  <ProgressiveMessage
                    content={msg.content}
                    isLatest={i === messages.length - 1}
                    threshold={300}
                  />
                  {msg.metadata?.imageUrl && (
                    <div className="mt-3 rounded-xl overflow-hidden border border-border max-w-md">
                      <img src={msg.metadata.imageUrl} alt="AI generated visual" className="w-full h-auto" />
                    </div>
                  )}
                </div>
                {msg.confidenceScore != null && (
                  <ReasoningChain
                    confidenceScore={msg.confidenceScore}
                    complianceStatus={msg.complianceStatus as "approved" | "pending" | "flagged" | undefined}
                    focus={msg.metadata?.focus}
                    mode={msg.metadata?.mode}
                    hasRAG={msg.metadata?.hasRAG}
                    hasSuitability={!!suitabilityCompleted}
                    responseLength={msg.content?.length}
                  />
                )}
                <div className="flex items-center gap-2 mt-1">
                  {msg.id && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                      <Tooltip><TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-green-400 transition-colors" onClick={() => onFeedback(msg.id!, "up")}>
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Good response</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors" onClick={() => onFeedback(msg.id!, "down")}>
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Bad response</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => onCopy(msg.content)}>
                          <Copy className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Copy</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => onSpeak(msg.content)}>
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Read aloud</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-amber-400 transition-colors" onClick={() => {
                          const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
                          if (lastUserMsg) onRegenerate(lastUserMsg.content);
                        }}>
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Regenerate</TooltipContent></Tooltip>
                      <Tooltip><TooltipTrigger asChild>
                        <button
                          className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-purple-400 transition-colors"
                          onClick={() => onGenerateInfographic(msg.content)}
                          disabled={visualPending}
                        >
                          <Palette className="w-4 h-4" />
                        </button>
                      </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Generate Infographic</TooltipContent></Tooltip>
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
      {isAnonymous && shouldPromptUpgrade && (
        <div className="px-4 py-3">
          <UpgradePrompt
            targetTier="email"
            conversationCount={anonConversationCount}
            messageCount={anonMessageCount}
            compact
          />
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
