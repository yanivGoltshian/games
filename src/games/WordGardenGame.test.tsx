// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { ToddlerSettings } from '../domain/types';
import { GARDEN_RESPONSE_PAUSE_MS, WordGardenGame } from './WordGardenGame';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  speak: vi.fn(),
  read: vi.fn(),
  play: vi.fn(),
  avatar: null as string | null,
}));

vi.mock('../services/sound', () => ({ soundService: { playTap: vi.fn() } }));
vi.mock('../services/speech', () => ({ speechService: { cancelScope: mocks.cancel, speakSegments: mocks.speak } }));
vi.mock('../services/gardenVoiceStorage', () => ({ readGardenVoice: mocks.read }));
vi.mock('../services/gardenVoiceMedia', () => ({ playGardenVoice: mocks.play }));
vi.mock('./useGardenAvatar', () => ({ useGardenAvatar: () => mocks.avatar }));

describe('Word Garden sentence train', () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  const onCompleteRound = vi.fn();
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { delete env.IS_REACT_ACT_ENVIRONMENT; });
  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    root = createRoot(container);
    mocks.cancel.mockReset();
    mocks.speak.mockReset().mockResolvedValue({ status: 'completed' });
    mocks.read.mockReset().mockResolvedValue(null);
    mocks.play.mockReset().mockResolvedValue(true);
    mocks.avatar = null;
    onCompleteRound.mockReset();
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    vi.useRealTimers();
  });

  const render = async (patch: Partial<ToddlerSettings> = {}) => {
    const progress = createInitialProgress();
    await act(async () => root!.render(
      <WordGardenGame
        domainProgress={progress.domains.wordGarden}
        settings={{ ...progress.settings, ...patch }}
        overallStars={0}
        mediaReady
        speechStatus={{ supported: true, voiceAvailable: true, speaking: false, activeRequestId: null, activeCue: null }}
        onBack={() => undefined}
        onCompleteRound={onCompleteRound}
      />,
    ));
  };
  const board = () => container.querySelector('.sentence-train')!;
  const target = () => container.querySelector<HTMLButtonElement>('.sentence-train__card.is-target')!;
  const next = () => container.querySelector<HTMLButtonElement>('.sentence-train__next')!;
  const tap = async (button = target()) => { await act(async () => { button.click(); }); };
  const advance = async (ms = GARDEN_RESPONSE_PAUSE_MS) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const spoken = () => mocks.speak.mock.calls.flatMap(([segments]) => segments.map((part: { text: string }) => part.text));

  it('asks, waits for an optional answer, then models the active word and sentence; one tap opens the next actor', async () => {
    await render();
    expect(container.querySelector('main')?.dir).toBe('rtl');
    expect(target().dataset.gardenPart).toBe('actor');
    expect(spoken()).toEqual(['מי בתמונה?']);
    await advance(GARDEN_RESPONSE_PAUSE_MS - 1);
    expect(spoken()).not.toContain('הילד');
    await advance(1);
    expect(spoken()).toEqual(['מי בתמונה?', 'הילד']);
    await tap();
    expect(target().dataset.gardenPart).toBe('action');
    expect(spoken().at(-1)).toBe('מה הוא עושה?');
    await advance();
    expect(spoken().at(-1)).toBe('אוכל');
    await tap();
    expect(board().querySelector('.sentence-train__moving-object')?.getAttribute('src')).toContain('banana-bitten.webp');
    expect(container.querySelectorAll('.sentence-train__card.is-target')).toHaveLength(1);
    await advance();
    expect(spoken()).toContain('בננה');
    await tap();
    expect(board().getAttribute('data-departed')).toBe('false');
    expect(spoken().at(-1)).toBe('אפשר להגיד את כל המשפט?');
    expect(onCompleteRound).toHaveBeenCalledExactlyOnceWith({ attempts: 3, requiredActions: 3, concepts: ['garden-banana'] });
    await advance();
    expect(spoken().slice(-2)).toEqual(['הילד אוכל בננה', 'עוד משפט']);
    expect(board().getAttribute('data-departed')).toBe('true');
    expect(container.querySelectorAll('.sentence-train__next')).toHaveLength(1);
    await tap(next());
    expect(board().getAttribute('data-sentence')).toBe('dates');
    expect(target().dataset.gardenPart).toBe('actor');
  });

  it('advances despite unresolved speech, discards stale models, and replays the active part only', async () => {
    let finishInitial!: () => void;
    mocks.speak.mockImplementationOnce(() => new Promise<void>((resolve) => { finishInitial = resolve; }));
    await render();
    const oldActor = target();
    await tap(oldActor);
    await tap(oldActor);
    expect(target().dataset.gardenPart).toBe('action');
    await act(async () => finishInitial());
    const replay = container.querySelector<HTMLButtonElement>('.rail-button--replay')!;
    await tap(replay);
    expect(spoken().at(-1)).toBe('מה הוא עושה?');
    await advance();
    expect(spoken().at(-1)).toBe('אוכל');
    const beforeExit = spoken().length;
    await tap(target());
    await act(async () => root!.unmount());
    root = undefined;
    const afterExit = spoken().length;
    await advance();
    expect(spoken()).toHaveLength(afterExit);
    expect(afterExit).toBeGreaterThan(beforeExit);
    expect(mocks.cancel).toHaveBeenCalledWith('game:word-garden', 'navigation');
  });

  it('uses the opted-in device image in the actor and action and falls back when a saved language clip is unreadable', async () => {
    const voice = new Blob(['voice'], { type: 'audio/webm' });
    mocks.avatar = 'blob:locally-selected-avatar';
    mocks.read.mockImplementation(async (key: string) => {
      if (key === 'banana:sean:he') return voice;
      throw new Error('unreadable');
    });
    await render({ languageMode: 'bilingual', englishVoiceLocale: 'en-GB' });
    await tap();
    expect(board().querySelectorAll('img[src="blob:locally-selected-avatar"]')).toHaveLength(2);
    await tap();
    await tap();
    await advance();
    expect(mocks.read.mock.calls.map(([key]) => key)).toEqual(['banana:sean:he', 'banana:sean:en']);
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith(voice, 0.7, expect.any(AbortSignal));
    expect(spoken()).not.toContain('שון אוכל בננה');
    expect(spoken()).toContain('Sean eats a banana');
    expect(mocks.speak).toHaveBeenCalledWith(
      [{ text: 'Sean eats a banana', locale: 'en-GB' }], expect.anything(), expect.anything(),
    );
  });

  it('plays the full growth sequence without sound and shows each action payoff', async () => {
    await render({ languageMode: 'en', quietMode: true, reducedMotion: true });
    expect(container.querySelector('main')?.dir).toBe('ltr');
    expect(container.querySelector('main')?.classList.contains('reduced-motion')).toBe(true);
    for (const id of ['banana', 'dates', 'germinate', 'bury', 'water', 'palm', 'token', 'persimmon']) {
      expect(board().getAttribute('data-sentence')).toBe(id);
      await tap(); await tap();
      expect(board().querySelector('.sentence-train__action')?.getAttribute('data-acted')).toBe('true');
      if (id === 'bury') expect(board().querySelector('.sentence-train__pit')).not.toBeNull();
      if (id === 'water') expect(board().querySelectorAll('.sentence-train__drops i')).toHaveLength(3);
      if (id === 'palm') expect(board().querySelector('.sentence-train__moving-object')?.getAttribute('src')).toContain('date-palm-tree.webp');
      if (id === 'token') expect(board().querySelector('.sentence-train__recipient')).not.toBeNull();
      await tap();
      expect(board().getAttribute('data-departed')).toBe('true');
      await tap(next());
    }
    expect(onCompleteRound).toHaveBeenCalledTimes(8);
    expect(mocks.speak).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(board().getAttribute('data-sentence')).toBe('banana');
  });

  it('switches both cards and narration back to the generic child if a selected image cannot render', async () => {
    mocks.avatar = 'blob:invalid-avatar';
    await render();
    await tap();
    const images = board().querySelectorAll('img[src="blob:invalid-avatar"]');
    expect(images).toHaveLength(2);
    await act(async () => { images.item(1).dispatchEvent(new Event('error')); });
    expect(board().querySelectorAll('img[src="blob:invalid-avatar"]')).toHaveLength(0);
    expect(board().querySelector('[data-garden-part="actor"]')?.textContent).toBe('הילד');
    await tap(); await tap(); await advance();
    expect(spoken()).toContain('הילד אוכל בננה');
    expect(mocks.read).toHaveBeenCalledWith('banana:child:he', expect.any(AbortSignal));
  });
});
