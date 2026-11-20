import { useEffect, useState } from 'react';
import { getFamilyPhoto } from '../services/familyPhotoStorage';
import { subscribeFamilyPhotoLibraryChanges } from '../services/familyPhotoLibraryEvents';

export function useGardenAvatar(photoId: string | null | undefined): string | null {
  const [avatar, setAvatar] = useState<{ id: string; url: string } | null>(null);
  useEffect(() => {
    if (!photoId) return;
    let active = true;
    let deleted = false;
    let objectUrl: string | undefined;
    const releaseUrl = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = undefined;
    };
    const unsubscribe = subscribeFamilyPhotoLibraryChanges((change) => {
      if (change.kind === 'cleared' || (change.kind === 'deleted' && change.id === photoId)) {
        deleted = true;
        releaseUrl();
        setAvatar(null);
      }
    });
    void getFamilyPhoto(photoId).then(async (photo) => {
      if (!active || deleted || !photo) return;
      const url = URL.createObjectURL(photo.blob);
      objectUrl = url;
      const picture = new Image();
      picture.src = url;
      await picture.decode();
      if (active && !deleted) setAvatar({ id: photoId, url });
    }).catch(() => {
      releaseUrl();
    });
    return () => {
      active = false;
      unsubscribe();
      releaseUrl();
    };
  }, [photoId]);
  return photoId && avatar?.id === photoId ? avatar.url : null;
}
