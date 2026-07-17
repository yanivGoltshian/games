import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialSettings } from '../domain/progression';
import type {
  RecordedSpeechBackend,
  RecordedSpeechPlayOptions,
} from './recordedSpeech';
import { SpeechService } from './speech';

class FakeRecordedSpeech implements RecordedSpeechBackend {
  readonly played: RecordedSpeechPlayOptions[] = [];
  unlockCount = 0;
  cancelCount = 0;
  overlapCount = 0;
  failNextPlay = false;
  private finishCurrent: (() => void) | null = null;

  isEnabled = () => true;

  unlock = async () => {
    this.unlockCount += 1;
  };

  play = (options: RecordedSpeechPlayOptions) => {
    if (this.failNextPlay) {
      this.failNextPlay = false;
      return Promise.reject(new Error('Recorded speech failed.'));
    }
    if (this.finishCurrent) {
      this.overlapCount += 1;
    }
    this.played.push(options);
    options.onStart();
    return new Promise<void>((resolve) => {
      this.finishCurrent = () => {
        this.finishCurrent = null;
        resolve();
      };
    });
  };

  cancel = () => {
    this.cancelCount += 1;
    this.complete();
  };

  complete(): void {
    this.finishCurrent?.();
  }
}

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('SpeechService recorded fallback', () => {
  let backend: FakeRecordedSpeech;
  let service: SpeechService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
      addEventListener: vi.fn(),
    });
    vi.stubGlobal('SpeechSynthesisUtterance', vi.fn(() => {
      throw new Error('Web Speech must not run in Apple mobile WebKit contexts.');
    }));
    backend = new FakeRecordedSpeech();
    service = new SpeechService(backend);
  });

  afterEach(() => {
    service.cancelAll('navigation');
    expect(backend.overlapCount).toBe(0);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holds speech until the first genuine activation unlocks recorded audio', async () => {
    const done = service.speakSegments(
      [{ text: 'אוטו', locale: 'he-IL' }],
      createInitialSettings(),
    );
    await flush();
    expect(backend.played).toHaveLength(0);

    service.unlock(createInitialSettings());
    await flush();
    expect(backend.unlockCount).toBe(1);
    expect(backend.played.map((item) => item.text)).toEqual(['אוטו']);

    backend.complete();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('keeps model then encouragement serialized without Web Speech or cancellation', async () => {
    service.unlock(createInitialSettings());
    await flush();
    const done = service.speakRetrySequence(
      [{ text: 'three', locale: 'en-US' }],
      [{ text: 'Try again', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'counting' },
    );
    await flush();

    expect(backend.played.map((item) => item.text)).toEqual(['three']);
    service.unlock(createInitialSettings());
    await flush();
    expect(backend.unlockCount).toBe(2);
    expect(backend.cancelCount).toBe(0);
    backend.complete();
    await vi.advanceTimersByTimeAsync(260);
    await flush();
    expect(backend.played.map((item) => item.text)).toEqual(['three', 'Try again']);

    backend.complete();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
    expect(backend.cancelCount).toBe(0);
  });

  it('keeps bilingual locale changes serialized through the recorded queue', async () => {
    service.unlock(createInitialSettings());
    await flush();
    const done = service.speakSegments(
      [
        { text: 'אוטו', locale: 'he-IL', pauseAfterMs: 100 },
        { text: 'car', locale: 'en-US' },
      ],
      createInitialSettings(),
    );
    await flush();

    expect(backend.played.map(({ locale, text }) => `${locale}:${text}`)).toEqual([
      'he-IL:אוטו',
    ]);
    backend.complete();
    await vi.advanceTimersByTimeAsync(100);
    await flush();
    expect(backend.played.map(({ locale, text }) => `${locale}:${text}`)).toEqual([
      'he-IL:אוטו',
      'en-US:car',
    ]);

    backend.complete();
    await expect(done).resolves.toMatchObject({ status: 'completed' });
  });

  it('surfaces recorded playback failures through the existing error result', async () => {
    service.unlock(createInitialSettings());
    await flush();
    backend.failNextPlay = true;

    await expect(service.speakSegments(
      [{ text: 'car', locale: 'en-US' }],
      createInitialSettings(),
    )).resolves.toMatchObject({ status: 'error' });
    expect(backend.played).toHaveLength(0);
  });

  it('continues with the next queued request after a recorded playback failure', async () => {
    service.unlock(createInitialSettings());
    await flush();
    backend.failNextPlay = true;

    const failed = service.speakSegments(
      [{ text: 'broken', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'listening', key: 'broken' },
    );
    const queued = service.speakSegments(
      [{ text: 'next prompt', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'listening', key: 'next' },
    );

    await expect(failed).resolves.toMatchObject({ status: 'error' });
    await flush();
    expect(backend.played.map((item) => item.text)).toEqual(['next prompt']);

    backend.complete();
    await expect(queued).resolves.toMatchObject({ status: 'completed' });
  });

  it('lets an active retry word finish before coalescing the newer retry', async () => {
    service.unlock(createInitialSettings());
    await flush();
    const first = service.speakRetrySequence(
      [{ text: 'first model', locale: 'en-US' }],
      [{ text: 'old encouragement', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'sorting' },
    );
    await flush();
    const second = service.speakRetrySequence(
      [{ text: 'new model', locale: 'en-US' }],
      [{ text: 'new encouragement', locale: 'en-US' }],
      createInitialSettings(),
      { scope: 'sorting' },
    );

    expect(backend.cancelCount).toBe(0);
    backend.complete();
    await expect(first).resolves.toMatchObject({ status: 'superseded' });
    await flush();
    expect(backend.played.map((item) => item.text)).toEqual(['first model', 'new model']);

    backend.complete();
    await vi.advanceTimersByTimeAsync(260);
    backend.complete();
    await expect(second).resolves.toMatchObject({ status: 'completed' });
  });
});
