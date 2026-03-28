import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Users, ArrowRightLeft, Eye, EyeOff, Lock, Unlock, ChevronDown, ChevronUp, Info } from "lucide-react";
import { toast } from "sonner";

const TOPIC_LABELS: Record<string, string> = {
  insurance: "Insurance",
  investments: "Investments",
  tax: "Tax",
  estate: "Estate Planning",
  retirement: "Retirement",
  debt: "Debt Management",
  budgeting: "Budgeting",
  real_estate: "Real Estate",
  business: "Business",
  education: "Education",
  health_finance: "Health Finance",
  general: "General",
  all: "All Topics",
};

const ACCESS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  none: { label: "No Access", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: EyeOff },
  summary: { label: "Summary Only", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Eye },
  read: { label: "Read", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Eye },
  contribute: { label: "Read + Contribute", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Unlock },
  full: { label: "Full Access", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", icon: Unlock },
};

export default function DataSharingTab() {

  const [expandedGrantee, setExpandedGrantee] = useState<number | null>(null);

  const permsQuery = trpc.kbAccess.getMyPermissions.useQuery();
  const defaultsQuery = trpc.kbAccess.getDefaults.useQuery();
  const transitionsQuery = trpc.kbAccess.getTransitionHistory.useQuery();
  const utils = trpc.useUtils();

  const setPermission = trpc.kbAccess.setPermission.useMutation({
    onSuccess: () => {
      utils.kbAccess.getMyPermissions.invalidate();
      toast.success("Permission updated");
    },
  });

  const setUniversal = trpc.kbAccess.setUniversalSharing.useMutation({
    onSuccess: () => {
      utils.kbAccess.getMyPermissions.invalidate();
      toast.success("Universal sharing updated");
    },
  });

  const revokeAll = trpc.kbAccess.revokeAll.useMutation({
    onSuccess: () => {
      utils.kbAccess.getMyPermissions.invalidate();
      toast.success("All access revoked");
    },
  });

  // Group permissions by grantee
  const permsByGrantee = useMemo(() => {
    if (!permsQuery.data) return [] as [number, any[]][];
    const map: Record<number, any[]> = {};
    for (const p of permsQuery.data) {
      if (!map[p.granteeId]) map[p.granteeId] = [];
      map[p.granteeId].push(p);
    }
    return Object.entries(map).map(([k, v]) => [Number(k), v] as [number, any[]]);
  }, [permsQuery.data]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          Data Sharing Controls
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Control which professionals can access which categories of your financial data. 
          Smart defaults are applied based on each professional's role, and you can adjust them at any time.
        </p>
      </div>

      {/* Info card */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300/80">
              <p className="font-medium text-blue-300 mb-1">How sharing works</p>
              <p>When you connect with a professional, smart defaults are applied based on their specialty. 
              For example, your insurance agent gets read access to insurance data but not investment details. 
              You can adjust any permission granularly by topic, or set universal access levels.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sharing Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Active Sharing Permissions
          </CardTitle>
          <CardDescription>
            {permsByGrantee.length === 0
              ? "No active sharing permissions. Connect with a professional to get started."
              : `Sharing data with ${permsByGrantee.length} professional${permsByGrantee.length !== 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {permsByGrantee.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Your data is private. When you connect with professionals,</p>
              <p>you'll be able to control exactly what they can see.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {permsByGrantee.map(([granteeId, perms]) => {
                const isExpanded = expandedGrantee === granteeId;
                const activePerms = perms.filter((p: any) => p.isActive);
                const hasAll = activePerms.some((p: any) => p.topic === "all");

                return (
                  <div key={granteeId} className="border border-border rounded-lg overflow-hidden">
                    {/* Grantee header */}
                    <button
                      className="w-full flex items-center justify-between p-3 hover:bg-accent/5 transition-colors"
                      onClick={() => setExpandedGrantee(isExpanded ? null : granteeId)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium">
                          #{granteeId}
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-medium">Professional #{granteeId}</span>
                          <div className="flex gap-1 mt-0.5">
                            <Badge variant="outline" className="text-[10px] h-4">
                              {perms[0]?.granteeType}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {activePerms.length} topic{activePerms.length !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border p-3 space-y-3">
                        {/* Quick actions */}
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => setUniversal.mutate({
                              granteeId,
                              granteeType: perms[0]?.granteeType as any,
                              accessLevel: "read",
                            })}
                          >
                            <Unlock className="w-3 h-3 mr-1" /> Share All (Read)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs text-red-400 border-red-500/20 hover:bg-red-500/10"
                            onClick={() => revokeAll.mutate({ granteeId })}
                          >
                            <EyeOff className="w-3 h-3 mr-1" /> Revoke All
                          </Button>
                        </div>

                        {/* Per-topic permissions */}
                        <div className="space-y-2">
                          {hasAll ? (
                            <div className="flex items-center justify-between p-2 rounded bg-accent/5">
                              <span className="text-sm">All Topics</span>
                              <Select
                                value={activePerms.find(p => p.topic === "all")?.accessLevel || "none"}
                                onValueChange={(val) => setPermission.mutate({
                                  granteeId,
                                  granteeType: perms[0]?.granteeType as any,
                                  topic: "all",
                                  accessLevel: val as any,
                                })}
                              >
                                <SelectTrigger className="w-40 h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {Object.entries(ACCESS_LABELS).map(([val, { label }]) => (
                                    <SelectItem key={val} value={val}>{label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            Object.keys(TOPIC_LABELS).filter(t => t !== "all").map(topic => {
                              const perm = activePerms.find(p => p.topic === topic);
                              const level = perm?.accessLevel || "none";
                              const accessInfo = ACCESS_LABELS[level];

                              return (
                                <div key={topic} className="flex items-center justify-between p-2 rounded bg-accent/5">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={`text-[10px] h-5 ${accessInfo.color}`}>
                                      {accessInfo.label}
                                    </Badge>
                                    <span className="text-sm">{TOPIC_LABELS[topic]}</span>
                                  </div>
                                  <Select
                                    value={level}
                                    onValueChange={(val) => setPermission.mutate({
                                      granteeId,
                                      granteeType: perms[0]?.granteeType as any,
                                      topic: topic as any,
                                      accessLevel: val as any,
                                    })}
                                  >
                                    <SelectTrigger className="w-40 h-7 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {Object.entries(ACCESS_LABELS).map(([val, { label }]) => (
                                        <SelectItem key={val} value={val}>{label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Source info */}
                        <p className="text-[10px] text-muted-foreground">
                          {perms.some((p: any) => p.source === "default") && "Some permissions were set automatically based on professional type. "}
                          {perms.some((p: any) => p.source === "user_set") && "You have customized some permissions. "}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Transition History */}
      {Array.isArray(transitionsQuery.data) && transitionsQuery.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Access Transition History
            </CardTitle>
            <CardDescription>
              When you switch professionals, access transfers automatically
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(Array.isArray(transitionsQuery.data) ? transitionsQuery.data : []).slice(-10).reverse().map((t: any) => (
                <div key={t.id} className="flex items-center gap-2 text-xs p-2 rounded bg-accent/5">
                  <Badge variant="outline" className="text-[10px]">{TOPIC_LABELS[t.topic] || t.topic}</Badge>
                  <span className="text-muted-foreground">
                    #{t.fromGranteeId} → #{t.toGranteeId}
                  </span>
                  <span className="text-muted-foreground">
                    {t.previousAccessLevel} → {t.newAccessLevel}
                  </span>
                  <span className="text-muted-foreground ml-auto">
                    {new Date(t.transitionedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Smart Defaults Reference */}
      {defaultsQuery.data && defaultsQuery.data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Smart Defaults Reference</CardTitle>
            <CardDescription>
              These defaults are applied when you first connect with a professional
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(
                (Array.isArray(defaultsQuery.data) ? defaultsQuery.data : []).reduce((acc: Record<string, typeof defaultsQuery.data>, d: any) => {
                  const key = d.relationshipType;
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(d);
                  return acc;
                }, {} as Record<string, typeof defaultsQuery.data>)
              ).map(([relType, defaults]) => (
                <div key={relType} className="border border-border rounded-lg p-3">
                  <h4 className="text-sm font-medium capitalize mb-2">
                    {relType.replace(/_/g, " ")}
                  </h4>
                  <div className="space-y-1">
                    {(defaults as any[]).map((d: any, i: number) => {
                      const accessInfo = ACCESS_LABELS[d.defaultAccessLevel] || ACCESS_LABELS.none;
                      return (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">{TOPIC_LABELS[d.topic] || d.topic}</span>
                          <Badge variant="outline" className={`text-[10px] h-4 ${accessInfo.color}`}>
                            {accessInfo.label}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
