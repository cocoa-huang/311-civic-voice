import { useRef, useCallback } from "react";

export function useAgentSocket({ onAudio, onTranscript, onReportReady, onSessionExpiring }) {
  const wsRef = useRef(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const base = import.meta.env.VITE_WS_BASE || `${protocol}://${window.location.host}`;
    const ws = new WebSocket(`${base}/ws/live`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "audio") {
        const binary = atob(msg.data);
        const buffer = new ArrayBuffer(binary.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
        onAudio?.(buffer);
      } else if (msg.type === "transcript") {
        onTranscript?.(msg.text);
      } else if (msg.type === "report_ready") {
        onReportReady?.(msg.report);
      } else if (msg.type === "session_expiring") {
        onSessionExpiring?.();
      }
    };

    return ws;
  }, [onAudio, onTranscript, onReportReady, onSessionExpiring]);

  const sendAudio = useCallback((pcmBuffer) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const bytes = new Uint8Array(pcmBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    wsRef.current.send(JSON.stringify({ type: "audio", data: btoa(binary) }));
  }, []);

  const sendVideo = useCallback((base64jpeg) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "video", data: base64jpeg }));
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "stop" }));
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  return { connect, sendAudio, sendVideo, disconnect };
}
