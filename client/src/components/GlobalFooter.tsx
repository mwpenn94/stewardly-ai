import { Shield, Scale, FileText } from "lucide-react";
import { useLocation } from "wouter";

/**
 * GlobalFooter — persistent footer with privacy/terms links and financial disclaimer.
 * Shown on all pages except the chat page (which has its own footer area).
 */
export default function GlobalFooter() {
  const [location] = useLocation();

  // Don't show on chat pages (they have their own input area) or landing pages
  const hiddenPaths = ["/chat", "/signin", "/org/"];
  if (hiddenPaths.some(p => location.startsWith(p))) return null;

  return (
    <footer className="border-t border-border/30 bg-card/20 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Financial disclaimer */}
        <div className="flex items-start gap-2 mb-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
          <Scale className="w-3.5 h-3.5 text-amber-500/70 shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            Stewardly provides AI-powered informational content only. Nothing on this platform constitutes
            personalized financial, investment, insurance, tax, or legal advice. Always consult with a
            licensed professional before making financial decisions. Past performance does not guarantee
            future results.
          </p>
        </div>

        {/* Links row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground/60">
            <a href="/privacy" className="hover:text-foreground transition-colors flex items-center gap-1">
              <Shield className="w-3 h-3" /> Privacy Policy
            </a>
            <a href="/terms" className="hover:text-foreground transition-colors flex items-center gap-1">
              <FileText className="w-3 h-3" /> Terms of Service
            </a>
            <a href="/help" className="hover:text-foreground transition-colors">
              Help & Support
            </a>
          </div>
          <p className="text-[10px] text-muted-foreground/60">
            &copy; {new Date().getFullYear()} Stewardly. AI-assisted advisory platform.
          </p>
        </div>
      </div>
    </footer>
  );
}
