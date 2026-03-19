import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface ScreenCaptureOptions {
  onCapture?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useScreenCapture(options: ScreenCaptureOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startCapture = useCallback(async () => {
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen capture not supported in this browser");
      }

      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
        } as any,
        audio: false,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create MediaRecorder
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp9",
      });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        options.onCapture?.(blob);
        chunksRef.current = [];
      };

      recorder.onerror = (event) => {
        const error = new Error(`Recording error: ${event.error}`);
        options.onError?.(error);
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsCapturing(true);
      setIsPaused(false);

      // Handle stream end (user stops sharing)
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          stopCapture();
        };
      });

      toast.success("Screen capture started");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to start screen capture");
      options.onError?.(err);
      toast.error(err.message);
    }
  }, [options]);

  const pauseCapture = useCallback(() => {
    if (recorderRef.current && isCapturing) {
      recorderRef.current.pause();
      setIsPaused(true);
      toast.info("Screen capture paused");
    }
  }, [isCapturing]);

  const resumeCapture = useCallback(() => {
    if (recorderRef.current && isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
      toast.info("Screen capture resumed");
    }
  }, [isPaused]);

  const stopCapture = useCallback(() => {
    if (recorderRef.current && isCapturing) {
      recorderRef.current.stop();
      setIsCapturing(false);
      setIsPaused(false);

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      toast.success("Screen capture stopped");
    }
  }, [isCapturing]);

  return {
    isCapturing,
    isPaused,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
  };
}
