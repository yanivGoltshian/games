// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import { NumberPairsGame } from './NumberPairsGame';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  runRetry: vi.fn(),
  speakSegments: vi.fn(),
  speakSuccessSequence: vi.fn(),
  startNextRound: vi.fn(),
}));

vi.mock('../services/sound', () => ({
  getSharedAudioContext: vi.fn(() => null),
  unlockAudioContext: vi.fn(async () => undefined),
  soundService: {
    playCelebrate: vi.fn(),
    playMilestone: vi.fn(),
    playSuccess: vi.fn(),
    playTap: vi.fn(),
    vibrate: vi.fn(),
  },
}));

vi.mock('../services/speech', () => ({
  buildPhraseSegments: (
    hebrew: string,
    english: string,
    languageMode: 'he' | 'en' | 'both',
    englishVoiceLocale: 'en-US' | 'en-GB',
  ) => {
    const hebrewSegment = { text: hebrew, locale: 'he-IL' };
    const englishSegment = { text: english, locale: englishVoiceLocale };
    if (languageMode === 'he') {
      return [hebrewSegment];
    }
    if (languageMode === 'en') {
      return [englishSegment];
    }
    return [hebrewSegment, englishSegment];
  },
  speechService: {
    cancelScope: doubles.cancelScope,
    speakSegments: doubles.speakSegments,
    speakSuccessSequence: doubles.speakSuccessSequence,
  },
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: {
      selectedValues: [1],
      topRow: [1],
      bottomRow: [1],
      promptHe: 'לחץ על הזוגות',
      promptEn: 'Press the pairs',
      signature: '1|1|1',
    },
    roundKey: 'round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('./useRetryFeedback', () => ({
  useRetryFeedback: () => ({
    retryBusy: false,
    runRetry: doubles.runRetry,
  }),
}));

describe('NumberPairsGame speech progression', () => {
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
    doubles.cancelScope.mockReset();
    doubles.runRetry.mockReset();
    doubles.speakSegments.mockReset();
    doubles.speakSuccessSequence.mockReset();
    doubles.startNextRound.mockReset();
    doubles.speakSegments.mockImplementation(() => new Promise(() => undefined));
    doubles.speakSuccessSequence.mockResolvedValue({
      requestId: 100,
      status: 'completed',
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('does not let rapid invalid labels delay progression after the final match', async () => {
    const progress = createInitialProgress(false, 0);
    const settings = createInitialSettings();

    await act(async () => {
      root.render(
        <NumberPairsGame
          domainProgress={progress.domains.numberPairs}
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
          onCompleteRound={() => ({
            starsEarned: 1,
            leveledUp: false,
            milestone: false,
            level: 1,
            mastery: 0.5,
            firstAttempt: true,
            recommendation: null,
          })}
        />,
      );
    });

    const [topTile, bottomTile] = container.querySelectorAll<HTMLButtonElement>(
      '.number-pair-tile',
    );
    expect(topTile).toBeDefined();
    expect(bottomTile).toBeDefined();

    await act(async () => {
      bottomTile!.click();
      bottomTile!.click();
      bottomTile!.click();
    });
    expect(doubles.speakSegments).not.toHaveBeenCalled();

    await act(async () => topTile!.click());
    expect(doubles.speakSegments).toHaveBeenCalledTimes(1);
    expect(doubles.speakSegments).toHaveBeenLastCalledWith(
      expect.any(Array),
      settings,
      expect.objectContaining({ key: 'number-label', staleAfterSuccess: true }),
    );

    await act(async () => bottomTile!.click());
    expect(doubles.speakSuccessSequence).toHaveBeenCalledWith(
      [{ text: 'אחת', locale: 'he-IL' }],
      expect.any(Array),
      settings,
      expect.objectContaining({ scope: 'game:number-pairs' }),
    );

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1_400);
    });
    expect(doubles.startNextRound).toHaveBeenCalledTimes(1);
  });
});
