import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface VerificationBadgesProps {
  professionalId: number;
  compact?: boolean;
  showActions?: boolean;
}

const sourceLabels: Record<string, string> = {
  sec_iapd: "SEC IAPD",
  finra_brokercheck: "FINRA BrokerCheck",
  cfp_board: "CFP Board",
  nasba_cpaverify: "NASBA CPAverify",
  nipr_pdb: "NIPR PDB",
  nmls: "NMLS",
  state_bar: "State Bar",
  ibba: "IBBA",
  martindale: "Martindale-Hubbell",
  avvo: "Avvo",
};

const statusConfig: Record<string, { icon: typeof ShieldCheck; color: string; label: string }> = {
  verified: { icon: ShieldCheck, color: "text-emerald-400", label: "Verified" },
  not_found: { icon: ShieldX, color: "text-zinc-500", label: "Not Found" },
  flagged: { icon: ShieldAlert, color: "text-amber-400", label: "Flagged" },
  expired: { icon: Clock, color: "text-orange-400", label: "Expired" },
  pending: { icon: Shield, color: "text-blue-400", label: "Pending" },
};

const badgeTypeConfig: Record<string, { color: string; bgColor: string }> = {
  sec_registered: { color: "text-emerald-300", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  cfp_certified: { color: "text-blue-300", bgColor: "bg-blue-500/10 border-blue-500/20" },
  cpa_licensed: { color: "text-violet-300", bgColor: "bg-violet-500/10 border-violet-500/20" },
  nmls_licensed: { color: "text-cyan-300", bgColor: "bg-cyan-500/10 border-cyan-500/20" },
  bar_admitted: { color: "text-amber-300", bgColor: "bg-amber-500/10 border-amber-500/20" },
  insurance_licensed: { color: "text-teal-300", bgColor: "bg-teal-500/10 border-teal-500/20" },
  ibba_member: { color: "text-rose-300", bgColor: "bg-rose-500/10 border-rose-500/20" },
  clean_record: { color: "text-emerald-300", bgColor: "bg-emerald-500/10 border-emerald-500/20" },
  disclosure_flag: { color: "text-amber-300", bgColor: "bg-amber-500/10 border-amber-500/20" },
};

export function VerificationBadges({ professionalId, compact = false, showActions = true }: VerificationBadgesProps) {
  const [runningSource, setRunningSource] = useState<string | null>(null);

  const { data: verifications, isLoading: loadingVerifications } = trpc.verification.getVerifications.useQuery(
    { professionalId }
  );
  const { data: badges, isLoading: loadingBadges } = trpc.verification.getBadges.useQuery(
    { professionalId }
  );

  const runVerification = trpc.verification.verifyProfessional.useMutation({
    onSuccess: (data) => {
      const count = data.results?.length || 0;
      toast.success(`Verification Complete: ${count} check(s) processed`);
      setRunningSource(null);
    },
    onError: (err) => {
      toast.error(`Verification couldn't complete: ${err.message}`);
      setRunningSource(null);
    },
  });

  const utils = trpc.useUtils();

  const handleRunVerification = (_source: string) => {
    setRunningSource(_source);
    runVerification.mutate(
      { professionalId },
      {
        onSettled: () => {
          utils.verification.getVerifications.invalidate({ professionalId });
          utils.verification.getBadges.invalidate({ professionalId });
        },
      }
    );
  };

  if (loadingVerifications || loadingBadges) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading verifications...</span>
      </div>
    );
  }

  // Compact mode: just show badge pills
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {badges?.map((badge: any) => {
          const config = badgeTypeConfig[badge.badgeType] || { color: "text-zinc-300", bgColor: "bg-zinc-500/10 border-zinc-500/20" };
          return (
            <TooltipProvider key={badge.id}>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className={`${config.bgColor} ${config.color} text-xs border`}>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    {badge.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{sourceLabels[badge.source] || badge.source}</p>
                  <p className="text-xs text-muted-foreground">
                    Verified {badge.verifiedAt ? new Date(badge.verifiedAt).toLocaleDateString() : "N/A"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        })}
        {(!badges || badges.length === 0) && (
          <span className="text-xs text-muted-foreground">No verifications yet</span>
        )}
      </div>
    );
  }

  // Full mode: show verification details
  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Professional Verifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Badges Section */}
        {badges && badges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Credentials</h4>
            <div className="flex flex-wrap gap-2">
              {badges.map((badge: any) => {
                const config = badgeTypeConfig[badge.badgeType] || { color: "text-zinc-300", bgColor: "bg-zinc-500/10 border-zinc-500/20" };
                return (
                  <Badge
                    key={badge.id}
                    variant="outline"
                    className={`${config.bgColor} ${config.color} border px-3 py-1`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    {badge.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Verification History */}
        {verifications && verifications.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">Verification History</h4>
            <div className="space-y-2">
              {verifications.map((v: any) => {
                const config = statusConfig[v.status] || statusConfig.pending;
                const Icon = config.icon;
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-background/50 border border-border/30"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div>
                        <p className="text-sm font-medium">{sourceLabels[v.source] || v.source}</p>
                        <p className="text-xs text-muted-foreground">
                          {v.verifiedAt ? new Date(v.verifiedAt).toLocaleDateString() : "Pending"}
                          {v.externalId && ` · ID: ${v.externalId}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${config.color}`}>
                        {config.label}
                      </Badge>
                      {v.externalUrl && (
                        <a href={v.externalUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                        </a>
                      )}
                      {showActions && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleRunVerification(v.source)}
                          disabled={runningSource === v.source}
                          aria-label={`Verify ${v.source}`}
                        >
                          {runningSource === v.source ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!verifications || verifications.length === 0) && (!badges || badges.length === 0) && (
          <div className="text-center py-6 text-muted-foreground">
            <Shield className="h-10 w-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No verifications have been run yet</p>
            {showActions && (
              <p className="text-xs mt-1">Use the verification tools to check professional credentials</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Inline Badge Display (for tables/lists) ───────────────────────────
export function InlineVerificationBadge({ status, source }: { status: string; source: string }) {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Icon className={`h-4 w-4 ${config.color}`} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{sourceLabels[source] || source}: {config.label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
