/**
 * usePullToRefresh — G40
 *
 * Adds pull-to-refresh gesture support for mobile list views.
 * Attaches to a scrollable container and triggers a callback
 * when the user pulls down past a threshold.
 *
 * Usage:
 *   const { pullRef, isRefreshing, pullProgress } = usePullToRefresh({
 *     onRefresh: async () => { await refetch(); },
 *     threshold: 80,
 *   });
 *   <div ref={pullRef}>...</div>
 */

import { useRef, useState, useCallback, useEffect } from "react";

interface PullToRefreshOptions {
  /** Async callback to run when pull threshold is reached */
  onRefresh: () => Promise<void>;
  /** Pull distance in px to trigger refresh (default: 80) */
  threshold?: number;
  /** Disable pull-to-refresh (e.g., on desktop) */
  disabled?: boolean;
}

interface PullToRefreshResult {
  /** Attach this ref to the scrollable container */
  pullRef: React.RefCallback<HTMLElement>;
  /** Whether a refresh is currently in progress */
  isRefreshing: boolean;
  /** 0-1 progress of the pull gesture */
  pullProgress: number;
  /** Current pull distance in px */
  pullDistance: number;
}

export function usePullToRefresh({
  onRefresh,
  threshold = 80,
  disabled = false,
}: PullToRefreshOptions): PullToRefreshResult {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLElement | null>(null);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (disabled || isRefreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    },
    [disabled, isRefreshing]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isPullingRef.current || disabled || isRefreshing) return;
      const el = containerRef.current;
      if (!el || el.scrollTop > 0) {
        isPullingRef.current = false;
        setPullDistance(0);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy > 0) {
        // Apply resistance: sqrt curve
        const resisted = Math.min(Math.sqrt(dy) * 4, threshold * 2);
        setPullDistance(resisted);
        if (dy > 10) e.preventDefault(); // prevent scroll
      }
    },
    [disabled, isRefreshing, threshold]
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold); // hold at threshold during refresh
      try {
        await onRefresh();
      } catch {
        // silently handle
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh]);

  const pullRef = useCallback(
    (node: HTMLElement | null) => {
      // Cleanup old listeners
      const prev = containerRef.current;
      if (prev) {
        prev.removeEventListener("touchstart", handleTouchStart);
        prev.removeEventListener("touchmove", handleTouchMove as any);
        prev.removeEventListener("touchend", handleTouchEnd);
      }
      containerRef.current = node;
      if (node) {
        node.addEventListener("touchstart", handleTouchStart, { passive: true });
        node.addEventListener("touchmove", handleTouchMove as any, { passive: false });
        node.addEventListener("touchend", handleTouchEnd, { passive: true });
      }
    },
    [handleTouchStart, handleTouchMove, handleTouchEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      const el = containerRef.current;
      if (el) {
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove as any);
        el.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    pullRef,
    isRefreshing,
    pullProgress: Math.min(pullDistance / threshold, 1),
    pullDistance,
  };
}
