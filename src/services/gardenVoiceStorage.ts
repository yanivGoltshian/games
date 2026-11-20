const DB_NAME = 'garden-local-voices';
const STORE = 'clips';
export const GARDEN_VOICE_MAX_BYTES = 2 * 1024 * 1024;
export const GARDEN_VOICE_MAX_MS = 15_000;

function isVoiceBlob(value: unknown): value is Blob {
  return value instanceof Blob && value.size > 0 && value.size <= GARDEN_VOICE_MAX_BYTES
    && /^audio\//i.test(value.type);
}

async function withStore<T>(
  mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('Local recording storage is unavailable.'));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE); };
    request.onblocked = () => reject(new Error('Local recording storage is blocked.'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = operation(transaction.objectStore(STORE));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error ?? request.error);
      transaction.onabort = () => reject(transaction.error ?? new Error('Local recording transaction was interrupted.'));
    });
  } finally {
    db.close();
  }
}

export async function readGardenVoice(key: string, signal?: AbortSignal): Promise<Blob | null> {
  if (signal?.aborted) return null;
  const read = withStore('readonly', (store) => store.get(key)).then((result: unknown) =>
    isVoiceBlob(result) ? result : null);
  if (!signal) return read;
  // A slow local database should not hold the sentence train waiting for audio.
  return new Promise((resolve) => {
    const finish = (clip: Blob | null) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(clip);
    };
    const abort = () => finish(null);
    const timer = setTimeout(abort, 1_000);
    signal.addEventListener('abort', abort, { once: true });
    void read.then(finish, abort);
  });
}

export async function saveGardenVoice(key: string, clip: Blob): Promise<void> {
  if (!isVoiceBlob(clip)) throw new Error('The local voice clip is empty, unsupported, or too large.');
  await withStore('readwrite', (store) => store.put(clip, key));
}

export async function deleteGardenVoice(key: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(key));
}
