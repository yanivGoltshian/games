import { useCallback, useEffect, useRef } from 'react';

type AudioContextCtor = typeof AudioContext;

/**
 * Resolves the platform `AudioContext` constructor, tolerating the older
 * `webkitAudioContext` prefix still used by some iOS Safari builds. Returns
 * `null` when the environment has no Web Audio support (e.g. jsdom, or a
 * locked-down browser).
 */
export function getAudioContextCtor(): AudioContextCtor | null {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

/**
 * True only when the device can both capture microphone audio and analyse it
 * with the Web Audio API. Used to gate the mic UI so unsupported devices fall
 * back to a simple "tap when you say it" button instead of showing a broken
 * meter.
 */
export function microphoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && getAudioContextCtor() !== null
  );
}

export interface MicEffortController {
  start: () => Promise<boolean>;
  stop: () => void;
  supported: boolean;
}

/**
 * Opens the microphone and reports a normalised vocal *effort* level every
 * animation frame via `onSample(level, deltaMs)`. It never transcribes speech —
 * it only measures loudness (RMS of the time-domain waveform), which is exactly
 * what we want for a toddler making a big "taaa-puach!" sound. All native
 * resources are torn down on `stop()` and on unmount.
 *
 * Reused across games (Silly Alien, and any activity that wants to reward
 * vocal effort) so the capture/teardown logic lives in exactly one place.
 */
export function useMicEffort(
  onSample: (level: number, deltaMs: number) => void,
): MicEffortController {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastTimeRef = useRef(0);
  const supported = microphoneSupported();

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const start = useCallback(async (): Promise<boolean> => {
    const Ctor = getAudioContextCtor();
    if (!supported || !Ctor) {
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const context = new Ctor();
      contextRef.current = context;
      if (context.state === 'suspended') {
        await context.resume().catch(() => undefined);
      }
      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);
      analyserRef.current = analyser;

      const waveform = new Uint8Array(analyser.fftSize);
      lastTimeRef.current = performance.now();

      const loop = (): void => {
        const node = analyserRef.current;
        if (!node) {
          return;
        }
        node.getByteTimeDomainData(waveform);
        let sumSquares = 0;
        for (let i = 0; i < waveform.length; i += 1) {
          const centered = (waveform[i]! - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / waveform.length);
        // Toddler speech tends to sit around 0.05–0.35 RMS; lift it into a
        // friendlier 0..1 range so the visuals feel responsive.
        const level = Math.min(1, rms * 2.4);
        const now = performance.now();
        const deltaMs = now - lastTimeRef.current;
        lastTimeRef.current = now;
        onSampleRef.current(level, deltaMs);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return true;
    } catch {
      stop();
      return false;
    }
  }, [stop, supported]);

  useEffect(() => stop, [stop]);

  return { start, stop, supported };
}
