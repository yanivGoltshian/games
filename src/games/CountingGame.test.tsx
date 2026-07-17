// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { CountingRound, ProgressUpdateSummary } from '../domain/types';
import { CountingGame } from './CountingGame';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
  runRetry: vi.fn(),
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

vi.mock('../services/sound', () => ({
  soundService: {
    playTap: vi.fn(),
    playRetry: vi.fn(),
    playSuccess: vi.fn(),
  },
}));

vi.mock('../services/speech', () => ({
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

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: () => <div data-testid="success-overlay" />,
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: testRound,
    roundKey: 'counting-round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('./useRetryFeedback', () => ({
  useRetryFeedback: () => ({
    retryBusy: false,
    runRetry: doubles.runRetry,
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
    micDouble.start.mockResolvedValue(true);
    micDouble.stop.mockReset();
    doubles.speakSegments.mockReset();
    doubles.cancelScope.mockReset();
    doubles.startNextRound.mockReset();
    doubles.runRetry.mockReset();
    doubles.runRetry.mockResolvedValue(undefined);
    doubles.speakSegments.mockResolvedValue({ requestId: 1, status: 'completed' });
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

  async function renderGame(onCompleteRound = createCompleteRound()) {
    const progress = createInitialProgress(false, 0);
    const settings = createInitialSettings();
    await act(async () => {
      root.render(
        <CountingGame
          domainProgress={progress.domains.counting}
          settings={settings}
          overallStars={0}
          mediaReady={false}
          speechStatus={{
            supported: true,
            voiceAvailable: true,
            speaking: false,
            activeRequestId: null,
            activeCue: null,
          }}
          onBack={() => undefined}
          onCompleteRound={onCompleteRound}
        />,
      );
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
    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  });
});
