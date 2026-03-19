import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "steward_anon_conversations";
const MAX_CONVERSATIONS = 5;
const MAX_MESSAGES_PER_CONVO = 10;

export interface AnonMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AnonConversation {
  id: string;
  title: string;
  messages: AnonMessage[];
  createdAt: number;
  updatedAt: number;
}

interface AnonChatState {
  conversations: AnonConversation[];
  activeConversationId: string | null;
}

function loadState(): AnonChatState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { conversations: [], activeConversationId: null };
}

function saveState(state: AnonChatState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export interface UseAnonymousChatReturn {
  conversations: AnonConversation[];
  activeConversation: AnonConversation | null;
  messages: AnonMessage[];
  /** Create a new anonymous conversation */
  createConversation: () => string;
  /** Set the active conversation */
  setActiveConversation: (id: string | null) => void;
  /** Add a message to the active conversation */
  addMessage: (role: "user" | "assistant", content: string) => void;
  /** Delete a conversation */
  deleteConversation: (id: string) => void;
  /** Whether the user has hit the conversation limit */
  atConversationLimit: boolean;
  /** Whether the active conversation has hit the message limit */
  atMessageLimit: boolean;
  /** Total message count across all conversations */
  totalMessages: number;
  /** Whether to show the upgrade prompt (after 3 messages in any convo) */
  shouldPromptUpgrade: boolean;
  /** Clear all anonymous data */
  clearAll: () => void;
}

/**
 * Manages anonymous/guest chat state in localStorage.
 * Tier 0: 5 conversations, 10 messages each, general education only.
 * After 3 messages, prompts "Want to save your progress?"
 */
export function useAnonymousChat(): UseAnonymousChatReturn {
  const [state, setState] = useState<AnonChatState>(loadState);

  // Persist on every change
  useEffect(() => {
    saveState(state);
  }, [state]);

  const activeConversation = state.conversations.find(
    (c) => c.id === state.activeConversationId
  ) || null;

  const messages = activeConversation?.messages || [];

  const totalMessages = state.conversations.reduce(
    (sum, c) => sum + c.messages.filter((m) => m.role === "user").length,
    0
  );

  const createConversation = useCallback(() => {
    const id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const convo: AnonConversation = {
      id,
      title: "New conversation",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setState((prev) => ({
      conversations: [convo, ...prev.conversations].slice(0, MAX_CONVERSATIONS),
      activeConversationId: id,
    }));
    return id;
  }, []);

  const setActiveConversation = useCallback((id: string | null) => {
    setState((prev) => ({ ...prev, activeConversationId: id }));
  }, []);

  const addMessage = useCallback(
    (role: "user" | "assistant", content: string) => {
      setState((prev) => {
        const convos = prev.conversations.map((c) => {
          if (c.id !== prev.activeConversationId) return c;
          const msg: AnonMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            role,
            content,
            timestamp: Date.now(),
          };
          const newMessages = [...c.messages, msg];
          // Auto-title from first user message
          const title =
            c.messages.length === 0 && role === "user"
              ? content.slice(0, 60) + (content.length > 60 ? "..." : "")
              : c.title;
          return { ...c, messages: newMessages, title, updatedAt: Date.now() };
        });
        return { ...prev, conversations: convos };
      });
    },
    []
  );

  const deleteConversation = useCallback((id: string) => {
    setState((prev) => ({
      conversations: prev.conversations.filter((c) => c.id !== id),
      activeConversationId:
        prev.activeConversationId === id ? null : prev.activeConversationId,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setState({ conversations: [], activeConversationId: null });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    conversations: state.conversations,
    activeConversation,
    messages,
    createConversation,
    setActiveConversation,
    addMessage,
    deleteConversation,
    atConversationLimit: state.conversations.length >= MAX_CONVERSATIONS,
    atMessageLimit: messages.filter((m) => m.role === "user").length >= MAX_MESSAGES_PER_CONVO,
    totalMessages,
    shouldPromptUpgrade: totalMessages >= 3,
    clearAll,
  };
}
