import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { LogIn, X, Shield } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";

/**
 * GuestBanner — persistent but dismissible banner shown to anonymous/guest users.
 * Encourages them to sign in to save their session data permanently.
 * Hidden on /chat pages where the chat header already provides sign-in controls.
 */
export function GuestBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem("guest-banner-dismissed") === "true";
  });

  // Only show for guest/anonymous users, and hide on chat pages (redundant with chat header)
  if (!user || user.authTier !== "anonymous" || dismissed) return null;
  if (location.startsWith("/chat")) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Shield className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-200/80 truncate">
            <span className="font-medium text-amber-300">Guest session</span>
            {" — "}Your data is temporary. Sign in to save your progress and unlock all features.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="text-xs gap-1.5 border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
            onClick={() => {
              // Store guest openId for potential migration after sign-in
              if (user?.openId) {
                sessionStorage.setItem("guest-openId", user.openId);
              }
              window.location.href = getLoginUrl();
            }}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </Button>
          <button
            onClick={() => {
              setDismissed(true);
              sessionStorage.setItem("guest-banner-dismissed", "true");
            }}
            className="text-amber-500/50 hover:text-amber-500 transition-colors p-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
