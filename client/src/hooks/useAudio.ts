import { useEffect, useRef, useCallback, useState } from 'react';

export function useAudio(
  sendAudio: (data: ArrayBuffer) => void,
  setAudioCallback: (cb: (data: ArrayBuffer, agentId: string | null) => void) => void,
  isActive: boolean,
  ttsSampleRate: number = 24000,
) {
  const [isMicActive, setIsMicActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  // Tail of the scheduled audio timeline (when the last chunk finishes)
  const nextStartTimeRef = useRef<number>(0);
  // Leftover bytes from the previous chunk (when WS frame size isn't a
  // multiple of 4). Carried into the next chunk to avoid sample misalignment.
  const leftoverRef = useRef<Uint8Array>(new Uint8Array(0));
  // Last input sample of the previous chunk, used as the left-edge for linear
  // interpolation across chunk boundaries when we upsample to the device rate.
  const lastSampleRef = useRef<number>(0);

  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      // Inline AudioWorklet processor
      const code = `
        class P extends AudioWorkletProcessor {
          process(inputs) {
            const ch = inputs[0]?.[0];
            if (ch) this.port.postMessage(ch);
            return true;
          }
        }
        registerProcessor('pcm', P);
      `;
      const blob = new Blob([code], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);

      const source = ctx.createMediaStreamSource(stream);
      const worklet = new AudioWorkletNode(ctx, 'pcm');
      workletRef.current = worklet;

      worklet.port.onmessage = (e) => {
        const float32 = e.data as Float32Array;
        sendAudio(float32.buffer as ArrayBuffer);
      };

      source.connect(worklet);
      setIsMicActive(true);
    } catch (err) {
      console.error('[Audio] Mic start failed:', err);
    }
  }, [sendAudio]);

  const stopMic = useCallback(() => {
    workletRef.current?.disconnect();
    audioContextRef.current?.close();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    workletRef.current = null;
    audioContextRef.current = null;
    streamRef.current = null;
    setIsMicActive(false);
  }, []);

  // Playback: schedule each PCM chunk on the AudioContext clock so they butt
  // up seamlessly. Chaining sources via `onended → next start()` introduces
  // 5–20ms gaps from JS event-loop latency, which on continuous PCM produces
  // clicking that perceptually sounds like static.
  const enqueueChunk = useCallback((data: ArrayBuffer) => {
    if (!playbackContextRef.current) {
      playbackContextRef.current = new AudioContext();
    }
    const ctx = playbackContextRef.current;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    // 1) Concatenate any leftover bytes from the prior chunk, then split off
    //    a clean (multiple-of-4) head and stash the new tail as leftover.
    const incoming = new Uint8Array(data);
    const merged = new Uint8Array(leftoverRef.current.byteLength + incoming.byteLength);
    merged.set(leftoverRef.current, 0);
    merged.set(incoming, leftoverRef.current.byteLength);
    const usable = merged.byteLength - (merged.byteLength % 4);
    if (usable < 4) {
      leftoverRef.current = merged;
      return;
    }
    leftoverRef.current = merged.slice(usable);

    // Float32 view of the aligned region (copy so we own the buffer).
    const aligned = new Uint8Array(usable);
    aligned.set(merged.subarray(0, usable));
    const inSamples = new Float32Array(aligned.buffer);
    const inLen = inSamples.length;

    // 2) Upsample to the AudioContext's native rate using linear interpolation
    //    bridged across chunk boundaries via lastSampleRef. This avoids the
    //    browser independently resampling each small AudioBuffer (which
    //    introduces fade-in/fade-out artifacts at every boundary → static).
    const inRate = ttsSampleRate;
    const outRate = ctx.sampleRate;
    const ratio = outRate / inRate;
    const outLen = Math.floor(inLen * ratio);
    const out = new Float32Array(outLen);
    const prev = lastSampleRef.current;
    for (let i = 0; i < outLen; i++) {
      const srcPos = i / ratio;
      const i0 = Math.floor(srcPos);
      const frac = srcPos - i0;
      const s0 = i0 === 0 ? prev : inSamples[i0 - 1];
      const s1 = inSamples[i0];
      out[i] = s0 + (s1 - s0) * frac;
    }
    lastSampleRef.current = inSamples[inLen - 1];

    const buffer = ctx.createBuffer(1, outLen, outRate);
    buffer.copyToChannel(out, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(nextStartTimeRef.current, now);
    source.start(startAt);
    nextStartTimeRef.current = startAt + outLen / outRate;
  }, [ttsSampleRate]);

  // Register incoming audio handler
  useEffect(() => {
    setAudioCallback((data: ArrayBuffer, _agentId: string | null) => {
      enqueueChunk(data);
    });
  }, [setAudioCallback, enqueueChunk]);

  // Start/stop mic based on session state
  useEffect(() => {
    if (isActive) {
      startMic();
    } else {
      stopMic();
      // Reset playback timeline when session ends
      nextStartTimeRef.current = 0;
      leftoverRef.current = new Uint8Array(0);
      lastSampleRef.current = 0;
    }
    return () => stopMic();
  }, [isActive, startMic, stopMic]);

  return { isMicActive };
}
