import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { useLocation } from "wouter";
import {
  Sparkles, MessageSquare, Calculator, FileText, Shield,
  Brain, Globe, DollarSign, Mic, BarChart3, ArrowRight,
  Loader2, LogOut, ChevronRight, Fingerprint, Settings, Package,
  Camera, TrendingUp,
} from "lucide-react";

const features = [
  { icon: <MessageSquare className="w-5 h-5" />, title: "AI Chat", desc: "General & financial expertise with your personal style", href: "/" },
  { icon: <Calculator className="w-5 h-5" />, title: "Calculators", desc: "IUL, premium finance, and retirement projections", href: "/calculators" },
  { icon: <FileText className="w-5 h-5" />, title: "Documents", desc: "Upload docs to enhance your AI experience", href: "/documents" },
  { icon: <Shield className="w-5 h-5" />, title: "Suitability", desc: "Complete your financial profile for personalized advice", href: "/suitability" },
  { icon: <Sparkles className="w-5 h-5" />, title: "AI Tuning", desc: "Customize how the AI responds across 5 layers", href: "/ai-settings" },
  { icon: <Package className="w-5 h-5" />, title: "Product Catalog", desc: "Browse and compare financial products", href: "/products" },
  { icon: <Camera className="w-5 h-5" />, title: "Avatar & Style", desc: "Personalize your AI's look and communication style", href: "/settings" },
  { icon: <BarChart3 className="w-5 h-5" />, title: "Manager Dashboard", desc: "Review queue, audit trail, and analytics", href: "/manager" },
];

export default function Home() {
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/30 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663357378777/GaKEFERPH576tbv5NzvkMD/stewardly-logo-v3-naY7aeUkrMxcG3ificpKX6.webp"
              alt="Stewardly"
              className="w-8 h-8 rounded-lg"
            />
            <span className="font-semibold text-sm tracking-tight">Stewardly</span>
          </div>
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/")}>
                  <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Chat
                </Button>
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/settings")}>
                  <Settings className="w-3.5 h-3.5 mr-1.5" /> Settings
                </Button>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => logout()}>
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
                </Button>
              </>
            ) : (
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 text-xs" onClick={() => window.location.href = getLoginUrl()}>
                Sign In <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-6">
            <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663357378777/GaKEFERPH576tbv5NzvkMD/stewardly-logo-v3-naY7aeUkrMxcG3ificpKX6.webp" alt="" className="w-4 h-4 rounded-sm" /> Stewardly — General & Financial
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
            Your AI Assistant That<br />
            <span className="text-accent">Thinks Like You</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            An AI assistant personalized to your communication style, trained on your documents,
            and combining general intelligence with deep financial expertise.
          </p>

          <div className="flex flex-col items-center gap-4 mb-12">
            {isAuthenticated ? (
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2" onClick={() => navigate("/")}>
                <MessageSquare className="w-4 h-4" /> Start Chatting <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <>
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2" onClick={() => window.location.href = getLoginUrl()}>
                  Get Started <ArrowRight className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">or sign in with</span>
                  <button
                    onClick={() => window.location.href = `/api/auth/google?origin=${encodeURIComponent(window.location.origin)}&returnPath=/`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Google
                  </button>
                  <button
                    onClick={() => window.location.href = `/api/auth/linkedin?origin=${encodeURIComponent(window.location.origin)}&returnPath=/`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card hover:bg-secondary/50 transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#0A66C2">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                    </svg>
                    LinkedIn
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Focus mode preview */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {[
              { icon: <Globe className="w-4 h-4" />, label: "General", desc: "Any topic" },
              { icon: <DollarSign className="w-4 h-4" />, label: "Financial", desc: "Expert advice" },
              { icon: <Brain className="w-4 h-4" />, label: "Both", desc: "Full power" },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm">
                <span className="text-accent">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
                <span className="text-muted-foreground text-xs">— {m.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <button
              key={i}
              onClick={() => isAuthenticated ? navigate(f.href) : window.location.href = getLoginUrl()}
              className="group text-left p-5 rounded-xl border border-border bg-card hover:bg-secondary/50 hover:border-accent/30 transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-3 text-accent group-hover:bg-accent/20 transition-colors">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm mb-1 flex items-center gap-1">
                {f.title}
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>Stewardly</span>
          <span>AI-powered advisory platform</span>
        </div>
      </footer>
    </div>
  );
}
