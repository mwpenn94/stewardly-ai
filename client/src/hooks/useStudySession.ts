/**
 * useStudySession — Automatic study session tracking hook.
 *
 * Tracks time spent on a learning page and records a session when the user
 * navigates away or the component unmounts. Also tracks items studied/mastered.
 *
 * Usage:
 *   const session = useStudySession({ discipline: "tax-planning", trackKey: "cfp-tax" });
 *   // Call session.recordItem() when user studies an item
 *   // Call session.recordMastery() when user masters an item
 *   // Session auto-records on unmount or page change
 */
import { useRef, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

interface UseStudySessionOptions {
  discipline?: string;
  trackKey?: string;
  /** Minimum seconds before a session is recorded (default: 10) */
  minSeconds?: number;
}

interface StudySessionControls {
  /** Call when user studies an item (flashcard flip, quiz answer, etc.) */
  recordItem: () => void;
  /** Call when user masters an item (correct answer, etc.) */
  recordMastery: () => void;
  /** Call when user completes a quiz with a score */
  recordQuizScore: (score: number) => void;
  /** Force-record the current session immediately */
  flush: () => void;
}

export function useStudySession(options: UseStudySessionOptions = {}): StudySessionControls {
  const { discipline, trackKey, minSeconds = 10 } = options;
  const { isAuthenticated } = useAuth();
  const recordMutation = trpc.learningSocial.studySessions.record.useMutation();

  const startTimeRef = useRef<number>(Date.now());
  const itemsStudiedRef = useRef(0);
  const itemsMasteredRef = useRef(0);
  const quizScoreRef = useRef<number | undefined>(undefined);
  const flushedRef = useRef(false);

  const flush = useCallback(() => {
    if (flushedRef.current || !isAuthenticated) return;
    const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
    if (elapsed < minSeconds && itemsStudiedRef.current === 0) return;

    flushedRef.current = true;
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));

    recordMutation.mutate({
      discipline: discipline ?? undefined,
      trackKey: trackKey ?? undefined,
      durationMinutes,
      itemsStudied: itemsStudiedRef.current,
      itemsMastered: itemsMasteredRef.current,
      quizScore: quizScoreRef.current,
    });
  }, [isAuthenticated, discipline, trackKey, minSeconds, recordMutation]);

  // Record on unmount
  useEffect(() => {
    startTimeRef.current = Date.now();
    flushedRef.current = false;
    itemsStudiedRef.current = 0;
    itemsMasteredRef.current = 0;
    quizScoreRef.current = undefined;

    return () => {
      flush();
    };
  }, [flush]);

  // Also record on page visibility change (tab switch, minimize)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        flush();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [flush]);

  const recordItem = useCallback(() => {
    itemsStudiedRef.current += 1;
  }, []);

  const recordMastery = useCallback(() => {
    itemsMasteredRef.current += 1;
  }, []);

  const recordQuizScore = useCallback((score: number) => {
    quizScoreRef.current = score;
  }, []);

  return { recordItem, recordMastery, recordQuizScore, flush };
}
