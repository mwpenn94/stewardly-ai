/**
 * Sound Design — Web Audio API sound cues for chat interactions
 * Opt-in only, disabled by default. Toggle in Settings.
 */
import { useCallback, useRef } from "react";

type SoundCue = "sent" | "received" | "error" | "success" | "listening" | "thinking" | "streaming";

const FREQUENCIES: Record<SoundCue, { freq: number; duration: number; type: OscillatorType; gain: number }> = {
  sent: { freq: 600, duration: 80, type: "sine", gain: 0.08 },
  received: { freq: 800, duration: 100, type: "sine", gain: 0.06 },
  error: { freq: 300, duration: 200, type: "triangle", gain: 0.10 },
  success: { freq: 1000, duration: 60, type: "sine", gain: 0.06 },
  listening: { freq: 500, duration: 150, type: "sine", gain: 0.05 },
  thinking: { freq: 400, duration: 120, type: "triangle", gain: 0.04 },
  streaming: { freq: 700, duration: 30, type: "sine", gain: 0.015 },
};

export function useSoundCues() {
  const ctxRef = useRef<AudioContext | null>(null);
  const enabled = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((cue: SoundCue) => {
    if (!enabled.current) return;
    try {
      const ctx = getCtx();
      const config = FREQUENCIES[cue];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = config.type;
      osc.frequency.setValueAtTime(config.freq, ctx.currentTime);

      // Envelope: quick attack, sustain, quick release
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(config.gain, ctx.currentTime + 0.01);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + config.duration / 1000);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + config.duration / 1000 + 0.01);
    } catch {
      // Audio API not available — silent fail
    }
  }, [getCtx]);

  const setEnabled = useCallback((val: boolean) => {
    enabled.current = val;
  }, []);

  // G43: Throttled streaming tick — max once per 200ms to avoid audio spam
  const lastStreamTickRef = useRef(0);
  const playStreaming = useCallback(() => {
    const now = Date.now();
    if (now - lastStreamTickRef.current < 200) return;
    lastStreamTickRef.current = now;
    play("streaming");
  }, [play]);

  return { play, playStreaming, setEnabled, isEnabled: () => enabled.current };
}
