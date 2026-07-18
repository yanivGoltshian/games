// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import type { ProgressUpdateSummary, ToddlerSettings } from '../domain/types';
import {
  TOY_PHONE_ANSWERING_MS,
  TOY_PHONE_EFFORT_TARGET_MS,
} from './toyPhoneRuntime';
import {
  TOY_PHONE_AUTO_ANSWER_MS,
  TOY_PHONE_SESSION_LIMIT_MS,
  TOY_PHONE_TURN_TIMEOUT_MS,
} from './toyPhoneState';
import { ToyPhoneGame } from './ToyPhoneGame';

type MediaStatus = 'completed' | 'cancelled' | 'replaced' | 'unavailable' | 'errored';

interface PendingMedia {
  request: {
    audioClass: string;
    segments: Array<{ text: string; locale: string }>;
  };
  resolve: (outcome: {
    intentId: string;
    status: MediaStatus;
    speechStatus?: 'completed';
  }) => void;
}

const media = vi.hoisted(() => ({
  play: vi.fn(),
  notifyInteraction: vi.fn(),
  unlock: vi.fn(),
  permission: vi.fn(),
  ring: vi.fn(),
  disconnect: vi.fn(),
  ringCancel: vi.fn(),
  disconnectCancel: vi.fn(),
  pending: [] as PendingMedia[],
}));

const readiness = vi.hoisted(() => ({
  check: vi.fn(),
}));

const metrics = vi.hoisted(() => ({
  persist: vi.fn(),
}));

const microphone = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  onSample: null as null | ((level: 0 | 1, deltaMs: number) => void),
}));

vi.mock('../services/toyPhoneMedia', () => ({
  readPreparedMicrophoneStatus: media.permission,
  startToyPhoneDisconnectCue: media.disconnect,
  startToyPhoneRingCue: media.ring,
  toyPhoneMediaCoordinator: {
    play: media.play,
    notifyInteraction: media.notifyInteraction,
  },
  unlockToyPhoneMedia: media.unlock,
}));

vi.mock('../services/toyPhoneReadiness', () => ({
  checkToyPhoneContentReadiness: readiness.check,
}));

vi.mock('../services/toyPhoneProgressStorage', () => ({
  persistToyPhoneMetric: metrics.persist,
}));

vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: 0 | 1, deltaMs: number) => void) => {
    microphone.onSample = onSample;
    return {
      start: microphone.start,
      stop: microphone.stop,
      supported: true,
    };
  },
}));

describe('ToyPhoneGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  let visibility: DocumentVisibilityState;
  let originalVisibilityDescriptor: PropertyDescriptor | undefined;
  const reactActEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeAll(() => {
    reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });

  afterAll(() => {
    delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
    if (originalVisibilityDescriptor) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityDescriptor);
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    visibility = 'visible';
    media.pending.length = 0;
    media.play.mockReset();
    media.play.mockImplementation((request: PendingMedia['request']) => (
      new Promise((resolve) => {
        media.pending.push({ request, resolve });
      })
    ));
    media.notifyInteraction.mockReset();
    media.unlock.mockReset();
    media.permission.mockReset();
    media.permission.mockResolvedValue('denied');
    media.ring.mockReset();
    media.ring.mockReturnValue(media.ringCancel);
    media.disconnect.mockReset();
    media.disconnect.mockReturnValue(media.disconnectCancel);
    media.ringCancel.mockReset();
    media.disconnectCancel.mockReset();
    readiness.check.mockReset();
    readiness.check.mockResolvedValue({
      status: 'ready',
      contentVersion: 'toy-phone-v1',
    });
    metrics.persist.mockReset();
    microphone.start.mockReset();
    microphone.start.mockResolvedValue({ status: 'started' });
    microphone.stop.mockReset();
    microphone.onSample = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function completeRound(): ProgressUpdateSummary {
    return {
      starsEarned: 0,
      leveledUp: false,
      milestone: false,
      level: 1,
      mastery: 0,
      firstAttempt: true,
      recommendation: null,
    };
  }

  async function settle(): Promise<void> {
    for (let index = 0; index < 6; index += 1) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  }

  async function renderGame(settings: ToddlerSettings = createInitialSettings()): Promise<void> {
    const progress = createInitialProgress(settings.reducedMotion, 0);
    await act(async () => {
      root.render(
        <ToyPhoneGame
          domainProgress={progress.domains.listening}
          settings={settings}
          overallStars={0}
          mediaReady
          speechStatus={{
            supported: true,
            voiceAvailable: true,
            speaking: false,
            activeRequestId: null,
            activeCue: null,
          }}
          onBack={() => undefined}
          onCompleteRound={completeRound}
        />,
      );
    });
    await settle();
  }

  function setViewport(width: number, height: number): void {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  }

  function stage(): string | null {
    return container.querySelector('.toy-phone-surface')?.getAttribute('data-stage') ?? null;
  }

  function pointerEvent(type: string, pointerId: number): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, detail: type === 'click' ? 1 : 0 });
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    return event;
  }

  async function tapHandset(pointerId: number): Promise<void> {
    const handset = container.querySelector<HTMLButtonElement>('.toy-phone-handset-target');
    expect(handset).not.toBeNull();
    await act(async () => {
      handset!.dispatchEvent(pointerEvent('pointerdown', pointerId));
      handset!.dispatchEvent(pointerEvent('pointerup', pointerId));
      handset!.dispatchEvent(pointerEvent('click', pointerId));
    });
  }

  async function advance(milliseconds: number): Promise<void> {
    await act(async () => {
      vi.advanceTimersByTime(milliseconds);
      await Promise.resolve();
    });
    await settle();
  }

  async function completeNext(
    status: MediaStatus = 'completed',
  ): Promise<PendingMedia['request']> {
    const entry = media.pending.shift();
    expect(entry).toBeDefined();
    await act(async () => {
      entry!.resolve({
        intentId: 'test',
        status,
        ...(status === 'completed' ? { speechStatus: 'completed' as const } : {}),
      });
      await Promise.resolve();
    });
    await settle();
    return entry!.request;
  }

  async function interruptTutorial(): Promise<void> {
    await tapHandset(1);
    expect(stage()).toBe('ringing');
  }

  async function answerCall(): Promise<void> {
    const handset = container.querySelector<HTMLButtonElement>('.toy-phone-handset-target');
    expect(handset).not.toBeNull();
    await act(async () => {
      handset!.click();
    });
    expect(stage()).toBe('answering');
    await advance(TOY_PHONE_ANSWERING_MS);
    expect(stage()).toBe('greeting');
  }

  async function reachTurn1(): Promise<void> {
    await interruptTutorial();
    await answerCall();
    await completeNext();
    expect(stage()).toBe('guard1');
    await advance(400);
    expect(stage()).toBe('turn1');
  }

  it('requires a distinct handset tap after interrupting the tutorial', async () => {
    await renderGame();
    await tapHandset(17);
    expect(stage()).toBe('ringing');

    await tapHandset(18);
    expect(stage()).toBe('answering');
  });

  it('opens at 390x844 with the ringing handset as the immediate first action', async () => {
    setViewport(390, 844);
    await renderGame();

    expect(stage()).toBe('tutorial');
    const surface = container.querySelector('.toy-phone-surface');
    expect(surface?.getAttribute('data-tutorial-step')).toBe('ringing');
    expect(surface?.textContent).toBe('');
    expect(container.querySelector('.toy-phone-caller-target')).toBeNull();
    expect(container.querySelector('.toy-phone-object-target')).toBeNull();

    const handset = container.querySelector<HTMLButtonElement>('.toy-phone-handset-target');
    expect(handset?.getAttribute('aria-label')).toBe('לַעֲנוֹת לְטֵלֵפוֹן הַצַּעֲצוּעַ');
    expect(handset?.querySelector('.toy-phone-device')?.classList.contains('is-ringing')).toBe(true);
    expect(handset?.querySelector('.toy-phone-device')?.classList.contains('is-answered')).toBe(false);

    await tapHandset(31);
    expect(stage()).toBe('ringing');
  });

  it('keeps tutorial click suppression owned during overlapping pointer input', async () => {
    await renderGame();
    const handset = container.querySelector<HTMLButtonElement>('.toy-phone-handset-target')!;
    await act(async () => {
      handset.dispatchEvent(pointerEvent('pointerdown', 21));
      handset.dispatchEvent(pointerEvent('pointerdown', 22));
      handset.dispatchEvent(pointerEvent('pointerup', 21));
      handset.dispatchEvent(pointerEvent('click', 21));
    });
    expect(stage()).toBe('ringing');

    await act(async () => {
      handset.dispatchEvent(pointerEvent('pointerup', 22));
      handset.dispatchEvent(pointerEvent('click', 22));
    });
    expect(stage()).toBe('answering');
  });

  it('interrupts the demo, answers one call after rapid taps, and preserves mandatory sequencing', async () => {
    const settings = {
      ...createInitialSettings(),
      languageMode: 'en' as const,
      englishVoiceLocale: 'en-GB' as const,
    };
    await renderGame(settings);
    expect(stage()).toBe('tutorial');
    expect(container.querySelector('.toy-phone-surface')?.textContent).toBe('');

    await interruptTutorial();
    expect(media.ring).toHaveBeenCalled();
    const handset = container.querySelector<HTMLButtonElement>('.toy-phone-handset-target')!;
    await act(async () => {
      for (let index = 0; index < 10; index += 1) {
        handset.click();
      }
    });
    expect(stage()).toBe('answering');
    await advance(TOY_PHONE_ANSWERING_MS);
    expect(stage()).toBe('greeting');
    expect(media.pending).toHaveLength(1);
    expect(media.pending[0]!.request).toMatchObject({
      audioClass: 'mandatory',
      segments: [{
        text: "Hello! I'm the duck.",
        locale: 'en-GB',
      }],
    });

    media.notifyInteraction.mockClear();
    const caller = container.querySelector<HTMLButtonElement>('.toy-phone-caller-target')!;
    await act(async () => caller.click());
    expect(stage()).toBe('greeting');
    expect(media.pending).toHaveLength(1);
    expect(media.notifyInteraction).not.toHaveBeenCalled();

    await completeNext();
    expect(stage()).toBe('guard1');
    await advance(399);
    expect(stage()).toBe('guard1');
    await advance(1);
    expect(stage()).toBe('request');
    expect(media.pending[0]!.request.segments[0]).toMatchObject({
      text: 'Can you show me the ball?',
      locale: 'en-GB',
    });

    await completeNext();
    await advance(400);
    expect(stage()).toBe('turn2');
    const object = container.querySelector<HTMLButtonElement>('.toy-phone-object-target')!;
    await act(async () => object.click());
    expect(stage()).toBe('goodbye');
    expect(media.disconnect).not.toHaveBeenCalled();
    await completeNext();
    expect(stage()).toBe('reward');
    expect(media.disconnect).toHaveBeenCalledTimes(1);
  });

  it('auto-answers at the bounded delay and never opens a denied microphone', async () => {
    await renderGame();
    await interruptTutorial();
    await advance(TOY_PHONE_AUTO_ANSWER_MS - 1);
    expect(stage()).toBe('ringing');
    await advance(1);
    expect(stage()).toBe('answering');
    await advance(TOY_PHONE_ANSWERING_MS);
    await completeNext();
    await advance(400);
    expect(stage()).toBe('turn1');
    expect(microphone.start).not.toHaveBeenCalled();

    await advance(TOY_PHONE_TURN_TIMEOUT_MS);
    expect(stage()).toBe('request');
    expect(media.pending[0]!.request.segments[0]!.text).toBe('אפשר להראות לי את הכדור?');
  });

  it('accepts coarse effort only with prepared permission and gives it the same transition', async () => {
    media.permission.mockResolvedValue('granted');
    await renderGame();
    await reachTurn1();
    await settle();
    expect(microphone.start).toHaveBeenCalledTimes(1);
    expect(microphone.onSample).not.toBeNull();

    await act(async () => {
      microphone.onSample!(1, TOY_PHONE_EFFORT_TARGET_MS / 3);
      microphone.onSample!(1, TOY_PHONE_EFFORT_TARGET_MS / 3);
      microphone.onSample!(1, TOY_PHONE_EFFORT_TARGET_MS / 3);
    });
    expect(stage()).toBe('request');
    expect(microphone.stop).toHaveBeenCalled();
  });

  it('cancels a pending permission preflight on orientation change', async () => {
    let resolvePermission!: (status: 'granted') => void;
    media.permission.mockReturnValue(new Promise((resolve) => {
      resolvePermission = resolve;
    }));
    await renderGame();
    await reachTurn1();
    expect(microphone.start).not.toHaveBeenCalled();

    await act(async () => {
      window.dispatchEvent(new Event('orientationchange'));
    });
    await advance(0);
    expect(stage()).toBe('idle');
    await act(async () => {
      resolvePermission('granted');
      await Promise.resolve();
    });
    await settle();
    expect(microphone.start).not.toHaveBeenCalled();
  });

  it('backgrounds to silent idle and ignores stale speech on foreground', async () => {
    await renderGame();
    await interruptTutorial();
    await answerCall();
    expect(media.pending).toHaveLength(1);

    visibility = 'hidden';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await advance(0);
    expect(stage()).toBe('idle');
    expect(media.notifyInteraction).toHaveBeenCalledWith(
      expect.any(Object),
      'background',
    );

    await completeNext();
    expect(stage()).toBe('idle');
    visibility = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await settle();
    expect(stage()).toBe('idle');
    expect(media.pending).toHaveLength(0);
    expect(microphone.start).not.toHaveBeenCalled();
  });

  it('stops at four minutes, cancels active media, and stays asleep', async () => {
    await renderGame();
    await advance(TOY_PHONE_SESSION_LIMIT_MS);
    expect(stage()).toBe('session-stop');
    expect(media.notifyInteraction).toHaveBeenCalledWith(
      expect.any(Object),
      'exit',
    );
    const playCount = media.play.mock.calls.length;
    await advance(TOY_PHONE_AUTO_ANSWER_MS * 2);
    expect(stage()).toBe('session-stop');
    expect(media.play).toHaveBeenCalledTimes(playCount);
  });

  it('renders a wordless RTL reduced-motion surface with accessible large controls', async () => {
    await renderGame({
      ...createInitialSettings(true),
      reducedMotion: true,
      languageMode: 'he',
    });
    const main = container.querySelector('main');
    expect(main?.getAttribute('dir')).toBe('rtl');
    expect(main?.classList.contains('reduced-motion')).toBe(true);
    expect(container.querySelector('.toy-phone-surface')?.textContent).toBe('');
    expect(container.querySelector('.toy-phone-handset-target')?.getAttribute('aria-label'))
      .toBe('לַעֲנוֹת לְטֵלֵפוֹן הַצַּעֲצוּעַ');
    expect(container.querySelector('.rail-button--home')?.getAttribute('aria-label')).toBe('בַּיִת');
  });

  it('fails closed when mandatory recorded playback is unavailable', async () => {
    await renderGame();
    await interruptTutorial();
    await answerCall();
    await completeNext('unavailable');
    expect(stage()).toBe('asset-error');
    expect(metrics.persist).toHaveBeenCalledWith({
      type: 'media-readiness',
      status: 'not-ready',
    });
  });
});
