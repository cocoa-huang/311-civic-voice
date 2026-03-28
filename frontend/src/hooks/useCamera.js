import { useRef, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  const startCamera = useCallback(async (videoElement) => {
    videoRef.current = videoElement;
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });
    videoElement.srcObject = stream;
    await videoElement.play();

    // Create offscreen canvas for frame capture
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    canvasRef.current = canvas;
  }, []);

  const startFrames = useCallback((onFrame) => {
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            onFrame(base64);
          };
          reader.readAsDataURL(blob);
        },
        "image/jpeg",
        0.8
      );
    }, 1000);
  }, []);

  const stopCamera = useCallback(() => {
    clearInterval(intervalRef.current);
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
  }, []);

  return { startCamera, startFrames, stopCamera };
}
