import { describe, expect, it, vi } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import { createCommunicationLocaleLock, type CommunicationGameScope } from '../domain/communicationGame';
import type { SpeechRequestOptions, SpeechResult, SpeechSegment } from './speech';
import {
  InteractionMediaCoordinator,
  type InteractionMediaRequest,
  type InteractionSpeechBackend,
} from './interactionMediaCoordinator';
import { MicrophonePlaybackGuard } from './microphonePlaybackGuard';

interface PendingPlayback {
  options: SpeechRequestOptions;
  resolve: (result: SpeechResult) => void;
  settled: boolean;
}

class FakeSpeechBackend implements InteractionSpeechBackend {
  readonly playbacks: PendingPlayback[] = [];
  readonly cancelScope = vi.fn((scope: string) => {
    const playback = this.playbacks.find((candidate) => (
      candidate.options.scope === scope && !candidate.settled
    ));
    playback?.resolve({ requestId: 1, status: 'cancelled' });
  });

  speakSegments(
    _segments: SpeechSegment[],
    _settings: ReturnType<typeof createInitialSettings>,
    options: SpeechRequestOptions,
  ): Promise<SpeechResult> {
    return new Promise((resolve) => {
      const playback: PendingPlayback = {
        options,
        settled: false,
        resolve: (result) => {
          playback.settled = true;
          resolve(result);
        },
      };
      this.playbacks.push(playback);
    });
  }

  start(index: number): void {
    this.playbacks[index]?.options.onStart?.();
  }

  finish(index: number, status: SpeechResult['status'] = 'completed'): void {
    this.playbacks[index]?.resolve({ requestId: index + 1, status });
  }
}

const scope: CommunicationGameScope = {
  activityId: 'peek',
  sessionId: 'session-1',
  roundId: 'round-1',
  stepId: 'step-1',
};
const settings = createInitialSettings();
const lifecycle = () => () => undefined;

function request(
  intentId: string,
  audioClass: InteractionMediaRequest['audioClass'],
  source: InteractionMediaRequest['source'] = 'touch',
  requestScope = scope,
): InteractionMediaRequest {
  return {
    intentId,
    source,
    scope: requestScope,
    localeLock: createCommunicationLocaleLock(requestScope, 'he-IL'),
    audioClass,
    segments: [{ text: intentId, locale: 'he-IL' }],
    settings,
  };
}

describe('interaction media coordinator', () => {
  it('lets a started mandatory model finish and coalesces rapid newer intents', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    const mandatory = coordinator.play(request('mandatory', 'mandatory'));
    speech.start(0);
    const stale = coordinator.play(request('stale', 'conditional'));
    const latest = coordinator.play(request('latest', 'mandatory'));

    await expect(stale).resolves.toMatchObject({ status: 'replaced' });
    expect(speech.cancelScope).not.toHaveBeenCalled();
    expect(speech.playbacks).toHaveLength(1);

    speech.finish(0);
    await expect(mandatory).resolves.toMatchObject({ status: 'completed' });
    expect(speech.playbacks).toHaveLength(2);
    speech.start(1);
    speech.finish(1);
    await expect(latest).resolves.toMatchObject({ status: 'completed' });
    coordinator.dispose();
  });

  it.each(['touch', 'voice', 'automatic'] as const)(
    'gives %s input the same conditional cancellation outcome',
    async (source) => {
      const speech = new FakeSpeechBackend();
      const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
      const invitation = coordinator.play(request(`conditional-${source}`, 'conditional', source));
      speech.start(0);

      coordinator.notifyInteraction(scope, source);

      await expect(invitation).resolves.toMatchObject({ status: 'replaced' });
      expect(speech.cancelScope).toHaveBeenCalledOnce();
      coordinator.dispose();
    },
  );

  it('cancels conditional speech on state transition and mandatory speech on exit', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    const conditional = coordinator.play(request('conditional', 'conditional'));
    speech.start(0);
    coordinator.notifyInteraction(scope, 'state-transition');
    await expect(conditional).resolves.toMatchObject({ status: 'replaced' });

    const mandatory = coordinator.play(request('mandatory', 'mandatory'));
    speech.start(1);
    coordinator.notifyInteraction(scope, 'exit');
    await expect(mandatory).resolves.toMatchObject({ status: 'cancelled' });
    coordinator.dispose();
  });

  it('cancels started mandatory speech on background or activity replacement', async () => {
    let emitLifecycle: (state: 'foreground' | 'background') => void = () => undefined;
    const subscribe = (listener: (state: 'foreground' | 'background') => void) => {
      emitLifecycle = listener;
      return () => {
        emitLifecycle = () => undefined;
      };
    };
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(
      speech,
      new MicrophonePlaybackGuard(),
      subscribe,
    );
    const backgrounded = coordinator.play(request('backgrounded', 'mandatory'));
    speech.start(0);

    emitLifecycle('background');

    await expect(backgrounded).resolves.toMatchObject({ status: 'cancelled' });
    expect(speech.cancelScope).toHaveBeenLastCalledWith(
      expect.any(String),
      'visibility',
    );

    const replaced = coordinator.play(request('replaced', 'mandatory'));
    speech.start(1);
    coordinator.notifyInteraction(
      { ...scope, activityId: 'phone', sessionId: 'session-2' },
      'activity-replacement',
    );
    await expect(replaced).resolves.toMatchObject({ status: 'replaced' });
    coordinator.dispose();
  });

  it('replaces an active conditional invitation with only the latest intent', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    const first = coordinator.play(request('first', 'conditional'));
    speech.start(0);
    const stale = coordinator.play(request('stale', 'conditional'));
    const latest = coordinator.play(request('latest', 'conditional'));

    await expect(first).resolves.toMatchObject({ status: 'replaced' });
    await expect(stale).resolves.toMatchObject({ status: 'replaced' });
    expect(speech.playbacks).toHaveLength(2);
    speech.start(1);
    speech.finish(1);
    await expect(latest).resolves.toMatchObject({ status: 'completed' });
    coordinator.dispose();
  });

  it('drops decorative audio whenever another interaction is active', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    const active = coordinator.play(request('mandatory', 'mandatory'));
    speech.start(0);

    await expect(coordinator.play(request('decoration', 'decorative'))).resolves.toMatchObject({
      status: 'replaced',
    });
    expect(speech.playbacks).toHaveLength(1);

    speech.finish(0);
    await active;
    coordinator.dispose();
  });

  it('uses real playback completion and exposes unavailable and error outcomes', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    let settled = false;
    const completion = coordinator.play(request('complete', 'mandatory')).then((outcome) => {
      settled = true;
      return outcome;
    });
    speech.start(0);
    await Promise.resolve();
    expect(settled).toBe(false);
    speech.finish(0);
    await expect(completion).resolves.toMatchObject({ status: 'completed', speechStatus: 'completed' });

    const unavailable = coordinator.play(request('unavailable', 'conditional'));
    speech.finish(1, 'unsupported');
    await expect(unavailable).resolves.toMatchObject({ status: 'unavailable' });

    const errored = coordinator.play(request('errored', 'conditional'));
    speech.finish(2, 'error');
    await expect(errored).resolves.toMatchObject({ status: 'errored' });
    coordinator.dispose();
  });

  it('rejects a segment outside the exact locale lock without starting playback', async () => {
    const speech = new FakeSpeechBackend();
    const coordinator = new InteractionMediaCoordinator(speech, new MicrophonePlaybackGuard(), lifecycle);
    const mismatched = {
      ...request('mismatch', 'mandatory'),
      segments: [{ text: 'word', locale: 'en-US' as const }],
    };

    await expect(coordinator.play(mismatched)).resolves.toMatchObject({
      status: 'unavailable',
      reason: 'locale-mismatch',
    });
    expect(speech.playbacks).toHaveLength(0);
    coordinator.dispose();
  });
});
