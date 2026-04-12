/**
 * Message list virtualization helper — Build-loop Pass 18 (G16).
 *
 * Pure-function windowing logic for the Code Chat message list. When
 * the message count exceeds VIRT_THRESHOLD, the renderer skips
 * messages outside an anchor window so React doesn't have to mount
 * thousands of nodes for a long session.
 *
 * Why a custom windower instead of `react-window`:
 *
 *   - Code Chat messages have wildly varying heights (a 3-line
 *     question vs a 200-line code dump). Fixed-size virtualization
 *     doesn't apply.
 *   - Variable-size virtualization needs height measurement, which
 *     adds complexity + a layout-thrash risk.
 *   - The simpler approach: only render messages that are close to
 *     the user's current scroll anchor (the last visible message id).
 *     Messages outside the window are replaced by a small placeholder
 *     that takes minimal layout space.
 *
 *   - The first turn always renders so the conversation has a root.
 *   - The most-recent K messages always render so streaming is
 *     never affected.
 *   - The window grows as the user scrolls upward via an
 *     `expandWindow` action.
 *
 * Pure-function module — no React, no DOM. The hook in CodeChat.tsx
 * computes the window each render and the message list iterates
 * `windowState.visibleIndices`.
 */

export interface VirtualizationWindow {
  /** Total number of messages in the source list. */
  total: number;
  /** Indices that should actually be rendered, in order. */
  visibleIndices: number[];
  /** Number of messages hidden BEFORE the window. */
  hiddenBefore: number;
  /** Number of messages hidden AFTER the window. */
  hiddenAfter: number;
  /** True when virtualization is active (`total > threshold`). */
  active: boolean;
}

export interface VirtualizationOptions {
  /** Total messages above this count enables virtualization. Default 100. */
  threshold?: number;
  /** Always-rendered count at the start of the conversation. Default 5. */
  headCount?: number;
  /** Always-rendered count at the end of the conversation. Default 30. */
  tailCount?: number;
  /**
   * Optional anchor message id (e.g. the message the user just
   * scrolled to). Messages within `anchorWindow` of the anchor
   * index are also rendered, on top of head + tail.
   */
  anchorId?: string;
  /** How many messages around the anchor to render. Default 10. */
  anchorWindow?: number;
  /**
   * Optional set of message ids that must always render regardless
   * of position (e.g. bookmarked messages, the message the outline
   * panel is highlighting). The hook passes its bookmark + outline
   * targets here.
   */
  pinnedIds?: Iterable<string>;
}

const DEFAULT_THRESHOLD = 100;
const DEFAULT_HEAD = 5;
const DEFAULT_TAIL = 30;
const DEFAULT_ANCHOR_WINDOW = 10;

/**
 * Compute the visible window for a list of message ids. Returns the
 * full list when virtualization isn't active, otherwise the
 * head + anchor + tail + pinned union (sorted, deduped).
 *
 * The function is pure and free of allocations beyond what's needed
 * to build the result, so it's cheap to call on every render.
 */
export function computeWindow(
  messageIds: string[],
  opts: VirtualizationOptions = {},
): VirtualizationWindow {
  const total = messageIds.length;
  const threshold = opts.threshold ?? DEFAULT_THRESHOLD;
  if (total <= threshold) {
    return {
      total,
      visibleIndices: messageIds.map((_, i) => i),
      hiddenBefore: 0,
      hiddenAfter: 0,
      active: false,
    };
  }
  const head = Math.max(0, opts.headCount ?? DEFAULT_HEAD);
  const tail = Math.max(0, opts.tailCount ?? DEFAULT_TAIL);
  const anchorWindow = Math.max(0, opts.anchorWindow ?? DEFAULT_ANCHOR_WINDOW);
  const visible = new Set<number>();
  // Head
  for (let i = 0; i < Math.min(head, total); i++) visible.add(i);
  // Tail
  for (let i = Math.max(0, total - tail); i < total; i++) visible.add(i);
  // Anchor
  if (opts.anchorId) {
    const anchorIdx = messageIds.indexOf(opts.anchorId);
    if (anchorIdx >= 0) {
      const lo = Math.max(0, anchorIdx - anchorWindow);
      const hi = Math.min(total - 1, anchorIdx + anchorWindow);
      for (let i = lo; i <= hi; i++) visible.add(i);
    }
  }
  // Pinned (bookmarks, outline targets, etc)
  if (opts.pinnedIds) {
    // Use Array.from() instead of `for...of` so we don't need
    // --downlevelIteration on the project's TS target.
    const pinnedArray = Array.from(opts.pinnedIds);
    for (let p = 0; p < pinnedArray.length; p++) {
      const idx = messageIds.indexOf(pinnedArray[p]);
      if (idx >= 0) visible.add(idx);
    }
  }
  const sorted = Array.from(visible).sort((a, b) => a - b);
  // Compute the "hidden before" and "hidden after" counts as
  // displayed in the placeholder cards. Hidden before = the first
  // visible index. Hidden after = total - last visible - 1.
  const hiddenBefore = sorted.length === 0 ? total : sorted[0];
  const hiddenAfter =
    sorted.length === 0 ? 0 : total - 1 - sorted[sorted.length - 1];
  return {
    total,
    visibleIndices: sorted,
    hiddenBefore,
    hiddenAfter,
    active: true,
  };
}

/**
 * Group consecutive visible indices into runs so the renderer can
 * insert a single "X messages hidden" placeholder between runs
 * instead of one placeholder per gap.
 *
 * Returns an array of either visible-index runs or hidden-count
 * markers. The first marker (if any) appears before the first run
 * to surface the head-of-conversation gap; the last marker appears
 * after the last run for the tail gap.
 */
export type WindowSegment =
  | { kind: "visible"; indices: number[] }
  | { kind: "hidden"; count: number; from: number; to: number };

export function segmentWindow(
  win: VirtualizationWindow,
): WindowSegment[] {
  if (!win.active) {
    return [{ kind: "visible", indices: win.visibleIndices }];
  }
  const out: WindowSegment[] = [];
  if (win.visibleIndices.length === 0) {
    return [{ kind: "hidden", count: win.total, from: 0, to: win.total - 1 }];
  }
  // Leading hidden gap
  if (win.visibleIndices[0] > 0) {
    out.push({
      kind: "hidden",
      count: win.visibleIndices[0],
      from: 0,
      to: win.visibleIndices[0] - 1,
    });
  }
  // Walk visible indices, breaking on every gap
  let runStart = win.visibleIndices[0];
  let prev = win.visibleIndices[0];
  const flushVisible = (start: number, end: number) => {
    const indices: number[] = [];
    for (let i = start; i <= end; i++) indices.push(i);
    out.push({ kind: "visible", indices });
  };
  for (let k = 1; k < win.visibleIndices.length; k++) {
    const cur = win.visibleIndices[k];
    if (cur > prev + 1) {
      // gap
      flushVisible(runStart, prev);
      out.push({
        kind: "hidden",
        count: cur - prev - 1,
        from: prev + 1,
        to: cur - 1,
      });
      runStart = cur;
    }
    prev = cur;
  }
  flushVisible(runStart, prev);
  // Trailing hidden gap
  const last = win.visibleIndices[win.visibleIndices.length - 1];
  if (last < win.total - 1) {
    out.push({
      kind: "hidden",
      count: win.total - 1 - last,
      from: last + 1,
      to: win.total - 1,
    });
  }
  return out;
}

/**
 * Convenience: total rendered messages (sum of `visible` segment
 * lengths) for telemetry / debug rendering.
 */
export function countRendered(segments: WindowSegment[]): number {
  let n = 0;
  for (const seg of segments) {
    if (seg.kind === "visible") n += seg.indices.length;
  }
  return n;
}
