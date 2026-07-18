// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type {
  CommunicationGameHostProps,
  CommunicationIntegrationContract,
} from './communication/integration';
import type { CommunicationActivityId } from './domain/communicationGame';
import type { SpeechLocale } from './domain/types';
import type { CommunicationAssetReadiness } from './services/communicationAssetReadiness';
import type {
  CommunicationActivityEnablement,
  CommunicationReleaseReadiness,
} from './communication/release';
import { speechService } from './services/speech';

const activityIds = ['peek', 'train', 'phone', 'story'] as const;
const requiredLocales = ['he-IL', 'en-US', 'en-GB'] as const;

function RegisteredGame({ activityId }: CommunicationGameHostProps) {
  return <main data-mounted-communication-game={activityId} />;
}

function ready(locale: SpeechLocale): CommunicationAssetReadiness {
  return {
    status: 'ready',
    contentVersion: `pack-${locale}`,
    locale,
  };
}

interface ReadyIntegrationOptions {
  enabledActivityIds?: readonly CommunicationActivityId[];
  registeredActivityIds?: readonly CommunicationActivityId[];
  readinessPatch?: Partial<CommunicationReleaseReadiness>;
}

function readyIntegration({
  enabledActivityIds = activityIds,
  registeredActivityIds = activityIds,
  readinessPatch = {},
}: ReadyIntegrationOptions = {}): CommunicationIntegrationContract {
  const explicitlyEnabled = Object.fromEntries(
    activityIds.map((activityId) => [
      activityId,
      enabledActivityIds.includes(activityId),
    ]),
  ) as CommunicationActivityEnablement;
  const completeReadiness = Object.fromEntries(
    requiredLocales.map((locale) => [locale, ready(locale)]),
  );
  return {
    release: {
      explicitlyEnabled,
      readiness: {
        ...Object.fromEntries(
          activityIds.map((activityId) => [activityId, completeReadiness]),
        ) as CommunicationReleaseReadiness,
        ...readinessPatch,
      },
    },
    games: Object.fromEntries(
      registeredActivityIds.map((activityId) => [
        activityId,
        { component: RegisteredGame },
      ]),
    ) as CommunicationIntegrationContract['games'],
  };
}

function homeDomains(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll<HTMLElement>('.portal-grid__item')]
    .map((item) => item.dataset.domain);
}

function shelfDoorIds(container: HTMLElement): (string | undefined)[] {
  return [...container.querySelectorAll<HTMLElement>('.communication-door')]
    .map((door) => door.dataset.activityId);
}

describe('App progressive communication release routing', () => {
  let container: HTMLDivElement;
  let root: Root | null;
  let getUserMedia: ReturnType<typeof vi.fn>;
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
    const stored = new Map<string, string>();
    const localStorage: Storage = {
      get length() {
        return stored.size;
      },
      clear: () => stored.clear(),
      getItem: (key) => stored.get(key) ?? null,
      key: (index) => [...stored.keys()][index] ?? null,
      removeItem: (key) => {
        stored.delete(key);
      },
      setItem: (key, value) => {
        stored.set(key, value);
      },
    };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: localStorage,
    });
    window.history.replaceState(null, '', '#/');
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        media: '',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    getUserMedia = vi.fn();
    Object.defineProperty(window.navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia },
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount());
    }
    root = null;
    container.remove();
    vi.restoreAllMocks();
  });

  it('exposes the production communication shelf while preserving exactly eight home tiles by default', async () => {
    await act(async () => root?.render(<App />));

    expect(homeDomains(container)).toEqual([
      'listening',
      'counting',
      'sorting',
      'puzzle',
      'memory',
      'numberPairs',
      'sillyAlien',
      'communication',
    ]);
  });

  it('replaces Train while keeping exactly eight tiles when one activity becomes public', async () => {
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek'] })} />,
    ));

    const domains = homeDomains(container);
    expect(domains).toHaveLength(8);
    expect(domains.at(-1)).toBe('communication');
    expect(domains).not.toContain('syllableTrain');
  });

  it('keeps Train when all activities are ready and registered but every flag is false', async () => {
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: [] })} />,
    ));

    const domains = homeDomains(container);
    expect(domains).toHaveLength(8);
    expect(domains.at(-1)).toBe('syllableTrain');
    expect(domains).not.toContain('communication');
  });

  it('renders only the one public activity on a progressive shelf', async () => {
    window.history.replaceState(null, '', '#/communication');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['story'] })} />,
    ));

    expect(shelfDoorIds(container)).toEqual(['story']);
    expect(container.querySelector('.communication-shelf__doors')?.getAttribute('data-door-count'))
      .toBe('1');
  });

  it('renders exactly the production Peek, Train, and Story doors on the default shelf', async () => {
    window.history.replaceState(null, '', '#/communication');
    await act(async () => root?.render(<App />));

    expect(shelfDoorIds(container)).toEqual(['peek', 'train', 'story']);
    expect(container.querySelector('.communication-shelf__doors')?.getAttribute('data-door-count'))
      .toBe('3');
  });

  it('adds later public activities without changing App or route wiring', async () => {
    window.history.replaceState(null, '', '#/communication');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['phone'] })} />,
    ));
    expect(shelfDoorIds(container)).toEqual(['phone']);

    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['phone', 'peek'] })} />,
    ));
    expect(shelfDoorIds(container)).toEqual(['peek', 'phone']);
  });

  it('renders all four public doors in fixed registry order', async () => {
    window.history.replaceState(null, '', '#/communication');
    await act(async () => root?.render(<App communication={readyIntegration()} />));

    expect(shelfDoorIds(container)).toEqual(['peek', 'train', 'phone', 'story']);
  });

  it('redirects a shelf with no public activities without media or permission side effects', async () => {
    window.history.replaceState(null, '', '#/communication');
    const cancelAll = vi.spyOn(speechService, 'cancelAll');
    const unlock = vi.spyOn(speechService, 'unlock');
    const unavailable = readyIntegration({
      enabledActivityIds: ['story'],
      readinessPatch: {
        story: {
          'he-IL': ready('he-IL'),
          'en-US': ready('en-US'),
        },
      },
    });

    await act(async () => root?.render(<App communication={unavailable} />));

    expect(window.location.hash).toBe('#/');
    expect(homeDomains(container)).toHaveLength(8);
    expect(container.querySelector('[data-domain="communication"]')).toBeNull();
    expect(cancelAll).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('fails a disabled activity route closed while another public activity keeps the shelf available', async () => {
    window.history.replaceState(null, '', '#/communication/story-that-waits');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek'] })} />,
    ));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();
  });

  it('fails an unregistered activity route closed without hiding other public activities', async () => {
    window.history.replaceState(null, '', '#/communication/toy-phone');
    await act(async () => root?.render(
      <App communication={readyIntegration({
        enabledActivityIds: ['peek', 'phone'],
        registeredActivityIds: ['peek'],
      })} />,
    ));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();
  });

  it('fails an activity missing one exact locale closed without hiding other public activities', async () => {
    window.history.replaceState(null, '', '#/communication/toy-phone');
    await act(async () => root?.render(
      <App communication={readyIntegration({
        enabledActivityIds: ['peek', 'phone'],
        readinessPatch: {
          phone: {
            'he-IL': ready('he-IL'),
            'en-US': ready('en-US'),
          },
        },
      })} />,
    ));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();
  });

  it('keeps Home, shelf, and routes correct when one activity readiness entry is malformed', async () => {
    window.history.replaceState(null, '', '#/communication/toy-phone');
    const contract = readyIntegration({ enabledActivityIds: ['peek', 'phone'] });
    const malformed = {
      ...contract,
      release: {
        ...contract.release,
        readiness: {
          peek: contract.release.readiness.peek,
          train: contract.release.readiness.train,
          phone: undefined,
          story: contract.release.readiness.story,
        },
      },
    } as unknown as CommunicationIntegrationContract;

    await act(async () => root?.render(<App communication={malformed} />));

    expect(window.location.hash).toBe('#/');
    expect(homeDomains(container)).toHaveLength(8);
    expect(homeDomains(container).at(-1)).toBe('communication');
    expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();

    const shelfPortal = container.querySelector<HTMLButtonElement>(
      '[data-domain="communication"] .portal-card',
    )!;
    await act(async () => {
      shelfPortal.click();
      window.dispatchEvent(new Event('hashchange'));
    });
    expect(window.location.hash).toBe('#/communication');
    expect(shelfDoorIds(container)).toEqual(['peek']);
  });

  it('opens a direct activity route when that activity alone is public', async () => {
    window.history.replaceState(null, '', '#/communication/toy-phone');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['phone'] })} />,
    ));

    expect(window.location.hash).toBe('#/communication/toy-phone');
    expect(container.querySelector('[data-mounted-communication-game="phone"]')).not.toBeNull();
  });

  it('opens the production Train route through the communication host', async () => {
    window.history.replaceState(null, '', '#/communication/word-train');
    await act(async () => root?.render(<App />));

    expect(window.location.hash).toBe('#/communication/word-train');
    expect(container.textContent).toContain('רכבת המילים');
    expect(container.textContent).toContain('מחברים קרונות ושומעים מילה שלמה');
    expect(container.textContent).not.toMatch(/הברה|הברות|syllable|fragment|chunk/i);
  });

  it('opens the legacy Train route through the communication host when Train is public', async () => {
    window.history.replaceState(null, '', '#/games/syllableTrain');
    await act(async () => root?.render(<App />));

    expect(container.textContent).toContain('רכבת המילים');
    expect(container.textContent).toContain('מחברים קרונות ושומעים מילה שלמה');
    expect(container.textContent).not.toMatch(/הברה|הברות|syllable|fragment|chunk/i);
  });

  it('does not resurrect a normalized activity deep link after that activity becomes public', async () => {
    window.history.replaceState(null, '', '#/communication/story-that-waits');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek'] })} />,
    ));
    expect(window.location.hash).toBe('#/');

    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek', 'story'] })} />,
    ));

    expect(window.location.hash).toBe('#/');
    expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();
  });

  it('normalizes consecutive malformed and unavailable communication hashes', async () => {
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek'] })} />,
    ));

    for (const hash of [
      '#/communication/unknown-one',
      '#/communication/story-that-waits',
      '#/communication/toy-phone?mode=child',
    ]) {
      await act(async () => {
        window.history.replaceState(null, '', hash);
        window.dispatchEvent(new Event('hashchange'));
      });

      expect(window.location.hash).toBe('#/');
      expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
    }
  });

  it('fails production disabled and malformed communication routes closed without media side effects', async () => {
    const cancelAll = vi.spyOn(speechService, 'cancelAll');
    const unlock = vi.spyOn(speechService, 'unlock');
    await act(async () => root?.render(<App />));

    for (const hash of [
      '#/communication/toy-phone',
      '#/communication/unknown-one',
      '#/communication/peek-and-discover?mode=child',
    ]) {
      await act(async () => {
        window.history.replaceState(null, '', hash);
        window.dispatchEvent(new Event('hashchange'));
      });
      expect(window.location.hash).toBe('#/');
      expect(container.querySelector('[data-domain="communication"]')).not.toBeNull();
      expect(container.querySelector('[data-mounted-communication-game]')).toBeNull();
    }
    expect(cancelAll).not.toHaveBeenCalled();
    expect(unlock).not.toHaveBeenCalled();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('allows valid shelf navigation after an unavailable route was normalized', async () => {
    window.history.replaceState(null, '', '#/communication/story-that-waits');
    await act(async () => root?.render(
      <App communication={readyIntegration({ enabledActivityIds: ['peek'] })} />,
    ));

    const shelfPortal = container.querySelector<HTMLButtonElement>(
      '[data-domain="communication"] .portal-card',
    )!;
    await act(async () => {
      shelfPortal.click();
      window.dispatchEvent(new Event('hashchange'));
    });

    expect(window.location.hash).toBe('#/communication');
    expect(shelfDoorIds(container)).toEqual(['peek']);
  });
});
