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

  const [talking, setTalking] = useState(false);
  const { connect, sendAudio, sendVideo, disconnect, sendActivityStart, sendActivityEnd } = useAgentSocket({
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
      // await startCamera(videoRef.current);  // Phase 2
      // startFrames(sendVideo);               // Phase 2
      await startCapture(sendAudio);
    };
  }, [connect, startCamera, startFrames, sendVideo, startCapture, sendAudio]);


  // const handleStart = useCallback(async () => {
  //   setActive(true);
  //   setTranscript("Initializing camera & mic...");

  //   try {
  //     // 1. 强制优先打开摄像头和麦克风 (无视后端状态)
  //     await startCamera(videoRef.current);
      
  //     await startCapture((chunk) => {
  //       console.log("🎙️ Audio chunk generated! Bytes:", chunk.byteLength);
  //       sendAudio(chunk); // 如果 WebSocket 没连上，sendAudio 内部会有保护机制，不会报错
  //     });

  //     setTranscript("Media started. Connecting to Agent...");

  //     // 2. 然后再去连接 WebSocket
  //     const ws = connect();
  //     ws.onopen = () => {
  //       console.log("✅ WebSocket Connected!");
  //       setTranscript("Agent Connected. How can I help you?");
  //       startFrames(sendVideo);
  //     };
      
  //     ws.onerror = () => {
  //       setTranscript("⚠️ Cannot connect to backend. Camera is local only.");
  //     };

  //   } catch (err) {
  //     console.error("Media error:", err);
  //     setTranscript("Error: Please allow camera/mic permissions.");
  //   }
  // }, [connect, startCamera, startFrames, sendVideo, startCapture, sendAudio]);
  const handleStop = useCallback(() => {
    setActive(false);
    stopCapture();
    stopCamera();
    disconnect();
  }, [stopCapture, stopCamera, disconnect]);

  // new: for offline testing, we can bypass the whole recording process and directly send a mock report to App.jsx
  const handleDebugComplete = () => {
    const mockReport = {
      complaint_type: "Massive Pothole",
      severity: "High",
      agency: "DOT",
      agency_name: "Department of Transportation",
      location_hint: "Intersection of Flatbush Ave & Tillary St, Brooklyn",
      narrative: "There is a huge pothole at the intersection of Flatbush Ave and Tillary St. It's causing traffic and is a safety hazard for cyclists.",
      nearby_count: 3,
      lat: 40.6958,
      lng: -73.9874,
      timestamp: Date.now()
    };
    
    // if recording, stop
    if (active) handleStop();
    
    // directly send the mock report to App.jsx to trigger page navigation
    onReportReady(mockReport);
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      {/* Camera feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />

      {/* 👇 新增：Hackathon 救命/调试按钮，放在右上角 */}
      <button
        onClick={handleDebugComplete}
        className="absolute top-6 right-4 bg-purple-600/90 hover:bg-purple-500 text-white text-xs font-bold px-4 py-2 rounded-full shadow-lg z-50 backdrop-blur-md"
      >
        [Debug] 模拟生成报告
      </button>

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
          <div className="flex gap-4 items-center">
            {/* Push-to-talk: hold to speak, release to send */}
            <button
              onMouseDown={() => { setTalking(true); sendActivityStart(); }}
              onMouseUp={() => { setTalking(false); sendActivityEnd(); }}
              onTouchStart={(e) => { e.preventDefault(); setTalking(true); sendActivityStart(); }}
              onTouchEnd={(e) => { e.preventDefault(); setTalking(false); sendActivityEnd(); }}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all select-none ${talking ? "bg-green-500 scale-110" : "bg-blue-600 hover:bg-blue-500"}`}
              aria-label="Hold to talk"
            >
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zm-1 17.93V21h-2v2h6v-2h-2v-2.07A8 8 0 0 0 20 12h-2a6 6 0 0 1-12 0H4a8 8 0 0 0 7 7.93z"/>
              </svg>
            </button>
            {/* Stop session */}
            <button
              onClick={handleStop}
              className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 flex items-center justify-center shadow-lg"
              aria-label="Stop session"
            >
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="1" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Status badge */}
      <div className="absolute top-6 left-0 right-0 flex justify-center">
        <div className={`px-4 py-1.5 rounded-full text-sm font-medium ${
          active ? "bg-red-500 text-white" : "bg-white/20 text-white backdrop-blur-sm"
        }`}>
          {talking ? "🎤 Speaking..." : active ? "Hold mic to speak" : "311 Civic Voice"}
        </div>
      </div>
    </div>
  );
}
