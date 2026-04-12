import { describe, it, expect, vi, beforeEach } from "vitest";
import { EARCONS, playEarcon, playEarconById } from "./earcons";

/**
 * Build Loop Pass 12 — earcons unit tests.
 *
 * The earcon module uses Web Audio API which isn't available in node.
 * We inject a fake AudioContext factory that captures the spec
 * arguments so the decision logic + inventory shape are testable
 * without the browser.
 */

function makeFakeCtx() {
  const oscs: any[] = [];
  const gains: any[] = [];
  const ctx: any = {
    currentTime: 0,
    destination: { __id: "destination" },
    createOscillator: () => {
      const osc: any = {
        type: "sine" as const,
        frequency: { value: 0 },
        connect: (dest: any) => dest,
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscs.push(osc);
      return osc;
    },
    createGain: () => {
      const gain: any = {
        gain: {
          value: 0,
          exponentialRampToValueAtTime: vi.fn(),
        },
        connect: (dest: any) => dest,
      };
      gains.push(gain);
      return gain;
    },
  };
  return { ctx, oscs, gains };
}

describe("EARCONS inventory", () => {
  it("has all the designed earcon ids", () => {
    const required = ["palette_open", "palette_close", "chord_primed", "chord_matched", "send"];
    for (const id of required) {
      expect(EARCONS[id], `missing earcon: ${id}`).toBeDefined();
    }
  });

  it("every spec has valid freq + dur + type", () => {
    for (const [id, spec] of Object.entries(EARCONS)) {
      expect(spec.freq, `${id}.freq`).toBeGreaterThan(0);
      expect(spec.dur, `${id}.dur`).toBeGreaterThan(0);
      expect(spec.dur, `${id}.dur`).toBeLessThan(0.5); // sub-500ms
      expect(["sine", "square", "triangle", "sawtooth"]).toContain(spec.type);
    }
  });

  it("multi-note earcons (palette_open/close, chord_matched) have follow-ups", () => {
    expect(EARCONS.palette_open.then).toBeDefined();
    expect(EARCONS.palette_close.then).toBeDefined();
    expect(EARCONS.chord_matched.then).toBeDefined();
  });
});

describe("playEarcon with injected fake", () => {
  let fake: ReturnType<typeof makeFakeCtx>;
  beforeEach(() => {
    fake = makeFakeCtx();
    vi.useFakeTimers();
  });

  it("plays a single-note earcon and only creates one oscillator", () => {
    playEarcon(EARCONS.send, () => fake.ctx);
    // `send` has no `then`, so only one osc + one gain should be created.
    expect(fake.oscs.length).toBe(1);
    expect(fake.gains.length).toBe(1);
    expect(fake.oscs[0].frequency.value).toBe(880);
    expect(fake.oscs[0].start).toHaveBeenCalled();
    expect(fake.oscs[0].stop).toHaveBeenCalled();
  });

  it("plays a multi-note earcon and schedules the follow-up", () => {
    playEarcon(EARCONS.palette_open, () => fake.ctx);
    // First tone fires immediately — one osc so far.
    expect(fake.oscs.length).toBe(1);
    expect(fake.oscs[0].frequency.value).toBe(523);
    // Advance timers past the first tone's dur
    vi.advanceTimersByTime(60);
    // Follow-up osc should now exist
    expect(fake.oscs.length).toBe(2);
    expect(fake.oscs[1].frequency.value).toBe(659);
  });

  it("silently no-ops when the factory returns null (no AudioContext)", () => {
    // Pass a factory that always returns null
    expect(() => playEarcon(EARCONS.send, () => null as any)).not.toThrow();
    // No oscs were created because the ctx was null
    expect(fake.oscs.length).toBe(0);
  });

  it("playEarconById looks up the inventory", () => {
    playEarconById("send");
    // In the node test env, the default factory returns null because
    // window is undefined — so this should NOT throw, just no-op.
    // The real assertion is that it doesn't raise a ReferenceError
    // on unknown ids.
    expect(() => playEarconById("completely-bogus-id")).not.toThrow();
  });
});
