/**
 * earcons.ts — Short UI confirmation sounds
 *
 * Build Loop Pass 12 (G42). Small library of sub-200ms tones used as
 * "you just triggered a thing" confirmations for keyboard chord
 * navigation, command palette open, and other discreet UI actions.
 *
 * Implementation: Web Audio API oscillator + linear gain envelope.
 * No blob loading, no asset pipeline, no CDN — the sounds are
 * synthesized on demand so the first trigger is instant.
 *
 * Volume is conservative (0.04 peak) so the earcon layer blends in
 * under TTS + page audio without stepping on either. Users who want
 * the app silent can set `body.reduced-motion-user` — the CSS class
 * doesn't suppress audio, but this helper respects a dedicated
 * `body.earcons-muted` class for users who want the silent experience.
 *
 * Pure-function API with dependency injection so the trigger logic
 * is testable (tests pass in a fake AudioContext factory).
 */

type OscillatorType = "sine" | "square" | "triangle" | "sawtooth";

export interface EarconSpec {
  /** Starting frequency in Hz. */
  freq: number;
  /** Duration in seconds. */
  dur: number;
  /** Oscillator waveform. */
  type: OscillatorType;
  /** Optional follow-up tone (same shape). */
  then?: EarconSpec;
}

export const EARCONS: Record<string, EarconSpec> = {
  // Palette open — a quick C → E rising chirp
  palette_open: {
    freq: 523, // C5
    dur: 0.06,
    type: "sine",
    then: { freq: 659, dur: 0.06, type: "sine" }, // E5
  },
  // Palette close — inverse (E → C)
  palette_close: {
    freq: 659,
    dur: 0.06,
    type: "sine",
    then: { freq: 523, dur: 0.06, type: "sine" },
  },
  // Chord primed ("g" pressed, waiting for second key) — short tick
  chord_primed: {
    freq: 880, // A5
    dur: 0.03,
    type: "sine",
  },
  // Chord matched (g+letter → navigation fires) — confirm tone
  chord_matched: {
    freq: 1047, // C6
    dur: 0.06,
    type: "sine",
    then: { freq: 784, dur: 0.08, type: "sine" }, // G5
  },
  // Generic send earcon — same shape as PlatformIntelligence.SOUNDS.send
  send: {
    freq: 880,
    dur: 0.08,
    type: "sine",
  },
};

/**
 * AudioContext factory — injected so tests can pass a fake that
 * records the spec without actually producing sound.
 */
export type AudioContextFactory = () => {
  currentTime: number;
  destination: any;
  createOscillator: () => {
    type: OscillatorType;
    frequency: { value: number };
    connect: (dest: any) => any;
    start: () => void;
    stop: (time: number) => void;
  };
  createGain: () => {
    gain: {
      value: number;
      exponentialRampToValueAtTime: (value: number, endTime: number) => void;
    };
    connect: (dest: any) => any;
  };
};

/**
 * Pure runner — takes a spec + factory, produces the sound, calls
 * the optional `then` follow-up after `dur` seconds.
 *
 * Exported so tests can verify the spec shape without polluting the
 * real audio pipeline.
 */
export function playEarcon(
  spec: EarconSpec,
  factory?: AudioContextFactory | null,
): void {
  // Respect the user-level mute class.
  try {
    if (
      typeof document !== "undefined" &&
      document.body?.classList.contains("earcons-muted")
    ) {
      return;
    }
  } catch {
    /* ignore */
  }

  try {
    const getCtx =
      factory ??
      ((): any => {
        if (typeof window === "undefined") return null;
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        return AC ? new AC() : null;
      });
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    gain.gain.value = 0.04;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec.dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + spec.dur);
    if (spec.then) {
      setTimeout(() => playEarcon(spec.then!, factory), spec.dur * 1000);
    }
  } catch {
    /* AudioContext not available or creation failed — silent fail is OK */
  }
}

/** Convenience: play by earcon id from the inventory. */
export function playEarconById(id: keyof typeof EARCONS | string): void {
  const spec = EARCONS[id as keyof typeof EARCONS];
  if (spec) playEarcon(spec);
}
