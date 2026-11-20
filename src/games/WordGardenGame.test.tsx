// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import { GARDEN_FRUITS, GARDEN_STAGES, createGardenRound } from '../content/wordGarden';
import { WordGardenGame } from './WordGardenGame';

const media = vi.hoisted(() => ({ play: vi.fn(), notifyInteraction: vi.fn() }));
const mic = vi.hoisted(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  onSample: null as null | ((level: 0 | 1, duration: number) => void),
}));
const sound = vi.hoisted(() => ({ playTap: vi.fn(), playSuccess: vi.fn() }));
const lifecycle = vi.hoisted(() => ({ handler: null as null | ((state: string) => void) }));
const rounds = vi.hoisted(() => ({ startNextRound: vi.fn() }));

vi.mock('../services/interactionMediaCoordinator', () => ({
  interactionMediaCoordinator: media,
  createInteractionMediaUnits: (_scope: unknown, segments: unknown[]) => segments,
}));
vi.mock('../services/sound', () => ({ soundService: sound }));
vi.mock('../platform/useAppLifecycle', () => ({
  subscribeAppLifecycle: (callback: (state: string) => void) => {
    lifecycle.handler = callback;
    return () => { lifecycle.handler = null; };
  },
  readAppLifecycleState: () => 'foreground',
}));
vi.mock('./useMicEffort', () => ({
  useMicEffort: (onSample: (level: 0 | 1, duration: number) => void) => {
    mic.onSample = onSample;
    return { start: mic.start, stop: mic.stop, supported: true };
  },
}));
vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: {
      fruits: GARDEN_FRUITS,
      stages: GARDEN_STAGES,
    },
    roundKey: 0,
    startNextRound: rounds.startNextRound,
  }),
}));

describe('WordGardenGame', () => {
  let container: HTMLDivElement;
  let root: Root;
  const actEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const onCompleteRound = vi.fn();

  beforeAll(() => { actEnvironment.IS_REACT_ACT_ENVIRONMENT = true; });
  afterAll(() => { delete actEnvironment.IS_REACT_ACT_ENVIRONMENT; });

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement('div');
    root = createRoot(container);
    media.play.mockReset().mockResolvedValue({ status: 'completed' });
    media.notifyInteraction.mockReset();
    mic.start.mockReset().mockResolvedValue({ status: 'started' });
    mic.stop.mockReset();
    sound.playTap.mockReset();
    sound.playSuccess.mockReset();
    rounds.startNextRound.mockReset();
    onCompleteRound.mockReset().mockReturnValue({ starsEarned: 1 });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  const render = async (quietMode = false) => {
    await act(async () => root.render(
      <WordGardenGame
        domainProgress={createInitialProgress().domains.wordGarden}
        settings={{ ...createInitialSettings(), quietMode }}
        overallStars={0}
        mediaReady
        speechStatus={{ supported: true, voiceAvailable: true, speaking: false, activeRequestId: null, activeCue: null }}
        onBack={() => undefined}
        onCompleteRound={onCompleteRound}
      />,
    ));
  };
  const tap = async (label: string) => {
    const button = [...container.querySelectorAll('button')]
      .find((item) => item.getAttribute('aria-label') === label);
    expect(button, label).toBeDefined();
    await act(async () => { button!.click(); });
  };
  const advance = async (milliseconds: number) => {
    await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
  };
  const spoken = () => media.play.mock.calls.flatMap(([request]) => (
    request.units.map((unit: { text: string }) => unit.text)
  ));

  it('adds a third fruit after practice and varies independent actions without breaking seed-to-tree order', () => {
    const beginner = createInitialProgress().domains.wordGarden;
    const afterPractice = { ...beginner, successes: 1 };
    const first = createGardenRound(beginner, 'garden-1');
    const second = createGardenRound(afterPractice, 'garden-2');
    expect(first.fruits).toHaveLength(2);
    expect(second.fruits).toHaveLength(3);
    expect(first.stages.map((stage) => stage.id)).toEqual(GARDEN_STAGES.map((stage) => stage.id));
    expect(second.stages.map((stage) => stage.id).slice(5, 12))
      .toEqual(['pick', 'wash', 'put', 'carry', 'smell', 'share', 'taste']);
    expect(second.stages.map((stage) => stage.id).slice(12))
      .toEqual(first.stages.map((stage) => stage.id).slice(12));
  });

  it('models fruit exchange and twenty-one pictured actions in three and four words without microphone', async () => {
    await render();
    expect(container.textContent).not.toContain('אני רוצה');
    await tap('דובדבנים');
    expect(spoken()).toContain('אני רוצה דובדבנים');
    expect(mic.start).not.toHaveBeenCalled();
    await tap('לשמוע את שון');
    expect(spoken()).toContain('שון בוחר דובדבנים');
    await tap('תמרים');
    expect(spoken()).toContain('אני רוצה דובדבנים ותמרים');
    await tap('לשמוע את נועה');
    expect(spoken()).toContain('נועה בוחרת גם תמרים');
    await advance(4_000);
    for (const stage of GARDEN_STAGES) {
      expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe(stage.id);
      await tap(`נוגעים ושומעים: ${stage.line.he}`);
      if (stage.id === 'ask') {
        expect(spoken().slice(-3)).toEqual(['מה שון מבקש?', 'אפרסמון', 'שון מבקש אפרסמון']);
        expect(container.querySelector('.word-garden-growth image')?.getAttribute('href'))
          .toBe('/assets/vocabulary/persimmons.webp');
      }
      if (stage.id === 'seed' || stage.id === 'fruit') {
        expect(container.querySelector('.word-garden-growth image')?.getAttribute('href'))
          .toBe('/assets/vocabulary/persimmons.webp');
      }
      expect(spoken()).toContain(stage.line.he);
      expect(spoken()).not.toContain(stage.expanded.he);
      await advance(1_799);
      expect(spoken()).not.toContain(stage.expanded.he);
      await advance(1);
      expect(spoken()).toContain(stage.expanded.he);
      if (stage.id !== 'fruit') await advance(2_400);
    }
    await advance(2_400);
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound.mock.calls[0]?.[0]).toMatchObject({
      requiredActions: 23,
      concepts: ['cherries', 'dates'],
    });
    expect(mic.start).not.toHaveBeenCalled();
    await advance(5_000);
    expect(rounds.startNextRound).toHaveBeenCalledTimes(1);
  });

  it('speaks another four-word connector and still works in quiet mode', async () => {
    await render(true);
    await tap('תמרים');
    await tap('דובדבנים');
    await tap('לשמוע דרך נוספת לחבר בין הפירות');
    expect(spoken()).toContain('גם תמרים וגם דובדבנים');
    expect(container.querySelector('.word-garden-mic')).toBeNull();
    expect(mic.start).not.toHaveBeenCalled();
  });

  it('reports only sound effort and releases listening when backgrounded', async () => {
    await render();
    await tap('דובדבנים');
    await tap('אפשר להקשיב לקול');
    expect(mic.start).toHaveBeenCalledTimes(1);
    await act(async () => { mic.onSample?.(1, 200); mic.onSample?.(1, 200); });
    expect(container.querySelector('.word-garden-mic')?.className).toContain('heard-voice');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('שמעתי קול');
    await act(async () => { lifecycle.handler?.('background'); });
    expect(mic.stop).toHaveBeenCalled();
    await advance(5_000);
    expect(spoken()).not.toContain('שמעתי קול');
  });

  it('continues touch-only after a microphone denial or an audio error', async () => {
    mic.start.mockResolvedValueOnce({ status: 'permission-denied' });
    await render();
    await tap('דובדבנים');
    await tap('אפשר להקשיב לקול');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('אין מיקרופון');
    media.play.mockResolvedValueOnce({ status: 'errored' });
    await tap('תמרים');
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toContain('השמע אינו זמין');
    await advance(4_000);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('arrive');
    await tap('נוגעים ושומעים: הגנן מגיע לגן');
    expect(container.querySelector('.word-garden-growth')?.className).toContain('is-growing');
  });

  it('does not silently advance a stage when playback finishes after backgrounding', async () => {
    await render();
    await tap('דובדבנים');
    let finish!: (value: { status: 'completed' }) => void;
    media.play.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await tap('תמרים');
    await act(async () => { lifecycle.handler?.('background'); finish({ status: 'completed' }); });
    await advance(4_000);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('fruit');
    await act(async () => { lifecycle.handler?.('foreground'); });
    await tap('לשמוע את הפירות או להתחיל בסיפור');
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('arrive');
  });

  it('pauses and expands a pictured action after returning from background', async () => {
    await render();
    await tap('דובדבנים');
    await tap('תמרים');
    await advance(4_000);
    await tap('נוגעים ושומעים: הגנן מגיע לגן');
    await act(async () => { lifecycle.handler?.('background'); });
    await advance(5_000);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('arrive');
    expect(spoken()).not.toContain('הגנן מגיע עם סל');
    await act(async () => { lifecycle.handler?.('foreground'); });
    await tap('נוגעים ושומעים: הגנן מגיע עם סל');
    expect(spoken()).toContain('הגנן מגיע עם סל');
    await advance(2_400);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('ask');
    expect(spoken()).toContain('מה שון מבקש?');
  });

  it('keeps sound-effort feedback separate from the persimmon answer until the picture is touched', async () => {
    await render();
    await tap('דובדבנים');
    await tap('תמרים');
    await advance(4_000);
    await tap('נוגעים ושומעים: הגנן מגיע לגן');
    await advance(4_200);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('ask');
    await tap('אפשר להקשיב לקול');
    await act(async () => { mic.onSample?.(1, 200); mic.onSample?.(1, 200); });
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe('שמעתי קול');
    await tap('אפשר להקשיב לקול');
    expect(spoken()).toContain('שמעתי קול');
    expect(spoken()).not.toContain('אפרסמון');
    expect(spoken()).not.toContain('שון מבקש אפרסמון');
    expect(spoken()).not.toContain('שון מבקש אפרסמון כתום');
    await advance(4_000);
    expect(container.querySelector('.word-garden-scene')?.getAttribute('data-stage')).toBe('ask');
    await tap('נוגעים ושומעים: שון מבקש אפרסמון');
    expect(spoken().slice(-2)).toEqual(['אפרסמון', 'שון מבקש אפרסמון']);
  });
});
