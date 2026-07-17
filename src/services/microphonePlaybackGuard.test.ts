import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS,
  MicrophonePlaybackGuard,
} from './microphonePlaybackGuard';

describe('microphone playback guard', () => {
  it('keeps the microphone closed during playback and for 400 ms after true completion', () => {
    let now = 1_000;
    const guard = new MicrophonePlaybackGuard(undefined, () => now);

    guard.beginPlayback('speech-1');
    expect(guard.microphoneAllowed()).toBe(false);

    guard.settlePlayback('speech-1', 'completed');
    expect(guard.getSnapshot().blockedUntil).toBe(1_000 + DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS);
    expect(guard.microphoneAllowed()).toBe(false);

    now += DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS;
    expect(guard.microphoneAllowed()).toBe(true);
  });

  it('does not invent a post-playback delay for cancelled or unavailable speech', () => {
    const guard = new MicrophonePlaybackGuard();

    guard.beginPlayback('speech-1');
    guard.settlePlayback('speech-1', 'cancelled');
    expect(guard.microphoneAllowed()).toBe(true);

    guard.beginPlayback('speech-2');
    guard.settlePlayback('speech-2', 'unavailable');
    expect(guard.microphoneAllowed()).toBe(true);
  });

  it('ignores stale completion callbacks from replaced playback', () => {
    const listener = vi.fn();
    const guard = new MicrophonePlaybackGuard();
    guard.subscribe(listener);

    guard.beginPlayback('speech-1');
    guard.beginPlayback('speech-2');
    guard.settlePlayback('speech-1', 'completed');

    expect(guard.getSnapshot().activePlaybackId).toBe('speech-2');
    expect(guard.microphoneAllowed()).toBe(false);
  });
});
