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
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-accent" />
            </div>
            <span className="font-semibold text-sm tracking-tight">Stewardry</span>
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
            <Sparkles className="w-3 h-3" /> Stewardry — General & Financial
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 leading-tight">
            Your AI Assistant That<br />
            <span className="text-accent">Thinks Like You</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            An AI assistant personalized to your communication style, trained on your documents,
            and combining general intelligence with deep financial expertise.
          </p>

          <div className="flex items-center justify-center gap-3 mb-12">
            {isAuthenticated ? (
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2" onClick={() => navigate("/")}>
                <MessageSquare className="w-4 h-4" /> Start Chatting <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 gap-2" onClick={() => window.location.href = getLoginUrl()}>
                Get Started <ArrowRight className="w-4 h-4" />
              </Button>
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
          <span>Stewardry</span>
          <span>AI-powered advisory platform</span>
        </div>
      </footer>
    </div>
  );
}
