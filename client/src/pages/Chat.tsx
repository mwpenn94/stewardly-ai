import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
  DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, ArrowUp, AudioLines, BarChart3, BookOpen, Bot, Briefcase, Building2, Calculator, Check, CheckCircle, ClipboardList,
  ChevronDown, ChevronUp, FileText, GraduationCap, Image, Key, Loader2, LogOut, Menu, MessageSquare,
  Mic, MicOff, Monitor, Package, PanelLeft, PanelLeftClose, Paperclip, PhoneOff, Plus,
  Settings, Sparkles, ThumbsDown, ThumbsUp, Trash2, User, Users,
  Video, Volume2, VolumeX, X, Fingerprint, TrendingUp, Palette, Globe, Calendar, DollarSign, Brain, Shield,
  Copy, RefreshCw, Database, Zap, FileCheck, Scale, Mail, Search, HelpCircle,
  Pin, FolderOpen, FolderPlus, MoreHorizontal, Pencil, ChevronRight, Download, GripVertical, Phone,
  LogIn, UserPlus, Lightbulb, Wrench, Activity, Link2
} from "lucide-react";
import { Streamdown } from "streamdown";
import { ReasoningChain } from "@/components/ReasoningChain";
import { LiveSession } from "@/components/LiveSession";
import { VoiceOrb } from "@/components/VoiceOrb";
import { ProgressiveMessage } from "@/components/ProgressiveMessage";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useTTS } from "@/hooks/useTTS";
import { useAnonymousChat } from "@/hooks/useAnonymousChat";
import { useGuestPreferences } from "@/hooks/useGuestPreferences";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/contexts/NotificationContext";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useLocation, useRoute } from "wouter";
import { consumePendingPrompt } from "@/lib/navigateToChat";
import { toast } from "sonner";
import type { AdvisoryMode, FocusMode, UserRole } from "@shared/types";
import { ConvItem, SortableConvItem } from "@/components/chat/ConvItem";
import { parseFocusModes, serializeFocusModes } from "@shared/types";

// ─── CONSTANTS ────────────────────────────────────────────────────
const FOCUS_OPTIONS: { value: FocusMode; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "general", label: "General", icon: <TrendingUp className="w-3.5 h-3.5" />, desc: "Open-ended advisory" },
  { value: "financial", label: "Financial", icon: <BarChart3 className="w-3.5 h-3.5" />, desc: "Financial planning focus" },
  { value: "study", label: "Study & Learn", icon: <FileText className="w-3.5 h-3.5" />, desc: "Guided study & learning" },
];

const MODE_OPTIONS: { value: AdvisoryMode; label: string; desc: string; minRole: UserRole }[] = [
  { value: "client", label: "Client Advisor", desc: "Speak directly to clients", minRole: "advisor" },
  { value: "coach", label: "Professional Coach", desc: "Coach financial professionals", minRole: "advisor" },
  { value: "manager", label: "Manager Dashboard", desc: "Team briefings & KPIs", minRole: "manager" },
];

// Dynamic prompt suggestions based on focus modes, user context, and progression
// ─── ROLE-AWARE PROMPT SYSTEM ─────────────────────────────────
// 3 of 4 prompts map to audit directions based on user role.
// The 4th prompt is always a general financial question.
type PromptEntry = { text: string; icon: string; category: FocusMode; tier: "new" | "returning" | "any" };

// Audit-direction prompts per role tier
const AUDIT_PROMPTS: Record<string, { people: PromptEntry[]; system: PromptEntry[]; usage: PromptEntry[] }> = {
  admin: {
    people: [
      { text: "How well are our advisors serving their clients this month?", icon: "👥", category: "financial", tier: "any" },
      { text: "Which professionals need coaching based on client feedback?", icon: "📋", category: "financial", tier: "returning" },
      { text: "Show me team performance across all tiers", icon: "📊", category: "financial", tier: "any" },
    ],
    system: [
      { text: "Audit our platform configuration — what needs attention?", icon: "🔧", category: "financial", tier: "any" },
      { text: "Are our compliance rules and AI settings optimized?", icon: "🛡️", category: "financial", tier: "returning" },
      { text: "What infrastructure improvements would most impact user experience?", icon: "⚙️", category: "financial", tier: "any" },
    ],
    usage: [
      { text: "What admin tools am I underutilizing?", icon: "💡", category: "general", tier: "any" },
      { text: "Help me set up better monitoring and alerts", icon: "📈", category: "general", tier: "returning" },
      { text: "What best practices should I adopt as a platform admin?", icon: "🎯", category: "general", tier: "any" },
    ],
  },
  manager: {
    people: [
      { text: "How is my team performing with their client book?", icon: "👥", category: "financial", tier: "any" },
      { text: "Which team members need support based on recent activity?", icon: "📋", category: "financial", tier: "returning" },
      { text: "Show me coaching opportunities across my team", icon: "📊", category: "financial", tier: "any" },
    ],
    system: [
      { text: "Is my team's configuration helping or hindering them?", icon: "🔧", category: "financial", tier: "any" },
      { text: "What compliance or workflow settings should I adjust?", icon: "🛡️", category: "financial", tier: "returning" },
      { text: "Audit my team's tool setup — what's missing?", icon: "⚙️", category: "financial", tier: "any" },
    ],
    usage: [
      { text: "What management features am I not using effectively?", icon: "💡", category: "general", tier: "any" },
      { text: "Help me build better team reports and dashboards", icon: "📈", category: "general", tier: "returning" },
      { text: "What best practices should I adopt as a team manager?", icon: "🎯", category: "general", tier: "any" },
    ],
  },
  advisor: {
    people: [
      { text: "How well am I serving my clients? Show me feedback trends", icon: "👥", category: "financial", tier: "any" },
      { text: "Which clients need attention based on recent interactions?", icon: "📋", category: "financial", tier: "returning" },
      { text: "Help me improve my client communication approach", icon: "📊", category: "financial", tier: "any" },
    ],
    system: [
      { text: "Is my practice setup optimized? Audit my configuration", icon: "🔧", category: "financial", tier: "any" },
      { text: "What tools and integrations should I enable?", icon: "🛡️", category: "financial", tier: "returning" },
      { text: "Review my AI settings — am I getting the best results?", icon: "⚙️", category: "financial", tier: "any" },
    ],
    usage: [
      { text: "What advisory features am I underutilizing?", icon: "💡", category: "general", tier: "any" },
      { text: "Help me build a more efficient client workflow", icon: "📈", category: "general", tier: "returning" },
      { text: "What best practices should I adopt as a financial professional?", icon: "🎯", category: "general", tier: "any" },
    ],
  },
};

// Standard prompts for all users (the 4th slot + user/client prompts)
const STANDARD_PROMPTS: PromptEntry[] = [
  // General prompts — practical life decisions
  { text: "Walk me through a major life decision I'm facing", icon: "💡", category: "general", tier: "any" },
  { text: "Help me evaluate the financial impact of a career change", icon: "🎯", category: "general", tier: "any" },
  { text: "What should I consider before buying vs renting a home?", icon: "🏠", category: "general", tier: "any" },
  { text: "Help me create a plan for paying off debt faster", icon: "📋", category: "general", tier: "any" },
  { text: "What's the smartest way to build an emergency fund?", icon: "🛟", category: "general", tier: "new" },
  { text: "Help me negotiate a raise — what data do I need?", icon: "💼", category: "general", tier: "returning" },
  // Financial prompts — insurance, planning, investing
  { text: "Am I on track for retirement? Let's run the numbers", icon: "📊", category: "financial", tier: "returning" },
  { text: "Compare term vs whole life insurance for my situation", icon: "⚖️", category: "financial", tier: "any" },
  { text: "What's an IUL and is it right for someone like me?", icon: "🛡️", category: "financial", tier: "any" },
  { text: "Help me build a tax-efficient investment strategy", icon: "📈", category: "financial", tier: "returning" },
  { text: "Walk me through Roth conversion strategies", icon: "🔄", category: "financial", tier: "any" },
  { text: "How much life insurance coverage do I actually need?", icon: "💰", category: "financial", tier: "new" },
  { text: "Explain premium financing and when it makes sense", icon: "🏦", category: "financial", tier: "any" },
  { text: "What estate planning steps should I take this year?", icon: "📜", category: "financial", tier: "returning" },
  // Study prompts
  { text: "Summarize this document and highlight key takeaways", icon: "📖", category: "study", tier: "any" },
  { text: "Create study notes and flashcards from my materials", icon: "📝", category: "study", tier: "any" },
  { text: "Quiz me on what I've uploaded so far", icon: "❓", category: "study", tier: "returning" },
  { text: "Compare these two documents side by side", icon: "🔍", category: "study", tier: "any" },
];

// Usage optimization prompts for regular users/clients
const USER_USAGE_PROMPTS: PromptEntry[] = [
  { text: "What features should I explore to get more from this platform?", icon: "💡", category: "general", tier: "any" },
  { text: "Help me set up my financial profile for better recommendations", icon: "🎯", category: "financial", tier: "new" },
  { text: "What tools am I not using that could help my financial planning?", icon: "🔍", category: "financial", tier: "returning" },
  { text: "How can I get more personalized advice from the AI?", icon: "⚙️", category: "general", tier: "any" },
];

function getDynamicPrompts(focus: FocusMode[], hasConversations: boolean, role: string): PromptEntry[] {
  const tier = hasConversations ? "returning" : "new";
  const result: PromptEntry[] = [];

  // For admin/manager/advisor: 3 audit-direction prompts + 1 standard
  const auditRole = AUDIT_PROMPTS[role];
  if (auditRole) {
    // Pick one from each audit direction
    const pickOne = (pool: PromptEntry[]) => {
      const eligible = pool.filter(p => p.tier === "any" || p.tier === tier);
      return eligible[Math.floor(Math.random() * eligible.length)];
    };
    const peoplePick = pickOne(auditRole.people);
    const systemPick = pickOne(auditRole.system);
    const usagePick = pickOne(auditRole.usage);
    if (peoplePick) result.push(peoplePick);
    if (systemPick) result.push(systemPick);
    if (usagePick) result.push(usagePick);
    // 4th slot: a standard financial/general prompt
    const standardFiltered = STANDARD_PROMPTS.filter(p => {
      const focusMatch = focus.includes(p.category);
      const tierMatch = p.tier === "any" || p.tier === tier;
      return focusMatch && tierMatch;
    });
    const shuffledStandard = [...standardFiltered].sort(() => Math.random() - 0.5);
    if (shuffledStandard.length > 0) result.push(shuffledStandard[0]);
  } else {
    // Regular user/client: 1 usage optimization prompt + 3 standard
    const usageFiltered = USER_USAGE_PROMPTS.filter(p => p.tier === "any" || p.tier === tier);
    if (usageFiltered.length > 0) {
      result.push(usageFiltered[Math.floor(Math.random() * usageFiltered.length)]);
    }
    // Fill remaining 3 from standard prompts
    const standardFiltered = STANDARD_PROMPTS.filter(p => {
      const focusMatch = focus.includes(p.category);
      const tierMatch = p.tier === "any" || p.tier === tier;
      return focusMatch && tierMatch;
    });
    const shuffled = [...standardFiltered].sort(() => Math.random() - 0.5);
    const usedCategories = new Set<string>();
    // Ensure category variety
    for (const p of shuffled) {
      if (result.length >= 4) break;
      if (!usedCategories.has(p.category)) {
        result.push(p);
        usedCategories.add(p.category);
      }
    }
    for (const p of shuffled) {
      if (result.length >= 4) break;
      if (!result.includes(p)) result.push(p);
    }
  }
  return result;
}

// Role hierarchy for access checks
const ROLE_HIERARCHY: Record<UserRole, number> = { user: 0, advisor: 1, manager: 2, admin: 3 };
function hasMinRole(userRole: string | undefined, minRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole as UserRole ?? "user"] >= ROLE_HIERARCHY[minRole];
}

// Typing animation hook
function useTypingAnimation(text: string, speed = 40) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(timer);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);
  return { displayed, done };
}

// ─── WELCOME SCREEN COMPONENT ─────────────────────────────────
function WelcomeScreen({ avatarUrl, userName, selectedFocus, hasConversations, ttsEnabled, onPromptClick, isAuthenticated, userRole, isGuest }: {
  avatarUrl?: string | null;
  userName?: string | null;
  selectedFocus: FocusMode[];
  hasConversations: boolean;
  ttsEnabled: boolean;
  onPromptClick: (text: string) => void;
  isAuthenticated: boolean;
  userRole: string;
  isGuest: boolean;
}) {
  const displayName = userName && !isGuest && userName !== "Guest User" && userName !== "Guest" ? userName.split(" ")[0] : null;
  const greeting = `Good ${new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}${displayName ? `, ${displayName}` : ""}`;
  const { displayed: typedGreeting, done: greetingDone } = useTypingAnimation(greeting, 35);
  const [prompts] = useState(() => getDynamicPrompts(selectedFocus, hasConversations, userRole));

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pb-16 sm:pb-32">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-xl sm:text-3xl font-semibold mb-2 sm:mb-3">
          {typedGreeting}
          {!greetingDone && <span className="inline-block w-0.5 h-6 bg-accent ml-0.5 animate-pulse" />}
        </h1>
        <p className={`text-muted-foreground text-sm mb-4 sm:mb-8 max-w-md mx-auto transition-opacity duration-700 ${greetingDone ? "opacity-100" : "opacity-0"}`}>
          What can I help you with?
        </p>

        <div data-tour="suggested-prompts" className={`grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto transition-all duration-700 ${greetingDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {prompts.map((prompt, i) => (
            <button
              key={i}
              className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-accent/30 transition-all text-left text-sm group"
              onClick={() => onPromptClick(prompt.text)}
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-accent shrink-0 group-hover:scale-110 transition-transform">{prompt.icon}</span>
              <span className="text-foreground/80 text-xs leading-snug">{prompt.text}</span>
            </button>
          ))}
        </div>

        {/* Guest sign-in prompt — hidden on mobile where header already has sign-in */}
        {isGuest && greetingDone && (
          <div className="hidden sm:block mt-6 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
              <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                <LogIn className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs text-emerald-300 font-medium">You're exploring as a guest</p>
                <p className="text-[10px] text-muted-foreground">Sign in to save conversations, unlock all features, and enrich your profile with LinkedIn, Google, or email.</p>
              </div>
              <button
                onClick={() => window.location.href = getLoginUrl()}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium"
              >
                Sign In
              </button>
            </div>
          </div>
        )}

        {/* Onboarding Checklist — hidden on mobile for guests to reduce crowding */}
        {!hasConversations && !isGuest && (
          <div className={`mt-4 sm:mt-8 max-w-lg mx-auto transition-all duration-700 delay-500 ${greetingDone ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <OnboardingChecklist
              workflowType="professional_onboarding"
              compact
              enabled={isAuthenticated}
              onStepAction={(key) => {
                const stepActions: Record<string, () => void> = {
                  profile: () => window.location.assign("/settings/profile"),
                  suitability: () => window.location.assign("/settings/suitability"),
                  org_join: () => window.location.assign("/organizations"),
                  ai_settings: () => window.location.assign("/settings/ai-tuning"),
                  first_chat: () => onPromptClick("Tell me about your financial planning capabilities"),
                  knowledge_base: () => window.location.assign("/settings/knowledge"),
                  explore_tools: () => onPromptClick("Show me the financial tools available"),
                  connect_advisor: () => window.location.assign("/matching"),
                  explore_planning: () => onPromptClick("Help me create a financial plan"),
                };
                const action = stepActions[key];
                if (action) action();
                else onPromptClick(`Help me with: ${key.replace(/_/g, " ")}`);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function Chat() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();
  const [matchChat, paramsChat] = useRoute("/chat/:id");
  const utils = trpc.useUtils();
  const { notifications, unreadCount, connected: wsConnected, markAsRead, markAllAsRead, clearNotifications } = useNotifications();

  // ─── STATE ──────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState<number | null>(
    matchChat && paramsChat?.id ? parseInt(paramsChat.id) : null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [selectedFocus, setSelectedFocus] = useState<FocusMode[]>(["general", "financial"]);
  const focusSerialized = serializeFocusModes(selectedFocus);

  const toggleFocus = (mode: FocusMode) => {
    setSelectedFocus(prev => {
      if (prev.includes(mode)) {
        // Don't allow deselecting all — keep at least one
        if (prev.length <= 1) return prev;
        return prev.filter(m => m !== mode);
      }
      return [...prev, mode];
    });
  };
  const [mode, setMode] = useState<AdvisoryMode>("client");
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [liveSessionMode, setLiveSessionMode] = useState<"camera" | "screen" | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{ id: number; name: string; color: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");
  const [expandedFolders, setExpandedFolders] = useState<Set<number>>(new Set());

  // ─── HANDS-FREE & VOICE STATE ──────────────────────────────────
  const [handsFreeActive, setHandsFreeActive] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const stored = localStorage.getItem("tts-enabled");
    return stored !== "false"; // Default ON
  });

  // ─── REFS ──────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handleSendRef = useRef<(text: string) => void>(() => {});

  // ─── GUARD REF ─────────────────────────────────────────────────
  // Blocks voice recognition during TTS playback AND AI processing.
  // The voice hook checks this before starting/restarting.
  const guardRef = useRef(false);
  // Track hands-free processing state for UI (not a React state to avoid re-render loops)
  const processingRef = useRef(false);
  const [, forceUpdate] = useState(0);

  // ─── ENHANCED TTS ─────────────────────────────────────────────
  // Read voice preference from localStorage (set in Settings > Voice tab)
  const [ttsVoice] = useState(() => localStorage.getItem("tts-voice") || "aria");
  const [ttsRate] = useState(() => {
    const stored = localStorage.getItem("tts-speech-rate");
    return stored ? parseFloat(stored) : 1.0;
  });
  const tts = useTTS({
    enabled: ttsEnabled,
    voice: ttsVoice,
    rate: ttsRate,
    onStart: () => {
      guardRef.current = true;
    },
    onEnd: () => {
      guardRef.current = false;
      processingRef.current = false;
      forceUpdate(n => n + 1);
      // In hands-free mode, restart listening after TTS completes
      if (handsFreeActive) {
        setTimeout(() => voice.start(), 600);
      }
    },
  });

  // ─── VOICE RECOGNITION (STATE MACHINE) ────────────────────────
  // The voice hook uses a state machine internally:
  //   IDLE → LISTENING → SENT → (wait for start()) → LISTENING
  // After sending a transcript, it moves to SENT and NEVER auto-restarts.
  // Only an explicit start() call (from tts.onEnd or the finally block) restarts it.
  const voice = useVoiceRecognition({
    enabled: handsFreeActive,
    silenceTimeout: 1800,
    lang: "en-US",
    onTranscript: (text) => {
      // Recognition already stopped itself (moved to SENT state).
      // Set guard so it can't restart, then send the message.
      guardRef.current = true;
      processingRef.current = true;
      setInput("");
      forceUpdate(n => n + 1);
      handleSendRef.current(text);
    },
    onInterim: (text) => {
      if (handsFreeActive && !processingRef.current && !tts.isSpeaking) {
        setInput(text);
      }
    },
    guardRef,
  });

  // Derive voice state for UI
  const voiceState: "idle" | "listening" | "processing" | "speaking" =
    tts.isSpeaking ? "speaking" :
    (isStreaming || processingRef.current) ? "processing" :
    voice.isListening ? "listening" :
    "idle";

  // ─── ANONYMOUS MODE ──────────────────────────────────────────
  const isAnonymous = !isAuthenticated && typeof window !== 'undefined' && localStorage.getItem('anonymousMode') === 'true';
  const allowQueries = isAuthenticated || isAnonymous;
  const anonChat = useAnonymousChat();
  const anonSendMutation = trpc.anonymousChat.send.useMutation();
  const guestPrefs = useGuestPreferences();

  // ─── QUERIES ──────────────────────────────────────────────────
  const conversationsQuery = trpc.conversations.list.useQuery(undefined, { enabled: isAuthenticated });
  const messagesQuery = trpc.conversations.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId && isAuthenticated }
  );
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const avatarUrl = settingsQuery.data?.avatarUrl;

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);
  const searchResults = trpc.conversations.search.useQuery(
    { query: debouncedSearch, limit: 20 },
    { enabled: isAuthenticated && debouncedSearch.length > 0 }
  );

  // ─── MUTATIONS ────────────────────────────────────────────────
  const sendMutation = trpc.chat.send.useMutation();
  const createConversation = trpc.conversations.create.useMutation();
  const deleteConversation = trpc.conversations.delete.useMutation();
  const feedbackMutation = trpc.feedback.submit.useMutation();
  const visualMutation = trpc.visual.generate.useMutation();

  // ─── FOLDER & PIN QUERIES/MUTATIONS ────────────────────────
  const foldersQuery = trpc.conversations.folders.useQuery(undefined, { enabled: isAuthenticated });
  const togglePinMutation = trpc.conversations.togglePin.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const moveToFolderMutation = trpc.conversations.moveToFolder.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });
  const createFolderMutation = trpc.conversations.createFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); setFolderDialogOpen(false); setNewFolderName(""); },
  });
  const updateFolderMutation = trpc.conversations.updateFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); setEditingFolder(null); },
  });
  const deleteFolderMutation = trpc.conversations.deleteFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); utils.conversations.list.invalidate(); },
  });
  const reorderMutation = trpc.conversations.reorder.useMutation();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const convs = conversationsQuery.data || [];
    const pinnedConvs = convs.filter((c: any) => c.pinned);
    const oldIndex = pinnedConvs.findIndex((c: any) => c.id === active.id);
    const newIndex = pinnedConvs.findIndex((c: any) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(pinnedConvs, oldIndex, newIndex);
    const updates = reordered.map((c: any, i: number) => ({ id: c.id, sortOrder: i }));
    reorderMutation.mutate({ updates }, { onSuccess: () => utils.conversations.list.invalidate() });
  }, [conversationsQuery.data, reorderMutation, utils]);

  // Export conversation
  const handleExportConversation = useCallback(async (convId: number, format: "markdown" | "json") => {
    try {
      const result = await utils.conversations.export.fetch({ id: convId, format });
      const blob = new Blob([result.content], { type: format === "json" ? "application/json" : "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
  }, [utils]);

  // Group conversations by pinned, folder, and unfiled
  const groupedConversations = useMemo(() => {
    const convs = conversationsQuery.data || [];
    const pinned = convs.filter((c: any) => c.pinned);
    const folders = foldersQuery.data || [];
    const folderGroups = folders.map((f: any) => ({
      ...f,
      conversations: convs.filter((c: any) => !c.pinned && c.folderId === f.id),
    }));
    const unfiled = convs.filter((c: any) => !c.pinned && !c.folderId);
    return { pinned, folderGroups, unfiled };
  }, [conversationsQuery.data, foldersQuery.data]);

  const toggleFolderExpand = (folderId: number) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId); else next.add(folderId);
      return next;
    });
  };

  // ─── EFFECTS ──────────────────────────────────────────────────
  // Consume pending prompt from hub navigation (sessionStorage)
  useEffect(() => {
    const pending = consumePendingPrompt();
    if (pending) {
      setInput(pending.prompt);
      if (pending.focus) {
        setSelectedFocus([pending.focus]);
      }
      // Focus the textarea after a brief delay to let the component render
      setTimeout(() => textareaRef.current?.focus(), 300);
    }
  }, []);
  useEffect(() => {
    if (matchChat && paramsChat?.id) setConversationId(parseInt(paramsChat.id));
  }, [matchChat, paramsChat?.id]);

  useEffect(() => {
    if (messagesQuery.data) setMessages(messagesQuery.data);
  }, [messagesQuery.data]);

  // Auto-scroll only when user is near bottom (IntersectionObserver pattern)
  useEffect(() => {
    const sentinel = messagesEndRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => { isNearBottomRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  // ─── HANDS-FREE TOGGLE ────────────────────────────────────────
  const toggleHandsFree = useCallback(() => {
    if (handsFreeActive) {
      // Deactivate
      setHandsFreeActive(false);
      voice.stop();
      tts.cancel();
    } else {
      // Activate — play a chime-like confirmation, then start listening
      setHandsFreeActive(true);
      setTtsEnabled(true); // Force TTS on in hands-free
      tts.speak("Hands-free mode active.");
    }
  }, [handsFreeActive, voice, tts]);

   // ─── SEND MESSAGE ───────────────────────────────────────────
  const handleSendWithText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;

    const userMsg = { role: "user" as const, content: trimmed, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    try {
      // ─── ANONYMOUS PATH ───
      if (isAnonymous) {
        // Ensure we have an active anon conversation
        if (!anonChat.activeConversation) {
          if (anonChat.atConversationLimit) {
            toast.error("You've reached the free conversation limit. Sign up to continue!");
            setIsStreaming(false);
            return;
          }
          anonChat.createConversation();
        }
        if (anonChat.atMessageLimit) {
          toast.error("Message limit reached for this conversation. Start a new one or sign up!");
          setIsStreaming(false);
          return;
        }

        anonChat.addMessage("user", trimmed);

        // Build message history for the anonymous endpoint
        const anonHistory = [...(anonChat.activeConversation?.messages || []).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })), { role: "user" as const, content: trimmed }];

        const result = await anonSendMutation.mutateAsync({
          messages: anonHistory,
          focus: selectedFocus[0] || "general",
          guestPreferences: guestPrefs.preferences,
        });

        anonChat.addMessage("assistant", typeof result.content === 'string' ? result.content : String(result.content));
        const assistantMsg = {
          role: "assistant" as const,
          content: result.content,
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        if (ttsEnabled) tts.speak(typeof result.content === 'string' ? result.content : String(result.content));
        return;
      }

      // ─── AUTHENTICATED PATH ───
      let activeConvId = conversationId;
      if (!activeConvId) {
        const newConv = await createConversation.mutateAsync({ mode, title: trimmed.slice(0, 80) });
        activeConvId = newConv.id;
        setConversationId(activeConvId);
        navigate(`/chat/${activeConvId}`, { replace: true });
        utils.conversations.list.invalidate();
      }

      const result = await sendMutation.mutateAsync({
        content: trimmed,
        conversationId: activeConvId,
        mode,
        focus: focusSerialized,
      });

      const assistantMsg = {
        id: result.id,
        role: "assistant" as const,
        content: result.content,
        confidenceScore: result.confidenceScore,
        complianceStatus: result.complianceStatus,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);

      if (ttsEnabled) {
        tts.speak(result.content);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setIsStreaming(false);
      setAttachments([]);
      // If hands-free is active and TTS is NOT about to speak (no ttsEnabled or error path),
      // release the guard and restart listening.
      // If TTS IS enabled, the guard stays on until tts.onEnd releases it and restarts listening.
      if (handsFreeActive && !ttsEnabled) {
        guardRef.current = false;
        processingRef.current = false;
        forceUpdate(n => n + 1);
        setTimeout(() => voice.start(), 600);
      }
    }
  };

  const handleSend = () => handleSendWithText(input);

  // Keep the ref in sync for voice recognition callback
  useEffect(() => {
    handleSendRef.current = handleSendWithText;
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ─── FILE HANDLING ────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
    e.target.value = "";
  };
  const removeAttachment = (i: number) => setAttachments(prev => prev.filter((_, idx) => idx !== i));

  // ─── CONVERSATION MANAGEMENT ──────────────────────────────────
  const handleNewConversation = () => {
    setConversationId(null);
    setMessages([]);
    navigate("/");
    setSidebarOpen(false);
  };

  const handleDeleteConversation = async (id: number) => {
    await deleteConversation.mutateAsync({ id });
    if (conversationId === id) handleNewConversation();
    utils.conversations.list.invalidate();
  };

  // ─── KEYBOARD SHORTCUTS ──────────────────────────────────────────
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      // G-then-X navigation (only when not in input)
      if (!isInput && !isMod && !e.shiftKey) {
        if (e.key.toLowerCase() === "g") {
          gPressedRef.current = true;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          gTimerRef.current = setTimeout(() => { gPressedRef.current = false; }, 800);
          return;
        }
        if (gPressedRef.current) {
          gPressedRef.current = false;
          if (gTimerRef.current) clearTimeout(gTimerRef.current);
          const k = e.key.toLowerCase();
          if (k === "c") { e.preventDefault(); navigate("/"); return; }
          if (k === "s") { e.preventDefault(); navigate("/settings/profile"); return; }
          if (k === "h") { e.preventDefault(); navigate("/help"); return; }
        }
      }

      // Ctrl/Cmd + Shift + N  → New conversation
      if (isMod && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNewConversation();
        return;
      }

      // Ctrl/Cmd + K  → Search conversations
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSidebarOpen(true);
        setSidebarCollapsed(false);
        setSearchOpen(true);
        // Focus search input after render
        setTimeout(() => {
          const searchInput = document.querySelector('[data-search-input]') as HTMLInputElement;
          searchInput?.focus();
        }, 100);
        return;
      }

      // Ctrl/Cmd + Shift + S  → Toggle sidebar
      if (isMod && e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
        return;
      }

      // / → Focus chat input (only when not in input)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        textareaRef.current?.focus();
        return;
      }

      // Esc → Close menus
      if (e.key === "Escape") {
        if (showAddMenu) { setShowAddMenu(false); return; }
        if (showModeMenu) { setShowModeMenu(false); return; }
        if (showFocusPicker) { setShowFocusPicker(false); return; }
        if (searchOpen) { setSearchOpen(false); setSearchQuery(""); return; }
      }

      // Ctrl/Cmd + Enter → Send message (when in textarea)
      if (isMod && e.key === "Enter" && isInput) {
        e.preventDefault();
        handleSend();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (gTimerRef.current) clearTimeout(gTimerRef.current);
    };
  }, [showAddMenu, showModeMenu, showFocusPicker, searchOpen]);

  const handleFeedback = async (messageId: number, rating: "up" | "down") => {
    if (!conversationId) return;
    await feedbackMutation.mutateAsync({ messageId, conversationId, rating });
    toast.success(rating === "up" ? "Thanks for the feedback!" : "Noted — we'll improve");
  };

  // ─── ROLE-BASED MODE FILTERING ────────────────────────────────
  const userRole = (user?.role as UserRole) || "user";
  const availableModes = useMemo(() => {
    return MODE_OPTIONS.filter(m => hasMinRole(userRole, m.minRole));
  }, [userRole]);
  const showModes = availableModes.length > 0;

  // ─── SIDEBAR NAV STATE (must be before auth gate to maintain hook order) ─
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(false);

  // ─── AUTH GATE ────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  // Allow anonymous/guest users to use the chat

  const isWelcome = messages.length === 0 && !conversationId;
  const focusLabel = selectedFocus.length === FOCUS_OPTIONS.length
    ? "All Modes"
    : selectedFocus.map(f => FOCUS_OPTIONS.find(o => o.value === f)?.label).filter(Boolean).join(" + ");

  // ─── SIDEBAR NAV ITEMS (role-aware) ───────────────────────────

  // Consolidated navigation (C26) — 7 hub items replacing 28 individual pages
  const toolsNav = [
    { icon: <Zap className="w-3.5 h-3.5" />, label: "Operations", href: "/operations", minRole: "user" as UserRole },
    { icon: <Brain className="w-3.5 h-3.5" />, label: "Intelligence", href: "/intelligence-hub", minRole: "user" as UserRole },
    { icon: <Package className="w-3.5 h-3.5" />, label: "Advisory", href: "/advisory", minRole: "user" as UserRole },
    { icon: <Users className="w-3.5 h-3.5" />, label: "Relationships", href: "/relationships", minRole: "user" as UserRole },
    { icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Market Data", href: "/market-data", minRole: "user" as UserRole },
    { icon: <FileText className="w-3.5 h-3.5" />, label: "Documents", href: "/documents", minRole: "user" as UserRole },
    { icon: <Link2 className="w-3.5 h-3.5" />, label: "Integrations", href: "/integrations", minRole: "user" as UserRole },
  ];

  const adminNav = [
    { icon: <Briefcase className="w-3.5 h-3.5" />, label: "Portal", href: "/portal", minRole: "advisor" as UserRole },
    { icon: <Building2 className="w-3.5 h-3.5" />, label: "Organizations", href: "/organizations", minRole: "advisor" as UserRole },
    { icon: <BarChart3 className="w-3.5 h-3.5" />, label: "Manager Dashboard", href: "/manager", minRole: "manager" as UserRole },
    { icon: <Globe className="w-3.5 h-3.5" />, label: "Global Admin", href: "/admin", minRole: "admin" as UserRole },
    { icon: <Activity className="w-3.5 h-3.5" />, label: "Improvement Engine", href: "/improvement", minRole: "advisor" as UserRole },
  ];

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ─── SIDEBAR ──────────────────────────────────────────── */}
      <aside className={`
        fixed lg:relative z-50 h-full bg-card border-r border-border flex flex-col
        transition-all duration-200
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        ${sidebarCollapsed ? "w-14" : "w-72"}
      `}>
        <div className={`flex items-center border-b border-border shrink-0 ${sidebarCollapsed ? "p-2 justify-center" : "p-3 justify-between"}`}>
          {sidebarCollapsed ? (
            <div className="flex flex-col gap-1 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={handleNewConversation}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Conversation</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => { setSidebarCollapsed(false); setSearchOpen(true); }}>
                    <Search className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Search Conversations</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="gap-2 text-xs flex-1 justify-start" onClick={handleNewConversation}>
                <Plus className="w-3.5 h-3.5" /> New Conversation
              </Button>
              <div className="flex items-center gap-0.5">
                <Button variant="ghost" size="icon-sm" onClick={() => setSearchOpen(!searchOpen)}>
                  <Search className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Search bar */}
        {searchOpen && !sidebarCollapsed && (
          <div className="px-2 py-2 border-b border-border shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                data-search-input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-secondary/30 border-border/50"
                autoFocus
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => { setSearchQuery(""); setSearchOpen(false); }}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable conversation list — grows to fill available space */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* Search results */}
          {searchOpen && debouncedSearch.length > 0 ? (
            <div className="p-2 space-y-0.5">
              {searchResults.isLoading && (
                <div className="space-y-2 p-2">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              )}
              {searchResults.data?.length === 0 && !searchResults.isLoading && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  <Search className="w-5 h-5 mx-auto mb-2 opacity-40" />
                  No conversations found
                </div>
              )}
              {searchResults.data?.map((result: any) => (
                <div
                  key={result.id}
                  className={`group flex flex-col gap-0.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${
                    result.id === conversationId ? "bg-accent/10 text-accent" : "hover:bg-secondary/50 text-foreground"
                  }`}
                  onClick={() => {
                    setConversationId(result.id);
                    navigate(`/chat/${result.id}`);
                    setSidebarOpen(false);
                    setSearchQuery("");
                    setSearchOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-50" />
                    <span className="truncate flex-1 font-medium">{result.title || "New Conversation"}</span>
                  </div>
                  {result.matchType === "message" && result.matchSnippet && (
                    <p className="text-[10px] text-muted-foreground truncate pl-5.5 italic">
                      ...{result.matchSnippet}...
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
          <div className={sidebarCollapsed ? "p-1 space-y-1" : "p-2 space-y-0.5"}>
            {sidebarCollapsed ? (
              /* Collapsed: simple icon list */
              conversationsQuery.data?.map((conv: any) => (
                <Tooltip key={conv.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex items-center justify-center p-2 rounded-lg cursor-pointer transition-colors ${
                        conv.id === conversationId ? "bg-accent/10 text-accent" : "hover:bg-secondary/50 text-muted-foreground"
                      }`}
                      onClick={() => { setConversationId(conv.id); navigate(`/chat/${conv.id}`); setSidebarOpen(false); }}
                    >
                      {conv.pinned ? <Pin className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{conv.pinned ? "📌 " : ""}{conv.title || "New Conversation"}</TooltipContent>
                </Tooltip>
              ))
            ) : (
              /* Expanded: grouped by pinned → folders → unfiled */
              <>
                {/* Pinned section — draggable */}
                {groupedConversations.pinned.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <Pin className="w-3 h-3" /> Pinned
                    </div>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={groupedConversations.pinned.map((c: any) => c.id)} strategy={verticalListSortingStrategy}>
                        {groupedConversations.pinned.map((conv: any) => (
                          <SortableConvItem key={conv.id} conv={conv} conversationId={conversationId} navigate={navigate}
                            setSidebarOpen={setSidebarOpen} setConversationId={setConversationId}
                            handleDeleteConversation={handleDeleteConversation}
                            togglePinMutation={togglePinMutation} moveToFolderMutation={moveToFolderMutation}
                            handleExportConversation={handleExportConversation}
                            folders={foldersQuery.data || []} />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                )}

                {/* Folder sections */}
                {groupedConversations.folderGroups.map((folder: any) => (
                  folder.conversations.length > 0 && (
                    <div key={folder.id} className="mb-1">
                      <button
                        className="flex items-center gap-1.5 px-2 py-1 w-full text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors group"
                        onClick={() => toggleFolderExpand(folder.id)}
                      >
                        <ChevronRight className={`w-3 h-3 transition-transform ${expandedFolders.has(folder.id) ? "rotate-90" : ""}`} />
                        <FolderOpen className="w-3 h-3" style={{ color: folder.color }} />
                        <span className="flex-1 text-left truncate">{folder.name}</span>
                        <span className="text-[9px] opacity-60">{folder.conversations.length}</span>
                      </button>
                      {expandedFolders.has(folder.id) && folder.conversations.map((conv: any) => (
                        <ConvItem key={conv.id} conv={conv} conversationId={conversationId} navigate={navigate}
                          setSidebarOpen={setSidebarOpen} setConversationId={setConversationId}
                          handleDeleteConversation={handleDeleteConversation}
                          togglePinMutation={togglePinMutation} moveToFolderMutation={moveToFolderMutation}
                          handleExportConversation={handleExportConversation}
                          folders={foldersQuery.data || []} indent />
                      ))}
                    </div>
                  )
                ))}

                {/* Folder management button */}
                {isAuthenticated && (
                  <button
                    className="flex items-center gap-1.5 px-2 py-1 w-full text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => { setEditingFolder(null); setNewFolderName(""); setNewFolderColor("#6366f1"); setFolderDialogOpen(true); }}
                  >
                    <FolderPlus className="w-3 h-3" /> New Folder
                  </button>
                )}

                {/* Unfiled conversations */}
                {groupedConversations.unfiled.length > 0 && (groupedConversations.pinned.length > 0 || groupedConversations.folderGroups.some((f: any) => f.conversations.length > 0)) && (
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                    <MessageSquare className="w-3 h-3" /> Conversations
                  </div>
                )}
                {groupedConversations.unfiled.map((conv: any) => (
                  <ConvItem key={conv.id} conv={conv} conversationId={conversationId} navigate={navigate}
                    setSidebarOpen={setSidebarOpen} setConversationId={setConversationId}
                    handleDeleteConversation={handleDeleteConversation}
                    togglePinMutation={togglePinMutation} moveToFolderMutation={moveToFolderMutation}
                    handleExportConversation={handleExportConversation}
                    folders={foldersQuery.data || []} />
                ))}
              </>
            )}
            {conversationsQuery.isLoading && (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            )}
          </div>
          )}
        </div>

        {/* Compact navigation — collapsible sections to preserve conversation space */}
        <div className="border-t border-border shrink-0 max-h-[45%] overflow-y-auto">
          {sidebarCollapsed ? (
            <div className="p-1 space-y-1">
              {toolsNav.filter(item => hasMinRole(userRole, item.minRole)).slice(0, 6).map(item => (
                <Tooltip key={item.href}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                      className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {item.icon}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ))}
              <Separator className="mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { navigate("/help"); setSidebarOpen(false); }}
                    className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Help & Support</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                    className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  >
                    <Fingerprint className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <button
                onClick={() => setToolsExpanded(!toolsExpanded)}
                className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium hover:text-muted-foreground transition-colors"
              >
                <span>Tools</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${toolsExpanded ? "rotate-180" : ""}`} />
              </button>
              {toolsExpanded && (
                <div data-tour="sidebar-nav" className="px-1 pb-1 grid grid-cols-2 gap-0.5">
                  {toolsNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
                    <button
                      key={item.href}
                      onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                    >
                      {item.icon} <span className="truncate">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {adminNav.filter(item => hasMinRole(userRole, item.minRole)).length > 0 && (
                <>
                  <button
                    onClick={() => setAdminExpanded(!adminExpanded)}
                    className="flex items-center justify-between w-full px-3 py-2 text-[10px] text-muted-foreground/70 uppercase tracking-wider font-medium hover:text-muted-foreground transition-colors"
                  >
                    <span>Admin</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${adminExpanded ? "rotate-180" : ""}`} />
                  </button>
                  {adminExpanded && (
                    <div className="px-1 pb-1">
                      {adminNav.filter(item => hasMinRole(userRole, item.minRole)).map(item => (
                        <button
                          key={item.href}
                          onClick={() => { navigate(item.href); setSidebarOpen(false); }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                        >
                          {item.icon} {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <div className="px-1 pb-1">
                <button
                  onClick={() => { navigate("/help"); setSidebarOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                >
                  <HelpCircle className="w-3.5 h-3.5" /> Help & Support
                </button>
                <button
                  onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors w-full"
                >
                  <Fingerprint className="w-3.5 h-3.5" /> Settings
                </button>
              </div>
              {/* Desktop notification bell */}
              <div className="hidden lg:flex items-center justify-center px-2 pb-1">
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadCount}
                  connected={wsConnected}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onClear={clearNotifications}
                />
                {!sidebarCollapsed && unreadCount > 0 && (
                  <span className="text-[10px] text-muted-foreground ml-1">{unreadCount} unread</span>
                )}
              </div>
            </>
          )}
          <Separator className="mx-2" />
          {/* ─── PERSISTENT AUTH CONTROLS ─── */}
          {user?.authTier === "anonymous" ? (
            /* Guest user: always show sign-in CTA */
            sidebarCollapsed ? (
              <div className="p-2 space-y-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (user?.openId) sessionStorage.setItem("guest-openId", user.openId);
                        window.location.href = getLoginUrl();
                      }}
                      className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 hover:bg-emerald-500/30 transition-colors mx-auto"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Sign in to save your progress</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { logout(); }}
                      className="w-7 h-7 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors mx-auto"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Clear guest session</TooltipContent>
                </Tooltip>
              </div>
            ) : (
              <div className="px-3 py-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <User className="w-3 h-3 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-amber-300 font-medium block">Guest</span>
                    <span className="text-[10px] text-muted-foreground">Session is temporary</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (user?.openId) sessionStorage.setItem("guest-openId", user.openId);
                    window.location.href = getLoginUrl();
                  }}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-colors text-xs font-medium"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In to Save Progress
                </button>
                <button
                  onClick={() => { logout(); }}
                  className="flex items-center justify-center gap-1.5 w-full px-3 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors text-[11px]"
                >
                  <LogOut className="w-3 h-3" /> Clear Session
                </button>
              </div>
            )
          ) : (
            /* Authenticated user: show user info + sign-out */
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"}`}>
              {sidebarCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent cursor-pointer" onClick={() => setSidebarCollapsed(false)}>
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{user?.name || "User"} — Click to expand</TooltipContent>
                </Tooltip>
              ) : (
                <>
                  <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent">
                    {user?.name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs truncate block">{user?.name || "User"}</span>
                    <span className="text-[10px] text-muted-foreground capitalize">{userRole}</span>
                  </div>
                  <button onClick={() => setSidebarCollapsed(true)} className="text-muted-foreground hover:text-foreground" title="Collapse sidebar">
                    <PanelLeftClose className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => logout()} className="text-muted-foreground hover:text-foreground" title="Sign out">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ─── MAIN CHAT AREA ───────────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile-only sidebar toggle + escalation + guest sign-in */}
        <div className="lg:hidden flex items-center h-12 px-3 shrink-0 justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-1.5">
            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              connected={wsConnected}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              onClear={clearNotifications}
            />
            {user?.authTier === "anonymous" && (
              <Button
                variant="outline"
                size="sm"
                className="text-[10px] h-7 gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                onClick={() => {
                  if (user?.openId) sessionStorage.setItem("guest-openId", user.openId);
                  window.location.href = getLoginUrl();
                }}
              >
                <LogIn className="w-3 h-3" /> Sign In
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="text-[10px] h-7 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
              onClick={() => navigate("/professionals")}
            >
              <Phone className="w-3 h-3" /> Talk to a Pro
            </Button>
          </div>
        </div>

        {/* ─── LIVE SESSION ──────────────────────────────────── */}
        {liveSessionMode && (
          <div className="px-4 py-3 border-b border-border">
            <LiveSession
              conversationId={conversationId}
              onConversationCreated={(id) => {
                setConversationId(id);
                navigate(`/chat/${id}`, { replace: true });
                utils.conversations.list.invalidate();
              }}
              focus={focusSerialized}
              mode={mode}
              onEnd={() => setLiveSessionMode(null)}
              initialMode={liveSessionMode}
            />
          </div>
        )}

        {/* ─── MESSAGES AREA ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          {isWelcome ? (
            <WelcomeScreen
              avatarUrl={avatarUrl}
              userName={user?.name}
              selectedFocus={selectedFocus}
              hasConversations={!!conversationsQuery.data?.length}
              ttsEnabled={ttsEnabled}
              onPromptClick={(text) => { setInput(text); textareaRef.current?.focus(); }}
              isAuthenticated={isAuthenticated}
              userRole={userRole}
              isGuest={user?.authTier === "anonymous"}
            />
          ) : (
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
              {messages.map((msg: any, i: number) => (
                <div key={msg.id || i} className={`group/msg flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                  {msg.role === "assistant" && (
                    <div className={`w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shrink-0 mt-0.5 ${tts.isSpeaking && i === messages.length - 1 ? "avatar-talking" : ""} ${avatarUrl ? "" : "bg-accent/10"}`}>
                      {avatarUrl ? <img src={avatarUrl} alt="AI" className="w-full h-full object-cover" /> : <Bot className="w-3.5 h-3.5 text-accent" />}
                    </div>
                  )}
                  <div className={`max-w-[85%]`}>
                    {msg.role === "user" ? (
                      <div className="bg-accent/15 rounded-2xl rounded-tr-sm px-4 py-2.5">
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    ) : (
                      <div>
                        {/* AI Badge (2B) */}
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
                          {/* Render inline images if present in metadata */}
                          {msg.metadata?.imageUrl && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-border max-w-md">
                              <img src={msg.metadata.imageUrl} alt="AI generated visual" className="w-full h-auto" />
                            </div>
                          )}
                        </div>
                        {msg.confidenceScore != null && (
                          <ReasoningChain
                            confidenceScore={msg.confidenceScore}
                            complianceStatus={msg.complianceStatus}
                            focus={msg.metadata?.focus}
                            mode={msg.metadata?.mode}
                            hasRAG={msg.metadata?.hasRAG}
                            hasSuitability={!!user?.suitabilityCompleted}
                            responseLength={msg.content?.length}
                          />
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          {msg.id && (
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-green-400 transition-colors" onClick={() => handleFeedback(msg.id, "up")}>
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Good response</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors" onClick={() => handleFeedback(msg.id, "down")}>
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Bad response</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied"); }}>
                                  <Copy className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Copy</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => tts.speak(msg.content)}>
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Read aloud</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-amber-400 transition-colors" onClick={() => { if (messages.length >= 2) { const lastUserMsg = [...messages].reverse().find(m => m.role === "user"); if (lastUserMsg) handleSendWithText(lastUserMsg.content); } }}>
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Regenerate</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-purple-400 transition-colors" onClick={async () => { toast.info("Generating infographic..."); try { const result = await visualMutation.mutateAsync({ prompt: `Create a professional infographic summarizing: ${msg.content.slice(0, 500)}` }); if (result.url) { setMessages(prev => [...prev, { role: "assistant" as const, content: `Here's the infographic:`, metadata: { imageUrl: result.url }, createdAt: new Date() }]); } } catch (e: any) { toast.error(e.message || "Failed to generate infographic"); } }} title="Generate Infographic">
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
              {/* Upgrade prompt for anonymous users */}
              {isAnonymous && anonChat.shouldPromptUpgrade && (
                <div className="px-4 py-3">
                  <UpgradePrompt
                    targetTier="email"
                    conversationCount={anonChat.conversations.length}
                    messageCount={anonChat.totalMessages}
                    compact
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Hands-free status bar with VoiceOrb */}
        {handsFreeActive && (
          <div className="flex items-center justify-center gap-3 py-2.5 bg-accent/5 border-t border-accent/20 transition-all">
            <VoiceOrb state={voiceState} size={32} />
            <div className="flex flex-col items-start min-w-0">
              <span className="text-xs text-muted-foreground font-medium">
                {voiceState === "speaking" ? "Speaking..." : voiceState === "listening" ? "Listening..." : voiceState === "processing" ? "Thinking..." : "Ready — speak anytime"}
              </span>
              {voiceState === "listening" && voice.interimText && (
                <span className="text-[11px] text-foreground/50 italic max-w-[250px] truncate">
                  "{voice.interimText}"
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={toggleHandsFree}>End</Button>
          </div>
        )}

        {/* ─── INPUT AREA (Copilot-style condensed) ────────────── */}
        <div className="p-3 sm:p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1 text-xs">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground ml-0.5">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.txt,.md,.csv,.json,.xml,.yaml,.yml" onChange={handleFileSelect} />
            <input ref={imageInputRef} type="file" className="hidden" multiple accept="image/*" onChange={handleFileSelect} />

            {/* Textarea — full width, rounded pill */}
            <div data-tour="chat-input" className="relative bg-secondary/30 rounded-2xl border border-border focus-within:border-accent/40 focus-within:shadow-[0_0_0_1px_oklch(0.68_0.16_230_/_0.15)] transition-all px-3 py-1.5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={handsFreeActive && voice.isListening ? "Listening..." : "Ask Steward anything..."}
                className="w-full resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[36px] max-h-[160px] text-sm py-2 px-0"
                rows={1}
                disabled={isStreaming}
              />
            </div>

            {/* Action bar below textarea — Copilot style: [+] [Mode v] ... [Audio] [hands-free/send] */}
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
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-xs hover:bg-secondary/60 transition-colors ${visualMutation.isPending ? "opacity-50" : ""}`}
                        disabled={visualMutation.isPending}
                        onClick={async () => {
                          setShowAddMenu(false);
                          const prompt = input.trim();
                          if (!prompt) { toast.info("Type a description first, then generate a visual"); return; }
                          try {
                            const result = await visualMutation.mutateAsync({ prompt: `Create a clear, professional visual: ${prompt}` });
                            if (result.url) {
                              const imgMsg = { role: "assistant" as const, content: `Here's the visual I created for: **${prompt}**`, metadata: { imageUrl: result.url }, createdAt: new Date() };
                              setMessages(prev => [...prev, { role: "user" as const, content: `Generate visual: ${prompt}`, createdAt: new Date() }, imgMsg]);
                              setInput("");
                            }
                          } catch (e: any) { toast.error(e.message || "Failed to generate visual"); }
                        }}
                      >
                        <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{visualMutation.isPending ? "Generating..." : "Generate visual"}</span>
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

              {/* Mode dropdown — Copilot "Smart v" style */}
              <div className="relative" data-tour="focus-mode">
                  <button
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-secondary/40 text-foreground hover:bg-secondary/60 border border-border transition-all"
                    onClick={() => setShowModeMenu(!showModeMenu)}
                  >
                  {FOCUS_OPTIONS.find(o => selectedFocus.includes(o.value))?.icon || <Sparkles className="w-3 h-3" />}
                  {FOCUS_OPTIONS.find(o => selectedFocus.includes(o.value))?.label || "General"}
                  <ChevronDown className={`w-3 h-3 transition-transform ${showModeMenu ? "rotate-180" : ""}`} />
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 w-52 animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Focus</div>
                      {FOCUS_OPTIONS.map(opt => (
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

              {/* Spacer pushes right-side buttons to far right */}
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
                    onClick={() => { setTtsEnabled(!ttsEnabled); tts.cancel(); }}
                  >
                    {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{ttsEnabled ? "Mute audio" : "Enable audio"}</TooltipContent>
              </Tooltip>

              {/* Unified hands-free / send button (rightmost, same position always) */}
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
                  onClick={handleSend}
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
      </main>


      {/* Folder Create/Edit Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{editingFolder ? "Edit Folder" : "Create Folder"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Input
              placeholder="Folder name"
              value={editingFolder ? editingFolder.name : newFolderName}
              onChange={(e) => editingFolder ? setEditingFolder({ ...editingFolder, name: e.target.value }) : setNewFolderName(e.target.value)}
              autoFocus
            />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Color:</span>
              <div className="flex gap-1.5">
                {["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"].map(c => (
                  <button
                    key={c}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      (editingFolder ? editingFolder.color : newFolderColor) === c ? "border-foreground scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => editingFolder ? setEditingFolder({ ...editingFolder, color: c }) : setNewFolderColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            {editingFolder && (
              <Button variant="destructive" size="sm" onClick={() => {
                deleteFolderMutation.mutate({ id: editingFolder.id });
                setFolderDialogOpen(false);
              }}>Delete</Button>
            )}
            <Button size="sm" onClick={() => {
              if (editingFolder) {
                updateFolderMutation.mutate({ id: editingFolder.id, name: editingFolder.name, color: editingFolder.color });
              } else if (newFolderName.trim()) {
                createFolderMutation.mutate({ name: newFolderName.trim(), color: newFolderColor });
              }
            }}>
              {editingFolder ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ConvItem and SortableConvItem extracted to @/components/chat/ConvItem.tsx */
