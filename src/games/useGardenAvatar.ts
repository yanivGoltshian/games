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
    const unsubscribe = subscribeFamilyPhotoLibraryChanges((change) => {
      if (change.kind === 'cleared' || (change.kind === 'deleted' && change.id === photoId)) {
        deleted = true;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = undefined;
        setAvatar(null);
      }
    });
    void getFamilyPhoto(photoId).then((photo) => {
      if (!active || deleted || !photo) return;
      objectUrl = URL.createObjectURL(photo.blob);
      setAvatar({ id: photoId, url: objectUrl });
    }).catch(() => { if (active) setAvatar(null); });
    return () => {
      active = false;
      unsubscribe();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoId]);
  return photoId && avatar?.id === photoId ? avatar.url : null;
}
