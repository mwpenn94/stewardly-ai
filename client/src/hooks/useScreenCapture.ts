import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface ScreenCaptureOptions {
  onCapture?: (blob: Blob) => void;
  onError?: (error: Error) => void;
}

export function useScreenCapture(options: ScreenCaptureOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  // Check support on mount
  useEffect(() => {
    const supported = typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getDisplayMedia === "function";
    setIsSupported(supported);

    // Also check if we're in an iframe (common restriction)
    try {
      if (window.self !== window.top) {
        // In an iframe — getDisplayMedia may be blocked by permissions policy
        const permissions = (document as any).featurePolicy?.allowedFeatures?.() || [];
        if (permissions.length > 0 && !permissions.includes("display-capture")) {
          setIsSupported(false);
        }
      }
    } catch {
      // Cross-origin iframe — can't check, assume supported and handle error at capture time
    }
  }, []);

  // Determine best mimeType
  const getMimeType = useCallback(() => {
    const types = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
      "video/mp4",
    ];
    for (const type of types) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return "video/webm";
  }, []);

  const startCapture = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        throw new Error("Screen capture is not supported in this browser. Try Chrome, Edge, or Firefox on desktop.");
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as any,
        audio: false,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create preview video element
      if (!videoPreviewRef.current) {
        videoPreviewRef.current = document.createElement("video");
      }
      videoPreviewRef.current.srcObject = stream;
      videoPreviewRef.current.muted = true;
      await videoPreviewRef.current.play();

      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType.split(";")[0] });
        options.onCapture?.(blob);
        chunksRef.current = [];
        // Clean up preview
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          setPreviewUrl(null);
        }
      };

      recorder.onerror = () => {
        const error = new Error("Recording failed unexpectedly");
        options.onError?.(error);
        stopCapture();
      };

      recorderRef.current = recorder;
      recorder.start(1000); // Collect data every second for smoother stop
      setIsCapturing(true);
      setIsPaused(false);

      // Handle user stopping share via browser UI
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (recorderRef.current?.state !== "inactive") {
            stopCapture();
          }
        };
      });

      toast.success("Screen capture started");
    } catch (error: any) {
      if (error?.name === "NotAllowedError") {
        toast.error("Screen sharing was denied. Please allow access and try again.");
      } else if (error?.name === "NotFoundError") {
        toast.error("No screen available to capture.");
      } else if (error?.name === "NotSupportedError" || error?.message?.includes("iframe")) {
        setIsSupported(false);
        toast.error("Screen capture is restricted in this context. Try opening the app in a new tab.");
      } else {
        const err = error instanceof Error ? error : new Error("Failed to start screen capture");
        options.onError?.(err);
        toast.error(err.message);
      }
    }
  }, [options, getMimeType]);

  const pauseCapture = useCallback(() => {
    if (recorderRef.current?.state === "recording" && isCapturing) {
      recorderRef.current.pause();
      setIsPaused(true);
      toast.info("Screen capture paused");
    }
  }, [isCapturing]);

  const resumeCapture = useCallback(() => {
    if (recorderRef.current?.state === "paused" && isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
      toast.info("Screen capture resumed");
    }
  }, [isPaused]);

  const stopCapture = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    setIsCapturing(false);
    setIsPaused(false);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoPreviewRef.current) {
      videoPreviewRef.current.pause();
      videoPreviewRef.current.srcObject = null;
    }

    toast.success("Screen capture stopped");
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    if (!streamRef.current) return null;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return null;

    // Prefer ImageCapture API if available (higher quality)
    if (typeof (window as any).ImageCapture !== "undefined") {
      try {
        const imageCapture = new (window as any).ImageCapture(track);
        const bitmap = await imageCapture.grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();
        return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
      } catch {
        // Fall through to video element approach
      }
    }

    // Fallback: draw from video element
    try {
      if (!videoPreviewRef.current) return null;
      const video = videoPreviewRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    } catch {
      return null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, []);

  return {
    isCapturing,
    isPaused,
    isSupported,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    captureFrame,
    videoPreviewRef,
    stream: streamRef.current,
  };
}
