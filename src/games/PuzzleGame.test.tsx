// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress } from '../domain/progression';
import type { PuzzleRound } from '../domain/types';
import type { FamilyPhotoPreview } from '../components/useFamilyPhotoPreviews';
import { PuzzleGame } from './PuzzleGame';

const doubles = vi.hoisted(() => ({
  familyPhotos: [] as FamilyPhotoPreview[],
  familyPhotosLoading: false,
  familyPhotosError: null as Error | null,
  speakSegments: vi.fn(),
  startNextRound: vi.fn(),
}));

const builtInRound: PuzzleRound = {
  scene: {
    id: 'built-in-test',
    titleHe: 'פאזל מובנה',
    titleHeSpoken: 'פאזל מובנה',
    titleEn: 'built-in puzzle',
    promptHe: 'נחבר פאזל מובנה',
    promptHeSpoken: 'נחבר פאזל מובנה',
    promptEn: 'Build the built-in puzzle',
    image: { kind: 'original' },
  },
  rows: 1,
  cols: 2,
  pieces: [
    { id: 'built-in-0', row: 0, col: 0 },
    { id: 'built-in-1', row: 0, col: 1 },
  ],
  promptHe: 'נחבר פאזל מובנה',
  promptEn: 'Build the built-in puzzle',
};

vi.mock('../components/useFamilyPhotoPreviews', () => ({
  useFamilyPhotoPreviews: () => ({
    previews: doubles.familyPhotos,
    loading: doubles.familyPhotosLoading,
    error: doubles.familyPhotosError,
    reload: vi.fn(),
  }),
}));

vi.mock('../components/useMeasuredSize', () => ({
  useMeasuredSize: () => ({ width: 360, height: 520 }),
}));

vi.mock('../components/drag/useToddlerDrag', () => ({
  useToddlerDrag: () => ({
    bindItem: () => ({}),
    bindZone: () => ({}),
    selectedId: null,
    draggingId: null,
    hoverZoneId: null,
    wigglingId: null,
  }),
}));

vi.mock('../components/puzzle/PuzzlePieceArt', () => ({
  PuzzlePieceArt: ({ scene }: { scene: PuzzleRound['scene'] }) => (
    <span data-testid="puzzle-art" data-image-kind={scene.image.kind}>
      {scene.image.kind === 'family' ? scene.image.href : scene.id}
    </span>
  ),
}));

vi.mock('../art/puzzleScenes', () => ({
  sceneImageHref: () => 'data:image/svg+xml,built-in',
}));

vi.mock('../services/sound', () => ({
  soundService: {
    playSuccess: vi.fn(),
  },
}));

vi.mock('../services/speech', () => ({
  buildPhraseSegments: (hebrew: string) => [{ text: hebrew, locale: 'he-IL' }],
  speechService: {
    speakSegments: doubles.speakSegments,
    supersedeRetry: vi.fn(),
  },
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: () => ({
    round: builtInRound,
    roundKey: 1,
    startNextRound: doubles.startNextRound,
  }),
}));

vi.mock('./useRetryFeedback', () => ({
  useRetryFeedback: () => ({
    retryBusy: false,
    runRetry: vi.fn(),
  }),
}));

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: () => <div data-testid="success-overlay" />,
}));

function familyPreview(): FamilyPhotoPreview {
  return {
    id: 'family-photo-test',
    createdAt: 1,
    width: 1600,
    height: 1200,
    mimeType: 'image/jpeg',
    byteSize: 4,
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
    objectUrl: 'blob:family-photo-test',
  };
}

describe('PuzzleGame family photos', () => {
  let container: HTMLDivElement;
  let root: Root;
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
    doubles.familyPhotos = [];
    doubles.familyPhotosLoading = false;
    doubles.familyPhotosError = null;
    doubles.speakSegments.mockReset();
    doubles.speakSegments.mockResolvedValue({ status: 'completed' });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderGame(): Promise<void> {
    const progress = createInitialProgress(false, 1);
    await act(async () => {
      root.render(
        <PuzzleGame
          domainProgress={progress.domains.puzzle}
          mediaReady
          onBack={() => undefined}
          onCompleteRound={() => ({
            starsEarned: 1,
            leveledUp: false,
            milestone: false,
            level: 1,
            mastery: 0,
            firstAttempt: true,
            recommendation: null,
          })}
          overallStars={0}
          settings={progress.settings}
          speechStatus={{
            supported: true,
            voiceAvailable: true,
            speaking: false,
            activeRequestId: null,
            activeCue: null,
          }}
        />,
      );
    });
  }

  it('keeps the built-in puzzle behavior when no local photos exist', async () => {
    await renderGame();

    expect(container.querySelector('[data-family-photo-choice]')).toBeNull();
    expect(container.querySelector('.puzzle-surface')).not.toBeNull();
    expect(container.querySelector('[data-image-kind="original"]')).not.toBeNull();
  });

  it('shows large private choices only when local photos exist and starts the selected puzzle', async () => {
    doubles.familyPhotos = [familyPreview()];
    await renderGame();

    const choice = container.querySelector<HTMLButtonElement>('[data-family-photo-choice]')!;
    expect(choice).not.toBeNull();
    expect(container.querySelector('[data-puzzle-source="built-in"]')).not.toBeNull();
    await act(async () => choice.click());

    expect(container.querySelector('.puzzle-surface')).not.toBeNull();
    expect(container.querySelector('[data-image-kind="family"]')?.textContent)
      .toBe('blob:family-photo-test');
    expect(doubles.speakSegments).toHaveBeenCalledWith(
      [{ text: 'בוא נמשיך.', locale: 'he-IL' }],
      progressSettings(),
      expect.objectContaining({ scope: 'game:puzzle' }),
    );
  });

  it('preserves the built-in choice alongside local photos', async () => {
    doubles.familyPhotos = [familyPreview()];
    await renderGame();
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[data-puzzle-source="built-in"]',
    )!.click());

    expect(container.querySelector('[data-image-kind="original"]')).not.toBeNull();
    expect(container.querySelector('[data-image-kind="family"]')).toBeNull();
  });
});

function progressSettings() {
  return createInitialProgress(false, 1).settings;
}
