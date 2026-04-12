/**
 * Reference Hub — standalone page for product references, benchmarks,
 * methodology disclosures, S&P 500 history, and guardrails.
 *
 * Previously only accessible via the References tab in EngineDashboard.
 * This page gives direct access + adds guardrails and S&P history sections.
 */

import { useState } from "react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen, ExternalLink, Shield, TrendingUp, Scale, Info,
  ChevronDown, ChevronUp, BarChart3, AlertTriangle,
} from "lucide-react";
import ProductReferencePanel from "@/components/ProductReferencePanel";

export default function ReferenceHub() {
  const { data: references } = trpc.calculatorEngine.productReferences.useQuery(undefined, { retry: false });
  const { data: benchmarks } = trpc.calculatorEngine.industryBenchmarks.useQuery(undefined, { retry: false });
  const { data: methodology } = trpc.calculatorEngine.methodology.useQuery(undefined, { retry: false });
  const [showGuardrails, setShowGuardrails] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  return (
    <AppShell title="Reference Hub">
      <div className="max-w-5xl mx-auto space-y-6 p-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-accent" />
            Reference Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Product references, industry benchmarks, methodology disclosures, and guardrails
            used by all Stewardly calculator engines.
          </p>
        </div>

        {/* ProductReferencePanel — the main content */}
        <ProductReferencePanel
          references={references?.map((r: any) => ({ key: r.key, src: r.src, url: r.url, benchmark: r.benchmark }))}
          benchmarks={benchmarks as any}
          methodology={methodology as any}
          title="Product References & Methodology"
        />

        {/* Guardrails section */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Guardrails & Assumptions</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowGuardrails(!showGuardrails)} className="h-8">
                {showGuardrails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription>Constraints the engines enforce to keep projections realistic.</CardDescription>
          </CardHeader>
          {showGuardrails && (
            <CardContent className="space-y-3">
              <GuardrailRow
                label="Maximum Investment Return"
                value="12% annually"
                note="Prevents unrealistic return assumptions. Historical S&P 500 CAGR is ~10.5%."
              />
              <GuardrailRow
                label="Minimum Savings Rate"
                value="2%"
                note="Below this threshold, projections are not meaningful for retirement planning."
              />
              <GuardrailRow
                label="Tax Rate Range"
                value="10% – 45%"
                note="Covers the full US federal bracket range. State taxes are additive."
              />
              <GuardrailRow
                label="Monte Carlo Trials"
                value="1,000 – 10,000"
                note="Default 1,000. Higher trial counts increase accuracy but take longer."
              />
              <GuardrailRow
                label="Projection Horizon"
                value="1 – 50 years"
                note="Beyond 30 years, compound uncertainty makes point estimates unreliable."
              />
              <GuardrailRow
                label="Inflation Assumption"
                value="2.5% default"
                note="Configurable per strategy. Used for real-dollar projections."
              />
              <GuardrailRow
                label="BIE GDC Brackets"
                value="5 tiers"
                note="Commission rates scale with GDC. Bracket boundaries are product-specific."
              />
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Important:</strong> All projections are hypothetical illustrations,
                  not guarantees. Past performance does not predict future results. Consult a qualified financial
                  advisor before making investment decisions.
                </p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* S&P 500 historical context */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" />
                <CardTitle className="text-base">Historical Context</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowHistory(!showHistory)} className="h-8">
                {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            <CardDescription>Long-term returns used as engine defaults and benchmarks.</CardDescription>
          </CardHeader>
          {showHistory && (
            <CardContent>
              <div className="space-y-2">
                <HistoryRow label="S&P 500 (1928–2024)" return_="~10.5% CAGR" real="~7.5% real" source="NYU Stern" />
                <HistoryRow label="US Aggregate Bonds" return_="~5.3% CAGR" real="~2.3% real" source="Vanguard" />
                <HistoryRow label="60/40 Portfolio" return_="~8.5% CAGR" real="~5.5% real" source="Vanguard" />
                <HistoryRow label="US Inflation (CPI)" return_="~3.0% avg" real="—" source="BLS" />
                <HistoryRow label="Risk-Free (10Y Treasury)" return_="~4.8% avg" real="~1.8% real" source="FRED" />
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function GuardrailRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 p-2 rounded border">
      <Scale className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{label}</span>
          <Badge variant="outline" className="text-[10px]">{value}</Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mt-0.5">{note}</p>
      </div>
    </div>
  );
}

function HistoryRow({ label, return_, real, source }: { label: string; return_: string; real: string; source: string }) {
  return (
    <div className="flex items-center justify-between p-2 rounded border text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-[10px]">{return_}</Badge>
        {real !== "—" && <Badge variant="secondary" className="text-[10px]">{real}</Badge>}
        <span className="text-[10px] text-muted-foreground">{source}</span>
      </div>
    </div>
  );
}
