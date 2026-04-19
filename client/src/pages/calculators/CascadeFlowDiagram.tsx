/**
 * CascadeFlowDiagram — Cross-hub data flow visualization (Gap 7).
 *
 * Shows how data cascades between the three main hubs:
 *   Client Wealth Hub → Advanced Strategies Hub → Practice Management Hub
 *
 * Each node shows the hub name, key metrics, and directional arrows
 * illustrate which values flow downstream. Highlights active cascade
 * connections with animated indicators.
 */
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowDown, Zap, TrendingUp, Shield, Briefcase, Users, DollarSign } from 'lucide-react';
import { fmt, pct } from '@/lib/format';

interface CascadeNode {
  id: string;
  label: string;
  icon: React.ReactNode;
  color: string;
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
}

export function CascadeFlowDiagram({ weData }: Props) {
  const { nodes, edges } = useMemo(() => {
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

    const nodes: CascadeNode[] = [
      {
        id: 'client',
        label: 'Client Wealth Hub',
        icon: <Shield className="w-5 h-5" />,
        color: 'border-blue-500/50 bg-blue-500/5',
        metrics: [
          { label: 'Total Income', value: fmt(totalIncome), flows: true },
          { label: 'Net Worth', value: fmt(netWorth), flows: true },
          { label: 'Protection Gap', value: fmt(protectionGap), flows: true },
          { label: 'Retirement Gap', value: fmt(retirementGap), flows: true },
        ],
      },
      {
        id: 'advanced',
        label: 'Advanced Strategies Hub',
        icon: <TrendingUp className="w-5 h-5" />,
        color: 'border-amber-500/50 bg-amber-500/5',
        metrics: [
          { label: 'Premium Finance', value: fmt(pfFace), flows: true },
          { label: 'ILIT Death Benefit', value: fmt(ilDB), flows: true },
          { label: 'Exec Comp Salary', value: fmt(exSal), flows: true },
          { label: 'Strategies Active', value: String((pfFace > 0 ? 1 : 0) + (ilDB > 0 ? 1 : 0) + (exSal > 0 ? 1 : 0)) },
        ],
      },
      {
        id: 'practice',
        label: 'Practice Management Hub',
        icon: <Users className="w-5 h-5" />,
        color: 'border-emerald-500/50 bg-emerald-500/5',
        metrics: [
          { label: 'Target GDC', value: fmt(ppTargetGDC) },
          { label: 'Team Size', value: String(ppTeamCount) },
          { label: 'Role', value: weData.ppRole || 'N/A' },
        ],
      },
    ];

    const edges: CascadeEdge[] = [
      {
        from: 'client',
        to: 'advanced',
        label: 'Client needs drive strategy selection',
        values: [
          protectionGap > 0 ? `Protection gap ${fmt(protectionGap)} → Premium Finance / ILIT` : '',
          retirementGap > 0 ? `Retirement gap ${fmt(retirementGap)} → IUL / Annuity strategies` : '',
          totalIncome > 250000 ? `High income ${fmt(totalIncome)} → Exec Comp / Tax strategies` : '',
        ].filter(Boolean),
      },
      {
        from: 'advanced',
        to: 'practice',
        label: 'Strategy premiums feed practice revenue',
        values: [
          pfFace > 0 ? `Premium Finance face ${fmt(pfFace)} → Commission revenue` : '',
          ilDB > 0 ? `ILIT DB ${fmt(ilDB)} → Insurance production` : '',
          exSal > 0 ? `Exec Comp ${fmt(exSal)} → Advisory fees` : '',
        ].filter(Boolean),
      },
      {
        from: 'practice',
        to: 'client',
        label: 'Practice capacity enables client service',
        values: [
          ppTeamCount > 0 ? `${ppTeamCount} team members → Client capacity` : '',
          ppTargetGDC > 0 ? `Target GDC ${fmt(ppTargetGDC)} → Growth investment` : '',
        ].filter(Boolean),
      },
    ];

    return { nodes, edges };
  }, [weData]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Cascade Flow Diagram
          <Badge variant="outline" className="text-xs">How data flows between hubs</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Flow diagram */}
        <div className="space-y-3">
          {nodes.map((node, idx) => (
            <div key={node.id}>
              {/* Node */}
              <div className={`border rounded-lg p-4 ${node.color}`}>
                <div className="flex items-center gap-2 mb-2">
                  {node.icon}
                  <span className="font-semibold text-sm">{node.label}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {node.metrics.map(m => (
                    <div key={m.label} className="text-center">
                      <div className={`text-sm font-bold ${m.flows ? 'text-primary' : ''}`}>{m.value}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {m.label}
                        {m.flows && <span className="text-primary ml-0.5">↓</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Edge (arrow + label) */}
              {idx < edges.length && (
                <div className="flex items-start gap-3 py-2 pl-6">
                  <div className="flex flex-col items-center">
                    <ArrowDown className="w-4 h-4 text-primary animate-pulse" />
                    <div className="w-px h-full bg-primary/20" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{edges[idx].label}</p>
                    {edges[idx].values.length > 0 ? (
                      <div className="space-y-0.5 mt-1">
                        {edges[idx].values.map((v, i) => (
                          <p key={i} className="text-[10px] text-primary/80 flex items-center gap-1">
                            <ArrowRight className="w-2.5 h-2.5 shrink-0" />
                            {v}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground/50 mt-1">No active data flow — enter values above to see connections</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="border-t pt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="text-primary">↓</span> Flows downstream</span>
          <span className="flex items-center gap-1"><ArrowDown className="w-3 h-3 text-primary animate-pulse" /> Active connection</span>
          <span>Enter values in each hub to see how they cascade through the system</span>
        </div>
      </CardContent>
    </Card>
  );
}
