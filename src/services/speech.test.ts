import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechService, selectVoiceForLocale, speechRateForLocale, type SpeechResult } from './speech';
import { createInitialSettings } from '../domain/progression';

class FakeUtterance {
  readonly text: string;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

function voice(name: string, lang: string, localService = true): SpeechSynthesisVoice {
  return {
    default: false,
    lang,
    localService,
    name,
    voiceURI: `${lang}:${name}`,
  };
}

class FakeSpeechSynthesis {
  readonly spoken: FakeUtterance[] = [];
  readonly speakCalls: FakeUtterance[] = [];
  readonly events: string[] = [];
  cancelCount = 0;
  overlapCount = 0;
  unlockGreetingCount = 0;
  resumeCount = 0;
  paused = false;
  emitUnlockGreetingStart = true;
  stallUnlockGreeting: 'none' | 'pending' | 'speaking' = 'none';
  stallRegularStart = false;
  private voices: SpeechSynthesisVoice[];
  private readonly listeners = new Map<string, Set<() => void>>();
  private current: FakeUtterance | null = null;
  private stalled: FakeUtterance | null = null;
  private userActivation = false;
  private engineUnlocked = false;
  private blockedBehavior: 'drop' | 'pending' = 'drop';

  constructor(voices: SpeechSynthesisVoice[]) {
    this.voices = voices;
  }

  get speaking(): boolean {
    return this.current !== null;
  }

  get pending(): boolean {
    return this.stalled !== null;
  }

  getVoices = () => this.voices;

  addEventListener = (name: string, listener: () => void) => {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  };

  removeEventListener = (name: string, listener: () => void) => {
    this.listeners.get(name)?.delete(listener);
  };

  runInUserActivation(action: () => void): void {
    this.events.push('activation:start');
    this.userActivation = true;
    try {
      action();
    } finally {
      this.userActivation = false;
      this.events.push('activation:end');
    }
  }

  lockEngine(behavior: 'drop' | 'pending' = 'drop'): void {
    this.engineUnlocked = false;
    this.blockedBehavior = behavior;
  }

  setVoices(voices: SpeechSynthesisVoice[]): void {
    this.voices = voices;
    this.listeners.get('voiceschanged')?.forEach((listener) => listener());
  }

  speak = (utterance: FakeUtterance) => {
    this.speakCalls.push(utterance);
    this.events.push(`speak:${utterance.text}`);
    const isUnlockGreeting = utterance.text === 'שלום שון' || utterance.text === 'Hello Sean';
    if (!this.engineUnlocked && !this.userActivation) {
      if (this.blockedBehavior === 'pending') {
        this.stalled = utterance;
      }
      return;
    }

    if (this.userActivation) {
      this.engineUnlocked = true;
    }
    if (isUnlockGreeting) {
      this.unlockGreetingCount += 1;
      if (this.stallUnlockGreeting === 'pending') {
        this.stalled = utterance;
        return;
      }
      if (this.stallUnlockGreeting === 'speaking') {
        this.current = utterance;
        return;
      }
      if (this.emitUnlockGreetingStart) {
        utterance.onstart?.();
      }
      utterance.onend?.();
      return;
    }

    if (this.stallRegularStart) {
      this.current = utterance;
      return;
    }
    if (this.current) {
      this.overlapCount += 1;
    }
    this.current = utterance;
    this.spoken.push(utterance);
    utterance.onstart?.();
  };

  cancel = () => {
    this.cancelCount += 1;
    const current = this.current ?? this.stalled;
    this.current = null;
    this.stalled = null;
    current?.onerror?.({ error: 'canceled' });
  };

  resume = () => {
    this.resumeCount += 1;
    this.paused = false;
  };

  finishCurrent(): void {
    const current = this.current;
    if (!current) {
      throw new Error('No utterance is pending');
    }
    this.current = null;
    current.onend?.();
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('SpeechService', () => {
  let synthesis: FakeSpeechSynthesis;
  let service: SpeechService;
  let settings: ReturnType<typeof createInitialSettings>;
  let windowListeners: Map<string, Set<() => void>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    settings = createInitialSettings();
    windowListeners = new Map();
    synthesis = new FakeSpeechSynthesis([
      voice('Generic Hebrew', 'he-IL'),
      voice('Carmit Premium', 'he-IL', false),
      voice('Samantha', 'en-US'),
      voice('Daniel', 'en-GB'),
    ]);
    const fakeWindow = {
      speechSynthesis: synthesis,
      SpeechSynthesisUtterance: FakeUtterance,
      setTimeout: (callback: () => void, delay?: number) => {
        synthesis.events.push('async:timeout');
        return setTimeout(callback, delay);
      },
      clearTimeout,
      addEventListener: vi.fn((name: string, listener: () => void) => {
        const listeners = windowListeners.get(name) ?? new Set();
        listeners.add(listener);
        windowListeners.set(name, listeners);
      }),
    };
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    service = new SpeechService();
    synthesis.runInUserActivation(() => service.unlock(settings));
    await flush();
  });

  afterEach(() => {
    expect(synthesis.overlapCount).toBe(0);
    service.cancelAll('navigation');
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holds queued speech until the first iPad touch unlocks the engine', async () => {
    synthesis.lockEngine();
    const lockedService = new SpeechService();
    const greetingCount = synthesis.unlockGreetingCount;
    const done = lockedService.speakSegments([{ text: 'מצא את הכלב', locale: 'he-IL' }], settings);
    await flush();

    expect(synthesis.spoken).toHaveLength(0);
    expect(synthesis.unlockGreetingCount).toBe(greetingCount);

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    await flush();

    expect(synthesis.unlockGreetingCount).toBe(greetingCount);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['מצא את הכלב']);
    expect(synthesis.cancelCount).toBe(0);
    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('speaks immediately when iPad voices are empty and voiceschanged never fires', async () => {
    synthesis.setVoices([]);
    synthesis.lockEngine();
    const lockedService = new SpeechService();
    const done = lockedService.speakSegments([{ text: 'תפוח', locale: 'he-IL' }], settings);

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['תפוח']);
    expect(synthesis.spoken[0]).toMatchObject({ lang: 'he-IL', voice: null });

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('calls speak with queued real text inside unlock before asynchronous work', async () => {
    synthesis.lockEngine();
    const lockedService = new SpeechService();
    const done = lockedService.speakSegments([{ text: 'מצא את החתול', locale: 'he-IL' }], settings);
    synthesis.events.length = 0;

    synthesis.runInUserActivation(() => {
      synthesis.events.push('unlock:start');
      lockedService.unlock(settings);
      synthesis.events.push('unlock:end');
    });

    const speakIndex = synthesis.events.indexOf('speak:מצא את החתול');
    const asyncIndex = synthesis.events.indexOf('async:timeout');
    expect(speakIndex).toBeGreaterThan(synthesis.events.indexOf('unlock:start'));
    expect(speakIndex).toBeLessThan(synthesis.events.indexOf('unlock:end'));
    expect(speakIndex).toBeLessThan(asyncIndex);
    expect(synthesis.events.at(0)).toBe('activation:start');
    expect(synthesis.events.at(-1)).toBe('activation:end');

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('uses one natural localized greeting when no game prompt is queued', () => {
    synthesis.lockEngine();
    const lockedService = new SpeechService();
    const callCount = synthesis.speakCalls.length;
    const greetingCount = synthesis.unlockGreetingCount;

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    synthesis.runInUserActivation(() => lockedService.unlock(settings));

    const firstCall = synthesis.speakCalls[callCount];
    expect(firstCall).toMatchObject({
      text: 'שלום שון',
      lang: 'he-IL',
      rate: 0.72,
      volume: settings.soundLevel,
    });
    expect(firstCall?.text.replace(/[\s\u200B-\u200D\u2060\uFEFF]/gu, '')).toBe('שלוםשון');
    expect(synthesis.unlockGreetingCount).toBe(greetingCount + 1);
  });

  it('does not become ready when the natural greeting never receives onstart', async () => {
    synthesis.lockEngine();
    synthesis.emitUnlockGreetingStart = false;
    const lockedService = new SpeechService();
    const greetingCount = synthesis.unlockGreetingCount;

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    const done = lockedService.speakSegments([{ text: 'המשך המשחק', locale: 'he-IL' }], settings);
    await flush();

    expect(synthesis.unlockGreetingCount).toBe(greetingCount + 1);
    expect(synthesis.spoken).toHaveLength(0);

    synthesis.emitUnlockGreetingStart = true;
    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['המשך המשחק']);

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('replaces a pending unstarted greeting with queued game speech on the next gesture', async () => {
    synthesis.lockEngine();
    synthesis.stallUnlockGreeting = 'pending';
    const lockedService = new SpeechService();

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.pending).toBe(true);
    const done = lockedService.speakSegments([{ text: 'מצא את הכדור', locale: 'he-IL' }], settings);
    await flush();
    expect(synthesis.spoken).toHaveLength(0);

    synthesis.stallUnlockGreeting = 'none';
    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['מצא את הכדור']);

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('replaces an eventless greeting even when WebKit reports speaking without pending', async () => {
    synthesis.lockEngine();
    synthesis.stallUnlockGreeting = 'speaking';
    const lockedService = new SpeechService();

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.speaking).toBe(true);
    expect(synthesis.pending).toBe(false);
    const done = lockedService.speakSegments([{ text: 'מצא את המכונית', locale: 'he-IL' }], settings);
    await flush();
    expect(synthesis.spoken).toHaveLength(0);

    synthesis.stallUnlockGreeting = 'none';
    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['מצא את המכונית']);

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('cancels an eventless greeting when the page is hidden', () => {
    synthesis.lockEngine();
    synthesis.stallUnlockGreeting = 'speaking';
    const lockedService = new SpeechService();
    const cancelCount = synthesis.cancelCount;

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.speaking).toBe(true);
    windowListeners.get('pagehide')?.forEach((listener) => listener());

    expect(synthesis.cancelCount).toBe(cancelCount + 1);
    expect(synthesis.speaking).toBe(false);
  });

  it('retries an eventless queued utterance when WebKit reports speaking before onstart', async () => {
    synthesis.lockEngine();
    synthesis.stallRegularStart = true;
    const lockedService = new SpeechService();
    const done = lockedService.speakSegments([{ text: 'מצא את הנעל', locale: 'he-IL' }], settings);

    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.speaking).toBe(true);
    expect(synthesis.pending).toBe(false);
    expect(synthesis.spoken).toHaveLength(0);

    synthesis.stallRegularStart = false;
    synthesis.runInUserActivation(() => lockedService.unlock(settings));
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['מצא את הנעל']);

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('skips whitespace and zero-width segments without calling speak', async () => {
    const callCount = synthesis.speakCalls.length;
    const result = await service.speakSegments(
      [
        { text: '\u00a0', locale: 'he-IL' },
        { text: '\u200b', locale: 'he-IL' },
        { text: '', locale: 'he-IL' },
      ],
      settings,
    );

    expect(result.status).toBe('skipped');
    expect(synthesis.speakCalls).toHaveLength(callCount);
  });

  it('retries a silently dropped utterance on the next touch without cancelling', async () => {
    synthesis.lockEngine('drop');
    synthesis.paused = true;
    const resumeCount = synthesis.resumeCount;
    const done = service.speakSegments([{ text: 'נסה שוב', locale: 'he-IL' }], settings);
    await flush();

    expect(synthesis.spoken).toHaveLength(0);
    expect(synthesis.cancelCount).toBe(0);

    synthesis.runInUserActivation(() => service.unlock(settings));
    await flush();

    expect(synthesis.resumeCount).toBeGreaterThan(resumeCount);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['נסה שוב']);
    expect(synthesis.cancelCount).toBe(0);
    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('replaces a pre-start stalled utterance but never retries an active word', async () => {
    synthesis.lockEngine('pending');
    const stalled = service.speakSegments([{ text: 'מילה תקועה', locale: 'he-IL' }], settings);
    await flush();

    expect(synthesis.pending).toBe(true);
    synthesis.runInUserActivation(() => service.unlock(settings));
    await flush();
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['מילה תקועה']);

    synthesis.runInUserActivation(() => service.unlock(settings));
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken).toHaveLength(1);

    synthesis.finishCurrent();
    await expect(stalled).resolves.toMatchObject({ status: 'completed' });
  });

  it('finishes the active target before starting praise without cancellation', async () => {
    const settings = createInitialSettings();
    const done = service.speakSuccessSequence(
      [{ text: 'כלב', locale: 'he-IL' }],
      [{ text: 'כל הכבוד, שון!', locale: 'he-IL' }],
      settings,
      { scope: 'game:listening', key: 'success' },
    );
    await flush();

    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['כלב']);
    expect(synthesis.cancelCount).toBe(0);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(280);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['כלב', 'כל הכבוד, שון!']);
    expect(synthesis.cancelCount).toBe(0);

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('plays retry modeling before encouragement and exposes the active teaching cue', async () => {
    const settings = createInitialSettings();
    const cues: Array<string | null> = [];
    const unsubscribe = service.subscribe((status) => cues.push(status.activeCue));
    const done = service.speakRetrySequence(
      [{ text: 'אחת', locale: 'he-IL', cue: 'count-item:0' }],
      [{ text: 'שון, כל ניסיון עוזר לנו ללמוד. בוא ננסה שוב.', locale: 'he-IL' }],
      settings,
      { scope: 'game:counting', key: 'retry' },
    );
    await flush();

    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['אחת']);
    expect(cues).toContain('count-item:0');

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual([
      'אחת',
      'שון, כל ניסיון עוזר לנו ללמוד. בוא ננסה שוב.',
    ]);
    expect(cues.at(-1)).toBeNull();

    synthesis.finishCurrent();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
    unsubscribe();
  });

  it('coalesces queued retries while preserving active target pronunciation', async () => {
    const settings = createInitialSettings();
    const target = service.speakSegments([{ text: 'שלושה תפוחים', locale: 'he-IL' }], settings, {
      scope: 'game:counting',
      key: 'target',
      priority: 'label',
    });
    await flush();

    const firstRetry = service.speakRetrySequence(
      [{ text: 'בוא נספור יחד', locale: 'he-IL' }],
      [{ text: 'נסה שוב', locale: 'he-IL' }],
      settings,
      { scope: 'game:counting', key: 'retry' },
    );
    const latestRetry = service.speakRetrySequence(
      [{ text: 'יש שלושה תפוחים', locale: 'he-IL' }],
      [{ text: 'עוד ניסיון קטן', locale: 'he-IL' }],
      settings,
      { scope: 'game:counting', key: 'retry' },
    );

    await expect(firstRetry).resolves.toMatchObject({ status: 'superseded' });
    expect(synthesis.cancelCount).toBe(0);
    synthesis.finishCurrent();
    await expect(target).resolves.toMatchObject({ status: 'completed' });
    await flush();
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual([
      'שלושה תפוחים',
      'יש שלושה תפוחים',
    ]);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    synthesis.finishCurrent();
    await expect(latestRetry).resolves.toMatchObject({ status: 'completed' });
  });

  it('soft-supersedes active retry speech when a newer retry arrives', async () => {
    const settings = createInitialSettings();
    const first = service.speakRetrySequence(
      [{ text: 'הסל הכחול', locale: 'he-IL' }],
      [{ text: 'נסה שוב', locale: 'he-IL' }],
      settings,
      { scope: 'game:sorting', key: 'retry' },
    );
    await flush();

    const latest = service.speakRetrySequence(
      [{ text: 'הסל הירוק', locale: 'he-IL' }],
      [{ text: 'עוד ניסיון קטן', locale: 'he-IL' }],
      settings,
      { scope: 'game:sorting', key: 'retry' },
    );
    await flush();

    expect(synthesis.cancelCount).toBe(0);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['הסל הכחול']);

    synthesis.finishCurrent();
    await expect(first).resolves.toMatchObject({ status: 'superseded' });
    await flush();
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['הסל הכחול', 'הסל הירוק']);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    synthesis.finishCurrent();
    await expect(latest).resolves.toMatchObject({ status: 'completed' });
  });

  it('hands an unstarted retry to its replacement within the same activation', async () => {
    synthesis.lockEngine('pending');
    const cancelCount = synthesis.cancelCount;
    const first = service.speakRetrySequence(
      [{ text: 'הסל הכחול', locale: 'he-IL' }],
      [{ text: 'נסה שוב', locale: 'he-IL' }],
      settings,
      { scope: 'game:sorting', key: 'retry' },
    );
    await flush();
    expect(synthesis.pending).toBe(true);

    synthesis.stallRegularStart = true;
    let latest!: Promise<SpeechResult>;
    synthesis.runInUserActivation(() => {
      service.unlock(settings);
      synthesis.stallRegularStart = false;
      latest = service.speakRetrySequence(
        [{ text: 'הסל הירוק', locale: 'he-IL' }],
        [{ text: 'עוד ניסיון קטן', locale: 'he-IL' }],
        settings,
        { scope: 'game:sorting', key: 'retry' },
      );
    });

    await expect(first).resolves.toMatchObject({ status: 'superseded' });
    expect(synthesis.cancelCount).toBe(cancelCount + 2);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['הסל הירוק']);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(300);
    synthesis.finishCurrent();
    await expect(latest).resolves.toMatchObject({ status: 'completed' });
  });

  it('supersedes active retry feedback only after the current word finishes', async () => {
    const settings = createInitialSettings();
    const retry = service.speakRetrySequence(
      [
        { text: 'אחת', locale: 'he-IL' },
        { text: 'שתיים', locale: 'he-IL' },
      ],
      [{ text: 'נסה שוב', locale: 'he-IL' }],
      settings,
      { scope: 'game:counting', key: 'retry' },
    );
    await flush();

    const success = service.speakSuccessSequence(
      [{ text: 'שני תפוחים', locale: 'he-IL' }],
      [{ text: 'יופי!', locale: 'he-IL' }],
      settings,
      { scope: 'game:counting', key: 'success' },
    );
    await flush();

    expect(synthesis.cancelCount).toBe(0);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['אחת']);

    synthesis.finishCurrent();
    await expect(retry).resolves.toMatchObject({ status: 'superseded' });
    await flush();
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['אחת', 'שני תפוחים']);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(300);
    await flush();
    synthesis.finishCurrent();
    await expect(success).resolves.toMatchObject({ status: 'completed' });
  });

  it('supersedes active wrong-answer feedback when the round succeeds', async () => {
    const settings = createInitialSettings();
    const feedback = service.speakSegments(
      [{ text: 'חתול. מצא את הכלב', locale: 'he-IL' }],
      settings,
      {
        scope: 'game:listening',
        key: 'feedback',
        priority: 'label',
        staleAfterSuccess: true,
      },
    );
    await flush();

    const success = service.speakSuccessSequence(
      [{ text: 'כלב', locale: 'he-IL' }],
      [{ text: 'יופי!', locale: 'he-IL' }],
      settings,
      { scope: 'game:listening', key: 'success' },
    );
    await flush();

    await expect(feedback).resolves.toMatchObject({ status: 'superseded' });
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['חתול. מצא את הכלב', 'כלב']);

    synthesis.finishCurrent();
    await vi.advanceTimersByTimeAsync(280);
    synthesis.finishCurrent();
    await expect(success).resolves.toMatchObject({ status: 'completed' });
  });

  it('keeps active speech through rapid duplicate requests and supersedes only queued copies', async () => {
    const settings = createInitialSettings();
    const first = service.speakSegments([{ text: 'הקשב', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
    });
    await flush();
    const second = service.speakSegments([{ text: 'הקשב שוב', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
    });
    const third = service.speakSegments([{ text: 'הקשב עכשיו', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
    });

    await expect(second).resolves.toMatchObject({ status: 'superseded' });
    expect(synthesis.cancelCount).toBe(0);
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['הקשב']);

    synthesis.finishCurrent();
    await expect(first).resolves.toMatchObject({ status: 'completed' });
    await flush();
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['הקשב', 'הקשב עכשיו']);
    synthesis.finishCurrent();
    await expect(third).resolves.toMatchObject({ status: 'completed' });
  });

  it('lets an explicit replay interrupt and replace the current scoped request', async () => {
    const settings = createInitialSettings();
    const prompt = service.speakSegments([{ text: 'מצא את הכלב', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
    });
    await flush();
    const replay = service.speakSegments([{ text: 'מצא את הכלב', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
      priority: 'replay',
      interrupt: true,
    });
    await flush();

    await expect(prompt).resolves.toMatchObject({ status: 'superseded' });
    expect(synthesis.cancelCount).toBe(1);
    expect(synthesis.spoken).toHaveLength(2);
    synthesis.finishCurrent();
    await expect(replay).resolves.toMatchObject({ status: 'completed' });
  });

  it('uses conservative locale rates and deterministic preferred voices', async () => {
    const settings = createInitialSettings();
    const hebrew = service.speakSegments([{ text: 'חתול', locale: 'he-IL' }], settings);
    await flush();
    expect(synthesis.spoken[0]).toMatchObject({
      rate: 0.72,
      voice: expect.objectContaining({ name: 'Carmit Premium' }),
    });
    synthesis.finishCurrent();
    await hebrew;

    const english = service.speakSegments([{ text: 'cat', locale: 'en-US' }], settings);
    await flush();
    expect(synthesis.spoken[1]).toMatchObject({
      rate: 0.76,
      voice: expect.objectContaining({ name: 'Samantha' }),
    });
    synthesis.finishCurrent();
    await english;

    expect(speechRateForLocale('he-IL')).toBe(0.72);
    expect(selectVoiceForLocale(synthesis.getVoices(), 'en-GB')?.name).toBe('Daniel');
  });

  it('cancels stale route prompts before the next route can speak', async () => {
    const settings = createInitialSettings();
    const active = service.speakSegments([{ text: 'משחק ישן', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'prompt',
    });
    await flush();
    const queued = service.speakSegments([{ text: 'עוד משחק ישן', locale: 'he-IL' }], settings, {
      scope: 'game:listening',
      key: 'label',
      priority: 'label',
    });

    service.cancelScope('game:listening', 'navigation');
    const next = service.speakSegments([{ text: 'משחק חדש', locale: 'he-IL' }], settings, {
      scope: 'game:counting',
      key: 'prompt',
    });
    await flush();

    await expect(active).resolves.toMatchObject({ status: 'cancelled' });
    await expect(queued).resolves.toMatchObject({ status: 'cancelled' });
    expect(synthesis.spoken.map((utterance) => utterance.text)).toEqual(['משחק ישן', 'משחק חדש']);
    synthesis.finishCurrent();
    await expect(next).resolves.toMatchObject({ status: 'completed' });
  });
});
