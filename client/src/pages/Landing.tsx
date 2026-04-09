/**
 * Landing — root `/` route, pure redirect to `/chat`.
 *
 * Per v10.0 ("Chat IS the landing page and feature gateway"), every
 * visitor — authenticated or guest — lands directly in chat. The
 * marketing landing page lives at `/welcome` for sharing/marketing
 * URLs. This module used to render 196 lines of unreachable hero+
 * feature-card UI that briefly flashed before the redirect; pass 91
 * stripped that dead code out.
 */
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      // Default to guest mode so the chat empty state is usable without
      // an account. The visitor can still click "Sign in" inside Chat.
      try { localStorage.setItem("anonymousMode", "true"); } catch {}
    }
    navigate("/chat");
  }, [isAuthenticated, loading, navigate]);

  return null;
}
