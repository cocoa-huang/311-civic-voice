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

    await inputCtx.audioWorklet.addModule("/audio-processor.js");

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const source = inputCtx.createMediaStreamSource(stream);

    const workletNode = new AudioWorkletNode(inputCtx, "pcm-processor");
    workletNodeRef.current = workletNode;

    workletNode.port.onmessage = (e) => {
      if (onPCMChunkRef.current) onPCMChunkRef.current(e.data);
    };

    source.connect(workletNode);
    workletNode.connect(inputCtx.destination);
  }, []);

  const stopCapture = useCallback(() => {
    workletNodeRef.current?.disconnect();
    inputCtxRef.current?.close();
    inputCtxRef.current = null;
    workletNodeRef.current = null;
  }, []);

  const playAudio = useCallback(async (pcmBuffer) => {
    // Output context: 24kHz for Gemini audio output
    if (!outputCtxRef.current) {
      outputCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    const ctx = outputCtxRef.current;

    const int16 = new Int16Array(pcmBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff);
    }

    const audioBuffer = ctx.createBuffer(1, float32.length, 24000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  return { startCapture, stopCapture, playAudio };
}
