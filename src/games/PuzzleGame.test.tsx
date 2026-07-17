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
  cancelScope: vi.fn(),
  startNextRound: vi.fn(),
  adaptiveLevel: 0,
  onDrop: null as null | ((itemId: string, zoneId: string) => boolean),
}));

const builtInRounds = new Map<1 | 2 | 3, PuzzleRound>(
  ([1, 2, 3] as const).map((level) => {
    const [rows, cols] = level === 1 ? [1, 2] : level === 2 ? [2, 2] : [3, 3];
    return [level, {
      scene: {
        id: `built-in-test-${level}`,
        titleHe: 'פאזל מובנה',
        titleHeSpoken: 'פאזל מובנה',
        titleEn: 'built-in puzzle',
        promptHe: 'נחבר פאזל מובנה',
        promptHeSpoken: 'נחבר פאזל מובנה',
        promptEn: 'Build the built-in puzzle',
        image: { kind: 'original' },
      },
      rows,
      cols,
      pieces: Array.from({ length: rows * cols }, (_, index) => ({
        id: `built-in-${level}-${index}`,
        row: Math.floor(index / cols),
        col: index % cols,
      })),
      promptHe: 'נחבר פאזל מובנה',
      promptEn: 'Build the built-in puzzle',
    }];
  }),
);

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
  useToddlerDrag: (options: { onDrop: (itemId: string, zoneId: string) => boolean }) => {
    doubles.onDrop = options.onDrop;
    return {
    bindItem: () => ({}),
    bindZone: () => ({}),
    selectedId: null,
    draggingId: null,
    hoverZoneId: null,
    wigglingId: null,
    };
  },
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
    cancelScope: doubles.cancelScope,
    supersedeRetry: vi.fn(),
  },
}));

vi.mock('./useAdaptiveRound', () => ({
  useAdaptiveRound: (_domain: string, progress: { level: 1 | 2 | 3 }) => {
    doubles.adaptiveLevel = progress.level;
    return {
    round: builtInRounds.get(progress.level)!,
    roundKey: 1,
    startNextRound: doubles.startNextRound,
    };
  },
}));

vi.mock('./useRetryFeedback', () => ({
  useRetryFeedback: () => ({
    retryBusy: false,
    runRetry: vi.fn(),
  }),
}));

vi.mock('./RoundSuccessOverlay', () => ({
  RoundSuccessOverlay: ({
    onDismiss,
    startNextRound,
  }: {
    onDismiss: () => void;
    startNextRound: () => void;
  }) => (
    <button
      data-testid="success-overlay"
      onClick={() => {
        onDismiss();
        startNextRound();
      }}
      type="button"
    >
      Next
    </button>
  ),
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
    doubles.cancelScope.mockReset();
    doubles.startNextRound.mockReset();
    doubles.adaptiveLevel = 0;
    doubles.onDrop = null;
    doubles.speakSegments.mockResolvedValue({ status: 'completed' });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderGame(persistedLevel: 1 | 2 | 3 = 1): Promise<void> {
    const progress = createInitialProgress(false, 1);
    progress.domains.puzzle.level = persistedLevel;
    progress.domains.puzzle.highestLevel = persistedLevel;
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

  it('always starts at two pieces even when persisted mastery reached level three', async () => {
    await renderGame(3);

    expect(doubles.adaptiveLevel).toBe(1);
    expect(container.querySelectorAll('.puzzle-piece')).toHaveLength(2);
  });

  it('advances after one success from two to four to nine pieces', async () => {
    await renderGame(3);

    await solveVisiblePuzzle(['built-in-1-0', 'built-in-1-1']);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-overlay"]')!.click();
    });
    expect(doubles.startNextRound).toHaveBeenLastCalledWith(expect.objectContaining({ level: 2 }));
    expect(container.querySelectorAll('.puzzle-piece')).toHaveLength(4);

    await solveVisiblePuzzle([
      'built-in-2-0',
      'built-in-2-1',
      'built-in-2-2',
      'built-in-2-3',
    ]);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-overlay"]')!.click();
    });
    expect(doubles.startNextRound).toHaveBeenLastCalledWith(expect.objectContaining({ level: 3 }));
    expect(container.querySelectorAll('.puzzle-piece')).toHaveLength(9);
  });

  it('starts a fresh puzzle at the current session level from the circular arrow', async () => {
    await renderGame(3);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('.rail-button--restart')!.click();
    });

    expect(doubles.cancelScope).toHaveBeenCalledWith('game:puzzle');
    expect(doubles.startNextRound).toHaveBeenCalledWith(expect.objectContaining({ level: 1 }));
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

  it('clears placed family-photo pieces before advancing to the next level', async () => {
    doubles.familyPhotos = [familyPreview()];
    await renderGame(3);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-family-photo-choice]')!.click();
    });

    await solveVisiblePuzzle(['family-photo-piece-0', 'family-photo-piece-1']);
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-overlay"]')!.click();
    });

    const nextPieces = container.querySelectorAll('.puzzle-piece');
    expect(nextPieces).toHaveLength(4);
    expect(container.querySelectorAll('.puzzle-piece.is-placed')).toHaveLength(0);
    await solveVisiblePuzzle([
      'family-photo-piece-0',
      'family-photo-piece-1',
      'family-photo-piece-2',
      'family-photo-piece-3',
    ]);
  });

  it('preserves the built-in choice alongside local photos', async () => {
    doubles.familyPhotos = [familyPreview()];
    await renderGame();
    await act(async () => container.querySelector<HTMLButtonElement>(
      '[data-puzzle-source="built-in"]',
    )!.click());

    expect(container.querySelector('[data-image-kind="original"]')).not.toBeNull();
    expect(container.querySelector('[data-image-kind="family"]')).toBeNull();
    expect(doubles.startNextRound).toHaveBeenCalledWith(expect.objectContaining({ level: 1 }));
  });

  async function solveVisiblePuzzle(pieceIds: string[]): Promise<void> {
    for (const pieceId of pieceIds) {
      await act(async () => {
        expect(doubles.onDrop?.(pieceId, pieceId)).toBe(true);
      });
    }
    expect(container.querySelector('[data-testid="success-overlay"]')).not.toBeNull();
  }
});

function progressSettings() {
  return createInitialProgress(false, 1).settings;
}
