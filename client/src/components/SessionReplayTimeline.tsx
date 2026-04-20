/**
 * SessionReplayTimeline — Visual scrubber showing undo/redo history snapshots.
 *
 * Renders a horizontal timeline of state snapshots with timestamps.
 * Users can click any point to jump to that snapshot. Shows the current
 * position indicator and delta summaries between adjacent snapshots.
 *
 * v8 Pass 5 — Feature 1
 */
import { useState, useMemo, useCallback } from 'react';
import { Clock, ChevronDown, ChevronUp, RotateCcw, Diff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TimelineEntry {
  /** The state snapshot */
  state: Record<string, any>;
  /** Timestamp when this snapshot was captured */
  timestamp: number;
  /** Optional label (e.g., "Initial", "Age changed") */
  label?: string;
}

interface SessionReplayTimelineProps {
  /** Array of timeline entries from the undo history */
  entries: TimelineEntry[];
  /** Current position in the timeline (0-indexed) */
  currentPosition: number;
  /** Callback when user clicks a timeline point */
  onJumpTo: (index: number) => void;
  /** Whether the timeline is collapsed */
  className?: string;
}

/** Count how many top-level keys changed between two snapshots */
function countChanges(a: Record<string, any>, b: Record<string, any>): { changed: number; keys: string[] } {
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changedKeys: string[] = [];
  for (const key of allKeys) {
    if (JSON.stringify(a[key]) !== JSON.stringify(b[key])) {
      changedKeys.push(key);
    }
  }
  return { changed: changedKeys.length, keys: changedKeys.slice(0, 3) };
}

/** Format a timestamp as relative time (e.g., "2m ago") */
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 5000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

/** Format a timestamp as HH:MM:SS */
function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function SessionReplayTimeline({
  entries,
  currentPosition,
  onJumpTo,
  className,
}: SessionReplayTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute change summaries between adjacent entries
  const changeSummaries = useMemo(() => {
    return entries.map((entry, i) => {
      if (i === 0) return { changed: 0, keys: [] as string[] };
      return countChanges(entries[i - 1].state, entry.state);
    });
  }, [entries]);

  const handleJump = useCallback((index: number) => {
    if (index !== currentPosition && index >= 0 && index < entries.length) {
      onJumpTo(index);
    }
  }, [currentPosition, entries.length, onJumpTo]);

  if (entries.length <= 1) return null;

  const progressPercent = entries.length > 1 ? (currentPosition / (entries.length - 1)) * 100 : 0;

  return (
    <div className={cn('border border-border/50 rounded-lg bg-card/50 backdrop-blur-sm', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/30 transition-colors rounded-lg"
        aria-expanded={expanded}
        aria-label="Toggle session replay timeline"
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span className="font-medium">Session Timeline</span>
          <span className="text-[10px] text-muted-foreground/60">
            {entries.length} snapshots · {formatRelativeTime(entries[0].timestamp)} → {formatRelativeTime(entries[entries.length - 1].timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground/50">
            {currentPosition + 1}/{entries.length}
          </span>
          {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>

      {/* Compact scrubber bar (always visible) */}
      <div className="px-3 pb-2">
        <div className="relative h-2 bg-muted/30 rounded-full overflow-hidden cursor-pointer group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const pct = x / rect.width;
            const idx = Math.round(pct * (entries.length - 1));
            handleJump(Math.max(0, Math.min(entries.length - 1, idx)));
          }}
          role="slider"
          aria-label="Session timeline scrubber"
          aria-valuemin={0}
          aria-valuemax={entries.length - 1}
          aria-valuenow={currentPosition}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') handleJump(Math.max(0, currentPosition - 1));
            if (e.key === 'ArrowRight') handleJump(Math.min(entries.length - 1, currentPosition + 1));
          }}
        >
          {/* Progress fill */}
          <div className="absolute inset-y-0 left-0 bg-primary/40 rounded-full transition-all duration-150"
            style={{ width: `${progressPercent}%` }} />
          {/* Dot markers for each entry */}
          {entries.map((_, i) => {
            const left = entries.length > 1 ? (i / (entries.length - 1)) * 100 : 50;
            const isCurrent = i === currentPosition;
            const isPast = i <= currentPosition;
            return (
              <div
                key={i}
                className={cn(
                  'absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-150',
                  isCurrent ? 'w-3 h-3 bg-primary ring-2 ring-primary/30 z-10' :
                  isPast ? 'w-1.5 h-1.5 bg-primary/60 group-hover:w-2 group-hover:h-2' :
                  'w-1.5 h-1.5 bg-muted-foreground/30 group-hover:w-2 group-hover:h-2'
                )}
                style={{ left: `${left}%`, transform: `translate(-50%, -50%)` }}
              />
            );
          })}
        </div>
      </div>

      {/* Expanded detail view */}
      {expanded && (
        <div className="px-3 pb-3 space-y-1 max-h-48 overflow-y-auto">
          {entries.map((entry, i) => {
            const isCurrent = i === currentPosition;
            const changes = changeSummaries[i];
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleJump(i)}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 rounded text-[11px] transition-colors text-left',
                  isCurrent ? 'bg-primary/10 text-primary border border-primary/20' :
                  hoveredIndex === i ? 'bg-muted/50 text-foreground' :
                  'text-muted-foreground hover:bg-muted/30'
                )}
                aria-label={`Jump to snapshot ${i + 1}: ${entry.label || formatTime(entry.timestamp)}`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {/* Index */}
                <span className="w-5 text-center font-mono text-[9px] text-muted-foreground/50 flex-shrink-0">
                  {i + 1}
                </span>
                {/* Dot */}
                <span className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  isCurrent ? 'bg-primary' : i < currentPosition ? 'bg-primary/40' : 'bg-muted-foreground/20'
                )} />
                {/* Time */}
                <span className="font-mono text-[10px] flex-shrink-0 w-16">
                  {formatTime(entry.timestamp)}
                </span>
                {/* Label or change summary */}
                <span className="flex-1 truncate">
                  {entry.label || (i === 0 ? 'Initial state' : `${changes.changed} field${changes.changed !== 1 ? 's' : ''} changed`)}
                </span>
                {/* Change keys preview */}
                {changes.keys.length > 0 && (
                  <span className="text-[9px] text-muted-foreground/40 truncate max-w-24 hidden sm:inline">
                    {changes.keys.join(', ')}
                  </span>
                )}
                {/* Current indicator */}
                {isCurrent && (
                  <span className="text-[9px] font-medium text-primary flex-shrink-0">●</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SessionReplayTimeline;
