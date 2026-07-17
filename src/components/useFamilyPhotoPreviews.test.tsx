// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredFamilyPhoto } from '../services/familyPhotoStorage';
import { useFamilyPhotoPreviews, type FamilyPhotoPreview } from './useFamilyPhotoPreviews';

const doubles = vi.hoisted(() => ({
  listFamilyPhotos: vi.fn(),
  libraryChangeListener: null as ((change:
    | { kind: 'added'; ids: string[] }
    | { kind: 'deleted'; id: string }
    | { kind: 'cleared' }
  ) => void) | null,
  unsubscribe: vi.fn(),
}));

vi.mock('../services/familyPhotoStorage', () => {
  class FamilyPhotoStorageError extends Error {
    readonly code: string;

    constructor(code: string, message: string, options?: ErrorOptions) {
      super(message, options);
      this.code = code;
    }
  }
  return {
    FamilyPhotoStorageError,
    listFamilyPhotos: doubles.listFamilyPhotos,
  };
});

vi.mock('../services/familyPhotoLibraryEvents', () => ({
  subscribeFamilyPhotoLibraryChanges: (
    listener: NonNullable<typeof doubles.libraryChangeListener>,
  ) => {
    doubles.libraryChangeListener = listener;
    return doubles.unsubscribe;
  },
}));

function storedPhoto(id: string): StoredFamilyPhoto {
  return {
    id,
    createdAt: 1,
    width: 100,
    height: 100,
    mimeType: 'image/jpeg',
    byteSize: 4,
    blob: new Blob([id], { type: 'image/jpeg' }),
  };
}

function Harness({ onChange }: { onChange: (previews: FamilyPhotoPreview[], reload: () => void) => void }) {
  const { previews, reload } = useFamilyPhotoPreviews();
  useEffect(() => {
    onChange(previews, reload);
  }, [onChange, previews, reload]);
  return null;
}

describe('useFamilyPhotoPreviews', () => {
  let container: HTMLDivElement;
  let root: Root;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
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
    createObjectURL = vi.fn((blob: Blob) => `blob:preview-${blob.size}-${createObjectURL.mock.calls.length}`);
    revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
    doubles.listFamilyPhotos.mockReset();
    doubles.libraryChangeListener = null;
    doubles.unsubscribe.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: undefined });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: undefined });
  });

  it('revokes replaced object URLs and all remaining URLs on unmount', async () => {
    doubles.listFamilyPhotos
      .mockResolvedValueOnce([storedPhoto('one')])
      .mockResolvedValueOnce([storedPhoto('two')]);
    let reload: () => void = () => undefined;
    const onChange = vi.fn((previews: FamilyPhotoPreview[], nextReload: () => void) => {
      reload = nextReload;
      return previews;
    });

    await act(async () => {
      root.render(<Harness onChange={onChange} />);
    });
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    await act(async () => reload());
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-3-1');

    await act(async () => root.unmount());
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-3-2');
    root = createRoot(container);
  });

  it('reuses object URLs for unchanged records during an event reload', async () => {
    doubles.listFamilyPhotos
      .mockResolvedValueOnce([storedPhoto('one')])
      .mockResolvedValueOnce([storedPhoto('one'), storedPhoto('two')]);
    const onChange = vi.fn();

    await act(async () => root.render(<Harness onChange={onChange} />));
    await act(async () => doubles.libraryChangeListener?.({
      kind: 'added',
      ids: ['two'],
    }));

    expect(doubles.listFamilyPhotos).toHaveBeenCalledTimes(2);
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it('does not create URLs or set preview state after navigation unmounts a pending load', async () => {
    let resolveLoad: (photos: StoredFamilyPhoto[]) => void = () => undefined;
    doubles.listFamilyPhotos.mockReturnValue(new Promise<StoredFamilyPhoto[]>((resolve) => {
      resolveLoad = resolve;
    }));
    const onChange = vi.fn();

    await act(async () => {
      root.render(<Harness onChange={onChange} />);
    });
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => resolveLoad([storedPhoto('late')]));

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it.each([
    [{ kind: 'deleted', id: 'one' } as const, 'blob:preview-3-1'],
    [{ kind: 'cleared' } as const, 'blob:preview-3-1'],
  ])('revokes sensitive previews immediately for a %s event', async (change, expectedUrl) => {
    doubles.listFamilyPhotos
      .mockResolvedValueOnce([storedPhoto('one')])
      .mockReturnValueOnce(new Promise<StoredFamilyPhoto[]>(() => undefined));
    let latestPreviews: FamilyPhotoPreview[] = [];
    const onChange = vi.fn((previews: FamilyPhotoPreview[]) => {
      latestPreviews = previews;
    });

    await act(async () => root.render(<Harness onChange={onChange} />));
    expect(latestPreviews).toHaveLength(1);

    await act(async () => doubles.libraryChangeListener?.(change));

    expect(latestPreviews).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenCalledWith(expectedUrl);
    expect(doubles.listFamilyPhotos).toHaveBeenCalledTimes(2);
  });

  it('revokes and clears existing previews when a reload fails', async () => {
    doubles.listFamilyPhotos
      .mockResolvedValueOnce([storedPhoto('one')])
      .mockRejectedValueOnce(new Error('synthetic read failure'));
    let reload: () => void = () => undefined;
    let latestPreviews: FamilyPhotoPreview[] = [];
    const onChange = vi.fn((previews: FamilyPhotoPreview[], nextReload: () => void) => {
      latestPreviews = previews;
      reload = nextReload;
    });

    await act(async () => root.render(<Harness onChange={onChange} />));
    expect(latestPreviews).toHaveLength(1);

    await act(async () => reload());

    expect(latestPreviews).toHaveLength(0);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:preview-3-1');
  });
});
