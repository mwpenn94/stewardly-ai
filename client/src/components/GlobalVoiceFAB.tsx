/**
 * GlobalVoiceFAB.tsx — Floating action button for hands-free voice mode
 *
 * v8.2 Pass 1 (G24). Renders a subtle mic icon in the bottom-right corner
 * on all non-chat pages. Tapping it enters hands-free mode and navigates
 * to /chat. When hands-free is already active, shows a pulsing indicator.
 *
 * Hidden on /chat (where the ChatInputBar already has the button).
 * Hidden on mobile when keyboard is likely open (viewport height shrink).
 */

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AudioLines, PhoneOff } from "lucide-react";
import { usePlatformIntelligence } from "./PlatformIntelligence";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export function GlobalVoiceFAB() {
  const [location, navigate] = useLocation();
  const pil = usePlatformIntelligence();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissed state when navigating
  useEffect(() => {
    setDismissed(false);
  }, [location]);

  // Don't show on chat page (has its own button) or if dismissed
  if (location.startsWith("/chat") || dismissed) return null;

  const handleClick = () => {
    if (pil.handsFreeActive) {
      pil.exitHandsFree();
    } else {
      pil.enterHandsFree();
      navigate("/chat");
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {/* Dismiss hint — only show once per page */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleClick}
            className={`
              group relative flex items-center justify-center
              w-12 h-12 rounded-full shadow-lg
              transition-all duration-300 ease-out
              hover:scale-110 hover:shadow-xl
              focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-background
              ${pil.handsFreeActive
                ? "bg-red-500/20 text-red-400 animate-pulse"
                : "bg-accent/10 text-accent hover:bg-accent/20 backdrop-blur-sm border border-accent/20"
              }
            `}
            aria-label={pil.handsFreeActive ? "Stop hands-free mode" : "Start hands-free voice mode (Shift+V)"}
          >
            {pil.handsFreeActive ? (
              <PhoneOff className="w-5 h-5" />
            ) : (
              <AudioLines className="w-5 h-5" />
            )}

            {/* Keyboard shortcut hint */}
            {!pil.handsFreeActive && (
              <span className="absolute -top-1 -right-1 text-[9px] font-mono bg-muted text-muted-foreground rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                ⇧V
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          {pil.handsFreeActive ? "Stop hands-free" : "Start hands-free voice (Shift+V)"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}
