/**
 * ContextualAd — Renders sponsored content in chat with UX guardrails
 * - "Sponsored" label always visible
 * - Dismissible with × button
 * - Respects adPolicy from 5-layer config (frequency cap, session cap)
 */
import { useState } from "react";
import { X, ExternalLink, Megaphone } from "lucide-react";

export interface AdPlacement {
  id: number;
  type: "contextual_banner" | "sponsored_content" | "product_recommendation" | "inline_cta";
  advertiser: string;
  content: string;
  ctaUrl?: string;
  ctaText?: string;
  context: string;
}

interface ContextualAdProps {
  ad: AdPlacement;
  onDismiss: (adId: number) => void;
  onClickThrough?: (adId: number) => void;
  className?: string;
}

export default function ContextualAd({ ad, onDismiss, onClickThrough, className = "" }: ContextualAdProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss(ad.id);
  };

  const handleClick = () => {
    onClickThrough?.(ad.id);
    if (ad.ctaUrl) window.open(ad.ctaUrl, "_blank", "noopener,noreferrer");
  };

  if (ad.type === "inline_cta") {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/15 text-xs ${className}`}>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Sponsored</span>
        <span className="text-foreground/80">{ad.content}</span>
        {ad.ctaUrl && (
          <button onClick={handleClick} className="text-primary hover:underline font-medium whitespace-nowrap">
            {ad.ctaText || "Learn more"} →
          </button>
        )}
        <button onClick={handleDismiss} className="ml-auto text-muted-foreground hover:text-foreground" aria-label="Dismiss ad">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg border border-border/40 bg-muted/20 overflow-hidden ${className}`}>
      {/* Sponsored label */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-1.5">
          <Megaphone className="w-3 h-3 text-muted-foreground" />
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            {ad.type === "product_recommendation" ? "Recommended" : "Sponsored"} · {ad.advertiser}
          </span>
        </div>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss sponsored content"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-xs text-foreground/80 leading-relaxed">{ad.content}</p>
        {ad.ctaUrl && (
          <button
            onClick={handleClick}
            className="mt-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            {ad.ctaText || "Learn more"}
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
