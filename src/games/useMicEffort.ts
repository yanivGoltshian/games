import { useCallback, useEffect, useRef } from 'react';
import {
  readAppLifecycleState,
  subscribeAppLifecycle,
  type AppLifecycleState,
} from '../platform/useAppLifecycle';
import {
  communicationMicrophoneGuard,
  type MicrophonePlaybackGuardContract,
} from '../services/microphonePlaybackGuard';
import type { GenerationToken } from './useGenerationToken';

type AudioContextCtor = typeof AudioContext;
export type MicEffortLevel = 0 | 1;

const COARSE_EFFORT_RMS_THRESHOLD = 0.05;

export function getAudioContextCtor(): AudioContextCtor | null {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return scope.AudioContext ?? scope.webkitAudioContext ?? null;
}

export function microphoneSupported(): boolean {
  return (
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices?.getUserMedia === 'function'
    && getAudioContextCtor() !== null
  );
}

export type MicStartOutcome =
  | { status: 'started' }
  | { status: 'unsupported' }
  | { status: 'permission-denied' }
  | { status: 'cancelled' }
  | { status: 'background' }
  | { status: 'playback-guarded' }
  | { status: 'error'; errorName: string };

export interface MicGenerationGuard {
  token: GenerationToken;
  isCurrent: (token: GenerationToken) => boolean;
}

export interface MicEffortOptions {
  generation?: MicGenerationGuard;
  playbackGuard?: MicrophonePlaybackGuardContract;
  subscribeLifecycle?: typeof subscribeAppLifecycle;
}

export interface MicEffortController {
  start: () => Promise<MicStartOutcome>;
  stop: () => void;
  supported: boolean;
}

function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
}

function reportCloseError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Unable to close microphone AudioContext: ${message}`);
}

function closeContext(context: AudioContext): void {
  void context.close().catch(reportCloseError);
}

function errorName(error: unknown): string {
  if (error instanceof DOMException || error instanceof Error) {
    return error.name || 'Error';
  }
  return 'UnknownError';
}

function classifyStartError(error: unknown): MicStartOutcome {
  const name = errorName(error);
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return { status: 'permission-denied' };
  }
  return { status: 'error', errorName: name };
}

export function useMicEffort(
  onSample: (level: MicEffortLevel, deltaMs: number) => void,
  options: MicEffortOptions = {},
): MicEffortController {
  const onSampleRef = useRef(onSample);
  onSampleRef.current = onSample;
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const lifecycleRef = useRef<AppLifecycleState>(readAppLifecycleState());
  const acquisitionGenerationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const pendingContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const lastTimeRef = useRef(0);
  const playbackGuard = options.playbackGuard ?? communicationMicrophoneGuard;
  const subscribeLifecycle = options.subscribeLifecycle ?? subscribeAppLifecycle;
  const supported = microphoneSupported();

  const teardown = useCallback((): void => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;

    const activeStream = streamRef.current;
    streamRef.current = null;
    if (activeStream) {
      stopStream(activeStream);
    }
    const pendingStream = pendingStreamRef.current;
    pendingStreamRef.current = null;
    if (pendingStream && pendingStream !== activeStream) {
      stopStream(pendingStream);
    }

    const activeContext = contextRef.current;
    contextRef.current = null;
    if (activeContext) {
      closeContext(activeContext);
    }
    const pendingContext = pendingContextRef.current;
    pendingContextRef.current = null;
    if (pendingContext && pendingContext !== activeContext) {
      closeContext(pendingContext);
    }
  }, []);

  const stop = useCallback((): void => {
    acquisitionGenerationRef.current += 1;
    teardown();
  }, [teardown]);

  const currentBlock = useCallback((
    generation: number,
    generationGuard: MicGenerationGuard | undefined,
    guard: MicrophonePlaybackGuardContract,
  ): MicStartOutcome | null => {
    if (lifecycleRef.current === 'background') {
      return { status: 'background' };
    }
    if (generation !== acquisitionGenerationRef.current) {
      return { status: 'cancelled' };
    }
    if (generationGuard && !generationGuard.isCurrent(generationGuard.token)) {
      return { status: 'cancelled' };
    }
    if (!guard.microphoneAllowed()) {
      return { status: 'playback-guarded' };
    }
    return null;
  }, []);

  const start = useCallback(async (): Promise<MicStartOutcome> => {
    const Ctor = getAudioContextCtor();
    if (!supported || !Ctor) {
      return { status: 'unsupported' };
    }

    const generation = acquisitionGenerationRef.current + 1;
    acquisitionGenerationRef.current = generation;
    teardown();
    const generationGuard = optionsRef.current.generation;
    const guard = optionsRef.current.playbackGuard ?? communicationMicrophoneGuard;
    const initialBlock = currentBlock(generation, generationGuard, guard);
    if (initialBlock) {
      return initialBlock;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error: unknown) {
      return currentBlock(generation, generationGuard, guard) ?? classifyStartError(error);
    }

    const postPermissionBlock = currentBlock(generation, generationGuard, guard);
    if (postPermissionBlock) {
      stopStream(stream);
      return postPermissionBlock;
    }
    pendingStreamRef.current = stream;

    let context: AudioContext;
    try {
      context = new Ctor();
      pendingContextRef.current = context;
      if (context.state === 'suspended') {
        await context.resume();
      }

      const postResumeBlock = currentBlock(generation, generationGuard, guard);
      if (postResumeBlock) {
        if (pendingStreamRef.current === stream) {
          pendingStreamRef.current = null;
          stopStream(stream);
        }
        if (pendingContextRef.current === context) {
          pendingContextRef.current = null;
          closeContext(context);
        }
        return postResumeBlock;
      }

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.65;
      source.connect(analyser);

      pendingStreamRef.current = null;
      pendingContextRef.current = null;
      streamRef.current = stream;
      contextRef.current = context;
      sourceRef.current = source;
      analyserRef.current = analyser;

      const waveform = new Uint8Array(analyser.fftSize);
      lastTimeRef.current = performance.now();
      const loop = (): void => {
        const node = analyserRef.current;
        if (!node || generation !== acquisitionGenerationRef.current) {
          return;
        }
        node.getByteTimeDomainData(waveform);
        let sumSquares = 0;
        for (const sample of waveform) {
          const centered = (sample - 128) / 128;
          sumSquares += centered * centered;
        }
        const rms = Math.sqrt(sumSquares / waveform.length);
        const level: MicEffortLevel = rms >= COARSE_EFFORT_RMS_THRESHOLD ? 1 : 0;
        const now = performance.now();
        const deltaMs = now - lastTimeRef.current;
        lastTimeRef.current = now;
        onSampleRef.current(level, deltaMs);
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
      return { status: 'started' };
    } catch (error: unknown) {
      if (pendingStreamRef.current === stream) {
        pendingStreamRef.current = null;
        stopStream(stream);
      }
      const pendingContext = pendingContextRef.current;
      pendingContextRef.current = null;
      if (pendingContext) {
        closeContext(pendingContext);
      }
      return currentBlock(generation, generationGuard, guard) ?? classifyStartError(error);
    }
  }, [currentBlock, supported, teardown]);

  useEffect(() => subscribeLifecycle((state) => {
    lifecycleRef.current = state;
    if (state === 'background') {
      stop();
    }
  }), [stop, subscribeLifecycle]);

  useEffect(() => playbackGuard.subscribe((snapshot) => {
    if (!snapshot.microphoneAllowed) {
      stop();
    }
  }), [playbackGuard, stop]);

  const generationToken = options.generation?.token;
  useEffect(() => {
    stop();
  }, [generationToken, stop]);

  useEffect(() => stop, [stop]);

  return { start, stop, supported };
}
