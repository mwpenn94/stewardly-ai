import { Button } from "@/components/ui/button";
import { Lock, Shield, TrendingUp } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";

export default function FirmLanding() {
  const [, navigate] = useLocation();
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();

  // TODO: Query firm branding config from organizations router
  // For now, use placeholder firm data
  const firm = {
    id: 1,
    name: "Financial Advisors Inc.",
    landingPageConfig: {
      headline: "Your Complete Financial Picture, Understood by Us",
      subtitle: "Financial Advisors Inc. learns your finances, answers your questions, and helps you plan — like having a financial advisor available 24/7.",
      ctaText: "Start Your Financial Twin →",
      primaryColor: "#0EA5E9",
      accentColor: "#14B8A6",
      logoUrl: null,
      disclaimer: null,
    },
  };

  // If already authenticated, redirect to chat
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/chat");
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  const config = firm.landingPageConfig;

  // Default values if not customized
  const headline = config?.headline || "Your Complete Financial Picture, Understood by Us";
  const subtitle =
    config?.subtitle ||
    `${firm.name} learns your finances, answers your questions, and helps you plan — like having a financial advisor available 24/7.`;
  const ctaText = config?.ctaText || "Start Your Financial Twin →";
  const primaryColor = config?.primaryColor || "#0EA5E9"; // sky-500
  const accentColor = config?.accentColor || "#14B8A6"; // teal-500
  const logoUrl = config?.logoUrl;

  const handleGetStarted = () => {
    // Store firm_id in localStorage for sign-up flow
    localStorage.setItem("firmId", firm.id.toString());
    navigate("/signin");
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    localStorage.setItem("firmId", firm.id.toString());
    navigate("/chat");
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Animated gradient mesh background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div
          className="absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: `${primaryColor}20` }}
        />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full blur-3xl opacity-30 animate-pulse"
          style={{ backgroundColor: `${accentColor}20`, animationDelay: "1s" }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={firm.name} className="h-8 w-auto" />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                style={{ backgroundColor: primaryColor }}
              >
                {firm.name.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-foreground">{firm.name}</span>
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
                {headline.split(" ").map((word: string, i: number) => (
                  <span key={i}>
                    {i === 0 ? (
                      <span
                        style={{
                          background: `linear-gradient(to right, ${primaryColor}, ${accentColor})`,
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          backgroundClip: "text",
                        }}
                      >
                        {word}
                      </span>
                    ) : (
                      word
                    )}{" "}
                  </span>
                ))}
              </h1>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                onClick={handleGetStarted}
                className="text-white border-0 px-8"
                style={{
                  background: `linear-gradient(to right, ${primaryColor}, ${accentColor})`,
                }}
              >
                {ctaText}
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={handleGuestAccess}
                className="border-border/50 hover:border-border px-8"
              >
                Try it anonymously
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4" style={{ color: primaryColor }} />
                <span>Private by default</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4" style={{ color: primaryColor }} />
                <span>You own your data</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" style={{ color: primaryColor }} />
                <span>AI-powered insight</span>
              </div>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1: It learns you */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(to bottom right, ${primaryColor}05, ${accentColor}05)`,
                }}
              />
              <div className="relative space-y-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <span className="text-2xl">🧠</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">It learns you</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your goals, your style, your questions shape how it responds. The more you share, the more it understands.
                </p>
              </div>
            </div>

            {/* Card 2: It knows finance */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(to bottom right, ${primaryColor}05, ${accentColor}05)`,
                }}
              />
              <div className="relative space-y-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <span className="text-2xl">📊</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">It knows finance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Grounded in financial knowledge, always with appropriate context. Ask about investing, planning, or strategy.
                </p>
              </div>
            </div>

            {/* Card 3: It grows with you */}
            <div className="group relative p-8 rounded-2xl border border-border/50 bg-card/50 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg">
              <div
                className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                style={{
                  background: `linear-gradient(to bottom right, ${primaryColor}05, ${accentColor}05)`,
                }}
              />
              <div className="relative space-y-4">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center group-hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: `${primaryColor}10` }}
                >
                  <span className="text-2xl">🚀</span>
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
            {config?.disclaimer && (
              <p className="text-xs text-muted-foreground/70 text-center border-t border-border/30 pt-4">
                {config.disclaimer}
              </p>
            )}
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
              © 2026 {firm.name}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
