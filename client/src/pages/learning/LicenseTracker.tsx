/**
 * EMBA Learning — License Tracker page (Task 6D).
 *
 * Grid of active licenses with expiration dates, CE progress, and
 * renewal actions. The agent's `check_license_status` tool uses the
 * same underlying data via `learning.licenses.alerts`.
 */

import AppShell from "@/components/AppShell";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Plus, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

const LICENSE_TYPES = [
  { value: "sie", label: "SIE (Securities Industry Essentials)" },
  { value: "series7", label: "Series 7" },
  { value: "series66", label: "Series 66" },
  { value: "cfp", label: "CFP" },
  { value: "life_health", label: "Life & Health" },
  { value: "general_insurance", label: "General Insurance" },
  { value: "p_and_c", label: "Property & Casualty" },
  { value: "surplus_lines", label: "Surplus Lines" },
];

export default function LicenseTracker() {
  const licensesQ = trpc.learning.licenses.list.useQuery();
  const alertsQ = trpc.learning.licenses.alerts.useQuery();
  const progressQ = trpc.learning.licenses.ceProgress.useQuery();
  const utils = trpc.useUtils();

  const addMut = trpc.learning.licenses.add.useMutation({
    onSuccess: () => {
      toast.success("License added");
      utils.learning.licenses.list.invalidate();
      utils.learning.licenses.alerts.invalidate();
      utils.learning.licenses.ceProgress.invalidate();
      setShowAdd(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const removeMut = trpc.learning.licenses.remove.useMutation({
    onSuccess: () => {
      toast.success("License removed");
      utils.learning.licenses.list.invalidate();
      utils.learning.licenses.alerts.invalidate();
    },
  });

  const [showAdd, setShowAdd] = useState(false);
  const [licenseType, setLicenseType] = useState("series7");
  const [licenseState, setLicenseState] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [ceCreditsRequired, setCeCreditsRequired] = useState(0);
  const [ceDeadline, setCeDeadline] = useState("");

  const licenses = licensesQ.data ?? [];
  const alerts = alertsQ.data ?? [];
  const progress = progressQ.data ?? [];

  return (
    <AppShell title="License Tracker">
      <div className="mx-auto max-w-5xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold flex items-center gap-2">
              <Shield className="h-8 w-8 text-primary" />
              License Tracker
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Your licenses, CE progress, and expiration deadlines in one place.
            </p>
          </div>
          <Button onClick={() => setShowAdd((s) => !s)}>
            <Plus className="h-4 w-4 mr-2" />
            Add License
          </Button>
        </header>

        {showAdd && (
          <Card>
            <CardHeader>
              <CardTitle>Add License</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-4">
              <div>
                <Label>License type</Label>
                <select
                  className="mt-1 w-full border rounded-md p-2 bg-background"
                  value={licenseType}
                  onChange={(e) => setLicenseType(e.target.value)}
                >
                  {LICENSE_TYPES.map((l) => (
                    <option key={l.value} value={l.value}>
                      {l.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>State (optional)</Label>
                <Input value={licenseState} onChange={(e) => setLicenseState(e.target.value)} placeholder="e.g. CA" />
              </div>
              <div>
                <Label>License number</Label>
                <Input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <Label>Expiration date</Label>
                <Input type="date" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} />
              </div>
              <div>
                <Label>CE credits required</Label>
                <Input
                  type="number"
                  min={0}
                  value={ceCreditsRequired}
                  onChange={(e) => setCeCreditsRequired(Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <Label>CE deadline</Label>
                <Input type="date" value={ceDeadline} onChange={(e) => setCeDeadline(e.target.value)} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAdd(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() =>
                    addMut.mutate({
                      licenseType,
                      licenseState: licenseState || undefined,
                      licenseNumber: licenseNumber || undefined,
                      expirationDate: expirationDate ? new Date(expirationDate) : undefined,
                      ceCreditsRequired,
                      ceDeadline: ceDeadline ? new Date(ceDeadline) : undefined,
                    })
                  }
                  disabled={addMut.isPending}
                >
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {alerts.length > 0 && (
          <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                <AlertTriangle className="h-5 w-5" />
                Upcoming Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {alerts.map((a, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Badge variant="secondary">{a.alertType}</Badge>
                    <span>{a.message}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Your Licenses</CardTitle>
          </CardHeader>
          <CardContent>
            {licensesQ.isLoading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : licenses.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No licenses yet. Click "Add License" to start tracking.
              </div>
            ) : (
              <div className="space-y-3">
                {licenses.map((lic: any) => {
                  const prog = progress.find((p) => p.licenseId === lic.id);
                  return (
                    <div key={lic.id} className="p-4 border rounded-md flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="font-semibold">{lic.licenseType.toUpperCase()}</div>
                          <Badge>{lic.status}</Badge>
                          {lic.licenseState && <Badge variant="outline">{lic.licenseState}</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {lic.licenseNumber && <>#{lic.licenseNumber} · </>}
                          Expires: {lic.expirationDate ? String(lic.expirationDate).slice(0, 10) : "—"}
                        </div>
                        {prog && prog.required > 0 && (
                          <div className="mt-2">
                            <div className="text-xs text-muted-foreground">
                              CE: {prog.completed}/{prog.required} credits
                            </div>
                            <Progress value={prog.percent} className="mt-1 h-2" />
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove license"
                        onClick={() => removeMut.mutate({ id: lic.id })}
                        disabled={removeMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
