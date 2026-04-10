import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ArrowLeft, Eye, Palette, Type, Shield, Save, Loader2, ExternalLink, Lock, TrendingUp } from "lucide-react";
import AppShell from "@/components/AppShell";

export default function OrgBrandingEditor() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  // Get user's org membership (first org where they're org_admin)
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

  // Form state
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
  const [showPreview, setShowPreview] = useState(false);

  // Populate form when config loads
  useEffect(() => {
    if (configQuery.data) {
      const c = configQuery.data;
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
    }
  }, [configQuery.data]);

  const saveMutation = trpc.orgBranding.updateLandingConfig.useMutation({
    onSuccess: () => {
      toast.success("Branding saved successfully");
      utils.orgBranding.getLandingConfig.invalidate({ organizationId: orgId });
    },
    onError: (err) => toast.error(err.message),
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
      trustSignal1: trustSignal1 || undefined,
      trustSignal2: trustSignal2 || undefined,
      trustSignal3: trustSignal3 || undefined,
      disclaimerText: disclaimerText || undefined,
    });
  };

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

  return (
    <AppShell title="Organization Branding">
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-50 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(ellipse at 20% 50%, oklch(0.76 0.14 80 / 0.15) 0%, transparent 70%)' }} />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" aria-label="Back to chat" onClick={() => navigate("/chat")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-base font-semibold">Landing Page Editor</h1>
              <p className="text-xs text-muted-foreground">{userOrg?.name || "Organization"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              {showPreview ? "Editor" : "Preview"}
            </Button>
            {orgSlug && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/org/${orgSlug}`, "_blank")}
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Live Page
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5 mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </div>
      </header>

      {showPreview ? (
        /* ─── LIVE PREVIEW ─── */
        <div className="relative">
          <div className="fixed inset-0 -z-10">
            <div className="absolute inset-0 bg-background" />
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: primaryColor }} />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full blur-[120px] opacity-20 animate-pulse" style={{ backgroundColor: accentColor, animationDelay: "1.5s" }} />
          </div>
          <div className="max-w-5xl mx-auto px-4 py-20 text-center space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-card/30 backdrop-blur text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              Powered by AI
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1]">
              {headline || `${userOrg?.name || "Your"} Financial Intelligence`}
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              {subtitle || "AI-powered financial guidance that learns your goals and helps you plan with confidence."}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="text-white border-0 px-8" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}>
                {ctaText}
              </Button>
              <Button size="lg" variant="outline" className="border-border/50 px-8">
                {secondaryLinkText}
              </Button>
            </div>
            <div className="flex flex-col sm:flex-row gap-6 justify-center pt-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2"><Lock className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal1}</span></div>
              <div className="flex items-center gap-2"><Shield className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal2}</span></div>
              <div className="flex items-center gap-2"><TrendingUp className="w-4 h-4" style={{ color: primaryColor }} /><span>{trustSignal3}</span></div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── EDITOR ─── */
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Tabs defaultValue="content" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content" className="gap-1.5">
                <Type className="w-3.5 h-3.5" /> Content
              </TabsTrigger>
              <TabsTrigger value="colors" className="gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Colors & Logo
              </TabsTrigger>
              <TabsTrigger value="trust" className="gap-1.5">
                <Shield className="w-3.5 h-3.5" /> Trust & Legal
              </TabsTrigger>
            </TabsList>

            <TabsContent value="content" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Hero Section</CardTitle>
                  <CardDescription>The main headline and description visitors see first</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Headline</Label>
                    <Input
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder={`${userOrg?.name || "Your"} Financial Intelligence`}
                    />
                    <p className="text-xs text-muted-foreground">Leave blank for default</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Subtitle</Label>
                    <Textarea
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="AI-powered financial guidance..."
                      rows={3}
                    />
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
            </TabsContent>

            <TabsContent value="colors" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Brand Colors</CardTitle>
                  <CardDescription>Set your organization's primary and accent colors</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Primary color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                        />
                        <Input
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="font-mono text-sm"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Accent color</Label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                        />
                        <Input
                          value={accentColor}
                          onChange={(e) => setAccentColor(e.target.value)}
                          className="font-mono text-sm"
                          maxLength={7}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Color preview */}
                  <div className="flex gap-3 pt-2">
                    <div className="h-12 flex-1 rounded-lg" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }} />
                    <div className="h-12 w-24 rounded-lg border border-border flex items-center justify-center text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                      Button
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Logo</CardTitle>
                  <CardDescription>Your organization's logo URL (displayed in header)</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                  {logoUrl && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <img src={logoUrl} alt="Logo preview" className="h-10 w-auto" onError={(e) => (e.currentTarget.style.display = "none")} />
                      <span className="text-xs text-muted-foreground">Logo preview</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trust" className="space-y-6">
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
                  <Textarea
                    value={disclaimerText}
                    onChange={(e) => setDisclaimerText(e.target.value)}
                    placeholder="Securities offered through..."
                    rows={4}
                  />
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
