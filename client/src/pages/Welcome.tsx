import { Button } from "@/components/ui/button";
import { Lock, Shield, TrendingUp, Brain, BarChart3, Rocket, FileText, Monitor, Video, Mic } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { SEOHead } from "@/components/SEOHead";

/**
 * Welcome page — the full marketing landing page.
 * Accessible at /welcome for sharing/marketing.
 * Shows hero, feature cards, trust signals, and footer.
 */
export default function Welcome() {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  // Pass 85 (v10.0 revert): Chat IS the landing page and feature
  // gateway — no /dashboard route. Both authenticated users and
  // guests land on /chat. Feature discoverability lives INSIDE the
  // Chat empty state (Pass 86). This matches the pattern every
  // conversational AI product uses and saves the user a click
  // on every login.
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
      <SEOHead title="Welcome to Stewardly" description="AI-powered financial stewardship platform. Multi-model intelligence, compliance-aware advisory, and 128+ financial tools." />
      <a href="#welcome-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:rounded-md focus:bg-accent focus:text-accent-foreground focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/40">Skip to main content</a>
      {/* Pass 100 Stewardship Gold: background glows use semantic tokens
          (accent = gold, chart-2 = emerald, chart-5 = purple) so the
          mesh harmonizes with the gold identity instead of the old
          hardcoded sky blue. */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-background" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl opacity-40 animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-chart-2/10 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-chart-5/5 rounded-full blur-3xl opacity-20 animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shadow-[0_0_16px_-4px] shadow-accent/60">
              <span className="text-sm font-bold text-accent-foreground font-heading">S</span>
            </div>
            <span className="font-semibold text-foreground">Stewardly</span>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Button size="sm" onClick={() => navigate("/chat")} className="bg-accent hover:bg-accent/90 text-accent-foreground border-0 shadow-[0_4px_16px_-6px] shadow-accent/50">
                Go to Chat
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={handleGuestAccess}>
                  Try Free
                </Button>
                <Button size="sm" onClick={() => navigate("/signin")} className="bg-accent hover:bg-accent/90 text-accent-foreground border-0 shadow-[0_4px_16px_-6px] shadow-accent/50">
                  Sign In
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main id="welcome-main" tabIndex={-1} className="relative z-10">
        {/* Hero section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center space-y-8 animate-in fade-in duration-700">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-tight font-heading">
                Your finances.{" "}
                <span className="text-accent italic">
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
                className="bg-accent hover:bg-accent/90 text-accent-foreground border-0 px-8 text-base font-semibold shadow-[0_8px_32px_-8px] shadow-accent/50"
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
                <Lock className="w-4 h-4 text-accent" />
                <span>Private by default</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <span>You own your data</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" />
                <span>AI-powered insight</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: It learns you */}
            <div className="card-lift group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Brain className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-heading">It learns you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your goals, your style, your questions shape how it responds. The more you share, the more it understands.
                </p>
              </div>
            </div>

            {/* Card 2: It knows finance */}
            <div className="card-lift group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-chart-2/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-chart-2/10 flex items-center justify-center group-hover:bg-chart-2/20 transition-colors">
                  <BarChart3 className="w-6 h-6 text-chart-2" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-heading">It knows finance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Grounded in financial knowledge, always with appropriate context. Ask about investing, planning, or strategy.
                </p>
              </div>
            </div>

            {/* Card 3: It grows with you */}
            <div className="card-lift group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:shadow-lg">
              <div className="absolute inset-0 rounded-2xl bg-chart-4/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative space-y-4">
                <div className="w-12 h-12 rounded-lg bg-chart-4/10 flex items-center justify-center group-hover:bg-chart-4/20 transition-colors">
                  <Rocket className="w-6 h-6 text-chart-4" />
                </div>
                <h3 className="text-lg font-semibold text-foreground font-heading">It grows with you</h3>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground font-heading">
              Your AI secretary that understands <span className="text-accent italic">everything</span>
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Share documents, screen, video, or just talk. It reviews, explains, and helps you learn from any data you have access to.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: <FileText className="w-7 h-7 text-accent" />, title: "Documents", desc: "Upload PDFs, images, spreadsheets — get instant analysis and summaries" },
              { icon: <Monitor className="w-7 h-7 text-accent" />, title: "Screen Share", desc: "Share your screen for real-time visual context and guidance" },
              { icon: <Video className="w-7 h-7 text-accent" />, title: "Live Video", desc: "Point your camera at documents, whiteboards, or anything for instant understanding" },
              { icon: <Mic className="w-7 h-7 text-accent" />, title: "Voice", desc: "Talk naturally — ask questions, get answers, have a real conversation" },
            ].map((item) => (
              <div key={item.title} className="p-6 rounded-xl border border-border/30 bg-card/30 backdrop-blur text-center space-y-3">
                <div className="flex justify-center">{item.icon}</div>
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
