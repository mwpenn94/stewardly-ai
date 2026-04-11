/**
 * Circular dependency detector (Pass 247).
 *
 * Walks the import graph from `importGraph.ts` looking for strongly
 * connected components of size > 1 (genuine cycles) and length-1
 * self-loops (file imports itself). Uses Tarjan's SCC algorithm for
 * correctness and efficiency — the classic two-pass DFS that
 * produces all SCCs in O(V+E).
 *
 * Why SCC instead of naive DFS? A cycle can pass through the same
 * vertex via different paths, and naive DFS returns one path per
 * start node which leads to a lot of duplicate reporting. Tarjan's
 * gives every cycle exactly once.
 */

import type { ImportGraph } from "./importGraph";

export interface CycleReport {
  /** Files participating in the cycle, in a stable order */
  files: string[];
  /** Derived size for easy sorting */
  size: number;
  /** True for single-file self-loops */
  selfLoop: boolean;
}

interface TarjanState {
  index: number;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  onStack: Set<string>;
  stack: string[];
  sccs: string[][];
}

function strongconnect(node: string, graph: ImportGraph, state: TarjanState): void {
  state.indices.set(node, state.index);
  state.lowlinks.set(node, state.index);
  state.index++;
  state.stack.push(node);
  state.onStack.add(node);

  const successors = graph.outgoing.get(node) ?? [];
  for (const next of successors) {
    if (!state.indices.has(next)) {
      strongconnect(next, graph, state);
      const current = state.lowlinks.get(node)!;
      const nextLow = state.lowlinks.get(next)!;
      state.lowlinks.set(node, Math.min(current, nextLow));
    } else if (state.onStack.has(next)) {
      const current = state.lowlinks.get(node)!;
      const nextIdx = state.indices.get(next)!;
      state.lowlinks.set(node, Math.min(current, nextIdx));
    }
  }

  if (state.lowlinks.get(node) === state.indices.get(node)) {
    // Root of an SCC — pop until we hit this node
    const scc: string[] = [];
    while (true) {
      const popped = state.stack.pop()!;
      state.onStack.delete(popped);
      scc.push(popped);
      if (popped === node) break;
    }
    state.sccs.push(scc);
  }
}

/**
 * Return every cycle in the import graph. A cycle is either an SCC
 * with > 1 node (most common case) or a single-node SCC that has a
 * self-edge (file imports itself). Cycles are returned sorted by
 * size descending so the worst offenders surface first.
 */
export function findCycles(graph: ImportGraph): CycleReport[] {
  const state: TarjanState = {
    index: 0,
    indices: new Map(),
    lowlinks: new Map(),
    onStack: new Set(),
    stack: [],
    sccs: [],
  };

  // Iterate over every node that has either outgoing edges OR incoming
  // edges. A node with no edges at all can't participate in a cycle.
  const nodes = new Set<string>();
  for (const [key] of Array.from(graph.outgoing.entries())) nodes.add(key);
  for (const [key] of Array.from(graph.incoming.entries())) nodes.add(key);

  for (const node of Array.from(nodes)) {
    if (!state.indices.has(node)) {
      strongconnect(node, graph, state);
    }
  }

  const cycles: CycleReport[] = [];
  for (const scc of state.sccs) {
    if (scc.length > 1) {
      cycles.push({
        files: scc.sort(),
        size: scc.length,
        selfLoop: false,
      });
    } else if (scc.length === 1) {
      // Check for self-loop (file imports itself)
      const node = scc[0];
      const outgoing = graph.outgoing.get(node) ?? [];
      if (outgoing.includes(node)) {
        cycles.push({ files: [node], size: 1, selfLoop: true });
      }
    }
  }

  return cycles.sort((a, b) => b.size - a.size || a.files[0].localeCompare(b.files[0]));
}

export interface CyclesSummary {
  totalCycles: number;
  filesInCycles: number;
  largestCycle: number;
  selfLoops: number;
}

export function summarizeCycles(cycles: CycleReport[]): CyclesSummary {
  const filesInCycles = new Set<string>();
  let largestCycle = 0;
  let selfLoops = 0;
  for (const cycle of cycles) {
    for (const f of cycle.files) filesInCycles.add(f);
    if (cycle.size > largestCycle) largestCycle = cycle.size;
    if (cycle.selfLoop) selfLoops++;
  }
  return {
    totalCycles: cycles.length,
    filesInCycles: filesInCycles.size,
    largestCycle,
    selfLoops,
  };
}
