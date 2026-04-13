/**
 * ChatMessageActions — Round A5.
 *
 * Per-message action bar that the chat UI renders below every assistant
 * message. Provides:
 *
 *  - Copy: copies the message text (and optional structured data) to clipboard
 *  - Play TTS: streams Edge TTS audio for the message via the existing
 *    voice router; renders an inline player + animated EQ bars
 *  - Embed Rich Media: triggers the chat's image/chart-generation flow
 *    (if the message has chart hints, opens a richer view)
 *  - Share: copies a deep link to the message (uses the existing
 *    conversation share URL pattern)
 *  - Regenerate: re-runs the LLM with the same prompt
 *
 * Each action is independently togglable so the chat surface can hide
 * what's not relevant for a given message (e.g. system messages don't
 * get a TTS button).
 */

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Copy,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Share2,
  RefreshCw,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export interface ChatMessageActionsProps {
  /** The plain text body to copy / play */
  text: string;
  /** Optional structured payload (charts, engine results) to include in the copy */
  structured?: Record<string, unknown>;
  /** Show the play-TTS button */
  showTts?: boolean;
  /** Show the embed-rich-media button */
  showEmbed?: boolean;
  /** Show the share button */
  showShare?: boolean;
  /** Show the regenerate button */
  showRegenerate?: boolean;
  /** Optional message id used for share link */
  messageId?: number;
  /** Voice id to use for TTS playback */
  voiceId?: string;
  /** Called when the user requests embed / regeneration so the parent can open the right modal */
  onEmbedRequest?: () => void;
  onRegenerate?: () => void;
  className?: string;
}

export function ChatMessageActions({
  text,
  structured,
  showTts = true,
  showEmbed = false,
  showShare = true,
  showRegenerate = false,
  messageId,
  voiceId = "aria",
  onEmbedRequest,
  onRegenerate,
  className,
}: ChatMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speak = trpc.voice.speak.useMutation({ onError: (e) => toast.error(`TTS failed: ${e.message}`) });

  // Reset copied state after 2s
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopy = async () => {
    try {
      const payload = structured
        ? `${text}\n\n${JSON.stringify(structured, null, 2)}`
        : text;
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Couldn't copy — try selecting and copying manually");
    }
  };

  const handlePlayTts = async () => {
    if (playingAudio && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudio(false);
      return;
    }
    try {
      const result = await speak.mutateAsync({
        text: text.slice(0, 5000),
        voice: voiceId,
        rate: "+0%",
        pitch: "+0Hz",
      });
      // Decode base64 → blob → playable URL
      const binary = atob(result.audio);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setPlayingAudio(false);
        URL.revokeObjectURL(url);
      };
      audio.onpause = () => setPlayingAudio(false);
      setAudioReady(true);
      setPlayingAudio(true);
      await audio.play();
    } catch (err) {
      toast.error("Audio playback isn't available right now", {
        description: err instanceof Error ? err.message : "Please try again in a moment",
      });
      setPlayingAudio(false);
    }
  };

  const handleShare = async () => {
    if (!messageId) {
      toast.error("This message can't be shared yet — wait for it to finish sending");
      return;
    }
    const url = `${window.location.origin}/chat?message=${messageId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied");
    } catch {
      toast.error("Couldn't copy the share link — try again");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className={`flex items-center gap-1 mt-2 ${className ?? ""}`}>
        {/* Copy */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleCopy}
              aria-label="Copy message"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {copied ? "Copied!" : structured ? "Copy text + data" : "Copy text"}
          </TooltipContent>
        </Tooltip>

        {/* Play TTS */}
        {showTts && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handlePlayTts}
                disabled={speak.isPending}
                aria-label={playingAudio ? "Pause audio" : "Play audio"}
              >
                {speak.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : playingAudio ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {playingAudio ? "Stop audio" : audioReady ? "Replay audio" : "Listen with TTS"}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Embed rich media */}
        {showEmbed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onEmbedRequest}
                aria-label="Embed rich media"
              >
                <ImageIcon className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Add chart / image</TooltipContent>
          </Tooltip>
        )}

        {/* Share */}
        {showShare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleShare}
                aria-label="Share message"
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy share link</TooltipContent>
          </Tooltip>
        )}

        {/* Regenerate */}
        {showRegenerate && onRegenerate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onRegenerate}
                aria-label="Regenerate"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Regenerate response</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}
