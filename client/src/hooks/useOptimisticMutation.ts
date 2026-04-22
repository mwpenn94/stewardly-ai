/**
 * useOptimisticMutation — Reusable optimistic update patterns for tRPC mutations.
 *
 * Provides pre-built optimistic update hooks for common patterns:
 *   1. Toggle mutations (pin, favorite, enable/disable).
 *   2. List item removal (delete, dismiss).
 *   3. List item update (edit in place).
 *
 * Each hook wraps tRPC's useMutation with onMutate/onError/onSettled
 * for instant UI feedback with automatic rollback on failure.
 */
import { useCallback, useRef } from "react";
import { toast } from "sonner";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface OptimisticToggleOptions<TData> {
  /** The tRPC query utils for the list query to update. */
  queryUtils: {
    getData: () => TData | undefined;
    setData: (updater: (old: TData | undefined) => TData | undefined) => void;
    invalidate: () => void;
  };
  /** Function to toggle the item in the cached data. */
  toggleItem: (data: TData, itemId: string | number) => TData;
  /** Optional success message. */
  successMessage?: string;
  /** Optional error message prefix. */
  errorPrefix?: string;
}

export interface OptimisticRemoveOptions<TData> {
  queryUtils: {
    getData: () => TData | undefined;
    setData: (updater: (old: TData | undefined) => TData | undefined) => void;
    invalidate: () => void;
  };
  /** Function to remove the item from cached data. */
  removeItem: (data: TData, itemId: string | number) => TData;
  successMessage?: string;
  errorPrefix?: string;
}

export interface OptimisticUpdateOptions<TData, TItem> {
  queryUtils: {
    getData: () => TData | undefined;
    setData: (updater: (old: TData | undefined) => TData | undefined) => void;
    invalidate: () => void;
  };
  /** Function to update the item in cached data. */
  updateItem: (data: TData, itemId: string | number, changes: Partial<TItem>) => TData;
  successMessage?: string;
  errorPrefix?: string;
}

// ─── Optimistic toggle hook ────────────────────────────────────────────────

/**
 * Creates mutation callbacks for optimistic toggle operations.
 * Usage:
 * ```ts
 * const callbacks = useOptimisticToggle({
 *   queryUtils: trpc.useUtils().conversations.list,
 *   toggleItem: (data, id) => data.map(c => c.id === id ? { ...c, pinned: !c.pinned } : c),
 * });
 * const togglePin = trpc.conversations.togglePin.useMutation(callbacks);
 * ```
 */
export function useOptimisticToggle<TData>({
  queryUtils,
  toggleItem,
  successMessage,
  errorPrefix = "Action failed",
}: OptimisticToggleOptions<TData>) {
  const previousDataRef = useRef<TData | undefined>(undefined);

  return {
    onMutate: async (variables: { id: string | number } & Record<string, unknown>) => {
      // Snapshot current data
      previousDataRef.current = queryUtils.getData();

      // Optimistically update
      queryUtils.setData((old) => {
        if (!old) return old;
        return toggleItem(old, variables.id);
      });
    },
    onError: (error: { message: string }) => {
      // Rollback on error
      if (previousDataRef.current !== undefined) {
        queryUtils.setData(() => previousDataRef.current);
      }
      toast.error(`${errorPrefix}: ${error.message}`);
    },
    onSettled: () => {
      // Revalidate from server
      queryUtils.invalidate();
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
  };
}

// ─── Optimistic remove hook ────────────────────────────────────────────────

/**
 * Creates mutation callbacks for optimistic list removal.
 * Usage:
 * ```ts
 * const callbacks = useOptimisticRemove({
 *   queryUtils: trpc.useUtils().bookmarks.list,
 *   removeItem: (data, id) => data.filter(b => b.id !== id),
 * });
 * const remove = trpc.bookmarks.remove.useMutation(callbacks);
 * ```
 */
export function useOptimisticRemove<TData>({
  queryUtils,
  removeItem,
  successMessage,
  errorPrefix = "Remove failed",
}: OptimisticRemoveOptions<TData>) {
  const previousDataRef = useRef<TData | undefined>(undefined);

  return {
    onMutate: async (variables: { id: string | number } & Record<string, unknown>) => {
      previousDataRef.current = queryUtils.getData();
      queryUtils.setData((old) => {
        if (!old) return old;
        return removeItem(old, variables.id);
      });
    },
    onError: (error: { message: string }) => {
      if (previousDataRef.current !== undefined) {
        queryUtils.setData(() => previousDataRef.current);
      }
      toast.error(`${errorPrefix}: ${error.message}`);
    },
    onSettled: () => {
      queryUtils.invalidate();
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
  };
}

// ─── Optimistic update hook ────────────────────────────────────────────────

/**
 * Creates mutation callbacks for optimistic in-place updates.
 * Usage:
 * ```ts
 * const callbacks = useOptimisticUpdate({
 *   queryUtils: trpc.useUtils().items.list,
 *   updateItem: (data, id, changes) => data.map(i => i.id === id ? { ...i, ...changes } : i),
 * });
 * const update = trpc.items.update.useMutation(callbacks);
 * ```
 */
export function useOptimisticUpdate<TData, TItem>({
  queryUtils,
  updateItem,
  successMessage,
  errorPrefix = "Update failed",
}: OptimisticUpdateOptions<TData, TItem>) {
  const previousDataRef = useRef<TData | undefined>(undefined);

  return {
    onMutate: async (variables: { id: string | number; changes?: Partial<TItem> } & Record<string, unknown>) => {
      previousDataRef.current = queryUtils.getData();
      queryUtils.setData((old) => {
        if (!old) return old;
        return updateItem(old, variables.id, (variables.changes ?? variables) as Partial<TItem>);
      });
    },
    onError: (error: { message: string }) => {
      if (previousDataRef.current !== undefined) {
        queryUtils.setData(() => previousDataRef.current);
      }
      toast.error(`${errorPrefix}: ${error.message}`);
    },
    onSettled: () => {
      queryUtils.invalidate();
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
  };
}

// ─── Batch optimistic helper ───────────────────────────────────────────────

/**
 * Helper for batch operations (e.g., bulk toggle, bulk delete).
 * Wraps the same pattern but accepts an array of IDs.
 */
export function useOptimisticBatch<TData>({
  queryUtils,
  applyBatch,
  successMessage,
  errorPrefix = "Batch operation failed",
}: {
  queryUtils: {
    getData: () => TData | undefined;
    setData: (updater: (old: TData | undefined) => TData | undefined) => void;
    invalidate: () => void;
  };
  applyBatch: (data: TData, ids: Array<string | number>) => TData;
  successMessage?: string;
  errorPrefix?: string;
}) {
  const previousDataRef = useRef<TData | undefined>(undefined);

  return {
    onMutate: async (variables: { ids: Array<string | number> } & Record<string, unknown>) => {
      previousDataRef.current = queryUtils.getData();
      queryUtils.setData((old) => {
        if (!old) return old;
        return applyBatch(old, variables.ids);
      });
    },
    onError: (error: { message: string }) => {
      if (previousDataRef.current !== undefined) {
        queryUtils.setData(() => previousDataRef.current);
      }
      toast.error(`${errorPrefix}: ${error.message}`);
    },
    onSettled: () => {
      queryUtils.invalidate();
    },
    onSuccess: () => {
      if (successMessage) toast.success(successMessage);
    },
  };
}
