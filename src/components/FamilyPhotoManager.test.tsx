// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FamilyPhotoConversionError } from '../services/familyPhotoConversion';
import { FamilyPhotoStorageError } from '../services/familyPhotoStorage';
import type { FamilyPhotoPreview } from './useFamilyPhotoPreviews';
import { FamilyPhotoManager } from './FamilyPhotoManager';

const doubles = vi.hoisted(() => ({
  convertFamilyPhoto: vi.fn(),
  addFamilyPhoto: vi.fn(),
  deleteFamilyPhoto: vi.fn(),
  deleteAllFamilyPhotos: vi.fn(),
  reload: vi.fn(),
  previewState: {
    previews: [] as FamilyPhotoPreview[],
    loading: false,
    error: null,
  },
}));

vi.mock('../services/familyPhotoConversion', () => {
  class FamilyPhotoConversionError extends Error {
    readonly code: string;

    constructor(code: string, message: string, options?: ErrorOptions) {
      super(message, options);
      this.code = code;
    }
  }
  return {
    FamilyPhotoConversionError,
    convertFamilyPhoto: doubles.convertFamilyPhoto,
  };
});

vi.mock('../services/familyPhotoStorage', () => {
  class FamilyPhotoStorageError extends Error {
    readonly code: string;

    constructor(code: string, message: string, options?: ErrorOptions) {
      super(message, options);
      this.code = code;
    }
  }
  return {
    FAMILY_PHOTO_LIBRARY_LIMIT: 24,
    FamilyPhotoStorageError,
    addFamilyPhoto: doubles.addFamilyPhoto,
    deleteFamilyPhoto: doubles.deleteFamilyPhoto,
    deleteAllFamilyPhotos: doubles.deleteAllFamilyPhotos,
  };
});

vi.mock('./useFamilyPhotoPreviews', () => ({
  useFamilyPhotoPreviews: () => ({
    ...doubles.previewState,
    reload: doubles.reload,
  }),
}));

function preview(id = 'family-photo-test'): FamilyPhotoPreview {
  return {
    id,
    createdAt: 1,
    width: 100,
    height: 100,
    mimeType: 'image/jpeg',
    byteSize: 4,
    blob: new Blob(['jpeg'], { type: 'image/jpeg' }),
    objectUrl: `blob:${id}`,
  };
}

describe('FamilyPhotoManager', () => {
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
    doubles.previewState.previews = [];
    doubles.previewState.loading = false;
    doubles.previewState.error = null;
    doubles.convertFamilyPhoto.mockReset();
    doubles.addFamilyPhoto.mockReset();
    doubles.deleteFamilyPhoto.mockReset();
    doubles.deleteAllFamilyPhotos.mockReset();
    doubles.reload.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows an adult-only local privacy action and bounded count', async () => {
    await act(async () => root.render(<FamilyPhotoManager />));

    expect(container.textContent).toContain('פעולה למבוגרים בלבד');
    expect(container.textContent).toContain('שום תמונה אינה נשלחת');
    expect(container.textContent).toContain('0/24');
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    expect(input.accept).toContain('image/*');
    expect(input.multiple).toBe(true);
  });

  it('converts a synthetic source before storing only the converted blob', async () => {
    const convertedBlob = new Blob(['private-pixels'], { type: 'image/jpeg' });
    doubles.convertFamilyPhoto.mockResolvedValue({
      blob: convertedBlob,
      width: 1600,
      height: 1200,
      mimeType: 'image/jpeg',
    });
    doubles.addFamilyPhoto.mockResolvedValue(preview());
    await act(async () => root.render(<FamilyPhotoManager />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const source = new File(['source-with-metadata'], 'synthetic.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', { configurable: true, value: [source] });

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(doubles.convertFamilyPhoto).toHaveBeenCalledWith(source);
    expect(doubles.addFamilyPhoto).toHaveBeenCalledWith({
      blob: convertedBlob,
      width: 1600,
      height: 1200,
    });
    expect(doubles.reload).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('רק במכשיר הזה');
  });

  it('surfaces conversion failures without attempting storage', async () => {
    doubles.convertFamilyPhoto.mockRejectedValue(new FamilyPhotoConversionError(
      'decode-failed',
      'synthetic failure',
    ));
    await act(async () => root.render(<FamilyPhotoManager />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })],
    });

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(doubles.addFamilyPhoto).not.toHaveBeenCalled();
    expect(container.textContent).toContain('לא הצלחנו לפתוח את התמונה');
  });

  it.each([
    ['duplicate', 'כבר נמצאת בספרייה'],
    ['quota-exceeded', 'אין מספיק מקום פנוי'],
    ['write-interrupted', 'הופסקה לפני שהסתיימה'],
  ] as const)('surfaces %s storage failures', async (code, expectedMessage) => {
    doubles.convertFamilyPhoto.mockResolvedValue({
      blob: new Blob(['private-pixels'], { type: 'image/jpeg' }),
      width: 100,
      height: 100,
      mimeType: 'image/jpeg',
    });
    doubles.addFamilyPhoto.mockRejectedValue(new FamilyPhotoStorageError(code, 'synthetic failure'));
    await act(async () => root.render(<FamilyPhotoManager />));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['source'], 'synthetic.jpg', { type: 'image/jpeg' })],
    });

    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));

    expect(container.textContent).toContain(expectedMessage);
    expect(doubles.reload).not.toHaveBeenCalled();
  });

  it('requires confirmation for delete-one and delete-all', async () => {
    doubles.previewState.previews = [preview()];
    doubles.deleteFamilyPhoto.mockResolvedValue(true);
    doubles.deleteAllFamilyPhotos.mockResolvedValue(1);
    await act(async () => root.render(<FamilyPhotoManager />));

    const deleteOne = container.querySelector<HTMLButtonElement>(
      'button[aria-label="מחיקת תמונה משפחתית מקומית 1"]',
    )!;
    await act(async () => deleteOne.click());
    expect(doubles.deleteFamilyPhoto).not.toHaveBeenCalled();
    await act(async () => container.querySelector<HTMLButtonElement>(
      'button[aria-label="אישור מחיקת תמונה 1"]',
    )!.click());
    expect(doubles.deleteFamilyPhoto).toHaveBeenCalledWith('family-photo-test');

    const deleteAll = [...container.querySelectorAll('button')]
      .find((button) => button.textContent === 'מחיקת כל התמונות')!;
    await act(async () => deleteAll.click());
    expect(doubles.deleteAllFamilyPhotos).not.toHaveBeenCalled();
    await act(async () => [...container.querySelectorAll('button')]
      .find((button) => button.textContent === 'כן, למחוק הכול')!.click());
    expect(doubles.deleteAllFamilyPhotos).toHaveBeenCalledOnce();
  });

  it('surfaces deletion failures and keeps the preview visible', async () => {
    doubles.previewState.previews = [preview()];
    doubles.deleteFamilyPhoto.mockRejectedValue(new FamilyPhotoStorageError(
      'delete-failed',
      'synthetic deletion failure',
    ));
    await act(async () => root.render(<FamilyPhotoManager />));
    await act(async () => container.querySelector<HTMLButtonElement>(
      'button[aria-label="מחיקת תמונה משפחתית מקומית 1"]',
    )!.click());
    await act(async () => container.querySelector<HTMLButtonElement>(
      'button[aria-label="אישור מחיקת תמונה 1"]',
    )!.click());

    expect(container.textContent).toContain('מחיקת התמונה המקומית נכשלה');
    expect(container.querySelector('[data-photo-id="family-photo-test"]')).not.toBeNull();
    expect(doubles.reload).not.toHaveBeenCalled();
  });
});
