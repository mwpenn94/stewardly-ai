import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, Search, Star, MapPin, Briefcase, Shield, Phone, Mail,
  Globe, Plus, Edit, Trash2, CheckCircle, Clock, ArrowRight,
  Building2, UserPlus, Loader2, ExternalLink, Filter, X,
  Award, TrendingUp, Heart, Handshake,
} from "lucide-react";

const TIER_LABELS: Record<number, { label: string; icon: any; color: string; desc: string }> = {
  1: { label: "Your Professionals", icon: Heart, color: "text-rose-400", desc: "Professionals you're already connected with" },
  2: { label: "Organization Match", icon: Building2, color: "text-blue-400", desc: "Professionals from your organization" },
  3: { label: "Specialty Match", icon: Award, color: "text-amber-400", desc: "Matched by specialization to your needs" },
  4: { label: "Location Match", icon: MapPin, color: "text-emerald-400", desc: "Professionals near your location" },
  5: { label: "General Directory", icon: Globe, color: "text-purple-400", desc: "Browse all available professionals" },
};

const SPECIALTIES = [
  "Financial Planning", "Investment Management", "Tax Planning", "Estate Planning",
  "Insurance", "Retirement Planning", "Debt Management", "Business Advisory",
  "Real Estate", "Education Planning", "Divorce Financial", "Elder Care",
];

export default function ProfessionalDirectory() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPro, setEditingPro] = useState<any>(null);
  const [showReferralResults, setShowReferralResults] = useState(false);

  // Queries
  const directoryQuery = trpc.professionals.list.useQuery({
    search: searchQuery || undefined,
    specialization: specialtyFilter || undefined,
    limit: 50,
  }, { staleTime: 30000 });

  const myProsQuery = trpc.professionals.myRelationships.useQuery(undefined, { staleTime: 30000 });

  // match is a query, not mutation — use refetch pattern
  const [referralInput, setReferralInput] = useState<{ needs?: string[]; location?: string } | null>(null);
  const referralQuery = trpc.professionals.match.useQuery(
    { needs: referralInput?.needs, location: referralInput?.location },
    { enabled: !!referralInput, staleTime: 0 }
  );

  const connectMut = trpc.professionals.addRelationship.useMutation({
    onSuccess: () => {
      myProsQuery.refetch();
      toast.success("Connection request sent");
    },
  });
  // Show referral results when query loads
  const referralMut = {
    isPending: referralQuery.isFetching && !!referralInput,
    data: referralQuery.data,
    mutate: (args: { needs?: string; location?: string }) => {
      setReferralInput({
        needs: args.needs ? args.needs.split(",").map(s => s.trim()).filter(Boolean) : undefined,
        location: args.location || undefined,
      });
      setShowReferralResults(true);
    },
  };

  const disconnectMut = trpc.professionals.endRelationship.useMutation({
    onSuccess: () => {
      myProsQuery.refetch();
      toast.success("Disconnected");
    },
  });
  // Helper: get items from list response
  const directoryItems = (directoryQuery.data as any)?.items || directoryQuery.data || [];

  const createMut = trpc.professionals.create.useMutation({
    onSuccess: () => {
      directoryQuery.refetch();
      setShowAddDialog(false);
      toast.success("Professional profile created");
    },
  });

  const updateMut = trpc.professionals.update.useMutation({
    onSuccess: () => {
      directoryQuery.refetch();
      setShowEditDialog(false);
      toast.success("Profile updated");
    },
  });

  const deleteMut = trpc.professionals.delete.useMutation({
    onSuccess: () => {
      directoryQuery.refetch();
      toast.success("Profile removed");
    },
  });

  const connectedIds = useMemo(() => new Set(
    (myProsQuery.data || []).map((p: any) => p.professionalId)
  ), [myProsQuery.data]);
  const referralTiers = referralMut.data?.tiers || [];

  // Referral request
  const [referralNeeds, setReferralNeeds] = useState("");
  const [referralLocation, setReferralLocation] = useState("");

  const handleGetReferral = () => {
    referralMut.mutate({
      needs: referralNeeds || undefined,
      location: referralLocation || undefined,
    });
  };


  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold flex items-center gap-3 mb-2">
            <Users className="w-7 h-7 text-accent" />
            Professional Directory
          </h1>
          <p className="text-muted-foreground">
            Find, connect with, and manage relationships with financial professionals across 5 tiers of matching.
          </p>
        </div>

        {/* My Professionals (Tier 1 — Reconnection) */}
        {(myProsQuery.data || []).length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <Heart className="w-5 h-5 text-rose-400" />
              Your Connected Professionals
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(myProsQuery.data || []).map((rel: any) => (
                <div key={rel.id} className="p-4 rounded-xl bg-card border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{rel.professionalName || "Professional"}</p>
                      <p className="text-xs text-muted-foreground">{rel.specialty || "General"}</p>
                    </div>
                    <Badge variant="outline" className="text-rose-400 border-rose-400/30 text-[10px]">Connected</Badge>
                  </div>
                  {rel.organizationName && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                      <Building2 className="w-3 h-3" /> {rel.organizationName}
                    </p>
                  )}
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="text-xs flex-1" onClick={() => toast.info("Opening chat with professional...")}>
                      <Phone className="w-3 h-3 mr-1" /> Reconnect
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={() => disconnectMut.mutate({ relationshipId: rel.id })}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Smart Referral Engine */}
        <section className="mb-8 p-6 rounded-xl bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20">
          <h2 className="text-lg font-semibold flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-accent" />
            Smart Referral Matching
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Tell us what you need and we'll match you across all 5 tiers — starting with your existing connections.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="What do you need help with? (e.g., retirement planning, tax strategy)"
              value={referralNeeds}
              onChange={e => setReferralNeeds(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Location (optional)"
              value={referralLocation}
              onChange={e => setReferralLocation(e.target.value)}
              className="w-full sm:w-48"
            />
            <Button onClick={handleGetReferral} disabled={!!referralMut.isPending}>
              {referralMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
              Find Match
            </Button>
          </div>

          {/* Referral Results — 5-Tier Display */}
          {showReferralResults && referralTiers.length > 0 && (
            <div className="mt-6 space-y-4">
              {referralTiers.map((tier: any) => (
                <div key={tier.tier} className="rounded-lg border border-border/50 overflow-hidden">
                  <div className="px-4 py-2 bg-card/50 flex items-center gap-2">
                    {(() => {
                      const t = TIER_LABELS[tier.tier];
                      const Icon = t?.icon || Globe;
                      return (
                        <>
                          <Icon className={`w-4 h-4 ${t?.color || ""}`} />
                          <span className="text-sm font-semibold">{t?.label || `Tier ${tier.tier}`}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">{t?.desc}</span>
                          <Badge variant="secondary" className="ml-auto text-[10px]">{tier.results.length}</Badge>
                        </>
                      );
                    })()}
                  </div>
                  {tier.results.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-muted-foreground">No matches at this tier</p>
                  ) : (
                    <div className="divide-y divide-border/30">
                      {tier.results.map((pro: any) => (
                        <div key={pro.id} className="px-4 py-3 flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{pro.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {pro.specialty} {pro.organization ? `· ${pro.organization}` : ""} {pro.location ? `· ${pro.location}` : ""}
                            </p>
                            {pro.matchReason && (
                              <p className="text-[10px] text-accent mt-0.5">{pro.matchReason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {pro.rating && (
                              <span className="text-[10px] flex items-center gap-0.5 text-amber-400">
                                <Star className="w-3 h-3" /> {pro.rating}
                              </span>
                            )}
                            {connectedIds.has(pro.id) ? (
                              <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">Connected</Badge>
                            ) : (
                              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => connectMut.mutate({ professionalId: pro.id, relationshipType: "financial_advisor" })}>
                                <UserPlus className="w-3 h-3 mr-1" /> Connect
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Directory Browser */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Browse Directory
            </h2>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Professional
            </Button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, firm, or specialty..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={specialtyFilter} onValueChange={setSpecialtyFilter}>
              <SelectTrigger className="w-full sm:w-56">
                <SelectValue placeholder="All Specialties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specialties</SelectItem>
                {SPECIALTIES.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {specialtyFilter && (
              <Button size="sm" variant="ghost" onClick={() => setSpecialtyFilter("")}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Results Grid */}
          {directoryQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : directoryItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No professionals found. Add one to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {directoryItems.map((pro: any) => (
                <ProfessionalCard
                  key={pro.id}
                  pro={pro}
                  isConnected={connectedIds.has(pro.id)}
                  onConnect={() => connectMut.mutate({ professionalId: pro.id, relationshipType: "financial_advisor" })}
                  onEdit={() => { setEditingPro(pro); setShowEditDialog(true); }}
                  onDelete={() => {
                    if (confirm("Remove this professional from the directory?")) {
                      deleteMut.mutate({ id: pro.id });
                    }
                  }}
                  isOwner={pro.createdBy === user?.id}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Add Professional Dialog */}
      <ProfessionalFormDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={(data) => createMut.mutate(data)}
        isPending={createMut.isPending}
        title="Add Professional"
      />

      {/* Edit Professional Dialog */}
      <ProfessionalFormDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSubmit={(data) => updateMut.mutate({ id: editingPro?.id, ...data })}
        isPending={updateMut.isPending}
        title="Edit Professional"
        initial={editingPro}
      />
    </div>
  );
}

function ProfessionalCard({ pro, isConnected, onConnect, onEdit, onDelete, isOwner }: {
  pro: any; isConnected: boolean; onConnect: () => void;
  onEdit: () => void; onDelete: () => void; isOwner: boolean;
}) {
  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 hover:border-border transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <p className="font-semibold truncate">{pro.name}</p>
          {pro.title && <p className="text-xs text-muted-foreground">{pro.title}</p>}
        </div>
        {pro.verified && (
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30 shrink-0">
            <CheckCircle className="w-3 h-3 mr-0.5" /> Verified
          </Badge>
        )}
      </div>

      {pro.firmName && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <Building2 className="w-3 h-3" /> {pro.firmName}
        </p>
      )}
      {pro.location && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3" /> {pro.location}
        </p>
      )}

      {/* Specialties */}
      <div className="flex flex-wrap gap-1 mt-2 mb-3">
        {(pro.specialties || []).slice(0, 3).map((s: string) => (
          <Badge key={s} variant="secondary" className="text-[9px]">{s}</Badge>
        ))}
        {(pro.specialties || []).length > 3 && (
          <Badge variant="secondary" className="text-[9px]">+{pro.specialties.length - 3}</Badge>
        )}
      </div>

      {/* Contact */}
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mb-3">
        {pro.email && <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" /> {pro.email}</span>}
        {pro.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" /> {pro.phone}</span>}
      </div>

      {/* Rating */}
      {pro.rating && (
        <div className="flex items-center gap-1 mb-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className={`w-3 h-3 ${i < Math.round(pro.rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">{pro.rating.toFixed(1)}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {isConnected ? (
          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-400/30">
            <Handshake className="w-3 h-3 mr-0.5" /> Connected
          </Badge>
        ) : (
          <Button size="sm" variant="outline" className="text-xs flex-1" onClick={onConnect}>
            <UserPlus className="w-3 h-3 mr-1" /> Connect
          </Button>
        )}
        {isOwner && (
          <>
            <Button size="sm" variant="ghost" className="text-xs" onClick={onEdit}>
              <Edit className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-destructive" onClick={onDelete}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </>
        )}
      </div>

      {/* Website link */}
      {pro.website && (
        <a href={pro.website} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-accent flex items-center gap-0.5 mt-2 hover:underline">
          <ExternalLink className="w-3 h-3" /> Visit website
        </a>
      )}
    </div>
  );
}

function ProfessionalFormDialog({ open, onOpenChange, onSubmit, isPending, title, initial }: {
  open: boolean; onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void; isPending: boolean;
  title: string; initial?: any;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    title: initial?.title || "",
    firmName: initial?.firmName || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    website: initial?.website || "",
    location: initial?.location || "",
    bio: initial?.bio || "",
    specialties: (initial?.specialties || []).join(", "),
    certifications: (initial?.certifications || []).join(", "),
    yearsExperience: initial?.yearsExperience || "",
  });

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    onSubmit({
      name: form.name.trim(),
      title: form.title.trim() || undefined,
      firmName: form.firmName.trim() || undefined,
      email: form.email.trim() || undefined,
      phone: form.phone.trim() || undefined,
      website: form.website.trim() || undefined,
      location: form.location.trim() || undefined,
      bio: form.bio.trim() || undefined,
      specialties: form.specialties ? form.specialties.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      certifications: form.certifications ? form.certifications.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {initial ? "Update professional information." : "Add a financial professional to the directory. They can also self-register."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <Input placeholder="Full Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <Input placeholder="Title (e.g., CFP, CPA)" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Firm / Organization" value={form.firmName} onChange={e => setForm(f => ({ ...f, firmName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input placeholder="Email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <Input placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
          <Input placeholder="Website URL" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          <Input placeholder="Location (City, State)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
          <Input placeholder="Specialties (comma-separated)" value={form.specialties} onChange={e => setForm(f => ({ ...f, specialties: e.target.value }))} />
          <Input placeholder="Certifications (comma-separated)" value={form.certifications} onChange={e => setForm(f => ({ ...f, certifications: e.target.value }))} />
          <Input placeholder="Years of Experience" type="number" value={form.yearsExperience} onChange={e => setForm(f => ({ ...f, yearsExperience: e.target.value }))} />
          <Textarea placeholder="Bio / Description" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={3} />
          <Button onClick={handleSubmit} disabled={isPending} className="w-full">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {initial ? "Update" : "Add"} Professional
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
