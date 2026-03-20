import React from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Link2, Unlink, RefreshCw, Shield, Linkedin, Mail, Chrome, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const PROVIDER_META: Record<string, {
  name: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  fieldsProvided: string[];
}> = {
  manus: {
    name: "Manus",
    icon: <Shield className="w-5 h-5" />,
    color: "text-blue-500",
    description: "Primary authentication provider",
    fieldsProvided: ["name", "email", "avatar"],
  },
  linkedin: {
    name: "LinkedIn",
    icon: <Linkedin className="w-5 h-5" />,
    color: "text-[#0A66C2]",
    description: "Professional profile, employer, job title, industry, headline",
    fieldsProvided: ["name", "email", "photo", "employer", "job_title", "industry", "headline"],
  },
  google: {
    name: "Google",
    icon: <Chrome className="w-5 h-5" />,
    color: "text-[#4285F4]",
    description: "Personal details, phone, birthday, address, organizations",
    fieldsProvided: ["name", "email", "photo", "phone", "birthday", "gender", "address"],
  },
  email: {
    name: "Email",
    icon: <Mail className="w-5 h-5" />,
    color: "text-emerald-500",
    description: "Email address with employer inference from domain",
    fieldsProvided: ["email", "employer_inferred"],
  },
};

export default function ConnectedAccountsTab() {

  const { data: providers, isLoading: loadingProviders } = trpc.authEnrichment.getConnectedProviders.useQuery();
  const { data: completeness, isLoading: loadingCompleteness } = trpc.authEnrichment.getProfileCompleteness.useQuery();
  const { data: history } = trpc.authEnrichment.getEnrichmentHistory.useQuery();
  const { data: signInMethods } = trpc.authEnrichment.getSignInMethods.useQuery();

  const unlinkMutation = trpc.authEnrichment.unlinkProvider.useMutation({
    onSuccess: () => {
      toast.success("Provider disconnected — account has been unlinked.");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to unlink provider");
    },
  });

  const refreshMutation = trpc.authEnrichment.forceProfileRefresh.useMutation({
    onSuccess: (data) => {
      toast.success(`Profile refreshed — ${data.fieldsEnriched.length} fields updated. Completeness: ${data.completeness}%`);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to refresh profile");
    },
  });

  if (loadingProviders || loadingCompleteness) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
        <div className="h-32 bg-muted animate-pulse rounded" />
      </div>
    );
  }

  const completenessPercent = completeness?.completeness || 0;

  return (
    <div className="space-y-6">
      {/* Profile Completeness */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Profile Completeness</CardTitle>
              <CardDescription>
                Connect more accounts to enrich your financial profile
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Data completeness</span>
              <span className="font-medium">{completenessPercent}%</span>
            </div>
            <Progress value={completenessPercent} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {completenessPercent < 30 && "Connect LinkedIn or Google to significantly improve your profile."}
              {completenessPercent >= 30 && completenessPercent < 60 && "Good start! Add more providers to unlock personalized insights."}
              {completenessPercent >= 60 && completenessPercent < 80 && "Strong profile! A few more fields would maximize AI accuracy."}
              {completenessPercent >= 80 && "Excellent! Your profile is well-enriched for personalized advice."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connected Providers */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Connected Accounts
        </h3>

        {providers?.map((provider) => {
          const meta = PROVIDER_META[provider.provider];
          if (!meta) return null;

          const method = signInMethods?.find((m) => m.id === provider.provider);
          const isConfigured = method?.configured ?? true;

          return (
            <Card key={provider.provider} className={provider.connected ? "" : "opacity-60"}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Provider Icon */}
                  <div className={`${meta.color} shrink-0`}>
                    {meta.icon}
                  </div>

                  {/* Provider Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{meta.name}</span>
                      {provider.connected ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : !isConfigured ? (
                        <Badge variant="outline" className="text-xs text-amber-600 border-amber-200 bg-amber-50">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Not Configured
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Not Connected
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>

                    {/* Connected details */}
                    {provider.connected && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {meta.fieldsProvided.map((field) => (
                          <Badge key={field} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {field.replace(/_/g, " ")}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* LinkedIn specific */}
                    {provider.provider === "linkedin" && (provider as any).headline && (
                      <p className="text-xs text-muted-foreground mt-1 italic">
                        "{(provider as any).headline}"
                      </p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="shrink-0">
                    {provider.connected && provider.provider !== "manus" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => unlinkMutation.mutate({ provider: provider.provider as any })}
                        disabled={unlinkMutation.isPending}
                      >
                        <Unlink className="w-4 h-4 mr-1" />
                        Unlink
                      </Button>
                    ) : !provider.connected && isConfigured ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          toast.info(`${meta.name} sign-in will be available once API keys are configured.`);
                        }}
                      >
                        <Link2 className="w-4 h-4 mr-1" />
                        Connect
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enrichment History */}
      {history && history.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Enrichment History
            </h3>
            <div className="space-y-2">
              {history.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/50">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium capitalize">{log.provider}</span>
                    <span className="text-muted-foreground mx-1">·</span>
                    <span className="text-muted-foreground">{log.eventType?.replace(/_/g, " ")}</span>
                    {log.fieldsCaptured ? (
                      <span className="text-muted-foreground">
                        {" "}— {Array.isArray(log.fieldsCaptured) ? String((log.fieldsCaptured as string[]).length) : "0"} fields
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(log.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Confidence Hierarchy Info */}
      <Separator />
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <h4 className="text-sm font-medium mb-2">How Data Merging Works</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When you connect multiple accounts, WealthBridge uses a confidence hierarchy to determine
            which data source is most authoritative for each field. For example, LinkedIn is the most
            trusted source for employer and job title (95% confidence), while Google is preferred for
            phone and birthday (90% confidence). Lower-confidence data never overwrites higher-confidence
            data, and conflicts are flagged for your review.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
