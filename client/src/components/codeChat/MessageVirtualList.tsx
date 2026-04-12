/**
 * MessageVirtualList — virtualized message renderer for the Code
 * Chat main message pane (Pass v5 #76).
 *
 * Why: before Pass v5, CodeChat.tsx rendered every message as a
 * direct DOM child. A 200-message session pushed ~30K nodes into the
 * tree — scroll jank, slow input typing, and runaway memory bloat on
 * long working sessions. This component wraps `useVirtualizer` from
 * `@tanstack/react-virtual` so only the rows inside the viewport
 * (plus a small overscan window) are actually mounted.
 *
 * Design notes:
 *   - The outer scroll container is owned by the component. The
 *     virtualizer measures it via `getScrollElement`.
 *   - Row heights are DYNAMIC. Each rendered row registers with
 *     `virtualizer.measureElement` so ResizeObserver picks up height
 *     changes as assistant messages stream in, diffs expand, plan
 *     panels toggle, etc.
 *   - Overscan is set to 5 so bookmark/outline jumps feel instant
 *     and scroll jitter is minimal.
 *   - `trailing` children render INSIDE the scroll container but
 *     OUTSIDE the virtualized absolute-positioned surface. Used for
 *     the live "Thinking..." spinner, current tool events, and the
 *     agent todo live strip — these don't correspond to a message
 *     id but share the scroll parent.
 *   - `autoScrollToBottom()` on the imperative handle is called by
 *     the parent whenever `messages` or `currentTools` change. It
 *     only scrolls if the user was already within 80px of the
 *     bottom at the time of the last scroll event — so scrolling up
 *     to read history doesn't get yanked back down.
 *   - `scrollToMessage(id)` first calls `scrollToIndex(idx, center)`,
 *     then waits a double-rAF for the virtualizer to mount the row
 *     before looking up the DOM node and applying the gold highlight
 *     pulse. This preserves the pass-234 bookmark-jump UX.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface MessageVirtualListHandle {
  /** Scroll to the bottom of the list if the user was near the bottom
   *  at the last scroll event. No-op otherwise. */
  autoScrollToBottom: (opts?: { smooth?: boolean }) => void;
  /** Jump to a specific message by id + pulse-highlight it. */
  scrollToMessage: (id: string) => void;
  /** Force scroll to the very bottom (ignores wasAtBottom). */
  scrollToBottom: (opts?: { smooth?: boolean }) => void;
}

interface MessageLike {
  id: string;
}

interface MessageVirtualListProps<T extends MessageLike> {
  messages: T[];
  renderMessage: (msg: T, idx: number) => ReactNode;
  /** Rendered inside the scroll container below the virtualized list. */
  trailing?: ReactNode;
  /** Pre-list content (rendered at the top of the scroll container). */
  leading?: ReactNode;
  className?: string;
  /** Pixels to consider "at the bottom" for the auto-scroll heuristic. */
  stickThreshold?: number;
  /** Default estimated row height before measurement. */
  estimateRowHeight?: number;
}

function MessageVirtualListInner<T extends MessageLike>(
  {
    messages,
    renderMessage,
    trailing,
    leading,
    className,
    stickThreshold = 80,
    estimateRowHeight = 160,
  }: MessageVirtualListProps<T>,
  ref: React.Ref<MessageVirtualListHandle>,
) {
  const parentRef = useRef<HTMLDivElement>(null);
  // Track "was at bottom" so we can keep the chat glued as tokens
  // stream in. Updated on every scroll event.
  const wasAtBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateRowHeight,
    overscan: 5,
    getItemKey: (idx) => messages[idx]?.id ?? idx,
  });

  const items = virtualizer.getVirtualItems();

  const handleScroll = useCallback(() => {
    const el = parentRef.current;
    if (!el) return;
    const delta = el.scrollHeight - el.scrollTop - el.clientHeight;
    wasAtBottomRef.current = delta < stickThreshold;
  }, [stickThreshold]);

  // Initial "at bottom" true so the first auto-scroll on arrival fires
  useLayoutEffect(() => {
    wasAtBottomRef.current = true;
  }, []);

  const scrollToBottomInternal = useCallback(
    (smooth: boolean) => {
      // Double rAF: give the virtualizer a tick to re-measure after
      // new content lands before we read scrollHeight.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = parentRef.current;
          if (!el) return;
          el.scrollTo({
            top: el.scrollHeight,
            behavior: smooth ? "smooth" : "auto",
          });
        });
      });
    },
    [],
  );

  useImperativeHandle(
    ref,
    () => ({
      autoScrollToBottom: (opts) => {
        if (!wasAtBottomRef.current) return;
        scrollToBottomInternal(opts?.smooth ?? true);
      },
      scrollToBottom: (opts) => {
        scrollToBottomInternal(opts?.smooth ?? true);
      },
      scrollToMessage: (id) => {
        const idx = messages.findIndex((m) => m.id === id);
        if (idx === -1) return;
        virtualizer.scrollToIndex(idx, { align: "center" });
        // Double-rAF so the virtualizer mounts the row before we
        // look it up for the highlight pulse.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const parent = parentRef.current;
            if (!parent) return;
            const el = parent.querySelector(
              `[data-message-id="${CSS.escape(id)}"]`,
            );
            if (el instanceof HTMLElement) {
              const prev = el.style.backgroundColor;
              el.style.transition = "background-color 0.3s";
              el.style.backgroundColor = "rgba(212,168,67,0.15)";
              window.setTimeout(() => {
                el.style.backgroundColor = prev;
              }, 1500);
            }
          });
        });
      },
    }),
    [messages, virtualizer, scrollToBottomInternal],
  );

  const totalHeight = virtualizer.getTotalSize();

  const innerStyle: CSSProperties = useMemo(
    () => ({
      height: `${totalHeight}px`,
      width: "100%",
      position: "relative",
    }),
    [totalHeight],
  );

  return (
    <div
      ref={parentRef}
      onScroll={handleScroll}
      className={
        className ?? "flex-1 overflow-y-auto p-4"
      }
      // Pass v5 #76: the virtualizer reads offsetHeight from the
      // scroll element to size the viewport. `contain: strict` would
      // break measurement, so we stay with default layout behavior.
    >
      {leading}
      <div style={innerStyle}>
        {items.map((virtualRow) => {
          const msg = messages[virtualRow.index];
          if (!msg) return null;
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: "1rem",
              }}
            >
              {renderMessage(msg, virtualRow.index)}
            </div>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

/** Generic forwardRef helper so we keep the `T extends MessageLike` type
 *  parameter through the forward-ref wrapping. */
const MessageVirtualList = forwardRef(MessageVirtualListInner) as <
  T extends MessageLike,
>(
  props: MessageVirtualListProps<T> & {
    ref?: React.Ref<MessageVirtualListHandle>;
  },
) => ReturnType<typeof MessageVirtualListInner>;

export default MessageVirtualList;
