// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { CelebrationInfo, ToddlerGameProps } from './types';
import type { SpeechResult } from '../services/speech';
import type * as SpeechModule from '../services/speech';
import type * as AdaptiveRoundModule from './useAdaptiveRound';
import {
  MEMORY_MISMATCH_HOLD_MS,
  MEMORY_REVEAL_FALLBACK_MS,
} from './memoryCelebration';
import { MemoryGame } from './MemoryGame';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  playMemoryPair: vi.fn(),
  playTap: vi.fn(),
  speakRetrySequence: vi.fn(),
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
  useActualRound: false,
  roundOverride: null as null | { cards: { id: string; pairId: string; conceptId: string }[]; pairConceptIds: string[]; promptHe: string; promptEn: string },
  lastCelebration: null as CelebrationInfo | null,
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ conceptId }: { conceptId: string }) => <span>{conceptId}</span>,
}));

vi.mock('../services/sound', () => ({
  getSharedAudioContext: vi.fn(() => null),
  unlockAudioContext: vi.fn(async () => undefined),
  soundService: {
    playRetry: vi.fn(),
    playMemoryPair: doubles.playMemoryPair,
    playTap: doubles.playTap,
  },
}));

vi.mock('../services/speech', async (importOriginal) => ({
  ...await importOriginal<typeof SpeechModule>(),
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
  speechService: {
    cancelScope: doubles.cancelScope,
    speakRetrySequence: doubles.speakRetrySequence,
    speakSegments: doubles.speakSegments,
  },
}));

vi.mock('./useAdaptiveRound', async (importOriginal) => {
  const { useAdaptiveRound } = await importOriginal<typeof AdaptiveRoundModule>();
  return {
    useAdaptiveRound: (...args: Parameters<typeof useAdaptiveRound>) => {
      const actual = useAdaptiveRound(...args);
      return doubles.useActualRound ? actual : {
        round: doubles.roundOverride ?? {
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
      };
    },
  };
});

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: ({ celebration, startNextRound }: { celebration: CelebrationInfo; startNextRound: () => void }) => {
    doubles.lastCelebration = celebration;
    return (
      <button
        onClick={() => startNextRound()}
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
    doubles.speakRetrySequence.mockReset();
    doubles.speakSegments.mockReset();
    doubles.startNextRound.mockReset();
    doubles.lastCelebration = null;
    doubles.useActualRound = false;
    doubles.roundOverride = null;
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

  async function renderGame(onCompleteRound = vi.fn(completeSummary), experienced = false): Promise<void> {
    const progress = createInitialProgress(false, 1);
    if (experienced) Object.assign(progress.domains.memory, { level: 7, highestLevel: 7, completedRounds: 40 });
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

  it.each(['fresh', 'returning'])('starts a %s visit at four cards and adds one pair after an imperfect win', async (profile) => {
    vi.useFakeTimers();
    doubles.useActualRound = true;
    const complete = vi.fn(completeSummary);
    await renderGame(complete, profile === 'returning');
    const cards = [...container.querySelectorAll<HTMLButtonElement>('.memory-card')];
    expect(cards).toHaveLength(4);
    const art = (card: HTMLButtonElement) => card.querySelector('.memory-face--front')!.innerHTML;
    const same = cards.filter((card) => art(card) === art(cards[0]!));
    const other = cards.filter((card) => art(card) !== art(cards[0]!));
    for (const card of [same[0]!, other[0]!]) await act(async () => card.click());
    await act(async () => { await vi.advanceTimersByTimeAsync(MEMORY_MISMATCH_HOLD_MS); });
    for (const card of [...same, ...other]) await act(async () => card.click());
    expect(complete).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ attempts: 3, requiredActions: 2 }));
    await act(async () => { await vi.advanceTimersByTimeAsync(MEMORY_REVEAL_FALLBACK_MS); });
    await act(async () => container.querySelector<HTMLButtonElement>('[data-testid="memory-success"]')!.click());
    expect(container.querySelectorAll('.memory-card')).toHaveLength(6);
  });

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

  it('accepts the next card during either label and never chimes for a superseded pair', async () => {
    vi.useFakeTimers();
    const first = deferredSpeech();
    const pair = deferredSpeech();
    doubles.speakSegments.mockReturnValueOnce(first.promise).mockReturnValueOnce(pair.promise);
    const complete = vi.fn(completeSummary);
    await renderGame(complete);
    const cards = container.querySelectorAll<HTMLButtonElement>('.memory-card');
    for (const index of [0, 1, 2, 2, 3, 3]) {
      await act(async () => cards[index]!.click());
    }
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      attempts: 2, requiredActions: 2, concepts: ['emotion-happy', 'tree'],
    });
    await act(async () => {
      pair.resolve({ requestId: 2, status: 'completed' });
      first.resolve({ requestId: 1, status: 'completed' });
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(doubles.playMemoryPair).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
  });

  it('keeps a miss visible for the mechanic hold only, then accepts a card during stuck retry speech', async () => {
    vi.useFakeTimers();
    const retry = deferredSpeech();
    doubles.speakRetrySequence.mockReturnValue(retry.promise);
    await renderGame();
    const cards = container.querySelectorAll<HTMLButtonElement>('.memory-card');
    await act(async () => cards[0]!.click());
    await act(async () => cards[2]!.click());
    expect(doubles.speakRetrySequence).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(MEMORY_MISMATCH_HOLD_MS - 1); });
    expect(container.querySelectorAll('.memory-card--flipped')).toHaveLength(2);
    expect(cards[1]!.disabled).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    await act(async () => cards[1]!.click());
    expect(cards[1]!.getAttribute('aria-pressed')).toBe('true');
    await act(async () => retry.resolve({ requestId: 3, status: 'completed' }));
    expect(container.querySelectorAll('.memory-card--flipped')).toHaveLength(1);
    expect(cards[1]!.getAttribute('aria-pressed')).toBe('true');
  });

  it.each([
    ['banana', 'בננה'],
    ['persimmon', 'אפרסמון'],
    ['dates', 'תמרים'],
    ['watering-can', 'משפך'],
  ])('shows both %s cards with their existing art and speaks %s', async (id, label) => {
    doubles.roundOverride = {
      cards: [
        { id: `${id}-a`, pairId: id, conceptId: id },
        { id: `${id}-b`, pairId: id, conceptId: id },
      ],
      pairConceptIds: [id],
      promptHe: 'פותחים שני קלפים ומחפשים זוג',
      promptEn: 'Open two cards and find a pair',
    };
    await renderGame();
    const cards = container.querySelectorAll<HTMLButtonElement>('.memory-card');
    const images = container.querySelectorAll(`img[data-memory-art="${id}"]`);
    expect(images).toHaveLength(2);
    expect([...images].map((image) => image.getAttribute('src'))).toEqual(Array(2).fill(`/assets/garden/${id}.webp`));
    await act(async () => cards[0]!.click());
    expect(doubles.speakSegments.mock.calls.at(-1)?.[0]).toEqual([{ text: label, locale: 'he-IL' }]);
  });

  it('shows contact without flipping and clears a cancelled touch without scoring', async () => {
    const complete = vi.fn(completeSummary);
    await renderGame(complete);
    const card = container.querySelector<HTMLButtonElement>('.memory-card')!;
    const touch = (type: string, id: number) => new PointerEvent(type, {
      bubbles: true, pointerType: 'touch', pointerId: id, isPrimary: true, button: 0,
    });
    await act(async () => { card.dispatchEvent(touch('pointerdown', 7)); });
    expect(card.hasAttribute('data-card-press')).toBe(true);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    await act(async () => { card.dispatchEvent(touch('pointerup', 8)); });
    expect(card.hasAttribute('data-card-press')).toBe(true);
    await act(async () => { card.dispatchEvent(touch('pointercancel', 7)); });
    expect(card.hasAttribute('data-card-press')).toBe(false);
    expect(card.getAttribute('aria-pressed')).toBe('false');
    expect(complete).not.toHaveBeenCalled();
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
