import { Button } from "@/components/ui/button";
import { Lock, Shield, TrendingUp, Brain, BarChart3, Rocket } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

/**
 * Welcome page — the full marketing landing page.
 * Accessible at /welcome for sharing/marketing.
 * Shows hero, feature cards, trust signals, and footer.
 */
export default function Welcome() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  // If already authenticated, offer to go to chat
  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/chat");
    } else {
      navigate("/signin");
    }
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-rose-500/5 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-emerald-400 flex items-center justify-center">
              <span className="text-sm font-bold text-slate-900">W</span>
            </div>
            <span className="font-semibold text-foreground">Stewardly</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button size="sm" onClick={() => navigate("/chat")} className="bg-gradient-to-r from-sky-500 to-emerald-500 text-white border-0">
                Go to Chat
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={handleGuestAccess}>
                  Try Free
                </Button>
                <Button size="sm" onClick={() => navigate("/signin")} className="bg-gradient-to-r from-sky-500 to-emerald-500 text-white border-0">
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10">
        {/* Hero section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 animate-in fade-in duration-700">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight">
                Your finances.{" "}
                <span className="bg-gradient-to-r from-sky-400 to-emerald-400 bg-clip-text text-transparent">
                  Your way.
                </span>{" "}
                Understood.
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                An AI that learns how you think about money — and helps you think better. 
                General guidance, financial insight, and personal support that adapts to you.
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-600 hover:to-emerald-600 text-white border-0 px-8 text-base"
              >
                {isAuthenticated ? "Open Chat" : "Get Started"}
              </Button>
              {!isAuthenticated && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleGuestAccess}
                  className="border-border/50 hover:border-border px-8 text-base"
                >
                  Explore as a guest
                </Button>
              )}
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
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">It knows finance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Grounded in financial knowledge, always with appropriate context. Ask about investing, planning, or strategy.
                </p>
              </div>
            </div>

            {/* Card 3: It grows with you */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-sky-500/10">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-rose-500/10 flex items-center justify-center group-hover:bg-rose-500/20 transition-colors">
                  <Rocket className="w-6 h-6 text-rose-400" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">It grows with you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Connect with a professional, link accounts, or keep it simple. Your choice, your pace.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Multi-modal capabilities section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 border-t border-border/30">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground">
              Your AI secretary that understands <span className="text-sky-400">everything</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Share documents, screen, video, or just talk. It reviews, explains, and helps you learn from any data you have access to.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "📄", title: "Documents", desc: "Upload PDFs, images, spreadsheets — get instant analysis and summaries" },
              { icon: "🖥️", title: "Screen Share", desc: "Share your screen for real-time visual context and guidance" },
              { icon: "🎥", title: "Live Video", desc: "Point your camera at documents, whiteboards, or anything for instant understanding" },
              { icon: "🎙️", title: "Voice", desc: "Talk naturally — ask questions, get answers, have a real conversation" },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-xl border border-border/30 bg-card/30 backdrop-blur text-center space-y-3">
                <span className="text-3xl">{item.icon}</span>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
            ))}
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
              <button onClick={() => navigate("/terms")} className="text-muted-foreground hover:text-foreground transition-colors">
                Privacy
              </button>
              <button onClick={() => navigate("/terms")} className="text-muted-foreground hover:text-foreground transition-colors">
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
