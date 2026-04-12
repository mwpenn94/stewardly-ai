import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, AudioLines } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  private voiceListener: ((e: KeyboardEvent) => void) | null = null;
  private speechRecognition: any | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Build Loop Pass 11 (G49): audio cue so blind users know
    // something catastrophic happened. Uses Web Speech TTS with a
    // short Steward-personality message. Guarded by typeof check
    // for SSR safety. Non-throwing — if TTS is unavailable we
    // silently skip.
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          "Something went wrong. Say 'reload' or press R to retry.",
        );
        utter.rate = 1.05;
        utter.volume = 0.85;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      /* ignore — non-critical */
    }
    // Log to console for devs + any observability pipeline. In prod
    // this would route through the error-tracking client.
    console.error("[ErrorBoundary] caught error:", error, info);
  }

  componentDidUpdate(_: Props, prevState: State) {
    // Install the "press R to reload" + voice "reload" listeners
    // only once, when we flip into error state.
    if (!prevState.hasError && this.state.hasError) {
      this.installVoiceAndKeyListeners();
    }
    if (prevState.hasError && !this.state.hasError) {
      this.removeVoiceAndKeyListeners();
    }
  }

  componentWillUnmount() {
    this.removeVoiceAndKeyListeners();
  }

  installVoiceAndKeyListeners() {
    // Keyboard: R or Enter triggers reload. Escape dismisses the
    // error announcement (cancels TTS).
    this.voiceListener = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "r" || e.key === "Enter") {
        e.preventDefault();
        window.location.reload();
      }
      if (e.key === "Escape") {
        try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      }
    };
    window.addEventListener("keydown", this.voiceListener);

    // Voice: listen for "reload" / "retry" / "try again". Uses a
    // fresh SpeechRecognition instance since the app's regular voice
    // hooks may have been torn down by the error. One-shot, no
    // continuous loop — users say the word once and we reload.
    try {
      if (typeof window !== "undefined") {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SR) {
          const rec = new SR();
          rec.continuous = false;
          rec.interimResults = false;
          rec.lang = "en-US";
          rec.onresult = (ev: any) => {
            const last = ev.results?.[ev.results.length - 1];
            const transcript = (last?.[0]?.transcript || "").trim().toLowerCase();
            if (/\b(reload|retry|try again|reboot)\b/.test(transcript)) {
              window.location.reload();
            }
          };
          rec.onend = () => {
            // Restart so the user has multiple chances to say the word.
            if (this.state.hasError) {
              try { rec.start(); } catch { /* ignore */ }
            }
          };
          try {
            rec.start();
            this.speechRecognition = rec;
          } catch { /* ignore — mic unavailable */ }
        }
      }
    } catch {
      /* ignore */
    }
  }

  removeVoiceAndKeyListeners() {
    if (this.voiceListener) {
      window.removeEventListener("keydown", this.voiceListener);
      this.voiceListener = null;
    }
    if (this.speechRecognition) {
      try { this.speechRecognition.abort(); } catch { /* ignore */ }
      this.speechRecognition = null;
    }
    try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
  }

  render() {
    if (this.state.hasError) {
      return (
        // Build Loop Pass 11 (G49): role="alert" + aria-live assertive
        // so screen readers announce the error state immediately,
        // regardless of any other live region's verbosity.
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-center justify-center min-h-screen p-8 bg-background"
        >
          <div className="flex flex-col items-center w-full max-w-2xl p-8">
            <AlertTriangle
              size={48}
              className="text-destructive mb-6 flex-shrink-0"
              aria-hidden="true"
            />

            <h2 className="text-xl mb-4 font-heading">Something went wrong.</h2>

            <p className="text-sm text-muted-foreground mb-2 text-center">
              {this.state.error?.message || "Please try reloading the page."}
            </p>
            {import.meta.env.DEV && this.state.error?.stack && (
              <div className="p-4 w-full rounded bg-muted overflow-auto mb-6">
                <pre className="text-sm text-muted-foreground whitespace-break-spaces">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <button
              onClick={() => window.location.reload()}
              autoFocus
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-primary text-primary-foreground",
                "hover:opacity-90 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              )}
              aria-label="Reload the page"
            >
              <RotateCcw size={16} aria-hidden="true" />
              Reload Page
            </button>

            {/* Pass 11 (G49): keyboard + voice affordance hint */}
            <p className="mt-4 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <AudioLines className="w-3 h-3" aria-hidden="true" />
              Press <kbd className="mx-0.5 px-1 py-0.5 rounded bg-secondary/60 border border-border/60 text-[10px] font-mono">R</kbd>
              or say <span className="italic">"reload"</span> to retry
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
