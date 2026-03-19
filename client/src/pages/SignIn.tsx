import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Mail, Chrome } from "lucide-react";

export default function SignIn() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated, redirect to chat
  if (isAuthenticated) {
    navigate("/chat");
    return null;
  }

  const handleGoogleSignIn = () => {
    const loginUrl = getLoginUrl();
    window.location.href = loginUrl;
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // TODO: Implement email/password sign-in via tRPC
      // For now, show a placeholder
      setError("Email sign-in coming soon. Please use Google OAuth.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    navigate("/chat");
  };

  const handleBackToLanding = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Logo and title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-900">PA</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your Personal AI account
          </p>
        </div>

        {/* Sign-in card */}
        <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur p-8 space-y-6">
          {/* Google OAuth */}
          <Button
            onClick={handleGoogleSignIn}
            variant="outline"
            className="w-full border-border/50 hover:border-border h-11 gap-2"
          >
            <Chrome className="w-4 h-4" />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/30" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card/50 px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Email/password form */}
          <form onSubmit={handleEmailSignIn} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                className="bg-background/50 border-border/50 h-10"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="bg-background/50 border-border/50 h-10"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email || !password}
              className="w-full bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white border-0 h-10"
            >
              {isLoading ? "Signing in..." : "Sign in with email"}
            </Button>
          </form>

          {/* Guest access */}
          <Button
            onClick={handleGuestAccess}
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground h-10"
          >
            Continue as guest
          </Button>
        </div>

        {/* Footer links */}
        <div className="text-center space-y-3">
          <p className="text-xs text-muted-foreground">
            New to Personal AI?{" "}
            <button
              onClick={handleGoogleSignIn}
              className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
            >
              Sign up with Google
            </button>
          </p>
          <button
            onClick={handleBackToLanding}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
