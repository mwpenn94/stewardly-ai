import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useVideoCapture } from "@/hooks/useVideoCapture";
import { Monitor, Video, Play, Pause, Square, X } from "lucide-react";
import { useState } from "react";

interface CaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (blob: Blob, type: "screen" | "video") => void;
  mode: "screen" | "video";
}

export function CaptureModal({ open, onClose, onCapture, mode }: CaptureModalProps) {
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
  const title = mode === "screen" ? "Share Your Screen" : "Share Your Video";
  const description =
    mode === "screen"
      ? "Record your screen to share what you're working on. The AI will analyze it to help you."
      : "Record your video to share visual context. The AI will analyze it to help you understand.";

  const handleStart = async () => {
    if (mode === "screen") {
      await screenCapture.startCapture();
    } else {
      await videoCapture.startCapture();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === "screen" ? <Monitor className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview area */}
          {mode === "video" && capture.isCapturing && videoCapture.videoRef.current && (
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <video
                ref={videoCapture.videoRef}
                autoPlay
                muted
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 border-2 border-sky-500/50 rounded-lg" />
            </div>
          )}

          {/* Status indicator */}
          {capture.isCapturing && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-sky-500/10 border border-sky-500/20">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-sm text-sky-400">
                {capture.isPaused ? "Paused" : "Recording..."}
              </span>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            {!capture.isCapturing ? (
              <Button onClick={handleStart} className="flex-1 gap-2" variant="default">
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
          <div className="text-xs text-muted-foreground space-y-1 p-3 rounded-lg bg-secondary/30">
            <p className="font-medium">Tips:</p>
            <ul className="list-disc list-inside space-y-0.5">
              {mode === "screen" ? (
                <>
                  <li>Choose which screen or window to share</li>
                  <li>Your cursor will be visible to the AI</li>
                  <li>Stop recording when done</li>
                </>
              ) : (
                <>
                  <li>Your camera will be activated</li>
                  <li>Audio is included in the recording</li>
                  <li>Stop recording when done</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
