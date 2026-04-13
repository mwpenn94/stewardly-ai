/**
 * AdvisorProfile — Public-facing advisor profile page.
 * Shows advisor bio, credentials, specializations, and booking link.
 * Wired to professionals.getById when an :id param is present.
 */
import { useParams } from "wouter";
import { SEOHead } from "@/components/SEOHead";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Mail, Phone, MapPin, Calendar, Award, BookOpen, Star, ExternalLink, Loader2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import HonestPlaceholder from "@/components/HonestPlaceholder";

export default function AdvisorProfile() {
  const params = useParams<{ id: string }>();
  const advisorId = params.id ? Number(params.id) : null;
  const query = trpc.professionals.getById.useQuery(
    { id: advisorId! },
    { enabled: advisorId != null && !isNaN(advisorId), retry: false },
  );

  const advisor = query.data;

  // Parse specializations safely
  const specializations: string[] = advisor
    ? typeof advisor.specializations === "string"
      ? (() => { try { return JSON.parse(advisor.specializations); } catch { return []; } })()
      : Array.isArray(advisor.specializations) ? advisor.specializations : []
    : [];

  // Parse credentials safely
  const credentials: string[] = advisor
    ? typeof (advisor as any).credentials === "string"
      ? (() => { try { return JSON.parse((advisor as any).credentials); } catch { return []; } })()
      : Array.isArray((advisor as any).credentials) ? (advisor as any).credentials : []
    : [];

  const initials = advisor?.name
    ? advisor.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const reviews = (advisor as any)?.reviews ?? [];
  const avgRating = advisor?.avgRating ?? 0;
  const reviewCount = reviews.length;

  if (query.isLoading) {
    return (
      <AppShell title="Advisor Profile">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (!advisor) {
    return (
      <AppShell title="Advisor Profile">
        <div className="container max-w-3xl py-8">
          <SEOHead title="Advisor Profile" description="Financial advisor profile and credentials" />
          <HonestPlaceholder
            willDo="Show a detailed advisor profile with bio, credentials, and contact info"
            needed="A valid advisor ID in the URL (e.g., /advisor/1) and advisor data in the professionals table"
            workingAlternative={{ href: "/professional-directory", label: "Browse Professional Directory" }}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Advisor Profile">
    <div className="container max-w-3xl py-8 space-y-6">
      <SEOHead title={`${advisor.name ?? "Advisor"} Profile`} description={`Financial advisor profile for ${advisor.name ?? "advisor"}`} />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-3xl font-bold font-mono tabular-nums text-primary shrink-0">
              {initials}
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{advisor.name}</h1>
                  {advisor.status === "active" && (
                    <VerificationBadge status="verified" label="Verified Advisor" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {advisor.title ? `${advisor.title} • ` : ""}
                  {advisor.firm ?? "Independent Advisor"}
                </p>
              </div>
              {specializations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {specializations.map((s: string) => (
                    <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {advisor.location && (
                  <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {advisor.location}</span>
                )}
                {advisor.phone && (
                  <a href={`tel:${advisor.phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Phone className="h-3.5 w-3.5" /> {advisor.phone}
                  </a>
                )}
                {advisor.email && (
                  <a href={`mailto:${advisor.email}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <Mail className="h-3.5 w-3.5" /> {advisor.email}
                  </a>
                )}
              </div>
              <div className="flex gap-2">
                {advisor.email ? (
                  <a href={`mailto:${advisor.email}`}>
                    <Button size="sm"><Mail className="h-3.5 w-3.5 mr-1" /> Contact</Button>
                  </a>
                ) : (
                  <Button size="sm" disabled title="Contact info not available"><Mail className="h-3.5 w-3.5 mr-1" /> Contact</Button>
                )}
                <Button size="sm" variant="outline" disabled title="Booking integration pending">
                  <Calendar className="h-3.5 w-3.5 mr-1" /> Book Consultation
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{specializations.length}</p>
            <p className="text-xs text-muted-foreground">Specializations</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{credentials.length}</p>
            <p className="text-xs text-muted-foreground">Credentials</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</p>
            <p className="text-xs text-muted-foreground">{reviewCount > 0 ? `${reviewCount} review${reviewCount !== 1 ? "s" : ""}` : "No reviews yet"}</p>
          </CardContent>
        </Card>
      </div>

      {advisor.bio && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-semibold">About</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{advisor.bio}</p>
          </CardContent>
        </Card>
      )}

      {(credentials.length > 0 || (advisor as any).crdNumber) && (
        <Card>
          <CardContent className="p-6 space-y-4">
            {credentials.length > 0 && (
              <>
                <h3 className="text-sm font-semibold">Credentials & Licenses</h3>
                <div className="flex flex-wrap gap-2">
                  {credentials.map((c: string) => (
                    <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                  ))}
                </div>
              </>
            )}
            <h3 className="text-sm font-semibold pt-2">Regulatory</h3>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {(advisor as any).crdNumber ? (
                <>
                  <a href={`https://brokercheck.finra.org/individual/summary/${(advisor as any).crdNumber}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ExternalLink className="h-3 w-3" /> FINRA BrokerCheck
                  </a>
                  <a href={`https://adviserinfo.sec.gov/individual/summary/${(advisor as any).crdNumber}`}
                     target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-1 hover:text-foreground transition-colors">
                    <ExternalLink className="h-3 w-3" /> SEC IAPD
                  </a>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1 text-muted-foreground/50 cursor-not-allowed" title="BrokerCheck link available when CRD number is configured">
                    <ExternalLink className="h-3 w-3" /> FINRA BrokerCheck
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground/50 cursor-not-allowed" title="SEC link available when CRD number is configured">
                    <ExternalLink className="h-3 w-3" /> SEC IAPD
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </AppShell>
  );
}
