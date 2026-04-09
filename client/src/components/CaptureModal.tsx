import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useVideoCapture } from "@/hooks/useVideoCapture";
import { Monitor, Video, Play, Pause, Square, X, AlertTriangle, ExternalLink } from "lucide-react";
import { useEffect, useRef } from "react";

interface CaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, type: "screen" | "video") => void;
  mode: "screen" | "video";
}

export function CaptureModal({ open, onClose, onCapture, mode }: CaptureModalProps) {
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const screenCapture = useScreenCapture({
    onCapture: (blob) => {
      onCapture(blob, "screen");
      onClose();
    },
  });

  const videoCapture = useVideoCapture({
    onCapture: (blob) => {
      onCapture(blob, "video");
      onClose();
    },
  });

  const capture = mode === "screen" ? screenCapture : videoCapture;
  const isSupported = mode === "screen" ? screenCapture.isSupported : videoCapture.isSupported;
  const title = mode === "screen" ? "Share Your Screen" : "Share Your Camera";
  const description =
    mode === "screen"
      ? "Record your screen to share what you're working on. The AI will analyze it to help you."
      : "Record your camera to share visual context. The AI will analyze it to help you.";

  // Attach video stream to preview element
  useEffect(() => {
    if (mode === "video" && videoCapture.isCapturing && previewVideoRef.current && videoCapture.videoRef.current) {
      const stream = videoCapture.videoRef.current.srcObject;
      if (stream) {
        previewVideoRef.current.srcObject = stream;
        previewVideoRef.current.play().catch(() => {});
      }
    }
  }, [mode, videoCapture.isCapturing]);

  const handleStart = async () => {
    if (mode === "screen") {
      await screenCapture.startCapture();
    } else {
      await videoCapture.startCapture();
    }
  };

  const handleClose = () => {
    // Stop any active capture before closing
    if (capture.isCapturing) {
      capture.stopCapture();
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "screen" ? <Monitor className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Unsupported warning */}
          {!isSupported && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-amber-200 font-medium">
                  {mode === "screen" ? "Screen capture" : "Camera access"} is not available
                </p>
                <p className="text-xs text-muted-foreground">
                  {mode === "screen"
                    ? "Screen sharing may be restricted in embedded views. Try opening the app in a new browser tab."
                    : "Camera access requires a secure context (HTTPS) and browser permissions. Try Chrome, Edge, or Firefox."}
                </p>
                {mode === "screen" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-1"
                    onClick={() => window.open(window.location.href, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in new tab
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Video preview */}
          {mode === "video" && capture.isCapturing && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={previewVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover mirror"
                style={{ transform: "scaleX(-1)" }}
              />
              <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 text-xs">
                <div className={`w-1.5 h-1.5 rounded-full ${capture.isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse"}`} />
                {capture.isPaused ? "Paused" : "Recording"}
              </div>
            </div>
          )}

          {/* Screen capture status indicator */}
          {mode === "screen" && capture.isCapturing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20">
              <div className={`w-2 h-2 rounded-full ${capture.isPaused ? "bg-amber-500" : "bg-accent animate-pulse"}`} />
              <span className="text-sm text-accent">
                {capture.isPaused ? "Screen capture paused" : "Recording screen..."}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {!capture.isCapturing ? (
              <Button
                onClick={handleStart}
                className="flex-1 gap-2"
                variant="default"
                disabled={!isSupported}
              >
                <Play className="w-4 h-4" />
                Start {mode === "screen" ? "Screen" : "Video"} Capture
              </Button>
            ) : (
              <>
                <Button
                  onClick={capture.isPaused ? capture.resumeCapture : capture.pauseCapture}
                  variant="outline"
                  className="flex-1 gap-2"
                >
                  {capture.isPaused ? (
                    <>
                      <Play className="w-4 h-4" />
                      Resume
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4" />
                      Pause
                    </>
                  )}
                </Button>
                <Button onClick={capture.stopCapture} variant="destructive" className="gap-2">
                  <Square className="w-4 h-4" />
                  Stop & Send
                </Button>
              </>
            )}
          </div>

          {/* Tips */}
          {isSupported && (
            <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-secondary/30">
              <p className="font-medium">Tips:</p>
              <ul className="list-disc list-inside space-y-0.5">
                {mode === "screen" ? (
                  <>
                    <li>Choose which screen, window, or tab to share</li>
                    <li>Your cursor movements will be visible</li>
                    <li>Click "Stop & Send" when done, or use the browser's stop button</li>
                  </>
                ) : (
                  <>
                    <li>Your camera preview is mirrored but recording is normal</li>
                    <li>Audio is included in the recording</li>
                    <li>Click "Stop & Send" when done</li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleClose} variant="outline" className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
