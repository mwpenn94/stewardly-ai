import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Camera, CameraOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, Volume2, VolumeX, Loader2, Maximize2, Minimize2,
  Eye, EyeOff
} from "lucide-react";
import { Streamdown } from "streamdown";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

type LiveMode = "camera" | "screen" | null;

interface LiveSessionProps {
  conversationId: number | null;
  onConversationCreated?: (id: number) => void;
  focus: string;
  mode: string;
  onEnd: () => void;
  initialMode?: "camera" | "screen";
}

// Audible cue helper
function playAudioCue(type: "start" | "listening" | "thinking" | "speaking" | "end") {
  if (!window.speechSynthesis) return;
  const cues: Record<string, string> = {
    start: "Live mode active. I can see and hear you.",
    listening: "",
    thinking: "",
    speaking: "",
    end: "Live mode ended.",
  };
  const text = cues[type];
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.1;
  u.volume = 0.7;
  window.speechSynthesis.speak(u);
  return u;
}

export function LiveSession({ conversationId, onConversationCreated, focus, mode, onEnd, initialMode }: LiveSessionProps) {
  // ─── State ────────────────────────────────────────────────────
  const [liveMode, setLiveMode] = useState<LiveMode>(null);
  const autoStarted = useRef(false);
  const [isActive, setIsActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [lastResponse, setLastResponse] = useState("");
  const [statusText, setStatusText] = useState("Initializing...");
  const [frameCount, setFrameCount] = useState(0);

  // ─── Refs ─────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const ttsGuardRef = useRef(false);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFrameDataRef = useRef<string | null>(null);
  const activeRef = useRef(false);
  const convIdRef = useRef(conversationId);

  // ─── Mutations ────────────────────────────────────────────────
  const sendMutation = trpc.chat.send.useMutation();
  const createConversation = trpc.conversations.create.useMutation();

  // Keep convId ref in sync
  useEffect(() => { convIdRef.current = conversationId; }, [conversationId]);

  // ─── Capture a frame from video as base64 JPEG ────────────────
  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width = Math.min(video.videoWidth, 640);
    canvas.height = Math.min(video.videoHeight, 480);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    setFrameCount(prev => prev + 1);
    return dataUrl;
  }, []);

  // ─── Start camera or screen stream ────────────────────────────
  const startStream = useCallback(async (streamMode: LiveMode) => {
    if (!streamMode) return;

    try {
      let stream: MediaStream;
      if (streamMode === "camera") {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: true,
        });
      } else {
        // Screen capture — may fail in iframe
        if (!navigator.mediaDevices?.getDisplayMedia) {
          toast.error("Screen sharing is not available in this browser context. Try using camera mode instead.");
          return;
        }
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" } as any,
            audio: false,
          });
        } catch (err: any) {
          if (err.name === "NotAllowedError" || err.message?.includes("permissions policy")) {
            toast.error("Screen sharing is blocked by browser policy. Try camera mode or open the app in a new tab.");
            return;
          }
          throw err;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Handle stream ending (user stops sharing)
      stream.getTracks().forEach(track => {
        track.onended = () => stopStream();
      });

      setLiveMode(streamMode);
      setIsActive(true);
      activeRef.current = true;
      setStatusText(streamMode === "camera" ? "Camera active" : "Screen sharing active");

    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Failed to start stream";
      toast.error(msg);
      setStatusText("Failed to start");
    }
  }, []);

  // Auto-start with initialMode if provided
  useEffect(() => {
    if (initialMode && !autoStarted.current) {
      autoStarted.current = true;
      startStream(initialMode);
    }
  }, [initialMode, startStream]);

  // ─── Stop stream ──────────────────────────────────────────────
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    setLiveMode(null);
    setIsActive(false);
    activeRef.current = false;
  }, []);

  // ─── Speech Recognition ───────────────────────────────────────
  const startListening = useCallback(() => {
    if (ttsGuardRef.current || isSpeaking) return;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (!transcript?.trim()) return;

      setIsListening(false);
      setStatusText("Processing...");
      setIsProcessing(true);

      // Capture current frame for visual context
      const frame = captureFrame();

      // Send to AI with visual context
      try {
        let activeConvId = convIdRef.current;
        if (!activeConvId) {
          const newConv = await createConversation.mutateAsync({
            mode: mode as any,
            title: `Live session: ${transcript.slice(0, 60)}`,
          });
          activeConvId = newConv.id;
          convIdRef.current = activeConvId;
          onConversationCreated?.(activeConvId);
        }

        // Build content with visual context
        let content = transcript;
        if (frame) {
          content = `[Visual context: The user is sharing their ${liveMode === "camera" ? "camera" : "screen"} with you. Frame #${frameCount}]\n\n${transcript}`;
        }

        const result = await sendMutation.mutateAsync({
          content,
          conversationId: activeConvId,
          mode: mode as any,
          focus: focus as any,
        });

        setLastResponse(result.content);
        setIsProcessing(false);

        // Speak the response
        if (ttsEnabled && window.speechSynthesis) {
          speakResponse(result.content);
        } else {
          setStatusText("Ready — speak anytime");
          // Restart listening
          if (activeRef.current && !isMuted) {
            setTimeout(() => startListening(), 500);
          }
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to process");
        setIsProcessing(false);
        setStatusText("Error — speak again");
        if (activeRef.current && !isMuted) {
          setTimeout(() => startListening(), 1500);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech error:", event.error);
      }
      setIsListening(false);
      // Retry if still active
      if (activeRef.current && !isMuted && !ttsGuardRef.current) {
        setTimeout(() => {
          if (activeRef.current && !ttsGuardRef.current) startListening();
        }, 800);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // Auto-restart if active and not processing
      if (activeRef.current && !isMuted && !ttsGuardRef.current && !isProcessing) {
        setTimeout(() => {
          if (activeRef.current && !ttsGuardRef.current) startListening();
        }, 300);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setStatusText("Listening...");
  }, [isSpeaking, captureFrame, liveMode, frameCount, focus, mode, ttsEnabled, isMuted, isProcessing]);

  // ─── TTS Response ─────────────────────────────────────────────
  const speakResponse = useCallback((text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const cleaned = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/---[\s\S]*$/m, "").trim();
    if (!cleaned) return;

    ttsGuardRef.current = true;
    setIsSpeaking(true);
    setStatusText("Speaking...");

    const chunks = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    chunks.forEach((chunk, i) => {
      const utterance = new SpeechSynthesisUtterance(chunk.trim());
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      if (i === chunks.length - 1) {
        utterance.onend = () => {
          setIsSpeaking(false);
          ttsGuardRef.current = false;
          setStatusText("Ready — speak anytime");
          // Restart listening after speaking
          if (activeRef.current && !isMuted) {
            setTimeout(() => {
              if (activeRef.current && !ttsGuardRef.current) startListening();
            }, 600);
          }
        };
      }
      window.speechSynthesis.speak(utterance);
    });
  }, [isMuted]);

  // ─── Periodic frame capture for context ───────────────────────
  useEffect(() => {
    if (isActive && liveMode) {
      frameIntervalRef.current = setInterval(() => {
        const frame = captureFrame();
        if (frame) lastFrameDataRef.current = frame;
      }, 5000); // Capture frame every 5s for context
    }
    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
        frameIntervalRef.current = null;
      }
    };
  }, [isActive, liveMode, captureFrame]);

  // ─── Auto-start listening when stream starts ──────────────────
  useEffect(() => {
    if (isActive && !isMuted) {
      // Small delay to let stream settle
      const timer = setTimeout(() => {
        const cue = playAudioCue("start");
        if (cue) {
          ttsGuardRef.current = true;
          setIsSpeaking(true);
          cue.onend = () => {
            ttsGuardRef.current = false;
            setIsSpeaking(false);
            startListening();
          };
        } else {
          startListening();
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // ─── Cleanup on unmount ───────────────────────────────────────
  useEffect(() => {
    return () => {
      activeRef.current = false;
      stopStream();
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    };
  }, []);

  // ─── End session ──────────────────────────────────────────────
  const handleEnd = () => {
    activeRef.current = false;
    stopStream();
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
    ttsGuardRef.current = false;
    playAudioCue("end");
    onEnd();
  };

  // ─── Toggle mute ──────────────────────────────────────────────
  const toggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      if (isActive && !ttsGuardRef.current) startListening();
    } else {
      setIsMuted(true);
      recognitionRef.current?.stop();
      setIsListening(false);
    }
  };

  // ─── Status indicator color ───────────────────────────────────
  const statusColor = isSpeaking
    ? "bg-sky-500 animate-pulse"
    : isListening
    ? "bg-red-400 animate-pulse"
    : isProcessing
    ? "bg-yellow-400 animate-pulse"
    : isActive
    ? "bg-emerald-400"
    : "bg-muted-foreground";

  // ─── RENDER ───────────────────────────────────────────────────
  if (!isActive) {
    // Mode selection
    return (
      <div className="flex flex-col items-center gap-4 p-6 bg-card/50 backdrop-blur-sm rounded-2xl border border-border max-w-md mx-auto">
        <h3 className="text-lg font-semibold">Start Live Session</h3>
        <p className="text-sm text-muted-foreground text-center">
          Have a hands-free visual and verbal conversation with your AI assistant.
        </p>

        <div className="flex gap-3 w-full">
          <Button
            onClick={() => startStream("camera")}
            className="flex-1 gap-2 h-16 flex-col"
            variant="outline"
          >
            <Camera className="w-5 h-5" />
            <span className="text-xs">Camera</span>
          </Button>

          <Button
            onClick={() => startStream("screen")}
            className="flex-1 gap-2 h-16 flex-col"
            variant="outline"
          >
            <Monitor className="w-5 h-5" />
            <span className="text-xs">Screen</span>
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={onEnd} className="text-muted-foreground">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${expanded ? "fixed inset-0 z-50 bg-background" : "relative"}`}>
      {/* Video preview */}
      {showPreview && (
        <div className={`relative ${expanded ? "flex-1" : "aspect-video max-h-[300px]"} bg-black rounded-t-xl overflow-hidden`}>
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Overlay controls */}
          <div className="absolute top-3 right-3 flex gap-1.5">
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-2.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowPreview(false)}
              className="p-2.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </div>

          {/* Live indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm">
            <div className={`w-2 h-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-white font-medium">LIVE</span>
          </div>

          {/* Frame counter */}
          <div className="absolute bottom-3 left-3 text-xs text-white/60 bg-black/40 px-2 py-0.5 rounded">
            {liveMode === "camera" ? "Camera" : "Screen"} · Frame #{frameCount}
          </div>
        </div>
      )}

      {/* Hidden preview toggle */}
      {!showPreview && (
        <button
          onClick={() => setShowPreview(true)}
          className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground bg-secondary/30 rounded-t-xl transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Show {liveMode === "camera" ? "camera" : "screen"} preview
        </button>
      )}

      {/* Status bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-b-xl">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusColor}`} />
        <span className="text-sm text-muted-foreground flex-1">{statusText}</span>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            title={ttsEnabled ? "Mute AI voice" : "Enable AI voice"}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-400" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (liveMode === "camera") {
                stopStream();
                startStream("screen");
              } else {
                stopStream();
                startStream("camera");
              }
            }}
            title={liveMode === "camera" ? "Switch to screen" : "Switch to camera"}
          >
            {liveMode === "camera" ? <Monitor className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </Button>

          <Button
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 ml-1"
            onClick={handleEnd}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End
          </Button>
        </div>
      </div>

      {/* Last AI response (collapsed view) */}
      {lastResponse && !expanded && (
        <div className="mt-2 p-3 bg-secondary/20 rounded-xl border border-border max-h-[120px] overflow-y-auto">
          <div className="text-xs text-muted-foreground mb-1">AI Response:</div>
          <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{lastResponse}</Streamdown>
          </div>
        </div>
      )}

      {/* Expanded view: show full response */}
      {expanded && lastResponse && (
        <div className="flex-shrink-0 max-h-[40vh] overflow-y-auto p-4 bg-card border-t border-border">
          <div className="text-xs text-muted-foreground mb-2">AI Response:</div>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <Streamdown>{lastResponse}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}
