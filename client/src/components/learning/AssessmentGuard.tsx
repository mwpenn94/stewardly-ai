/**
 * §P0-3 Assessment Integrity — Client-side guard
 * Wraps chat surfaces and blocks AI interaction during active graded assessments.
 * Also includes focus-loss event recorder for assessment pages.
 */
import { useEffect, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ShieldAlert } from "lucide-react";

/**
 * Hook: useAssessmentGuard
 * Returns whether AI is currently blocked for the user (active assessment).
 * Use this in chat components to show/hide the chat input.
 */
export function useAssessmentGuard() {
  // @ts-expect-error — strict mode fix
  const { data, isLoading } = trpc.learning.assessment.active.useQuery(undefined, {
    refetchInterval: 10_000, // poll every 10s during assessment
    retry: false,
  });

  return {
    isBlocked: !!data?.session?.aiBlockActive,
    activeSession: data?.session ?? null,
    isLoading,
  };
}

/**
 * Hook: useFocusLossRecorder
 * Records tab/window focus loss events during active assessment sessions.
 * Attach this to any assessment page component.
 */
export function useFocusLossRecorder(sessionActive: boolean) {
  // @ts-expect-error — property access on loosely typed object
  const recordFocusLoss = trpc.learning.assessment.focusLoss.useMutation();

  const handleVisibilityChange = useCallback(() => {
    if (document.hidden && sessionActive) {
      recordFocusLoss.mutate();
    }
  }, [sessionActive, recordFocusLoss]);

  const handleWindowBlur = useCallback(() => {
    if (sessionActive) {
      recordFocusLoss.mutate();
    }
  }, [sessionActive, recordFocusLoss]);

  useEffect(() => {
    if (!sessionActive) return;

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [sessionActive, handleVisibilityChange, handleWindowBlur]);
}

/**
 * Component: AssessmentBlockBanner
 * Renders a warning banner when AI is blocked during an assessment.
 * Place this above chat input areas.
 */
export function AssessmentBlockBanner({ className = "" }: { className?: string }) {
  const { isBlocked, activeSession } = useAssessmentGuard();

  if (!isBlocked) return null;

  return (
    <div className={`flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 ${className}`}>
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-400" />
      <div>
        <p className="font-semibold text-sm">Assessment in Progress</p>
        <p className="text-xs text-amber-300/80">
          AI assistance is disabled during graded assessments. Complete or exit the assessment to resume chat.
        </p>
      </div>
    </div>
  );
}

/**
 * Component: AssessmentGuardWrapper
 * Wraps any chat surface. If an assessment is active, shows the block banner
 * and disables the children (chat input).
 */
export function AssessmentGuardWrapper({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { isBlocked } = useAssessmentGuard();

  if (isBlocked) {
    return (
      <div className="relative">
        <AssessmentBlockBanner className="mb-4" />
        {fallback ?? (
          <div className="pointer-events-none opacity-40 select-none">
            {children}
          </div>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
