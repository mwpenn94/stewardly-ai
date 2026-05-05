/**
 * ActionIndicator — Real-time agent presence/state indicator.
 *
 * Shows what the AI is currently doing:
 *   - Thinking (reasoning, no output yet)
 *   - Tool Active (executing a tool — search, analysis, etc.)
 *   - Generating (streaming text output)
 *   - Idle (waiting for user input)
 *
 * Absorbed from manus-next-app ActiveToolIndicator with Stewardly adaptations.
 *
 * @substrate-ui: action-indicator
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Brain, Search, FileText, Calculator, Shield,
  PenLine, Globe, BarChart3, BookOpen, Loader2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type AgentState = "thinking" | "tool_active" | "generating" | "idle";

export interface ActiveTool {
  name: string;
  description?: string;
  startedAt: number;
}

interface ActionIndicatorProps {
  state: AgentState;
  activeTool?: ActiveTool;
  className?: string;
}

// ─── Tool Icon Map ───────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, typeof Brain> = {
  search: Search,
  web_search: Globe,
  research: Globe,
  document: FileText,
  calculate: Calculator,
  compliance: Shield,
  analysis: BarChart3,
  knowledge: BookOpen,
  default: Brain,
};

function getToolIcon(toolName: string) {
  const lower = toolName.toLowerCase();
  for (const [key, Icon] of Object.entries(TOOL_ICONS)) {
    if (lower.includes(key)) return Icon;
  }
  return TOOL_ICONS.default;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ActionIndicator({ state, activeTool, className }: ActionIndicatorProps) {
  const [elapsed, setElapsed] = useState(0);

  // Track elapsed time for active tools
  useEffect(() => {
    if (state !== "tool_active" || !activeTool) {
      setElapsed(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsed(Date.now() - activeTool.startedAt);
    }, 100);

    return () => clearInterval(interval);
  }, [state, activeTool]);

  if (state === "idle") return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state + (activeTool?.name ?? "")}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg",
          "bg-muted/60 border border-border/40 text-sm",
          className
        )}
      >
        {state === "thinking" && (
          <>
            <ThinkingPulse />
            <span className="text-muted-foreground">Thinking...</span>
          </>
        )}

        {state === "tool_active" && activeTool && (
          <>
            <ToolActiveIcon toolName={activeTool.name} />
            <span className="text-muted-foreground">
              {activeTool.description ?? `Using ${activeTool.name}`}
            </span>
            {elapsed > 1000 && (
              <span className="text-xs text-muted-foreground/60">
                {(elapsed / 1000).toFixed(1)}s
              </span>
            )}
          </>
        )}

        {state === "generating" && (
          <>
            <GeneratingIcon />
            <span className="text-muted-foreground">Writing...</span>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ThinkingPulse() {
  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1] }}
      transition={{ duration: 1.5, repeat: Infinity }}
    >
      <Brain className="w-4 h-4 text-purple-400" />
    </motion.div>
  );
}

function ToolActiveIcon({ toolName }: { toolName: string }) {
  const Icon = getToolIcon(toolName);
  return (
    <motion.div
      animate={{ rotate: [0, 5, -5, 0] }}
      transition={{ duration: 0.8, repeat: Infinity }}
    >
      <Icon className="w-4 h-4 text-blue-400" />
    </motion.div>
  );
}

function GeneratingIcon() {
  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <PenLine className="w-4 h-4 text-green-400" />
    </motion.div>
  );
}

export default ActionIndicator;
