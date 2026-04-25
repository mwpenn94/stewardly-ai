/**
 * PomodoroTimer.tsx — Floating Pomodoro timer widget
 *
 * Pass 36 / Pass 38 fix / Pass 153 session logging.
 * A draggable floating timer that supports work/break cycles.
 * Can be toggled from any learning page. Persists across navigation.
 *
 * When used globally (no onClose prop), manages its own visibility state.
 * When used with onClose prop, delegates close behavior to parent.
 *
 * Pass 153: Now logs completed work cycles as study sessions via
 * learningSocial.studySessions.record so the activity heatmap populates.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import {
  Timer, Play, Pause, RotateCcw, X,
  Coffee, Brain, ChevronDown, ChevronUp,
} from "lucide-react";

interface PomodoroTimerProps {
  /** Optional close handler. If omitted, the timer manages its own visibility. */
  onClose?: () => void;
}

type Phase = "work" | "shortBreak" | "longBreak";

const DURATIONS: Record<Phase, number> = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

const PHASE_LABELS: Record<Phase, string> = {
  work: "Focus",
  shortBreak: "Short Break",
  longBreak: "Long Break",
};

export function PomodoroTimer({ onClose }: PomodoroTimerProps = {}) {
  const [phase, setPhase] = useState<Phase>("work");
  const [secondsLeft, setSecondsLeft] = useState(DURATIONS.work);
  const [isRunning, setIsRunning] = useState(false);
  const [completedCycles, setCompletedCycles] = useState(0);
  const [isMinimized, setIsMinimized] = useState(true);
  const [isHidden, setIsHidden] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workStartRef = useRef<number>(Date.now());

  const { isAuthenticated } = useAuth();
  const recordSession = trpc.learningSocial.studySessions.record.useMutation({
    onSuccess: () => {
      toast.success("Pomodoro session logged!", { duration: 2000 });
    },
  });

  const handleClose = useCallback(() => {
    if (onClose) {
      onClose();
    } else {
      setIsHidden(true);
    }
  }, [onClose]);

  // Log a completed work cycle as a study session
  const logWorkCycle = useCallback(() => {
    if (!isAuthenticated) return;
    const elapsed = Math.floor((Date.now() - workStartRef.current) / 1000);
    const durationMinutes = Math.max(1, Math.round(elapsed / 60));
    recordSession.mutate({
      discipline: "pomodoro",
      durationMinutes,
      itemsStudied: 1,
      itemsMastered: 0,
    });
  }, [isAuthenticated, recordSession]);

  // Timer logic
  useEffect(() => {
    if (isRunning && secondsLeft > 0) {
      intervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // Phase complete
            setIsRunning(false);
            // Play notification sound
            try {
              const ctx = new AudioContext();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.value = 800;
              gain.gain.value = 0.3;
              osc.start();
              osc.stop(ctx.currentTime + 0.3);
              setTimeout(() => {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.frequency.value = 1000;
                gain2.gain.value = 0.3;
                osc2.start();
                osc2.stop(ctx.currentTime + 0.3);
              }, 400);
            } catch {}
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, secondsLeft]);

  // Auto-advance phases + log work cycles
  useEffect(() => {
    if (secondsLeft === 0 && !isRunning) {
      if (phase === "work") {
        // Work cycle just completed — log it as a study session
        logWorkCycle();
        const newCycles = completedCycles + 1;
        setCompletedCycles(newCycles);
        if (newCycles % 4 === 0) {
          setPhase("longBreak");
          setSecondsLeft(DURATIONS.longBreak);
        } else {
          setPhase("shortBreak");
          setSecondsLeft(DURATIONS.shortBreak);
        }
      } else {
        setPhase("work");
        setSecondsLeft(DURATIONS.work);
        // Reset work start time for the next cycle
        workStartRef.current = Date.now();
      }
    }
  }, [secondsLeft, isRunning, phase, completedCycles, logWorkCycle]);

  // Track when a work phase starts running
  useEffect(() => {
    if (isRunning && phase === "work") {
      workStartRef.current = Date.now();
    }
  }, [isRunning, phase]);

  const toggleTimer = useCallback(() => setIsRunning((r) => !r), []);
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setSecondsLeft(DURATIONS[phase]);
  }, [phase]);

  // If hidden (self-managed close), render a tiny re-open button
  if (isHidden) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full opacity-40 hover:opacity-100 transition-opacity"
          onClick={() => { setIsHidden(false); setIsMinimized(false); }}
          title="Open Pomodoro Timer"
        >
          <Timer className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const progress = 1 - secondsLeft / DURATIONS[phase];

  const phaseColor = phase === "work" ? "text-red-500" : phase === "shortBreak" ? "text-green-500" : "text-blue-500";
  const phaseIcon = phase === "work" ? <Brain className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />;

  if (isMinimized) {
    return (
      <div className="fixed bottom-20 right-4 z-50">
        <Button
          variant="default"
          size="sm"
          className="rounded-full shadow-lg gap-2"
          onClick={() => setIsMinimized(false)}
        >
          <Timer className="h-4 w-4" />
          <span className="font-mono text-sm">
            {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
          </span>
          {isRunning && <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />}
          <ChevronUp className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 w-64 bg-card border rounded-xl shadow-2xl overflow-hidden">
      {/* Progress bar */}
      <div className="h-1 bg-muted">
        <div
          className={`h-full transition-all duration-1000 ${phase === "work" ? "bg-red-500" : phase === "shortBreak" ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5">
          <Timer className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium">Pomodoro</span>
          {completedCycles > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
              {completedCycles} done
            </Badge>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(true)}>
            <ChevronDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleClose}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Timer display */}
      <div className="px-4 py-4 text-center">
        <div className={`flex items-center justify-center gap-1.5 mb-2 text-xs ${phaseColor}`}>
          {phaseIcon}
          <span className="font-medium">{PHASE_LABELS[phase]}</span>
        </div>
        <div className="text-4xl font-mono font-bold tabular-nums">
          {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
        </div>
        <div className="flex items-center justify-center gap-1 mt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${i < (completedCycles % 4) ? "bg-primary" : "bg-muted"}`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-1.5">Cycle {Math.floor(completedCycles / 4) + 1}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2 px-4 pb-3">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={resetTimer}>
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" className="h-10 w-10 rounded-full" onClick={toggleTimer}>
          {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            const phases: Phase[] = ["work", "shortBreak", "longBreak"];
            const nextIdx = (phases.indexOf(phase) + 1) % phases.length;
            const next = phases[nextIdx];
            setPhase(next);
            setSecondsLeft(DURATIONS[next]);
            setIsRunning(false);
          }}
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
