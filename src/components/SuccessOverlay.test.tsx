// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LEVEL_UP_SPEECH, MORE_NUMBERS_SPEECH } from '../content/levelUpSpeech';
import type { SpeechResult } from '../services/speech';
import { SuccessOverlay } from './SuccessOverlay';
import { scheduleSuccessAdvance } from './successTiming';

const doubles = vi.hoisted(() => ({
  cancelScope: vi.fn(),
  playCelebrate: vi.fn(),
  playMemoryComplete: vi.fn(),
  playMilestone: vi.fn(),
  speakSuccessSequence: vi.fn(),
  vibrate: vi.fn(),
}));

vi.mock('../services/sound', () => ({
  soundService: {
    playCelebrate: doubles.playCelebrate,
    playMemoryComplete: doubles.playMemoryComplete,
    playMilestone: doubles.playMilestone,
    vibrate: doubles.vibrate,
  },
}));

vi.mock('../services/speech', () => ({
  buildPersonalizedPhraseSegments: (
    line: { he: string },
  ) => [{ text: line.he, locale: 'he-IL' }],
  speechService: {
    cancelScope: doubles.cancelScope,
    speakSuccessSequence: doubles.speakSuccessSequence,
  },
}));

const settings = {
  childName: 'שון',
  languageMode: 'he' as const,
  englishVoiceLocale: 'en-US' as const,
  soundLevel: 0.7,
  reducedMotion: false,
  quietMode: false,
};

describe('automatic success transition', () => {
  it('makes the whole automatic celebration a single native continue target', () => {
    const markup = renderToStaticMarkup(
      <SuccessOverlay
        settings={settings}
        scope="game:number-pairs"
        seed="level-up"
        targetSegments={[{ text: 'שלוש', locale: 'he-IL' }]}
        tier="milestone"
        recommendation={{ currentLevel: 1, nextLevel: 2 }}
        followUpSegments={[{ text: MORE_NUMBERS_SPEECH.he, locale: 'he-IL' }]}
        onAdvance={() => undefined}
      />,
    );

    expect(markup).toContain('עברת שלב!');
    expect(markup).toContain('class="success-overlay__continue"');
    expect(markup).toContain('aria-label="המשך"');
    expect(markup).toContain('role="status"');
    expect(markup.match(/<button/g)).toHaveLength(1);
    expect(markup).not.toContain('מוכנים לשלב הבא');
  });

  it('keeps the spoken level-up sequence in the required order', () => {
    expect(LEVEL_UP_SPEECH.map((line) => line.he)).toEqual([
      'עברת שלב!',
      'כל הכבוד, שון!',
      'זכית בגביע!',
    ]);
  });

  it('cleans up the liveness timer before it can advance', () => {
    let callback: (() => void) | null = null;
    let advanced = false;
    const cancel = scheduleSuccessAdvance(
      15_000,
      () => {
        advanced = true;
      },
      {
        setTimeout: (next, delay) => {
          expect(delay).toBe(15_000);
          callback = next;
          return 7;
        },
        clearTimeout: (handle) => {
          expect(handle).toBe(7);
          callback = null;
        },
      },
    );

    cancel();

    expect(callback).toBeNull();
    expect(advanced).toBe(false);
  });

  it('waits for narration before playing the memory-board fanfare', async () => {
    const reactActEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let finishNarration!: () => void;
    doubles.playMemoryComplete.mockReset();
    doubles.speakSuccessSequence.mockReset();
    doubles.speakSuccessSequence.mockReturnValue(new Promise<void>((resolve) => {
      finishNarration = resolve;
    }));
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SuccessOverlay
          settings={settings}
          scope="game:memory"
          seed="memory-finale"
          targetSegments={[]}
          tier="standard"
          recommendation={null}
          celebrationVariant="memory-fireworks"
          soundVariant="memory"
          soundTiming="after-speech"
          onAdvance={() => undefined}
        />,
      );
    });

    expect(doubles.speakSuccessSequence).toHaveBeenCalledTimes(1);
    expect(doubles.playMemoryComplete).not.toHaveBeenCalled();

    await act(async () => {
      finishNarration();
      await Promise.resolve();
    });
    expect(doubles.playMemoryComplete).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  });

  it('keeps the memory celebration visible for a full hold after delayed fanfare starts', async () => {
    vi.useFakeTimers();
    const reactActEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let finishNarration!: () => void;
    const onAdvance = vi.fn();
    doubles.speakSuccessSequence.mockReset();
    doubles.speakSuccessSequence.mockReturnValue(new Promise<void>((resolve) => {
      finishNarration = resolve;
    }));
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SuccessOverlay
          settings={settings}
          scope="game:memory"
          seed="memory-delayed-fanfare"
          targetSegments={[]}
          tier="standard"
          recommendation={null}
          celebrationVariant="memory-fireworks"
          soundVariant="memory"
          soundTiming="after-speech"
          onAdvance={onAdvance}
        />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      finishNarration();
      await Promise.resolve();
    });
    expect(onAdvance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_399);
    });
    expect(onAdvance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
  });

  it('turns a delayed-sound liveness timeout into a full final celebration hold', async () => {
    vi.useFakeTimers();
    const reactActEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    const onAdvance = vi.fn();
    doubles.cancelScope.mockReset();
    doubles.playMemoryComplete.mockReset();
    doubles.speakSuccessSequence.mockReset();
    doubles.speakSuccessSequence.mockReturnValue(new Promise<void>(() => undefined));
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SuccessOverlay
          settings={settings}
          scope="game:memory"
          seed="memory-liveness-fanfare"
          targetSegments={[]}
          tier="standard"
          recommendation={null}
          celebrationVariant="memory-fireworks"
          soundVariant="memory"
          soundTiming="after-speech"
          onAdvance={onAdvance}
        />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
    });
    expect(doubles.cancelScope).toHaveBeenCalledWith('game:memory', 'navigation');
    expect(doubles.playMemoryComplete).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_399);
    });
    expect(onAdvance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
  });

  it('does not start success narration when the liveness timeout cancels final-card speech', async () => {
    vi.useFakeTimers();
    const reactActEnvironment = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    let finishFinalCardSpeech!: () => void;
    const beforeSpeech = new Promise<SpeechResult>((resolve) => {
      finishFinalCardSpeech = () => resolve({ requestId: 42, status: 'cancelled' });
    });
    const onAdvance = vi.fn();
    doubles.cancelScope.mockReset();
    doubles.playMemoryComplete.mockReset();
    doubles.speakSuccessSequence.mockReset();
    doubles.cancelScope.mockImplementation(() => finishFinalCardSpeech());
    doubles.speakSuccessSequence.mockResolvedValue(undefined);
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <SuccessOverlay
          settings={settings}
          scope="game:memory"
          seed="memory-final-card-timeout"
          targetSegments={[]}
          beforeSpeech={beforeSpeech}
          tier="standard"
          recommendation={null}
          celebrationVariant="memory-fireworks"
          soundVariant="memory"
          soundTiming="after-speech"
          onAdvance={onAdvance}
        />,
      );
    });

    await act(async () => {
      vi.advanceTimersByTime(15_000);
      await Promise.resolve();
    });
    expect(doubles.cancelScope).toHaveBeenCalledWith('game:memory', 'navigation');
    expect(doubles.speakSuccessSequence).not.toHaveBeenCalled();
    expect(doubles.playMemoryComplete).toHaveBeenCalledTimes(1);
    expect(onAdvance).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1_400);
    });
    expect(onAdvance).toHaveBeenCalledTimes(1);

    await act(async () => root.unmount());
    container.remove();
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    vi.useRealTimers();
  });
});
