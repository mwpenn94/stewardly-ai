/**
 * AdvisorProfile — Public-facing advisor profile page.
 * Shows advisor bio, credentials, specializations, and booking link.
 */
import { SEOHead } from "@/components/SEOHead";
import { VerificationBadge } from "@/components/VerificationBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, MapPin, Calendar, Award, BookOpen, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

export default function AdvisorProfile() {
  return (
    <AppShell title="Advisor Profile">
    <div className="container max-w-3xl py-8 space-y-6">
      <SEOHead title="Advisor Profile" description="Financial advisor profile and credentials" />

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="h-24 w-24 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-3xl font-bold font-mono tabular-nums text-primary shrink-0">
              SJ
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">Sarah Johnson, CFP®</h1>
                  <VerificationBadge status="verified" label="Verified Advisor" />
                </div>
                <p className="text-sm text-muted-foreground">Senior Financial Advisor • Stewardly Wealth Management</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Retirement Planning", "Tax Strategy", "Estate Planning", "Insurance Analysis"].map(s => (
                  <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> Denver, CO</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> (303) 555-0142</span>
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> sarah@stewardly.com</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => toast.info("Booking coming soon")}><Calendar className="h-3.5 w-3.5 mr-1" /> Book Consultation</Button>
                <Button size="sm" variant="outline" onClick={() => toast.info("Contact form coming soon")}><Mail className="h-3.5 w-3.5 mr-1" /> Message</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">18</p>
            <p className="text-xs text-muted-foreground">Years Experience</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">$145M</p>
            <p className="text-xs text-muted-foreground">Assets Under Advisement</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="h-8 w-8 mx-auto text-primary/60 mb-2" />
            <p className="text-2xl font-bold font-mono tabular-nums">4.9</p>
            <p className="text-xs text-muted-foreground">Client Rating (127 reviews)</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <h2 className="text-lg font-semibold">About</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Sarah is a Certified Financial Planner® with 18 years of experience helping families and business owners build comprehensive financial plans. She specializes in retirement income strategies, tax-efficient investing, and multi-generational wealth transfer. Sarah holds a Master's in Financial Planning from the University of Denver and is a member of the Financial Planning Association.
          </p>
          <h3 className="text-sm font-semibold pt-2">Credentials & Licenses</h3>
          <div className="flex flex-wrap gap-2">
            {["CFP® (Certified Financial Planner)", "Series 7", "Series 66", "Life & Health Insurance", "CPA (Inactive)"].map(c => (
              <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
            ))}
          </div>
          <h3 className="text-sm font-semibold pt-2">Regulatory</h3>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <a href="#" className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={e => { e.preventDefault(); toast.info("BrokerCheck link coming soon"); }}>
              <ExternalLink className="h-3 w-3" /> FINRA BrokerCheck
            </a>
            <a href="#" className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={e => { e.preventDefault(); toast.info("SEC link coming soon"); }}>
              <ExternalLink className="h-3 w-3" /> SEC IAPD
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
    </AppShell>
  );
}
