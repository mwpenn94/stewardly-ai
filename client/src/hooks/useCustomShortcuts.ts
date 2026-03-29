/**
 * useCustomShortcuts — Manages user-customizable G-then-X keyboard shortcuts.
 *
 * When authenticated, syncs shortcuts to the server via tRPC.
 * Falls back to localStorage for guests or when server is unavailable.
 *
 * Default mapping:
 *   C → /chat, O → /operations, I → /intelligence-hub, A → /advisory,
 *   R → /relationships, M → /market-data, D → /documents, N → /integrations,
 *   S → /settings/profile, H → /help
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const LS_KEY = "stewardly-custom-shortcuts";

export interface ShortcutMapping {
  key: string;       // Single letter (lowercase)
  route: string;     // Target route
  label: string;     // Human-readable page name
}

export const DEFAULT_SHORTCUTS: ShortcutMapping[] = [
  { key: "c", route: "/chat", label: "Chat" },
  { key: "o", route: "/operations", label: "Operations" },
  { key: "i", route: "/intelligence-hub", label: "Intelligence" },
  { key: "a", route: "/advisory", label: "Advisory" },
  { key: "r", route: "/relationships", label: "Relationships" },
  { key: "m", route: "/market-data", label: "Market Data" },
  { key: "d", route: "/documents", label: "Documents" },
  { key: "n", route: "/integrations", label: "Integrations" },
  { key: "s", route: "/settings/profile", label: "Settings" },
  { key: "h", route: "/help", label: "Help" },
];

/** All available routes that can be assigned to shortcuts */
export const AVAILABLE_ROUTES: { route: string; label: string }[] = [
  { route: "/chat", label: "Chat" },
  { route: "/operations", label: "Operations Hub" },
  { route: "/intelligence-hub", label: "Intelligence Hub" },
  { route: "/advisory", label: "Advisory Hub" },
  { route: "/relationships", label: "Relationships" },
  { route: "/market-data", label: "Market Data" },
  { route: "/documents", label: "Documents" },
  { route: "/integrations", label: "Integrations" },
  { route: "/settings/profile", label: "Settings" },
  { route: "/help", label: "Help & Support" },
  { route: "/calculators", label: "Calculators" },
  { route: "/products", label: "Products" },
  { route: "/integration-health", label: "Integration Health" },
  { route: "/passive-actions", label: "Passive Actions" },
  { route: "/proficiency", label: "My Progress" },
  { route: "/portal", label: "Portal" },
  { route: "/organizations", label: "Organizations" },
  { route: "/manager", label: "Manager Dashboard" },
  { route: "/admin", label: "Global Admin" },
  { route: "/improvement", label: "Improvement Engine" },
  { route: "/changelog", label: "Changelog" },
];

function loadLocalShortcuts(): ShortcutMapping[] | null {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    for (const item of parsed) {
      if (typeof item.key !== "string" || typeof item.route !== "string" || typeof item.label !== "string") {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveLocalShortcuts(shortcuts: ShortcutMapping[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(shortcuts));
  } catch {}
}

export function useCustomShortcuts() {
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Server-side query — only runs when authenticated
  const serverQuery = trpc.settings.getShortcuts.useQuery(undefined, {
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  const saveMutation = trpc.settings.saveShortcuts.useMutation();

  // Track whether we've already hydrated from server
  const hydratedFromServer = useRef(false);

  const [shortcuts, setShortcuts] = useState<ShortcutMapping[]>(() => {
    return loadLocalShortcuts() ?? DEFAULT_SHORTCUTS;
  });

  const [isCustomized, setIsCustomized] = useState(() => {
    return loadLocalShortcuts() !== null;
  });

  // Hydrate from server when data arrives (once)
  useEffect(() => {
    if (serverQuery.data && !hydratedFromServer.current) {
      hydratedFromServer.current = true;
      const serverShortcuts = serverQuery.data.shortcuts as ShortcutMapping[] | null;
      if (serverShortcuts && Array.isArray(serverShortcuts) && serverShortcuts.length > 0) {
        setShortcuts(serverShortcuts);
        setIsCustomized(true);
        saveLocalShortcuts(serverShortcuts); // Keep localStorage in sync
      }
    }
  }, [serverQuery.data]);

  // Build a key→route lookup for fast navigation
  const shortcutMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shortcuts) {
      map.set(s.key.toLowerCase(), s.route);
    }
    return map;
  }, [shortcuts]);

  // Persist to both localStorage and server
  const persistShortcuts = useCallback((next: ShortcutMapping[]) => {
    saveLocalShortcuts(next);
    if (isAuthenticated) {
      saveMutation.mutate({ shortcuts: next });
    }
  }, [isAuthenticated, saveMutation]);

  const updateShortcut = useCallback((index: number, update: Partial<ShortcutMapping>) => {
    setShortcuts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      persistShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, [persistShortcuts]);

  const resetToDefaults = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    setIsCustomized(false);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
    if (isAuthenticated) {
      // Save defaults to server to clear custom shortcuts
      saveMutation.mutate({ shortcuts: DEFAULT_SHORTCUTS });
    }
  }, [isAuthenticated, saveMutation]);

  const addShortcut = useCallback((mapping: ShortcutMapping) => {
    setShortcuts(prev => {
      const filtered = prev.filter(s => s.key.toLowerCase() !== mapping.key.toLowerCase());
      const next = [...filtered, mapping];
      persistShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, [persistShortcuts]);

  const removeShortcut = useCallback((key: string) => {
    setShortcuts(prev => {
      const next = prev.filter(s => s.key.toLowerCase() !== key.toLowerCase());
      persistShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, [persistShortcuts]);

  return {
    shortcuts,
    shortcutMap,
    isCustomized,
    updateShortcut,
    resetToDefaults,
    addShortcut,
    removeShortcut,
    isSyncing: saveMutation.isPending,
  };
}
