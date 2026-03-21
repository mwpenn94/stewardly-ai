/**
 * Navigate to the chat page with a pre-filled prompt.
 * 
 * Stores the prompt in sessionStorage so the Chat component can pick it up
 * on mount and pre-fill the input field. This enables hub pages and other
 * modules to route users to chat with contextual AI prompts.
 * 
 * Usage:
 *   navigateToChat("Run a full portfolio risk analysis")
 *   navigateToChat("Compare IUL products for a 45-year-old client", "financial")
 */

const PENDING_PROMPT_KEY = "stewardly_pending_chat_prompt";
const PENDING_FOCUS_KEY = "stewardly_pending_chat_focus";

export type ChatFocus = "general" | "financial" | "study";

export function navigateToChat(prompt: string, focus?: ChatFocus) {
  sessionStorage.setItem(PENDING_PROMPT_KEY, prompt);
  if (focus) {
    sessionStorage.setItem(PENDING_FOCUS_KEY, focus);
  }
  window.location.assign("/chat");
}

/**
 * Consume the pending prompt (called once by Chat on mount).
 * Returns null if no pending prompt exists.
 */
export function consumePendingPrompt(): { prompt: string; focus?: ChatFocus } | null {
  const prompt = sessionStorage.getItem(PENDING_PROMPT_KEY);
  if (!prompt) return null;
  
  const focus = sessionStorage.getItem(PENDING_FOCUS_KEY) as ChatFocus | null;
  
  // Clear immediately so it doesn't fire again on refresh
  sessionStorage.removeItem(PENDING_PROMPT_KEY);
  sessionStorage.removeItem(PENDING_FOCUS_KEY);
  
  return { prompt, focus: focus || undefined };
}
