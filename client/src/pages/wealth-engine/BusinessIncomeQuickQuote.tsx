/**
 * BusinessIncomeQuickQuote — a 3-step advisor-facing quick quote for
 * the Business Income Engine (BIE). Until pass 2 the BIE was only
 * reachable through the heavyweight StrategyComparison / PracticeToWealth
 * pages; this gives advisors a focused flow to pick a role preset,
 * tune 3-4 knobs, and see a 30-year income projection in seconds.
 *
 * Flow:
 *   Step 1 — Role + practice context (preset picker, personalGDC override)
 *   Step 2 — Stream mix (personal / override / AUM / channels / affiliate)
 *   Step 3 — 30-year projection with total earnings + back-plan to target
 *
 * Force multiplier: reads + writes the shared financial profile via
 * useFinancialProfile, so a business-owning advisor's profile gets
 * businessRole / businessRevenue / isBizOwner populated automatically,
 * and every downstream calculator that needs those values
 * (BIE comparisons, UWE premium-financing, HE holistic runs) picks them
 * up without re-prompting.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartTokens } from "@/lib/wealth-engine/tokens";
import { formatCurrency } from "@/lib/wealth-engine/animations";
import {
  ChevronRight,
  ChevronLeft,
  Loader2,
  Briefcase,
  TrendingUp,
  Target,
  Users,
} from "lucide-react";
import { useLocation } from "wouter";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import { FinancialProfileBanner } from "@/components/financial-profile/FinancialProfileBanner";
import { useRunTimeline } from "@/hooks/useRunTimeline";
import type { FinancialProfile } from "@/stores/financialProfile";
import {
  ROLE_OPTIONS,
  profileToBizQuickQuote,
  summarizeBizProjection,
  type BizRoleKey,
} from "./businessIncomeQuickQuoteHelpers";

// Re-export for downstream consumers (tests target the helpers module directly).
export { ROLE_OPTIONS, profileToBizQuickQuote, summarizeBizProjection };
export type { BizRoleKey };

export default function BusinessIncomeQuickQuotePage() {
  const [, navigate] = useLocation();
  const { profile, updateProfile, hasProfile } = useFinancialProfile();
  const { recordRun } = useRunTimeline();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [role, setRole] = useState<BizRoleKey>("dir");
  const [personalGDC, setPersonalGDC] = useState<number>(250_000);
  const [teamSize, setTeamSize] = useState<number>(3);
  const [streamPersonal, setStreamPersonal] = useState(true);
  const [streamOverride, setStreamOverride] = useState(true);
  const [streamAUM, setStreamAUM] = useState(true);
  const [streamChannels, setStreamChannels] = useState(false);
  const [streamAffiliate, setStreamAffiliate] = useState(false);
  const [yearsHorizon, setYearsHorizon] = useState(30);
  const [backPlanTarget, setBackPlanTarget] = useState<number>(500_000);

  // One-shot prefill on late profile hydration
  const didInitialPrefillRef = useRef(hasProfile);
  useEffect(() => {
    if (!didInitialPrefillRef.current && hasProfile) {
      didInitialPrefillRef.current = true;
      const patch = profileToBizQuickQuote(profile);
      if (patch.role) setRole(patch.role);
      if (patch.personalGDC !== undefined) setPersonalGDC(patch.personalGDC);
      if (patch.teamSize !== undefined) setTeamSize(patch.teamSize);
    }
  }, [hasProfile, profile]);

  const handleBannerPrefill = (p: FinancialProfile) => {
    const patch = profileToBizQuickQuote(p);
    if (patch.role) setRole(patch.role);
    if (patch.personalGDC !== undefined) setPersonalGDC(patch.personalGDC);
    if (patch.teamSize !== undefined) setTeamSize(patch.teamSize);
  };

  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((r) => r.key === role) ?? ROLE_OPTIONS[3],
    [role],
  );

  const projectBiz = trpc.wealthEngine.projectBizIncome.useMutation();

  const runProjection = () => {
    // Persist answers to the shared profile so downstream calculators see
    // the business context (BIE strategy comparisons, UWE quick quote).
    updateProfile({
      isBizOwner: true,
      businessRole: role,
      businessRevenue: personalGDC,
      businessEmployees: teamSize,
    });

    const streams: Record<string, boolean> = {
      personal: streamPersonal,
      override: streamOverride,
      overrideG2: streamOverride,
      aum: streamAUM,
      channels: streamChannels,
      affB: streamAffiliate,
    };

    // Run the preset, the server will return year-by-year projection.
    projectBiz.mutate({
      strategy: {
        name: `${selectedRole.label} — Quick Quote`,
        role,
        streams,
        team: [],
        channelSpend: {},
        seasonality: "flat",
        personalGDC,
      },
      years: yearsHorizon,
      presetKey:
        // Use the preset as a baseline — the server will merge with the
        // caller-provided strategy fields. If the role has no direct
        // preset, fall through to undefined and trust the config above.
        (selectedRole.presetKey as
          | "newAssociate"
          | "experiencedPro"
          | "director"
          | "md"
          | "rvp"
          | "strategicPartner") ?? undefined,
    });
    setStep(3);
  };

  // Result data shape: { data: { years: [...], ... }, durationMs, runId }
  const yearsData = (projectBiz.data?.data as { years?: Array<{ year?: number; totalIncome?: number }> } | undefined)?.years;
  const summary = useMemo(() => summarizeBizProjection(yearsData), [yearsData]);

  // Record the run into the timeline after the BIE mutation resolves.
  // We watch `projectBiz.data` + summary so the effect runs exactly once
  // per completed mutation (useMemo returns the same object ref until
  // yearsData changes, so this is cheap).
  useEffect(() => {
    if (!yearsData || yearsData.length === 0) return;
    if (summary.totalEarnings === 0) return;
    recordRun({
      tool: "bie.simulate",
      label: `BIE: ${selectedRole.label}`,
      inputSummary: `${selectedRole.label}, $${personalGDC.toLocaleString()} GDC, ${teamSize} direct reports, ${yearsHorizon}y`,
      outputSummary: `$${summary.totalEarnings.toLocaleString()} total · peak ${formatCurrency(summary.peakIncome)} @ y${summary.peakYear}`,
      route: "/wealth-engine/business-income-quote",
      confidence: 0.75,
      inputs: {
        role,
        personalGDC,
        teamSize,
        yearsHorizon,
        streamPersonal,
        streamOverride,
        streamAUM,
        streamChannels,
        streamAffiliate,
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yearsData, summary.totalEarnings]);

  return (
    <AppShell title="Business Income Quick Quote">
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-accent" />
            <h1 className="text-2xl font-bold">Business Income Quick Quote</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Step {step} of 3 —{" "}
            {step === 1
              ? "Your role & practice context"
              : step === 2
                ? "Revenue stream mix"
                : "30-year income projection"}
          </p>
          <StepBar step={step} />
        </header>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" /> Practice context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FinancialProfileBanner
                onPrefill={handleBannerPrefill}
                usesFields={["businessRole", "businessRevenue", "businessEmployees"]}
                actionLabel="Use my practice profile"
              />
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as BizRoleKey)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Current personal GDC"
                    value={personalGDC}
                    onChange={setPersonalGDC}
                    step={5000}
                    min={0}
                  />
                  <NumberField
                    label="Direct reports (team size)"
                    value={teamSize}
                    onChange={setTeamSize}
                    min={0}
                    max={50}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Projection horizon (years)</Label>
                  <Input
                    type="number"
                    value={yearsHorizon}
                    onChange={(e) => setYearsHorizon(Number(e.target.value) || 30)}
                    min={1}
                    max={50}
                  />
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={() => setStep(2)}>
                  Continue <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent" /> Income streams
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Pick the revenue streams this role is actively producing.
                Every toggle feeds the BIE simulation in step 3.
              </p>
              <div className="space-y-2">
                <StreamRow
                  label="Personal GDC"
                  hint="Your direct book of business (always on)"
                  value={streamPersonal}
                  onChange={setStreamPersonal}
                  disabled
                />
                <StreamRow
                  label="Team overrides"
                  hint="Override from down-line producers (requires team)"
                  value={streamOverride}
                  onChange={setStreamOverride}
                  disabled={selectedRole.key === "new" || selectedRole.key === "exp"}
                />
                <StreamRow
                  label="AUM fees"
                  hint="Advisory fees on assets under management"
                  value={streamAUM}
                  onChange={setStreamAUM}
                />
                <StreamRow
                  label="Channel spend"
                  hint="Referral / webinar / digital marketing programs"
                  value={streamChannels}
                  onChange={setStreamChannels}
                />
                <StreamRow
                  label="Affiliate referrals"
                  hint="Outside affiliate / partner track revenue"
                  value={streamAffiliate}
                  onChange={setStreamAffiliate}
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={runProjection} disabled={projectBiz.isPending}>
                  {projectBiz.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Run {yearsHorizon}-year projection
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="w-4 h-4 text-accent" /> Projection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {projectBiz.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Running {yearsHorizon}-year BIE simulation...
                </div>
              )}
              {projectBiz.error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {projectBiz.error.message ?? "Projection failed"}
                </div>
              )}
              {yearsData && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <StatTile
                      label="Total earnings"
                      value={formatCurrency(summary.totalEarnings)}
                      tint={chartTokens.colors.wealthbridge}
                    />
                    <StatTile
                      label="Avg annual"
                      value={formatCurrency(summary.avgIncome)}
                    />
                    <StatTile
                      label="Peak annual"
                      value={formatCurrency(summary.peakIncome)}
                      tint={chartTokens.colors.positive}
                    />
                    <StatTile
                      label="Peak year"
                      value={`Year ${summary.peakYear}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-end justify-between mb-2">
                      <div className="text-xs text-muted-foreground uppercase tracking-wide">
                        Annual income
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {yearsData.length} years
                      </Badge>
                    </div>
                    <div className="flex items-end gap-[2px] h-32 border-b border-border/50">
                      {yearsData.map((y, i) => {
                        const val = y.totalIncome ?? 0;
                        const h =
                          summary.peakIncome > 0
                            ? (val / summary.peakIncome) * 100
                            : 0;
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-t-sm"
                            style={{
                              height: `${Math.max(2, h)}%`,
                              background:
                                i === summary.peakYear - 1
                                  ? chartTokens.colors.positive
                                  : chartTokens.colors.wealthbridge,
                              opacity: 0.8,
                            }}
                            title={`Year ${y.year ?? i + 1}: ${formatCurrency(val)}`}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-md border p-4 space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Back-plan to a target income
                    </div>
                    <div className="flex items-center gap-2">
                      <NumberField
                        label=""
                        value={backPlanTarget}
                        onChange={setBackPlanTarget}
                        step={25000}
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground mt-5">
                        target annual income
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      For a full back-plan (how many new hires / AUM adds to
                      hit {formatCurrency(backPlanTarget)}), run the
                      Strategy Comparison page's BIE solver — this quick
                      quote only forward-projects the current stream mix.
                    </p>
                  </div>
                </>
              )}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ChevronLeft className="mr-2 h-4 w-4" /> Edit streams
                </Button>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/wealth-engine/strategy-comparison")}
                  >
                    Open Strategy Comparison
                  </Button>
                  <Button onClick={() => navigate("/wealth-engine/practice-to-wealth")}>
                    Practice → Wealth
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

// ─── UI helpers ────────────────────────────────────────────────────────

function StepBar({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center gap-2 mt-2">
      {[1, 2, 3].map((s) => (
        <div
          key={s}
          className="h-1 flex-1 rounded-full"
          style={{
            background: s <= step ? chartTokens.colors.wealthbridge : "#e2e8f0",
            transition: "background 240ms ease",
          }}
        />
      ))}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-2 flex-1">
      {label ? <Label>{label}</Label> : null}
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

function StreamRow({
  label,
  hint,
  value,
  onChange,
  disabled,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0">
        <Label className={disabled ? "text-muted-foreground" : undefined}>
          {label}
        </Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function StatTile({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <div className="rounded-md border p-3 space-y-1">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">
        {label}
      </div>
      <div
        className="text-base font-bold font-mono tabular-nums"
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </div>
    </div>
  );
}
