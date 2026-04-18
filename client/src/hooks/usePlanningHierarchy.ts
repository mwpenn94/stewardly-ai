/**
 * usePlanningHierarchy — Client-side hook for the Unified Hierarchical Planning Architecture.
 * Provides forward/backward planning, roll-up/roll-down navigation, goal management,
 * PFR lifecycle, and shared assumptions — all aligned across practice ↔ client hierarchy.
 */
import { useState, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export type PlanningLevel = "platform" | "region" | "team" | "advisor" | "client" | "goal" | "strategy" | "implementation";
export type GoalCategory =
  | "protection" | "retirement" | "estate" | "tax" | "education" | "debt"
  | "growth" | "business" | "cash_flow" | "premium_finance" | "ilit"
  | "exec_comp" | "charitable" | "legacy" | "healthcare";

export interface PlanningNodeSummary {
  id: number;
  label: string | null;
  level: PlanningLevel;
  currentValue: string | null;
  forwardTarget: string | null;
  gapPercentage: string | null;
  nodeTrend: string | null;
  nodeStatus: string | null;
  childCount?: number;
}

/** Hook for navigating and managing the planning hierarchy tree */
export function usePlanningHierarchy() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  // ─── Tree Navigation ──────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<number[]>([]);

  const rootNodesQuery = trpc.planningHierarchy.getRoots.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30_000,
  });

  const selectedNodeQuery = trpc.planningHierarchy.getNode.useQuery(
    { id: selectedNodeId! },
    { enabled: !!selectedNodeId, staleTime: 30_000 },
  );

  const childNodesQuery = trpc.planningHierarchy.getChildren.useQuery(
    { parentId: selectedNodeId! },
    { enabled: !!selectedNodeId, staleTime: 30_000 },
  );

  const rollUpQuery = trpc.planningHierarchy.rollUp.useQuery(
    { nodeId: selectedNodeId! },
    { enabled: !!selectedNodeId, staleTime: 60_000 },
  );

  const ancestorsQuery = trpc.planningHierarchy.getAncestors.useQuery(
    { nodeId: selectedNodeId! },
    { enabled: !!selectedNodeId, staleTime: 60_000 },
  );

  // ─── Mutations ────────────────────────────────────────────────────────
  const createNodeMutation = trpc.planningHierarchy.createNode.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getRoots.invalidate();
      if (selectedNodeId) utils.planningHierarchy.getChildren.invalidate({ parentId: selectedNodeId });
    },
  });

  const updateNodeMutation = trpc.planningHierarchy.updateNode.useMutation({
    onSuccess: () => {
      if (selectedNodeId) {
        utils.planningHierarchy.getNode.invalidate({ id: selectedNodeId });
        utils.planningHierarchy.rollUp.invalidate({ nodeId: selectedNodeId });
      }
    },
  });

  const createGoalMutation = trpc.planningHierarchy.createGoal.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getAdvisorGoals.invalidate();
    },
  });

  const updateGoalMutation = trpc.planningHierarchy.updateGoal.useMutation();

  const createPFRMutation = trpc.planningHierarchy.createPFR.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getMyPFRs.invalidate();
    },
  });

  const upsertAssumptionsMutation = trpc.planningHierarchy.upsertAssumptions.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getAssumptions.invalidate();
    },
  });

  const addReferenceMutation = trpc.planningHierarchy.addReference.useMutation({
    onSuccess: () => {
      if (selectedNodeId) utils.planningHierarchy.getReferences.invalidate({ nodeId: selectedNodeId });
    },
  });

  // ─── Navigation Helpers ───────────────────────────────────────────────

  /** Drill down into a child node */
  const drillDown = useCallback((nodeId: number) => {
    if (selectedNodeId) {
      setBreadcrumb(prev => [...prev, selectedNodeId]);
    }
    setSelectedNodeId(nodeId);
  }, [selectedNodeId]);

  /** Navigate back up one level */
  const drillUp = useCallback(() => {
    if (breadcrumb.length > 0) {
      const parentId = breadcrumb[breadcrumb.length - 1];
      setBreadcrumb(prev => prev.slice(0, -1));
      setSelectedNodeId(parentId);
    } else {
      setSelectedNodeId(null);
    }
  }, [breadcrumb]);

  /** Jump to a specific node in the breadcrumb */
  const jumpTo = useCallback((nodeId: number | null) => {
    if (nodeId === null) {
      setBreadcrumb([]);
      setSelectedNodeId(null);
      return;
    }
    const idx = breadcrumb.indexOf(nodeId);
    if (idx >= 0) {
      setBreadcrumb(prev => prev.slice(0, idx));
      setSelectedNodeId(nodeId);
    } else {
      setSelectedNodeId(nodeId);
    }
  }, [breadcrumb]);

  // ─── Calculator → Planning Node Bridge ────────────────────────────────

  /** Link a calculator output to a planning node by creating/updating an implementation node */
  const linkCalculatorOutput = useCallback(async (params: {
    parentNodeId: number;
    calculatorId: string;
    calculatorLabel: string;
    outputValue: number;
    outputSnapshot: Record<string, any>;
  }) => {
    const { parentNodeId, calculatorId, calculatorLabel, outputValue, outputSnapshot } = params;
    const id = await createNodeMutation.mutateAsync({
      parentId: parentNodeId,
      level: "implementation",
      entityType: `calculator:${calculatorId}`,
      entityId: 0,
      label: calculatorLabel,
      currentValue: String(outputValue),
      reasoningChain: outputSnapshot,
      status: "active",
    });
    return id;
  }, [createNodeMutation]);

  /** Create a client planning tree from the "Also My Client" roll-up flow */
  const createClientPlanningTree = useCallback(async (params: {
    clientId: number;
    clientName: string;
    advisorNodeId?: number;
  }) => {
    const { clientId, clientName, advisorNodeId } = params;
    const id = await createNodeMutation.mutateAsync({
      parentId: advisorNodeId,
      level: "client",
      entityType: "client",
      entityId: clientId,
      label: `${clientName} — Financial Plan`,
      status: "draft",
    });
    return id;
  }, [createNodeMutation]);

  // ─── Computed State ───────────────────────────────────────────────────

  const isLoading = rootNodesQuery.isLoading || selectedNodeQuery.isLoading || childNodesQuery.isLoading;

  const currentLevel: PlanningLevel | null = selectedNodeQuery.data?.level as PlanningLevel ?? null;

  const gapAnalysis = useMemo(() => {
    const node = selectedNodeQuery.data;
    if (!node) return null;
    const current = Number(node.currentValue ?? 0);
    const target = Number(node.forwardTarget ?? 0);
    const gap = target - current;
    const pct = target > 0 ? (gap / target) * 100 : 0;
    return { current, target, gap, percentage: pct, trend: node.nodeTrend };
  }, [selectedNodeQuery.data]);

  return {
    // State
    selectedNodeId,
    breadcrumb,
    isLoading,
    currentLevel,
    gapAnalysis,

    // Data
    rootNodes: rootNodesQuery.data ?? [],
    selectedNode: selectedNodeQuery.data ?? null,
    childNodes: childNodesQuery.data ?? [],
    rollUp: rollUpQuery.data ?? null,
    ancestors: ancestorsQuery.data ?? [],

    // Navigation
    drillDown,
    drillUp,
    jumpTo,
    setSelectedNodeId,

    // Mutations
    createNode: createNodeMutation.mutateAsync,
    updateNode: updateNodeMutation.mutateAsync,
    createGoal: createGoalMutation.mutateAsync,
    updateGoal: updateGoalMutation.mutateAsync,
    createPFR: createPFRMutation.mutateAsync,
    upsertAssumptions: upsertAssumptionsMutation.mutateAsync,
    addReference: addReferenceMutation.mutateAsync,

    // Bridge
    linkCalculatorOutput,
    createClientPlanningTree,
  };
}

/** Hook for client-specific goal management */
export function useClientGoals(clientId: number | undefined) {
  const goalsQuery = trpc.planningHierarchy.getGoals.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 30_000 },
  );

  const discoveryQuery = trpc.planningHierarchy.getDiscovery.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 60_000 },
  );

  const pfrsQuery = trpc.planningHierarchy.getClientPFRs.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 60_000 },
  );

  const assumptionsQuery = trpc.planningHierarchy.resolveAssumptions.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 120_000 },
  );

  return {
    goals: goalsQuery.data ?? [],
    discovery: discoveryQuery.data ?? null,
    pfrs: pfrsQuery.data ?? [],
    assumptions: assumptionsQuery.data ?? {},
    isLoading: goalsQuery.isLoading,
  };
}

/** Hook for advisor-level planning overview */
export function useAdvisorPlanning() {
  const advisorGoalsQuery = trpc.planningHierarchy.getAdvisorGoals.useQuery(undefined, {
    staleTime: 60_000,
  });

  const advisorPFRsQuery = trpc.planningHierarchy.getMyPFRs.useQuery(undefined, {
    staleTime: 60_000,
  });

  const advisorAssumptionsQuery = trpc.planningHierarchy.getAssumptions.useQuery(undefined, {
    staleTime: 120_000,
  });

  const advisorNodesQuery = trpc.planningHierarchy.getByLevel.useQuery(
    { level: "advisor" },
    { staleTime: 60_000 },
  );

  return {
    goals: advisorGoalsQuery.data ?? [],
    pfrs: advisorPFRsQuery.data ?? [],
    assumptions: advisorAssumptionsQuery.data ?? [],
    advisorNodes: advisorNodesQuery.data ?? [],
    isLoading: advisorGoalsQuery.isLoading,
  };
}

/** Hook for hierarchy-resolved shared assumptions */
export function useSharedAssumptions(clientId?: number) {
  const utils = trpc.useUtils();

  const resolvedQuery = trpc.planningHierarchy.resolveSharedAssumptions.useQuery(
    clientId ? { clientId } : undefined,
    { staleTime: 120_000 },
  );

  const defaultsQuery = trpc.planningHierarchy.getDefaultAssumptions.useQuery(undefined, {
    staleTime: 300_000,
  });

  const setAssumptionMutation = trpc.planningHierarchy.setSharedAssumption.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.resolveSharedAssumptions.invalidate();
    },
  });

  return {
    resolved: resolvedQuery.data ?? {},
    defaults: defaultsQuery.data ?? {},
    isLoading: resolvedQuery.isLoading,
    setAssumption: setAssumptionMutation.mutateAsync,
  };
}

/** Hook for suitability gate checking */
export function useSuitabilityGate(userId: number | undefined) {
  const gateQuery = trpc.planningHierarchy.checkSuitabilityGate.useQuery(
    { userId: userId! },
    { enabled: !!userId, staleTime: 60_000 },
  );

  return {
    passed: gateQuery.data?.passed ?? false,
    reason: gateQuery.data?.reason ?? "",
    suitabilityData: gateQuery.data?.suitabilityData ?? null,
    isLoading: gateQuery.isLoading,
  };
}

/** Hook for recommendation-goal linking */
export function useRecommendationGoalLinker() {
  const utils = trpc.useUtils();

  const linkMutation = trpc.planningHierarchy.linkRecommendationToGoals.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getAdvisorGoals.invalidate();
    },
  });

  const recalcMutation = trpc.planningHierarchy.recalculateGoalProbability.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getAdvisorGoals.invalidate();
    },
  });

  return {
    linkToGoals: linkMutation.mutateAsync,
    recalculateProbability: recalcMutation.mutateAsync,
    isLinking: linkMutation.isPending,
  };
}

/** Hook for cascading planning engine — forward/backward cascade, alignment, gap analysis */
export function useCascadingPlanning(clientId?: number, rootNodeId?: number) {
  const utils = trpc.useUtils();

  // Queries
  const alignmentQuery = trpc.planningHierarchy.checkCrossHierarchyAlignment.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 60_000 },
  );

  const snapshotQuery = trpc.planningHierarchy.getHierarchySnapshot.useQuery(
    { rootNodeId: rootNodeId! },
    { enabled: !!rootNodeId, staleTime: 30_000 },
  );

  const matrixQuery = trpc.planningHierarchy.buildGoalStrategyMatrix.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 60_000 },
  );

  const gapQuery = trpc.planningHierarchy.multiLevelGapAnalysis.useQuery(
    { rootNodeId: rootNodeId! },
    { enabled: !!rootNodeId, staleTime: 60_000 },
  );

  const executionOrderQuery = trpc.planningHierarchy.computeGoalExecutionOrder.useQuery(
    { clientId: clientId! },
    { enabled: !!clientId, staleTime: 120_000 },
  );

  // Mutations
  const forwardCascadeMutation = trpc.planningHierarchy.forwardCascade.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getHierarchySnapshot.invalidate();
      utils.planningHierarchy.multiLevelGapAnalysis.invalidate();
      utils.planningHierarchy.checkCrossHierarchyAlignment.invalidate();
    },
  });

  const deepForwardCascadeMutation = trpc.planningHierarchy.deepForwardCascade.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getHierarchySnapshot.invalidate();
      utils.planningHierarchy.multiLevelGapAnalysis.invalidate();
      utils.planningHierarchy.checkCrossHierarchyAlignment.invalidate();
    },
  });

  const backwardCascadeMutation = trpc.planningHierarchy.backwardCascade.useMutation({
    onSuccess: () => {
      utils.planningHierarchy.getHierarchySnapshot.invalidate();
      utils.planningHierarchy.multiLevelGapAnalysis.invalidate();
      utils.planningHierarchy.checkCrossHierarchyAlignment.invalidate();
    },
  });

  return {
    // Alignment & Analysis
    alignment: alignmentQuery.data ?? null,
    snapshot: snapshotQuery.data ?? null,
    goalStrategyMatrix: matrixQuery.data ?? null,
    gapAnalysis: gapQuery.data ?? null,
    executionOrder: executionOrderQuery.data ?? null,

    // Loading states
    isLoading: alignmentQuery.isLoading || snapshotQuery.isLoading,

    // Cascade mutations
    forwardCascade: forwardCascadeMutation.mutateAsync,
    deepForwardCascade: deepForwardCascadeMutation.mutateAsync,
    backwardCascade: backwardCascadeMutation.mutateAsync,
    isCascading: forwardCascadeMutation.isPending || deepForwardCascadeMutation.isPending || backwardCascadeMutation.isPending,
  };
}

/** Hook for cascade impact preview (read-only, no mutations) */
export function useCascadePreview(nodeId: number | undefined, changeType: "forward" | "backward", newValue: number) {
  const previewQuery = trpc.planningHierarchy.previewCascadeImpact.useQuery(
    { nodeId: nodeId!, changeType, newValue },
    { enabled: !!nodeId && newValue > 0, staleTime: 10_000 },
  );

  return {
    preview: previewQuery.data ?? null,
    isLoading: previewQuery.isLoading,
  };
}
