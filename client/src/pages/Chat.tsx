import { useAuth } from "@/_core/hooks/useAuth";
import { PERSONA_LAYERS as SIDEBAR_PERSONA_LAYERS, ROLE_LEVEL as SIDEBAR_ROLE_LEVEL } from "@/components/PersonaSidebar5";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loadCalculatorContext, buildContextOverlay } from "@/lib/calculatorContext";
import { SEOHead } from "@/components/SEOHead";
import TypingIndicator from "@/components/TypingIndicator";
import { EmptyConversations } from "@/components/EmptyStates";
import { useCustomShortcuts } from "@/hooks/useCustomShortcuts";
import { useSoundCues } from "@/hooks/useSoundCues";
import { prefetchRoute } from "@/lib/routePrefetch";
import { usePlatformIntelligence } from "@/components/PlatformIntelligence";
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
  ArrowUp, AudioLines, BarChart3, Bot, Briefcase, Calculator, Check,
  ChevronDown, ChevronUp, FileText, GraduationCap, Image, Loader2, LogOut, Menu, MessageSquare,
  Monitor, PanelLeftClose, Paperclip, PhoneOff, Plus,
  Settings, Sparkles, ThumbsDown, ThumbsUp, User, Users,
  Video, Volume2, VolumeX, X, Fingerprint, TrendingUp, Palette, Calendar, Brain, Shield,
  Copy, RefreshCw, Zap, Scale, Search, HelpCircle,
  Pin, FolderOpen, FolderPlus, ChevronRight, Phone,
  LogIn, GitBranch,
} from "lucide-react";
import { ReasoningChain } from "@/components/ReasoningChain";
import { LiveSession } from "@/components/LiveSession";
// Round C3 / Round E1 — inline multi-model consensus panel (lazy-loaded, only used in consensus mode)
import type { StreamEvent } from "@/components/consensus/StreamingResults";
const StreamingResults = lazy(() => import("@/components/consensus/StreamingResults").then(m => ({ default: m.StreamingResults })));
const TimingBreakdown = lazy(() => import("@/components/consensus/TimingBreakdown").then(m => ({ default: m.TimingBreakdown })));
const ComparisonView = lazy(() => import("@/components/consensus/ComparisonView").then(m => ({ default: m.ComparisonView })));
import { VoiceOrb } from "@/components/VoiceOrb";
import { ProgressiveMessage } from "@/components/ProgressiveMessage";
import RichMediaEmbed, { type MediaEmbed } from "@/components/RichMediaEmbed";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useTTS } from "@/hooks/useTTS";
import { detectStt, type SttCapabilities } from "@/lib/sttSupport";
import { VoiceSupportBanner } from "@/components/VoiceSupportBanner";
import { useFocusOnRouteChange } from "@/hooks/useFocusOnRouteChange";
import {
  createAnnouncerState,
  shouldEmitChunk,
  finalChunk,
  type AnnouncerState,
} from "@/lib/liveAnnouncer";
import { useAnonymousChat } from "@/hooks/useAnonymousChat";
import { useGuestPreferences } from "@/hooks/useGuestPreferences";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import OnboardingChecklist from "@/components/OnboardingChecklist";
import { hasMinRole } from "@/lib/navigation";
import { useOnboardingNotifications } from "@/components/OnboardingNotifications";
import ChangelogBell from "@/components/ChangelogBell";
import { SelfDiscoveryBubble } from "@/components/SelfDiscoveryBubble";
import { useSelfDiscovery } from "@/hooks/useSelfDiscovery";
import { NotificationBell } from "@/components/NotificationBell";
import { useNotifications } from "@/contexts/NotificationContext";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useLocation, useRoute, Link } from "wouter";
import { consumePendingPrompt } from "@/lib/navigateToChat";
import { toast } from "sonner";
import type { AdvisoryMode, FocusMode, UserRole } from "@shared/types";
import { ConvItem, SortableConvItem } from "@/components/chat/ConvItem";
import ChatGreetingV2 from "@/components/ChatGreeting";
// MobileChatLayout available at @/components/MobileChatLayout for future mobile-first refactor (P3 backlog)
import { parseFocusModes, serializeFocusModes } from "@shared/types";
// Pass 1 (multisensory): slash-command interceptor — lets users type
// "/go learning", "/read", "/hands-free", etc. inside the chat input to
// drive navigation/audio without ever leaving the keyboard.
import { parseIntent } from "@/lib/multisensory/intentParser";
import { dispatchIntent } from "@/lib/multisensory/useGlobalShortcuts";
import { announce } from "@/lib/multisensory/LiveAnnouncer";

// ─── RICH MEDIA EXTRACTION (client-side fallback) ─────────────────
// Mirrors server/services/richMediaService extractMediaFromResponse for the case
// where the server hasn't attached mediaEmbeds metadata (e.g. older messages
// persisted before wiring). Kept intentionally simple — server-side extraction
// is authoritative.
function extractMediaFromText(content: string): MediaEmbed[] {
  if (!content) return [];
  const embeds: MediaEmbed[] = [];
  const ytRegex = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)(?:[^\s]*?[?&]t=(\d+))?/g;
  let m: RegExpExecArray | null;
  while ((m = ytRegex.exec(content)) !== null) {
    embeds.push({
      type: "video",
      source: `https://www.youtube.com/embed/${m[1]}${m[2] ? `?start=${m[2]}` : ""}`,
      title: "Video",
      startTime: m[2] ? parseInt(m[2]) : undefined,
      metadata: { provider: "youtube", videoId: m[1] },
    });
  }
  const imgRegex = /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?\S*)?/gi;
  while ((m = imgRegex.exec(content)) !== null) {
    embeds.push({ type: "image", source: m[0], title: "Image" });
  }
  const docRegex = /https?:\/\/\S+\.(?:pdf|docx?|xlsx?)(?:\?\S*)?/gi;
  while ((m = docRegex.exec(content)) !== null) {
    embeds.push({ type: "document", source: m[0], title: "Document" });
  }
  return embeds.slice(0, 5);
}

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


export default function Chat() {
  const { user, loading: authLoading, isAuthenticated, logout } = useAuth();
  const soundCues = useSoundCues();
  // Pass 1 (multisensory build loop): wire PIL dispatcher into Chat so every
  // send / stream start / stream end / error actually fires the designed
  // multimodal feedback specs (visual toast + haptic + audio earcon/tts).
  // Prior to this the 30 feedbackSpecs were defined but had zero consumers.
  const pil = usePlatformIntelligence();
  const [location, navigate] = useLocation();
  const [matchChat, paramsChat] = useRoute("/chat/:id");
  const utils = trpc.useUtils();
  const { notifications: wsNotifications, unreadCount: wsUnreadCount, connected: wsConnected, markAsRead, markAllAsRead, clearNotifications } = useNotifications();
  const { notifications: onboardingNotifs, unreadCount: onboardingUnread } = useOnboardingNotifications();

  // Merge onboarding items into the notification list
  const notifications = useMemo(() => [...onboardingNotifs, ...wsNotifications], [onboardingNotifs, wsNotifications]);
  const unreadCount = wsUnreadCount + onboardingUnread;

  // ─── STATE ──────────────────────────────────────────────────────
  const [conversationId, setConversationId] = useState<number | null>(
    matchChat && paramsChat?.id ? parseInt(paramsChat.id) : null
  );
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [selectedFocus, setSelectedFocus] = useState<FocusMode[]>(["general", "financial"]);
  const [selectedModels, setSelectedModels] = useState<string[]>(["auto"]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [chatMode, setChatMode] = useState<"single" | "loop" | "consensus" | "codechat">("single");
  const [loopConfig, setLoopConfig] = useState({ maxIterations: 0, maxBudget: 1.0, foci: [] as string[], promptType: "" as string });
  // Pass 78: Code Chat mode config. `allowMutations` only takes effect
  // when the current user is an admin — the server enforces the gate.
  const [codeChatConfig, setCodeChatConfig] = useState({ allowMutations: false, maxIterations: 5 });
  const codeChatMut = trpc.codeChat.chat.useMutation({
    onError: () => toast.error("Code Chat request failed — please try again"),
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const toggleLoopFocus = (focus: string) => {
    setLoopConfig(p => {
      const foci = p.foci.includes(focus)
        ? p.foci.filter(f => f !== focus)
        : [...p.foci, focus];
      return { ...p, foci }; // empty foci = general mode (no specific focus cycling)
    });
  };
  const focusSerialized = serializeFocusModes(selectedFocus);

  const toggleModel = (modelId: string) => {
    setSelectedModels(prev => {
      if (modelId === "auto") return ["auto"];
      const without = prev.filter(m => m !== "auto");
      if (without.includes(modelId)) {
        const result = without.filter(m => m !== modelId);
        return result.length === 0 ? ["auto"] : result;
      }
      return [...without, modelId];
    });
  };
  const selectedModel = selectedModels.includes("auto") ? undefined : selectedModels[0];
  const isMultiModel = selectedModels.length > 1 && !selectedModels.includes("auto");
  const modelLabel = selectedModels.includes("auto")
    ? "Auto"
    : selectedModels.length === 1
      ? selectedModels[0].split("-").slice(0, 2).join("-")
      : `${selectedModels.length} models`;

  const MODEL_OPTIONS = [
    { id: "auto", label: "Auto (best for task)", family: "auto" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", family: "Gemini" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", family: "Gemini" },
    { id: "gpt-4o", label: "GPT-4o", family: "GPT" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini", family: "GPT" },
    { id: "gpt-4.1", label: "GPT-4.1", family: "GPT" },
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4", family: "Claude" },
    { id: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet", family: "Claude" },
    { id: "claude-3-haiku", label: "Claude 3 Haiku", family: "Claude" },
    { id: "o4-mini", label: "o4-mini", family: "Reasoning" },
    { id: "o3", label: "o3", family: "Reasoning" },
    { id: "deepseek-reasoner", label: "DeepSeek Reasoner", family: "Reasoning" },
    { id: "deepseek-chat", label: "DeepSeek Chat", family: "Open Source" },
    { id: "llama-3.3-70b", label: "Llama 3.3 70B", family: "Open Source" },
    { id: "llama-4-scout", label: "Llama 4 Scout", family: "Open Source" },
    { id: "mistral-large", label: "Mistral Large", family: "Open Source" },
    { id: "mixtral-8x22b", label: "Mixtral 8x22B", family: "Open Source" },
    { id: "qwen-2.5-72b", label: "Qwen 2.5 72B", family: "Open Source" },
    { id: "qwen-2.5-coder-32b", label: "Qwen 2.5 Coder", family: "Open Source" },
  ];

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
  const [useStreaming, setUseStreaming] = useState(true);
  const [streamingContent, setStreamingContent] = useState("");
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
  // Pass 2 (G59 — cross-browser STT silent-fail): probe capabilities on
  // mount so we know whether to offer continuous listening, PTT-only, or
  // nothing at all. Users of Firefox / Safari iOS deserve an actual banner
  // explaining why the mic button won't work hands-free, not silent failure.
  const sttCaps = useMemo<SttCapabilities>(() => detectStt(), []);
  const sttFullSupport = sttCaps.mode === "full";
  const sttAnySupport = sttCaps.mode !== "unsupported";
  // Build Loop Pass 3 (G60): focus #chat-main on route change + announce
  // via aria-live. Chat owns its own <main> element (id="chat-main") so
  // we override the default target here.
  useFocusOnRouteChange({ mainId: "chat-main" });

  // Build Loop Pass 5 (G3): sentence-chunked aria-live announcements for
  // streamed content. Instead of "AI is responding…", SR users now hear
  // the actual answer sentence-by-sentence as it arrives, debounced to
  // 800ms between announcements so the live region doesn't machine-gun.
  // Build Loop Pass 5 (G4): same state powers a visible caption panel
  // during TTS playback so deaf/HoH users have a WCAG 1.2.1-A transcript.
  const announcerRef = useRef<AnnouncerState>(createAnnouncerState());
  const [liveAnnouncement, setLiveAnnouncement] = useState<string>("");
  const [captionText, setCaptionText] = useState<string>("");
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const stored = localStorage.getItem("tts-enabled");
    return stored !== "false"; // Default ON
  });

  const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);
  // ─── REFS ──────────────────────────────────────────────────────
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isNearBottomRef = useRef(true);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const handleSendRef = useRef<(text: string) => void>(() => {});
  // Mutex guard: prevents concurrent conversation creation (race condition)
  const creatingConversationRef = useRef(false);
  const streamAbortRef = useRef<AbortController | null>(null);
  const loopPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Clean up loop polling on unmount to prevent background intervals
  useEffect(() => {
    return () => { if (loopPollRef.current) clearInterval(loopPollRef.current); };
  }, []);

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
        setTimeout(() => { try { voice.start(); } catch { /* voice may not be available */ } }, 600);
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
  const anonSendMutation = trpc.anonymousChat.send.useMutation({
    onError: () => toast.error("Failed to send message — please try again"),
  });
  const guestPrefs = useGuestPreferences();

  // ─── SELF-DISCOVERY LOOP ──────────────────────────────────────
  const lastUserMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i];
    }
    return null;
  }, [messages]);
  const lastAiMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i];
    }
    return null;
  }, [messages]);
  const selfDiscovery = useSelfDiscovery({
    conversationId,
    isStreaming,
    lastUserQuery: lastUserMsg?.content || "",
    lastAiResponse: lastAiMsg?.content || "",
    lastAiMessageId: lastAiMsg?.id,
    onSendQuery: (query) => {
      setInput(query);
      setTimeout(() => handleSendWithText(query), 100);
    },
  });

  // ─── QUERIES ──────────────────────────────────────────────────
  const conversationsQuery = trpc.conversations.list.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const messagesQuery = trpc.conversations.messages.useQuery(
    { conversationId: conversationId! },
    { enabled: !!conversationId && isAuthenticated }
  );
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated, staleTime: 60_000 });
  const avatarUrl = settingsQuery.data?.avatarUrl;

  // Pass 93: single proactive insight for the welcome banner. Only fires
  // on the empty state (no conversationId), and only for authenticated
  // non-guest users. retry:false so a transient failure shows nothing
  // instead of blocking the welcome render. The query is cheap (3 rows,
  // already-indexed by user_id + status).
  const welcomeInsightsQuery = trpc.insights.list.useQuery(
    { limit: 3 },
    { enabled: isAuthenticated && !conversationId && user?.authTier !== "anonymous", retry: false },
  );
  const topInsight = (() => {
    const list = welcomeInsightsQuery.data ?? [];
    return (
      list.find((i: any) => i.priority === "critical" || i.priority === "high") ??
      list[0] ??
      null
    );
  })();

  // Transformation 2: proficiency data for the welcome gateway
  const proficiencyQuery = trpc.exponentialEngine.getProficiency.useQuery(
    undefined,
    { enabled: !conversationId && allowQueries, retry: false, staleTime: 60_000 },
  );

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
  const sendMutation = trpc.chat.send.useMutation({
    onError: () => toast.error("Failed to send message — please try again"),
  });
  const persistStreamedMutation = trpc.chat.persistStreamed.useMutation({
    onError: () => { /* Silent — stream data is ephemeral, loss is not user-visible */ },
  });
  const createConversation = trpc.conversations.create.useMutation({
    onError: () => toast.error("Failed to create conversation"),
  });
  const deleteConversation = trpc.conversations.delete.useMutation({
    onError: () => toast.error("Failed to delete conversation"),
  });
  const feedbackMutation = trpc.feedback.submit.useMutation({
    onError: () => { /* Silent — feedback is best-effort, don't interrupt the user */ },
  });
  const visualMutation = trpc.visual.generate.useMutation({
    onError: () => toast.error("Visual generation failed — please try again"),
  });

  // ─── FOLDER & PIN QUERIES/MUTATIONS ────────────────────────
  const foldersQuery = trpc.conversations.folders.useQuery(undefined, { enabled: isAuthenticated, staleTime: 30_000 });
  const togglePinMutation = trpc.conversations.togglePin.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
    onError: () => toast.error("Failed to pin conversation"),
  });
  const moveToFolderMutation = trpc.conversations.moveToFolder.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
    onError: () => toast.error("Failed to move conversation"),
  });
  const createFolderMutation = trpc.conversations.createFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); setFolderDialogOpen(false); setNewFolderName(""); },
    onError: () => toast.error("Failed to create folder"),
  });
  const updateFolderMutation = trpc.conversations.updateFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); setEditingFolder(null); },
    onError: () => toast.error("Failed to update folder"),
  });
  const deleteFolderMutation = trpc.conversations.deleteFolder.useMutation({
    onSuccess: () => { utils.conversations.folders.invalidate(); utils.conversations.list.invalidate(); },
    onError: () => toast.error("Failed to delete folder"),
  });
  const reorderMutation = trpc.conversations.reorder.useMutation({
    onError: () => toast.error("Failed to reorder conversations"),
  });
  const autonomousStart = trpc.autonomousProcessing.start.useMutation({
    onError: () => toast.error("Failed to start autonomous processing"),
  });
  const autonomousStop = trpc.autonomousProcessing.stop.useMutation({
    onError: () => toast.error("Failed to stop autonomous processing"),
  });
  const consensusQuery = trpc.advancedIntelligence.consensusQuery.useMutation({
    onError: () => toast.error("Consensus query failed — please try again"),
  });
  // Round E1 — multi-model consensus stream (Phase C2 backend, trio UI)
  const consensusStreamMutation = trpc.wealthEngine.consensusStream.useMutation({
    onError: () => toast.error("Consensus stream failed — falling back to single-model"),
  });

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

  // Helper: classify conversation date into groups
  const getDateGroup = (dateStr: string | undefined) => {
    if (!dateStr) return "Older";
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const weekAgo = new Date(today.getTime() - 7 * 86400000);
    const monthAgo = new Date(today.getTime() - 30 * 86400000);
    if (d >= today) return "Today";
    if (d >= yesterday) return "Yesterday";
    if (d >= weekAgo) return "Previous 7 Days";
    if (d >= monthAgo) return "Previous 30 Days";
    return "Older";
  };

  // Group conversations by pinned, folder, and unfiled with date groups
  const groupedConversations = useMemo(() => {
    const convs = conversationsQuery.data || [];
    // Apply inline client-side filter when search is open but query is short (< 2 chars for server search)
    const inlineFilter = searchOpen && searchQuery.length > 0 && searchQuery.length < 2;
    const filterFn = (c: any) => {
      if (inlineFilter) {
        return (c.title || "").toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    };
    const pinned = convs.filter((c: any) => c.pinned && filterFn(c));
    const folders = foldersQuery.data || [];
    const folderGroups = folders.map((f: any) => ({
      ...f,
      conversations: convs.filter((c: any) => !c.pinned && c.folderId === f.id && filterFn(c)),
    }));
    const unfiled = convs.filter((c: any) => !c.pinned && !c.folderId && filterFn(c));
    // Filter out empty conversations (no messages) unless they're the active one or very recent
    const filteredUnfiled = unfiled.filter((c: any) => {
      if (c.id === conversationId) return true;
      if (typeof c.messageCount === 'number' && c.messageCount === 0) {
        const createdRecently = c.createdAt && (Date.now() - new Date(c.createdAt).getTime()) < 5 * 60 * 1000;
        return createdRecently;
      }
      if (c.title === "New Conversation") {
        const createdRecently = c.createdAt && (Date.now() - new Date(c.createdAt).getTime()) < 5 * 60 * 1000;
        return createdRecently;
      }
      return true;
    });
    // Group unfiled by date
    const dateOrder = ["Today", "Yesterday", "Previous 7 Days", "Previous 30 Days", "Older"] as const;
    const dateGroups = dateOrder.map(label => ({
      label,
      conversations: filteredUnfiled.filter((c: any) => getDateGroup(c.updatedAt || c.createdAt) === label),
    })).filter(g => g.conversations.length > 0);
    return { pinned, folderGroups, unfiled: filteredUnfiled, dateGroups };
  }, [conversationsQuery.data, foldersQuery.data, conversationId, searchOpen, searchQuery]);

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
      const timer = setTimeout(() => textareaRef.current?.focus(), 300);
      return () => clearTimeout(timer);
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
    // Pass 2 (G59): refuse to silently fail on unsupported browsers.
    // Users with no SpeechRecognition constructor (Firefox, pre-iOS-14.5
    // Safari, in-app WebViews) now see an explicit toast naming their
    // browser + offering keyboard as an alternative. The banner will
    // already be rendered above the input so this is the second-chance
    // path for users who click the mic anyway.
    if (!handsFreeActive && !sttAnySupport) {
      toast.error(sttCaps.userMessage, {
        description: sttCaps.recoveryHint,
        duration: 8000,
      });
      return;
    }
    // On PTT-only browsers (Safari iOS, Safari desktop) continuous
    // listening isn't reliable — still allow activation but warn once per
    // session so the user understands why the mic might cut out.
    if (!handsFreeActive && !sttFullSupport) {
      toast.info("Continuous hands-free isn't supported on this browser.", {
        description: sttCaps.recoveryHint,
        duration: 6000,
      });
    }
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
  }, [handsFreeActive, voice, tts, sttAnySupport, sttFullSupport, sttCaps]);

   // ─── SEND MESSAGE ───────────────────────────────────────────
  const handleSendWithText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    if (isStreaming) return;
    // CBL18: prevent sends while offline — saves user from a confusing network error
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      toast.error("You're offline — message not sent. Check your connection and try again.");
      return;
    }

    // Pass 1 (multisensory): slash-command interceptor. If the message is
    // a recognised command like "/go learning" or "/hands-free on", route
    // it through the shared intent parser and short-circuit the chat send.
    // We ONLY intercept inputs that start with "/" so natural-language chat
    // like "can you go over my retirement plan?" still reaches the LLM.
    if (trimmed.startsWith("/") && attachments.length === 0) {
      const parsed = parseIntent(trimmed, { allowBareNav: true });
      if (parsed.kind !== "unknown") {
        setInput("");
        switch (parsed.kind) {
          case "navigate":
            dispatchIntent({
              intent: "nav.chat", // overridden by programmatic navigate below
              source: "chat",
            });
            // Use direct wouter navigation for the parsed arbitrary route,
            // since the shortcut registry only covers named destinations.
            navigate(parsed.route);
            announce(`Navigated to ${parsed.label}`, "polite");
            toast.success(`→ ${parsed.label}`);
            return;
          case "read_page":
            dispatchIntent({ intent: "audio.read_page", source: "chat" });
            return;
          case "focus_chat":
            // Already focused — re-announce for feedback
            announce("Chat input focused", "polite");
            return;
          case "open_palette":
            dispatchIntent({ intent: "palette.open", source: "chat" });
            return;
          case "help":
            dispatchIntent({ intent: "a11y.show_shortcuts", source: "chat" });
            return;
          case "hands_free":
            dispatchIntent({
              intent: "voice.toggle_hands_free",
              source: "chat",
            });
            return;
          case "audio":
            if (parsed.action === "pause")
              dispatchIntent({ intent: "audio.stop_speech", source: "chat" });
            if (parsed.action === "resume")
              dispatchIntent({ intent: "audio.toggle_tts", source: "chat" });
            announce(`Audio ${parsed.action}`, "polite");
            return;
          case "heading":
            dispatchIntent({
              intent:
                parsed.direction === "next"
                  ? "a11y.next_heading"
                  : "a11y.prev_heading",
              source: "chat",
            });
            return;
          case "learning":
            // Pass 7: learning slash commands delegate to the PIL's
            // pil:learning custom event bus used by the learning pages.
            document.dispatchEvent(
              new CustomEvent("pil:learning", {
                detail: {
                  action: parsed.action,
                  ...(parsed.action === "rate" && parsed.rating
                    ? { rating: parsed.rating }
                    : {}),
                },
              }),
            );
            return;
        }
      }
      // Unknown slash command — fall through and let the LLM handle it.
    }

    const userMsg = { role: "user" as const, content: trimmed, createdAt: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    soundCues.play("sent");
    // PIL: designed "chat.sent" feedback — haptic light + send earcon + send animation
    pil.giveFeedback("chat.sent");
    setFollowUpSuggestions([]);
    setIsStreaming(true);
    // Pass 5 (G3): reset the sentence chunker for the new response so
    // we start emitting from byte 0 of the streaming content.
    announcerRef.current = createAnnouncerState();
    setLiveAnnouncement("");
    setCaptionText("");
    // PIL: begin streaming — fires typing-start animation + aria-live "thinking"
    pil.giveFeedback("chat.streaming_start");

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
        // Mutex: prevent concurrent conversation creation (double-click, HMR, voice race)
        if (creatingConversationRef.current) {
          setIsStreaming(false);
          setMessages(prev => prev.slice(0, -1)); // remove optimistic user msg
          return;
        }
        creatingConversationRef.current = true;
        try {
          const newConv = await createConversation.mutateAsync({ mode, title: trimmed.slice(0, 80) });
          activeConvId = newConv.id;
          setConversationId(activeConvId);
          navigate(`/chat/${activeConvId}`, { replace: true });
          utils.conversations.list.invalidate();
          // PIL: designed "chat.new_conversation" feedback
          pil.giveFeedback("chat.new_conversation");
        } catch (err) {
          creatingConversationRef.current = false;
          throw err;
        }
        creatingConversationRef.current = false;
      }

      // ─── LOOP MODE: Start autonomous processing session ───
      if (chatMode === "loop") {
        try {
          const hasFoci = loopConfig.foci.length > 0;
          const primaryFocus = hasFoci ? loopConfig.foci[0] : "general";
          const result = await autonomousStart.mutateAsync({
            topic: trimmed,
            focus: primaryFocus as any,
            foci: hasFoci ? loopConfig.foci as any : undefined,
            mode: "diverge",
            maxIterations: loopConfig.maxIterations,
            maxBudget: loopConfig.maxBudget,
            context: messages.filter(m => m.role === "assistant").slice(-3).map(m => m.content).join("\n").slice(0, 1000),
            promptType: loopConfig.promptType || undefined,
          });
          setActiveSessionId(result.sessionId);
          const focusLabel = hasFoci ? loopConfig.foci.join(", ") : "General";
          toast.success(`Loop started: ${focusLabel} — ${loopConfig.maxIterations === 0 ? "continuous" : loopConfig.maxIterations + " iterations"}`);
          // Start polling for iterations every 3s
          if (loopPollRef.current) clearInterval(loopPollRef.current);
          let lastIterCount = 0;
          loopPollRef.current = setInterval(async () => {
            try {
              const session = await utils.client.autonomousProcessing.getSession.query({ sessionId: result.sessionId });
              if (!session) { clearInterval(loopPollRef.current!); loopPollRef.current = null; return; }
              for (const iter of (session.iterations || []).slice(lastIterCount)) {
                setMessages(prev => [...prev, {
                  role: "assistant" as const,
                  content: `**[${(iter.focus || primaryFocus).toUpperCase()} — ${iter.mode || "diverge"}] Iteration ${iter.iteration}**\n\n${iter.content}`,
                  createdAt: new Date(iter.timestamp || Date.now()),
                }]);
                lastIterCount++;
              }
              if (session.status !== "running") {
                clearInterval(loopPollRef.current!); loopPollRef.current = null;
                setActiveSessionId(null);
                toast.info(`Loop ${session.status}: ${(session.iterations || []).length} iterations, $${(session.totalCost || 0).toFixed(4)} cost`);
              }
            } catch { /* polling error — will retry */ }
          }, 3000);
        } catch (err: any) {
          toast.error(err.message || "Couldn't start the analysis loop — please try again in a moment");
        }
        setIsStreaming(false);
        return;
      }
      // ─── CONSENSUS MODE: Multi-model consensus stream (Round E1) ───
      // Uses wealthEngine.consensusStream which returns the full event
      // log + per-model responses + synthesis so the inline
      // StreamingResults / TimingBreakdown / ComparisonView trio can
      // render without a second round-trip. Falls back to the legacy
      // advancedIntelligence.consensusQuery on error.
      if (chatMode === "consensus") {
        try {
          setMessages(prev => [...prev, { role: "assistant" as const, content: "Querying multiple models for consensus...", createdAt: new Date() }]);
          const result = await consensusStreamMutation.mutateAsync({
            question: trimmed,
            // Default trio; user can customize via /consensus page
            selectedModels: ["claude-sonnet-4-20250514", "gpt-4o", "gemini-2.5-pro"],
            maxModels: 3,
          });
          const content = result.unifiedAnswer || result.synthesisContent || "No consensus response";
          const agreementScore = result.agreementScore;
          const modelsUsed = result.modelsUsed;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant" as const,
              content,
              createdAt: new Date(),
              metadata: {
                // Legacy fields (kept for the existing expandable panel)
                consensusScore: agreementScore,
                modelsUsed,
                // Round E1 — full wealth-engine consensus result for the
                // inline trio components. We strip the event log down
                // to what the UI actually needs (it's large).
                wealthConsensus: {
                  events: result.events,
                  perModelResponses: result.perModelResponses,
                  unifiedAnswer: result.unifiedAnswer,
                  keyAgreements: result.keyAgreements,
                  notableDifferences: result.notableDifferences,
                  synthesisTimeMs: result.synthesisTimeMs,
                  totalDurationMs: result.totalDurationMs,
                  confidenceScore: result.confidenceScore,
                  agreementScore: result.agreementScore,
                  rationale: result.rationale,
                },
              },
            };
            return updated;
          });
          if (ttsEnabled) tts.speak(content);
          // Persist to conversation
          if (activeConvId) {
            persistStreamedMutation.mutateAsync({
              conversationId: activeConvId,
              userContent: trimmed,
              assistantContent: content,
              mode,
              focus: focusSerialized,
            }).catch(() => {});
          }
        } catch (err: any) {
          // Fallback to legacy consensus path so the feature still works
          // if the new stream procedure is unavailable (e.g. during a
          // partial deploy).
          try {
            const result = await consensusQuery.mutateAsync({ prompt: trimmed, requireConsensus: true });
            const content = result.choices?.[0]?.message?.content || "No consensus response";
            const consensusScore = (result as any)._consensusScore ?? null;
            const modelsUsed = (result as any)._modelsUsed ?? [];
            const warning = (result as any)._consensusWarning;
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant" as const,
                content: warning ? `${content}\n\n> ⚠️ **Consensus Warning:** ${warning}` : content,
                createdAt: new Date(),
                metadata: { consensusScore, modelsUsed },
              };
              return updated;
            });
            if (ttsEnabled) tts.speak(content);
          } catch (fallbackErr: any) {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = { role: "assistant" as const, content: `Consensus query failed: ${err.message}`, createdAt: new Date() };
              return updated;
            });
          }
        }
        setIsStreaming(false);
        return;
      }
      // ─── CODE CHAT MODE: Claude-Code-style multi-turn tool calling (pass 78) ───
      // Runs the server-side `codeChat.chat` ReAct loop which has
      // `list_directory` / `read_file` / `grep_search` (and the write
      // tools when the caller is an admin + opted-in). The final
      // response is appended as a single assistant message with a
      // `traces` metadata array so the UI can render tool calls
      // inline — reusing the existing reasoning-chain component
      // would be a natural follow-up.
      if (chatMode === "codechat") {
        try {
          setMessages(prev => [...prev, {
            role: "assistant" as const,
            content: "🔧 Code Chat is exploring the codebase...",
            createdAt: new Date(),
          }]);
          const result = await codeChatMut.mutateAsync({
            message: trimmed,
            model: selectedModels[0] && selectedModels[0] !== "auto" ? selectedModels[0] : undefined,
            allowMutations: codeChatConfig.allowMutations,
            maxIterations: codeChatConfig.maxIterations,
          });
          const traceSummary = result.traces.length > 0
            ? "\n\n---\n\n**Tool calls (" + result.traces.length + "):** " +
              result.traces
                .map((t) => `\`${t.toolName ?? "?"}\` (${(t.durationMs / 1000).toFixed(1)}s)`)
                .join(", ")
            : "";
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant" as const,
              content: result.response + traceSummary,
              createdAt: new Date(),
              metadata: {
                codeChatTraces: result.traces,
                codeChatModel: result.model,
                codeChatIterations: result.iterations,
                codeChatToolCallCount: result.toolCallCount,
              } as any,
            };
            return updated;
          });
          if (ttsEnabled) tts.speak(result.response);
        } catch (err: any) {
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant" as const,
              content: `Code Chat error: ${err.message ?? "unknown"}`,
              createdAt: new Date(),
            };
            return updated;
          });
        }
        setIsStreaming(false);
        return;
      }
      // ─── SSE STREAMING PATH ───
      if (useStreaming) {
        setStreamingContent("");
        // Add a placeholder assistant message that will be updated as tokens arrive
        const placeholderMsg = {
          role: "assistant" as const,
          content: "",
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, placeholderMsg]);

        // Pass 8 (G62): hoist watchdog + offline listener state above
        // the try block so the catch handler can also clean them up.
        let streamWatchdog: ReturnType<typeof setTimeout> | null = null;
        let onOffline: (() => void) | null = null;
        try {
          // Pass 8 (G62): fail fast when the browser says we're offline.
          // Prevents the SSE pipeline from making a request that's
          // destined to hang + leaves the user with a stale "AI is
          // responding…" aria-live stub forever.
          if (typeof navigator !== "undefined" && navigator.onLine === false) {
            pil.giveFeedback("chat.error", { code: "NETWORK" });
            setMessages(prev => prev.slice(0, -1)); // remove placeholder
            setIsStreaming(false);
            return;
          }
          // Abort any previous stream before starting a new one
          streamAbortRef.current?.abort();
          const abortController = new AbortController();
          streamAbortRef.current = abortController;

          // Pass 8 (G62): hard stream timeout. If the server stops
          // writing tokens for 60s we abort — better to surface a
          // retry than hang forever. Reset on every token below.
          const STREAM_IDLE_TIMEOUT_MS = 60_000;
          const resetWatchdog = () => {
            if (streamWatchdog) clearTimeout(streamWatchdog);
            streamWatchdog = setTimeout(() => {
              console.warn("[Chat] Stream idle > 60s — aborting");
              abortController.abort();
            }, STREAM_IDLE_TIMEOUT_MS);
          };
          resetWatchdog();

          // Pass 8 (G62): if the browser fires an `offline` event
          // mid-stream, abort immediately so the UI doesn't hang.
          onOffline = () => {
            console.warn("[Chat] Network went offline mid-stream — aborting");
            abortController.abort();
          };
          window.addEventListener("offline", onOffline);

          const sseResponse = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            signal: abortController.signal,
            body: JSON.stringify({
              messages: [
                // Inject recent calculator results as system context
                ...(() => {
                  const calcOverlay = buildContextOverlay(loadCalculatorContext());
                  return calcOverlay ? [{ role: "system", content: calcOverlay }] : [];
                })(),
                ...messages.map(m => ({ role: m.role, content: m.content })),
                { role: "user", content: trimmed },
              ],
              sessionId: activeConvId,
              contextType: "chat",
              model: selectedModel || undefined,
              models: isMultiModel ? selectedModels : undefined,
            }),
          });

          if (!sseResponse.ok) {
            throw new Error(`Stream request failed: ${sseResponse.status}`);
          }

          const reader = sseResponse.body!.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split("\n");

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith("data: ")) continue;
              try {
                const event = JSON.parse(trimmedLine.slice(6));
                if (event.type === "token" && event.content) {
                  // Pass 8 (G62): every token resets the watchdog.
                  // 60s of complete silence = abort.
                  resetWatchdog();
                  accumulated += event.content;
                  setStreamingContent(accumulated);
                  // Update the last message in-place
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = { ...last, content: accumulated };
                    }
                    return updated;
                  });
                  // Pass 5 (G3): feed the growing stream to the sentence
                  // chunker so aria-live + captions track the answer in
                  // real time. shouldEmitChunk is pure — no throttle
                  // wrapper needed, the state advances atomically.
                  const emit = shouldEmitChunk(accumulated, announcerRef.current);
                  if (emit.emit) {
                    announcerRef.current = emit.nextState;
                    setLiveAnnouncement(emit.text);
                    setCaptionText(emit.text);
                  }
                } else if (event.type === "done") {
                  // Pass 5 (G3): flush any un-terminated trailing text
                  // to the aria-live region + caption panel + then mark
                  // the response complete so SR users hear the closure.
                  const trailing = finalChunk(accumulated, announcerRef.current);
                  if (trailing) {
                    setLiveAnnouncement(trailing);
                    setCaptionText(trailing);
                  }
                  // Finalize — persist the streamed content (NOT regenerate)
                  // First update the UI immediately with the accumulated content
                  const streamedMediaEmbeds = Array.isArray(event.mediaEmbeds) ? event.mediaEmbeds : undefined;
                  setMessages(prev => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last && last.role === "assistant") {
                      updated[updated.length - 1] = {
                        ...last,
                        content: accumulated,
                        metadata: { ...(last.metadata || {}), ...(streamedMediaEmbeds ? { mediaEmbeds: streamedMediaEmbeds } : {}) },
                      };
                    }
                    return updated;
                  });
                  // Start TTS immediately with the streamed content
                  if (ttsEnabled) tts.speak(accumulated);
                  // Then persist to DB in background (won't regenerate)
                  persistStreamedMutation.mutateAsync({
                    conversationId: activeConvId,
                    userContent: trimmed,
                    assistantContent: accumulated,
                    mode,
                    focus: focusSerialized,
                  }).then((persistResult) => {
                    // Update with the persisted ID (for feedback buttons etc.)
                    setMessages(prev => {
                      const updated = [...prev];
                      const last = updated[updated.length - 1];
                      if (last && last.role === "assistant" && last.content === accumulated) {
                        updated[updated.length - 1] = {
                          ...last,
                          id: persistResult.id,
                          confidenceScore: persistResult.confidenceScore,
                          complianceStatus: persistResult.complianceStatus,
                        };
                      }
                      return updated;
                    });
                    if (persistResult.followUpSuggestions?.length) {
                      setFollowUpSuggestions(persistResult.followUpSuggestions);
                    }
                    // Refresh conversation list for title update
                    utils.conversations.list.invalidate();
                  }).catch((err: any) => {
                    console.warn("[Chat] Failed to persist streamed message:", err.message);
                  });
                } else if (event.type === "error") {
                  throw new Error(event.message || "Streaming error");
                }
              } catch (parseErr: any) {
                // Skip unparseable SSE lines (heartbeats, etc.)
                if (parseErr.message && !parseErr.message.includes("JSON")) throw parseErr;
              }
            }
          }
          // Pass 8 (G62): release the idle watchdog + offline listener
          // now that the stream closed cleanly.
          if (streamWatchdog) { clearTimeout(streamWatchdog); streamWatchdog = null; }
          if (onOffline) window.removeEventListener("offline", onOffline);
          setStreamingContent("");
          streamAbortRef.current = null;
        } catch (streamErr: any) {
          // Pass 8 (G62): same cleanup on the error path.
          if (streamWatchdog) { clearTimeout(streamWatchdog); streamWatchdog = null; }
          if (onOffline) window.removeEventListener("offline", onOffline);
          streamAbortRef.current = null;
          // If aborted (user navigated away or sent new message), don't fallback
          if (streamErr?.name === "AbortError") {
            setStreamingContent("");
            return;
          }
          // If streaming fails, fall back to tRPC
          setMessages(prev => prev.slice(0, -1)); // remove placeholder
          const result = await sendMutation.mutateAsync({
            content: trimmed,
            conversationId: activeConvId,
            mode,
            focus: focusSerialized,
            model: selectedModel || undefined,
          });
          const assistantMsg = {
            id: result.id,
            role: "assistant" as const,
            content: result.content,
            model: result.model,
            confidenceScore: result.confidenceScore,
            complianceStatus: result.complianceStatus,
            metadata: {
              ...(result as any)._routingInfo,
              consensusScore: (result as any)._consensusScore,
              modelsUsed: (result as any)._modelsUsed,
              alternatives: (result as any)._alternatives,
            },
            createdAt: new Date(),
          };
          setMessages(prev => [...prev, assistantMsg]);
          if (result.followUpSuggestions?.length) setFollowUpSuggestions(result.followUpSuggestions);
          if (ttsEnabled) tts.speak(result.content);
        }
      } else {
        // ─── LEGACY tRPC PATH (useStreaming = false) ───
        const result = await sendMutation.mutateAsync({
          content: trimmed,
          conversationId: activeConvId,
          mode,
          focus: focusSerialized,
          model: selectedModel || undefined,
        });

        const assistantMsg = {
          id: result.id,
          role: "assistant" as const,
          content: result.content,
          model: result.model,
          confidenceScore: result.confidenceScore,
          complianceStatus: result.complianceStatus,
          metadata: {
            ...(result as any)._routingInfo,
            consensusScore: (result as any)._consensusScore,
            modelsUsed: (result as any)._modelsUsed,
            alternatives: (result as any)._alternatives,
          },
          createdAt: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);

        // Set follow-up suggestions if returned
        if (result.followUpSuggestions && result.followUpSuggestions.length > 0) {
          setFollowUpSuggestions(result.followUpSuggestions);
        }

        if (ttsEnabled) {
          tts.speak(result.content);
        }
      }
    } catch (err: any) {
      // PIL: designed "chat.error" feedback — dispatches Steward-personality
      // error toast + haptic error pattern + spoken recovery text. Categorize
      // the failure by message so the spec can pick the right copy.
      const raw = (err?.message || "").toLowerCase();
      const code = raw.includes("fetch") || raw.includes("network") || raw.includes("connection")
        ? "NETWORK"
        : raw.includes("rate") || raw.includes("429")
        ? "RATE_LIMIT"
        : raw.includes("401") || raw.includes("403") || raw.includes("unauth") || raw.includes("expired")
        ? "AUTH_EXPIRED"
        : "GENERIC";
      pil.giveFeedback("chat.error", { code });
      // Keep the legacy toast for users who disabled visual feedback: the
      // dispatcher already runs it, but sonner dedupes identical titles.
    } finally {
      setIsStreaming(false);
      setAttachments([]);
      soundCues.play("received");
      // PIL: end of the streaming lifecycle — fires typing-end animation
      pil.giveFeedback("chat.streaming_end");
      // If hands-free is active and TTS is NOT about to speak (no ttsEnabled or error path),
      // release the guard and restart listening.
      // If TTS IS enabled, the guard stays on until tts.onEnd releases it and restarts listening.
      if (handsFreeActive && !ttsEnabled) {
        guardRef.current = false;
        processingRef.current = false;
        forceUpdate(n => n + 1);
        setTimeout(() => { try { voice.start(); } catch { /* voice may not be available */ } }, 600);
      }
    }
  };

  const handleSend = () => handleSendWithText(input);

  // Abort any active SSE stream on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, []);

  // Pass 5 (G61): voice "stop" command fires a `pil:stop-stream` window
  // event. Chat listens for it + aborts any in-flight SSE stream AND
  // clears the streaming UI so the new prompt doesn't interleave with
  // the abandoned response. Also clears the captions.
  useEffect(() => {
    const onStop = () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      setIsStreaming(false);
      setStreamingContent("");
      setCaptionText("");
      setLiveAnnouncement("Stopped.");
    };
    // Pass 5 (G5): voice vocabulary — send / new-chat via PIL events.
    const onVoiceSend = () => {
      if (input.trim()) handleSendRef.current(input);
    };
    const onVoiceNewChat = () => {
      setConversationId(null);
      setMessages([]);
      setInput("");
      navigate("/chat");
    };
    // Pass 6 (G25): Shift+V routes to Chat's local voice mode when
    // the user is on a chat page (useKeyboardShortcuts dispatches
    // `chat:toggle-handsfree` in that case). Chat's voice → send flow
    // is different from PIL's voice → navigate flow, so each owns
    // its own handler.
    const onToggleHandsFree = () => toggleHandsFree();
    window.addEventListener("pil:stop-stream", onStop as EventListener);
    window.addEventListener("pil:send", onVoiceSend as EventListener);
    window.addEventListener("pil:new-chat", onVoiceNewChat as EventListener);
    window.addEventListener("chat:toggle-handsfree", onToggleHandsFree as EventListener);
    return () => {
      window.removeEventListener("pil:stop-stream", onStop as EventListener);
      window.removeEventListener("pil:send", onVoiceSend as EventListener);
      window.removeEventListener("pil:new-chat", onVoiceNewChat as EventListener);
      window.removeEventListener("chat:toggle-handsfree", onToggleHandsFree as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, navigate, toggleHandsFree]);

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
  const { shortcutMap } = useCustomShortcuts();
  const gPressedRef = useRef(false);
  const gTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      const isMod = e.metaKey || e.ctrlKey;

      // G-then-X navigation — uses custom shortcuts from Settings
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
          const route = shortcutMap.get(e.key.toLowerCase());
          if (route) {
            e.preventDefault();
            navigate(route);
            return;
          }
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
  }, [showAddMenu, showModeMenu, showFocusPicker, searchOpen, shortcutMap]);

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
  // Pass 90: Navigate defaults to OPEN so first-time visitors actually see
  // the 5 nav sections. Previously both defaulted to `false`, which meant
  // a brand-new chat user saw "Navigate ▶ / Admin ▶" with zero links
  // visible. Power users can still collapse; choice persists in localStorage.
  const [toolsExpanded, setToolsExpanded] = useState(() => {
    try { const v = localStorage.getItem("chat-tools-expanded"); return v === null ? true : v === "true"; } catch { return true; }
  });
  const [adminExpanded, setAdminExpanded] = useState(() => {
    try { const v = localStorage.getItem("chat-admin-expanded"); return v === null ? true : v === "true"; } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem("chat-tools-expanded", String(toolsExpanded)); } catch {} }, [toolsExpanded]);
  useEffect(() => { try { localStorage.setItem("chat-admin-expanded", String(adminExpanded)); } catch {} }, [adminExpanded]);

  // Pass 90: chat input "advanced controls" toggle. Default = collapsed.
  // The model picker, chat mode segment, and per-mode config (loop pills,
  // codechat config, etc.) used to be ALL visible at once, turning the
  // input into a cockpit. Now they live behind a single "..." button so
  // first-time users see just [+] [Focus] [audio] [send]. Choice persists
  // in localStorage so power users keep their toolbar open. Auto-expand
  // when chatMode is non-default so loop/consensus/codechat users can see
  // their config without an extra click.
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    try { const v = localStorage.getItem("chat-advanced-open"); return v === null ? false : v === "true"; } catch { return false; }
  });
  useEffect(() => { try { localStorage.setItem("chat-advanced-open", String(advancedOpen)); } catch {} }, [advancedOpen]);
  // Auto-expand the advanced toolbar whenever the user activates a non-default
  // chat mode — they need to see the per-mode config they just enabled.
  useEffect(() => { if (chatMode !== "single") setAdvancedOpen(true); }, [chatMode]);

  // ─── MOBILE SWIPE GESTURE for sidebar open/close ──────────────
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const SWIPE_THRESHOLD = 50;
  const EDGE_ZONE = 30;

  const handleSwipeStart = useCallback((e: TouchEvent) => {
    const t = e.touches[0];
    swipeStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, []);

  const handleSwipeEnd = useCallback((e: TouchEvent) => {
    if (!swipeStartRef.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - swipeStartRef.current.x;
    const dy = t.clientY - swipeStartRef.current.y;
    const elapsed = Date.now() - swipeStartRef.current.time;
    const startX = swipeStartRef.current.x;
    swipeStartRef.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dy) > Math.abs(dx) || elapsed > 500) return;
    if (dx > 0 && startX < EDGE_ZONE && !sidebarOpen) setSidebarOpen(true);
    else if (dx < 0 && sidebarOpen) setSidebarOpen(false);
  }, [sidebarOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    if (!mq.matches) return;
    document.addEventListener("touchstart", handleSwipeStart, { passive: true });
    document.addEventListener("touchend", handleSwipeEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", handleSwipeStart);
      document.removeEventListener("touchend", handleSwipeEnd);
    };
  }, [handleSwipeStart, handleSwipeEnd]);

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

  // ─── SIDEBAR NAV — shared persona layers from PersonaSidebar5 ────
  // Single source of truth: imports PERSONA_LAYERS + ROLE_LEVEL from
  // PersonaSidebar5 so Chat's sidebar nav is always in sync with
  // AppShell's navigation. No duplicate hardcoded arrays.
  const roleLevel = SIDEBAR_ROLE_LEVEL[userRole as keyof typeof SIDEBAR_ROLE_LEVEL] ?? SIDEBAR_ROLE_LEVEL.user;
  const visibleLayers = SIDEBAR_PERSONA_LAYERS.filter(l => roleLevel >= (SIDEBAR_ROLE_LEVEL[l.minRole] ?? 0));

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Pass 91 (Target 7 / WCAG 2.4.1): skip-to-content link.
          Hidden until focused — first focusable element on the Chat
          page so keyboard users can jump past the conversation
          sidebar nav directly to the chat. */}
      <a
        href="#chat-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-accent-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        Skip to chat
      </a>
      <SEOHead title="Chat" description="AI-powered financial advisory chat" />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
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
                  <Button variant="ghost" size="icon" onClick={handleNewConversation} aria-label="New conversation">
                    <Plus className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Conversation</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => { setSidebarCollapsed(false); setSearchOpen(true); }} aria-label="Search conversations">
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
                <Button variant="ghost" size="icon-sm" onClick={() => setSearchOpen(!searchOpen)} aria-label="Search conversations">
                  <Search className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Pass 90: Global Command Palette trigger — opens the platform-wide
            Cmd+K palette (which navigates between pages + runs actions),
            distinct from the conversation search above which only filters
            chat history. The palette is mounted in App.tsx and listens for
            the `toggle-command-palette` event. */}
        {!sidebarCollapsed ? (
          <div className="px-2 py-1.5 border-b border-border/40 shrink-0">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
              aria-label="Open Command Palette"
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors text-[12px]"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search pages…</span>
              <kbd className="font-mono text-[10px] text-muted-foreground/70 bg-background/60 border border-border/60 rounded px-1 py-0.5">⌘K</kbd>
            </button>
          </div>
        ) : (
          <div className="p-1 border-b border-border/40 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent("toggle-command-palette"))}
                  aria-label="Open Command Palette"
                  className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Search className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Search pages (⌘K)</TooltipContent>
            </Tooltip>
          </div>
        )}

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
                  <TooltipContent side="right">{conv.pinned ? <><Pin className="w-3 h-3 inline mr-1" /></> : null}{conv.title || "New Conversation"}</TooltipContent>
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

                {/* Unfiled conversations — grouped by date */}
                {groupedConversations.dateGroups.map((group) => (
                  <div key={group.label} className="mb-1">
                    <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" /> {group.label}
                    </div>
                    {group.conversations.map((conv: any) => (
                      <ConvItem key={conv.id} conv={conv} conversationId={conversationId} navigate={navigate}
                        setSidebarOpen={setSidebarOpen} setConversationId={setConversationId}
                        handleDeleteConversation={handleDeleteConversation}
                        togglePinMutation={togglePinMutation} moveToFolderMutation={moveToFolderMutation}
                        handleExportConversation={handleExportConversation}
                        folders={foldersQuery.data || []} />
                    ))}
                  </div>
                ))}
              </>
            )}
            {conversationsQuery.isLoading && (
              <div className="space-y-2 p-2">
                {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            )}
            {!conversationsQuery.isLoading && !searchOpen && groupedConversations.dateGroups.length === 0 && groupedConversations.pinned.length === 0 && (
              <EmptyConversations />
            )}
          </div>
          )}
        </div>

        {/* Navigation — 5 persona layers (Person/Client/Advisor/Manager/Steward)
            matching PersonaSidebar5 for consistency across the app */}
        <div className="border-t border-border shrink-0 max-h-[45%] overflow-y-auto">
          {sidebarCollapsed ? (
            <div className="p-1 space-y-0.5">
              {visibleLayers.flatMap(layer => layer.items).map(item => {
                const Icon = item.icon;
                return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      onMouseEnter={() => prefetchRoute(item.path)}
                      className={`flex items-center justify-center w-full p-2 rounded-lg transition-colors ${
                        item.match.some(m => location === m || location.startsWith(m + "/"))
                          ? "bg-accent/15 text-accent"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );})}
              <Separator className="mx-1" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => { navigate("/help"); setSidebarOpen(false); }}
                    className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <HelpCircle className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Help & Support</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                    className="flex items-center justify-center w-full p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
                    <Settings className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <nav aria-label="Main navigation" className="px-1.5 pb-1">
                {visibleLayers.map(layer => (
                  <div key={layer.key}>
                    <div className="px-2.5 pt-3 pb-0.5 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-[0.12em] select-none">
                      {layer.label}
                    </div>
                    <div className="space-y-[1px]">
                      {layer.items.map(item => {
                        const active = item.match.some(m => location === m || location.startsWith(m + "/"));
                        const Icon = item.icon;
                        return (
                          <button
                            key={item.path}
                            onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                            className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-lg text-[13px] transition-colors ${
                              active ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                            }`}
                          >
                            <Icon className="w-4 h-4" /> <span className="truncate">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
              <Separator className="my-1 mx-2" />
              <div className="px-1.5 pb-1 space-y-[1px]">
                <button onClick={() => { navigate("/learning"); setSidebarOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-lg text-[13px] transition-colors ${
                    location.startsWith("/learning") ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}>
                  <GraduationCap className="w-4 h-4" /> <span className="truncate">Learn</span>
                </button>
                <button onClick={() => { navigate("/help"); setSidebarOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-lg text-[13px] transition-colors ${
                    location === "/help" ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}>
                  <HelpCircle className="w-4 h-4" /> <span className="truncate">Help</span>
                </button>
                <button onClick={() => { navigate("/settings/profile"); setSidebarOpen(false); }}
                  className={`flex items-center gap-2.5 w-full px-2.5 py-[7px] rounded-lg text-[13px] transition-colors ${
                    location.startsWith("/settings") ? "bg-accent/10 text-accent font-medium" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                  }`}>
                  <Settings className="w-4 h-4" /> <span className="truncate">Settings</span>
                </button>
              </div>

              {/* Desktop notification bell + changelog bell */}
              <div className="hidden lg:flex items-center gap-1 px-2 pb-1">
                <NotificationBell
                  notifications={notifications}
                  unreadCount={unreadCount}
                  connected={wsConnected}
                  onMarkAsRead={markAsRead}
                  onMarkAllAsRead={markAllAsRead}
                  onClear={clearNotifications}
                  onNavigate={(href) => { navigate(href); setSidebarOpen(false); }}
                />
                <ChangelogBell collapsed={sidebarCollapsed} />
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
                    <button type="button" className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-[10px] font-medium text-accent cursor-pointer" onClick={() => setSidebarCollapsed(false)} aria-label="Expand sidebar">
                      {user?.name?.charAt(0)?.toUpperCase() || "U"}
                    </button>
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
      <main
        id="chat-main"
        tabIndex={-1}
        className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0"
        aria-label="Chat"
        aria-busy={isStreaming ? true : undefined}
      >
        {/* Pass 99 + Pass 5 (G3): aria-live region announces the ACTUAL
            streamed content sentence-by-sentence (debounced ≥800ms
            between announcements by `shouldEmitChunk`) instead of the
            stale "AI is responding…" placeholder. SR users now hear
            the answer as it arrives. polite = doesn't interrupt. */}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {isStreaming && !liveAnnouncement
            ? "AI is responding…"
            : liveAnnouncement}
        </div>
        {/* Mobile-only sidebar toggle + escalation + guest sign-in */}
        <div className="lg:hidden flex items-center h-12 px-3 shrink-0 justify-between">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
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
              onNavigate={(href) => { navigate(href); setSidebarOpen(false); }}
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
            <ChatGreetingV2
              userName={user?.name ?? undefined}
              isAuthenticated={isAuthenticated}
              onSuggestionClick={(text) => { setInput(text); textareaRef.current?.focus(); }}
              userRole={userRole as any}
              aiHealthy={true}
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
                          {msg.createdAt && <span className="text-[9px] text-muted-foreground/60">{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                          {msg.model && <span className="text-[9px] text-muted-foreground/60 ml-1">{msg.model}</span>}
                          {msg.contextSources && msg.contextSources > 0 && (
                            <span className="text-[9px] text-blue-400/60 ml-1">Enhanced with {msg.contextSources} sources</span>
                          )}
                        </div>
                        <div className="prose-chat text-sm">
                          <ProgressiveMessage
                            content={msg.content}
                            isLatest={i === messages.length - 1}
                            threshold={300}
                          />
                          {/* Multi-model consensus details — show individual model responses */}
                          {msg.metadata?.consensusScore != null && (
                            <div className="mt-2 border border-purple-500/20 rounded-lg overflow-hidden">
                              <button
                                className="w-full flex items-center justify-between px-3 py-1.5 bg-purple-500/5 text-[10px] text-purple-400 hover:bg-purple-500/10 transition-colors"
                                onClick={(e) => {
                                  const details = (e.currentTarget.nextElementSibling as HTMLElement);
                                  details.style.display = details.style.display === "none" ? "block" : "none";
                                }}
                              >
                                <span>
                                  Consensus: {Math.round((msg.metadata.consensusScore || 0) * 100)}% agreement
                                  {msg.metadata.modelsUsed && ` across ${(msg.metadata.modelsUsed as string[]).join(", ")}`}
                                </span>
                                <span>▼</span>
                              </button>
                              <div style={{ display: "none" }} className="divide-y divide-purple-500/10">
                                {(msg.metadata.alternatives || []).map((alt: any, altIdx: number) => (
                                  <div key={altIdx} className="px-3 py-2">
                                    <div className="text-[9px] font-semibold text-purple-300 mb-1">
                                      {alt.model || `Model ${altIdx + 2}`}
                                    </div>
                                    <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                                      {typeof alt === "string" ? alt : (alt.choices?.[0]?.message?.content || alt.content || JSON.stringify(alt)).slice(0, 1000)}
                                    </div>
                                  </div>
                                ))}
                                {(!msg.metadata.alternatives || msg.metadata.alternatives.length === 0) && (
                                  <div className="px-3 py-2 text-xs text-muted-foreground/60">All models agreed — no alternative responses to show.</div>
                                )}
                              </div>
                            </div>
                          )}
                          {/* Round E1 — inline trio (StreamingResults + TimingBreakdown + ComparisonView)
                              when the message came from wealthEngine.consensusStream. Renders under the
                              legacy consensus badge so users get both the expandable summary AND the
                              full per-model cards + timing chart + side-by-side diff. */}
                          {msg.metadata?.wealthConsensus && (
                            <Suspense fallback={<div className="mt-3 text-xs text-muted-foreground">Loading consensus view…</div>}>
                            <div className="mt-3 space-y-3">
                              <StreamingResults
                                modelsRequested={(msg.metadata.wealthConsensus.perModelResponses as Array<{ modelId: string }>).map((r) => r.modelId)}
                                events={(msg.metadata.wealthConsensus.events as StreamEvent[]) || []}
                              />
                              {msg.metadata.wealthConsensus.perModelResponses && (msg.metadata.wealthConsensus.perModelResponses as Array<unknown>).length > 0 && (
                                <TimingBreakdown
                                  perModel={(msg.metadata.wealthConsensus.perModelResponses as Array<{ modelId: string; content: string; durationMs: number; error?: string }>)
                                    .filter((r) => !r.error)
                                    .map((r) => ({ modelId: r.modelId, durationMs: r.durationMs }))}
                                  synthesisMs={msg.metadata.wealthConsensus.synthesisTimeMs as number}
                                  totalMs={msg.metadata.wealthConsensus.totalDurationMs as number}
                                />
                              )}
                              {Array.isArray(msg.metadata.wealthConsensus.keyAgreements) && (msg.metadata.wealthConsensus.keyAgreements as string[]).length > 0 && (
                                <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                                  <div className="text-[10px] uppercase text-emerald-400 font-semibold tracking-wide mb-1">
                                    Key Agreements
                                  </div>
                                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                                    {(msg.metadata.wealthConsensus.keyAgreements as string[]).map((agreement: string, i: number) => (
                                      <li key={i}>{agreement}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {Array.isArray(msg.metadata.wealthConsensus.notableDifferences) && (msg.metadata.wealthConsensus.notableDifferences as string[]).length > 0 && (
                                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                                  <div className="text-[10px] uppercase text-amber-400 font-semibold tracking-wide mb-1">
                                    Notable Differences
                                  </div>
                                  <ul className="text-xs space-y-0.5 list-disc list-inside">
                                    {(msg.metadata.wealthConsensus.notableDifferences as string[]).map((diff: string, i: number) => (
                                      <li key={i}>{diff}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {msg.metadata.wealthConsensus.perModelResponses && (msg.metadata.wealthConsensus.perModelResponses as Array<unknown>).length > 0 && (
                                <ComparisonView
                                  responses={msg.metadata.wealthConsensus.perModelResponses as Array<{ modelId: string; content: string; durationMs: number; error?: string }>}
                                  unifiedAnswer={msg.metadata.wealthConsensus.unifiedAnswer as string}
                                />
                              )}
                            </div>
                            </Suspense>
                          )}
                          {/* Render inline images if present in metadata */}
                          {msg.metadata?.imageUrl && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-border max-w-md">
                              <img src={msg.metadata.imageUrl} alt="AI generated visual" className="w-full h-auto" />
                            </div>
                          )}
                          {/* Rich media embeds — server-attached (msg.metadata.mediaEmbeds) with client-side fallback */}
                          {(() => {
                            const serverEmbeds = (msg.metadata?.mediaEmbeds as MediaEmbed[] | undefined) || [];
                            const embeds = serverEmbeds.length > 0 ? serverEmbeds : extractMediaFromText(msg.content || "");
                            return embeds.length > 0 ? <RichMediaEmbed embeds={embeds} className="max-w-md" /> : null;
                          })()}
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
                          {msg.content && (
                            <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover/msg:opacity-100 transition-opacity">
                              {msg.id && (<>
                              <Tooltip><TooltipTrigger asChild>
                                <button aria-label="Good response" className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-green-400 transition-colors" onClick={() => handleFeedback(msg.id, "up")}>
                                  <ThumbsUp className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Good response</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button aria-label="Bad response" className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-red-400 transition-colors" onClick={() => handleFeedback(msg.id, "down")}>
                                  <ThumbsDown className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Bad response</TooltipContent></Tooltip>
                              </>)}
                              <Tooltip><TooltipTrigger asChild>
                                <button aria-label="Copy message" className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => { navigator.clipboard.writeText(msg.content); toast.success("Copied"); }}>
                                  <Copy className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Copy</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button aria-label="Read aloud" className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-accent transition-colors" onClick={() => tts.forceSpeak(msg.content)}>
                                  <Volume2 className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Read aloud</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button aria-label="Regenerate response" className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-amber-400 transition-colors" onClick={() => { if (messages.length >= 2) { const lastUserMsg = [...messages].reverse().find(m => m.role === "user"); if (lastUserMsg) handleSendWithText(lastUserMsg.content); } }}>
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Regenerate</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-purple-400 transition-colors" onClick={async () => { toast.info("Generating infographic..."); try { const result = await visualMutation.mutateAsync({ prompt: `Create a professional infographic summarizing: ${msg.content.slice(0, 500)}` }); if (result.url) { setMessages(prev => [...prev, { role: "assistant" as const, content: `Here's the infographic:`, metadata: { imageUrl: result.url }, createdAt: new Date() }]); } } catch (e: any) { toast.error(e.message || "The infographic couldn't be created right now — try again shortly"); } }} title="Generate Infographic">
                                  <Palette className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Generate Infographic</TooltipContent></Tooltip>
                              <Tooltip><TooltipTrigger asChild>
                                <button className="p-2 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-teal-400 transition-colors" onClick={() => { const prevUserMsg = messages.slice(0, i).reverse().find(m => m.role === "user"); if (prevUserMsg) { toast.info("Branching conversation..."); handleSendWithText(prevUserMsg.content); } else { toast.info("No previous prompt to branch from"); } }} aria-label="Fork conversation">
                                  <GitBranch className="w-4 h-4" />
                                </button>
                              </TooltipTrigger><TooltipContent side="bottom" className="text-xs">Fork / Branch</TooltipContent></Tooltip>
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

              {isStreaming && !streamingContent && (
                <TypingIndicator focusMode={selectedFocus?.[0] ?? "general"} />
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
              {/* Follow-up suggestion pills */}
              {followUpSuggestions.length > 0 && !isStreaming && (
                <div className="flex flex-wrap gap-2 px-2 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {followUpSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setFollowUpSuggestions([]);
                        setInput(suggestion);
                        setTimeout(() => handleSendWithText(suggestion), 100);
                      }}
                      className="px-3 py-1.5 text-xs rounded-full border border-accent/30 bg-accent/5 text-accent hover:bg-accent/15 hover:border-accent/50 transition-all cursor-pointer"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              {/* Self-Discovery Loop Bubble */}
              {(selfDiscovery.isVisible || selfDiscovery.isLoading) && !isStreaming && (
                <SelfDiscoveryBubble
                  query={selfDiscovery.query}
                  direction={selfDiscovery.direction}
                  reasoning={selfDiscovery.reasoning}
                  relatedFeatures={selfDiscovery.relatedFeatures}
                  isLoading={selfDiscovery.isLoading}
                  onAccept={selfDiscovery.acceptDiscovery}
                  onDismiss={selfDiscovery.dismissDiscovery}
                />
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
            {/* Pass 2 (G59): user-visible fallback banner whenever the
                browser can't do full continuous STT. Dismissible, persists
                per browser family so returning Safari users aren't nagged. */}
            {!sttFullSupport && (
              <div className="mb-2">
                <VoiceSupportBanner caps={sttCaps} />
              </div>
            )}
            {/* Pass 5 (G4 — WCAG 1.2.1-A captions): visible caption strip
                that mirrors the streamed content + TTS audio for deaf /
                hard-of-hearing users. Renders during streaming OR during
                TTS playback. Auto-clears on response end + user
                interaction. Honors the user's reduced-motion preference
                via the global .reduced-motion-user body class. */}
            {(isStreaming || tts.isSpeaking) && captionText && (
              <div
                role="region"
                aria-label="Live response caption"
                className="mb-2 rounded-lg border border-accent/30 bg-card/80 backdrop-blur-sm px-3 py-2 text-xs text-foreground/90 shadow-sm animate-message-in"
              >
                <div className="flex items-start gap-2">
                  <AudioLines
                    className="w-3 h-3 text-accent shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <div className="flex-1 leading-snug">{captionText}</div>
                  <button
                    type="button"
                    onClick={() => setCaptionText("")}
                    className="shrink-0 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm"
                    aria-label="Dismiss caption"
                  >
                    <X className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}
            {/* Attachment chips */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2 px-1">
                {attachments.map((file, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-secondary/60 rounded-full px-3 py-1 text-xs">
                    <Paperclip className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate max-w-[100px]">{file.name}</span>
                    <button aria-label={`Remove ${file.name}`} onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-foreground ml-0.5">
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
            <div data-tour="chat-input" className="relative bg-secondary/30 rounded-2xl border border-accent/20 shadow-[0_0_8px_-3px_oklch(0.76_0.14_80_/_0.08)] focus-within:border-accent/50 focus-within:shadow-[0_0_24px_-4px_oklch(0.76_0.14_80_/_0.25)] transition-all duration-300 px-3 py-1.5">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={handsFreeActive && voice.isListening ? "Listening..." : userRole === "advisor" ? "Ask about clients, strategies, compliance, or financial planning..." : userRole === "admin" ? "Ask about platform management, analytics, or financial strategies..." : "Ask about financial planning, insurance, investments, or strategies..."}
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
                    <div className="fixed inset-0 z-40" onClick={() => setShowAddMenu(false)} aria-hidden="true" />
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
                          } catch (e: any) { toast.error(e.message || "The visual couldn't be generated right now — try again shortly"); }
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

              {/* Inline media shortcuts — always visible for quick access */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-2 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all hidden sm:block"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Attach file"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Attach file</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-2 rounded-full hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-all hidden sm:block"
                    onClick={() => imageInputRef.current?.click()}
                    aria-label="Attach image"
                  >
                    <Image className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>Attach image</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`p-2 rounded-full transition-all hidden sm:block ${
                      liveSessionMode === "screen" ? "bg-red-500/15 text-red-400" : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setLiveSessionMode(liveSessionMode === "screen" ? null : "screen")}
                    aria-label={liveSessionMode === "screen" ? "End screen share" : "Share screen"}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{liveSessionMode === "screen" ? "End screen share" : "Share screen"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className={`p-2 rounded-full transition-all hidden sm:block ${
                      liveSessionMode === "camera" ? "bg-red-500/15 text-red-400" : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                    onClick={() => setLiveSessionMode(liveSessionMode === "camera" ? null : "camera")}
                    aria-label={liveSessionMode === "camera" ? "End video" : "Start video"}
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{liveSessionMode === "camera" ? "End video session" : "Go live — Video"}</TooltipContent>
              </Tooltip>

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
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} aria-hidden="true" />
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
                      {/* Processing mode — Loop, Consensus, CodeChat */}
                      <div className="h-px bg-border my-1" />
                      <div className="px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Processing</div>
                      {(["single", "loop", "consensus", "codechat"] as const).map(m => (
                        <button
                          key={m}
                          className={`flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-colors ${
                            chatMode === m
                              ? m === "loop" ? "bg-amber-500/15 text-amber-400"
                                : m === "consensus" ? "bg-purple-500/15 text-purple-400"
                                : m === "codechat" ? "bg-emerald-500/15 text-emerald-400"
                                : "bg-accent/15 text-accent"
                              : "hover:bg-secondary/60"
                          }`}
                          onClick={() => { setChatMode(m); if (m !== "single") setAdvancedOpen(true); setShowModeMenu(false); }}
                        >
                          {m === "single" ? "Single" : m === "loop" ? "Loop" : m === "consensus" ? "Consensus" : "CodeChat"}
                          {chatMode === m && <Check className="w-3 h-3 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Pass 90: collapsible "advanced" toolbar — model picker, chat
                  mode segment, and per-mode config (loop pills, codechat
                  config, consensus deep link) all live behind a single
                  "More" button. Default = collapsed so the input bar shows
                  just [+] [Focus] ... [audio] [send]. Auto-hides cockpit
                  for casual users while preserving every existing control
                  for power users (one click to reveal). When a non-default
                  chat mode is active, a small badge replaces the toggle so
                  the user can see at a glance what mode they're in. */}
              {/* Mobile model picker — always visible on mobile so users can
                  switch models without needing the hidden More/Less toggle */}
              <button
                type="button"
                onClick={() => setShowModelMenu(!showModelMenu)}
                className={`md:hidden h-7 text-[10px] rounded-lg px-2 flex items-center gap-1 transition-all ${
                  isMultiModel
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                    : "bg-secondary/30 border border-border text-muted-foreground"
                }`}
                aria-label={`Current model: ${modelLabel}. Tap to change.`}
              >
                <Brain className="w-3 h-3" />
                <span className="max-w-[60px] truncate">{modelLabel}</span>
              </button>

              {/* Mobile model menu (shared with desktop — rendered here for mobile access) */}
              {showModelMenu && (
                <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center">
                  <div className="absolute inset-0 bg-black/50" onClick={() => setShowModelMenu(false)} aria-hidden="true" />
                  <div className="relative bg-popover text-popover-foreground border border-border rounded-t-2xl shadow-xl p-3 w-full max-h-[60vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-200 safe-bottom">
                    <div className="w-8 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-3" />
                    <div className="text-xs font-medium mb-2">Select Model</div>
                    <div className="text-[10px] text-muted-foreground mb-3">Select multiple for consensus mode</div>
                    {(() => {
                      let lastFamily = "";
                      return MODEL_OPTIONS.map(opt => {
                        const showDivider = opt.family !== lastFamily && opt.family !== "auto";
                        lastFamily = opt.family;
                        return (
                          <div key={opt.id}>
                            {showDivider && <div className="h-px bg-border my-1" />}
                            {showDivider && <div className="text-[10px] text-muted-foreground/60 uppercase tracking-wider py-1">{opt.family}</div>}
                            <button
                              className={`flex items-center gap-2 w-full px-3 py-2.5 rounded-xl text-sm transition-colors min-h-[44px] ${
                                selectedModels.includes(opt.id) ? "bg-accent/15 text-accent" : "hover:bg-secondary/60"
                              }`}
                              onClick={() => toggleModel(opt.id)}
                            >
                              {opt.label}
                              {selectedModels.includes(opt.id) && <Check className="w-4 h-4 ml-auto" />}
                            </button>
                          </div>
                        );
                      });
                    })()}
                    <button
                      onClick={() => setShowModelMenu(false)}
                      className="w-full mt-3 py-2.5 rounded-xl bg-accent text-accent-foreground text-sm font-medium min-h-[44px]"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Mode badge — desktop only (mobile users switch via Focus menu) */}
              {!advancedOpen && chatMode !== "single" && (
                <button
                  type="button"
                  onClick={() => setAdvancedOpen(true)}
                  className={`hidden md:inline-flex h-7 px-2 text-[10px] rounded-full border transition-colors ${
                    chatMode === "loop"
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                      : chatMode === "consensus"
                        ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
                        : "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  }`}
                  title="Click to show mode controls"
                >
                  {chatMode === "loop" ? "Loop" : chatMode === "consensus" ? "Consensus" : "CodeChat"}
                </button>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((p) => !p)}
                    aria-label={advancedOpen ? "Hide advanced controls" : "Show advanced controls"}
                    aria-expanded={advancedOpen}
                    className={`hidden md:flex h-7 px-2 text-[10px] rounded-full border border-border transition-colors items-center gap-1 ${
                      advancedOpen
                        ? "bg-secondary/60 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                    }`}
                  >
                    <ChevronUp className={`w-3 h-3 transition-transform ${advancedOpen ? "" : "rotate-180"}`} />
                    {advancedOpen ? "Less" : "More"}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{advancedOpen ? "Hide model + mode controls" : "Show model + mode controls"}</TooltipContent>
              </Tooltip>

              {advancedOpen && (
              <>
              {/* Model selector — multi-select popup (mirrors focus mode pattern) */}
              <div className="relative">
                <button
                  className={`h-7 text-[10px] rounded-lg px-2 flex items-center gap-1 transition-all ${
                    isMultiModel
                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                      : selectedModels.includes("auto")
                        ? "bg-secondary/30 border border-border text-muted-foreground hover:text-foreground"
                        : "bg-accent/15 text-accent border border-accent/30"
                  }`}
                  onClick={() => setShowModelMenu(!showModelMenu)}
                  title={isMultiModel ? `Consensus mode: ${selectedModels.join(", ")}` : `Model: ${modelLabel}`}
                >
                  <Brain className="w-3 h-3" />
                  {modelLabel}
                  {isMultiModel && <span className="text-[8px] bg-purple-500/20 px-1 rounded">consensus</span>}
                </button>

                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModelMenu(false)} aria-hidden="true" />
                    <div className="absolute bottom-full left-0 mb-2 z-50 bg-popover text-popover-foreground border border-border rounded-xl shadow-xl p-1 w-56 max-h-72 overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
                      <div className="px-2 py-1 text-[9px] text-muted-foreground/60 uppercase tracking-wider">Select models (multi = consensus)</div>
                      {(() => {
                        let lastFamily = "";
                        return MODEL_OPTIONS.map(opt => {
                          const showDivider = opt.family !== lastFamily && opt.family !== "auto";
                          lastFamily = opt.family;
                          return (
                            <div key={opt.id}>
                              {showDivider && <div className="h-px bg-border my-0.5" />}
                              {showDivider && <div className="px-2 py-0.5 text-[9px] text-muted-foreground/60 uppercase tracking-wider">{opt.family}</div>}
                              <button
                                className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-lg text-xs transition-colors ${
                                  selectedModels.includes(opt.id) ? "bg-accent/15 text-accent" : "hover:bg-secondary/60"
                                }`}
                                onClick={() => toggleModel(opt.id)}
                              >
                                {opt.label}
                                {selectedModels.includes(opt.id) && <Check className="w-3 h-3 ml-auto" />}
                              </button>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                )}

              </div>

              {/* Processing mode toggle — Single / Loop / Consensus / CodeChat */}
              <div className="flex items-center rounded-lg border border-border overflow-hidden h-7">
                {(["single", "loop", "consensus", "codechat"] as const).map(m => (
                  <button
                    key={m}
                    className={`px-2 text-[10px] h-full transition-all ${
                      chatMode === m
                        ? m === "loop"
                          ? "bg-amber-500/15 text-amber-400"
                          : m === "consensus"
                            ? "bg-purple-500/15 text-purple-400"
                            : m === "codechat"
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-secondary/50 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"
                    }`}
                    onClick={() => setChatMode(m)}
                    title={
                      m === "single"
                        ? "Normal chat"
                        : m === "loop"
                          ? "Autonomous loop (discovery/apply/connect/critique)"
                          : m === "consensus"
                            ? "Multi-model consensus"
                            : "Claude-Code-style coding assistant with file browser, grep, and optional write tools"
                    }
                  >
                    {m === "single" ? "Single" : m === "loop" ? "Loop" : m === "consensus" ? "Consensus" : "CodeChat"}
                  </button>
                ))}
              </div>

              {/* Round D3 — Deep link to the dedicated Consensus page when
                  consensus mode is active. The standalone page exposes the
                  Round C3 trio (StreamingResults / TimingBreakdown /
                  ComparisonView) plus the cost-estimate badge and weight
                  preset picker. */}
              {chatMode === "consensus" && (
                <a
                  href={`/consensus${input ? `?q=${encodeURIComponent(input)}` : ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-1 px-2 h-7 text-[10px] inline-flex items-center rounded-lg border border-purple-500/30 text-purple-400 hover:bg-purple-500/10 transition-all"
                  title="Open the multi-model consensus panel with timing breakdown + diff view"
                >
                  Open panel →
                </a>
              )}

              {/* Pass 78 — Code Chat mode config (admin write toggle + iterations) */}
              {chatMode === "codechat" && (
                <div className="flex items-center gap-2 text-[10px]">
                  {user?.role === "admin" && (
                    <label
                      className="flex items-center gap-1 text-emerald-400 cursor-pointer"
                      title="Allow write_file / edit_file / run_bash in this session (admin only, server-gated)"
                    >
                      <input
                        type="checkbox"
                        checked={codeChatConfig.allowMutations}
                        onChange={(e) =>
                          setCodeChatConfig((p) => ({ ...p, allowMutations: e.target.checked }))
                        }
                        className="h-3 w-3"
                      />
                      Write mode
                    </label>
                  )}
                  <label className="flex items-center gap-1 text-muted-foreground">
                    iters
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={codeChatConfig.maxIterations}
                      onChange={(e) =>
                        setCodeChatConfig((p) => ({
                          ...p,
                          maxIterations: Math.max(1, Math.min(10, parseInt(e.target.value) || 5)),
                        }))
                      }
                      className="w-10 h-6 text-[10px] bg-transparent border border-border rounded px-1 text-center"
                    />
                  </label>
                  <a
                    href="/code-chat"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 h-6 text-[10px] inline-flex items-center rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    title="Open the full Code Chat admin panel (file browser + roadmap + GitHub)"
                  >
                    Full panel →
                  </a>
                </div>
              )}

              {/* Loop config (visible when loop mode active) — pillbox multi-select */}
              {chatMode === "loop" && (
                <div className="flex items-center gap-1 flex-wrap">
                  {/* Focus pills — multi-select */}
                  {(["discovery", "apply", "connect", "critique"] as const).map(f => (
                    <button
                      key={f}
                      className={`h-6 px-2 text-[10px] rounded-full border transition-all ${
                        loopConfig.foci.includes(f)
                          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
                          : "text-muted-foreground border-border hover:text-foreground hover:bg-secondary/30"
                      }`}
                      onClick={() => toggleLoopFocus(f)}
                      title={f === "discovery" ? "Explore unknowns" : f === "apply" ? "Generate actions" : f === "connect" ? "Find patterns" : "Challenge assumptions"}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                  {/* Iterations: 0 = continuous until stopped */}
                  <div className="flex items-center h-6 rounded-full border border-border overflow-hidden">
                    <button
                      className={`px-2 text-[10px] h-full ${loopConfig.maxIterations === 0 ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground hover:bg-secondary/30"}`}
                      onClick={() => setLoopConfig(p => ({ ...p, maxIterations: 0 }))}
                      title="Run continuously until stopped"
                    >
                      ∞
                    </button>
                    {[3, 5, 10, 25].map(n => (
                      <button
                        key={n}
                        className={`px-1.5 text-[10px] h-full ${loopConfig.maxIterations === n ? "bg-amber-500/15 text-amber-400" : "text-muted-foreground hover:bg-secondary/30"}`}
                        onClick={() => setLoopConfig(p => ({ ...p, maxIterations: n }))}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {/* Prompt type — optional, for loop-by-type runs */}
                  <input
                    type="text"
                    value={loopConfig.promptType}
                    onChange={e => setLoopConfig(p => ({ ...p, promptType: e.target.value }))}
                    placeholder="Prompt type (optional)"
                    className="h-6 px-2 text-[10px] rounded-full border border-border bg-background w-36 placeholder:text-muted-foreground/50 focus:outline-none focus:border-amber-500/40"
                    title="Optional: categorize this loop (e.g. 'tax-planning', 'lead-gen', 'compliance-review'). Passed to the model as context."
                  />
                  {/* Loop previous prompt — re-runs the last user message through the loop */}
                  <button
                    className="h-6 px-2 text-[10px] rounded-full border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
                    title="Re-run the most recent user prompt through the loop"
                    onClick={() => {
                      const lastUser = [...messages].reverse().find(m => m.role === "user");
                      if (!lastUser) { toast.error("Send a message first, then use the loop to iterate on it"); return; }
                      handleSendWithText(lastUser.content);
                    }}
                  >
                    ↻ Loop previous
                  </button>
                  {activeSessionId && (
                    <button
                      className="h-7 px-2 text-[10px] bg-red-500/15 text-red-400 border border-red-500/30 rounded-lg"
                      onClick={() => {
                        if (activeSessionId) autonomousStop.mutate({ sessionId: activeSessionId });
                        if (loopPollRef.current) { clearInterval(loopPollRef.current); loopPollRef.current = null; }
                        setActiveSessionId(null);
                        setChatMode("single");
                        toast.info("Autonomous loop stopped");
                      }}
                    >
                      Stop
                    </button>
                  )}
                </div>
              )}
              </>
              )}

              <div className="flex-1" />

              {/* Streaming toggle — hidden on mobile to reduce clutter */}
              {!isAnonymous && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className={`hidden md:block p-2.5 rounded-full transition-all ${
                        useStreaming
                          ? "bg-accent/15 text-accent"
                          : "hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setUseStreaming(!useStreaming)}
                    >
                      <Zap className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{useStreaming ? "Streaming on" : "Streaming off"}</TooltipContent>
                </Tooltip>
              )}

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
                  aria-label="Sending message"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                </Button>
              ) : (input.trim() || attachments.length > 0) ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 transition-all"
                  onClick={handleSend}
                  aria-label="Send message"
                >
                  <ArrowUp className="w-5 h-5" />
                </Button>
              ) : handsFreeActive ? (
                <Button
                  size="icon"
                  className="h-10 w-10 rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 animate-pulse transition-all"
                  onClick={toggleHandsFree}
                  aria-label="Stop hands-free mode"
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
                      aria-label="Start hands-free voice mode"
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

      {/* ─── MOBILE BOTTOM TAB BAR ──────────────────────────────
           Matches AppShell's mobile tab bar for navigation consistency
           so users switching between Chat and other pages always see
           the same bottom nav. Hidden on lg+ where sidebar is visible. */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around h-14 bg-card/95 backdrop-blur-sm border-t border-border/60 safe-area-bottom"
        aria-label="Mobile navigation"
      >
        {[
          { label: "Chat", icon: MessageSquare, path: "/chat", active: true, isVoice: false },
          { label: "Tools", icon: Calculator, path: "/calculators", active: false, isVoice: false },
          { label: "Insights", icon: Brain, path: "/intelligence-hub", active: false, isVoice: false },
          { label: "Learn", icon: GraduationCap, path: "/learning", active: false, isVoice: false },
          { label: "Voice", icon: AudioLines, path: "", active: false, isVoice: true },
        ].map(tab => {
          const TabIcon = tab.icon;
          return (
          <button
            key={tab.label}
            onClick={() => {
              if (tab.isVoice) {
                window.dispatchEvent(new CustomEvent("chat:toggle-handsfree"));
              } else if (!tab.active) {
                navigate(tab.path);
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 min-w-[44px] min-h-[44px] px-2 py-1 rounded-lg transition-colors ${
              tab.active ? "text-primary" : "text-muted-foreground"
            }`}
            aria-current={tab.active ? "page" : undefined}
            aria-label={tab.label}
          >
            <TabIcon className="w-5 h-5" />
            <span className="text-[10px]">{tab.label}</span>
          </button>
        );})}
      </nav>
    </div>
  );
}

/* ConvItem and SortableConvItem extracted to @/components/chat/ConvItem.tsx */
