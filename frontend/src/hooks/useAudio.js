import { useRef, useCallback } from "react";

export function useAudio() {
  const inputCtxRef = useRef(null);
  const outputCtxRef = useRef(null);
  const workletNodeRef = useRef(null);
  const onPCMChunkRef = useRef(null);

  const startCapture = useCallback(async (onChunk) => {
    onPCMChunkRef.current = onChunk;

    // Input context: 16kHz for Gemini
    const inputCtx = new AudioContext({ sampleRate: 16000 });
    inputCtxRef.current = inputCtx;
    console.log("[audio] AudioContext created, state:", inputCtx.state);

    await inputCtx.audioWorklet.addModule("/audio-processor.js");
    console.log("[audio] AudioWorklet module loaded");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    console.log("[audio] Mic stream acquired");
    const source = inputCtx.createMediaStreamSource(stream);

    const workletNode = new AudioWorkletNode(inputCtx, "pcm-processor");
    workletNodeRef.current = workletNode;

    let chunkCount = 0;
    workletNode.port.onmessage = (e) => {
      chunkCount++;
      if (chunkCount <= 3) console.log(`[audio] PCM chunk #${chunkCount}, bytes:`, e.data.byteLength);
      if (onPCMChunkRef.current) onPCMChunkRef.current(e.data);
    };

    source.connect(workletNode);
    workletNode.connect(inputCtx.destination);
    console.log("[audio] Capture pipeline connected");
  }, []);

  const stopCapture = useCallback(() => {
    workletNodeRef.current?.disconnect();
    inputCtxRef.current?.close();
    inputCtxRef.current = null;
    workletNodeRef.current = null;
  }, []);

  const nextPlayTimeRef = useRef(0);

  const playAudio = useCallback(async (pcmBuffer) => {
    console.log("[audio] playAudio called, bytes:", pcmBuffer.byteLength);
    // Output context: 24kHz for Gemini audio output
    if (!outputCtxRef.current) {
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = outputCtxRef.current;
    console.log("[audio] ctx state:", ctx.state, "currentTime:", ctx.currentTime, "nextPlay:", nextPlayTimeRef.current);

    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    // Resume context if suspended (browser pauses idle audio contexts)
    if (ctx.state === "suspended") await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // Queue chunks sequentially instead of playing all at once
    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    source.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  }, []);

  return { startCapture, stopCapture, playAudio };
}
