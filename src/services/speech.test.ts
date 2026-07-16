import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpeechService, selectVoiceForLocale, speechRateForLocale } from './speech';
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
  readonly pending: FakeUtterance[] = [];
  cancelCount = 0;
  private readonly voices: SpeechSynthesisVoice[];
  private readonly listeners = new Map<string, Set<() => void>>();

  constructor(voices: SpeechSynthesisVoice[]) {
    this.voices = voices;
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

  speak = (utterance: FakeUtterance) => {
    utterance.onstart?.();
    if (utterance.volume === 0) {
      queueMicrotask(() => utterance.onend?.());
      return;
    }
    this.spoken.push(utterance);
    this.pending.push(utterance);
  };

  cancel = () => {
    this.cancelCount += 1;
    const current = this.pending.shift();
    current?.onerror?.({ error: 'canceled' });
  };

  resume = () => undefined;

  finishCurrent(): void {
    const current = this.pending.shift();
    if (!current) {
      throw new Error('No utterance is pending');
    }
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

  beforeEach(() => {
    vi.useFakeTimers();
    synthesis = new FakeSpeechSynthesis([
      voice('Generic Hebrew', 'he-IL'),
      voice('Carmit Premium', 'he-IL', false),
      voice('Samantha', 'en-US'),
      voice('Daniel', 'en-GB'),
    ]);
    const fakeWindow = {
      speechSynthesis: synthesis,
      SpeechSynthesisUtterance: FakeUtterance,
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
    };
    vi.stubGlobal('window', fakeWindow);
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    service = new SpeechService();
  });

  afterEach(() => {
    service.cancelAll('navigation');
    vi.unstubAllGlobals();
    vi.useRealTimers();
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
