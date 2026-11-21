// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { ToddlerSettings } from '../domain/types';
import { GARDEN_CLIP_TIMEOUT_MS, GARDEN_RESPONSE_PAUSE_MS, WordGardenGame } from './WordGardenGame';
import { GARDEN_SENTENCES, makeGardenVisit } from '../content/gardenSentences';
import type * as GardenContent from '../content/gardenSentences';

const mocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  speak: vi.fn(),
  read: vi.fn(),
  play: vi.fn(),
  train: vi.fn(),
  avatar: null as string | null,
}));

vi.mock('../services/sound', () => ({ soundService: { playTap: vi.fn(), playGardenTrain: mocks.train } }));
vi.mock('../services/recordedSpeech', () => ({ recordedSpeechPlayer: { cancel: mocks.cancel, play: mocks.speak } }));
vi.mock('../services/gardenVoiceStorage', () => ({ readGardenVoice: mocks.read }));
vi.mock('../services/gardenVoiceMedia', () => ({ playGardenVoice: mocks.play }));
vi.mock('./useGardenAvatar', () => ({ useGardenAvatar: () => mocks.avatar }));
vi.mock('../content/gardenSentences', async (importOriginal) => {
  const actual = await importOriginal<typeof GardenContent>();
  return { ...actual, makeGardenVisit: vi.fn(() => actual.GARDEN_SENTENCES) };
});

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
    document.body.append(container);
    root = createRoot(container);
    mocks.cancel.mockReset();
    mocks.speak.mockReset().mockResolvedValue(undefined);
    mocks.read.mockReset().mockResolvedValue(null);
    mocks.play.mockReset().mockResolvedValue(true);
    mocks.train.mockReset();
    vi.mocked(makeGardenVisit).mockClear();
    mocks.avatar = 'blob:locally-selected-avatar';
    onCompleteRound.mockReset();
  });
  afterEach(async () => {
    await act(async () => root?.unmount());
    container.remove();
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
  const heading = () => container.querySelector('h1')?.textContent;
  const target = () => container.querySelector<HTMLButtonElement>('.sentence-train__card.is-target')!;
  const defaultPortrait = () => target().querySelector('img[src="/assets/garden/sean-avatar.webp"]')!;
  const imageEvent = async (image: Element, event: 'load' | 'error') => {
    await act(async () => { image.dispatchEvent(new Event(event)); });
  };
  const next = () => container.querySelector<HTMLButtonElement>('.sentence-train__next')!;
  const tap = async (button = target()) => { await act(async () => { button.click(); }); };
  const advance = async (ms = GARDEN_RESPONSE_PAUSE_MS) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
  const spoken = () => mocks.speak.mock.calls.map(([clip]) => clip.text);

  it('opens an enlarged action without taking the next target and closes it without a dismissal', async () => {
    await render({ quietMode: true });
    await tap(); await tap();
    const preview = board().querySelector('.sentence-train__theater');
    expect(preview).not.toBeNull();
    expect(preview?.getAttribute('aria-hidden')).toBe('true');
    expect(preview?.querySelector('button,[tabindex]')).toBeNull();
    const object = target();
    expect(object.dataset.gardenPart).toBe('object');
    expect(document.activeElement).toBe(object);
    await advance(2_500);
    expect(board().querySelector('.sentence-train__theater')).toBeNull();
    expect(target()).toBe(object);
    await tap(container.querySelector<HTMLButtonElement>('.rail-button--replay')!);
    expect(board().querySelector('.sentence-train__theater')).not.toBeNull();
    await tap(object);
    expect(board().querySelector('.sentence-train__theater')).toBeNull();
    expect(next()).toBe(document.activeElement);
  });

  it('starts a different intact story on route re-entry, not on settings changes', async () => {
    const actual = await vi.importActual<typeof GardenContent>('../content/gardenSentences');
    vi.mocked(makeGardenVisit).mockImplementation(previous => actual.makeGardenVisit(previous, 3));
    try {
      await render({ quietMode: true });
      const initial = board().getAttribute('data-story');
      await tap(); await render({ quietMode: true, languageMode: 'en' });
      expect(board().getAttribute('data-story')).toBe(initial);
      expect(makeGardenVisit).toHaveBeenCalledTimes(1);
      await act(async () => root!.unmount());
      root = createRoot(container);
      await render({ quietMode: true });
      expect(board().getAttribute('data-story')).not.toBe(initial);
      expect(target().textContent).toContain('שון');
      expect(makeGardenVisit).toHaveBeenLastCalledWith(initial);
    } finally {
      vi.mocked(makeGardenVisit).mockImplementation(() => GARDEN_SENTENCES);
    }
  });
  it('stays in the first story after a replay and continues with its real next subject', async () => {
    await render({ quietMode: true });
    for (const id of ['banana', 'banana-peel']) {
      expect(board().getAttribute('data-sentence')).toBe(id);
      if (id === 'banana-peel') {
        expect(target().textContent).toBe('הקליפה↑');
        expect(heading()).toBe('מה בתמונה?');
        expect(board().querySelector('img[src^="blob:"]')).toBeNull();
        await tap();
        expect(heading()).toBe('מה קורה לקליפה?');
        await tap(container.querySelector<HTMLButtonElement>('.rail-button--replay')!);
        await render({ quietMode: true, reducedMotion: true });
        expect(board().getAttribute('data-sentence')).toBe(id);
        expect(target().dataset.gardenPart).toBe('action');
        expect(board().querySelector('img[src^="blob:"]')).toBeNull();
      } else {
        await tap(); await tap(); await tap(); await tap(next());
      }
    }
  });

  it.each(['he', 'en'] as const)('arrives, dwells and automatically opens exactly one next actor in %s', async (languageMode) => {
    await render({ languageMode });
    await tap(); await tap(); await tap();
    expect(mocks.train).not.toHaveBeenCalled();
    await advance();
    expect(spoken()).toContain(languageMode === 'he' ? 'שון אוכל בננה' : 'Sean eats a banana');
    expect(mocks.train).toHaveBeenCalledTimes(1);
    expect(next()).toBe(document.activeElement);
    await advance(2_399);
    expect(board().getAttribute('data-journey')).toBe('travel');
    await advance(1);
    expect(board().getAttribute('data-journey')).toBe('station');
    await advance(949);
    expect(next()).not.toBeNull();
    await advance(1);
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
    expect(target()).toBe(document.activeElement);
    await advance(10_000);
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
  });

  it('gives a manual next priority at the last instant, without a stale timer or quiet whistle', async () => {
    await render({ quietMode: true });
    await tap(); await tap(); await tap();
    await advance(2_400); await advance(949);
    await tap(next());
    await advance(1);
    await tap(); await tap(); await tap();
    await advance(2_400); await advance(950);
    expect(board().getAttribute('data-sentence')).toBe('banana-bucket');
    expect(onCompleteRound).toHaveBeenCalledTimes(2);
    expect(mocks.train).not.toHaveBeenCalled();
    expect(mocks.speak).not.toHaveBeenCalled();
  });

  it('holds a completed journey in the background and resumes without repeating sound or scoring', async () => {
    await render();
    await tap(); await tap(); await tap(); await advance();
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    await advance(12_000);
    expect(board().getAttribute('data-sentence')).toBe('banana');
    await act(async () => { window.dispatchEvent(new Event('pageshow')); });
    await advance(2_400); await advance(950);
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
    expect(mocks.train).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
  });

  it('lets a parent replay the full model at the station without auto-cutting it or repeating the whistle', async () => {
    await render();
    await tap(); await tap(); await tap(); await advance(); await advance(2_400);
    await advance(900);
    let finishClip!: () => void;
    mocks.play.mockImplementationOnce(() => new Promise<boolean>((resolve) => { finishClip = () => resolve(true); }));
    mocks.read.mockResolvedValue(new Blob(['synthetic'], { type: 'audio/webm' }));
    await tap(container.querySelector<HTMLButtonElement>('.rail-button--replay')!);
    await advance(1_800);
    expect(board().getAttribute('data-sentence')).toBe('banana');
    await act(async () => finishClip());
    await advance(50);
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
    expect(mocks.train).toHaveBeenCalledTimes(1);
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
  });

  it('cancels departure audio and does not open another actor after Home or unmount', async () => {
    const stop = vi.fn();
    mocks.train.mockReturnValue(stop);
    await render();
    await tap(); await tap(); await tap(); await advance();
    await tap(container.querySelector<HTMLButtonElement>('.rail-button--home')!);
    const lastWords = spoken();
    await advance(8_000);
    expect(board().getAttribute('data-sentence')).toBe('banana');
    expect(stop).toHaveBeenCalledTimes(1);
    await act(async () => root!.unmount());
    root = undefined;
    await advance(8_000);
    expect(spoken()).toEqual(lastWords);
  });

  it('asks, waits for an optional answer, then models the active word and sentence; one tap opens the next actor', async () => {
    await render();
    expect(container.querySelector('main')?.dir).toBe('rtl');
    expect(target().dataset.gardenPart).toBe('actor');
    expect(heading()).toBe('מי בתמונה?');
    expect(target().getAttribute('aria-label')).toBe('הקלף של שון');
    expect(spoken()).toEqual(['מי בתמונה?']);
    await advance(GARDEN_RESPONSE_PAUSE_MS - 1);
    expect(spoken()).not.toContain('שון');
    await advance(1);
    expect(spoken()).toEqual(['מי בתמונה?', 'שון']);
    await tap();
    expect(target().dataset.gardenPart).toBe('action');
    expect(spoken().at(-1)).toBe('מה הוא עושה?');
    await advance();
    expect(spoken().at(-1)).toBe('אוכל');
    await tap();
    expect(board().querySelector('.sentence-train__moving-object')?.getAttribute('href')).toContain('banana-bitten.webp');
    expect(container.querySelectorAll('.sentence-train__card.is-target')).toHaveLength(1);
    await advance();
    expect(spoken()).toContain('בננה');
    await tap();
    expect(board().getAttribute('data-departed')).toBe('false');
    expect(spoken().at(-1)).toBe('אפשר להגיד את כל המשפט?');
    expect(onCompleteRound).toHaveBeenCalledExactlyOnceWith({ attempts: 3, requiredActions: 3, concepts: ['garden-banana'] });
    await advance();
    expect(spoken().at(-1)).toBe('שון אוכל בננה');
    await advance(550);
    expect(spoken().slice(-2)).toEqual(['שון אוכל בננה', 'עוד משפט']);
    expect(board().getAttribute('data-departed')).toBe('true');
    expect(container.querySelectorAll('.sentence-train__next')).toHaveLength(1);
    await tap(next());
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
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
    expect(mocks.cancel).toHaveBeenCalled();
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
    await advance(GARDEN_RESPONSE_PAUSE_MS + 2_000);
    expect(mocks.read.mock.calls.map(([key]) => key)).toEqual(['banana:sean:he', 'banana:sean:en']);
    expect(mocks.play).toHaveBeenCalledExactlyOnceWith(voice, 0.7, expect.any(AbortSignal));
    expect(spoken()).not.toContain('שון אוכל בננה');
    expect(spoken()).toContain('Sean eats a banana');
    expect(mocks.speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Sean eats a banana', locale: 'en-GB' }));
  });

  it('plays the full growth sequence without sound and shows each action payoff', async () => {
    await render({ languageMode: 'en', quietMode: true, reducedMotion: true });
    expect(container.querySelector('main')?.dir).toBe('ltr');
    expect(container.querySelector('main')?.classList.contains('reduced-motion')).toBe(true);
    for (const { id, isSean, art, model } of GARDEN_SENTENCES) {
      expect(board().getAttribute('data-sentence')).toBe(id);
      await tap(); await tap();
      const preview = board().querySelector('.sentence-train__theater .sentence-train__action')!;
      expect(preview.getAttribute('data-acted')).toBe('true');
      expect(!!preview.querySelector('foreignObject')).toBe(isSean);
      expect(preview.querySelector('image,use,.sentence-train__pit'), id).not.toBeNull();
      if (art.motion === 'bury') expect(preview.querySelector('.sentence-train__pit')).not.toBeNull();
      if (art.motion === 'water') expect(preview.querySelectorAll('.garden-drop')).toHaveLength(3);
      if (art.motion === 'grow') expect(preview.querySelector('.garden-palm')?.getAttribute('href')).toContain('date-palm-tree.webp');
      await tap();
      expect(board().getAttribute('data-departed')).toBe('true');
      expect(heading()).toBe(model.en);
      await tap(next());
    }
    expect(onCompleteRound).toHaveBeenCalledTimes(24);
    expect(makeGardenVisit).toHaveBeenCalledTimes(1);
    expect(mocks.speak).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(board().getAttribute('data-sentence')).toBe('banana');
  });

  it('keeps the active round and Sean’s action when the selected illustration cannot render', async () => {
    mocks.avatar = 'blob:invalid-avatar';
    await render({ quietMode: true });
    await tap();
    const images = board().querySelectorAll('img[src="blob:invalid-avatar"]');
    expect(images).toHaveLength(2);
    await act(async () => { images.item(1).dispatchEvent(new Event('error')); });
    expect(board().querySelectorAll('img[src="blob:invalid-avatar"]')).toHaveLength(0);
    expect(target()?.dataset.gardenPart).toBe('action');
    expect(board().querySelectorAll('img[src="/assets/garden/sean-avatar.webp"]')).toHaveLength(2);
    expect(board().querySelector('.sentence-train__badge')).toBeNull();
    await tap();
    expect(board().querySelector('.sentence-train__moving-object')?.getAttribute('href')).toContain('banana-bitten.webp');
    await tap();
    expect(board().textContent).toContain('שון אוכל בננה');
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
  });

  it('shows the bundled Sean on a fresh profile and finishes a sentence with no setup', async () => {
    mocks.avatar = null;
    await render({ languageMode: 'en' });
    expect(target()?.dataset.gardenPart).toBe('actor');
    expect(target().textContent).toContain('Sean');
    expect(heading()).toBe('Who is in the picture?');
    expect(target().getAttribute('aria-label')).toBe('Sean’s card');
    expect(defaultPortrait()).not.toBeNull();
    expect(board().querySelectorAll('.sentence-train__card')).toHaveLength(3);
    expect(container.querySelector('input[type="file"], .floating-gear')).toBeNull();
    expect(spoken()).toEqual([]);
    await imageEvent(defaultPortrait(), 'load');
    expect(spoken()).toEqual(['Who is in the picture?']);
    await tap();
    expect(board().querySelectorAll('img[src="/assets/garden/sean-avatar.webp"]')).toHaveLength(2);
    await tap(); await tap();
    await advance();
    expect(board().textContent).toContain('Sean eats a banana');
    expect(board().getAttribute('data-departed')).toBe('true');
    await tap(next());
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
    expect(target().dataset.gardenPart).toBe('actor');
  });

  it('keeps the first card playable before the art loads and carries Sean’s name into the action turn', async () => {
    mocks.avatar = null;
    await render();
    const actor = target();
    expect(heading()).toBe('מי בתמונה?');
    expect(actor.disabled).toBe(false);
    expect(spoken()).toEqual([]);
    await tap();
    expect(target().dataset.gardenPart).toBe('action');
    expect(spoken()).toEqual(['שון', 'מה הוא עושה?']);
  });

  it.each([
    ['he', 'נוגעים בקלף של שון', 'שון'],
    ['en', 'Tap Sean’s card', 'Sean'],
  ] as const)('uses the %s card prompt and exact name only when the bundled art fails', async (languageMode, cue, name) => {
    mocks.avatar = null;
    await render({ languageMode });
    await imageEvent(defaultPortrait(), 'error');
    expect(heading()).toBe(cue);
    expect(target().querySelector('.sentence-train__badge')).not.toBeNull();
    const replay = container.querySelector<HTMLButtonElement>('.rail-button--replay')!;
    await tap(replay);
    await advance();
    expect(spoken()).toEqual([name, name]);
  });

  it('replaces the bundled original with a late local override without restarting the current turn', async () => {
    mocks.avatar = null;
    await render();
    await imageEvent(defaultPortrait(), 'load');
    await tap();
    const active = target();
    const before = spoken();
    mocks.avatar = 'blob:locally-selected-avatar';
    await render();
    expect(target()).toBe(active);
    expect(target().dataset.gardenPart).toBe('action');
    expect(board().querySelectorAll('img[src="blob:locally-selected-avatar"]')).toHaveLength(2);
    expect(spoken()).toEqual(before);
  });

  it('does not repeat the picture question when an override replaces the loaded default on the actor step', async () => {
    mocks.avatar = null;
    await render();
    await imageEvent(defaultPortrait(), 'load');
    const actor = target();
    mocks.avatar = 'blob:locally-selected-avatar';
    await render();
    expect(target()).toBe(actor);
    expect(actor.querySelector('img')?.src).toBe('blob:locally-selected-avatar');
    await advance();
    expect(spoken()).toEqual(['מי בתמונה?', 'שון']);
  });

  it('still sends the train and opens the next actor when the recording backend never responds', async () => {
    mocks.speak.mockImplementation(() => new Promise(() => {}));
    await render();
    await tap(); await tap(); await tap();
    expect(board().getAttribute('data-departed')).toBe('false');
    await advance(3 * GARDEN_CLIP_TIMEOUT_MS + GARDEN_RESPONSE_PAUSE_MS);
    expect(board().getAttribute('data-departed')).toBe('true');
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    await tap(next());
    expect(target().textContent).toContain('הקליפה');
    expect(board().getAttribute('data-sentence')).toBe('banana-peel');
  });
});
