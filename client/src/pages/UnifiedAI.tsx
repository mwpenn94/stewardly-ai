/**
 * UnifiedAI.tsx — Consolidated AI surface (Chat + Code + Agent)
 *
 * Per prompt v5 Phase 4: "One URL, one surface, one conversation thread."
 * Three modes accessible via progressive disclosure:
 *   Level 1 (default): Chat only (Claude.ai-like)
 *   Level 2: Chat + Code toggle
 *   Level 3: Chat + Code + Agent toggle
 *   Level 4: Full orchestration (multi-agent, scheduled, batch)
 *
 * Context carries across modes. Backend routers unchanged.
 *
 * Keyboard shortcuts:
 *   Ctrl+1 → Chat mode
 *   Ctrl+2 → Code mode (if level ≥ 2)
 *   Ctrl+3 → Agent mode (if level ≥ 3)
 */
import { useState, useCallback, useMemo, lazy, Suspense, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageSquare,
  Terminal,
  Bot,
  ChevronDown,
  Settings2,
  Sparkles,
  Keyboard,
  Share2,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

// Lazy-load the 3 mode panels to keep initial bundle small
const ChatPanel = lazy(() => import("./Chat"));
const CodeChatPanel = lazy(() => import("./CodeChat"));
const AgentPanel = lazy(() => import("./AgentManager"));

// ─── Types ─────────────────────────────────────────────────────────
type AIMode = "chat" | "code" | "agent";

interface ModeConfig {
  key: AIMode;
  label: string;
  shortLabel: string;
  icon: typeof MessageSquare;
  description: string;
  minLevel: number;
  badge?: string;
  shortcut: string;
}

const MODE_CONFIGS: ModeConfig[] = [
  {
    key: "chat",
    label: "Chat",
    shortLabel: "Chat",
    icon: MessageSquare,
    description: "Conversational AI — questions, analysis, reasoning",
    minLevel: 1,
    shortcut: "Ctrl+1",
  },
  {
    key: "code",
    label: "Code",
    shortLabel: "Code",
    icon: Terminal,
    description: "Code generation, editing, multi-file operations",
    minLevel: 2,
    badge: "Dev",
    shortcut: "Ctrl+2",
  },
  {
    key: "agent",
    label: "Agent",
    shortLabel: "Agent",
    icon: Bot,
    description: "Autonomous task execution — browser, code, workflows",
    minLevel: 3,
    badge: "Auto",
    shortcut: "Ctrl+3",
  },
];

// ─── Progressive Disclosure Level ──────────────────────────────────
function useAIDisclosureLevel(): [number, (level: number) => void] {
  const [level, setLevel] = useState<number>(() => {
    try {
      const stored = localStorage.getItem("ai_disclosure_level");
      return stored ? parseInt(stored, 10) : 1;
    } catch {
      return 1;
    }
  });

  const updateLevel = useCallback((newLevel: number) => {
    const clamped = Math.max(1, Math.min(4, newLevel));
    setLevel(clamped);
    try {
      localStorage.setItem("ai_disclosure_level", String(clamped));
    } catch {
      // silent
    }
  }, []);

  return [level, updateLevel];
}

// ─── Keyboard Shortcuts ────────────────────────────────────────────
function useModeSwitchShortcuts(
  disclosureLevel: number,
  onModeChange: (mode: AIMode) => void,
) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.shiftKey || e.altKey) return;

      const modeMap: Record<string, AIMode> = { "1": "chat", "2": "code", "3": "agent" };
      const mode = modeMap[e.key];
      if (!mode) return;

      const config = MODE_CONFIGS.find((m) => m.key === mode);
      if (!config || config.minLevel > disclosureLevel) return;

      e.preventDefault();
      onModeChange(mode);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disclosureLevel, onModeChange]);
}

// ─── Context Sharing Indicator ─────────────────────────────────────
function ContextIndicator({ activeMode }: { activeMode: AIMode }) {
  const otherModes = MODE_CONFIGS.filter((m) => m.key !== activeMode);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-1 text-xs text-muted-foreground/60 px-2">
          <Share2 className="w-3 h-3" />
          <span className="hidden md:inline">Context shared</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="text-xs">
          Conversation context is shared across all AI modes. Switching modes
          preserves your current thread — {otherModes.map((m) => m.label).join(" and ")}{" "}
          can reference what you discussed in {MODE_CONFIGS.find((m) => m.key === activeMode)?.label}.
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Mode Indicator Header ─────────────────────────────────────────
function ModeHeader({
  activeMode,
  onModeChange,
  disclosureLevel,
  onLevelChange,
  visibleModes,
  isZenMode,
  onToggleZen,
}: {
  activeMode: AIMode;
  onModeChange: (mode: AIMode) => void;
  disclosureLevel: number;
  onLevelChange: (level: number) => void;
  visibleModes: ModeConfig[];
  isZenMode: boolean;
  onToggleZen: () => void;
}) {
  const activeConfig = MODE_CONFIGS.find((m) => m.key === activeMode)!;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-background/80 backdrop-blur-sm shrink-0">
      {/* Mode tabs — only show if more than 1 mode visible */}
      {visibleModes.length > 1 ? (
        <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
          {visibleModes.map((mode) => {
            const Icon = mode.icon;
            const isActive = mode.key === activeMode;
            return (
              <Tooltip key={mode.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onModeChange(mode.key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                    aria-label={`Switch to ${mode.label} mode (${mode.shortcut})`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden sm:inline">{mode.shortLabel}</span>
                    {mode.badge && !isActive && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                        {mode.badge}
                      </Badge>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p className="font-medium">{mode.label}</p>
                  <p className="text-xs text-muted-foreground">{mode.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Keyboard className="w-3 h-3 inline mr-1" />
                    {mode.shortcut}
                  </p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <activeConfig.icon className="w-4 h-4" />
          <span>{activeConfig.label}</span>
        </div>
      )}

      {/* Context sharing indicator */}
      {visibleModes.length > 1 && <ContextIndicator activeMode={activeMode} />}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Zen mode toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground"
            onClick={onToggleZen}
            aria-label={isZenMode ? "Exit zen mode" : "Enter zen mode"}
          >
            {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{isZenMode ? "Exit zen mode" : "Zen mode — hide header"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Disclosure level control */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
            <Settings2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Level {disclosureLevel}</span>
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            AI Capability Level
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { level: 1, label: "Essential", desc: "Chat only — clean, focused" },
            { level: 2, label: "Developer", desc: "Chat + Code tools" },
            { level: 3, label: "Power User", desc: "Chat + Code + Agent" },
            { level: 4, label: "Full Access", desc: "All modes + orchestration" },
          ].map((opt) => (
            <DropdownMenuItem
              key={opt.level}
              onClick={() => onLevelChange(opt.level)}
              className={cn(
                "flex flex-col items-start gap-0.5",
                disclosureLevel === opt.level && "bg-accent"
              )}
            >
              <span className="font-medium text-sm">
                {opt.label}
                {disclosureLevel === opt.level && (
                  <Badge variant="outline" className="ml-2 text-[10px] px-1 py-0 h-4">
                    Active
                  </Badge>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{opt.desc}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ─── Loading Fallback ──────────────────────────────────────────────
function ModeSkeleton({ mode }: { mode: AIMode }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Sparkles className="w-8 h-8 animate-pulse" />
        <p className="text-sm">
          Loading {mode === "chat" ? "Chat" : mode === "code" ? "Code" : "Agent"} mode...
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function UnifiedAI() {
  const { user } = useAuth();
  const [activeMode, setActiveMode] = useState<AIMode>("chat");
  const [disclosureLevel, setDisclosureLevel] = useAIDisclosureLevel();
  const [isZenMode, setIsZenMode] = useState(false);

  // Auto-detect disclosure level from user role
  useEffect(() => {
    if (!user) return;
    const role = (user as any).role || "user";
    // Auto-suggest higher level for power users, but don't override manual setting
    const stored = localStorage.getItem("ai_disclosure_level_manual");
    if (stored) return; // User has manually set level, respect it
    if (role === "admin") setDisclosureLevel(4);
    else if (role === "manager") setDisclosureLevel(3);
    else if (role === "advisor") setDisclosureLevel(2);
  }, [user, setDisclosureLevel]);

  // Filter visible modes by disclosure level
  const visibleModes = useMemo(
    () => MODE_CONFIGS.filter((m) => m.minLevel <= disclosureLevel),
    [disclosureLevel]
  );

  // Handle mode change with validation
  const handleModeChange = useCallback(
    (mode: AIMode) => {
      const config = MODE_CONFIGS.find((m) => m.key === mode);
      if (!config || config.minLevel > disclosureLevel) {
        toast.info(`Increase your AI level to access ${config?.label || mode} mode`);
        return;
      }
      setActiveMode(mode);
    },
    [disclosureLevel]
  );

  // Handle disclosure level change
  const handleLevelChange = useCallback(
    (level: number) => {
      setDisclosureLevel(level);
      localStorage.setItem("ai_disclosure_level_manual", "true");
      // If current mode is no longer visible, switch to chat
      const modeConfig = MODE_CONFIGS.find((m) => m.key === activeMode);
      if (modeConfig && modeConfig.minLevel > level) {
        setActiveMode("chat");
      }
      toast.success(`AI level set to ${level}`);
    },
    [activeMode, setDisclosureLevel]
  );

  // Toggle zen mode (hide header for focused work)
  const handleToggleZen = useCallback(() => {
    setIsZenMode((prev) => !prev);
  }, []);

  // Register keyboard shortcuts
  useModeSwitchShortcuts(disclosureLevel, handleModeChange);

  // Escape key exits zen mode
  useEffect(() => {
    if (!isZenMode) return;
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setIsZenMode(false);
    }
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isZenMode]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Mode indicator header — hidden in zen mode */}
      {!isZenMode && (
        <ModeHeader
          activeMode={activeMode}
          onModeChange={handleModeChange}
          disclosureLevel={disclosureLevel}
          onLevelChange={handleLevelChange}
          visibleModes={visibleModes}
          isZenMode={isZenMode}
          onToggleZen={handleToggleZen}
        />
      )}

      {/* Zen mode minimal indicator — shows a thin bar to exit */}
      {isZenMode && (
        <div
          className="h-1 bg-primary/20 hover:bg-primary/40 cursor-pointer transition-colors shrink-0"
          onClick={() => setIsZenMode(false)}
          title="Click to exit zen mode (or press Escape)"
          role="button"
          aria-label="Exit zen mode"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setIsZenMode(false); }}
        />
      )}

      {/* Mode panels — keep all mounted for context preservation */}
      <div className="flex-1 overflow-hidden relative">
        <div
          className={cn(
            "absolute inset-0 transition-opacity duration-200",
            activeMode === "chat" ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0"
          )}
        >
          <Suspense fallback={<ModeSkeleton mode="chat" />}>
            <ChatPanel />
          </Suspense>
        </div>

        {disclosureLevel >= 2 && (
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-200",
              activeMode === "code" ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0"
            )}
          >
            <Suspense fallback={<ModeSkeleton mode="code" />}>
              <CodeChatPanel />
            </Suspense>
          </div>
        )}

        {disclosureLevel >= 3 && (
          <div
            className={cn(
              "absolute inset-0 transition-opacity duration-200",
              activeMode === "agent" ? "z-10 opacity-100" : "z-0 pointer-events-none opacity-0"
            )}
          >
            <Suspense fallback={<ModeSkeleton mode="agent" />}>
              <AgentPanel />
            </Suspense>
          </div>
        )}
      </div>
    </div>
  );
}
