import { useState, useCallback, useEffect } from "react";

export interface GuestPreferences {
  /** AI response depth: brief, balanced, detailed */
  responseDepth: "brief" | "balanced" | "detailed";
  /** Tone: professional, friendly, casual */
  tone: "professional" | "friendly" | "casual";
  /** Focus areas the guest is interested in */
  focusAreas: string[];
  /** Language style: simple, standard, technical */
  languageStyle: "simple" | "standard" | "technical";
  /** Whether to include examples in responses */
  includeExamples: boolean;
  /** Preferred response format */
  responseFormat: "conversational" | "structured" | "bullet-points";
}

const STORAGE_KEY = "stewardry_guest_preferences";

const DEFAULT_PREFERENCES: GuestPreferences = {
  responseDepth: "balanced",
  tone: "friendly",
  focusAreas: ["general"],
  languageStyle: "standard",
  includeExamples: true,
  responseFormat: "conversational",
};

function loadPreferences(): GuestPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_PREFERENCES;
}

export function useGuestPreferences() {
  const [preferences, setPreferencesState] = useState<GuestPreferences>(loadPreferences);

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          setPreferencesState({ ...DEFAULT_PREFERENCES, ...JSON.parse(e.newValue) });
        } catch { /* ignore */ }
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setPreferences = useCallback((update: Partial<GuestPreferences>) => {
    setPreferencesState(prev => {
      const next = { ...prev, ...update };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch { /* storage full, ignore */ }
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  }, []);

  /** Build a system prompt fragment from guest preferences */
  const toPromptFragment = useCallback((): string => {
    const parts: string[] = [];
    parts.push(`Response depth: ${preferences.responseDepth}`);
    parts.push(`Tone: ${preferences.tone}`);
    parts.push(`Language style: ${preferences.languageStyle}`);
    parts.push(`Include examples: ${preferences.includeExamples ? "yes" : "no"}`);
    parts.push(`Response format: ${preferences.responseFormat}`);
    if (preferences.focusAreas.length > 0) {
      parts.push(`Focus areas: ${preferences.focusAreas.join(", ")}`);
    }
    return `<guest_preferences>\n${parts.join("\n")}\n</guest_preferences>`;
  }, [preferences]);

  return { preferences, setPreferences, resetPreferences, toPromptFragment, DEFAULT_PREFERENCES };
}

export { DEFAULT_PREFERENCES };
