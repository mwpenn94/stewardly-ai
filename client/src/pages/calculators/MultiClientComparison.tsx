/**
 * MultiClientComparison — Multi-client comparison view (Gap 6).
 *
 * Allows advisors managing multiple clients to compare saved scenarios
 * side-by-side. Pulls from the calculatorScenarios table and renders
 * a comparison grid of key metrics across up to 4 clients.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, BarChart3, Plus, X, ArrowUpDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/contexts/AuthContext';
import { fmt, pct } from '@/lib/format';

interface ScenarioData {
  id: number;
  name: string;
  inputsJson: string;
  createdAt: number;
}

interface ParsedClient {
  id: number;
  name: string;
  clientName: string;
  age: number;
  income: number;
  netWorth: number;
  protectionScore: number;
  retirementScore: number;
  growthScore: number;
  overallScore: number;
}

const COMPARISON_METRICS = [
  { key: 'clientName', label: 'Client Name', format: 'text' },
  { key: 'age', label: 'Age', format: 'number' },
  { key: 'income', label: 'Total Income', format: 'currency' },
  { key: 'netWorth', label: 'Net Worth', format: 'currency' },
  { key: 'protectionScore', label: 'Protection Score', format: 'score' },
  { key: 'retirementScore', label: 'Retirement Score', format: 'score' },
  { key: 'growthScore', label: 'Growth Score', format: 'score' },
  { key: 'overallScore', label: 'Overall Score', format: 'pct' },
] as const;

function parseScenario(s: ScenarioData): ParsedClient {
  try {
    const data = JSON.parse(s.inputsJson);
    return {
      id: s.id,
      name: s.name,
      clientName: data.clientName || s.name || 'Unknown',
      age: data.age || 0,
      income: (data.salary || 0) + (data.bonus || 0) + (data.rentalIncome || 0),
      netWorth: (data.savings || 0) + (data.investments || 0) + (data.homeValue || 0) - (data.mortgage || 0) - (data.otherDebt || 0),
      protectionScore: data.protectionScore || 0,
      retirementScore: data.retirementScore || 0,
      growthScore: data.growthScore || 0,
      overallScore: data.overallScore || 0,
    };
  } catch {
    return {
      id: s.id, name: s.name, clientName: s.name || 'Unknown',
      age: 0, income: 0, netWorth: 0,
      protectionScore: 0, retirementScore: 0, growthScore: 0, overallScore: 0,
    };
  }
}

function formatValue(value: any, format: string): string {
  if (format === 'currency') return fmt(value);
  if (format === 'pct') return pct(value / 100);
  if (format === 'score') return `${value}/3`;
  return String(value);
}

function getScoreColor(score: number, max: number): string {
  const ratio = max > 0 ? score / max : 0;
  if (ratio >= 0.8) return 'text-green-500';
  if (ratio >= 0.5) return 'text-amber-500';
  return 'text-red-500';
}

export function MultiClientComparison() {
  const { user } = useAuth();
  // @ts-expect-error — overload resolution mismatch
  const scenariosQ = trpc.scenarios.list.useQuery(undefined, { enabled: !!user });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<string>('overallScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const allScenarios = useMemo(() => {
    if (!scenariosQ.data) return [];
    // @ts-expect-error — strict mode fix
    return (scenariosQ.data as ScenarioData[]).map(parseScenario);
  }, [scenariosQ.data]);

  const selected = useMemo(() => {
    const items = allScenarios.filter(s => selectedIds.includes(s.id));
    return items.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? 0;
      const bVal = (b as any)[sortBy] ?? 0;
      return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
    });
  }, [allScenarios, selectedIds, sortBy, sortDir]);

  const addClient = (id: string) => {
    const numId = Number(id);
    if (!selectedIds.includes(numId) && selectedIds.length < 4) {
      setSelectedIds(prev => [...prev, numId]);
    }
  };

  const removeClient = (id: number) => {
    setSelectedIds(prev => prev.filter(i => i !== id));
  };

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(key); setSortDir('desc'); }
  };

  const available = allScenarios.filter(s => !selectedIds.includes(s.id));

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Sign in to compare saved client scenarios</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Multi-Client Comparison
            <Badge variant="outline" className="text-xs">{selected.length}/4</Badge>
          </CardTitle>
          {available.length > 0 && selectedIds.length < 4 && (
            <Select onValueChange={addClient}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Add client..." />
              </SelectTrigger>
              <SelectContent>
                {available.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.clientName} ({s.name})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {selected.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select up to 4 saved scenarios to compare side-by-side</p>
            <p className="text-xs mt-1">Save scenarios from the Wealth Engine first, then add them here</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground w-[140px]">Metric</th>
                  {selected.map(c => (
                    <th key={c.id} className="text-center py-2 px-2 min-w-[120px]">
                      <div className="flex items-center justify-center gap-1">
                        <span className="text-xs font-semibold truncate max-w-[100px]">{c.clientName}</span>
                        <button type="button" onClick={() => removeClient(c.id)} className="text-muted-foreground hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON_METRICS.map(metric => {
                  const values = selected.map(c => (c as any)[metric.key]);
                  const numValues = values.filter(v => typeof v === 'number');
                  const maxVal = numValues.length > 0 ? Math.max(...numValues) : 0;

                  return (
                    <tr key={metric.key} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => toggleSort(metric.key)}
                          className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          {metric.label}
                          {sortBy === metric.key && <ArrowUpDown className="w-3 h-3 text-primary" />}
                        </button>
                      </td>
                      {selected.map(c => {
                        const val = (c as any)[metric.key];
                        const isMax = typeof val === 'number' && val === maxVal && numValues.length > 1;
                        return (
                          <td key={c.id} className={`py-2 px-2 text-center text-xs ${isMax ? 'font-bold' : ''} ${metric.format === 'score' ? getScoreColor(val, 3) : ''}`}>
                            {formatValue(val, metric.format)}
                            {isMax && metric.format !== 'text' && <span className="text-[9px] text-green-500 ml-1">★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {allScenarios.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            No saved scenarios found. Save a scenario from the Wealth Engine to use this feature.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
