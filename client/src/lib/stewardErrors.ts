/**
 * stewardErrors.ts — Steward personality-driven error messages
 */
export const STEWARD_ERRORS: Record<string, { message: string; recovery: string }> = {
  NETWORK: { message: "I've lost my connection.", recovery: "Reconnecting — your work is safe." },
  RATE_LIMIT: { message: "I'm thinking too fast.", recovery: "Give me a moment and try again." },
  AUTH_EXPIRED: { message: "Your session has expired.", recovery: "Sign in to continue where you left off." },
  GENERIC: { message: "Something went wrong on my end.", recovery: "Retrying automatically…" },
  AI_UNAVAILABLE: { message: "My intelligence systems are temporarily offline.", recovery: "You can still browse documents, check compliance, and view client profiles." },
  NOT_FOUND: { message: "I couldn't find what you're looking for.", recovery: "Try searching with different terms." },
  PERMISSION: { message: "You don't have access to that.", recovery: "Contact your administrator if you need it." },
};

export function getStewardError(code?: string) {
  return STEWARD_ERRORS[code ?? "GENERIC"] ?? STEWARD_ERRORS.GENERIC;
}
