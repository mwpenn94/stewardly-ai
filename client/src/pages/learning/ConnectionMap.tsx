/**
 * ConnectionMap.tsx — Interactive concept relationship graph
 *
 * Pass 119. Visualizes how concepts relate ACROSS disciplines using d3-force.
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { forceSimulation, forceLink, forceManyBody, forceCenter, forceCollide } from "d3-force";
import { select } from "d3-selection";
import { zoom as d3Zoom } from "d3-zoom";
import { drag as d3Drag } from "d3-drag";
import { Search, Volume2, X } from "lucide-react";
import { useAudioCompanion } from "@/components/AudioCompanion";
import { trpc } from "@/lib/trpc";

/* ── types ─────────────────────────────────────────────────────── */

interface ConceptNode {
  id: string;
  term: string;
  discipline: string;
  definition: string;
  mastered: boolean;
  audioScript?: string;
  // d3 adds x, y at runtime
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ConceptEdge {
  source: string | ConceptNode;
  target: string | ConceptNode;
  relationship: string;
  strength: number;
}

interface Props {
  nodes?: ConceptNode[];
  edges?: ConceptEdge[];
  onNodeClick?: (node: ConceptNode) => void;
}

const DISCIPLINE_COLORS: Record<string, string> = {
  "Estate Planning": "#D4A843",
  "Financial Planning": "#0EA5E9",
  "Insurance": "#10B981",
  "Investment": "#8B5CF6",
  "Premium Finance": "#F43F5E",
  "Securities": "#F59E0B",
  "Compliance": "#06B6D4",
  "Tax": "#EC4899",
};

function getColor(discipline: string): string {
  return DISCIPLINE_COLORS[discipline] || "#64748B";
}

const DEMO_NODES: ConceptNode[] = [
  { id: "1", term: "IUL", discipline: "Insurance", definition: "Indexed Universal Life — life insurance with cash value linked to market index performance.", mastered: true },
  { id: "2", term: "Estate Tax", discipline: "Estate Planning", definition: "Federal tax on the transfer of estate assets at death.", mastered: false },
  { id: "3", term: "SOFR", discipline: "Premium Finance", definition: "Secured Overnight Financing Rate — benchmark rate for premium financing.", mastered: true },
  { id: "4", term: "Reg BI", discipline: "Compliance", definition: "Regulation Best Interest — SEC rule requiring broker-dealers to act in clients' best interest.", mastered: false },
  { id: "5", term: "ILIT", discipline: "Estate Planning", definition: "Irrevocable Life Insurance Trust — removes life insurance from taxable estate.", mastered: true },
  { id: "6", term: "Fiduciary", discipline: "Investment", definition: "Legal obligation to act in another party's best interest.", mastered: false },
  { id: "7", term: "Series 7", discipline: "Securities", definition: "General Securities Representative license.", mastered: true },
  { id: "8", term: "CFP", discipline: "Financial Planning", definition: "Certified Financial Planner — comprehensive planning certification.", mastered: false },
];

const DEMO_EDGES: ConceptEdge[] = [
  { source: "1", target: "5", relationship: "funds", strength: 0.8 },
  { source: "5", target: "2", relationship: "reduces", strength: 0.9 },
  { source: "3", target: "1", relationship: "finances", strength: 0.7 },
  { source: "4", target: "6", relationship: "requires", strength: 0.6 },
  { source: "6", target: "8", relationship: "certifies", strength: 0.5 },
  { source: "7", target: "4", relationship: "governed by", strength: 0.6 },
  { source: "8", target: "2", relationship: "covers", strength: 0.4 },
];

export default function ConnectionMap({ nodes, edges, onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audio = useAudioCompanion();

  // Fetch definitions + connections from DB when no props provided
  const defsQ = trpc.learning.content.listDefinitions.useQuery(
    { limit: 200 },
    { enabled: !nodes, retry: false },
  );
  const connsQ = trpc.learning.content.listConnections.useQuery(
    undefined,
    { enabled: !edges, retry: false },
  );

  const dbNodes: ConceptNode[] = useMemo(() => {
    if (nodes) return nodes;
    const defs = defsQ.data ?? [];
    if (defs.length === 0) return DEMO_NODES;
    return defs.map((d: any) => ({
      id: String(d.id),
      term: d.term,
      discipline: d.category ?? "General",
      definition: d.definition ?? "",
      mastered: false,
      audioScript: `${d.term}. ${(d.definition ?? "").slice(0, 200)}`,
    }));
  }, [nodes, defsQ.data]);

  const dbEdges: ConceptEdge[] = useMemo(() => {
    if (edges) return edges;
    const conns = connsQ.data ?? [];
    if (conns.length === 0) return DEMO_EDGES;
    return conns.map((c: any) => ({
      source: String(c.fromDefinitionId),
      target: String(c.toDefinitionId),
      relationship: c.relationship ?? "relates to",
      strength: 0.6,
    }));
  }, [edges, connsQ.data]);

  const graphNodes = dbNodes;
  const graphEdges = dbEdges;

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNode, setSelectedNode] = useState<ConceptNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const highlightedIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    const matching = graphNodes.filter(n => n.term.toLowerCase().includes(q) || n.discipline.toLowerCase().includes(q));
    const ids = new Set(matching.map(n => n.id));
    graphEdges.forEach(e => {
      const sId = typeof e.source === "string" ? e.source : e.source.id;
      const tId = typeof e.target === "string" ? e.target : e.target.id;
      if (ids.has(sId)) ids.add(tId);
      if (ids.has(tId)) ids.add(sId);
    });
    return ids;
  }, [searchQuery, graphNodes, graphEdges]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(400, height) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || graphNodes.length === 0) return;

    const svg = select(svgRef.current);
    svg.selectAll("*").remove();

    const { width, height } = dimensions;
    const simNodes = graphNodes.map(n => ({ ...n, x: width / 2 + (Math.random() - 0.5) * 100, y: height / 2 + (Math.random() - 0.5) * 100 }));
    const simEdges = graphEdges.map(e => ({ ...e }));

    const simulation = forceSimulation(simNodes as any)
      .force("link", forceLink(simEdges as any).id((d: any) => d.id).distance(80).strength((d: any) => d.strength * 0.5))
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collision", forceCollide().radius(20));

    const zoomBehavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
    svg.call(zoomBehavior as any);

    const g = svg.append("g");

    g.append("g").selectAll("line").data(simEdges).join("line")
      .attr("stroke", "oklch(0.3 0.02 255)").attr("stroke-width", (d: any) => d.strength * 2).attr("stroke-opacity", 0.4);

    const nodeG = g.append("g").selectAll("g").data(simNodes).join("g").attr("cursor", "pointer");

    nodeG.call(d3Drag<any, any>()
      .on("start", (event, d: any) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag", (event, d: any) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d: any) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }) as any);

    nodeG.append("circle")
      .attr("r", (d: any) => d.mastered ? 8 : 6)
      .attr("fill", (d: any) => getColor(d.discipline))
      .attr("stroke", "oklch(0.13 0.025 255)").attr("stroke-width", 2)
      .attr("opacity", (d: any) => highlightedIds.size === 0 || highlightedIds.has(d.id) ? 1 : 0.15);

    nodeG.append("text")
      .text((d: any) => d.term.length > 18 ? d.term.slice(0, 16) + "…" : d.term)
      .attr("dx", 12).attr("dy", 4).attr("font-size", "10px")
      .attr("fill", "oklch(0.6 0.015 255)").attr("font-family", "var(--font-sans)")
      .attr("opacity", (d: any) => highlightedIds.size === 0 || highlightedIds.has(d.id) ? 1 : 0.1);

    nodeG.on("click", (_event: any, d: any) => {
      const conceptNode = graphNodes.find(n => n.id === d.id);
      if (conceptNode) { setSelectedNode(conceptNode); onNodeClick?.(conceptNode); }
    });

    simulation.on("tick", () => {
      g.selectAll("line")
        .attr("x1", (d: any) => d.source.x).attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x).attr("y2", (d: any) => d.target.y);
      nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { simulation.stop(); };
  }, [graphNodes, graphEdges, dimensions, highlightedIds, onNodeClick]);

  const selectedConnections = useMemo(() => {
    if (!selectedNode) return [];
    return graphEdges.filter(e => {
      const sId = typeof e.source === "string" ? e.source : e.source.id;
      const tId = typeof e.target === "string" ? e.target : e.target.id;
      return sId === selectedNode.id || tId === selectedNode.id;
    }).map(e => {
      const sId = typeof e.source === "string" ? e.source : e.source.id;
      const tId = typeof e.target === "string" ? e.target : e.target.id;
      const otherId = sId === selectedNode.id ? tId : sId;
      return { edge: e, node: graphNodes.find(n => n.id === otherId) };
    }).filter(c => c.node);
  }, [selectedNode, graphEdges, graphNodes]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]" ref={containerRef}>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border flex-none">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search concepts..." className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-sm" />
        </div>
        <div className="text-xs text-muted-foreground">{graphNodes.length} concepts · {graphEdges.length} connections</div>
        <div className="hidden sm:flex items-center gap-2 ml-auto">
          {Object.entries(DISCIPLINE_COLORS).slice(0, 4).map(([name, color]) => (
            <div key={name} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-muted-foreground">{name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <svg ref={svgRef} width={dimensions.width} height={dimensions.height} className="w-full h-full" />

        {selectedNode && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 p-4 rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-lg">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getColor(selectedNode.discipline) }} />
                  <span className="text-xs text-muted-foreground">{selectedNode.discipline}</span>
                </div>
                <h3 className="font-heading text-sm font-semibold">{selectedNode.term}</h3>
              </div>
              <button onClick={() => setSelectedNode(null)} className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">{selectedNode.definition}</p>
            {selectedConnections.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-muted-foreground/50 uppercase tracking-widest mb-1">Connected to</div>
                <div className="space-y-1">
                  {selectedConnections.slice(0, 5).map(c => (
                    <button key={c.node!.id} onClick={() => setSelectedNode(c.node!)}
                      className="w-full flex items-center gap-2 px-2 py-1 rounded text-left text-xs text-muted-foreground hover:text-foreground hover:bg-card/80 cursor-pointer">
                      <div className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: getColor(c.node!.discipline) }} />
                      <span className="truncate">{c.node!.term}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => audio.play({ id: `concept-${selectedNode.id}`, type: "definition", title: selectedNode.term, script: selectedNode.audioScript || `${selectedNode.term}. ${selectedNode.definition}` })}
              className="flex items-center gap-1 text-xs text-primary cursor-pointer hover:underline">
              <Volume2 className="w-3 h-3" /> Listen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
