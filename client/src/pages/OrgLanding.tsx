import { Button } from "@/components/ui/button";
import { Lock, Shield, TrendingUp, Users, Award, Clock } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export default function OrgLanding() {
  const [, navigate] = useLocation();
  const { slug } = useParams();
  const { isAuthenticated } = useAuth();

  // Query organization data
  const orgQuery = trpc.organizations.getBySlug.useQuery(
    { slug: slug || "" },
    { enabled: !!slug }
  );

  const org = orgQuery.data;
  const orgName = org?.name || "Organization";
  const orgId = org?.id || 0;

  // Query landing page config
  const configQuery = trpc.orgBranding.getLandingConfig.useQuery(
    { organizationId: orgId },
    { enabled: orgId > 0 }
  );

  const config = configQuery.data as any;

  // Dynamic branding with fallbacks
  const headline = config?.headline || `${orgName} Financial Intelligence`;
  const subtitle = config?.subtitle || `${orgName} provides AI-powered financial guidance that learns your goals, answers your questions, and helps you plan with confidence.`;
  const ctaText = config?.ctaText || "Get Started";
  const secondaryText = config?.secondaryLinkText || "Explore as a guest";
  const primaryColor = config?.primaryColor || "#0EA5E9";
  const accentColor = config?.accentColor || "#14B8A6";
  const secondaryColor = config?.secondaryColor || "#1E293B";
  const logoUrl = config?.logoUrl || null;
  const heroImageUrl = config?.heroImageUrl || null;
  const fontFamily = config?.fontFamily || "Inter";
  const backgroundPattern = config?.backgroundPattern || "mesh";
  const rawCustomCss = config?.customCss || "";
  // Sanitize custom CSS to prevent XSS
  const customCss = rawCustomCss
    .replace(/<[^>]*>/g, "")           // Strip HTML tags
    .replace(/expression\s*\(/gi, "")  // Strip CSS expressions
    .replace(/javascript\s*:/gi, "")   // Strip javascript: URIs
    .replace(/url\s*\(\s*['"]?data:/gi, "url(blocked:") // Block data: URIs
    .replace(/@import/gi, "/* blocked import */"); // Block @import
  const faviconUrl = config?.faviconUrl || null;
  const disclaimer = config?.disclaimerText || null;
  const trustSignals = [
    { icon: <Lock className="w-4 h-4" />, text: config?.trustSignal1 || "Private by default" },
    { icon: <Shield className="w-4 h-4" />, text: config?.trustSignal2 || "You own your data" },
    { icon: <TrendingUp className="w-4 h-4" />, text: config?.trustSignal3 || "AI-powered insight" },
  ];

  // If already authenticated, redirect to chat
  useEffect(() => {
    if (isAuthenticated) navigate("/chat");
  }, [isAuthenticated, navigate]);

  // Load custom Google Font
  useEffect(() => {
    if (fontFamily && fontFamily !== "Inter") {
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [fontFamily]);

  // Set custom favicon
  useEffect(() => {
    if (faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      const originalHref = link.href;
      link.href = faviconUrl;
      return () => { link.href = originalHref; };
    }
  }, [faviconUrl]);

  if (isAuthenticated) return null;

  const handleGetStarted = () => {
    localStorage.setItem("organizationId", orgId.toString());
    localStorage.setItem("affiliateSlug", slug || "");
    navigate("/signin");
  };

  const handleGuestAccess = () => {
    localStorage.setItem("anonymousMode", "true");
    localStorage.setItem("organizationId", orgId.toString());
    localStorage.setItem("affiliateSlug", slug || "");
    navigate("/chat");
  };

  // ─── BACKGROUND RENDERER ───
  const renderBackground = () => {
    switch (backgroundPattern) {
      case "dots":
        return (
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(${primaryColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
          </div>
        );
      case "lines":
        return (
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />
          </div>
        );
      case "radial":
        return (
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[800px] rounded-full blur-[200px] opacity-15" style={{ backgroundColor: primaryColor }} />
          </div>
        );
      case "solid":
        return <div className="fixed inset-0 -z-10 bg-background" />;
      default: // mesh
        return (
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: primaryColor }} />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: accentColor, animationDelay: "1.5s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 animate-pulse" style={{ backgroundColor: primaryColor, animationDelay: "0.7s" }} />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>
      {/* Inject custom CSS */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* Dynamic background */}
      {renderBackground()}

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="h-9 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
              >
                {orgName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-foreground text-lg">{orgName}</span>
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

      {/* Loading state */}
      {orgQuery.isLoading && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: primaryColor }} />
        </div>
      )}

      {/* Error state */}
      {orgQuery.isError && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground gap-4">
          <p className="text-lg">Organization not found</p>
          <Button variant="outline" onClick={() => navigate("/")}>Go home</Button>
        </div>
      )}

      {/* Main content */}
      {!orgQuery.isLoading && !orgQuery.isError && (
        <main className="relative z-10">
          {/* Hero section */}
          <section className="hero-section max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
            <div className="text-center space-y-8 animate-in fade-in duration-700">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-card/30 backdrop-blur text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
                Powered by AI
              </div>

              {/* Headline */}
              <div className="space-y-5">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                  {headline}
                </h1>
                <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                  {subtitle}
                </p>
              </div>

              {/* Hero image */}
              {heroImageUrl && (
                <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border/30">
                  <img src={heroImageUrl} alt="Hero" className="w-full h-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
                </div>
              )}

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button
                  size="lg"
                  onClick={handleGetStarted}
                  className="cta-button text-white border-0 px-8 shadow-lg hover:shadow-xl transition-shadow"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                >
                  {ctaText}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={handleGuestAccess}
                  className="border-border/50 hover:border-border px-8"
                >
                  {secondaryText}
                </Button>
              </div>

              {/* Trust signals */}
              <div className="flex flex-col sm:flex-row gap-6 justify-center pt-6 text-sm text-muted-foreground">
                {trustSignals.map((signal, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span style={{ color: primaryColor }}>{signal.icon}</span>
                    <span>{signal.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Feature cards */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: <Users className="w-5 h-5" />,
                  title: "Personalized guidance",
                  desc: "AI that learns your goals, risk tolerance, and communication style to provide tailored insights.",
                },
                {
                  icon: <Award className="w-5 h-5" />,
                  title: "Professional-grade tools",
                  desc: "Access calculators, product comparisons, and planning tools used by financial professionals.",
                },
                {
                  icon: <Clock className="w-5 h-5" />,
                  title: "Available 24/7",
                  desc: "Get answers to your financial questions anytime, with the option to connect with a human advisor.",
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="group relative p-7 rounded-2xl border border-border/50 bg-card/30 backdrop-blur hover:border-border/80 transition-all duration-300 hover:shadow-lg"
                >
                  <div
                    className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: `linear-gradient(to bottom right, ${primaryColor}08, ${accentColor}08)` }}
                  />
                  <div className="relative space-y-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center"
                      style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${accentColor}30)` }}
                    >
                      <span style={{ color: primaryColor }}>{card.icon}</span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Social proof / stats */}
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
              {[
                { value: "24/7", label: "AI availability" },
                { value: "100%", label: "Data privacy" },
                { value: "5 min", label: "To get started" },
              ].map((stat, i) => (
                <div key={i}>
                  <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums" style={{ color: primaryColor }}>
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="space-y-5">
            <p className="text-sm text-muted-foreground text-center">
              AI-powered. Not a substitute for professional financial advice.
            </p>
            {disclaimer && (
              <p className="text-xs text-muted-foreground/70 text-center border-t border-border/30 pt-4 max-w-2xl mx-auto">
                {disclaimer}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-6 justify-center text-sm">
              <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate("/terms")}>Privacy</button>
              <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate("/terms")}>Terms</button>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center">
              &copy; {new Date().getFullYear()} {orgName}. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
