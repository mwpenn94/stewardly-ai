/**
 * LifeEventsBanner — surfaces proactively-detected life events
 * (marriage, new dependent, HNW crossing, retirement, income
 * spike/drop, estate exposure) with a one-click CTA to the
 * recommended calculator.
 *
 * The banner caches a snapshot of the active profile in
 * localStorage so it only fires when there's a real delta
 * between the previous render and the current one. This keeps
 * first-visit users from seeing a wall of "welcome to the
 * hub" events.
 *
 * Pass 12 history: ships the UI layer for gap G14.
 */

import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  ArrowRight,
  Baby,
  Briefcase,
  CheckCircle2,
  DollarSign,
  Heart,
  LifeBuoy,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserMinus,
} from "lucide-react";
import { useFinancialProfile } from "@/hooks/useFinancialProfile";
import {
  detectLifeEvents,
  type LifeEvent,
  type LifeEventKey,
} from "@/stores/lifeEventDetector";
import type { FinancialProfile } from "@/stores/financialProfile";

const EVENT_ICON: Record<LifeEventKey, React.ReactNode> = {
  marriage: <Heart className="w-4 h-4" />,
  divorce: <UserMinus className="w-4 h-4" />,
  new_dependent: <Baby className="w-4 h-4" />,
  empty_nest: <Sparkles className="w-4 h-4" />,
  business_entry: <Briefcase className="w-4 h-4" />,
  business_exit: <Briefcase className="w-4 h-4" />,
  hnw_crossing: <TrendingUp className="w-4 h-4" />,
  income_spike: <TrendingUp className="w-4 h-4" />,
  income_drop: <TrendingDown className="w-4 h-4" />,
  retirement_approach: <LifeBuoy className="w-4 h-4" />,
  retirement: <LifeBuoy className="w-4 h-4" />,
  estate_exposure: <AlertTriangle className="w-4 h-4" />,
};

const SNAPSHOT_STORAGE_KEY = "stewardly_life_events_snapshot";

function readSnapshot(): FinancialProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as FinancialProfile;
  } catch {
    return null;
  }
}

function writeSnapshot(p: FinancialProfile) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* quota full — noop */
  }
}

interface LifeEventsBannerProps {
  /** Hide the banner entirely when it has nothing to show. */
  hideWhenEmpty?: boolean;
  /** Max events to render (higher severities win). */
  maxEvents?: number;
}

export function LifeEventsBanner({
  hideWhenEmpty = true,
  maxEvents = 3,
}: LifeEventsBannerProps) {
  const [, navigate] = useLocation();
  const { profile } = useFinancialProfile();
  const [dismissed, setDismissed] = useState<Set<LifeEventKey>>(new Set());
  const [snapshot, setSnapshot] = useState<FinancialProfile | null>(() =>
    readSnapshot(),
  );

  const events = useMemo(
    () => detectLifeEvents(snapshot, profile),
    [snapshot, profile],
  );

  const visible = useMemo(
    () => events.filter((e) => !dismissed.has(e.key)).slice(0, maxEvents),
    [events, dismissed, maxEvents],
  );

  // When the profile lands for the first time (snapshot was null),
  // seed the snapshot so we don't spam "welcome" events on the very
  // first render. Subsequent profile mutations will generate events.
  useEffect(() => {
    if (snapshot || Object.keys(profile).length === 0) return;
    writeSnapshot(profile);
    setSnapshot(profile);
  }, [snapshot, profile]);

  const handleDismiss = (key: LifeEventKey) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleAcknowledge = () => {
    // Write the current profile as the new baseline so the same
    // events don't fire again after the user acts on them.
    writeSnapshot(profile);
    setSnapshot(profile);
    setDismissed(new Set());
  };

  if (visible.length === 0 && hideWhenEmpty) return null;
  if (visible.length === 0) {
    return (
      <Card>
        <CardContent className="pt-4 pb-3 text-xs text-muted-foreground text-center">
          <CheckCircle2 className="w-4 h-4 inline mr-1 text-emerald-500" />
          No life events detected since your last session.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="space-y-2"
      role="region"
      aria-label="Life events detected"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-accent" />
          Life events detected
          <Badge variant="outline" className="text-[10px] h-4 px-1">
            {events.length}
          </Badge>
        </div>
        <button
          type="button"
          onClick={handleAcknowledge}
          className="text-[10px] text-muted-foreground hover:text-accent transition-colors"
          aria-label="Acknowledge all life events and update baseline"
        >
          Mark all handled
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {visible.map((event) => (
          <EventCard
            key={event.key}
            event={event}
            onAction={() => navigate(event.suggestedRoute)}
            onDismiss={() => handleDismiss(event.key)}
          />
        ))}
      </div>
    </div>
  );
}

function EventCard({
  event,
  onAction,
  onDismiss,
}: {
  event: LifeEvent;
  onAction: () => void;
  onDismiss: () => void;
}) {
  const toneClass =
    event.severity === "high"
      ? "border-destructive/40 bg-destructive/5"
      : event.severity === "medium"
        ? "border-amber-500/40 bg-amber-500/5"
        : "border-border";

  const toneText =
    event.severity === "high"
      ? "text-destructive"
      : event.severity === "medium"
        ? "text-amber-500"
        : "text-muted-foreground";

  return (
    <Card className={toneClass}>
      <CardContent className="p-3 flex items-start gap-3">
        <span className={`flex-shrink-0 mt-0.5 ${toneText}`}>
          {EVENT_ICON[event.key] ?? <DollarSign className="w-4 h-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{event.title}</p>
            <Badge
              variant="outline"
              className={`text-[10px] h-4 px-1 capitalize ${toneText}`}
            >
              {event.severity}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {event.description}
          </p>
        </div>
        <div className="flex flex-col gap-1 items-end flex-shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            className="h-7 text-xs"
          >
            Open <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <button
            type="button"
            onClick={onDismiss}
            className="text-[9px] text-muted-foreground hover:text-foreground"
            aria-label={`Dismiss ${event.title}`}
          >
            dismiss
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
