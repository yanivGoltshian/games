// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { CountingRound, ProgressUpdateSummary } from '../domain/types';
import type { SpeechRequestOptions, SpeechResult } from '../services/speech';
import { CountingGame } from './CountingGame';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
}));

const soundDouble = vi.hoisted(() => ({
  playTap: vi.fn(),
  playRetry: vi.fn(),
  playSuccess: vi.fn(),
  playCelebrate: vi.fn(),
  vibrate: vi.fn(),
}));

const micDouble = vi.hoisted(() => {
  let onSample: ((level: number, deltaMs: number) => void) | null = null;
  return {
    supported: true,
    start: vi.fn(),
    stop: vi.fn(),
    emit: (level: number, deltaMs = 16) => onSample?.(level, deltaMs),
    capture: (fn: (level: number, deltaMs: number) => void) => {
      onSample = fn;
    },
  };
});

const testRound: CountingRound = {
  targetCount: 3,
  options: [2, 3, 4],
  countingConceptId: 'apple',
  promptHe: 'כמה תפוחים יש?',
  promptEn: 'How many apples?',
  answerHe: 'שלושה תפוחים',
  answerEn: 'three apples',
};

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock('../services/sound', () => ({
  soundService: soundDouble,
}));

vi.mock('../services/speech', () => ({
  buildLocalizedSegments: (lines: Array<{ he: string; en: string }>) => (
    lines.map((line) => ({ text: line.he, locale: 'he-IL' }))
  ),
  buildPersonalizedPhraseSegments: (line: { he: string }) => (
    [{ text: line.he, locale: 'he-IL' }]
  ),
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
  speechService: {
    cancelScope: doubles.cancelScope,
    speakSegments: doubles.speakSegments,
  },
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ conceptId }: { conceptId: string }) => (
    <span data-testid="concept-art">{conceptId}</span>
  ),
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: testRound,
    roundKey: 'counting-round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: number, deltaMs: number) => void) => {
    micDouble.capture(onSample);
    return {
      start: micDouble.start,
      stop: micDouble.stop,
      supported: micDouble.supported,
    };
  },
}));

describe('CountingGame — count-out-loud voice affordance', () => {
  let container: HTMLDivElement;
  let root: Root;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    vi.useFakeTimers();
    micDouble.supported = true;
    micDouble.start.mockReset();
    micDouble.start.mockResolvedValue({ status: 'started' });
    micDouble.stop.mockReset();
    doubles.speakSegments.mockReset();
    doubles.cancelScope.mockReset();
    doubles.startNextRound.mockReset();
    for (const fn of Object.values(soundDouble)) {
      fn.mockReset();
    }
    doubles.speakSegments.mockImplementation(
      (
        _segments: unknown,
        _settings: unknown,
        options: SpeechRequestOptions,
      ): Promise<SpeechResult> => {
        options.onStart?.();
        return Promise.resolve({ requestId: 1, status: 'completed' });
      },
    );
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function createCompleteRound() {
    return vi.fn((): ProgressUpdateSummary => ({
      starsEarned: 1,
      leveledUp: false,
      milestone: false,
      level: 1,
      mastery: 0.5,
      firstAttempt: true,
      recommendation: null,
    }));
  }

  async function renderGame(
    onCompleteRound = createCompleteRound(),
    mediaReady = false,
    strictMode = false,
  ) {
    const progress = createInitialProgress(false, 0);
    const settings = createInitialSettings();
    const game = (
      <CountingGame
        domainProgress={progress.domains.counting}
        settings={settings}
        overallStars={0}
        mediaReady={mediaReady}
        speechStatus={{
          supported: true,
          voiceAvailable: true,
          speaking: false,
          activeRequestId: null,
          activeCue: null,
        }}
        onBack={() => undefined}
        onCompleteRound={onCompleteRound}
      />
    );
    await act(async () => {
      root.render(strictMode ? <StrictMode>{game}</StrictMode> : game);
    });
    // The mount effect resets mic state (calls stop once); start from a clean slate.
    micDouble.start.mockClear();
    micDouble.stop.mockClear();
    return onCompleteRound;
  }

  it('starts a fresh round instead of replaying speech from the circular arrow', async () => {
    await renderGame();
    doubles.speakSegments.mockClear();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--restart')!.click();
    });

    expect(doubles.cancelScope).toHaveBeenCalledWith('game:counting');
    expect(doubles.startNextRound).toHaveBeenCalledTimes(1);
    expect(doubles.speakSegments).not.toHaveBeenCalled();
  });

  it('hides the voice toggle when the microphone is not supported', async () => {
    micDouble.supported = false;
    await renderGame();

    expect(container.querySelector('.counting-voice')).toBeNull();
  });

  it('routes the spoken prompt through the shared media coordinator', async () => {
    await renderGame(createCompleteRound(), true);

    expect(doubles.speakSegments).toHaveBeenCalledOnce();
    expect(doubles.speakSegments.mock.calls[0]?.[2]).toMatchObject({
      scope: expect.stringContaining('communication:counting'),
      priority: 'prompt',
    });
    expect(micDouble.start).not.toHaveBeenCalled();
  });

  it('opens the microphone and lights up when the toggle is pressed', async () => {
    await renderGame();

    const toggle = container.querySelector<HTMLButtonElement>('.counting-voice__toggle');
    expect(toggle).not.toBeNull();
    expect(toggle!.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      toggle!.click();
    });

    expect(micDouble.start).toHaveBeenCalledTimes(1);
    const liveToggle = container.querySelector('.counting-voice__toggle');
    expect(liveToggle!.classList.contains('is-live')).toBe(true);
    expect(liveToggle!.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps the microphone generation current after StrictMode effect replay', async () => {
    await renderGame(createCompleteRound(), false, true);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });

    expect(micDouble.start).toHaveBeenCalledOnce();
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('ignores an older microphone start that settles after a newer tap succeeds', async () => {
    const staleStart = deferred<{ status: 'cancelled' }>();
    micDouble.start
      .mockReset()
      .mockReturnValueOnce(staleStart.promise)
      .mockResolvedValueOnce({ status: 'started' });
    await renderGame();
    const toggle = container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!;

    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });
    await act(async () => {
      toggle.click();
      await Promise.resolve();
    });
    expect(micDouble.start).toHaveBeenCalledTimes(2);
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      staleStart.resolve({ status: 'cancelled' });
      await staleStart.promise;
    });
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('drives the counting glow from the sampled voice level', async () => {
    await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });

    await act(async () => {
      micDouble.emit(0.5);
    });

    const cloud = container.querySelector<HTMLElement>('.counting-cloud');
    expect(cloud!.getAttribute('data-voice')).toBe('on');
    expect(cloud!.style.getPropertyValue('--voice')).toBe('0.5');
  });

  it('stops the microphone on a second press', async () => {
    await renderGame();

    const toggle = container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!;
    await act(async () => {
      toggle.click();
    });
    await act(async () => {
      toggle.click();
    });

    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    const idleToggle = container.querySelector('.counting-voice__toggle');
    expect(idleToggle!.classList.contains('is-live')).toBe(false);
  });

  it('stops listening and clears the live UI when the app backgrounds', async () => {
    await renderGame();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(micDouble.stop).toHaveBeenCalled();
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.counting-cloud')!.getAttribute('data-voice')).toBe('off');
  });

  it('never blocks progression: a correct pick still completes the round while listening', async () => {
    const onCompleteRound = await renderGame();

    // Turn the mic on first to prove the ambient feature is independent of the pick flow.
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });
    await act(async () => {
      micDouble.emit(0.8);
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('.choice-button--number');
    // options = [2, 3, 4]; the correct answer is targetCount 3 at index 1.
    await act(async () => {
      buttons[1]!.click();
    });

    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredActions: 1,
        concepts: ['count-3'],
      }),
    );
    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.success-overlay')).not.toBeNull();
  });

  it('stops active capture before wrong-answer narration starts', async () => {
    await renderGame();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });

    const buttons = container.querySelectorAll<HTMLButtonElement>('.choice-button--number');
    await act(async () => {
      buttons[0]!.click();
      await Promise.resolve();
    });

    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    expect(doubles.speakSegments).toHaveBeenCalledOnce();
    expect(micDouble.stop.mock.invocationCallOrder[0]).toBeLessThan(
      doubles.speakSegments.mock.invocationCallOrder[0]!,
    );
    expect(doubles.speakSegments.mock.calls[0]?.[2]).toMatchObject({ priority: 'prompt' });
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('false');
  });

  it('invalidates pending permission before answer processing and ignores its late result', async () => {
    const pendingStart = deferred<{ status: 'started' }>();
    micDouble.start.mockReset().mockReturnValue(pendingStart.promise);
    await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
      await Promise.resolve();
    });
    const buttons = container.querySelectorAll<HTMLButtonElement>('.choice-button--number');
    await act(async () => {
      buttons[0]!.click();
      await Promise.resolve();
    });

    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    expect(doubles.speakSegments).toHaveBeenCalledOnce();
    pendingStart.resolve({ status: 'started' });
    await act(async () => {
      await pendingStart.promise;
      await Promise.resolve();
    });

    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('false');
    expect(container.querySelector('.counting-cloud')!.getAttribute('data-voice')).toBe('off');
  });

  it('keeps retry narration isolated until true completion plus the 400 ms guard', async () => {
    const retryPlayback = deferred<SpeechResult>();
    doubles.speakSegments.mockImplementationOnce(
      (
        _segments: unknown,
        _settings: unknown,
        options: SpeechRequestOptions,
      ): Promise<SpeechResult> => {
        options.onStart?.();
        return retryPlayback.promise;
      },
    );
    micDouble.start
      .mockReset()
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValueOnce({ status: 'playback-guarded' })
      .mockResolvedValueOnce({ status: 'started' });
    await renderGame();
    const voiceToggle = container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!;
    await act(async () => {
      voiceToggle.click();
    });
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('.choice-button--number')[0]!.click();
      await Promise.resolve();
    });

    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    expect(micDouble.stop.mock.invocationCallOrder[0]).toBeLessThan(
      doubles.speakSegments.mock.invocationCallOrder[0]!,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(720);
    });
    retryPlayback.resolve({ requestId: 2, status: 'completed' });
    await act(async () => {
      await retryPlayback.promise;
      await Promise.resolve();
    });

    await act(async () => {
      voiceToggle.click();
      await Promise.resolve();
    });
    expect(micDouble.start).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(micDouble.start).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(micDouble.start).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps success narration isolated until true completion plus the 400 ms guard', async () => {
    const successPlayback = deferred<SpeechResult>();
    doubles.speakSegments.mockImplementationOnce(
      (
        _segments: unknown,
        _settings: unknown,
        options: SpeechRequestOptions,
      ): Promise<SpeechResult> => {
        options.onStart?.();
        return successPlayback.promise;
      },
    );
    micDouble.start
      .mockReset()
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValueOnce({ status: 'playback-guarded' })
      .mockResolvedValueOnce({ status: 'started' });
    await renderGame();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
    });
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('.choice-button--number')[1]!.click();
      await Promise.resolve();
    });

    expect(micDouble.stop).toHaveBeenCalledTimes(1);
    expect(doubles.speakSegments).toHaveBeenCalledOnce();
    expect(doubles.speakSegments.mock.calls[0]?.[2]).toMatchObject({ priority: 'label' });
    expect(micDouble.stop.mock.invocationCallOrder[0]).toBeLessThan(
      doubles.speakSegments.mock.invocationCallOrder[0]!,
    );

    successPlayback.resolve({ requestId: 3, status: 'completed' });
    await act(async () => {
      await successPlayback.promise;
      await Promise.resolve();
    });
    await act(async () => {
      container.querySelector('.success-overlay')!.dispatchEvent(
        new Event('pointerdown', { bubbles: true }),
      );
    });
    const voiceToggle = container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!;
    await act(async () => {
      voiceToggle.click();
      await Promise.resolve();
    });
    expect(micDouble.start).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(micDouble.start).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(micDouble.start).toHaveBeenCalledTimes(3);
  });

  it('cancels stale success narration when the overlay advances without reopening capture', async () => {
    const successPlayback = deferred<SpeechResult>();
    doubles.speakSegments.mockImplementationOnce(
      (
        _segments: unknown,
        _settings: unknown,
        options: SpeechRequestOptions,
      ): Promise<SpeechResult> => {
        options.onStart?.();
        return successPlayback.promise;
      },
    );
    await renderGame();
    await act(async () => {
      container.querySelectorAll<HTMLButtonElement>('.choice-button--number')[1]!.click();
      await Promise.resolve();
    });

    await act(async () => {
      container.querySelector('.success-overlay')!.dispatchEvent(
        new Event('pointerdown', { bubbles: true }),
      );
    });
    expect(doubles.cancelScope).toHaveBeenCalledOnce();
    expect(micDouble.start).not.toHaveBeenCalled();

    successPlayback.resolve({ requestId: 4, status: 'cancelled' });
    await act(async () => {
      await successPlayback.promise;
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(micDouble.start).not.toHaveBeenCalled();
  });

  it('does not reopen a pending voice request after backgrounding', async () => {
    const pendingStart = deferred<{ status: 'started' }>();
    micDouble.start.mockReset().mockReturnValue(pendingStart.promise);
    await renderGame();
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.counting-voice__toggle')!.click();
      await Promise.resolve();
    });

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    pendingStart.resolve({ status: 'started' });
    await act(async () => {
      await pendingStart.promise;
      await Promise.resolve();
    });

    expect(micDouble.stop).toHaveBeenCalled();
    expect(container.querySelector('.counting-voice__toggle')!.getAttribute('aria-pressed')).toBe('false');
  });
});
