import { publishFamilyPhotoLibraryChange } from './familyPhotoLibraryEvents';

export const FAMILY_PHOTO_DB_NAME = 'sean-family-photo-library';
export const FAMILY_PHOTO_DB_VERSION = 1;
export const FAMILY_PHOTO_LIBRARY_LIMIT = 24;

const FAMILY_PHOTO_STORE = 'photos';

export type FamilyPhotoStorageErrorCode =
  | 'unavailable'
  | 'upgrade-failed'
  | 'upgrade-blocked'
  | 'quota-exceeded'
  | 'write-interrupted'
  | 'duplicate'
  | 'library-full'
  | 'read-failed'
  | 'delete-failed';

export class FamilyPhotoStorageError extends Error {
  readonly code: FamilyPhotoStorageErrorCode;

  constructor(code: FamilyPhotoStorageErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FamilyPhotoStorageError';
    this.code = code;
  }
}

export interface StoredFamilyPhoto {
  id: string;
  createdAt: number;
  label?: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
  byteSize: number;
  blob: Blob;
}

export interface AddFamilyPhotoInput {
  blob: Blob;
  width: number;
  height: number;
  createdAt?: number;
  label?: string;
}

export interface AddFamilyPhotoOptions {
  publishChange?: boolean;
}

let databasePromise: Promise<IDBDatabase> | null = null;

function storageError(
  code: FamilyPhotoStorageErrorCode,
  message: string,
  cause?: unknown,
): FamilyPhotoStorageError {
  return new FamilyPhotoStorageError(code, message, cause === undefined ? undefined : { cause });
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw storageError('unavailable', 'IndexedDB is unavailable in this browser.');
  }
  return indexedDB;
}

function mapWriteError(error: DOMException | null): FamilyPhotoStorageError {
  if (error?.name === 'QuotaExceededError') {
    return storageError('quota-exceeded', 'The device does not have enough local storage for this photo.', error);
  }
  return storageError('write-interrupted', 'The local photo write did not complete.', error ?? undefined);
}

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = requireIndexedDb().open(FAMILY_PHOTO_DB_NAME, FAMILY_PHOTO_DB_VERSION);
    } catch (error) {
      reject(storageError('upgrade-failed', 'The local photo database could not be opened.', error));
      return;
    }

    request.onupgradeneeded = () => {
      try {
        const database = request.result;
        if (!database.objectStoreNames.contains(FAMILY_PHOTO_STORE)) {
          const store = database.createObjectStore(FAMILY_PHOTO_STORE, { keyPath: 'id' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      } catch (error) {
        request.transaction?.abort();
        reject(storageError('upgrade-failed', 'The local photo database upgrade failed.', error));
      }
    };
    request.onblocked = () => {
      reject(storageError(
        'upgrade-blocked',
        'Another app window is blocking the local photo database upgrade.',
      ));
    };
    request.onerror = () => {
      reject(storageError('upgrade-failed', 'The local photo database could not be opened.', request.error ?? undefined));
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
  }).catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

function requestResult<T>(
  request: IDBRequest<T>,
  code: 'read-failed' | 'delete-failed',
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(storageError(code, message, request.error ?? undefined));
  });
}

async function digestPhoto(blob: Blob): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw storageError('unavailable', 'Secure local photo identifiers are unavailable in this browser.');
  }
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `family-photo-${hash}`;
}

function normalizedLabel(label: string | undefined): string | undefined {
  const value = label?.trim();
  return value ? value.slice(0, 80) : undefined;
}

export async function listFamilyPhotos(): Promise<StoredFamilyPhoto[]> {
  const database = await openDatabase();
  let request: IDBRequest<StoredFamilyPhoto[]>;
  try {
    request = database
      .transaction(FAMILY_PHOTO_STORE, 'readonly')
      .objectStore(FAMILY_PHOTO_STORE)
      .index('createdAt')
      .getAll();
  } catch (error) {
    throw storageError('read-failed', 'The local photo library could not be read.', error);
  }
  const records = await requestResult(request, 'read-failed', 'The local photo library could not be read.');
  return records.sort((left, right) => right.createdAt - left.createdAt);
}

export async function getFamilyPhoto(id: string): Promise<StoredFamilyPhoto | null> {
  const database = await openDatabase();
  let request: IDBRequest<StoredFamilyPhoto | undefined>;
  try {
    request = database
      .transaction(FAMILY_PHOTO_STORE, 'readonly')
      .objectStore(FAMILY_PHOTO_STORE)
      .get(id);
  } catch (error) {
    throw storageError('read-failed', 'The local photo could not be read.', error);
  }
  return (await requestResult(request, 'read-failed', 'The local photo could not be read.')) ?? null;
}

export async function addFamilyPhoto(
  input: AddFamilyPhotoInput,
  options: AddFamilyPhotoOptions = {},
): Promise<StoredFamilyPhoto> {
  const id = await digestPhoto(input.blob);
  const label = normalizedLabel(input.label);
  const record: StoredFamilyPhoto = {
    id,
    createdAt: input.createdAt ?? Date.now(),
    width: input.width,
    height: input.height,
    mimeType: 'image/jpeg',
    byteSize: input.blob.size,
    blob: input.blob,
    ...(label ? { label } : {}),
  };
  const database = await openDatabase();

  return new Promise<StoredFamilyPhoto>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(FAMILY_PHOTO_STORE, 'readwrite');
    } catch (error) {
      reject(mapWriteError(error instanceof DOMException ? error : null));
      return;
    }

    const store = transaction.objectStore(FAMILY_PHOTO_STORE);
    let operationError: FamilyPhotoStorageError | null = null;
    const existingRequest = store.get(id);
    existingRequest.onerror = () => {
      operationError = storageError('read-failed', 'The photo could not be checked for duplicates.', existingRequest.error ?? undefined);
      transaction.abort();
    };
    existingRequest.onsuccess = () => {
      if (existingRequest.result !== undefined) {
        operationError = storageError('duplicate', 'This photo is already in the local library.');
        transaction.abort();
        return;
      }

      const countRequest = store.count();
      countRequest.onerror = () => {
        operationError = storageError('read-failed', 'The local photo library size could not be checked.', countRequest.error ?? undefined);
        transaction.abort();
      };
      countRequest.onsuccess = () => {
        if (countRequest.result >= FAMILY_PHOTO_LIBRARY_LIMIT) {
          operationError = storageError(
            'library-full',
            `The local photo library is limited to ${FAMILY_PHOTO_LIBRARY_LIMIT} photos.`,
          );
          transaction.abort();
          return;
        }
        store.add(record);
      };
    };
    transaction.oncomplete = () => {
      if (options.publishChange !== false) {
        publishFamilyPhotoLibraryChange({ kind: 'added', ids: [id] });
      }
      resolve(record);
    };
    transaction.onerror = () => {
      if (!operationError) {
        operationError = mapWriteError(transaction.error);
      }
    };
    transaction.onabort = () => reject(operationError ?? mapWriteError(transaction.error));
  });
}

export async function deleteFamilyPhoto(id: string): Promise<boolean> {
  const database = await openDatabase();
  return new Promise<boolean>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(FAMILY_PHOTO_STORE, 'readwrite');
    } catch (error) {
      reject(storageError('delete-failed', 'The local photo could not be deleted.', error));
      return;
    }

    const store = transaction.objectStore(FAMILY_PHOTO_STORE);
    let found = false;
    const getRequest = store.getKey(id);
    getRequest.onerror = () => transaction.abort();
    getRequest.onsuccess = () => {
      found = getRequest.result !== undefined;
      if (found) {
        store.delete(id);
      }
    };
    transaction.oncomplete = () => {
      publishFamilyPhotoLibraryChange({ kind: 'deleted', id });
      resolve(found);
    };
    transaction.onerror = () => undefined;
    transaction.onabort = () => reject(storageError(
      'delete-failed',
      'The local photo could not be deleted.',
      transaction.error ?? getRequest.error ?? undefined,
    ));
  });
}

export async function deleteAllFamilyPhotos(): Promise<number> {
  const database = await openDatabase();
  return new Promise<number>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(FAMILY_PHOTO_STORE, 'readwrite');
    } catch (error) {
      reject(storageError('delete-failed', 'The local photo library could not be cleared.', error));
      return;
    }

    const store = transaction.objectStore(FAMILY_PHOTO_STORE);
    let deletedCount = 0;
    const countRequest = store.count();
    countRequest.onerror = () => transaction.abort();
    countRequest.onsuccess = () => {
      deletedCount = countRequest.result;
      if (deletedCount > 0) {
        store.clear();
      }
    };
    transaction.oncomplete = () => {
      publishFamilyPhotoLibraryChange({ kind: 'cleared' });
      resolve(deletedCount);
    };
    transaction.onerror = () => undefined;
    transaction.onabort = () => reject(storageError(
      'delete-failed',
      'The local photo library could not be cleared.',
      transaction.error ?? countRequest.error ?? undefined,
    ));
  });
}

export async function closeFamilyPhotoDatabase(): Promise<void> {
  const pending = databasePromise;
  databasePromise = null;
  if (pending) {
    (await pending).close();
  }
}
