// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { ProgressUpdateSummary } from '../domain/types';
import type { SpeechStatus } from '../services/speech';
import { WordStretchGame } from './WordStretchGame';

const doubles = vi.hoisted(() => ({
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
}));

vi.mock('../services/sound', () => ({
  soundService: {
    playTap: vi.fn(),
  },
}));

vi.mock('../services/speech', () => ({
  speechService: {
    speakSegments: doubles.speakSegments,
  },
}));

vi.mock('../art/objects', () => ({
  ConceptArt: ({ label, className }: { label: string; className: string }) => (
    <span className={className} data-testid="concept-art">{label}</span>
  ),
}));

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: () => <div data-testid="success-overlay" />,
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: { conceptId: 'dog', signature: 'dog' },
    roundKey: 1,
    startNextRound: doubles.startNextRound,
  }),
}));

describe('WordStretchGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let resolveSpeech: ((value: { requestId: number; status: 'completed' }) => void) | null;
  const completeRound = vi.fn((): ProgressUpdateSummary => ({
    starsEarned: 1,
    leveledUp: false,
    milestone: false,
    level: 1,
    mastery: 0.5,
    firstAttempt: true,
    recommendation: null,
  }));
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
    completeRound.mockClear();
    resolveSpeech = null;
    doubles.speakSegments.mockImplementation(() => new Promise((resolve) => {
      resolveSpeech = resolve;
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  function renderGame(
    speechStatus: SpeechStatus,
    quietMode = false,
  ): Promise<void> {
    const progress = createInitialProgress(false, 0);
    const settings = { ...createInitialSettings(), quietMode };
    return act(async () => {
      root.render(
        <WordStretchGame
          domainProgress={progress.domains.wordStretch}
          settings={settings}
          overallStars={0}
          mediaReady
          speechStatus={speechStatus}
          onBack={() => undefined}
          onCompleteRound={completeRound}
        />,
      );
    });
  }

  const idleStatus: SpeechStatus = {
    supported: true,
    voiceAvailable: true,
    speaking: false,
    activeRequestId: null,
    activeCue: null,
  };

  it('holds the stretch from the live cue until the full speech request completes', async () => {
    await renderGame(idleStatus);
    const button = container.querySelector<HTMLButtonElement>('.word-stretch-button')!;

    await act(async () => button.click());
    expect(doubles.speakSegments).toHaveBeenCalledOnce();
    expect(doubles.speakSegments.mock.calls[0]?.[0]).toEqual([
      expect.objectContaining({
        text: 'כֶּאאאאא־לֶב',
        recordedText: 'כלב',
        cue: 'word-stretch:dog',
      }),
    ]);
    expect(button.classList.contains('is-stretching')).toBe(false);

    await renderGame({
      ...idleStatus,
      speaking: true,
      activeRequestId: 1,
      activeCue: 'word-stretch:dog',
    });
    expect(button.classList.contains('is-stretching')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('true');

    await renderGame(idleStatus);
    expect(button.classList.contains('is-stretching')).toBe(true);

    await act(async () => {
      resolveSpeech?.({ requestId: 1, status: 'completed' });
      await Promise.resolve();
    });
    expect(button.classList.contains('is-stretching')).toBe(false);
    expect(completeRound).toHaveBeenCalledWith({
      attempts: 1,
      requiredActions: 1,
      concepts: ['dog'],
    });
    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  });

  it('coalesces rapid taps into one pronunciation', async () => {
    await renderGame(idleStatus);
    const button = container.querySelector<HTMLButtonElement>('.word-stretch-button')!;

    await act(async () => {
      button.click();
      button.click();
    });

    expect(doubles.speakSegments).toHaveBeenCalledOnce();
  });

  it('keeps the game playable in quiet mode with a bounded visual stretch', async () => {
    await renderGame(idleStatus, true);
    const button = container.querySelector<HTMLButtonElement>('.word-stretch-button')!;

    await act(async () => button.click());
    expect(doubles.speakSegments).not.toHaveBeenCalled();
    expect(button.classList.contains('is-stretching')).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_050);
    });
    expect(button.classList.contains('is-stretching')).toBe(false);
    expect(completeRound).toHaveBeenCalledOnce();
  });
});
