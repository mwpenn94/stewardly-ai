import { useState, useRef, useEffect, type RefObject } from "react";
import {
  ArrowUp, AudioLines, Check, ChevronDown, Image, Loader2, Monitor,
  Palette, Paperclip, PhoneOff, Plus, Sparkles, Video, Volume2, VolumeX
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export interface FocusOption {
  value: string;
  label: string;
  icon: React.ReactNode;
}

export interface ModeOption {
  value: string;
  label: string;
  minRole: string;
}

interface ChatInputBarProps {
  input: string;
  setInput: (v: string) => void;
  isStreaming: boolean;
  handsFreeActive: boolean;
  voiceIsListening: boolean;
  ttsEnabled: boolean;
  setTtsEnabled: (v: boolean) => void;
  ttsCancelFn: () => void;
  attachments: File[];
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  toggleHandsFree: () => void;
  selectedFocus: string[];
  toggleFocus: (mode: string) => void;
  mode: string;
  setMode: (m: string) => void;
  focusOptions: FocusOption[];
  availableModes: ModeOption[];
  showModes: boolean;
  liveSessionMode: "camera" | "screen" | null;
  setLiveSessionMode: (m: "camera" | "screen" | null) => void;
  onGenerateVisual: (prompt: string) => Promise<void>;
  visualPending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  imageInputRef: RefObject<HTMLInputElement | null>;
}

export function ChatInputBar({
  input,
  setInput,
  isStreaming,
  handsFreeActive,
  voiceIsListening,
  ttsEnabled,
  setTtsEnabled,
  ttsCancelFn,
  attachments,
  setAttachments,
  onSend,
  onKeyDown,
  toggleHandsFree,
  selectedFocus,
  toggleFocus,
  mode,
  setMode,
  focusOptions,
  availableModes,
  showModes,
  liveSessionMode,
  setLiveSessionMode,
  onGenerateVisual,
  visualPending,
  textareaRef,
  fileInputRef,
  imageInputRef,
}: ChatInputBarProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  return (
    <div className="p-3 sm:p-4 shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* Attachment chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2 px-1">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1 text-xs">
                <Paperclip className="w-3 h-3 text-muted-foreground" />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button className="hover:text-destructive" onClick={() => removeAttachment(i)}>&times;</button>
              </div>
            ))}
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml" onChange={handleFileSelect} />
        <input ref={imageInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handleFileSelect} />

        {/* Textarea */}
        <div data-tour="chat-input" className="relative bg-secondary/30 rounded-2xl border border-border focus-within:border-accent/40 focus-within:shadow-[0_0_0_1px_oklch(0.68_0.16_230_/_0.15)] transition-all px-3 py-1.5">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={handsFreeActive && voiceIsListening ? "Listening..." : "Ask Steward anything..."}
            className="w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-[160px] text-sm py-2 px-0"
            rows={1}
            disabled={isStreaming}
          />
        </div>

        {/* Action bar below textarea */}
        <div className="chat-input-bar flex items-center gap-1 mt-1.5">
          {/* + Add context button */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={`p-2.5 rounded-full transition-all ${
                    showAddMenu ? "bg-accent/20 text-accent rotate-45" : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => setShowAddMenu(!showAddMenu)}
                >
                  <Plus className="w-5 h-5 transition-transform" />
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
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs hover:bg-secondary/60 transition-colors ${visualPending ? "opacity-50" : ""}`}
                    disabled={visualPending}
                    onClick={async () => {
                      setShowAddMenu(false);
                      const prompt = input.trim();
                      if (!prompt) { toast.info("Type a description first, then generate a visual"); return; }
                      await onGenerateVisual(prompt);
                    }}
                  >
                    <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{visualPending ? "Generating..." : "Generate visual"}</span>
                  </button>
                  <div className="h-px bg-border my-0.5" />
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                      liveSessionMode === "screen" ? "bg-red-500/10 text-red-400" : "hover:bg-secondary/60"
                    }`}
                    onClick={() => { setLiveSessionMode(liveSessionMode === "screen" ? null : "screen"); setShowAddMenu(false); }}
                  >
                    <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{liveSessionMode === "screen" ? "End screen share" : "Go live — Screen"}</span>
                  </button>
                  <button
                    className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs transition-colors ${
                      liveSessionMode === "camera" ? "bg-red-500/10 text-red-400" : "hover:bg-secondary/60"
                    }`}
                    onClick={() => { setLiveSessionMode(liveSessionMode === "camera" ? null : "camera"); setShowAddMenu(false); }}
                  >
                    <Video className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>{liveSessionMode === "camera" ? "End video session" : "Go live — Video"}</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Mode dropdown */}
          <div className="relative" data-tour="focus-mode">
            <button
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-secondary/40 text-foreground hover:bg-secondary/60 border border-border transition-all"
              onClick={() => setShowModeMenu(!showModeMenu)}
            >
              {focusOptions.find(o => selectedFocus.includes(o.value))?.icon || <Sparkles className="w-3 h-3" />}
              {focusOptions.find(o => selectedFocus.includes(o.value))?.label || "General"}
              <ChevronDown className={`w-3 h-3 transition-transform ${showModeMenu ? "rotate-180" : ""}`} />
            </button>

            {showModeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 w-52 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Focus</div>
                  {focusOptions.map(opt => (
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

          {/* Spacer */}
          <div className="flex-1" />

          {/* Audio toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-tour="voice-toggle"
                className={`p-2.5 rounded-full transition-all ${
                  ttsEnabled
                    ? "bg-accent/15 text-accent"
                    : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => { setTtsEnabled(!ttsEnabled); ttsCancelFn(); }}
              >
                {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent>{ttsEnabled ? "Mute audio" : "Enable audio"}</TooltipContent>
          </Tooltip>

          {/* Unified hands-free / send button */}
          {isStreaming ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all"
              disabled
            >
              <Loader2 className="w-5 h-5 animate-spin" />
            </Button>
          ) : (input.trim() || attachments.length > 0) ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all"
              onClick={onSend}
            >
              <ArrowUp className="w-5 h-5" />
            </Button>
          ) : handsFreeActive ? (
            <Button
              size="icon"
              className="h-10 w-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse transition-all"
              onClick={toggleHandsFree}
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all"
                  onClick={toggleHandsFree}
                >
                  <AudioLines className="w-5 h-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Start hands-free voice</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}
