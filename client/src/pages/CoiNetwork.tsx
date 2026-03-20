import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Trash2, Users, UserPlus, ArrowRightLeft, BarChart3, Building, Phone } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";

export default function CoiNetwork() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", coiFirm: "", specialty: "cpa" as any,
    relationshipStrength: "new" as any,
  });

  const contactsQuery = trpc.coi.contacts.useQuery(undefined, { enabled: !!user });
  const analyticsQuery = trpc.coi.analytics.useQuery(undefined, { enabled: !!user });
  const utils = trpc.useUtils();

  const addMutation = trpc.coi.addContact.useMutation({
    onSuccess: () => { utils.coi.invalidate(); setAddOpen(false); toast.success("Contact added"); resetForm(); },
  });
  const deleteMutation = trpc.coi.deleteContact.useMutation({
    onSuccess: () => { utils.coi.invalidate(); toast.success("Contact removed"); },
  });
  const updateMutation = trpc.coi.updateContact.useMutation({
    onSuccess: () => utils.coi.invalidate(),
  });

  const contacts = contactsQuery.data || [];
  const analytics = analyticsQuery.data;
  const resetForm = () => setForm({ name: "", coiFirm: "", specialty: "cpa", relationshipStrength: "new" });

  const specialtyLabels: Record<string, string> = {
    cpa: "CPA / Accountant", attorney: "Attorney", insurance_agent: "Insurance Agent",
    mortgage_broker: "Mortgage Broker", real_estate: "Real Estate Agent", other: "Other",
  };
  const strengthColors: Record<string, string> = {
    strong: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    moderate: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    new: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full" /></div>;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border/50 bg-card/30 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/chat")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Chat
          </Button>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-accent" />
            <h1 className="text-sm font-semibold">COI Network</h1>
          </div>
          <div className="ml-auto">
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Add Contact</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add COI Contact</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <Input placeholder="Full name" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Firm</label>
                    <Input placeholder="Firm name" value={form.coiFirm} onChange={e => setForm(p => ({ ...p, coiFirm: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground">Specialty</label>
                      <Select value={form.specialty} onValueChange={v => setForm(p => ({ ...p, specialty: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(specialtyLabels).map(([k, v]) => (
                            <SelectItem key={k} value={k}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Relationship</label>
                      <Select value={form.relationshipStrength} onValueChange={v => setForm(p => ({ ...p, relationshipStrength: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strong">Strong</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={() => addMutation.mutate(form)} disabled={!form.name || addMutation.isPending}>
                    Add Contact
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Analytics */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Total Contacts</span>
                  <Users className="w-4 h-4 text-accent" />
                </div>
                <div className="text-2xl font-bold">{analytics.totalContacts}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Referrals Sent</span>
                  <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{analytics.totalReferralsSent}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Reciprocity Score</span>
                  <BarChart3 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold">{analytics.reciprocityScore}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">Dormant</span>
                  <Phone className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold">{analytics.dormantContacts}</div>
                <p className="text-xs text-muted-foreground">90+ days inactive</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Specialty breakdown */}
        {analytics && Object.keys(analytics.bySpecialty).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.entries(analytics.bySpecialty).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-xs">
                {specialtyLabels[k] || k}: {v as number}
              </Badge>
            ))}
          </div>
        )}

        {/* Contacts List */}
        {contacts.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Users className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No COI Contacts</h3>
              <p className="text-sm text-muted-foreground mb-4">Build your Center of Influence network by adding CPAs, attorneys, insurance agents, and other professionals you work with.</p>
              <Button onClick={() => setAddOpen(true)}><UserPlus className="w-4 h-4 mr-1" /> Add Your First Contact</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {contacts.map((contact: any) => (
              <Card key={contact.id} className="hover:border-accent/30 transition-colors">
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm">
                      {contact.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm">{contact.name}</span>
                        <Badge variant="outline" className={`text-[10px] ${strengthColors[contact.relationshipStrength] || ""}`}>
                          {contact.relationshipStrength}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{specialtyLabels[contact.specialty] || contact.specialty}</span>
                        {contact.coiFirm && <span>• {contact.coiFirm}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
                        <span>Sent: {contact.referralsSent || 0}</span>
                        <span>Received: {contact.referralsReceived || 0}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Select
                        value={contact.relationshipStrength || "new"}
                        onValueChange={v => updateMutation.mutate({ id: contact.id, relationshipStrength: v as any })}
                      >
                        <SelectTrigger className="h-7 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strong">Strong</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="new">New</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => deleteMutation.mutate({ id: contact.id })}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
