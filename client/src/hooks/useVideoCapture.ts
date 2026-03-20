import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";

interface VideoCaptureOptions {
  onCapture?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onFrameCapture?: (frame: ImageData) => void;
}

export function useVideoCapture(options: VideoCaptureOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Check support on mount
  useEffect(() => {
    const supported = typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function";
    setIsSupported(supported);
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
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Video capture is not supported in this browser. Try Chrome, Edge, or Firefox.");
      }

      // Request camera access with fallback constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
            facingMode: "user",
          },
          audio: true,
        });
      } catch {
        // Fallback: try without specific constraints
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      }

      streamRef.current = stream;
      chunksRef.current = [];

      // Create or reuse video element for preview
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.playsInline = true;
        videoRef.current.muted = true;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

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
      };

      recorder.onerror = () => {
        const error = new Error("Video recording failed unexpectedly");
        options.onError?.(error);
        stopCapture();
      };

      recorderRef.current = recorder;
      recorder.start(1000);
      setIsCapturing(true);
      setIsPaused(false);

      // Start frame capture for real-time analysis if callback provided
      const onFrameCapture = options.onFrameCapture;
      if (onFrameCapture) {
        const captureFrame = () => {
          if (videoRef.current && recorderRef.current?.state === "recording") {
            if (!canvasRef.current) {
              canvasRef.current = document.createElement("canvas");
            }
            canvasRef.current.width = videoRef.current.videoWidth || 640;
            canvasRef.current.height = videoRef.current.videoHeight || 480;

            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              ctx.drawImage(videoRef.current, 0, 0);
              const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
              onFrameCapture(imageData);
            }
          }

          if (recorderRef.current?.state === "recording") {
            animationFrameRef.current = requestAnimationFrame(captureFrame);
          }
        };
        animationFrameRef.current = requestAnimationFrame(captureFrame);
      }

      // Handle track ending (e.g., user revokes permission)
      stream.getTracks().forEach((track) => {
        track.onended = () => {
          if (recorderRef.current?.state !== "inactive") {
            stopCapture();
          }
        };
      });

      toast.success("Video capture started");
    } catch (error: any) {
      if (error?.name === "NotAllowedError") {
        toast.error("Camera access was denied. Please allow camera permissions and try again.");
      } else if (error?.name === "NotFoundError") {
        toast.error("No camera found. Please connect a camera and try again.");
      } else if (error?.name === "NotReadableError") {
        toast.error("Camera is in use by another application. Please close it and try again.");
      } else if (error?.name === "OverconstrainedError") {
        toast.error("Camera doesn't support the requested resolution. Trying with default settings...");
      } else {
        const err = error instanceof Error ? error : new Error("Failed to start video capture");
        options.onError?.(err);
        toast.error(err.message);
      }
    }
  }, [options, getMimeType]);

  const pauseCapture = useCallback(() => {
    if (recorderRef.current?.state === "recording" && isCapturing) {
      recorderRef.current.pause();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsPaused(true);
      toast.info("Video capture paused");
    }
  }, [isCapturing]);

  const resumeCapture = useCallback(() => {
    if (recorderRef.current?.state === "paused" && isPaused) {
      recorderRef.current.resume();
      setIsPaused(false);
      toast.info("Video capture resumed");
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

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    toast.success("Video capture stopped");
  }, []);

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    if (!videoRef.current || !streamRef.current) return null;
    try {
      const canvas = canvasRef.current || document.createElement("canvas");
      canvasRef.current = canvas;
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(videoRef.current, 0, 0);
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
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
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
    videoRef,
    stream: streamRef.current,
  };
}
