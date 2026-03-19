import { useEffect, useRef } from "react";

interface VoiceOrbProps {
  /** Current state of the voice system */
  state: "idle" | "listening" | "processing" | "speaking";
  /** Size in pixels. Default 48 */
  size?: number;
  /** Additional className */
  className?: string;
}

/**
 * Animated voice orb that visualizes the current voice state.
 * - idle: subtle breathing pulse
 * - listening: red pulsing rings (recording)
 * - processing: spinning amber glow
 * - speaking: blue expanding ripples
 */
export function VoiceOrb({ state, size = 48, className = "" }: VoiceOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = size * 0.25;

    const colors = {
      idle: { core: "rgba(14, 165, 233, 0.6)", ring: "rgba(14, 165, 233, 0.15)" },
      listening: { core: "rgba(248, 113, 113, 0.8)", ring: "rgba(248, 113, 113, 0.2)" },
      processing: { core: "rgba(251, 191, 36, 0.7)", ring: "rgba(251, 191, 36, 0.15)" },
      speaking: { core: "rgba(14, 165, 233, 0.8)", ring: "rgba(14, 165, 233, 0.2)" },
    };

    const animate = () => {
      timeRef.current += 0.02;
      const t = timeRef.current;
      ctx.clearRect(0, 0, size, size);

      const c = colors[state];

      if (state === "idle") {
        // Gentle breathing pulse
        const pulse = 1 + Math.sin(t * 1.5) * 0.08;
        const r = baseRadius * pulse;

        // Outer glow
        const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2);
        grad.addColorStop(0, c.ring);
        grad.addColorStop(1, "transparent");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.fillStyle = c.core;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (state === "listening") {
        // Pulsing rings expanding outward
        for (let i = 0; i < 3; i++) {
          const phase = (t * 2 + i * 0.7) % 2;
          const ringR = baseRadius + phase * baseRadius * 1.2;
          const alpha = Math.max(0, 1 - phase / 2);
          ctx.strokeStyle = `rgba(248, 113, 113, ${alpha * 0.4})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Core with slight wobble
        const wobble = 1 + Math.sin(t * 8) * 0.05;
        ctx.fillStyle = c.core;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * wobble, 0, Math.PI * 2);
        ctx.fill();
      } else if (state === "processing") {
        // Spinning arcs
        for (let i = 0; i < 3; i++) {
          const startAngle = t * 3 + (i * Math.PI * 2) / 3;
          const arcLen = Math.PI * 0.5;
          const r = baseRadius * 1.3 + i * 3;
          ctx.strokeStyle = `rgba(251, 191, 36, ${0.6 - i * 0.15})`;
          ctx.lineWidth = 2.5 - i * 0.5;
          ctx.beginPath();
          ctx.arc(cx, cy, r, startAngle, startAngle + arcLen);
          ctx.stroke();
        }

        // Core
        const pulse = 1 + Math.sin(t * 4) * 0.06;
        ctx.fillStyle = c.core;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * 0.8 * pulse, 0, Math.PI * 2);
        ctx.fill();
      } else if (state === "speaking") {
        // Expanding ripples (like sound waves)
        for (let i = 0; i < 4; i++) {
          const phase = (t * 1.8 + i * 0.5) % 2.5;
          const ringR = baseRadius * 0.8 + phase * baseRadius * 0.8;
          const alpha = Math.max(0, 1 - phase / 2.5);
          ctx.strokeStyle = `rgba(14, 165, 233, ${alpha * 0.35})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Core with amplitude variation (simulating speech)
        const amp = 1 + (Math.sin(t * 12) * 0.04 + Math.sin(t * 7) * 0.06);
        ctx.fillStyle = c.core;
        ctx.beginPath();
        ctx.arc(cx, cy, baseRadius * amp, 0, Math.PI * 2);
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [state, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={`${className}`}
      style={{ width: size, height: size }}
    />
  );
}
