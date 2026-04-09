import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { usePopupSlot, registerPopup, dismissPopup } from "@/hooks/usePopupQueue";

/**
 * Browse-wrap consent banner — non-blocking, subtle.
 * Shows at the bottom of the page for new users.
 * Dismissed after user clicks "Got it".
 *
 * Participates in the popup queue so it doesn't stack with the
 * tour or what's-new modal on mobile.
 */
export default function ConsentBanner() {
  const [wantsToShow, setWantsToShow] = useState(false);
  const canShow = usePopupSlot("consent");

  useEffect(() => {
    const dismissed = localStorage.getItem("consentBannerDismissed");
    if (!dismissed) {
      // Register with the queue after a brief delay
      const timer = setTimeout(() => {
        setWantsToShow(true);
        registerPopup("consent");
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setWantsToShow(false);
    localStorage.setItem("consentBannerDismissed", "true");
    dismissPopup("consent");
  };

  if (!wantsToShow || !canShow) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-4xl mx-auto px-4 pb-4">
        <div className="bg-card/95 backdrop-blur-md border border-border/50 rounded-xl px-5 py-3 flex items-center gap-4 shadow-lg">
          <p className="text-sm text-muted-foreground flex-1">
            By using this service, you agree to our{" "}
            <a href="/terms" className="text-accent hover:underline">Terms of Service</a>{" "}
            and{" "}
            <a href="/privacy" className="text-accent hover:underline">Privacy Policy</a>.
            Your data is private by default.
          </p>
          <button
            onClick={dismiss}
            className="text-xs font-medium text-foreground bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Got it
          </button>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
