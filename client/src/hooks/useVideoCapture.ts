import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";

interface VideoCaptureOptions {
  onCapture?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  onFrameCapture?: (frame: ImageData) => void;
}

export function useVideoCapture(options: VideoCaptureOptions = {}) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const startCapture = useCallback(async () => {
    try {
      // Check browser support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Video capture not supported in this browser");
      }

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: true,
      });

      streamRef.current = stream;
      chunksRef.current = [];

      // Create video element if needed
      if (!videoRef.current) {
        videoRef.current = document.createElement("video");
        videoRef.current.style.display = "none";
      }

      videoRef.current.srcObject = stream;
      videoRef.current.play();

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

      // Start frame capture for real-time analysis if callback provided
      const onFrameCapture = options.onFrameCapture;
      if (onFrameCapture) {
        const captureFrame = () => {
          if (videoRef.current && recorderRef.current?.state === "recording") {
            if (!canvasRef.current) {
              canvasRef.current = document.createElement("canvas");
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
            }

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

      toast.success("Video capture started");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Failed to start video capture");
      options.onError?.(err);
      toast.error(err.message);
    }
  }, [options, isCapturing]);

  const pauseCapture = useCallback(() => {
    if (recorderRef.current && isCapturing) {
      recorderRef.current.pause();
      if (videoRef.current) {
        videoRef.current.pause();
      }
      setIsPaused(true);
      toast.info("Video capture paused");
    }
  }, [isCapturing]);

  const resumeCapture = useCallback(() => {
    if (recorderRef.current && isPaused) {
      recorderRef.current.resume();
      if (videoRef.current) {
        videoRef.current.play();
      }
      setIsPaused(false);
      toast.info("Video capture resumed");
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

      // Stop video element
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.srcObject = null;
      }

      // Cancel animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      toast.success("Video capture stopped");
    }
  }, [isCapturing]);

  return {
    isCapturing,
    isPaused,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    videoRef,
  };
}
