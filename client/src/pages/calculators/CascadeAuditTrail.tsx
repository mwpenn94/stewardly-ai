/* ═══════════════════════════════════════════════════════════════
   CascadeAuditTrail — Timestamped propagation log showing how
   changes in one hub cascade to others in the holistic system.
   
   Tracks: source hub, target hub, data fields changed, values,
   timestamp, and cascade direction. Session-level (in-memory).
   ═══════════════════════════════════════════════════════════════ */
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight, ArrowRight, Clock, Trash2, Filter } from 'lucide-react';
import type { HolisticCascadeBridge, AdvancedStrategiesCascade, PracticeManagementCascade } from '@/contexts/WealthEngineContext';
import { fmt, fmtSm } from './format';

/* ─── Types ─── */
export type CascadeSource = 'client' | 'advanced' | 'practice';

export interface CascadeAuditEntry {
  id: string;
  timestamp: number;
  source: CascadeSource;
  target: CascadeSource;
  direction: string;
  changes: CascadeFieldChange[];
  holisticScoreBefore: number;
  holisticScoreAfter: number;
  summary: string;
}

export interface CascadeFieldChange {
  field: string;
  label: string;
  before: number;
  after: number;
  unit: 'currency' | 'percent' | 'score' | 'count';
}

/* ─── Helper: format a field change value ─── */
function formatValue(v: number, unit: CascadeFieldChange['unit']): string {
  switch (unit) {
    case 'currency': return fmtSm(v);
    case 'percent': return `${v.toFixed(1)}%`;
    case 'score': return `${Math.round(v)}/100`;
    case 'count': return v.toFixed(0);
  }
}

/* ─── Helper: compute change direction icon ─── */
function changeIcon(before: number, after: number): string {
  if (after > before) return '↑';
  if (after < before) return '↓';
  return '→';
}

/* ─── Helper: compute change color ─── */
function changeColor(before: number, after: number): string {
  if (after > before) return 'text-green-400';
  if (after < before) return 'text-red-400';
  return 'text-muted-foreground';
}

/* ─── Source label & color ─── */
const SOURCE_META: Record<CascadeSource, { label: string; color: string }> = {
  client: { label: 'Client Hub', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  advanced: { label: 'Advanced Hub', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  practice: { label: 'Practice Hub', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
};

/* ─── Build audit entries from cascade bridge changes ─── */
export function buildCascadeAuditEntries(
  prevBridge: HolisticCascadeBridge | null,
  currBridge: HolisticCascadeBridge,
  advCascade: AdvancedStrategiesCascade,
  practiceCascade: PracticeManagementCascade,
): CascadeAuditEntry[] {
  if (!prevBridge) return [];
  const entries: CascadeAuditEntry[] = [];
  const now = Date.now();

  // Client → Advanced changes
  const c2aChanges: CascadeFieldChange[] = [];
  const c2a = currBridge.clientToAdvanced;
  const p2a = prevBridge.clientToAdvanced;
  if (c2a.incomeForSizing !== p2a.incomeForSizing) c2aChanges.push({ field: 'incomeForSizing', label: 'Income for Strategy Sizing', before: p2a.incomeForSizing, after: c2a.incomeForSizing, unit: 'currency' });
  if (c2a.estateForILIT !== p2a.estateForILIT) c2aChanges.push({ field: 'estateForILIT', label: 'Estate for ILIT', before: p2a.estateForILIT, after: c2a.estateForILIT, unit: 'currency' });
  if (c2a.protectionGap !== p2a.protectionGap) c2aChanges.push({ field: 'protectionGap', label: 'Protection Gap', before: p2a.protectionGap, after: c2a.protectionGap, unit: 'currency' });
  if (c2a.taxBurden !== p2a.taxBurden) c2aChanges.push({ field: 'taxBurden', label: 'Tax Burden', before: p2a.taxBurden, after: c2a.taxBurden, unit: 'percent' });
  if (c2a.retirementGap !== p2a.retirementGap) c2aChanges.push({ field: 'retirementGap', label: 'Retirement Gap', before: p2a.retirementGap, after: c2a.retirementGap, unit: 'currency' });

  if (c2aChanges.length > 0) {
    entries.push({
      id: `c2a-${now}`,
      timestamp: now,
      source: 'client',
      target: 'advanced',
      direction: 'client→advanced',
      changes: c2aChanges,
      holisticScoreBefore: prevBridge.holisticScore,
      holisticScoreAfter: currBridge.holisticScore,
      summary: `${c2aChanges.length} field${c2aChanges.length > 1 ? 's' : ''} cascaded from Client to Advanced`,
    });
  }

  // Advanced → Client changes
  const a2cChanges: CascadeFieldChange[] = [];
  const a2c = currBridge.advancedToClient;
  const pa2c = prevBridge.advancedToClient;
  if (a2c.additionalProtection !== pa2c.additionalProtection) a2cChanges.push({ field: 'additionalProtection', label: 'Additional Protection', before: pa2c.additionalProtection, after: a2c.additionalProtection, unit: 'currency' });
  if (a2c.taxSavings !== pa2c.taxSavings) a2cChanges.push({ field: 'taxSavings', label: 'Tax Savings', before: pa2c.taxSavings, after: a2c.taxSavings, unit: 'currency' });
  if (a2c.estateReduction !== pa2c.estateReduction) a2cChanges.push({ field: 'estateReduction', label: 'Estate Tax Reduction', before: pa2c.estateReduction, after: a2c.estateReduction, unit: 'currency' });
  if (a2c.incomeBoost !== pa2c.incomeBoost) a2cChanges.push({ field: 'incomeBoost', label: 'Income Boost', before: pa2c.incomeBoost, after: a2c.incomeBoost, unit: 'currency' });
  if (a2c.netWorthBoost !== pa2c.netWorthBoost) a2cChanges.push({ field: 'netWorthBoost', label: 'Net Worth Impact', before: pa2c.netWorthBoost, after: a2c.netWorthBoost, unit: 'currency' });

  if (a2cChanges.length > 0) {
    entries.push({
      id: `a2c-${now}`,
      timestamp: now,
      source: 'advanced',
      target: 'client',
      direction: 'advanced→client',
      changes: a2cChanges,
      holisticScoreBefore: prevBridge.holisticScore,
      holisticScoreAfter: currBridge.holisticScore,
      summary: `${a2cChanges.length} field${a2cChanges.length > 1 ? 's' : ''} cascaded from Advanced to Client`,
    });
  }

  // Practice → Client changes (if enabled)
  if (practiceCascade.enabled && currBridge.practiceManagement) {
    const p2cChanges: CascadeFieldChange[] = [];
    const pm = currBridge.practiceManagement;
    const ppm = prevBridge.practiceManagement;
    if (ppm) {
      if (pm.incomeFromPractice !== ppm.incomeFromPractice) p2cChanges.push({ field: 'incomeFromPractice', label: 'Practice Income', before: ppm.incomeFromPractice, after: pm.incomeFromPractice, unit: 'currency' });
      if (pm.practiceEquity !== ppm.practiceEquity) p2cChanges.push({ field: 'practiceEquity', label: 'Practice Equity', before: ppm.practiceEquity, after: pm.practiceEquity, unit: 'currency' });
      if (pm.benefitsCostOffset !== ppm.benefitsCostOffset) p2cChanges.push({ field: 'benefitsCostOffset', label: 'Benefits Offset', before: ppm.benefitsCostOffset, after: pm.benefitsCostOffset, unit: 'currency' });
      if (pm.practiceScore !== ppm.practiceScore) p2cChanges.push({ field: 'practiceScore', label: 'Practice Score', before: ppm.practiceScore, after: pm.practiceScore, unit: 'score' });
    }
    if (p2cChanges.length > 0) {
      entries.push({
        id: `p2c-${now}`,
        timestamp: now,
        source: 'practice',
        target: 'client',
        direction: 'practice→client',
        changes: p2cChanges,
        holisticScoreBefore: prevBridge.holisticScore,
        holisticScoreAfter: currBridge.holisticScore,
        summary: `${p2cChanges.length} field${p2cChanges.length > 1 ? 's' : ''} cascaded from Practice to Client`,
      });
    }
  }

  // Score changes
  if (currBridge.holisticScore !== prevBridge.holisticScore) {
    const scoreChanges: CascadeFieldChange[] = [
      { field: 'holisticScore', label: 'Holistic Score', before: prevBridge.holisticScore, after: currBridge.holisticScore, unit: 'score' },
      { field: 'clientHubScore', label: 'Client Hub Score', before: prevBridge.clientHubScore, after: currBridge.clientHubScore, unit: 'score' },
      { field: 'advancedHubScore', label: 'Advanced Hub Score', before: prevBridge.advancedHubScore, after: currBridge.advancedHubScore, unit: 'score' },
    ];
    if (currBridge.practiceHubScore !== prevBridge.practiceHubScore) {
      scoreChanges.push({ field: 'practiceHubScore', label: 'Practice Hub Score', before: prevBridge.practiceHubScore, after: currBridge.practiceHubScore, unit: 'score' });
    }
    entries.push({
      id: `score-${now}`,
      timestamp: now,
      source: currBridge.cascadeDirection === 'client→advanced' ? 'client' : 'advanced',
      target: currBridge.cascadeDirection === 'client→advanced' ? 'advanced' : 'client',
      direction: 'score-update',
      changes: scoreChanges.filter(c => c.before !== c.after),
      holisticScoreBefore: prevBridge.holisticScore,
      holisticScoreAfter: currBridge.holisticScore,
      summary: `Holistic Score: ${prevBridge.holisticScore} → ${currBridge.holisticScore}`,
    });
  }

  return entries;
}

/* ─── Main Component ─── */
interface CascadeAuditTrailProps {
  entries: CascadeAuditEntry[];
  onClear: () => void;
}

export function CascadeAuditTrail({ entries, onClear }: CascadeAuditTrailProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterSource, setFilterSource] = useState<CascadeSource | 'all'>('all');

  const filtered = useMemo(() => {
    if (filterSource === 'all') return entries;
    return entries.filter(e => e.source === filterSource || e.target === filterSource);
  }, [entries, filterSource]);

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (entries.length === 0) {
    return (
      <Card className="bg-card/60 border-border">
        <CardContent className="py-6 text-center">
          <Clock className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No cascade events yet. Changes between hubs will appear here as a timestamped audit trail.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/60 border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Cascade Audit Trail
            <Badge variant="outline" className="text-[10px]">{entries.length} events</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Filter className="w-3 h-3 text-muted-foreground" />
              {(['all', 'client', 'advanced', 'practice'] as const).map(f => (
                <Button
                  key={f}
                  size="sm"
                  variant={filterSource === f ? 'default' : 'ghost'}
                  className="h-6 text-[10px] px-2"
                  onClick={() => setFilterSource(f)}
                >
                  {f === 'all' ? 'All' : SOURCE_META[f].label}
                </Button>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2 text-muted-foreground" onClick={onClear}>
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 max-h-[400px] overflow-y-auto">
        {filtered.map(entry => {
          const isExpanded = expandedIds.has(entry.id);
          const time = new Date(entry.timestamp);
          const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          const scoreDelta = entry.holisticScoreAfter - entry.holisticScoreBefore;

          return (
            <div key={entry.id} className="border border-border/50 rounded-md overflow-hidden">
              {/* Header row */}
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                onClick={() => toggleExpand(entry.id)}
              >
                {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                <span className="text-[10px] text-muted-foreground font-mono">{timeStr}</span>
                <Badge variant="outline" className={`text-[9px] ${SOURCE_META[entry.source].color}`}>
                  {SOURCE_META[entry.source].label}
                </Badge>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <Badge variant="outline" className={`text-[9px] ${SOURCE_META[entry.target].color}`}>
                  {SOURCE_META[entry.target].label}
                </Badge>
                <span className="text-xs text-foreground flex-1 truncate">{entry.summary}</span>
                {scoreDelta !== 0 && (
                  <Badge variant="outline" className={`text-[9px] ${scoreDelta > 0 ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30'}`}>
                    Score {scoreDelta > 0 ? '+' : ''}{scoreDelta}
                  </Badge>
                )}
              </button>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-2 border-t border-border/30">
                  <table className="w-full text-[11px] mt-2">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="text-left py-1 font-medium">Field</th>
                        <th className="text-right py-1 font-medium">Before</th>
                        <th className="text-center py-1 font-medium w-8"></th>
                        <th className="text-right py-1 font-medium">After</th>
                        <th className="text-right py-1 font-medium">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.changes.map(ch => {
                        const delta = ch.after - ch.before;
                        return (
                          <tr key={ch.field} className="border-t border-border/20">
                            <td className="py-1 text-foreground">{ch.label}</td>
                            <td className="text-right py-1 text-muted-foreground">{formatValue(ch.before, ch.unit)}</td>
                            <td className="text-center py-1">
                              <span className={changeColor(ch.before, ch.after)}>{changeIcon(ch.before, ch.after)}</span>
                            </td>
                            <td className="text-right py-1 text-foreground font-medium">{formatValue(ch.after, ch.unit)}</td>
                            <td className={`text-right py-1 font-medium ${changeColor(ch.before, ch.after)}`}>
                              {ch.unit === 'currency' ? (delta >= 0 ? '+' : '') + fmtSm(delta) :
                               ch.unit === 'percent' ? (delta >= 0 ? '+' : '') + delta.toFixed(1) + '%' :
                               (delta >= 0 ? '+' : '') + Math.round(delta)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
