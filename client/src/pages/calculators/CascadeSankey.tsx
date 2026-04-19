/* ═══════════════════════════════════════════════════════════════
   CascadeSankey — SVG Sankey diagram showing dollar flows
   between Client Hub → Advanced Hub → Practice Hub in real-time
   ═══════════════════════════════════════════════════════════════ */
import React, { useMemo } from 'react';
import { useWealthEngine } from '@/contexts/WealthEngineContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { fmtSm as fmt, pct } from './format';

interface FlowLink {
  source: string;
  target: string;
  value: number;
  label: string;
  color: string;
}

interface HubNode {
  id: string;
  label: string;
  score: number;
  color: string;
  x: number;
  y: number;
  height: number;
}

/* ── Color palette ── */
const COLORS = {
  client: { bg: '#2563eb', flow: 'rgba(37,99,235,0.25)', border: '#3b82f6' },
  advanced: { bg: '#7c3aed', flow: 'rgba(124,58,237,0.25)', border: '#8b5cf6' },
  practice: { bg: '#059669', flow: 'rgba(5,150,105,0.25)', border: '#10b981' },
  holistic: '#f59e0b',
};

export function CascadeSankey({ compact = false }: { compact?: boolean }) {
  const we = useWealthEngine();
  const hb = we.holisticBridge;
  const ac = we.advancedCascade;
  const pc = we.practiceCascade;

  /* ── Build flow links from cascade data ── */
  const flows = useMemo<FlowLink[]>(() => {
    const links: FlowLink[] = [];
    const c2a = hb.clientToAdvanced;
    const a2c = hb.advancedToClient;

    // Client → Advanced flows
    if (c2a.incomeForSizing > 0) links.push({ source: 'client', target: 'advanced', value: c2a.incomeForSizing, label: 'Income → Strategy Sizing', color: COLORS.client.flow });
    if (c2a.estateForILIT > 0) links.push({ source: 'client', target: 'advanced', value: c2a.estateForILIT, label: 'Estate → ILIT Sizing', color: COLORS.client.flow });
    if (c2a.protectionGap > 0) links.push({ source: 'client', target: 'advanced', value: c2a.protectionGap, label: 'Protection Gap → Business Planning', color: COLORS.client.flow });
    if (c2a.taxBurden > 0) links.push({ source: 'client', target: 'advanced', value: c2a.taxBurden, label: 'Tax Burden → Charitable Strategy', color: COLORS.client.flow });
    if (c2a.retirementGap > 0) links.push({ source: 'client', target: 'advanced', value: c2a.retirementGap, label: 'Retirement Gap → CRT Income', color: COLORS.client.flow });

    // Advanced → Client flows
    if (a2c.additionalProtection > 0) links.push({ source: 'advanced', target: 'client', value: a2c.additionalProtection, label: 'Additional Protection', color: COLORS.advanced.flow });
    if (a2c.taxSavings > 0) links.push({ source: 'advanced', target: 'client', value: a2c.taxSavings, label: 'Tax Savings', color: COLORS.advanced.flow });
    if (a2c.estateReduction > 0) links.push({ source: 'advanced', target: 'client', value: a2c.estateReduction, label: 'Estate Tax Reduction', color: COLORS.advanced.flow });
    if (a2c.incomeBoost > 0) links.push({ source: 'advanced', target: 'client', value: a2c.incomeBoost, label: 'Income Boost', color: COLORS.advanced.flow });
    if (a2c.netWorthBoost > 0) links.push({ source: 'advanced', target: 'client', value: a2c.netWorthBoost, label: 'Net Worth Impact', color: COLORS.advanced.flow });

    // Practice → Client flows (if enabled)
    if (pc.enabled) {
      if ((pc.practiceToClient?.incomeFromPractice ?? 0) > 0) links.push({ source: 'practice', target: 'client', value: pc.practiceToClient!.incomeFromPractice, label: 'Practice Income', color: COLORS.practice.flow });
      if (pc.practiceToClient?.benefitsCostOffset > 0) links.push({ source: 'practice', target: 'client', value: pc.practiceToClient.benefitsCostOffset, label: 'Benefits Offset', color: COLORS.practice.flow });
      if (pc.practiceToClient?.practiceEquity > 0) links.push({ source: 'practice', target: 'client', value: pc.practiceToClient.practiceEquity, label: 'Practice Equity', color: COLORS.practice.flow });
    }

    return links;
  }, [hb, ac, pc]);

  /* ── Build hub nodes ── */
  const totalFlow = useMemo(() => Math.max(1, flows.reduce((s, f) => s + f.value, 0)), [flows]);

  const nodes = useMemo<HubNode[]>(() => {
    const W = compact ? 600 : 800;
    const H = compact ? 280 : 380;
    const nodeW = compact ? 100 : 130;
    const pad = 20;

    // Client hub (left)
    const clientFlows = flows.filter(f => f.source === 'client').reduce((s, f) => s + f.value, 0) +
                        flows.filter(f => f.target === 'client').reduce((s, f) => s + f.value, 0);
    const clientH = Math.max(60, (clientFlows / totalFlow) * (H - 2 * pad) * 0.8 + 60);

    // Advanced hub (center)
    const advFlows = flows.filter(f => f.source === 'advanced' || f.target === 'advanced').reduce((s, f) => s + f.value, 0);
    const advH = Math.max(60, (advFlows / totalFlow) * (H - 2 * pad) * 0.8 + 60);

    // Practice hub (right, if enabled)
    const pracFlows = flows.filter(f => f.source === 'practice' || f.target === 'practice').reduce((s, f) => s + f.value, 0);
    const pracH = Math.max(50, (pracFlows / totalFlow) * (H - 2 * pad) * 0.8 + 50);

    const result: HubNode[] = [
      { id: 'client', label: 'Client Hub', score: hb.clientHubScore, color: COLORS.client.bg, x: pad, y: (H - clientH) / 2, height: clientH },
      { id: 'advanced', label: 'Advanced Hub', score: hb.advancedHubScore, color: COLORS.advanced.bg, x: (W - nodeW) / 2, y: (H - advH) / 2, height: advH },
    ];
    if (pc.enabled) {
      result.push({ id: 'practice', label: 'Practice Hub', score: hb.practiceHubScore, color: COLORS.practice.bg, x: W - nodeW - pad, y: (H - pracH) / 2, height: pracH });
    }
    return result;
  }, [flows, totalFlow, hb, pc, compact]);

  const W = compact ? 600 : 800;
  const H = compact ? 280 : 380;
  const nodeW = compact ? 100 : 130;

  /* ── Render flow paths ── */
  const renderFlows = useMemo(() => {
    const sourceNode = (id: string) => nodes.find(n => n.id === id);
    const sourceOffsets: Record<string, number> = {};
    const targetOffsets: Record<string, number> = {};

    return flows.map((flow, i) => {
      const src = sourceNode(flow.source);
      const tgt = sourceNode(flow.target);
      if (!src || !tgt) return null;

      const thickness = Math.max(3, (flow.value / totalFlow) * (compact ? 40 : 60));
      const srcKey = flow.source;
      const tgtKey = flow.target;
      sourceOffsets[srcKey] = (sourceOffsets[srcKey] || 0);
      targetOffsets[tgtKey] = (targetOffsets[tgtKey] || 0);

      const srcY = src.y + src.height * 0.2 + sourceOffsets[srcKey];
      const tgtY = tgt.y + tgt.height * 0.2 + targetOffsets[tgtKey];
      sourceOffsets[srcKey] += thickness + 4;
      targetOffsets[tgtKey] += thickness + 4;

      const srcX = src.x + nodeW;
      const tgtX = tgt.x;
      const midX = (srcX + tgtX) / 2;

      // Bezier curve
      const d = `M ${srcX} ${srcY} C ${midX} ${srcY}, ${midX} ${tgtY}, ${tgtX} ${tgtY}`;

      return (
        <TooltipProvider key={i}>
          <Tooltip>
            <TooltipTrigger asChild>
              <path
                d={d}
                fill="none"
                stroke={flow.color}
                strokeWidth={thickness}
                strokeLinecap="round"
                className="transition-all duration-300 hover:opacity-80"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))' }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-card text-card-foreground border">
              <p className="font-semibold">{flow.label}</p>
              <p className="text-sm text-muted-foreground">{fmt(flow.value)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    });
  }, [flows, nodes, totalFlow, compact]);

  const hasFlows = flows.length > 0;

  if (!hasFlows && compact) return null;

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h4v8H2V4zm8 2h4v6h-4V6z" fill="currentColor" opacity="0.3"/><path d="M6 6l2 2m0 0l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Cascade Flow Diagram
          </CardTitle>
          <Badge variant="outline" className="text-xs" style={{ borderColor: COLORS.holistic, color: COLORS.holistic }}>
            Holistic Score: {hb.holisticScore.toFixed(0)}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {!hasFlows ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <p>No cascade flows detected yet.</p>
            <p className="mt-1">Adjust strategy allocations in the Advanced Strategies Hub to see dollar flows.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="mx-auto">
              {/* Flow paths */}
              {renderFlows}

              {/* Hub nodes */}
              {nodes.map(node => (
                <g key={node.id}>
                  <rect
                    x={node.x} y={node.y}
                    width={nodeW} height={node.height}
                    rx={8} ry={8}
                    fill={node.color}
                    opacity={0.9}
                    className="transition-all duration-300"
                    style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}
                  />
                  <text
                    x={node.x + nodeW / 2} y={node.y + 22}
                    textAnchor="middle" fill="white" fontSize={compact ? 11 : 13} fontWeight="600"
                  >
                    {node.label}
                  </text>
                  <text
                    x={node.x + nodeW / 2} y={node.y + 40}
                    textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={compact ? 10 : 11}
                  >
                    Score: {node.score.toFixed(0)}/100
                  </text>
                  {/* Weight indicator */}
                  <text
                    x={node.x + nodeW / 2} y={node.y + node.height - 8}
                    textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={9}
                  >
                    Weight: {pct(hb.weights[node.id as keyof typeof hb.weights] || 0)}
                  </text>
                </g>
              ))}

              {/* Direction arrows */}
              {hb.cascadeDirection !== 'none' && (
                <g>
                  {(hb.cascadeDirection === 'client→advanced' || hb.cascadeDirection === 'bidirectional') && (
                    <text x={W / 2 - (pc.enabled ? 80 : 0)} y={H - 10} textAnchor="middle" fill="currentColor" fontSize={10} opacity={0.5}>
                      Client → Advanced {hb.cascadeDirection === 'bidirectional' ? '↔' : '→'}
                    </text>
                  )}
                  {hb.cascadeDirection === 'advanced→client' && (
                    <text x={W / 2} y={H - 10} textAnchor="middle" fill="currentColor" fontSize={10} opacity={0.5}>
                      Advanced → Client
                    </text>
                  )}
                </g>
              )}
            </svg>

            {/* Flow legend */}
            <div className={`mt-3 grid ${compact ? 'grid-cols-2' : 'grid-cols-3'} gap-2 text-xs`}>
              {flows.slice(0, compact ? 4 : 6).map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                  <div className="w-3 h-1.5 rounded-full" style={{ backgroundColor: f.source === 'client' ? COLORS.client.bg : f.source === 'advanced' ? COLORS.advanced.bg : COLORS.practice.bg }} />
                  <span className="truncate">{f.label}: {fmt(f.value)}</span>
                </div>
              ))}
              {flows.length > (compact ? 4 : 6) && (
                <div className="text-muted-foreground/60">+{flows.length - (compact ? 4 : 6)} more flows</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CascadeSankey;
