import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FamilyPhotoStorageError,
  listFamilyPhotos,
  type StoredFamilyPhoto,
} from '../services/familyPhotoStorage';
import { subscribeFamilyPhotoLibraryChanges } from '../services/familyPhotoLibraryEvents';

export interface FamilyPhotoPreview extends StoredFamilyPhoto {
  objectUrl: string;
}

interface FamilyPhotoPreviewState {
  loading: boolean;
  previews: FamilyPhotoPreview[];
  error: FamilyPhotoStorageError | null;
}

function normalizeReadError(error: unknown): FamilyPhotoStorageError {
  if (error instanceof FamilyPhotoStorageError) {
    return error;
  }
  return new FamilyPhotoStorageError(
    'read-failed',
    'The local photo library could not be read.',
    { cause: error },
  );
}

export function useFamilyPhotoPreviews(): FamilyPhotoPreviewState & { reload: () => void } {
  const [reloadKey, setReloadKey] = useState(0);
  const [state, setState] = useState<FamilyPhotoPreviewState>({
    loading: true,
    previews: [],
    error: null,
  });
  const generationRef = useRef(0);
  const objectUrlsRef = useRef(new Map<string, string>());

  const reload = useCallback(() => setReloadKey((current) => current + 1), []);

  const removePreview = useCallback((id: string): void => {
    generationRef.current += 1;
    const objectUrl = objectUrlsRef.current.get(id);
    if (objectUrl) {
      objectUrlsRef.current.delete(id);
      URL.revokeObjectURL(objectUrl);
    }
    setState((current) => ({
      ...current,
      previews: current.previews.filter((preview) => preview.id !== id),
    }));
  }, []);

  const clearPreviews = useCallback((): void => {
    generationRef.current += 1;
    objectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    objectUrlsRef.current.clear();
    setState((current) => ({ ...current, previews: [] }));
  }, []);

  useEffect(() => {
    const generation = generationRef.current + 1;
    generationRef.current = generation;
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    void listFamilyPhotos()
      .then((photos) => {
        if (!active || generationRef.current !== generation) {
          return;
        }

        const nextPreviews: FamilyPhotoPreview[] = [];
        const createdObjectUrls: string[] = [];
        try {
          photos.forEach((photo) => {
            const existingObjectUrl = objectUrlsRef.current.get(photo.id);
            const objectUrl = existingObjectUrl ?? URL.createObjectURL(photo.blob);
            if (!existingObjectUrl) {
              createdObjectUrls.push(objectUrl);
            }
            nextPreviews.push({
              ...photo,
              objectUrl,
            });
          });
        } catch (error) {
          createdObjectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
          throw new FamilyPhotoStorageError(
            'read-failed',
            'The local photo previews could not be prepared.',
            { cause: error },
          );
        }

        const previousUrls = objectUrlsRef.current;
        objectUrlsRef.current = new Map(
          nextPreviews.map((preview) => [preview.id, preview.objectUrl]),
        );
        setState({ loading: false, previews: nextPreviews, error: null });
        previousUrls.forEach((url, id) => {
          if (objectUrlsRef.current.get(id) !== url) {
            URL.revokeObjectURL(url);
          }
        });
      })
      .catch((error: unknown) => {
        if (!active || generationRef.current !== generation) {
          return;
        }
        objectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
        objectUrlsRef.current.clear();
        setState({
          loading: false,
          previews: [],
          error: normalizeReadError(error),
        });
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  useEffect(() => subscribeFamilyPhotoLibraryChanges((change) => {
    if (change.kind === 'deleted') {
      removePreview(change.id);
    } else if (change.kind === 'cleared') {
      clearPreviews();
    }
    reload();
  }), [clearPreviews, reload, removePreview]);

  useEffect(() => () => {
    generationRef.current += 1;
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current.clear();
  }, []);

  return { ...state, reload };
}
