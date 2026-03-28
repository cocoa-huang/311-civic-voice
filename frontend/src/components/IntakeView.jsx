import { useRef, useState, useCallback } from "react";
import { useAudio } from "../hooks/useAudio";
import { useCamera } from "../hooks/useCamera";
import { useAgentSocket } from "../hooks/useAgentSocket";

export function IntakeView({ onReportReady }) {
  const videoRef = useRef(null);
  const [active, setActive] = useState(false);
  const [transcript, setTranscript] = useState("");

  const { startCapture, stopCapture, playAudio } = useAudio();
  const { startCamera, startFrames, stopCamera } = useCamera();

  const { connect, sendAudio, sendVideo, disconnect } = useAgentSocket({
    onAudio: playAudio,
    onTranscript: (text) => setTranscript(text),
    onReportReady,
    onSessionExpiring: () => {
      setTranscript("Session expiring — please restart.");
      handleStop();
    },
  });

  const handleStart = useCallback(async () => {
    setActive(true);
    setTranscript("");

    const ws = connect();
    ws.onopen = async () => {
      await startCamera(videoRef.current);
      startFrames(sendVideo);
      await startCapture(sendAudio);
    };
  }, [connect, startCamera, startFrames, sendVideo, startCapture, sendAudio]);

  const handleStop = useCallback(() => {
    setActive(false);
    stopCapture();
    stopCamera();
    disconnect();
  }, [stopCapture, stopCamera, disconnect]);

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* Transcript overlay */}
      {transcript && (
        <div className="absolute bottom-32 left-4 right-4 bg-black/70 text-white rounded-xl p-4 text-sm leading-relaxed backdrop-blur-sm">
          {transcript}
        </div>
      )}

      {/* Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-6">
        {!active ? (
          <button
            onClick={handleStart}
            className="w-20 h-20 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center shadow-lg transition-all"
            aria-label="Start session"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 0v2m0-8V6m6 6h2M4 12H2m15.07-5.07-1.41 1.41M7.34 16.66l-1.41 1.41M18.66 16.66l-1.41-1.41M7.34 7.34 5.93 5.93" />
              <circle cx="12" cy="12" r="3" />
              <path d="M19 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg transition-all animate-pulse"
            aria-label="Stop session"
          >
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        )}
      </div>

      {/* Status badge */}
      <div className="absolute top-6 left-0 right-0 flex justify-center">
        <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${
          active ? "bg-red-500 text-white" : "bg-white/20 text-white backdrop-blur-sm"
        }`}>
          {active ? "● Recording" : "311 Civic Voice"}
        </div>
      </div>
    </div>
  );
}
