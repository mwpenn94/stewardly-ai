/**
 * CascadeFlowDiagram — Cross-hub data flow visualization (Gap 7).
 *
 * Enhanced v2: 6 hubs in a 2-row SVG grid with animated edge connections.
 *   Row 1: Client Wealth Hub → Advanced Strategies Hub → Practice Management Hub
 *   Row 2: Compliance & Audit → Financial Data Hub → Unified Plan View
 *
 * Each node shows the hub name, key metrics, and directional arrows
 * illustrate which values flow downstream. Clicking a node navigates
 * to that hub panel. Highlights active cascade connections with
 * animated indicators.
 */
import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowRight, Zap, TrendingUp, Shield, Users, ExternalLink,
  Wallet, BarChart3, Target, Info, Layers
} from 'lucide-react';
import { fmt } from '@/lib/format';

interface HubNode {
  id: string;
  panelId: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  colorClass: string;
  accentColor: string;
  x: number;
  y: number;
  activeCount: number;
  metrics: Array<{ label: string; value: string; flows?: boolean }>;
}

interface CascadeEdge {
  from: string;
  to: string;
  label: string;
  values: string[];
}

interface Props {
  weData: Record<string, any>;
  onNavigateToPanel?: (panelId: string) => void;
}

// ─── SVG Edge ──────────────────────────────────────────────────
function FlowEdge({
  from,
  to,
  isActive,
  isHighlighted,
  onClick,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  isActive: boolean;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  const W = 240, H = 100;
  const fromCx = from.x + W / 2;
  const fromCy = from.y + H / 2;
  const toCx = to.x + W / 2;
  const toCy = to.y + H / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;
  const cx1 = fromCx + dx * 0.35;
  const cy1 = fromCy + dy * 0.1;
  const cx2 = toCx - dx * 0.35;
  const cy2 = toCy - dy * 0.1;

  const path = `M ${fromCx} ${fromCy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${toCx} ${toCy}`;

  const strokeColor = isHighlighted
    ? 'oklch(0.75 0.18 85)'
    : isActive
      ? 'oklch(0.6 0.12 160 / 0.6)'
      : 'oklch(0.45 0.03 250 / 0.25)';

  return (
    <g onClick={onClick} className="cursor-pointer" role="button" tabIndex={-1}>
      <path d={path} fill="none" stroke="transparent" strokeWidth={16} />
      <path
        d={path}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isHighlighted ? 2.5 : isActive ? 2 : 1.2}
        strokeDasharray={isHighlighted ? 'none' : isActive ? '8 4' : '4 6'}
        className="transition-all duration-300"
      >
        {(isActive || isHighlighted) && !isHighlighted && (
          <animate attributeName="stroke-dashoffset" from="0" to="-24" dur="1.5s" repeatCount="indefinite" />
        )}
      </path>
      <circle
        cx={toCx}
        cy={toCy}
        r={isHighlighted ? 5 : isActive ? 4 : 2.5}
        fill={strokeColor}
        className="transition-all duration-300"
      />
    </g>
  );
}

export function CascadeFlowDiagram({ weData, onNavigateToPanel }: Props) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const { nodes, edges, totalFlows } = useMemo(() => {
    const totalIncome = (weData.salary || 0) + (weData.bonus || 0) + (weData.rentalIncome || 0);
    const netWorth = (weData.savings || 0) + (weData.investments || 0) + (weData.homeValue || 0)
      - (weData.mortgage || 0) - (weData.otherDebt || 0);
    const protectionGap = Math.max(0, totalIncome * 10 - (weData.lifeInsurance || 0));
    const retirementGap = Math.max(0, (weData.retireGoal || 0) - (weData.retireSaved || 0));

    const pfFace = weData.pfFace || 0;
    const ilDB = weData.ilDB || 0;
    const exSal = weData.exSal || 0;

    const ppTargetGDC = weData.ppTargetGDC || 0;
    const ppTeamCount = (weData.ppTeamMembers || []).length;

    const clientActive = [totalIncome, netWorth, protectionGap, retirementGap].filter(v => v > 0).length;
    const advancedActive = [pfFace, ilDB, exSal].filter(v => v > 0).length;
    const practiceActive = [ppTargetGDC, ppTeamCount].filter(v => v > 0).length;

    // Row 1: x positions at 20, 290, 560 | y = 10
    // Row 2: x positions at 20, 290, 560 | y = 150
    const nodes: HubNode[] = [
      {
        id: 'client', panelId: 'client-wealth-hub',
        label: 'Client Wealth Hub', shortLabel: 'Wealth',
        icon: <Wallet className="w-4 h-4" />,
        colorClass: 'border-blue-500/50 bg-blue-500/8',
        accentColor: 'oklch(0.65 0.18 250)',
        x: 20, y: 10, activeCount: clientActive,
        metrics: [
          { label: 'Income', value: fmt(totalIncome), flows: true },
          { label: 'Net Worth', value: fmt(netWorth), flows: true },
          { label: 'Protection Gap', value: fmt(protectionGap), flows: true },
        ],
      },
      {
        id: 'advanced', panelId: 'advanced-strategies-hub',
        label: 'Advanced Strategies', shortLabel: 'Strategies',
        icon: <TrendingUp className="w-4 h-4" />,
        colorClass: 'border-amber-500/50 bg-amber-500/8',
        accentColor: 'oklch(0.75 0.18 85)',
        x: 290, y: 10, activeCount: advancedActive,
        metrics: [
          { label: 'Prem Finance', value: fmt(pfFace), flows: true },
          { label: 'ILIT DB', value: fmt(ilDB), flows: true },
          { label: 'Exec Comp', value: fmt(exSal), flows: true },
        ],
      },
      {
        id: 'practice', panelId: 'practice',
        label: 'Practice Management', shortLabel: 'Practice',
        icon: <Users className="w-4 h-4" />,
        colorClass: 'border-emerald-500/50 bg-emerald-500/8',
        accentColor: 'oklch(0.65 0.15 160)',
        x: 560, y: 10, activeCount: practiceActive,
        metrics: [
          { label: 'Target GDC', value: fmt(ppTargetGDC) },
          { label: 'Team', value: String(ppTeamCount) },
          { label: 'Role', value: weData.ppRole || 'N/A' },
        ],
      },
      {
        id: 'compliance', panelId: 'compliance-checklist',
        label: 'Compliance & Audit', shortLabel: 'Compliance',
        icon: <Shield className="w-4 h-4" />,
        colorClass: 'border-red-500/30 bg-red-500/5',
        accentColor: 'oklch(0.65 0.15 25)',
        x: 20, y: 150, activeCount: clientActive > 0 ? 1 : 0,
        metrics: [
          { label: 'Suitability', value: clientActive > 0 ? 'Active' : 'Pending' },
          { label: 'Reg BI', value: 'Required' },
          { label: 'Audit', value: 'Tracked' },
        ],
      },
      {
        id: 'financial-data', panelId: 'financial-data-hub',
        label: 'Financial Data Hub', shortLabel: 'Data',
        icon: <BarChart3 className="w-4 h-4" />,
        colorClass: 'border-purple-500/30 bg-purple-500/5',
        accentColor: 'oklch(0.60 0.20 290)',
        x: 290, y: 150, activeCount: 1,
        metrics: [
          { label: 'FRED', value: 'Live' },
          { label: 'Treasury', value: 'Live' },
          { label: 'CPI', value: 'Live' },
        ],
      },
      {
        id: 'unified-plan', panelId: 'planning-hierarchy',
        label: 'Unified Plan View', shortLabel: 'Plan',
        icon: <Target className="w-4 h-4" />,
        colorClass: 'border-cyan-500/30 bg-cyan-500/5',
        accentColor: 'oklch(0.70 0.12 200)',
        x: 560, y: 150, activeCount: (clientActive + advancedActive) > 0 ? 1 : 0,
        metrics: [
          { label: 'Hubs Linked', value: String([clientActive, advancedActive, practiceActive].filter(v => v > 0).length) },
          { label: 'Actions', value: clientActive > 0 ? 'Generated' : 'Pending' },
          { label: 'Status', value: clientActive > 0 ? 'Active' : 'Setup' },
        ],
      },
    ];

    const edges: CascadeEdge[] = [
      {
        from: 'client', to: 'advanced',
        label: 'Client needs drive strategy selection',
        values: [
          protectionGap > 0 ? `Protection gap ${fmt(protectionGap)} → Premium Finance / ILIT` : '',
          retirementGap > 0 ? `Retirement gap ${fmt(retirementGap)} → IUL / Annuity strategies` : '',
          totalIncome > 250000 ? `High income ${fmt(totalIncome)} → Exec Comp / Tax strategies` : '',
        ].filter(Boolean),
      },
      {
        from: 'advanced', to: 'practice',
        label: 'Strategy premiums feed practice revenue',
        values: [
          pfFace > 0 ? `Premium Finance face ${fmt(pfFace)} → Commission revenue` : '',
          ilDB > 0 ? `ILIT DB ${fmt(ilDB)} → Insurance production` : '',
          exSal > 0 ? `Exec Comp ${fmt(exSal)} → Advisory fees` : '',
        ].filter(Boolean),
      },
      {
        from: 'client', to: 'compliance',
        label: 'Client profile feeds compliance checks',
        values: [
          clientActive > 0 ? 'Suitability data → Reg BI verification' : '',
          totalIncome > 0 ? 'Risk tolerance → Product suitability' : '',
        ].filter(Boolean),
      },
      {
        from: 'financial-data', to: 'client',
        label: 'Macro data adjusts projections',
        values: [
          'Interest rates → Projection assumptions',
          'Inflation → Future value adjustments',
        ],
      },
      {
        from: 'financial-data', to: 'advanced',
        label: 'Market conditions shape strategies',
        values: [
          'Rate environment → ILIT/GRAT timing',
          'Tax law changes → Strategy selection',
        ],
      },
      {
        from: 'client', to: 'unified-plan',
        label: 'Core profile anchors the plan',
        values: [
          clientActive > 0 ? 'Goals → Plan milestones' : '',
          netWorth !== 0 ? 'Gap analysis → Recommendations' : '',
        ].filter(Boolean),
      },
      {
        from: 'advanced', to: 'unified-plan',
        label: 'Strategies become plan actions',
        values: [
          advancedActive > 0 ? 'Selected strategies → Action items' : '',
          pfFace > 0 ? 'Tax savings → Plan projections' : '',
        ].filter(Boolean),
      },
      {
        from: 'compliance', to: 'unified-plan',
        label: 'Compliance gates plan delivery',
        values: [
          'Compliance status → Plan readiness',
          'Audit trail → Plan documentation',
        ],
      },
    ];

    const totalFlows = edges.reduce((sum, e) => sum + e.values.length, 0);
    return { nodes, edges, totalFlows };
  }, [weData]);

  const selectedHub = useMemo(() => nodes.find(n => n.id === selectedNode), [nodes, selectedNode]);
  const selectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter(e => e.from === selectedNode || e.to === selectedNode);
  }, [selectedNode, edges]);

  const handleNodeClick = useCallback((hub: HubNode) => {
    if (selectedNode === hub.id) {
      onNavigateToPanel?.(hub.panelId);
    } else {
      setSelectedNode(hub.id);
    }
  }, [selectedNode, onNavigateToPanel]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Cascade Data Flow
            <Badge variant="outline" className="text-xs">
              {totalFlows > 0 ? `${totalFlows} active flow${totalFlows !== 1 ? 's' : ''}` : '6 hubs connected'}
            </Badge>
          </CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="About cascade flow">
                <Info className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-[240px]">
              <p className="text-xs">
                Click a hub to see its data connections. Double-click to navigate.
                Animated dashes show active data flow between hubs.
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* SVG Diagram */}
        <div className="relative w-full overflow-x-auto">
          <svg
            viewBox="0 0 820 280"
            className="w-full h-auto min-w-[500px]"
            role="img"
            aria-label="Cascade data flow diagram showing connections between 6 platform hubs"
          >
            <defs>
              <pattern id="cascade-grid-v2" width="30" height="30" patternUnits="userSpaceOnUse">
                <path d="M 30 0 L 0 0 0 30" fill="none" stroke="oklch(0.3 0.01 250 / 0.12)" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="820" height="280" fill="url(#cascade-grid-v2)" rx="8" />

            {/* Edges (behind nodes) */}
            {edges.map((edge) => {
              const fromNode = nodes.find(n => n.id === edge.from)!;
              const toNode = nodes.find(n => n.id === edge.to)!;
              const edgeKey = `${edge.from}-${edge.to}`;
              const isHighlighted = selectedNode === edge.from || selectedNode === edge.to;
              return (
                <FlowEdge
                  key={edgeKey}
                  from={fromNode}
                  to={toNode}
                  isActive={edge.values.length > 0}
                  isHighlighted={isHighlighted}
                  onClick={() => setSelectedNode(selectedNode === edge.from ? edge.to : edge.from)}
                />
              );
            })}

            {/* Nodes */}
            {nodes.map((hub) => {
              const isSelected = selectedNode === hub.id;
              return (
                <foreignObject
                  key={hub.id}
                  x={hub.x}
                  y={hub.y}
                  width={240}
                  height={100}
                  className="cursor-pointer"
                  onClick={() => handleNodeClick(hub)}
                >
                  <div
                    className={`w-full h-full rounded-xl border-2 p-2.5 transition-all duration-200 ${hub.colorClass} ${
                      isSelected ? 'shadow-lg ring-1 ring-primary/30 scale-[1.02]' : 'shadow-sm hover:shadow-md hover:scale-[1.01]'
                    }`}
                    role="button"
                    aria-label={`${hub.label} — click to select, double-click to navigate`}
                    tabIndex={0}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      {hub.icon}
                      <span className="text-xs font-semibold truncate">{hub.shortLabel}</span>
                      {hub.activeCount > 0 && (
                        <Badge variant="secondary" className="text-[8px] px-1 py-0 h-3.5 ml-auto">
                          {hub.activeCount} active
                        </Badge>
                      )}
                      <ExternalLink className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 flex-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      {hub.metrics.map(m => (
                        <div key={m.label} className="text-center">
                          <div className={`text-[10px] font-bold truncate ${m.flows ? 'text-primary' : ''}`}>{m.value}</div>
                          <div className="text-[8px] text-muted-foreground truncate">{m.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </foreignObject>
              );
            })}
          </svg>
        </div>

        {/* Detail Panel */}
        {selectedHub && (
          <div className="p-3 rounded-lg border border-border/50 bg-secondary/20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                {selectedHub.icon}
                <div>
                  <h4 className="text-sm font-semibold">{selectedHub.label}</h4>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedEdges.length} connection{selectedEdges.length !== 1 ? 's' : ''} ·
                    {selectedHub.activeCount} active metric{selectedHub.activeCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => onNavigateToPanel?.(selectedHub.panelId)}
              >
                Open <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>

            {/* Connected edges with data flow details */}
            {selectedEdges.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Data Connections
                </span>
                {selectedEdges.map((edge) => {
                  const isOutgoing = edge.from === selectedNode;
                  const otherNode = nodes.find(n => n.id === (isOutgoing ? edge.to : edge.from))!;
                  return (
                    <div
                      key={`${edge.from}-${edge.to}`}
                      className="flex items-start gap-2 p-1.5 rounded-md bg-card/50"
                    >
                      <ArrowRight
                        className={`w-3 h-3 mt-0.5 flex-none ${isOutgoing ? 'text-primary' : 'text-muted-foreground rotate-180'}`}
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium">
                          {isOutgoing ? '→' : '←'} {otherNode.label}
                        </span>
                        {edge.values.length > 0 ? (
                          <div className="space-y-0.5 mt-0.5">
                            {edge.values.map((v, i) => (
                              <p key={i} className="text-[10px] text-primary/80 flex items-center gap-1">
                                <Zap className="w-2 h-2 shrink-0" />
                                {v}
                              </p>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                            No active data — enter values to see connections
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="border-t pt-2 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-primary/60 inline-block" style={{ borderTop: '2px dashed' }} /> Active flow
          </span>
          <span className="flex items-center gap-1">
            <span className="w-4 h-0.5 bg-muted-foreground/25 inline-block" style={{ borderTop: '1px dashed' }} /> Inactive
          </span>
          <span className="flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> Double-click to navigate
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
