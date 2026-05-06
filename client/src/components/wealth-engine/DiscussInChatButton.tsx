/**
 * DiscussInChatButton — reusable "Discuss in Chat →" button for calculator pages.
 *
 * When clicked, navigates to /chat. The AI chat will automatically pick up
 * the calculator context from localStorage (see calculatorContext.ts) and
 * provide informed, contextual answers about the user's results.
 *
 * Optionally accepts a `prompt` prop that pre-fills the chat input with a
 * suggested question relevant to the page's results.
 */

import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";

interface Props {
  /** Optional pre-filled prompt for the chat. */
  prompt?: string;
  /** Button label override. */
  label?: string;
  /** Additional CSS classes. */
  className?: string;
}

export function DiscussInChatButton({ prompt, label, className }: Props) {
  const [, navigate] = useLocation();

  const handleClick = () => {
    if (prompt) {
      // Store the prompt so Chat.tsx can pick it up
      try {
        sessionStorage.setItem("stewardly-chat-prefill", prompt);
      } catch {
        // sessionStorage unavailable — still navigate
      }
    }
    navigate("/chat");
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={`gap-2 text-xs text-muted-foreground hover:text-accent ${className ?? ""}`}
      onClick={handleClick}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      {label ?? "Discuss in Chat →"}
    </Button>
  );
}
