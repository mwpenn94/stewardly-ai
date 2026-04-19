/* ═══════════════════════════════════════════════════════════════
   ScenarioComparison — Side-by-side comparison of saved scenarios
   with delta highlighting across all three hub metrics.
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  GitCompare, Save, Trash2, ArrowUpRight, ArrowDownRight, Minus, Plus,
} from 'lucide-react';
import type { WealthEngineData } from '@/contexts/WealthEngineContext';

const fmt = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${(v / 1_000).toFixed(0)}K` : `$${Math.round(v)}`;

function DeltaBadge({ current, baseline, label, format = 'dollar' }: {
  current: number; baseline: number; label: string; format?: 'dollar' | 'pct' | 'score';
}) {
  const diff = current - baseline;
  if (Math.abs(diff) < 0.01) return null;

  const isPositive = diff > 0;
  const color = isPositive ? 'text-emerald-500' : 'text-red-500';
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  const formatted = format === 'dollar' ? fmt(Math.abs(diff)) :
    format === 'pct' ? `${Math.abs(diff * 100).toFixed(1)}%` :
    Math.abs(diff).toFixed(0);

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {isPositive ? '+' : '-'}{formatted}
    </span>
  );
}

interface ScenarioComparisonProps {
  currentWeData: WealthEngineData;
  currentInputs: Record<string, any>;
  onRestoreScenario?: (inputs: Record<string, any>) => void;
}

export function ScenarioComparison({ currentWeData, currentInputs, onRestoreScenario }: ScenarioComparisonProps) {
  const { user } = useAuth();
  const [saveName, setSaveName] = useState('');
  const [showSave, setShowSave] = useState(false);
  const [compareId, setCompareId] = useState<string>('');

  const scenariosQuery = trpc.scenarios.list.useQuery(
    { calculatorType: 'wealth_engine' },
    { enabled: !!user },
  );

  const saveMutation = trpc.scenarios.save.useMutation({
    onSuccess: () => {
      toast.success('Scenario saved');
      setSaveName('');
      setShowSave(false);
      scenariosQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.scenarios.remove.useMutation({
    onSuccess: () => {
      toast.success('Scenario deleted');
      scenariosQuery.refetch();
      if (compareId) setCompareId('');
    },
  });

  const scenarios = scenariosQuery.data || [];
  const compareScenario = scenarios.find(s => s.id.toString() === compareId);
  const compareResults = compareScenario?.resultsJson as WealthEngineData | null;

  // Metric rows for comparison
  const metrics = useMemo(() => {
    if (!compareResults) return [];
    const c = currentWeData;
    const b = compareResults;

    return [
      { label: 'Overall Score', current: c.scorecard.overall, baseline: b.scorecard?.overall ?? 0, format: 'score' as const },
      { label: 'Score %', current: c.scorecard.pctScore, baseline: b.scorecard?.pctScore ?? 0, format: 'pct' as const },
      { label: 'Net Cash Flow', current: c.cfResult.netCashFlow, baseline: b.cfResult?.netCashFlow ?? 0, format: 'dollar' as const },
      { label: 'Savings Rate', current: c.cfResult.savingsRate, baseline: b.cfResult?.savingsRate ?? 0, format: 'pct' as const },
      { label: 'Protection Gap', current: c.prResult.gap, baseline: b.prResult?.gap ?? 0, format: 'dollar' as const },
      { label: 'Growth Projected', current: c.grResult.totalProjected, baseline: b.grResult?.totalProjected ?? 0, format: 'dollar' as const },
      { label: 'Retirement Nest Egg', current: c.rtResult.projectedNest, baseline: b.rtResult?.projectedNest ?? 0, format: 'dollar' as const },
      { label: 'Retirement Gap', current: c.rtResult.gap, baseline: b.rtResult?.gap ?? 0, format: 'dollar' as const },
      { label: 'Tax Savings', current: c.txResult.totalSavings, baseline: b.txResult?.totalSavings ?? 0, format: 'dollar' as const },
      { label: 'Estate Tax', current: c.esResult.estateTax, baseline: b.esResult?.estateTax ?? 0, format: 'dollar' as const },
      { label: 'Education Gap', current: c.edResult.gap, baseline: b.edResult?.gap ?? 0, format: 'dollar' as const },
      // Holistic bridge
      { label: 'Holistic Score', current: c.holisticBridge.holisticScore, baseline: b.holisticBridge?.holisticScore ?? 0, format: 'score' as const },
      { label: 'Client Hub Score', current: c.holisticBridge.clientHubScore, baseline: b.holisticBridge?.clientHubScore ?? 0, format: 'score' as const },
      { label: 'Advanced Hub Score', current: c.holisticBridge.advancedHubScore, baseline: b.holisticBridge?.advancedHubScore ?? 0, format: 'score' as const },
      // Advanced cascade
      { label: 'Total Annual Benefit', current: c.advancedCascade.totalAnnualBenefit, baseline: b.advancedCascade?.totalAnnualBenefit ?? 0, format: 'dollar' as const },
      { label: 'Net Worth Impact', current: c.advancedCascade.netWorthImpact, baseline: b.advancedCascade?.netWorthImpact ?? 0, format: 'dollar' as const },
    ];
  }, [currentWeData, compareResults]);

  if (!user) {
    return (
      <Card className="border-border/50">
        <CardContent className="pt-6 text-center text-sm text-muted-foreground">
          <p>Sign in to save and compare scenarios.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <GitCompare className="w-4 h-4" />
            Scenario Comparison
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{scenarios.length} saved</Badge>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setShowSave(!showSave)}>
              <Plus className="w-3 h-3" /> Save Current
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Save current scenario */}
        {showSave && (
          <div className="flex gap-2">
            <Input
              value={saveName}
              onChange={e => setSaveName(e.target.value)}
              placeholder="Scenario name (e.g., 'Conservative Plan')"
              className="text-sm h-8"
            />
            <Button size="sm" className="h-8 text-xs" disabled={!saveName.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate({
                name: saveName.trim(),
                inputsJson: currentInputs,
                resultsJson: currentWeData as any,
              })}>
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
          </div>
        )}

        {/* Scenario selector */}
        {scenarios.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Compare with:</span>
            <Select value={compareId} onValueChange={setCompareId}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Select a saved scenario..." />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>
                    {s.name} ({new Date(s.updatedAt).toLocaleDateString()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {compareScenario && (
              <div className="flex gap-1">
                {onRestoreScenario && (
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => onRestoreScenario(compareScenario.inputsJson)}>
                    Restore
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400"
                  onClick={() => deleteMutation.mutate({ id: compareScenario.id })}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Comparison table */}
        {compareResults && metrics.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium">Metric</th>
                  <th className="text-right px-3 py-2 font-medium">Current</th>
                  <th className="text-right px-3 py-2 font-medium">{compareScenario?.name || 'Baseline'}</th>
                  <th className="text-right px-3 py-2 font-medium">Delta</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((m, i) => (
                  <tr key={m.label} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/10'}>
                    <td className="px-3 py-1.5 font-medium">{m.label}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {m.format === 'dollar' ? fmt(m.current) : m.format === 'pct' ? `${(m.current * 100).toFixed(1)}%` : m.current.toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                      {m.format === 'dollar' ? fmt(m.baseline) : m.format === 'pct' ? `${(m.baseline * 100).toFixed(1)}%` : m.baseline.toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <DeltaBadge current={m.current} baseline={m.baseline} label={m.label} format={m.format} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {scenarios.length === 0 && !showSave && (
          <p className="text-xs text-muted-foreground text-center py-4">
            No saved scenarios yet. Click "Save Current" to create your first scenario for comparison.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default ScenarioComparison;
