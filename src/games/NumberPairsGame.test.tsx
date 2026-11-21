// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyRoundResult, createInitialProgress, createInitialSettings } from '../domain/progression';
import { NumberPairsGame } from './NumberPairsGame';
import type * as AdaptiveRoundModule from './useAdaptiveRound';
import type * as SpeechModule from '../services/speech';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  speakRetrySequence: vi.fn(),
  speakSegments: vi.fn(),
  speakSuccessSequence: vi.fn(),
  startNextRound: vi.fn(),
  useActualRound: false,
}));

vi.mock('../services/sound', () => ({
  getSharedAudioContext: vi.fn(() => null),
  unlockAudioContext: vi.fn(async () => undefined),
  soundService: {
    playCelebrate: vi.fn(),
    playMilestone: vi.fn(),
    playSuccess: vi.fn(),
    playRetry: vi.fn(),
    playTap: vi.fn(),
    vibrate: vi.fn(),
  },
}));

vi.mock('../services/speech', async (importOriginal) => ({
  ...await importOriginal<typeof SpeechModule>(),
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
  buildPersonalizedPhraseSegments: (
    line: { he: string; en: string },
    settings: {
      childName: string;
      languageMode: 'he' | 'en' | 'bilingual';
      englishVoiceLocale: 'en-US' | 'en-GB';
    },
  ) => {
    const hebrew = line.he.replace('שון', settings.childName);
    const english = line.en.replace('Sean', settings.childName);
    if (settings.languageMode === 'he') {
      return [{ text: hebrew, locale: 'he-IL' }];
    }
    if (settings.languageMode === 'en') {
      return [{ text: english, locale: settings.englishVoiceLocale }];
    }
    return [
      { text: hebrew, locale: 'he-IL' },
      { text: english, locale: settings.englishVoiceLocale },
    ];
  },
  speechService: {
    cancelScope: doubles.cancelScope,
    speakRetrySequence: doubles.speakRetrySequence,
    speakSegments: doubles.speakSegments,
    speakSuccessSequence: doubles.speakSuccessSequence,
  },
}));

vi.mock('./useAdaptiveRound', async (importOriginal) => {
  const { useAdaptiveRound } = await importOriginal<typeof AdaptiveRoundModule>();
  return {
    useAdaptiveRound: (...args: Parameters<typeof useAdaptiveRound>) => {
      const actual = useAdaptiveRound(...args);
      return doubles.useActualRound ? actual : {
        round: {
          selectedValues: [1],
          topRow: [1],
          bottomRow: [1],
          promptHe: 'לחץ על הזוגות',
          promptEn: 'Press the pairs',
          signature: '1|1|1',
        },
        roundKey: 0,
        startNextRound: doubles.startNextRound,
      };
    },
  };
});

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
    doubles.speakRetrySequence.mockReset();
    doubles.speakSegments.mockReset();
    doubles.speakSuccessSequence.mockReset();
    doubles.startNextRound.mockReset();
    doubles.useActualRound = false;
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

  it.each(['fresh', 'returning'])('starts a %s visit with 1 and 2, then adds a pair only on a full win', async (profile) => {
    doubles.useActualRound = true;
    let finishOldRetry!: () => void;
    doubles.speakRetrySequence.mockReturnValue(new Promise<void>((resolve) => { finishOldRetry = resolve; }));
    const record = vi.fn(applyRoundResult);
    function GameHarness() {
      const [progress, setProgress] = useState(() => {
        const saved = createInitialProgress(true, 0);
        if (profile === 'returning') Object.assign(saved.domains.numberPairs, { level: 8, highestLevel: 8, completedRounds: 40 });
        return saved;
      });
      return (
        <NumberPairsGame
          domainProgress={progress.domains.numberPairs}
          settings={progress.settings}
          overallStars={progress.totalStars}
          mediaReady={false}
          speechStatus={{ supported: true, voiceAvailable: true, speaking: false, activeRequestId: null, activeCue: null }}
          onBack={() => undefined}
          onCompleteRound={(round) => {
            const result = record(progress, 'numberPairs', round);
            setProgress(result.progress);
            return result.summary;
          }}
        />
      );
    }

    await act(async () => root.render(<GameHarness />));
    const top = () => [...container.querySelectorAll<HTMLButtonElement>('.number-pairs-row--top button')];
    const bottom = () => [...container.querySelectorAll<HTMLButtonElement>('.number-pairs-row--bottom button')];
    const click = async (button: HTMLButtonElement) => { await act(async () => { button.click(); }); };
    const restart = container.querySelector<HTMLButtonElement>('.rail-button--restart')!;
    expect(top().map((tile) => tile.textContent).sort()).toEqual(['1', '2']);
    expect(bottom().map((tile) => tile.textContent).sort()).toEqual(['1', '2']);
    await click(top()[0]!);
    await click(restart);
    expect(top()).toHaveLength(2);
    expect(top().every((tile) => tile.getAttribute('aria-pressed') === 'false')).toBe(true);

    await click(top()[0]!);
    await click(bottom().find((tile) => tile.textContent !== top()[0]!.textContent)!);
    expect(doubles.speakRetrySequence).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();

    for (const [index, topTile] of top().entries()) {
      await click(topTile);
      await click(bottom().find((tile) => tile.textContent === topTile.textContent)!);
      expect(record).toHaveBeenCalledTimes(index === 1 ? 1 : 0);
    }
    expect(record).toHaveBeenCalledWith(expect.anything(), 'numberPairs', expect.objectContaining({ attempts: 3, requiredActions: 2 }));
    expect(container.querySelector('.success-overlay')).not.toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1_800); });
    expect(top()).toHaveLength(3);
    await click(bottom()[0]!);
    await act(async () => finishOldRetry());
    expect(bottom()[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(record).toHaveBeenCalledTimes(1);
    expect(bottom()).toHaveLength(3);
    expect(new Set(top().map((tile) => tile.textContent)).size).toBe(3);
  });
});
