/**
 * ConversationalVoiceOverlay — Full-duplex voice mode UI (G6)
 *
 * A full-screen overlay that provides a ChatGPT Advanced Voice-like experience:
 * - Animated orb that responds to VAD energy levels
 * - Shows current state (listening, processing, speaking)
 * - Displays interim/final transcripts
 * - Barge-in support (speak to interrupt TTS)
 * - Tap-to-dismiss or voice "stop" command
 */

import { useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { X, Mic, MicOff, Volume2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConversationalState } from "@/hooks/useConversationalVoice";

interface ConversationalVoiceOverlayProps {
  state: ConversationalState;
  vadLevel: number;
  interimTranscript: string;
  lastAssistantText?: string;
  onClose: () => void;
}

export function ConversationalVoiceOverlay({
  state,
  vadLevel,
  interimTranscript,
  lastAssistantText,
  onClose,
}: ConversationalVoiceOverlayProps) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  // ── Orb animation ──────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 200;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    let phase = 0;

    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const baseRadius = 60;

      // Energy-responsive radius
      const energy = Math.min(vadLevel * 8, 1); // Amplify for visibility
      const pulseRadius = baseRadius + energy * 25;

      // State-based colors
      let primaryColor: string;
      let glowColor: string;
      let pulseSpeed: number;

      switch (state) {
        case "listening":
          primaryColor = "rgba(212, 175, 55, 0.9)"; // Stewardship Gold
          glowColor = "rgba(212, 175, 55, 0.15)";
          pulseSpeed = 0.02;
          break;
        case "processing":
          primaryColor = "rgba(59, 130, 246, 0.9)"; // Blue
          glowColor = "rgba(59, 130, 246, 0.15)";
          pulseSpeed = 0.06; // Faster spin
          break;
        case "speaking":
          primaryColor = "rgba(34, 197, 94, 0.9)"; // Green
          glowColor = "rgba(34, 197, 94, 0.15)";
          pulseSpeed = 0.03;
          break;
        default:
          primaryColor = "rgba(148, 163, 184, 0.5)"; // Muted
          glowColor = "rgba(148, 163, 184, 0.1)";
          pulseSpeed = 0.01;
      }

      phase += pulseSpeed;

      // Outer glow
      const glowRadius = pulseRadius + 20 + Math.sin(phase) * 8;
      const gradient = ctx.createRadialGradient(cx, cy, pulseRadius * 0.5, cx, cy, glowRadius);
      gradient.addColorStop(0, glowColor);
      gradient.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Main orb with organic deformation
      ctx.beginPath();
      const points = 64;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const deform = state === "listening"
          ? Math.sin(angle * 3 + phase * 2) * energy * 12
          : state === "processing"
          ? Math.sin(angle * 5 + phase * 4) * 6
          : state === "speaking"
          ? Math.sin(angle * 4 + phase * 3) * energy * 8
          : 0;
        const r = pulseRadius + deform;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = primaryColor;
      ctx.fill();

      // Inner highlight
      const innerGrad = ctx.createRadialGradient(
        cx - 15, cy - 15, 5,
        cx, cy, pulseRadius
      );
      innerGrad.addColorStop(0, "rgba(255, 255, 255, 0.3)");
      innerGrad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, pulseRadius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = innerGrad;
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [state, vadLevel]);

  // ── State label ────────────────────────────────────────────
  const stateLabel = useMemo(() => {
    switch (state) {
      case "listening": return t("voice.listening");
      case "processing": return t("voice.processing");
      case "speaking": return t("voice.speaking");
      case "paused": return t("voice.ready");
      default: return t("voice.ready");
    }
  }, [state, t]);

  const StateIcon = useMemo(() => {
    switch (state) {
      case "listening": return Mic;
      case "processing": return Loader2;
      case "speaking": return Volume2;
      default: return MicOff;
    }
  }, [state]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl"
      role="dialog"
      aria-label={t("a11y.voiceModeDialog")}
      aria-live="polite"
    >
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white/60 hover:text-white hover:bg-white/10"
        onClick={onClose}
        aria-label={t("common.close")}
      >
        <X className="h-6 w-6" />
      </Button>

      {/* Orb */}
      <canvas
        ref={canvasRef}
        className="mb-8"
        aria-hidden="true"
      />

      {/* State indicator */}
      <div className="flex items-center gap-2 mb-4 text-white/80">
        <StateIcon className={`h-5 w-5 ${state === "processing" ? "animate-spin" : ""}`} />
        <span className="text-lg font-medium">{stateLabel}</span>
      </div>

      {/* Transcript display */}
      {interimTranscript && (
        <div className="max-w-md px-6 text-center">
          <p className="text-white/60 text-sm italic">{interimTranscript}</p>
        </div>
      )}

      {/* Last assistant response (truncated) */}
      {state === "speaking" && lastAssistantText && (
        <div className="max-w-md px-6 mt-4 text-center">
          <p className="text-white/40 text-xs line-clamp-3">
            {lastAssistantText.slice(0, 200)}
            {lastAssistantText.length > 200 ? "..." : ""}
          </p>
        </div>
      )}

      {/* Hint text */}
      <div className="absolute bottom-8 text-center">
        <p className="text-white/30 text-xs">
          {state === "speaking"
            ? `${t("voice.speakToInterrupt")} • ${t("voice.tapToClose")}`
            : state === "listening"
            ? `${t("voice.saySomething")} • ${t("voice.tapToClose")}`
            : t("voice.processing")}
        </p>
      </div>
    </div>
  );
}
