// @vitest-environment jsdom

import { act, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { ProgressUpdateSummary, SillyAlienRound } from '../domain/types';
import type { SpeechRequestOptions, SpeechResult } from '../services/speech';
import { SillyAlienGame } from './SillyAlienGame';

// ── Test doubles ────────────────────────────────────────────────────────────
// The reducer, phases and effect wiring are the real thing; only the three
// side-effecting boundaries (speech, sound, microphone) and the round source
// are faked so the hands-free flow can be driven deterministically.

const speech = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  speakSegments: vi.fn(),
}));

const round = vi.hoisted(() => ({
  startNextRound: vi.fn(),
  roundKey: 'silly-round-1',
}));

const sound = vi.hoisted(() => ({
  unlock: vi.fn(),
  playTap: vi.fn(),
  playPop: vi.fn(),
  playRetry: vi.fn(),
  playBoing: vi.fn(),
  playSuccess: vi.fn(),
}));

// The microphone hook is fully mocked. `onSample` captures the callback the
// component hands us so a test can inject synthetic vocal-effort frames exactly
// like `useMicEffort` would while the mic is open.
const mic = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  supported: true,
  onSample: null as null | ((level: number, deltaMs: number) => void),
}));

const testRound: SillyAlienRound = {
  conceptId: 'apple',
  fullHe: 'תַּפּוּחַ',
  fullEn: 'apple',
  brokenHe: 'פּוּחַ',
  brokenEn: '…pple',
  droppedLetterHe: 'תַּ',
  promptHe: 'שון, תגיד לו איך אומרים:',
  promptEn: 'Sean, tell it how to say:',
  signature: 'apple|silly',
};

vi.mock('../services/sound', () => ({
  soundService: sound,
}));

vi.mock('../services/speech', () => ({
  buildLocalizedSegments: (lines: unknown[]) => lines,
  buildPersonalizedPhraseSegments: (line: unknown) => [line],
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
  speechService: {
    cancelScope: speech.cancelScope,
    speakSegments: speech.speakSegments,
  },
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ label }: { label: string }) => (
    <span data-testid="concept-art">{label}</span>
  ),
}));

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: () => <div data-testid="success-overlay" />,
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: testRound,
    roundKey: round.roundKey,
    startNextRound: round.startNextRound,
  }),
}));

vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: number, deltaMs: number) => void) => {
    mic.onSample = onSample;
    return { start: mic.start, stop: mic.stop, supported: mic.supported };
  },
}));

describe('SillyAlienGame (hands-free)', () => {
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

    speech.cancelScope.mockReset();
    speech.speakSegments.mockReset();
    speech.speakSegments.mockResolvedValue({ requestId: 1, status: 'completed' });

    round.startNextRound.mockReset();
    round.roundKey = 'silly-round-1';

    for (const fn of Object.values(sound)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }

    mic.start.mockReset();
    mic.start.mockResolvedValue({ status: 'started' });
    mic.stop.mockReset();
    mic.supported = true;
    mic.onSample = null;

    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  function deferred<Value>() {
    let resolve!: (value: Value) => void;
    const promise = new Promise<Value>((resolvePromise) => {
      resolve = resolvePromise;
    });
    return { promise, resolve };
  }

  function startControlledPlayback(playback: ReturnType<typeof deferred<SpeechResult>>) {
    return (
      _segments: unknown,
      _settings: unknown,
      options: SpeechRequestOptions,
    ): Promise<SpeechResult> => {
      options.onStart?.();
      return playback.promise;
    };
  }

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
    childName?: string,
    strictMode = false,
    mediaReady = false,
  ) {
    const progress = createInitialProgress(false, 0);
    const settings = childName
      ? { ...createInitialSettings(), childName }
      : createInitialSettings();
    const game = (
      <SillyAlienGame
        domainProgress={progress.domains.sillyAlien}
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
    return onCompleteRound;
  }

  /** Flush the promise-driven phase chain (unlock → present → listen …). */
  async function settle() {
    for (let i = 0; i < 5; i += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  function phase(): string | null {
    return container.querySelector('.silly-alien-surface')?.getAttribute('data-phase') ?? null;
  }

  function wakeTap() {
    const tap = container.querySelector<HTMLButtonElement>('.silly-alien-figure-tap');
    expect(tap).not.toBeNull();
    tap!.click();
  }

  it('starts asleep: shows a wordless wake cue and the broken word, mic stays closed', async () => {
    await renderGame();

    expect(phase()).toBe('locked');
    // The one obvious, non-reading affordance — a pointing hand over the alien.
    expect(container.querySelector('.silly-alien-figure-tap--locked')).not.toBeNull();
    expect(container.querySelector('.silly-alien-wake__hand')).not.toBeNull();

    // The alien is "missing" the first syllable of the target word.
    expect(container.querySelector('.silly-alien-bubble__word')!.textContent).toBe(
      testRound.brokenHe,
    );
    // The large central target is always visible (image-driven, no reading).
    expect(container.querySelector('[data-testid="concept-art"]')!.textContent).toBe(
      testRound.fullHe,
    );

    // Nothing is listening yet and the microphone was never opened.
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(mic.start).not.toHaveBeenCalled();
  });

  it('one wake tap unlocks audio + mic, models the word, then opens hands-free listening', async () => {
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();

    // The gesture unlocks the AudioContext and probes microphone permission.
    expect(sound.unlock).toHaveBeenCalledTimes(1);
    expect(sound.playTap).toHaveBeenCalled();
    expect(mic.start).toHaveBeenCalled();

    // The comic gag pops the syllable off and the model is spoken.
    expect(sound.playPop).toHaveBeenCalled();
    expect(speech.speakSegments).toHaveBeenCalled();

    // After the model finishes we land in listening with a live effort meter —
    // no button is held while Sean speaks.
    expect(phase()).toBe('listening');
    const meter = container.querySelector('[role="progressbar"]');
    expect(meter).not.toBeNull();
    expect(meter!.classList.contains('silly-alien-reactor')).toBe(true);
  });

  it('keeps the hands-free generation current after StrictMode effect replay', async () => {
    await renderGame(createCompleteRound(), undefined, true);

    await act(async () => {
      wakeTap();
    });
    await settle();

    expect(phase()).toBe('listening');
    expect(mic.start).toHaveBeenCalledTimes(2);
  });

  it('opens presentation listening only at true completion plus the 400 ms guard', async () => {
    const presentation = deferred<SpeechResult>();
    speech.speakSegments.mockImplementationOnce(startControlledPlayback(presentation));
    mic.start.mockReset();
    mic.start
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValueOnce({ status: 'playback-guarded' })
      .mockResolvedValue({ status: 'started' });
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('presenting');
    expect(mic.start).toHaveBeenCalledTimes(1);
    expect(speech.speakSegments.mock.calls[0]?.[2]).toMatchObject({ priority: 'label' });

    presentation.resolve({ requestId: 1, status: 'completed' });
    await settle();
    expect(phase()).toBe('listening');
    expect(mic.start).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(mic.start).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mic.start).toHaveBeenCalledTimes(3);
  });

  it('keeps listening closed for a mandatory replay queued during presentation', async () => {
    const presentation = deferred<SpeechResult>();
    const replay = deferred<SpeechResult>();
    speech.speakSegments
      .mockImplementationOnce(startControlledPlayback(presentation))
      .mockImplementationOnce(startControlledPlayback(replay));
    mic.start.mockReset();
    mic.start
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValueOnce({ status: 'playback-guarded' })
      .mockResolvedValue({ status: 'started' });
    await renderGame(createCompleteRound(), undefined, false, true);
    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('presenting');

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--replay')!.click();
    });
    expect(speech.speakSegments).toHaveBeenCalledTimes(1);

    presentation.resolve({ requestId: 1, status: 'completed' });
    await settle();
    expect(phase()).toBe('listening');
    expect(speech.speakSegments).toHaveBeenCalledTimes(2);
    expect(mic.start).toHaveBeenCalledTimes(1);

    replay.resolve({ requestId: 2, status: 'completed' });
    await settle();
    expect(mic.start).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(mic.start).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mic.start).toHaveBeenCalledTimes(3);
  });

  it('opens nudge listening only at true completion plus the 400 ms guard', async () => {
    await renderGame();
    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('listening');
    expect(mic.start).toHaveBeenCalledTimes(2);

    const nudge = deferred<SpeechResult>();
    speech.speakSegments.mockImplementationOnce(startControlledPlayback(nudge));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(phase()).toBe('nudge');
    expect(speech.speakSegments.mock.calls.at(-1)?.[2]).toMatchObject({ priority: 'prompt' });
    mic.start.mockResolvedValueOnce({ status: 'playback-guarded' });

    nudge.resolve({ requestId: 2, status: 'completed' });
    await settle();
    expect(phase()).toBe('listening');
    expect(mic.start).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(mic.start).toHaveBeenCalledTimes(3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(mic.start).toHaveBeenCalledTimes(4);
  });

  it('never reopens after presentation is cancelled by backgrounding', async () => {
    const presentation = deferred<SpeechResult>();
    speech.speakSegments.mockImplementationOnce(startControlledPlayback(presentation));
    await renderGame();
    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('presenting');

    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(speech.cancelScope).toHaveBeenCalled();
    presentation.resolve({ requestId: 1, status: 'cancelled' });
    await settle();

    expect(phase()).toBe('presenting');
    expect(mic.start).toHaveBeenCalledTimes(1);
    await act(async () => {
      window.dispatchEvent(new Event('pageshow'));
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(mic.start).toHaveBeenCalledTimes(1);
  });

  it('routes a presentation playback error to fallback without reopening the mic', async () => {
    const presentation = deferred<SpeechResult>();
    speech.speakSegments.mockImplementationOnce(startControlledPlayback(presentation));
    await renderGame();
    await act(async () => {
      wakeTap();
    });
    await settle();

    presentation.resolve({ requestId: 1, status: 'error' });
    await settle();
    expect(phase()).toBe('parentFallback');
    expect(mic.start).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(mic.start).toHaveBeenCalledTimes(1);
  });

  it('ignores a completed presentation callback from a stale round', async () => {
    const stalePresentation = deferred<SpeechResult>();
    speech.speakSegments
      .mockImplementationOnce(startControlledPlayback(stalePresentation))
      .mockResolvedValueOnce({ requestId: 2, status: 'cancelled' });
    await renderGame();
    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('presenting');

    round.roundKey = 'silly-round-2';
    await renderGame();
    await settle();
    stalePresentation.resolve({ requestId: 1, status: 'completed' });
    await settle();

    expect(phase()).toBe('presenting');
    expect(mic.start).toHaveBeenCalledTimes(1);
  });

  it('cancels a stale nudge on touch and never restarts listening', async () => {
    await renderGame();
    await act(async () => {
      wakeTap();
    });
    await settle();
    const nudge = deferred<SpeechResult>();
    speech.speakSegments.mockImplementationOnce(startControlledPlayback(nudge));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    expect(phase()).toBe('nudge');

    await act(async () => {
      wakeTap();
    });
    expect(speech.cancelScope).toHaveBeenCalled();
    nudge.resolve({ requestId: 2, status: 'cancelled' });
    await settle();

    expect(phase()).toBe('success');
    expect(mic.start).toHaveBeenCalledTimes(2);
  });

  it('personalizes the modeled prompt with the configured child name', async () => {
    // Hold the model open on the presenting phase so the personalized prompt
    // stays visible instead of racing into listening.
    const model = deferred<SpeechResult>();
    speech.speakSegments.mockReturnValue(model.promise);
    await renderGame(createCompleteRound(), 'נוֹעָה');

    await act(async () => {
      wakeTap();
    });
    await settle();

    expect(phase()).toBe('presenting');
    expect(container.textContent).toContain('נוֹעָה');
    expect(container.textContent).not.toContain('שון');

    model.resolve({ requestId: 1, status: 'completed' });
    await settle();
  });

  it('completes a round from vocal effort alone and reveals the full word', async () => {
    const onCompleteRound = await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('listening');

    // Sean vocalises: one generous frame above the effort threshold and target.
    expect(mic.onSample).not.toBeNull();
    await act(async () => {
      mic.onSample!(0.6, 900);
    });

    expect(phase()).toBe('success');
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredActions: 1,
        concepts: ['apple'],
      }),
    );

    // The alien snaps the syllable home and shows the whole word.
    expect(container.querySelector('.silly-alien-bubble__word')!.textContent).toBe(
      testRound.fullHe,
    );

    // Celebration surfaces automatically after the spring replay settles.
    expect(container.querySelector('[data-testid="success-overlay"]')).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });
    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  });

  it('automatically starts the next round when the round key advances (no new tap)', async () => {
    const onCompleteRound = await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();
    await act(async () => {
      mic.onSample!(0.6, 900);
    });
    expect(phase()).toBe('success');

    // The overlay's startNextRound bumps the adaptive round key; simulate that
    // and re-render (as `useAdaptiveRound` would). No child interaction here.
    speech.speakSegments.mockClear();
    sound.playPop.mockClear();
    round.roundKey = 'silly-round-2';
    await renderGame(onCompleteRound);
    await settle();

    // Round two performs the gag + model + listening entirely on its own.
    expect(sound.playPop).toHaveBeenCalled();
    expect(speech.speakSegments).toHaveBeenCalled();
    expect(phase()).toBe('listening');
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
  });

  it('falls back to a single-tap grown-up control when the mic is denied at unlock', async () => {
    mic.start.mockResolvedValue({ status: 'permission-denied' });
    const onCompleteRound = await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();

    // Denied permission routes past listening to the parent fallback.
    expect(phase()).toBe('parentFallback');
    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    const fallback = container.querySelector<HTMLButtonElement>('.silly-alien-fallback__button');
    expect(fallback).not.toBeNull();

    // A single tap (never a press-and-hold) advances the round.
    await act(async () => {
      fallback!.click();
    });
    await settle();

    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(phase()).toBe('success');
  });

  it('keeps a transient unlock cancellation retryable', async () => {
    mic.start.mockResolvedValue({ status: 'background' });
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();

    expect(phase()).toBe('locked');
    expect(container.querySelector('.silly-alien-fallback__button')).toBeNull();
  });

  it('routes to the parent fallback when the mic fails as listening begins', async () => {
    // Permission granted on the unlock probe, but the real capture fails.
    mic.start.mockReset();
    mic.start
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValue({ status: 'permission-denied' });
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();

    expect(phase()).toBe('parentFallback');
    expect(container.querySelector('.silly-alien-fallback__button')).not.toBeNull();
  });

  it('retries a transient playback guard without routing to fallback', async () => {
    mic.start.mockReset();
    mic.start
      .mockResolvedValueOnce({ status: 'started' })
      .mockResolvedValueOnce({ status: 'playback-guarded' })
      .mockResolvedValue({ status: 'started' });
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('listening');
    expect(container.querySelector('.silly-alien-fallback__button')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(mic.start).toHaveBeenCalledTimes(3);
    expect(container.querySelector('.silly-alien-fallback__button')).toBeNull();
  });

  it('stops microphone capture while modeling and again when it celebrates', async () => {
    await renderGame();

    await act(async () => {
      wakeTap();
    });
    await settle();
    expect(phase()).toBe('listening');
    // Capture is stopped during the unlock probe and while the model plays.
    expect(mic.stop).toHaveBeenCalled();

    const before = mic.stop.mock.calls.length;
    await act(async () => {
      mic.onSample!(0.6, 900);
    });

    // Reaching success stops capture again so narration never self-triggers.
    expect(mic.stop.mock.calls.length).toBeGreaterThan(before);
  });
});
