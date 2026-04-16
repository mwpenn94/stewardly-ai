/**
 * DisclosureContext — Unified Progressive Disclosure System
 *
 * Provides a global disclosure level (1-4) that controls feature visibility
 * across ALL surfaces. This is the single source of truth for what a user
 * sees at any given time.
 *
 * Level 1 (Essential): Core features only — Chat, Financial Twin, basic calculators
 * Level 2 (Standard): + Wealth Engine, Products, Market Data, Learning
 * Level 3 (Professional): + Advisory tools, CRM, Compliance, Integrations
 * Level 4 (Expert): Everything — AI Agents, Admin tools, Advanced analytics
 *
 * The level is persisted in localStorage and optionally synced to the server
 * via user preferences. Managers can set a maximum level for their team members.
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export type DisclosureLevel = 1 | 2 | 3 | 4;

export const DISCLOSURE_LABELS: Record<DisclosureLevel, { label: string; description: string }> = {
  1: { label: "Essential", description: "Core features — Chat, Financial Twin, basic tools" },
  2: { label: "Standard", description: "Wealth Engine, Products, Market Data, Learning" },
  3: { label: "Professional", description: "Advisory tools, CRM, Compliance, Integrations" },
  4: { label: "Expert", description: "Full platform — AI Agents, Admin, Advanced analytics" },
};

interface DisclosureContextValue {
  level: DisclosureLevel;
  setLevel: (level: DisclosureLevel) => void;
  /** Check if a feature at the given minimum level should be visible */
  isVisible: (minLevel: DisclosureLevel) => boolean;
  /** The maximum level this user is allowed to set (set by manager or default 4) */
  maxLevel: DisclosureLevel;
}

const DisclosureContext = createContext<DisclosureContextValue>({
  level: 2,
  setLevel: () => {},
  isVisible: () => true,
  maxLevel: 4,
});

const STORAGE_KEY = "stewardly-disclosure-level";

export function DisclosureProvider({ children, maxLevel = 4 }: { children: ReactNode; maxLevel?: DisclosureLevel }) {
  const [level, setLevelRaw] = useState<DisclosureLevel>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = parseInt(stored, 10) as DisclosureLevel;
        if (parsed >= 1 && parsed <= 4) return Math.min(parsed, maxLevel) as DisclosureLevel;
      }
    } catch {}
    return 2; // Default to Standard
  });

  const setLevel = useCallback((newLevel: DisclosureLevel) => {
    const clamped = Math.min(Math.max(newLevel, 1), maxLevel) as DisclosureLevel;
    setLevelRaw(clamped);
    try { localStorage.setItem(STORAGE_KEY, String(clamped)); } catch {}
  }, [maxLevel]);

  // Clamp if maxLevel changes
  useEffect(() => {
    if (level > maxLevel) setLevel(maxLevel);
  }, [maxLevel, level, setLevel]);

  const isVisible = useCallback((minLevel: DisclosureLevel) => level >= minLevel, [level]);

  return (
    <DisclosureContext.Provider value={{ level, setLevel, isVisible, maxLevel }}>
      {children}
    </DisclosureContext.Provider>
  );
}

export function useDisclosure() {
  return useContext(DisclosureContext);
}

/**
 * Utility: filter an array of items by their disclosure level.
 * Items without a disclosureLevel default to level 1 (always visible).
 */
export function filterByDisclosure<T extends { disclosureLevel?: DisclosureLevel }>(
  items: T[],
  currentLevel: DisclosureLevel,
): T[] {
  return items.filter(item => (item.disclosureLevel ?? 1) <= currentLevel);
}
