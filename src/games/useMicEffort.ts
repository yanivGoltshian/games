import { useCallback, useEffect, useRef } from 'react';
import {
  readAppLifecycleState,
  subscribeAppLifecycle,
  type AppLifecycleState,
} from '../platform/useAppLifecycle';
import {
  interactionMicrophoneGuard,
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

interface MicAcquisition {
  generation: number;
  cancelled: boolean;
  stream: MediaStream | null;
  streamStopped: boolean;
  context: AudioContext | null;
  contextClosed: boolean;
  source: MediaStreamAudioSourceNode | null;
  sourceDisconnected: boolean;
  analyser: AnalyserNode | null;
  analyserDisconnected: boolean;
  rafId: number | null;
  lastSampleTime: number;
}

function createAcquisition(generation: number): MicAcquisition {
  return {
    generation,
    cancelled: false,
    stream: null,
    streamStopped: false,
    context: null,
    contextClosed: false,
    source: null,
    sourceDisconnected: false,
    analyser: null,
    analyserDisconnected: false,
    rafId: null,
    lastSampleTime: 0,
  };
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
  const pendingAcquisitionRef = useRef<MicAcquisition | null>(null);
  const activeAcquisitionRef = useRef<MicAcquisition | null>(null);
  const playbackGuard = options.playbackGuard ?? interactionMicrophoneGuard;
  const subscribeLifecycle = options.subscribeLifecycle ?? subscribeAppLifecycle;
  const supported = microphoneSupported();

  const releaseAcquisition = useCallback((acquisition: MicAcquisition): void => {
    acquisition.cancelled = true;
    if (pendingAcquisitionRef.current === acquisition) {
      pendingAcquisitionRef.current = null;
    }
    if (activeAcquisitionRef.current === acquisition) {
      activeAcquisitionRef.current = null;
    }

    if (acquisition.rafId !== null) {
      cancelAnimationFrame(acquisition.rafId);
      acquisition.rafId = null;
    }

    if (acquisition.source && !acquisition.sourceDisconnected) {
      acquisition.sourceDisconnected = true;
      acquisition.source.disconnect();
    }
    if (acquisition.analyser && !acquisition.analyserDisconnected) {
      acquisition.analyserDisconnected = true;
      acquisition.analyser.disconnect();
    }
    if (acquisition.stream && !acquisition.streamStopped) {
      acquisition.streamStopped = true;
      stopStream(acquisition.stream);
    }
    if (acquisition.context && !acquisition.contextClosed) {
      acquisition.contextClosed = true;
      closeContext(acquisition.context);
    }
  }, []);

  const teardown = useCallback((): void => {
    const pending = pendingAcquisitionRef.current;
    const active = activeAcquisitionRef.current;
    if (pending) {
      releaseAcquisition(pending);
    }
    if (active && active !== pending) {
      releaseAcquisition(active);
    }
  }, [releaseAcquisition]);

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
    const guard = optionsRef.current.playbackGuard ?? interactionMicrophoneGuard;
    const initialBlock = currentBlock(generation, generationGuard, guard);
    if (initialBlock) {
      return initialBlock;
    }

    const acquisition = createAcquisition(generation);
    pendingAcquisitionRef.current = acquisition;
    try {
      acquisition.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error: unknown) {
      releaseAcquisition(acquisition);
      return currentBlock(generation, generationGuard, guard) ?? classifyStartError(error);
    }

    const postPermissionBlock = currentBlock(generation, generationGuard, guard);
    if (postPermissionBlock) {
      releaseAcquisition(acquisition);
      return postPermissionBlock;
    }

    try {
      acquisition.context = new Ctor();
      if (acquisition.context.state === 'suspended') {
        await acquisition.context.resume();
      }

      const postResumeBlock = currentBlock(generation, generationGuard, guard);
      if (postResumeBlock) {
        releaseAcquisition(acquisition);
        return postResumeBlock;
      }

      if (acquisition.cancelled || pendingAcquisitionRef.current !== acquisition) {
        releaseAcquisition(acquisition);
        return { status: 'cancelled' };
      }

      acquisition.source = acquisition.context.createMediaStreamSource(acquisition.stream);
      acquisition.analyser = acquisition.context.createAnalyser();
      acquisition.analyser.fftSize = 1024;
      acquisition.analyser.smoothingTimeConstant = 0.65;
      acquisition.source.connect(acquisition.analyser);

      pendingAcquisitionRef.current = null;
      activeAcquisitionRef.current = acquisition;

      const waveform = new Uint8Array(acquisition.analyser.fftSize);
      acquisition.lastSampleTime = performance.now();
      const loop = (): void => {
        const node = acquisition.analyser;
        if (
          !node
          || acquisition.cancelled
          || activeAcquisitionRef.current !== acquisition
          || acquisition.generation !== acquisitionGenerationRef.current
        ) {
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
        const deltaMs = now - acquisition.lastSampleTime;
        acquisition.lastSampleTime = now;
        onSampleRef.current(level, deltaMs);
        acquisition.rafId = requestAnimationFrame(loop);
      };
      acquisition.rafId = requestAnimationFrame(loop);
      return { status: 'started' };
    } catch (error: unknown) {
      releaseAcquisition(acquisition);
      return currentBlock(generation, generationGuard, guard) ?? classifyStartError(error);
    }
  }, [currentBlock, releaseAcquisition, supported, teardown]);

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
