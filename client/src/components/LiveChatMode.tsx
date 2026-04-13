/**
 * LiveChat Mode — Continuous visual + verbal AI conversation
 * Features:
 * - Camera feed preview in chat area
 * - Periodic frame capture → send to LLM as image context
 * - Continuous speech recognition → auto-send to AI
 * - AI responds with voice (TTS) in hands-free mode
 * - Audible cues for processing status
 * - Toggle between live video/screen modes
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Video, Monitor, Mic, MicOff, Volume2, VolumeX,
  Play, Pause, Square, Camera, Loader2, AlertCircle,
  Maximize2, Minimize2,
} from "lucide-react";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useVideoCapture } from "@/hooks/useVideoCapture";
import { toast } from "sonner";

type CaptureMode = "video" | "screen";
type ProcessingState = "idle" | "listening" | "thinking" | "speaking";

interface LiveChatModeProps {
  onSendFrame?: (blob: Blob) => void;
  onSendTranscript?: (text: string) => void;
  onClose?: () => void;
  isProcessing?: boolean;
  aiResponse?: string;
}

// Audible cue frequencies
const AUDIO_CUES = {
  listening: { freq: 440, duration: 150 },
  thinking: { freq: 330, duration: 200 },
  speaking: { freq: 520, duration: 100 },
  error: { freq: 220, duration: 300 },
};

function playAudioCue(type: keyof typeof AUDIO_CUES) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = AUDIO_CUES[type].freq;
    gain.gain.value = 0.1;
    osc.start();
    osc.stop(ctx.currentTime + AUDIO_CUES[type].duration / 1000);
    setTimeout(() => ctx.close(), AUDIO_CUES[type].duration + 100);
  } catch {
    // Audio context not available
  }
}

export function LiveChatMode({
  onSendFrame,
  onSendTranscript,
  onClose,
  isProcessing = false,
  aiResponse,
}: LiveChatModeProps) {
  const [mode, setMode] = useState<CaptureMode>("video");
  const [processingState, setProcessingState] = useState<ProcessingState>("idle");
  const [isListening, setIsListening] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const screenCapture = useScreenCapture({
    onCapture: (blob: Blob) => onSendFrame?.(blob),
    onError: (err: Error) => setError(err.message),
  });

  const videoCapture = useVideoCapture({
    onCapture: (blob: Blob) => onSendFrame?.(blob),
    onError: (err: Error) => setError(err.message),
  });

  const capture = mode === "video" ? videoCapture : screenCapture;

  // ─── Speech Recognition ──────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      setError("Speech recognition not supported in this browser");
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      if (finalTranscript) {
        setTranscript(finalTranscript);
        onSendTranscript?.(finalTranscript);
        if (audioEnabled) playAudioCue("thinking");
        setProcessingState("thinking");
      } else {
        setTranscript(interimTranscript);
      }
    };

    recognition.onstart = () => {
      setIsListening(true);
      setProcessingState("listening");
      if (audioEnabled) playAudioCue("listening");
    };

    recognition.onend = () => {
      // Auto-restart if still in listening mode
      if (isListening && !isMuted) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone permissions.");
      } else if (event.error !== "aborted" && event.error !== "no-speech") {
        console.warn("Speech recognition error:", event.error);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (err) {
      setError("Failed to start speech recognition");
    }
  }, [isListening, isMuted, audioEnabled, onSendTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setProcessingState("idle");
  }, []);

  // ─── Periodic Frame Capture ──────────────────────────────────────
  const startFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);

    frameIntervalRef.current = setInterval(async () => {
      const frame = await capture.captureFrame();
      if (frame) {
        setFrameCount(c => c + 1);
        onSendFrame?.(frame);
      }
    }, 5000); // Capture every 5 seconds
  }, [capture, onSendFrame]);

  const stopFrameCapture = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  }, []);

  // ─── TTS for AI responses ───────────────────────────────────────
  useEffect(() => {
    if (aiResponse && audioEnabled && !isMuted) {
      setProcessingState("speaking");
      if (audioEnabled) playAudioCue("speaking");

      const utterance = new SpeechSynthesisUtterance(aiResponse);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.onend = () => {
        setProcessingState("listening");
        // Resume listening after speaking
        if (isListening && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
        }
      };
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  }, [aiResponse]);

  // ─── Start/Stop Live Mode ───────────────────────────────────────
  const startLiveMode = useCallback(async () => {
    setError(null);
    await capture.startCapture();
    startListening();
    startFrameCapture();
  }, [capture, startListening, startFrameCapture]);

  const stopLiveMode = useCallback(() => {
    capture.stopCapture();
    stopListening();
    stopFrameCapture();
    window.speechSynthesis.cancel();
    setProcessingState("idle");
  }, [capture, stopListening, stopFrameCapture]);

  // ─── Attach video stream to preview ─────────────────────────────
  useEffect(() => {
    if (capture.isCapturing && videoPreviewRef.current) {
      const videoEl = mode === "video" ? videoCapture.videoRef?.current : screenCapture.videoPreviewRef?.current;
      if (videoEl?.srcObject) {
        videoPreviewRef.current.srcObject = videoEl.srcObject;
        videoPreviewRef.current.play().catch(() => {});
      }
    }
  }, [capture.isCapturing, mode]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveMode();
    };
  }, []);

  // ─── Processing state indicator ─────────────────────────────────
  const stateColors: Record<ProcessingState, string> = {
    idle: "bg-muted",
    listening: "bg-green-500/20 text-green-600",
    thinking: "bg-yellow-500/20 text-yellow-600",
    speaking: "bg-blue-500/20 text-blue-600",
  };

  const stateLabels: Record<ProcessingState, string> = {
    idle: "Ready",
    listening: "Listening...",
    thinking: "Thinking...",
    speaking: "Speaking...",
  };

  return (
    <Card className={`border-2 transition-all ${isExpanded ? "fixed inset-4 z-50" : ""} ${
      capture.isCapturing ? "border-green-500/50" : "border-border"
    }`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={stateColors[processingState]}>
              {processingState === "thinking" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              {stateLabels[processingState]}
            </Badge>
            {capture.isCapturing && (
              <Badge variant="secondary" className="text-xs">
                {frameCount} frames captured
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="icon-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Minimize" : "Maximize"}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            {onClose && (
              <Button variant="ghost" size="icon-sm" onClick={() => { stopLiveMode(); onClose(); }} aria-label="Stop live mode">
                <Square className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Video Preview */}
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {capture.isCapturing ? (
            <video
              ref={videoPreviewRef}
              className="w-full h-full object-cover"
              autoPlay
              muted
              playsInline
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              {mode === "video" ? <Video className="w-8 h-8" /> : <Monitor className="w-8 h-8" />}
              <span className="text-sm">Click Start to begin live mode</span>
            </div>
          )}

          {/* Overlay controls */}
          {capture.isCapturing && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex gap-1">
                <Button
                  size="sm" variant={isListening ? "default" : "secondary"}
                  className="h-7 text-xs"
                  onClick={() => isListening ? stopListening() : startListening()}
                >
                  {isListening ? <Mic className="w-3 h-3 mr-1" /> : <MicOff className="w-3 h-3 mr-1" />}
                  {isListening ? "Listening" : "Muted"}
                </Button>
                <Button
                  size="sm" variant="secondary" className="h-7 text-xs"
                  onClick={() => setAudioEnabled(!audioEnabled)}
                >
                  {audioEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                </Button>
              </div>
              <Button
                size="sm" variant="secondary" className="h-7 text-xs"
                onClick={async () => {
                  const frame = await capture.captureFrame();
                  if (frame) { onSendFrame?.(frame); toast.success("Frame captured"); }
                }}
              >
                <Camera className="w-3 h-3 mr-1" /> Snap
              </Button>
            </div>
          )}
        </div>

        {/* Mode Toggle + Controls */}
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-md p-0.5 gap-0.5">
            <Button
              size="sm" variant={mode === "video" ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => { if (!capture.isCapturing) setMode("video"); }}
              disabled={capture.isCapturing}
            >
              <Video className="w-3 h-3 mr-1" /> Camera
            </Button>
            <Button
              size="sm" variant={mode === "screen" ? "default" : "ghost"}
              className="h-7 text-xs"
              onClick={() => { if (!capture.isCapturing) setMode("screen"); }}
              disabled={capture.isCapturing}
            >
              <Monitor className="w-3 h-3 mr-1" /> Screen
            </Button>
          </div>

          <div className="flex-1" />

          {!capture.isCapturing ? (
            <Button size="sm" onClick={startLiveMode} className="h-7">
              <Play className="w-3 h-3 mr-1" /> Start Live
            </Button>
          ) : (
            <div className="flex gap-1">
              {capture.isPaused ? (
                <Button size="sm" variant="secondary" onClick={capture.resumeCapture} className="h-7">
                  <Play className="w-3 h-3 mr-1" /> Resume
                </Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={capture.pauseCapture} className="h-7">
                  <Pause className="w-3 h-3 mr-1" /> Pause
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={stopLiveMode} className="h-7">
                <Square className="w-3 h-3 mr-1" /> Stop
              </Button>
            </div>
          )}
        </div>

        {/* Live Transcript */}
        {transcript && (
          <div className="bg-muted/50 rounded p-2 text-sm">
            <span className="text-xs text-muted-foreground">Transcript: </span>
            {transcript}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
