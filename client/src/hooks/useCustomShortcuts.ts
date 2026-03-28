/**
 * useCustomShortcuts — Manages user-customizable G-then-X keyboard shortcuts.
 *
 * Persists custom key mappings to localStorage so they survive page reloads.
 * Falls back to the default mapping when no customization exists.
 *
 * Default mapping:
 *   C → /chat, O → /operations, I → /intelligence-hub, A → /advisory,
 *   R → /relationships, M → /market-data, D → /documents, N → /integrations,
 *   S → /settings/profile, H → /help
 */
import { useState, useEffect, useCallback, useMemo } from "react";

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

function loadCustomShortcuts(): ShortcutMapping[] | null {
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    // Validate structure
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

function saveCustomShortcuts(shortcuts: ShortcutMapping[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(shortcuts));
  } catch {}
}

export function useCustomShortcuts() {
  const [shortcuts, setShortcuts] = useState<ShortcutMapping[]>(() => {
    return loadCustomShortcuts() ?? DEFAULT_SHORTCUTS;
  });

  const [isCustomized, setIsCustomized] = useState(() => {
    return loadCustomShortcuts() !== null;
  });

  // Build a key→route lookup for fast navigation
  const shortcutMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of shortcuts) {
      map.set(s.key.toLowerCase(), s.route);
    }
    return map;
  }, [shortcuts]);

  const updateShortcut = useCallback((index: number, update: Partial<ShortcutMapping>) => {
    setShortcuts(prev => {
      const next = [...prev];
      next[index] = { ...next[index], ...update };
      saveCustomShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    setIsCustomized(false);
    try {
      localStorage.removeItem(LS_KEY);
    } catch {}
  }, []);

  const addShortcut = useCallback((mapping: ShortcutMapping) => {
    setShortcuts(prev => {
      // Don't allow duplicate keys
      const filtered = prev.filter(s => s.key.toLowerCase() !== mapping.key.toLowerCase());
      const next = [...filtered, mapping];
      saveCustomShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, []);

  const removeShortcut = useCallback((key: string) => {
    setShortcuts(prev => {
      const next = prev.filter(s => s.key.toLowerCase() !== key.toLowerCase());
      saveCustomShortcuts(next);
      setIsCustomized(true);
      return next;
    });
  }, []);

  return {
    shortcuts,
    shortcutMap,
    isCustomized,
    updateShortcut,
    resetToDefaults,
    addShortcut,
    removeShortcut,
  };
}
