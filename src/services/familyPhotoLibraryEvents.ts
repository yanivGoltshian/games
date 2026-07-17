export type FamilyPhotoLibraryChange =
  | { kind: 'added'; id: string }
  | { kind: 'deleted'; id: string }
  | { kind: 'cleared' };

const CHANNEL_NAME = 'sean-family-photo-library-changes';
const LOCAL_EVENT_NAME = 'sean-family-photo-library-change';

function broadcastChange(change: FamilyPhotoLibraryChange): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(change);
  channel.close();
}

function isFamilyPhotoLibraryChange(value: unknown): value is FamilyPhotoLibraryChange {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    return false;
  }
  const candidate = value as { kind: unknown; id?: unknown };
  return candidate.kind === 'cleared'
    || (
      (candidate.kind === 'added' || candidate.kind === 'deleted')
      && typeof candidate.id === 'string'
    );
}

export function publishFamilyPhotoLibraryChange(change: FamilyPhotoLibraryChange): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: change }));
  }
  broadcastChange(change);
}

export function subscribeFamilyPhotoLibraryChanges(
  listener: (change: FamilyPhotoLibraryChange) => void,
): () => void {
  const handleLocalChange = (event: Event): void => {
    const change = (event as CustomEvent<unknown>).detail;
    if (isFamilyPhotoLibraryChange(change)) {
      listener(change);
    }
  };
  const handleBroadcastChange = (event: MessageEvent<unknown>): void => {
    if (isFamilyPhotoLibraryChange(event.data)) {
      listener(event.data);
    }
  };
  const channel = typeof BroadcastChannel === 'undefined'
    ? null
    : new BroadcastChannel(CHANNEL_NAME);

  window.addEventListener(LOCAL_EVENT_NAME, handleLocalChange);
  channel?.addEventListener('message', handleBroadcastChange);
  return () => {
    window.removeEventListener(LOCAL_EVENT_NAME, handleLocalChange);
    channel?.removeEventListener('message', handleBroadcastChange);
    channel?.close();
  };
}
