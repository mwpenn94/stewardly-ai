/**
 * RichMediaEmbed — Renders embedded media within chat messages
 * Supports: video (YouTube/iframe), audio player, images, documents, shopping cards
 */
import { useState } from "react";
import { Play, FileText, Image as ImageIcon, ShoppingCart, ExternalLink, X, Volume2, Maximize2 } from "lucide-react";

export type MediaType = "video" | "audio" | "image" | "document" | "shopping" | "chart" | "link_preview";

export interface MediaEmbed {
  type: MediaType;
  source: string;
  title: string;
  thumbnailUrl?: string;
  startTime?: number;
  endTime?: number;
  metadata?: Record<string, unknown>;
  relevanceScore?: number;
}

interface RichMediaEmbedProps {
  embeds: MediaEmbed[];
  className?: string;
}

function VideoEmbed({ embed }: { embed: MediaEmbed }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className="relative rounded-lg overflow-hidden bg-black/20 border border-border/40">
      {!loaded && (
        <button
          onClick={() => setLoaded(true)}
          className="flex items-center gap-2 w-full p-3 hover:bg-white/5 transition-colors"
        >
          <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
            <Play className="w-4 h-4 text-red-400" />
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs font-medium text-foreground truncate">{embed.title}</p>
            <p className="text-[10px] text-muted-foreground">Click to load video</p>
          </div>
        </button>
      )}
      {loaded && (
        <iframe
          src={embed.source}
          className="w-full aspect-video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={embed.title}
        />
      )}
    </div>
  );
}

function AudioEmbed({ embed }: { embed: MediaEmbed }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
        <Volume2 className="w-4 h-4 text-blue-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{embed.title}</p>
        <audio controls className="w-full h-7 mt-1" preload="metadata">
          <source src={embed.source} />
        </audio>
      </div>
    </div>
  );
}

function ImageEmbed({ embed }: { embed: MediaEmbed }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div className="relative group rounded-lg overflow-hidden border border-border/40 cursor-pointer" onClick={() => setExpanded(true)}>
        <img src={embed.source} alt={embed.title} className="w-full max-h-64 object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <Maximize2 className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        {embed.title !== "Image" && (
          <p className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 text-[10px] text-white truncate">{embed.title}</p>
        )}
      </div>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setExpanded(false)}>
          <button className="absolute top-4 right-4 text-white/70 hover:text-white" onClick={() => setExpanded(false)}>
            <X className="w-6 h-6" />
          </button>
          <img src={embed.source} alt={embed.title} className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </>
  );
}

function DocumentEmbed({ embed }: { embed: MediaEmbed }) {
  return (
    <a
      href={embed.source}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
    >
      <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
        <FileText className="w-4 h-4 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{embed.title}</p>
        <p className="text-[10px] text-muted-foreground">Open document</p>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

function ShoppingEmbed({ embed }: { embed: MediaEmbed }) {
  const meta = embed.metadata || {};
  return (
    <a
      href={embed.source}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 transition-colors"
    >
      {embed.thumbnailUrl ? (
        <img src={embed.thumbnailUrl} alt={embed.title} className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
          <ShoppingCart className="w-5 h-5 text-green-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{embed.title}</p>
        {meta.price ? <p className="text-sm font-mono tabular-nums text-emerald-400">{String(meta.price)}</p> : null}
        {meta.rating ? <p className="text-[10px] text-muted-foreground">{String(meta.rating)}</p> : null}
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
    </a>
  );
}

export default function RichMediaEmbed({ embeds, className = "" }: RichMediaEmbedProps) {
  if (!embeds || embeds.length === 0) return null;

  return (
    <div className={`space-y-2 mt-2 ${className}`}>
      {embeds.map((embed, i) => {
        switch (embed.type) {
          case "video": return <VideoEmbed key={i} embed={embed} />;
          case "audio": return <AudioEmbed key={i} embed={embed} />;
          case "image": return <ImageEmbed key={i} embed={embed} />;
          case "document": return <DocumentEmbed key={i} embed={embed} />;
          case "shopping": return <ShoppingEmbed key={i} embed={embed} />;
          default: return (
            <a key={i} href={embed.source} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40 hover:bg-muted/50 text-xs text-foreground">
              <ImageIcon className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{embed.title}</span>
              <ExternalLink className="w-3 h-3 text-muted-foreground ml-auto" />
            </a>
          );
        }
      })}
    </div>
  );
}
