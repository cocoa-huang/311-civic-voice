import { useRef, useCallback } from "react";

export function useAgentSocket({ onAudio, onTranscript, onReportReady, onSessionExpiring }) {
  const wsRef = useRef(null);
  const geminiSpeakingRef = useRef(false);
  const silenceTimerRef = useRef(null);
  const talkingRef = useRef(false);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const base = import.meta.env.VITE_WS_BASE || `${protocol}://${window.location.host}`;
    const ws = new WebSocket(`${base}/ws/live`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "audio") {
        // Mark Gemini as speaking; clear mic gate after 800ms of silence
        geminiSpeakingRef.current = true;
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          geminiSpeakingRef.current = false;
        }, 800);

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

  // Buffer chunks into ~250ms batches before sending — small 8ms chunks don't trigger Gemini VAD
  const audioBufferRef = useRef([]);
  const CHUNK_TARGET = 4000 * 2; // 250ms at 16kHz 16-bit = 8000 bytes

  const sendAudio = useCallback((pcmBuffer) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (!talkingRef.current) return; // only send while button held

    audioBufferRef.current.push(new Uint8Array(pcmBuffer));
    const totalBytes = audioBufferRef.current.reduce((sum, b) => sum + b.byteLength, 0);
    if (totalBytes < CHUNK_TARGET) return;

    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of audioBufferRef.current) { merged.set(chunk, offset); offset += chunk.byteLength; }
    audioBufferRef.current = [];

    let binary = "";
    for (let i = 0; i < merged.length; i++) binary += String.fromCharCode(merged[i]);
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

  const sendActivityStart = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    talkingRef.current = true;
    audioBufferRef.current = [];
  }, []);

  const sendActivityEnd = useCallback(() => {
    talkingRef.current = false;
    audioBufferRef.current = [];
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    // Send 600ms of silence so VAD detects end-of-speech
    const silence = new Uint8Array(16000 * 0.6 * 2); // 600ms @ 16kHz 16-bit, all zeros
    let binary = "";
    for (let i = 0; i < silence.length; i++) binary += String.fromCharCode(silence[i]);
    wsRef.current.send(JSON.stringify({ type: "audio", data: btoa(binary) }));
  }, []);

  return { connect, sendAudio, sendVideo, disconnect, sendActivityStart, sendActivityEnd };
}
