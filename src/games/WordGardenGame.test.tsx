// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, createInitialSettings } from '../domain/progression';
import { GARDEN_STAGES } from '../content/wordGarden';
import { WordGardenGame } from './WordGardenGame';

const media = vi.hoisted(() => ({ play: vi.fn(), notifyInteraction: vi.fn() }));
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
}));
vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({ roundKey: 0, startNextRound: rounds.startNextRound }),
}));

describe('WordGardenGame touch journey', () => {
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
  const target = () => container.querySelector<HTMLButtonElement>('.garden-journey__target')!;
  const tap = async () => { await act(async () => target().click()); };
  const advance = async (time?: number) => {
    const duration = time ?? (container.querySelector('.garden-journey')?.getAttribute('data-stage') === 'ask' ? 2_200 : 1_100);
    await act(async () => { await vi.advanceTimersByTimeAsync(duration); });
  };
  const spoken = () => media.play.mock.calls.flatMap(([request]) => (
    request.units.map((unit: { text: string }) => unit.text)
  ));

  it('asks before the first touch, then says the fruit and delivers it without a second gate', async () => {
    await render();
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('ask');
    expect(target().querySelector('img')?.getAttribute('src')).toBe('/assets/garden/persimmon.webp');
    expect(spoken()).toContain('מה שון מבקש?');
    expect(spoken()).not.toContain('אפרסמון');
    await tap();
    expect(container.querySelector('.garden-journey')?.getAttribute('data-acted')).toBe('true');
    expect(spoken().slice(-2)).toEqual(['אפרסמון', 'שון מבקש אפרסמון']);
    await advance();
    expect(spoken()).toContain('שון מבקש אפרסמון כתום');
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('exchange');
  });

  it('does not cut off the first three spoken clips when their total duration exceeds the fallback', async () => {
    media.play.mockImplementation(() => new Promise((resolve) => {
      window.setTimeout(() => resolve({ status: 'completed' }), 3_000);
    }));
    await render();
    await tap();
    await advance(7_500);
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('ask');
    expect(spoken()).toContain('שון מבקש אפרסמון כתום');
    await advance(3_800);
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('exchange');
  });

  it('models each pictured action in the active turn and never advances on fast double-taps', async () => {
    await render();
    const journey = ['ask', 'exchange', 'seed', 'cover', 'water', 'sprout', 'tree', 'fruit'] as const;
    for (const id of journey) {
      expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe(id);
      const before = spoken().length;
      await tap();
      await tap();
      expect(spoken().slice(before)).toContain(
        (id === 'ask'
          ? GARDEN_STAGES.find((stage) => stage.id === id)!.line
          : GARDEN_STAGES.find((stage) => stage.id === id)!.expanded).he,
      );
      expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe(id);
      await advance();
    }
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('complete');
    expect(onCompleteRound).toHaveBeenCalledTimes(1);
    expect(onCompleteRound.mock.calls[0]?.[0]).toMatchObject({ requiredActions: 8, attempts: 8 });
    expect(container.querySelectorAll('.garden-journey__finish-choice')).toHaveLength(3);
  });

  it('lets a missed drag return safely and accepts a token drop or ordinary tap', async () => {
    await render();
    await tap();
    await advance();
    const token = target();
    token.setPointerCapture = vi.fn();
    const dispatch = (name: string, x: number, y: number) => token.dispatchEvent(
      Object.assign(new Event(name, { bubbles: true }), { clientX: x, clientY: y, pointerId: 1 }),
    );
    await act(async () => {
      dispatch('pointerdown', 100, 100);
      dispatch('pointermove', 150, 100);
      dispatch('pointerup', 150, 100);
      token.click();
    });
    expect(container.querySelector('.garden-journey')?.getAttribute('data-acted')).toBe('false');
    expect(target().style.getPropertyValue('--drag-x')).toBe('0px');
    const destination = container.querySelector('.garden-journey__destination')!;
    vi.spyOn(destination, 'getBoundingClientRect').mockReturnValue({ left: 140, right: 200, top: 70, bottom: 130 } as DOMRect);
    await act(async () => {
      dispatch('pointerdown', 100, 100);
      dispatch('pointermove', 150, 100);
      dispatch('pointerup', 150, 100);
      token.click();
    });
    expect(container.querySelector('.garden-journey')?.getAttribute('data-acted')).toBe('true');
    expect(spoken()).toContain('שון נותן אסימון לגנן');
  });

  it('keeps quiet and audio-failure turns playable and resumes after backgrounding', async () => {
    media.play.mockResolvedValue({ status: 'errored' });
    await render(true);
    expect(spoken()).toEqual([]);
    await tap();
    await act(async () => { lifecycle.handler?.('background'); });
    await advance(7_000);
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('ask');
    await act(async () => { lifecycle.handler?.('foreground'); });
    await advance();
    expect(container.querySelector('.garden-journey')?.getAttribute('data-stage')).toBe('exchange');
    await tap();
    expect(container.querySelector('.garden-journey')?.getAttribute('data-acted')).toBe('true');
  });

  it('offers an optional three-part banana sentence with one full model and a return to the garden', async () => {
    await render();
    for (let index = 0; index < 8; index += 1) { await tap(); await advance(); }
    const bonus = [...container.querySelectorAll<HTMLButtonElement>('.garden-journey__finish-choice')]
      .find((button) => button.getAttribute('aria-label') === 'משחק הבננה')!;
    await act(async () => bonus.click());
    for (const [part, label] of ['הילד', 'אוכל', 'בננה'].entries()) {
      expect(container.querySelector('.garden-bonus')?.getAttribute('data-part')).toBe(String(part));
      if (part === 1) {
        const replay = [...container.querySelectorAll<HTMLButtonElement>('button')]
          .find((button) => button.getAttribute('aria-label') === 'לשמוע שוב')!;
        await act(async () => replay.click());
        expect(spoken().at(-1)).toBe('אוכל');
      }
      const button = container.querySelector<HTMLButtonElement>('.garden-bonus__target')!;
      expect(button.getAttribute('aria-label')).toBe(label);
      await act(async () => button.click());
      await advance();
    }
    expect(spoken().filter((text) => text === 'הילד אוכל בננה')).toHaveLength(1);
    expect(container.querySelector('.garden-bonus')?.getAttribute('data-part')).toBe('3');
    await act(async () => container.querySelector<HTMLButtonElement>('.garden-bonus__target')!.click());
    expect(rounds.startNextRound).toHaveBeenCalledTimes(1);
  });

  it('joins two pictured fruits into a three-word request and a four-word request with a connector', async () => {
    await render();
    for (let index = 0; index < 8; index += 1) { await tap(); await advance(); }
    const join = [...container.querySelectorAll<HTMLButtonElement>('.garden-journey__finish-choice')]
      .find((button) => button.getAttribute('aria-label') === 'מחברים שני פירות')!;
    await act(async () => join.click());
    expect(container.querySelector('.garden-bonus--connector')?.getAttribute('data-part')).toBe('0');
    expect(spoken().at(-1)).toBe('בואו נקטוף יחד');
    const first = container.querySelector<HTMLButtonElement>('.garden-bonus__target')!;
    expect(first.getAttribute('aria-label')).toBe('אני רוצה דובדבנים');
    await act(async () => { first.click(); first.click(); });
    expect(spoken().filter((text) => text === 'אני רוצה דובדבנים')).toHaveLength(1);
    await advance();
    const second = container.querySelector<HTMLButtonElement>('.garden-bonus__target')!;
    expect(second.querySelector('img')?.getAttribute('src')).toBe('/assets/garden/dates.webp');
    const replay = [...container.querySelectorAll<HTMLButtonElement>('button')]
      .find((button) => button.getAttribute('aria-label') === 'לשמוע שוב')!;
    await act(async () => replay.click());
    expect(spoken().at(-1)).toBe('אני רוצה דובדבנים');
    await act(async () => second.click());
    expect(spoken().at(-1)).toBe('אני רוצה דובדבנים ותמרים');
    await advance();
    expect(container.querySelector('.garden-bonus--connector')?.getAttribute('data-part')).toBe('2');
    await act(async () => container.querySelector<HTMLButtonElement>('.garden-bonus__target')!.click());
    expect(rounds.startNextRound).toHaveBeenCalledTimes(1);
  });
});
