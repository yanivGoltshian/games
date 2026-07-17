import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FAMILY_PHOTO_DB_NAME,
  FAMILY_PHOTO_DB_VERSION,
  FAMILY_PHOTO_LIBRARY_LIMIT,
  addFamilyPhoto,
  closeFamilyPhotoDatabase,
  deleteAllFamilyPhotos,
  deleteFamilyPhoto,
  getFamilyPhoto,
  listFamilyPhotos,
} from './familyPhotoStorage';

function photoBlob(value: string): Blob {
  return new Blob([value], { type: 'image/jpeg' });
}

describe('familyPhotoStorage', () => {
  beforeEach(async () => {
    await closeFamilyPhotoDatabase();
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(async () => {
    await closeFamilyPhotoDatabase();
    vi.unstubAllGlobals();
  });

  it('creates the versioned schema and stores only converted photo data', async () => {
    const stored = await addFamilyPhoto({
      blob: photoBlob('pixels-only'),
      width: 1200,
      height: 800,
      createdAt: 10,
      label: '  Family day  ',
    });

    expect(stored.id).toMatch(/^family-photo-[a-f0-9]{64}$/);
    expect(stored).toMatchObject({
      createdAt: 10,
      label: 'Family day',
      width: 1200,
      height: 800,
      mimeType: 'image/jpeg',
    });
    expect(stored).not.toHaveProperty('fileName');
    expect(stored).not.toHaveProperty('sourceType');

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(FAMILY_PHOTO_DB_NAME, FAMILY_PHOTO_DB_VERSION);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    expect(database.version).toBe(FAMILY_PHOTO_DB_VERSION);
    expect([...database.objectStoreNames]).toEqual(['photos']);
    const transaction = database.transaction('photos', 'readonly');
    expect([...transaction.objectStore('photos').indexNames]).toEqual(['createdAt']);
    database.close();
  });

  it('uses deterministic content ids and rejects duplicate converted images', async () => {
    const first = await addFamilyPhoto({
      blob: photoBlob('same-pixels'),
      width: 10,
      height: 10,
      createdAt: 1,
    });

    await expect(addFamilyPhoto({
      blob: photoBlob('same-pixels'),
      width: 10,
      height: 10,
      createdAt: 2,
    })).rejects.toMatchObject({ code: 'duplicate' });

    expect((await listFamilyPhotos()).map((photo) => photo.id)).toEqual([first.id]);
  });

  it('lists newest first and supports get, delete-one, and delete-all semantics', async () => {
    const older = await addFamilyPhoto({
      blob: photoBlob('older'),
      width: 20,
      height: 10,
      createdAt: 10,
    });
    const newer = await addFamilyPhoto({
      blob: photoBlob('newer'),
      width: 30,
      height: 20,
      createdAt: 20,
    });

    expect((await listFamilyPhotos()).map((photo) => photo.id)).toEqual([newer.id, older.id]);
    expect(await getFamilyPhoto(older.id)).toMatchObject({ id: older.id, createdAt: 10 });
    expect(await deleteFamilyPhoto('missing')).toBe(false);
    expect(await deleteFamilyPhoto(older.id)).toBe(true);
    expect(await getFamilyPhoto(older.id)).toBeNull();
    expect(await deleteAllFamilyPhotos()).toBe(1);
    expect(await deleteAllFamilyPhotos()).toBe(0);
    expect(await listFamilyPhotos()).toEqual([]);
  });

  it('enforces the bounded local library count', async () => {
    for (let index = 0; index < FAMILY_PHOTO_LIBRARY_LIMIT; index += 1) {
      await addFamilyPhoto({
        blob: photoBlob(`photo-${index}`),
        width: 100,
        height: 100,
        createdAt: index,
      });
    }

    await expect(addFamilyPhoto({
      blob: photoBlob('one-too-many'),
      width: 100,
      height: 100,
    })).rejects.toMatchObject({ code: 'library-full' });
    expect(await listFamilyPhotos()).toHaveLength(FAMILY_PHOTO_LIBRARY_LIMIT);
  });

  it('surfaces database-open failures instead of falling back to another store', async () => {
    await closeFamilyPhotoDatabase();
    vi.stubGlobal('indexedDB', {
      open: () => {
        throw new DOMException('blocked', 'VersionError');
      },
    });

    await expect(listFamilyPhotos()).rejects.toMatchObject({
      code: 'upgrade-failed',
    });
  });
});
