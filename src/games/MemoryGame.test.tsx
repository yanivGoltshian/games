// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import type { SpeechResult } from '../services/speech';
import {
  MEMORY_PAIR_SOUND_HOLD_MS,
  MEMORY_REVEAL_FALLBACK_MS,
} from './memoryCelebration';
import { MemoryGame } from './MemoryGame';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  playMemoryPair: vi.fn(),
  playTap: vi.fn(),
  runRetry: vi.fn(),
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
  lastCelebration: null as CelebrationInfo | null,
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ conceptId }: { conceptId: string }) => <span>{conceptId}</span>,
}));

vi.mock('../services/sound', () => ({
  getSharedAudioContext: vi.fn(() => null),
  unlockAudioContext: vi.fn(async () => undefined),
  soundService: {
    playMemoryPair: doubles.playMemoryPair,
    playTap: doubles.playTap,
  },
}));

vi.mock('../services/speech', () => ({
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
  speechService: {
    cancelScope: doubles.cancelScope,
    speakSegments: doubles.speakSegments,
  },
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: {
      cards: [
        { id: 'happy-a', pairId: 'emotion-happy', conceptId: 'emotion-happy' },
        { id: 'happy-b', pairId: 'emotion-happy', conceptId: 'emotion-happy' },
        { id: 'tree-a', pairId: 'tree', conceptId: 'tree' },
        { id: 'tree-b', pairId: 'tree', conceptId: 'tree' },
      ],
      pairConceptIds: ['emotion-happy', 'tree'],
      promptHe: 'מוצאים זוגות',
      promptEn: 'Find the pairs',
    },
    roundKey: 'memory-round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('./useRetryFeedback', () => ({
  useRetryFeedback: () => ({
    retryBusy: false,
    runRetry: doubles.runRetry,
  }),
}));

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: ({ celebration }: { celebration: CelebrationInfo }) => {
    doubles.lastCelebration = celebration;
    return (
      <div
        data-testid="memory-success"
        data-variant={celebration.celebrationVariant}
        data-sound={celebration.soundVariant}
        data-sound-timing={celebration.soundTiming}
      />
    );
  },
}));

function completeSummary(): ReturnType<ToddlerGameProps['onCompleteRound']> {
  return {
    starsEarned: 1,
    leveledUp: false,
    milestone: false,
    level: 1,
    mastery: 0.5,
    firstAttempt: true,
    recommendation: null,
  };
}

function deferredSpeech() {
  let resolve!: (result: SpeechResult) => void;
  const promise = new Promise<SpeechResult>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('MemoryGame celebrations', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  beforeEach(() => {
    doubles.cancelScope.mockReset();
    doubles.playMemoryPair.mockReset();
    doubles.playTap.mockReset();
    doubles.runRetry.mockReset();
    doubles.speakSegments.mockReset();
    doubles.startNextRound.mockReset();
    doubles.lastCelebration = null;
    doubles.speakSegments.mockResolvedValue({ requestId: 1, status: 'completed' });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    container.remove();
    vi.useRealTimers();
  });

  async function renderGame(onCompleteRound = vi.fn(completeSummary)): Promise<void> {
    const progress = createInitialProgress(false, 1);
    await act(async () => {
      root!.render(
        <MemoryGame
          domainProgress={progress.domains.memory}
          settings={progress.settings}
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
  }

  it('reinforces each non-final pair once and waits for the final-card reveal', async () => {
    vi.useFakeTimers();
    const onCompleteRound = vi.fn(completeSummary);
    await renderGame(onCompleteRound);
    const cards = container.querySelectorAll<HTMLButtonElement>('.memory-card');
    expect(container.querySelectorAll('.memory-face--front[aria-hidden="true"]')).toHaveLength(4);

    await act(async () => cards[0]!.click());
    expect(cards[0]!.querySelector('.memory-face--front')?.hasAttribute('aria-hidden')).toBe(false);
    await act(async () => cards[1]!.click());

    expect(doubles.playMemoryPair).toHaveBeenCalledTimes(1);
    expect(container.querySelectorAll('.memory-card--celebrated')).toHaveLength(2);
    expect(container.querySelectorAll('.memory-card__sparkles i')).toHaveLength(10);
    await act(async () => cards[0]!.click());
    expect(doubles.playMemoryPair).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(MEMORY_PAIR_SOUND_HOLD_MS);
    });

    await act(async () => cards[2]!.click());
    await act(async () => cards[3]!.click());
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="memory-success"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(MEMORY_REVEAL_FALLBACK_MS - 1);
    });
    expect(container.querySelector('[data-testid="memory-success"]')).toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(container.querySelector('[data-testid="memory-success"]')).not.toBeNull();
    expect(doubles.lastCelebration).toMatchObject({
      celebrationVariant: 'memory-fireworks',
      soundVariant: 'memory',
      soundTiming: 'after-speech',
      targetSegments: [],
    });
    expect(doubles.lastCelebration?.beforeSpeech).toBeInstanceOf(Promise);
    expect(doubles.playMemoryPair).toHaveBeenCalledTimes(1);
  });

  it('does not play delayed pair feedback after the game exits', async () => {
    const firstLabel = deferredSpeech();
    const secondLabel = deferredSpeech();
    doubles.speakSegments
      .mockReturnValueOnce(firstLabel.promise)
      .mockReturnValueOnce(secondLabel.promise);
    await renderGame();
    const cards = container.querySelectorAll<HTMLButtonElement>('.memory-card');

    await act(async () => cards[0]!.click());
    await act(async () => cards[1]!.click());
    expect(doubles.playMemoryPair).not.toHaveBeenCalled();

    await act(async () => root!.unmount());
    root = null;
    secondLabel.resolve({ requestId: 2, status: 'completed' });
    await Promise.resolve();

    expect(doubles.playMemoryPair).not.toHaveBeenCalled();
  });
});
