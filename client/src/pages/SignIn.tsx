import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { Chrome, Eye, EyeOff, ArrowLeft } from "lucide-react";

export default function SignIn() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const signInMutation = trpc.emailAuth.signIn.useMutation({
    onSuccess: () => {
      // Pass 84: post-login users land on /dashboard (activity hub)
      // instead of /chat, so they see recent conversations + proactive
      // insights + quick actions before jumping into a conversation.
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const signUpMutation = trpc.emailAuth.signUp.useMutation({
    onSuccess: () => {
      window.location.href = "/dashboard";
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  const isLoading = signInMutation.isPending || signUpMutation.isPending;

  // If already authenticated, redirect to the dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/dashboard");
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const handleGoogleSignIn = () => {
    const loginUrl = getLoginUrl();
    window.location.href = loginUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!name.trim()) {
        setError("Name is required");
        return;
      }
      signUpMutation.mutate({ email, password, name: name.trim() });
    } else {
      signInMutation.mutate({ email, password });
    }
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="w-full max-w-md space-y-8">
        {/* Logo and title */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
              <span className="text-lg font-bold text-slate-900">W</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to your Stewardly account"
              : "Get started with personalized financial intelligence"}
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
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Full name
                </label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isLoading}
                  className="bg-background/50 border-border/50 h-10"
                  autoComplete="name"
                />
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Email address
              </label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                disabled={isLoading}
                className="bg-background/50 border-border/50 h-10"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  disabled={isLoading}
                  className="bg-background/50 border-border/50 h-10 pr-10"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "signup" && (
                <p className="text-xs text-muted-foreground">
                  At least 8 characters with uppercase, lowercase, and a number
                </p>
              )}
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-sm text-rose-400">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading || !email || !password || (mode === "signup" && !name)}
              className="w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white border-0 h-10"
            >
              {isLoading
                ? mode === "signin" ? "Signing in..." : "Creating account..."
                : mode === "signin" ? "Sign in" : "Create account"}
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
            {mode === "signin" ? (
              <>
                New here?{" "}
                <button
                  onClick={() => { setMode("signup"); setError(""); }}
                  className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  onClick={() => { setMode("signin"); setError(""); }}
                  className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" />
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}
