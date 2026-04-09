/**
 * CelebrationEngine.tsx — Lightweight particle celebration system
 *
 * Pass 111. Canvas-based particle burst for success states.
 * NOT emoji confetti — subtle, branded, professional.
 * Uses the platform's color tokens.
 *
 * Usage: const celebrate = useCelebration();
 *        celebrate("light");  // quiz correct
 *        celebrate("medium"); // exam passed
 *        celebrate("heavy");  // major milestone
 */

import { useCallback } from "react";

/* ── particle config ───────────────────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

const COLORS = [
  "oklch(0.76 0.14 80)",   // stewardship gold
  "oklch(0.65 0.17 160)",  // emerald
  "oklch(0.72 0.15 85)",   // amber
  "oklch(0.6 0.15 300)",   // purple
];

const INTENSITY = {
  light: { count: 12, speed: 3, lifetime: 0.015, radius: [2, 4] as [number, number] },
  medium: { count: 30, speed: 5, lifetime: 0.01, radius: [2, 5] as [number, number] },
  heavy: { count: 60, speed: 7, lifetime: 0.007, radius: [2, 6] as [number, number] },
};

/* ── canvas renderer ───────────────────────────────────────────── */

function createCelebration(
  intensity: "light" | "medium" | "heavy",
  originX?: number,
  originY?: number,
) {
  // Check reduced motion
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999";
  canvas.width = window.innerWidth * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  if (!ctx) { canvas.remove(); return; }
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  const config = INTENSITY[intensity];
  const cx = originX ?? window.innerWidth / 2;
  const cy = originY ?? window.innerHeight * 0.4;

  const particles: Particle[] = [];
  for (let i = 0; i < config.count; i++) {
    const angle = (Math.PI * 2 * i) / config.count + (Math.random() - 0.5) * 0.5;
    const speed = config.speed * (0.5 + Math.random() * 0.5);
    const [minR, maxR] = config.radius;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      radius: minR + Math.random() * (maxR - minR),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 1,
      decay: config.lifetime * (0.8 + Math.random() * 0.4),
    });
  }

  let animId: number;
  const animate = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    let alive = false;
    for (const p of particles) {
      if (p.alpha <= 0) continue;
      alive = true;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.vx *= 0.98;
      p.alpha -= p.decay;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace(")", ` / ${Math.max(0, p.alpha)})`);
      ctx.fill();
    }

    if (alive) {
      animId = requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  };

  animId = requestAnimationFrame(animate);

  setTimeout(() => {
    try { cancelAnimationFrame(animId); } catch {}
    try { canvas.remove(); } catch {}
  }, 3000);
}

/* ── hook ──────────────────────────────────────────────────────── */

export function useCelebration() {
  return useCallback((
    intensity: "light" | "medium" | "heavy" = "medium",
    originX?: number,
    originY?: number,
  ) => {
    createCelebration(intensity, originX, originY);
  }, []);
}

export default useCelebration;
