/**
 * OfflineBanner — non-intrusive banner that appears when the user loses
 * network connectivity and auto-dismisses when connectivity returns.
 *
 * Uses the browser's `navigator.onLine` + `online`/`offline` events.
 * Includes a brief "Back online" confirmation before fully dismissing.
 */
import { useState, useEffect, useRef } from "react";
import { WifiOff, Wifi } from "lucide-react";

type BannerState = "hidden" | "offline" | "reconnected";

export default function OfflineBanner() {
  const [state, setState] = useState<BannerState>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "hidden"
  );
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleOffline() {
      // Clear any pending "reconnected" dismiss timer
      if (dismissTimer.current) {
        clearTimeout(dismissTimer.current);
        dismissTimer.current = null;
      }
      setState("offline");
    }

    function handleOnline() {
      setState("reconnected");
      // Auto-dismiss the "Back online" message after 3 seconds
      dismissTimer.current = setTimeout(() => {
        setState("hidden");
        dismissTimer.current = null;
      }, 3000);
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  if (state === "hidden") return null;

  const isOffline = state === "offline";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`
        fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2
        px-4 py-2.5 text-sm font-medium
        transition-all duration-300 ease-in-out
        ${isOffline
          ? "bg-amber-500/95 text-amber-950 dark:bg-amber-600/95 dark:text-amber-50"
          : "bg-emerald-500/95 text-emerald-950 dark:bg-emerald-600/95 dark:text-emerald-50"
        }
      `}
    >
      {isOffline ? (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You&apos;re offline. Some features may be unavailable until your connection is restored.</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4 shrink-0" />
          <span>Back online — connection restored.</span>
        </>
      )}
    </div>
  );
}
