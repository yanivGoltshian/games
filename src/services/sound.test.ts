// @vitest-environment jsdom

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ToddlerSettings } from '../domain/types';
import { soundService } from './sound';

class FakeParam {
  value = 0;
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeNode {
  type = '';
  gain = new FakeParam();
  frequency = new FakeParam();
  Q = new FakeParam();
  threshold = { value: 0 };
  knee = { value: 0 };
  ratio = { value: 0 };
  attack = { value: 0 };
  release = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

const created = {
  oscillators: [] as FakeNode[],
  gains: [] as FakeNode[],
  filters: [] as FakeNode[],
  compressors: [] as FakeNode[],
};

class FakeAudioContext {
  currentTime = 0;
  state: AudioContextState = 'running';
  destination = { id: 'destination' } as unknown as AudioDestinationNode;
  resume = vi.fn().mockResolvedValue(undefined);
  createOscillator = vi.fn(() => {
    const node = new FakeNode();
    created.oscillators.push(node);
    return node;
  });
  createGain = vi.fn(() => {
    const node = new FakeNode();
    created.gains.push(node);
    return node;
  });
  createBiquadFilter = vi.fn(() => {
    const node = new FakeNode();
    created.filters.push(node);
    return node;
  });
  createDynamicsCompressor = vi.fn(() => {
    const node = new FakeNode();
    created.compressors.push(node);
    return node;
  });
}

const audible: ToddlerSettings = {
  quietMode: false,
  soundLevel: 1,
} as ToddlerSettings;

describe('soundService synthesis engine', () => {
  beforeAll(() => {
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
      FakeAudioContext as unknown as typeof AudioContext;
  });

  afterAll(() => {
    delete (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
  });

  it('routes voices through a single warm master bus (low-pass + compressor) on first playback', () => {
    created.oscillators.length = 0;
    soundService.playSuccess(audible);

    // Two melodic steps, each with a fundamental + a gentle octave shimmer = 4 voices.
    expect(created.oscillators.length).toBe(4);
    expect(created.filters.length).toBe(1);
    expect(created.compressors.length).toBe(1);
    expect(created.filters[0]!.type).toBe('lowpass');

    const context = soundService.getContext() as unknown as FakeAudioContext;
    expect(created.compressors[0]!.connect).toHaveBeenCalledWith(context.destination);
  });

  it('reuses the cached master bus across subsequent cues', () => {
    soundService.playCelebrate(audible);
    soundService.playTap(audible);

    // Master nodes are built once and cached; only the per-voice oscillators keep growing.
    expect(created.filters.length).toBe(1);
    expect(created.compressors.length).toBe(1);
  });

  it('stays completely silent in quiet mode', () => {
    const before = created.oscillators.length;
    soundService.playCelebrate({ quietMode: true, soundLevel: 1 } as ToddlerSettings);
    expect(created.oscillators.length).toBe(before);
  });

  it('stays completely silent when the sound level is zero', () => {
    const before = created.oscillators.length;
    soundService.playSuccess({ quietMode: false, soundLevel: 0 } as ToddlerSettings);
    expect(created.oscillators.length).toBe(before);
  });
});
