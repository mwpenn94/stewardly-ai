/**
 * useCascadeToast — Real-time toast notifications when Wealth Engine cascade
 * data changes trigger alerts (e.g., protection gap widens, retirement shortfall
 * detected, tax strategy opportunity, estate threshold crossed).
 *
 * Pass 123: Created for real-time cascade notifications.
 */
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { WealthEngineData } from "@/contexts/WealthEngineContext";

interface CascadeAlert {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
  panel?: string;
}

function generateAlerts(data: WealthEngineData, prev: WealthEngineData | null): CascadeAlert[] {
  const alerts: CascadeAlert[] = [];
  if (!prev) return alerts;

  // Protection gap widened
  if (data.prResult.gap > 0 && data.prResult.gap > (prev.prResult.gap || 0) * 1.1) {
    alerts.push({
      id: "protection-gap",
      title: "Protection Gap Widened",
      description: `Insurance gap increased to $${(data.prResult.gap / 1000).toFixed(0)}K. Review coverage.`,
      severity: "warning",
      panel: "protection",
    });
  }

  // Retirement shortfall detected
  if (data.rtResult.gap > 0 && prev.rtResult.gap <= 0) {
    alerts.push({
      id: "retirement-gap",
      title: "Retirement Shortfall Detected",
      description: `Monthly income gap of $${data.rtResult.gap.toFixed(0)} identified.`,
      severity: "critical",
      panel: "retirement",
    });
  }

  // Retirement gap resolved
  if (data.rtResult.gap <= 0 && prev.rtResult.gap > 0) {
    alerts.push({
      id: "retirement-resolved",
      title: "Retirement Gap Resolved",
      description: "Projected retirement income now meets target.",
      severity: "success",
      panel: "retirement",
    });
  }

  // Tax savings opportunity
  if (data.txResult.totalSavings > prev.txResult.totalSavings + 1000) {
    alerts.push({
      id: "tax-savings",
      title: "Tax Savings Opportunity",
      description: `New strategies could save $${(data.txResult.totalSavings / 1000).toFixed(1)}K annually.`,
      severity: "info",
      panel: "tax",
    });
  }

  // Estate tax threshold crossed
  if (data.esResult.estateTax > 0 && prev.esResult.estateTax === 0) {
    alerts.push({
      id: "estate-threshold",
      title: "Estate Tax Exposure",
      description: `Estimated estate tax of $${(data.esResult.estateTax / 1000).toFixed(0)}K. Consider trust strategies.`,
      severity: "warning",
      panel: "estate",
    });
  }

  // Emergency fund critical
  if (data.cfResult.emergencyMonths < 3 && prev.cfResult.emergencyMonths >= 3) {
    alerts.push({
      id: "emergency-critical",
      title: "Emergency Fund Below 3 Months",
      description: `Only ${data.cfResult.emergencyMonths.toFixed(1)} months of expenses covered.`,
      severity: "critical",
      panel: "cashflow",
    });
  }

  // Savings rate improved
  if (data.cfResult.savingsRate > prev.cfResult.savingsRate + 0.05 && data.cfResult.savingsRate >= 0.15) {
    alerts.push({
      id: "savings-improved",
      title: "Savings Rate Improved",
      description: `Savings rate now ${(data.cfResult.savingsRate * 100).toFixed(1)}% — above recommended 15%.`,
      severity: "success",
      panel: "cashflow",
    });
  }

  // Education funding gap
  if (data.edResult.gap > 0 && data.edResult.gap > (prev.edResult.gap || 0) * 1.1) {
    alerts.push({
      id: "education-gap",
      title: "Education Funding Gap",
      description: `$${(data.edResult.gap / 1000).toFixed(0)}K shortfall in education funding.`,
      severity: "warning",
      panel: "education",
    });
  }

  // Growth target on track
  if (data.grResult.onTrack && !prev.grResult.onTrack) {
    alerts.push({
      id: "growth-on-track",
      title: "Growth Target On Track",
      description: "Investment projections now meet growth targets.",
      severity: "success",
      panel: "growth",
    });
  }

  // Scorecard improved significantly
  if (data.scorecard.pctScore > prev.scorecard.pctScore + 5) {
    alerts.push({
      id: "scorecard-improved",
      title: "Health Score Improved",
      description: `Overall financial health score increased to ${data.scorecard.pctScore.toFixed(0)}%.`,
      severity: "success",
    });
  }

  // Practice income milestone
  if (data.practiceIncome.grandTotal > 0 && data.practiceIncome.grandTotal > prev.practiceIncome.grandTotal * 1.1) {
    alerts.push({
      id: "practice-income",
      title: "Practice Income Increased",
      description: `Projected annual income: $${(data.practiceIncome.grandTotal / 1000).toFixed(0)}K (+${((data.practiceIncome.grandTotal / prev.practiceIncome.grandTotal - 1) * 100).toFixed(0)}%).`,
      severity: "info",
    });
  }

  return alerts;
}

/**
 * Hook that monitors WealthEngineData changes and fires toast notifications
 * when cascade thresholds are crossed.
 */
export function useCascadeToast(data: WealthEngineData) {
  const prevRef = useRef<WealthEngineData | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Skip the first render (no previous data to compare)
    if (!prevRef.current) {
      prevRef.current = { ...data };
      return;
    }

    // Only fire if data actually changed
    if (data.lastUpdated === prevRef.current.lastUpdated) return;

    const alerts = generateAlerts(data, prevRef.current);

    for (const alert of alerts) {
      // Debounce: don't fire same alert within 30 seconds
      if (firedRef.current.has(alert.id)) continue;
      firedRef.current.add(alert.id);
      setTimeout(() => firedRef.current.delete(alert.id), 30000);

      switch (alert.severity) {
        case "critical":
          toast.error(alert.title, { description: alert.description, duration: 8000 });
          break;
        case "warning":
          toast.warning(alert.title, { description: alert.description, duration: 6000 });
          break;
        case "success":
          toast.success(alert.title, { description: alert.description, duration: 5000 });
          break;
        default:
          toast.info(alert.title, { description: alert.description, duration: 5000 });
      }
    }

    prevRef.current = { ...data };
  }, [data, data.lastUpdated]);
}
