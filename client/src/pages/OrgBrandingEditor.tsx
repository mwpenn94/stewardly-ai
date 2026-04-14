import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  ArrowLeft, Eye, Palette, Type, Shield, Save, Loader2, ExternalLink,
  Lock, TrendingUp, Image, Code, Monitor, Smartphone, Users, Award, Clock,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { SEOHead } from "@/components/SEOHead";

const FONT_OPTIONS = [
  { value: "Inter", label: "Inter", category: "Sans-serif" },
  { value: "DM Sans", label: "DM Sans", category: "Sans-serif" },
  { value: "Plus Jakarta Sans", label: "Plus Jakarta Sans", category: "Sans-serif" },
  { value: "Outfit", label: "Outfit", category: "Sans-serif" },
  { value: "Manrope", label: "Manrope", category: "Sans-serif" },
  { value: "Space Grotesk", label: "Space Grotesk", category: "Sans-serif" },
  { value: "Sora", label: "Sora", category: "Sans-serif" },
  { value: "Lora", label: "Lora", category: "Serif" },
  { value: "Playfair Display", label: "Playfair Display", category: "Serif" },
  { value: "Merriweather", label: "Merriweather", category: "Serif" },
  { value: "Source Serif 4", label: "Source Serif 4", category: "Serif" },
  { value: "JetBrains Mono", label: "JetBrains Mono", category: "Monospace" },
];

const BG_PATTERNS = [
  { value: "mesh", label: "Gradient Mesh", desc: "Soft animated gradient blobs" },
  { value: "dots", label: "Dot Grid", desc: "Subtle dot pattern overlay" },
  { value: "lines", label: "Line Grid", desc: "Minimal line pattern" },
  { value: "solid", label: "Solid", desc: "Clean solid background" },
  { value: "radial", label: "Radial Glow", desc: "Centered radial gradient" },
];

export default function OrgBrandingEditor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Get user's org membership
  const orgsQuery = trpc.organizations.list.useQuery();
  const userOrg = useMemo(() => {
    if (!orgsQuery.data || !Array.isArray(orgsQuery.data) || !user) return null;
    return orgsQuery.data.find((o: any) => o.role === "org_admin") || orgsQuery.data[0];
  }, [orgsQuery.data, user]);

  const orgId = userOrg?.id || 0;
  const orgSlug = userOrg?.slug || "";

  // Query existing config
  const configQuery = trpc.orgBranding.getLandingConfig.useQuery(
    { organizationId: orgId },
    { enabled: orgId > 0 }
  );

  // Form state — original fields
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaText, setCtaText] = useState("Get Started");
  const [secondaryLinkText, setSecondaryLinkText] = useState("Explore as a guest");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#0EA5E9");
  const [accentColor, setAccentColor] = useState("#14B8A6");
  const [trustSignal1, setTrustSignal1] = useState("Private by default");
  const [trustSignal2, setTrustSignal2] = useState("You own your data");
  const [trustSignal3, setTrustSignal3] = useState("AI-powered insight");
  const [disclaimerText, setDisclaimerText] = useState("");

  // Form state — new fields
  const [secondaryColor, setSecondaryColor] = useState("#1E293B");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [backgroundPattern, setBackgroundPattern] = useState("mesh");
  const [faviconUrl, setFaviconUrl] = useState("");

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  // Populate form when config loads
  useEffect(() => {
    if (configQuery.data) {
      const c = configQuery.data as any;
      if (c.headline) setHeadline(c.headline);
      if (c.subtitle) setSubtitle(c.subtitle);
      if (c.ctaText) setCtaText(c.ctaText);
      if (c.secondaryLinkText) setSecondaryLinkText(c.secondaryLinkText);
      if (c.logoUrl) setLogoUrl(c.logoUrl);
      if (c.primaryColor) setPrimaryColor(c.primaryColor);
      if (c.accentColor) setAccentColor(c.accentColor);
      if (c.trustSignal1) setTrustSignal1(c.trustSignal1);
      if (c.trustSignal2) setTrustSignal2(c.trustSignal2);
      if (c.trustSignal3) setTrustSignal3(c.trustSignal3);
      if (c.disclaimerText) setDisclaimerText(c.disclaimerText);
      if (c.secondaryColor) setSecondaryColor(c.secondaryColor);
      if (c.fontFamily) setFontFamily(c.fontFamily);
      if (c.heroImageUrl) setHeroImageUrl(c.heroImageUrl);
      if (c.customCss) setCustomCss(c.customCss);
      if (c.backgroundPattern) setBackgroundPattern(c.backgroundPattern);
      if (c.faviconUrl) setFaviconUrl(c.faviconUrl);
    }
  }, [configQuery.data]);

  // Load Google Font dynamically
  useEffect(() => {
    if (fontFamily && fontFamily !== "Inter") {
      const link = document.createElement("link");
      link.href = `https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
      link.rel = "stylesheet";
      document.head.appendChild(link);
      return () => { document.head.removeChild(link); };
    }
  }, [fontFamily]);

  const saveMutation = trpc.orgBranding.updateLandingConfig.useMutation({
    onSuccess: () => {
      toast.success("Branding saved successfully");
      utils.orgBranding.getLandingConfig.invalidate({ organizationId: orgId });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleSave = () => {
    saveMutation.mutate({
      organizationId: orgId,
      headline: headline || undefined,
      subtitle: subtitle || undefined,
      ctaText: ctaText || undefined,
      secondaryLinkText: secondaryLinkText || undefined,
      logoUrl: logoUrl || undefined,
      primaryColor: primaryColor || undefined,
      accentColor: accentColor || undefined,
      secondaryColor: secondaryColor || undefined,
      fontFamily: fontFamily || undefined,
      heroImageUrl: heroImageUrl || undefined,
      customCss: customCss || undefined,
      backgroundPattern: backgroundPattern || undefined,
      faviconUrl: faviconUrl || undefined,
      trustSignal1: trustSignal1 || undefined,
      trustSignal2: trustSignal2 || undefined,
      trustSignal3: trustSignal3 || undefined,
      disclaimerText: disclaimerText || undefined,
    });
  };

  const orgName = userOrg?.name || "Organization";

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <Palette className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading Organization Branding...</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />Back to Chat
          </Button>
        </div>
      </div>
    );
  }

  // ─── BACKGROUND RENDERER ───
  const renderBackground = () => {
    switch (backgroundPattern) {
      case "dots":
        return (
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: `radial-gradient(${primaryColor} 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />
          </div>
        );
      case "lines":
        return (
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: `linear-gradient(${primaryColor} 1px, transparent 1px), linear-gradient(90deg, ${primaryColor} 1px, transparent 1px)`, backgroundSize: "48px 48px" }} />
          </div>
        );
      case "radial":
        return (
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[800px] rounded-full blur-[200px] opacity-15" style={{ backgroundColor: primaryColor }} />
          </div>
        );
      case "solid":
        return <div className="absolute inset-0 -z-10 bg-background" />;
      default: // mesh
        return (
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: primaryColor }} />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: accentColor, animationDelay: "1.5s" }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full blur-[100px] opacity-10 animate-pulse" style={{ backgroundColor: primaryColor, animationDelay: "0.7s" }} />
          </div>
        );
    }
  };

  // ─── LIVE PREVIEW ───
  const renderPreview = () => (
    <div
      className={`relative overflow-hidden ${previewDevice === "mobile" ? "max-w-[375px] mx-auto border border-border rounded-2xl shadow-2xl" : ""}`}
      style={{ fontFamily: `'${fontFamily}', sans-serif` }}
    >
      {renderBackground()}

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={orgName} className="h-9 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
            ) : (
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                {orgName.charAt(0)}
              </div>
            )}
            <span className="font-semibold text-foreground text-lg">{orgName}</span>
          </div>
          <Button variant="outline" size="sm" className="border-border/50 hover:border-border pointer-events-none">
            Sign In
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center space-y-8 animate-in fade-in duration-700">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-card/30 backdrop-blur text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              Powered by AI
            </div>

            <div className="space-y-5">
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
                {headline || `${orgName} Financial Intelligence`}
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                {subtitle || "AI-powered financial guidance that learns your goals and helps you plan with confidence."}
              </p>
            </div>

            {/* Hero image */}
            {heroImageUrl && (
              <div className="max-w-3xl mx-auto rounded-xl overflow-hidden shadow-2xl border border-border/30">
                <img src={heroImageUrl} alt="Hero" className="w-full h-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-white border-0 px-8 shadow-lg pointer-events-none"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                {ctaText}
              </Button>
              <Button size="lg" variant="outline" className="border-border/50 px-8 pointer-events-none">
                {secondaryLinkText}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Lock className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal1}</span></div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal2}</span></div>
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal3}</span></div>
            </div>
          </div>
        </section>

        {/* Feature cards */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: <Users className="w-5 h-5" />, title: "Personalized guidance", desc: "AI that learns your goals, risk tolerance, and communication style." },
              { icon: <Award className="w-5 h-5" />, title: "Professional-grade tools", desc: "Calculators, comparisons, and planning tools used by financial professionals." },
              { icon: <Clock className="w-5 h-5" />, title: "Available 24/7", desc: "Get answers anytime, with the option to connect with a human advisor." },
            ].map((card, i) => (
              <div key={i} className="group relative p-7 rounded-2xl border border-border/50 bg-card/30 backdrop-blur hover:border-border/80 transition-all duration-300">
                <div className="relative space-y-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${primaryColor}30, ${accentColor}30)` }}>
                    <span style={{ color: primaryColor }}>{card.icon}</span>
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Stats */}
        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: "24/7", label: "AI availability" },
              { value: "100%", label: "Data privacy" },
              { value: "5 min", label: "To get started" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-2xl sm:text-3xl font-bold font-mono tabular-nums" style={{ color: primaryColor }}>{stat.value}</div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">AI-powered. Not a substitute for professional financial advice.</p>
            {disclaimerText && (
              <p className="text-xs text-muted-foreground/70 text-center border-t border-border/30 pt-4 max-w-2xl mx-auto">{disclaimerText}</p>
            )}
            <p className="text-xs text-muted-foreground/50 text-center">&copy; {new Date().getFullYear()} {orgName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );

  return (
    <AppShell title="Organization Branding">
      <SEOHead title="Organization Branding" description="Customize organization branding and appearance" />
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div>
                <h1 className="text-base font-semibold">White-Label Branding Editor</h1>
                <p className="text-xs text-muted-foreground">{orgName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {showPreview && (
                <div className="flex items-center border border-border rounded-lg overflow-hidden mr-2">
                  <button
                    className={`p-1.5 ${previewDevice === "desktop" ? "bg-muted" : "hover:bg-muted/50"} transition-colors`}
                    onClick={() => setPreviewDevice("desktop")}
                    aria-label="Desktop preview"
                  >
                    <Monitor className="w-3.5 h-3.5" />
                  </button>
                  <button
                    className={`p-1.5 ${previewDevice === "mobile" ? "bg-muted" : "hover:bg-muted/50"} transition-colors`}
                    onClick={() => setPreviewDevice("mobile")}
                    aria-label="Mobile preview"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                {showPreview ? "Editor" : "Preview"}
              </Button>
              {orgSlug && (
                <Button variant="outline" size="sm" onClick={() => window.open(`/org/${orgSlug}`, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  Live
                </Button>
              )}
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                Save
              </Button>
            </div>
          </div>
        </header>

        {showPreview ? (
          <div className="py-6">{renderPreview()}</div>
        ) : (
          /* ─── EDITOR ─── */
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Tabs defaultValue="content" className="space-y-6">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="content" className="gap-1.5 text-xs sm:text-sm">
                  <Type className="w-3.5 h-3.5" /> Content
                </TabsTrigger>
                <TabsTrigger value="colors" className="gap-1.5 text-xs sm:text-sm">
                  <Palette className="w-3.5 h-3.5" /> Colors
                </TabsTrigger>
                <TabsTrigger value="typography" className="gap-1.5 text-xs sm:text-sm">
                  <Type className="w-3.5 h-3.5" /> Fonts
                </TabsTrigger>
                <TabsTrigger value="media" className="gap-1.5 text-xs sm:text-sm">
                  <Image className="w-3.5 h-3.5" /> Media
                </TabsTrigger>
                <TabsTrigger value="advanced" className="gap-1.5 text-xs sm:text-sm">
                  <Code className="w-3.5 h-3.5" /> Advanced
                </TabsTrigger>
              </TabsList>

              {/* ─── CONTENT TAB ─── */}
              <TabsContent value="content" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hero Section</CardTitle>
                    <CardDescription>The main headline and description visitors see first</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Headline</Label>
                      <Input value={headline} onChange={(e) => setHeadline(e.target.value)}
                        placeholder={`${orgName} Financial Intelligence`} />
                      <p className="text-xs text-muted-foreground">Leave blank for default</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Subtitle</Label>
                      <Textarea value={subtitle} onChange={(e) => setSubtitle(e.target.value)}
                        placeholder="AI-powered financial guidance..." rows={3} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Call to Action</CardTitle>
                    <CardDescription>Button text for primary and secondary actions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Primary button</Label>
                        <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Secondary button</Label>
                        <Input value={secondaryLinkText} onChange={(e) => setSecondaryLinkText(e.target.value)} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Trust Signals</CardTitle>
                    <CardDescription>Three short phrases displayed below the CTA buttons</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Signal 1</Label>
                      <Input value={trustSignal1} onChange={(e) => setTrustSignal1(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Signal 2</Label>
                      <Input value={trustSignal2} onChange={(e) => setTrustSignal2(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Signal 3</Label>
                      <Input value={trustSignal3} onChange={(e) => setTrustSignal3(e.target.value)} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Legal Disclaimer</CardTitle>
                    <CardDescription>Optional disclaimer text shown in the footer</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Textarea value={disclaimerText} onChange={(e) => setDisclaimerText(e.target.value)}
                      placeholder="Securities offered through..." rows={4} />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── COLORS TAB ─── */}
              <TabsContent value="colors" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Brand Colors</CardTitle>
                    <CardDescription>Set your organization's color palette for the landing page</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                      {[
                        { label: "Primary", value: primaryColor, setter: setPrimaryColor, desc: "Buttons, icons, accents" },
                        { label: "Accent", value: accentColor, setter: setAccentColor, desc: "Gradients, highlights" },
                        { label: "Secondary", value: secondaryColor, setter: setSecondaryColor, desc: "Backgrounds, cards" },
                      ].map((c) => (
                        <div key={c.label} className="space-y-2">
                          <Label>{c.label}</Label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={c.value} onChange={(e) => c.setter(e.target.value)}
                              className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                            <Input value={c.value} onChange={(e) => c.setter(e.target.value)}
                              className="font-mono text-sm" maxLength={7} />
                          </div>
                          <p className="text-xs text-muted-foreground">{c.desc}</p>
                        </div>
                      ))}
                    </div>
                    {/* Color preview strip */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Preview</Label>
                      <div className="flex gap-3">
                        <div className="h-14 flex-1 rounded-lg shadow-inner" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
                        <div className="h-14 w-28 rounded-lg border border-border flex items-center justify-center text-sm font-medium text-white shadow" style={{ backgroundColor: primaryColor }}>
                          Button
                        </div>
                        <div className="h-14 w-28 rounded-lg flex items-center justify-center text-sm font-medium text-foreground" style={{ backgroundColor: secondaryColor + "30" }}>
                          Card
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Background Pattern</CardTitle>
                    <CardDescription>Choose the background style for your landing page</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-5 gap-3">
                      {BG_PATTERNS.map((p) => (
                        <button key={p.value}
                          className={`p-3 rounded-xl border text-center transition-all ${backgroundPattern === p.value ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-border/80"}`}
                          onClick={() => setBackgroundPattern(p.value)}>
                          <div className="text-sm font-medium">{p.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── TYPOGRAPHY TAB ─── */}
              <TabsContent value="typography" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Font Family</CardTitle>
                    <CardDescription>Choose a Google Font for your landing page typography</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Select value={fontFamily} onValueChange={setFontFamily}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a font" />
                      </SelectTrigger>
                      <SelectContent>
                        {FONT_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            <span style={{ fontFamily: `'${f.value}', sans-serif` }}>{f.label}</span>
                            <span className="text-xs text-muted-foreground ml-2">({f.category})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Font preview */}
                    <div className="p-6 rounded-xl border border-border bg-card/50 space-y-3" style={{ fontFamily: `'${fontFamily}', sans-serif` }}>
                      <h2 className="text-2xl font-bold text-foreground">The quick brown fox jumps over the lazy dog</h2>
                      <p className="text-base text-muted-foreground">
                        ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
                      </p>
                      <div className="flex gap-4 text-sm">
                        <span className="font-normal">Regular</span>
                        <span className="font-medium">Medium</span>
                        <span className="font-semibold">Semibold</span>
                        <span className="font-bold">Bold</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── MEDIA TAB ─── */}
              <TabsContent value="media" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Logo</CardTitle>
                    <CardDescription>Your organization's logo (displayed in header and landing page)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                      placeholder="https://example.com/logo.png" />
                    {logoUrl && (
                      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                        <img src={logoUrl} alt="Logo preview" className="h-12 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
                        <span className="text-xs text-muted-foreground">Logo preview</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Hero Image</CardTitle>
                    <CardDescription>Optional hero image displayed below the headline (e.g., product screenshot, team photo)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)}
                      placeholder="https://example.com/hero-screenshot.png" />
                    {heroImageUrl && (
                      <div className="rounded-xl overflow-hidden border border-border shadow-lg">
                        <img src={heroImageUrl} alt="Hero preview" className="w-full h-auto max-h-64 object-cover"
                          onError={(e) => (e.currentTarget.style.display = "none")} />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Favicon</CardTitle>
                    <CardDescription>Custom favicon URL for your branded landing page</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)}
                      placeholder="https://example.com/favicon.ico" />
                    {faviconUrl && (
                      <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                        <img src={faviconUrl} alt="Favicon" className="w-6 h-6" onError={(e) => (e.currentTarget.style.display = "none")} />
                        <span className="text-xs text-muted-foreground">Favicon preview (16x16 or 32x32 recommended)</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ─── ADVANCED TAB ─── */}
              <TabsContent value="advanced" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Custom CSS</CardTitle>
                    <CardDescription>Advanced: inject custom CSS into your landing page for fine-grained control</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={customCss}
                      onChange={(e) => setCustomCss(e.target.value)}
                      placeholder={`/* Example: */\n.hero-section { padding-top: 4rem; }\n.cta-button { border-radius: 9999px; }`}
                      rows={10}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      CSS is scoped to your landing page only. Use with caution — invalid CSS may break the layout.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Landing Page URL</CardTitle>
                    <CardDescription>Share this URL with your clients</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {orgSlug ? (
                      <div className="flex items-center gap-3">
                        <code className="flex-1 px-3 py-2 bg-muted rounded-lg text-sm font-mono">
                          {typeof window !== "undefined" ? window.location.origin : ""}/org/{orgSlug}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/org/${orgSlug}`);
                          toast.success("URL copied to clipboard");
                        }}>
                          Copy
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Create an organization with a slug to get a landing page URL.</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </AppShell>
  );
}
