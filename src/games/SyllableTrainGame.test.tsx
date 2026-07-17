// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { ProgressUpdateSummary, SyllableTrainRound } from '../domain/types';
import { SyllableTrainGame } from './SyllableTrainGame';

const doubles = vi.hoisted(() => ({
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
  buildPhraseSegments: vi.fn((...args: string[]) => [{ text: args[0], locale: 'he-IL' }]),
  playSuccess: vi.fn(),
  playTap: vi.fn(),
}));

const testRound: SyllableTrainRound = {
  conceptId: 'ball',
  plainHe: 'כדור',
  fullHe: 'כַּדּוּר',
  fullEn: 'ball',
  firstHe: 'כַּ',
  restHe: 'דּוּר',
  firstEn: 'b',
  restEn: 'all',
  promptHe: 'חברו את הקרונות',
  promptEn: 'Couple the train cars',
  signature: 'ball',
};

/** Every pointed syllable that must never be routed through the speech service. */
const ISOLATED_SYLLABLES = [
  testRound.firstHe,
  testRound.restHe,
  testRound.fullHe,
  testRound.firstEn,
  testRound.restEn,
];

vi.mock('../services/sound', () => ({
  soundService: {
    playSuccess: doubles.playSuccess,
    playTap: doubles.playTap,
  },
}));

vi.mock('../services/speech', () => ({
  buildPhraseSegments: doubles.buildPhraseSegments,
  speechService: {
    speakSegments: doubles.speakSegments,
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
    roundKey: 'syllable-train-round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

describe('SyllableTrainGame', () => {
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
    doubles.speakSegments.mockReset();
    doubles.startNextRound.mockReset();
    doubles.buildPhraseSegments.mockClear();
    doubles.playSuccess.mockReset();
    doubles.playTap.mockReset();
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

  async function renderGame(
    onCompleteRound = createCompleteRound(),
    { mediaReady = false }: { mediaReady?: boolean } = {},
  ) {
    const progress = createInitialProgress(false, 0);
    const settings = createInitialSettings();
    await act(async () => {
      root.render(
        <SyllableTrainGame
          domainProgress={progress.domains.syllableTrain}
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
        />,
      );
    });
    return onCompleteRound;
  }

  it('shows the engine syllable and a loose coupling car on the intro phase', async () => {
    await renderGame();

    const engineLabel = container.querySelector(
      '.syllable-train-car--engine .syllable-train-car__label',
    );
    expect(engineLabel!.textContent).toBe(testRound.firstHe);

    const loose = container.querySelector<HTMLButtonElement>('.syllable-train-car--loose');
    expect(loose).not.toBeNull();
    expect(loose!.tagName).toBe('BUTTON');
    expect(
      loose!.querySelector('.syllable-train-car__label')!.textContent,
    ).toBe(testRound.restHe);

    const whole = container.querySelector('.syllable-train-whole');
    expect(whole!.classList.contains('is-visible')).toBe(false);

    // The intro must not speak anything: the first-car emphasis is visual + tone.
    expect(doubles.buildPhraseSegments).not.toHaveBeenCalled();
    expect(doubles.speakSegments).not.toHaveBeenCalled();
  });

  it('cues the first syllable with a non-speech tone rather than isolated audio', async () => {
    await renderGame(createCompleteRound(), { mediaReady: true });

    expect(doubles.playTap).toHaveBeenCalled();
    expect(doubles.buildPhraseSegments).not.toHaveBeenCalled();
    expect(doubles.speakSegments).not.toHaveBeenCalled();
  });

  it('couples on tap, reveals the whole word, and completes the round exactly once', async () => {
    const onCompleteRound = await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--loose')!.click();
    });

    const joined = container.querySelector('.syllable-train-car--joined');
    expect(joined).not.toBeNull();
    expect(joined!.querySelector('.syllable-train-car__label')!.textContent).toBe(
      testRound.restHe,
    );

    const whole = container.querySelector('.syllable-train-whole');
    expect(whole!.classList.contains('is-visible')).toBe(true);
    expect(whole!.textContent).toBe(testRound.fullHe);

    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredActions: 1,
        concepts: ['ball'],
      }),
    );
  });

  it('narrates only the whole word and marks the reveal stale after success', async () => {
    await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--loose')!.click();
    });

    // Every phrase built for speech is the whole word, never an isolated syllable.
    expect(doubles.buildPhraseSegments).toHaveBeenCalled();
    for (const call of doubles.buildPhraseSegments.mock.calls) {
      expect(call[0]).toBe(testRound.plainHe);
      expect(call[1]).toBe(testRound.fullEn);
      expect(ISOLATED_SYLLABLES).not.toContain(call[0]);
    }

    // The success reveal is queued as stale-after-success so a fast next round
    // supersedes it cleanly instead of blocking automatic progression.
    const revealCall = doubles.speakSegments.mock.calls.find(
      ([, , options]) => options?.staleAfterSuccess === true,
    );
    expect(revealCall).toBeDefined();
  });

  it('reveals the celebration overlay after the drive-off timer settles', async () => {
    await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.syllable-train-car--loose')!.click();
    });

    expect(container.querySelector('[data-testid="success-overlay"]')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });

    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  });
});
