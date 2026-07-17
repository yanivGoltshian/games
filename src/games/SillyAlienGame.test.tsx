// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { ProgressUpdateSummary, SillyAlienRound } from '../domain/types';
import { SillyAlienGame } from './SillyAlienGame';

const doubles = vi.hoisted(() => ({
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
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
  soundService: {
    playSuccess: vi.fn(),
    playTap: vi.fn(),
  },
}));

vi.mock('../services/speech', () => ({
  buildLocalizedSegments: (lines: unknown[]) => lines,
  buildPersonalizedPhraseSegments: (line: { he: string }, settings: { childName: string }) => [
    { text: line.he.replace('שון', settings.childName), locale: 'he-IL' },
  ],
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
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
    roundKey: 'silly-round-1',
    startNextRound: doubles.startNextRound,
  }),
}));

describe('SillyAlienGame', () => {
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
    childName = 'שון',
  ) {
    const progress = createInitialProgress(false, 0);
    const settings = createInitialSettings();
    settings.childName = childName;
    await act(async () => {
      root.render(
        <SillyAlienGame
          domainProgress={progress.domains.sillyAlien}
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
    return onCompleteRound;
  }

  it('shows the broken word and mic prompt on the intro phase', async () => {
    await renderGame();

    const micButton = container.querySelector('.silly-alien-mic-button');
    expect(micButton).not.toBeNull();
    expect(micButton!.textContent).toContain('לוחצים ומדברים');

    const word = container.querySelector('.silly-alien-bubble__word');
    expect(word!.textContent).toBe(testRound.brokenHe);
  });

  it('uses the configured name in the live prompt without exposing the old name', async () => {
    await renderGame(createCompleteRound(), 'נוֹעָה');

    expect(container.textContent).toContain('נוֹעָה');
    expect(container.textContent).not.toContain('שון');
  });

  it('moves through listening and completes the round when the child affirms', async () => {
    const onCompleteRound = await renderGame();

    // Intro → listening.
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.silly-alien-mic-button')!.click();
    });

    const meter = container.querySelector('.silly-alien-meter');
    expect(meter).not.toBeNull();
    expect(meter!.getAttribute('role')).toBe('progressbar');

    const affirm = container.querySelector<HTMLButtonElement>('.silly-alien-affirm');
    expect(affirm).not.toBeNull();
    expect(affirm!.textContent).toContain('אמרתי!');

    // Listening → success (mic effort simulated by the "I said it!" tap).
    await act(async () => {
      affirm!.click();
    });

    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledWith(
      expect.objectContaining({
        requiredActions: 1,
        concepts: ['apple'],
      }),
    );

    // The alien reveals the full word during the spring replay.
    const revealedWord = container.querySelector('.silly-alien-bubble__word');
    expect(revealedWord!.textContent).toBe(testRound.fullHe);
  });

  it('reveals the celebration overlay after the spring animation settles', async () => {
    await renderGame();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.silly-alien-mic-button')!.click();
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('.silly-alien-affirm')!.click();
    });

    expect(container.querySelector('[data-testid="success-overlay"]')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_600);
    });

    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  });
});
