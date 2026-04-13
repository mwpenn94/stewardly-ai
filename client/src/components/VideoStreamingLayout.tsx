/**
 * VideoStreamingLayout — Adapts chat UI when screen share / camera / co-browse is active
 * Screen share: video 70%, chat overlay sidebar (320px)
 * Camera: video top, chat below (overlay-bottom)
 * Co-browse: side-by-side (sidebar 400px)
 */
import { useState, useEffect, useRef, type ReactNode } from "react";
import { Monitor, Camera, Globe, X, Maximize2, Minimize2, Mic, MicOff } from "lucide-react";

export type StreamType = "screen_share" | "camera" | "co_browse";

interface StreamLayoutConfig {
  chatPosition: "overlay-right" | "overlay-bottom" | "sidebar";
  chatWidth: string;
  videoFill: boolean;
  showTTS: boolean;
  showTranscript: boolean;
}

interface VideoStreamingLayoutProps {
  streamType: StreamType;
  onEnd: () => void;
  children: ReactNode; // Chat content
  className?: string;
}

function getLayoutConfig(streamType: StreamType): StreamLayoutConfig {
  switch (streamType) {
    case "screen_share":
      return { chatPosition: "overlay-right", chatWidth: "320px", videoFill: true, showTTS: true, showTranscript: true };
    case "camera":
      return { chatPosition: "overlay-bottom", chatWidth: "100%", videoFill: false, showTTS: true, showTranscript: false };
    case "co_browse":
      return { chatPosition: "sidebar", chatWidth: "400px", videoFill: true, showTTS: false, showTranscript: true };
  }
}

const STREAM_ICONS = {
  screen_share: Monitor,
  camera: Camera,
  co_browse: Globe,
};

export default function VideoStreamingLayout({ streamType, onEnd, children, className = "" }: VideoStreamingLayoutProps) {
  const config = getLayoutConfig(streamType);
  const Icon = STREAM_ICONS[streamType];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  useEffect(() => {
    // Request media stream based on type
    const startStream = async () => {
      try {
        let stream: MediaStream;
        if (streamType === "screen_share") {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        } else if (streamType === "camera") {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } else {
          // co_browse — use screen share with audio
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
        }
        // Auto-end when stream track ends
        stream.getTracks().forEach(track => {
          track.onended = () => {
            setStreamActive(false);
            onEnd();
          };
        });
      } catch {
        onEnd(); // User cancelled or permission denied
      }
    };
    startStream();
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
    };
  }, [streamType]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  if (config.chatPosition === "overlay-right") {
    // Screen share: video fills area, chat overlays on right
    return (
      <div className={`relative flex h-full bg-black ${className}`}>
        {/* Video area — 70% */}
        <div className="flex-1 relative">
          <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-contain bg-black" />
          {/* Controls overlay */}
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-medium">
              <Icon className="w-3 h-3" />
              <span className="animate-pulse">LIVE</span>
            </div>
          </div>
          <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
            <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70" aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70" aria-label="Toggle fullscreen">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={onEnd} className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500" aria-label="End stream">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Chat overlay — 320px */}
        <div className="w-80 bg-background/95 backdrop-blur-sm border-l border-border/40 flex flex-col overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  if (config.chatPosition === "overlay-bottom") {
    // Camera: video top, chat bottom
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="relative h-1/3 bg-black shrink-0">
          <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-cover" />
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/90 text-white text-[10px] font-medium">
            <Camera className="w-3 h-3" />
            <span className="animate-pulse">LIVE</span>
          </div>
          <div className="absolute top-2 right-2 flex items-center gap-1">
            <button onClick={() => setIsMuted(!isMuted)} className="p-1 rounded bg-black/50 text-white" aria-label={isMuted ? "Unmute" : "Mute"}>
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onEnd} className="p-1 rounded bg-red-500/80 text-white" aria-label="End stream">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          {children}
        </div>
      </div>
    );
  }

  // Sidebar: co-browse (side by side)
  return (
    <div className={`flex h-full ${className}`}>
      <div className="flex-1 relative bg-black">
        <video ref={videoRef} autoPlay playsInline muted={isMuted} className="w-full h-full object-contain" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-blue-500/90 text-white text-[10px] font-medium">
          <Globe className="w-3 h-3" />
          <span>Co-Browse</span>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 rounded-lg bg-black/50 text-white hover:bg-black/70" aria-label={isMuted ? "Unmute" : "Mute"}>
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <button onClick={onEnd} className="p-1.5 rounded-lg bg-red-500/80 text-white hover:bg-red-500" aria-label="End stream">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="w-[400px] bg-background border-l border-border/40 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
