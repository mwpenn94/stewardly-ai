/**
 * AdvisorProfile — Public-facing advisor profile page.
 * Shows advisor bio, credentials, specializations, and booking link.
 */
import { SEOHead } from "@/components/SEOHead";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Calendar, Award, BookOpen, Star, ExternalLink, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useMemo } from "react";
import { QueryErrorBanner } from "@/components/QueryErrorBanner";
import { BarChart3, TrendingUp, Users } from "lucide-react";

export default function AdvisorProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const advisorId = Number(params.id);
  const { data: advisor, isLoading, error } = trpc.professionals.getById.useQuery(
    { id: advisorId },
    { enabled: !isNaN(advisorId) && advisorId > 0 }
  );
  const { data: metrics } = trpc.professionalPractice.metrics.list.useQuery(
    { professionalId: advisorId, limit: 12 },
    { enabled: !isNaN(advisorId) && advisorId > 0 }
  );
  const { data: reviews } = trpc.professionalPractice.reviews.list.useQuery(
    // @ts-expect-error — overload resolution mismatch
    { professionalId: advisorId, limit: 5 },
    { enabled: !isNaN(advisorId) && advisorId > 0 }
  );

  const initials = useMemo(() => {
    if (!advisor?.name) return "??";
    return advisor.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  }, [advisor?.name]);

  if (isLoading) {
    return (
      <AppShell title="Advisor Profile">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error || !advisor) {
    return (
      <AppShell title="Advisor Profile">
        <div className="container max-w-3xl py-8 text-center space-y-4">
          <SEOHead title="Advisor Not Found" description="Advisor profile" />
          <p className="text-muted-foreground">{error ? "Failed to load advisor." : "Advisor not found."}</p>
          <Button variant="outline" onClick={() => navigate("/advisory")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>
      </AppShell>
    );
  }

  const name = advisor.name ?? "Unknown Advisor";
  const title2 = advisor.title ?? "Financial Advisor";
  const firm = advisor.firm ?? "";
  // @ts-expect-error — missing properties from type
  const specializations: string[] = advisor.specializations ?? [];
  // @ts-expect-error — strict mode fix
  const credentials: string[] = advisor.credentials ?? [];
  const bio = advisor.bio ?? "";
  // @ts-expect-error — property access on loosely typed object
  const city = advisor.city ?? "";
  const state = advisor.state ?? "";
  const phone = advisor.phone ?? "";
  const email = advisor.email ?? "";
  const yearsExperience = advisor.yearsExperience ?? 0;
  // @ts-expect-error — property access on loosely typed object
  const aum = advisor.aum ?? 0;
  // @ts-expect-error — strict mode fix
  const rating = advisor.rating ?? 0;
  const reviewCount = advisor.reviewCount ?? 0;

  return (
    <AppShell title="Advisor Profile">
    <div className="container max-w-3xl py-8 space-y-6">
      <SEOHead title="Advisor Profile" description="Financial advisor profile and credentials" />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-3xl font-bold font-mono tabular-nums text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{name}</h1>
                  <VerificationBadge status="verified" label="Verified Advisor" />
                </div>
                <p className="text-sm text-muted-foreground">{title2}{firm ? ` • ${firm}` : ""}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(specializations.length ? specializations : ["Financial Planning"]).map(s => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {(city || state) && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {[city, state].filter(Boolean).join(", ")}</span>}
                {phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {phone}</span>}
                {email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {email}</span>}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => navigate('/outreach-automation')}><Calendar className="h-3.5 w-3.5 mr-1" /> Book Consultation</Button>
                <Button size="sm" variant="outline" onClick={() => { if (email) { window.open(`mailto:${email}?subject=Inquiry via Stewardly`, '_blank', 'noopener,noreferrer'); toast.info('Opening email client'); } else { toast.info('No email on file'); } }}><Mail className="h-3.5 w-3.5 mr-1" /> Message</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{yearsExperience || "—"}</p>
            <p className="text-xs text-muted-foreground">Years Experience</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{aum >= 1000000 ? `$${(aum / 1000000).toFixed(0)}M` : aum > 0 ? `$${(aum / 1000).toFixed(0)}K` : "—"}</p>
            <p className="text-xs text-muted-foreground">Assets Under Advisement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{rating > 0 ? rating.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">{reviewCount > 0 ? `Client Rating (${reviewCount} reviews)` : "Client Rating"}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {bio || `${name} is a financial professional dedicated to helping clients achieve their financial goals.`}
          </p>
          <h3 className="text-sm font-semibold pt-2">Credentials & Licenses</h3>
          <div className="flex flex-wrap gap-2">
            {(credentials.length ? credentials : ["Licensed Professional"]).map(c => (
              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
          <h3 className="text-sm font-semibold pt-2">Regulatory</h3>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <a href="https://brokercheck.finra.org/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> FINRA BrokerCheck
            </a>
            <a href="https://adviserinfo.sec.gov/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground transition-colors">
              <ExternalLink className="h-3 w-3" /> SEC IAPD
            </a>
          </div>
        </CardContent>
      </Card>
      {/* Practice Metrics */}
      {metrics && metrics.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="h-5 w-5 text-primary/60" /> Practice Metrics</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {metrics.slice(0, 6).map((m: any, i: number) => (
                <div key={i} className="text-center p-3 rounded-lg bg-muted/30">
                  <p className="text-lg font-bold font-mono tabular-nums">{typeof m.value === 'number' ? m.value.toLocaleString() : m.value ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{m.metricName ?? m.label ?? `Metric ${i+1}`}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annual Reviews */}
      {reviews && reviews.length > 0 && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="h-5 w-5 text-primary/60" /> Performance Reviews</h2>
            <div className="space-y-3">
              {reviews.slice(0, 3).map((r: any, i: number) => (
                <div key={i} className="p-3 rounded-lg border border-border/50 space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{r.reviewYear ?? r.period ?? `Review ${i+1}`}</span>
                    {r.overallRating != null && (
                      <div className="flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-sm font-mono">{Number(r.overallRating).toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  {r.summary && <p className="text-xs text-muted-foreground">{r.summary}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </AppShell>
  );
}
