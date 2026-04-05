import { Button } from "@/components/ui/button";
import { Lock, Shield, TrendingUp, Brain, BarChart3, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

export default function Landing() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    
    if (isAuthenticated) {
      navigate("/chat");
    } else {
      // Default to guest mode
      localStorage.setItem("anonymousMode", "true");
      navigate("/chat");
    }
  }, [isAuthenticated, loading, navigate]);

  const handleGetStarted = () => {
    navigate("/signin");
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    navigate("/chat");
  };

  // Show nothing while loading or redirecting
  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-teal-400 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-900">AI</span>
            </div>
            <span className="font-semibold text-foreground">Financial Intelligence</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGetStarted}
            className="border-border/50 hover:border-border"
          >
            Sign In
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10">
        {/* Hero section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 animate-in fade-in duration-700">
            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground">
                Your finances.{" "}
                <span className="bg-gradient-to-r from-sky-400 to-teal-400 bg-clip-text text-transparent">
                  Your way.
                </span>{" "}
                Understood.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                An AI that learns how you think about money — and helps you think better. General guidance, financial insight, and personal support that adapts to you.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white border-0 px-8"
              >
                Get Started
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleGuestAccess}
                className="border-border/50 hover:border-border px-8"
              >
                Explore as a guest
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-400" />
                <span>Private by default</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-sky-400" />
                <span>You own your data</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span>AI-powered insight</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: It learns you */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                  <Brain className="w-6 h-6 text-sky-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">It learns you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your goals, your style, your questions shape how it responds. The more you share, the more it understands.
                </p>
              </div>
            </div>

            {/* Card 2: It knows finance */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                  <BarChart3 className="w-6 h-6 text-sky-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">It knows finance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Grounded in financial knowledge, always with appropriate context. Ask about investing, planning, or strategy.
                </p>
              </div>
            </div>

            {/* Card 3: It grows with you */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-teal-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center group-hover:bg-sky-500/20 transition-colors">
                  <Rocket className="w-6 h-6 text-sky-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">It grows with you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Connect with a professional, link accounts, or keep it simple. Your choice, your pace.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground text-center">
              AI-powered. Not a substitute for professional financial advice.
            </p>
            <div className="flex flex-col sm:flex-row gap-6 justify-center text-sm">
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                Terms
              </button>
              <button className="text-muted-foreground hover:text-foreground transition-colors">
                About
              </button>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center">
              © 2026 Stewardly. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
