/**
 * Proactive wealth-chat conversation triggers — Phase 6D.
 *
 * The agent doesn't just respond to user clicks — it monitors for
 * triggers and initiates conversations:
 *
 *  - on login: portfolio status snapshot + practice income delta
 *  - guardrail crossed: alert + recommended spending adjustment
 *  - Roth window: bracket-space narrative
 *  - hierarchy milestone: advancement countdown
 *  - strategy comparer: weekly summary
 *
 * Each trigger is a pure function that takes a context object and
 * returns a `ProactiveMessage` ready to be queued in the chat stream
 * via the existing notifications router.
 */

import { safetyWrap } from "./safety";

export interface ProactiveMessage {
  trigger: string;
  priority: "info" | "warn" | "urgent";
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
}

// ─── 1. On login — portfolio status ──────────────────────────────────────

export interface OnLoginContext {
  portfolioBalance: number;
  practiceIncomeMTD: number;
  practiceIncomePctVsProjection: number;
  guardrailLow: number;
  guardrailHigh: number;
}

export function onLoginTrigger(ctx: OnLoginContext): ProactiveMessage {
  const inBand =
    ctx.portfolioBalance >= ctx.guardrailLow &&
    ctx.portfolioBalance <= ctx.guardrailHigh;
  const direction = ctx.practiceIncomePctVsProjection >= 0 ? "+" : "";
  return {
    trigger: "on_login",
    priority: inBand ? "info" : "warn",
    title: "Welcome back",
    body: safetyWrap(
      `Your portfolio is at $${ctx.portfolioBalance.toLocaleString()}, ${inBand ? "within guardrails" : "outside the guardrail band"}. Practice income month-to-date: $${ctx.practiceIncomeMTD.toLocaleString()} (${direction}${ctx.practiceIncomePctVsProjection.toFixed(1)}% vs projection).`,
    ),
    ctaLabel: "Open dashboard",
    ctaHref: "/wealth-engine/retirement",
  };
}

// ─── 2. Guardrail crossed ────────────────────────────────────────────────

export interface GuardrailContext {
  portfolioBalance: number;
  oldGuardrailHigh: number;
  newGuardrailHigh: number;
  newSpendCeiling: number;
}

export function guardrailCrossedTrigger(
  ctx: GuardrailContext,
): ProactiveMessage {
  const direction =
    ctx.portfolioBalance > ctx.oldGuardrailHigh ? "above" : "below";
  return {
    trigger: "guardrail_crossed",
    priority: "warn",
    title: `Portfolio ${direction} guardrail`,
    body: safetyWrap(
      `Your portfolio crossed $${ctx.oldGuardrailHigh.toLocaleString()}. The model now suggests an upper guardrail of $${ctx.newGuardrailHigh.toLocaleString()} and a sustainable annual spending ceiling of $${ctx.newSpendCeiling.toLocaleString()}.`,
    ),
    ctaLabel: "Review guardrails",
    ctaHref: "/wealth-engine/retirement",
  };
}

// ─── 3. Roth conversion window ───────────────────────────────────────────

export interface RothWindowContext {
  conversionWindowSize: number;
  bracketRate: number;
  reasonNarrative: string;
}

export function rothWindowTrigger(ctx: RothWindowContext): ProactiveMessage {
  return {
    trigger: "roth_window",
    priority: "info",
    title: "Roth conversion window",
    body: safetyWrap(
      `${ctx.reasonNarrative} This creates a $${ctx.conversionWindowSize.toLocaleString()} Roth conversion window at the ${(ctx.bracketRate * 100).toFixed(0)}% bracket. The window may close as your income changes.`,
    ),
    ctaLabel: "Explore Roth options",
    ctaHref: "/wealth-engine/strategy-comparison",
  };
}

// ─── 4. Hierarchy milestone (BIE) ────────────────────────────────────────

export interface HierarchyMilestoneContext {
  currentRole: string;
  nextRole: string;
  productionGap: number;
  paceMonths: number;
}

export function hierarchyMilestoneTrigger(
  ctx: HierarchyMilestoneContext,
): ProactiveMessage {
  return {
    trigger: "hierarchy_milestone",
    priority: "info",
    title: `${ctx.paceMonths} months from ${ctx.nextRole}`,
    body: safetyWrap(
      `You're $${ctx.productionGap.toLocaleString()} in production from advancing from ${ctx.currentRole} to ${ctx.nextRole}. At current pace, you'll hit it in ~${ctx.paceMonths} months.`,
    ),
    ctaLabel: "See income impact",
    ctaHref: "/wealth-engine/practice-to-wealth",
  };
}

// ─── 5. Strategy comparer summary ────────────────────────────────────────

export interface StrategyComparerContext {
  scenariosThisWeek: number;
  topStrategy: string;
  topStrategyValue: number;
}

export function strategyComparerTrigger(
  ctx: StrategyComparerContext,
): ProactiveMessage {
  return {
    trigger: "strategy_comparer",
    priority: "info",
    title: "Your scenarios this week",
    body: safetyWrap(
      `You've run ${ctx.scenariosThisWeek} scenarios this week. The strategy with the highest projected value across them is ${ctx.topStrategy} at $${ctx.topStrategyValue.toLocaleString()}.`,
    ),
    ctaLabel: "Compare side-by-side",
    ctaHref: "/wealth-engine/strategy-comparison",
  };
}
