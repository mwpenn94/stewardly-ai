/**
 * MemoryInsightPanel — Visualizes the memory engine's working memory.
 * Absorbed from manus-next-app memory service pattern.
 *
 * Shows what the AI "remembers" about the user — recent context,
 * long-term preferences, and financial profile data that's being
 * used to personalize responses.
 */
import { Brain, Clock, User, TrendingUp, Sparkles, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";

type MemoryCategory = "preference" | "context" | "financial" | "behavioral";

interface MemoryItem {
  id: string;
  category: MemoryCategory;
  content: string;
  confidence: number; // 0-1
  lastAccessed: string; // ISO date
  accessCount: number;
}

interface MemoryInsightPanelProps {
  memories: MemoryItem[];
  totalMemories: number;
  consolidationScore: number; // 0-100
  className?: string;
}

const CATEGORY_CONFIG: Record<MemoryCategory, {
  icon: typeof Brain;
  label: string;
  color: string;
}> = {
  preference: { icon: User, label: "Preferences", color: "text-primary" },
  context: { icon: Clock, label: "Context", color: "text-amber-400" },
  financial: { icon: TrendingUp, label: "Financial", color: "text-emerald-400" },
  behavioral: { icon: Sparkles, label: "Behavioral", color: "text-purple-400" },
};

export function MemoryInsightPanel({
  memories,
  totalMemories,
  consolidationScore,
  className = "",
}: MemoryInsightPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const grouped = memories.reduce((acc, m) => {
    if (!acc[m.category]) acc[m.category] = [];
    acc[m.category].push(m);
    return acc;
  }, {} as Record<MemoryCategory, MemoryItem[]>);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/30 border border-border/50 hover:bg-primary/50 transition-colors"
      >
        <Brain className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium text-foreground flex-1 text-left">
          Active Memory ({totalMemories} items)
        </span>
        <Badge variant="secondary" className="text-[10px]">
          {consolidationScore}% consolidated
        </Badge>
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        )}
      </button>

      {/* Memory categories */}
      {expanded && (
        <div className="space-y-2">
          {(Object.entries(grouped) as [MemoryCategory, MemoryItem[]][]).map(([category, items]) => {
            const config = CATEGORY_CONFIG[category];
            const Icon = config.icon;
            return (
              <div key={category} className="space-y-1">
                <div className="flex items-center gap-1.5 px-2">
                  <Icon className={`w-3 h-3 ${config.color}`} />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {config.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 ml-auto">
                    {items.length}
                  </span>
                </div>
                {items.slice(0, 3).map((item) => (
                  <div
                    key={item.id}
                    className="px-3 py-1.5 rounded-md border border-border/30 bg-card/30"
                  >
                    <p className="text-[11px] text-foreground/80 line-clamp-2">{item.content}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1 rounded-full bg-primary/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/60"
                          style={{ width: `${item.confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-muted-foreground/50">
                        {Math.round(item.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
                {items.length > 3 && (
                  <p className="text-[10px] text-muted-foreground/50 px-3">
                    +{items.length - 3} more
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
