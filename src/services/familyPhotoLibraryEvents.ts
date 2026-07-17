export type FamilyPhotoLibraryChange =
  | { kind: 'added'; ids: string[] }
  | { kind: 'deleted'; id: string }
  | { kind: 'cleared' };

const CHANNEL_NAME = 'sean-family-photo-library-changes';
const LOCAL_EVENT_NAME = 'sean-family-photo-library-change';
const SOURCE_ID = typeof globalThis.crypto?.randomUUID === 'function'
  ? globalThis.crypto.randomUUID()
  : `family-photo-tab-${Date.now()}-${Math.random()}`;

interface FamilyPhotoLibraryEnvelope {
  sourceId: string;
  change: FamilyPhotoLibraryChange;
}

function broadcastChange(envelope: FamilyPhotoLibraryEnvelope): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.postMessage(envelope);
  channel.close();
}

function isFamilyPhotoLibraryChange(value: unknown): value is FamilyPhotoLibraryChange {
  if (!value || typeof value !== 'object' || !('kind' in value)) {
    return false;
  }
  const candidate = value as { kind: unknown; id?: unknown; ids?: unknown };
  return candidate.kind === 'cleared'
    || (
      candidate.kind === 'deleted'
      && typeof candidate.id === 'string'
    )
    || (
      candidate.kind === 'added'
      && Array.isArray(candidate.ids)
      && candidate.ids.length > 0
      && candidate.ids.every((id) => typeof id === 'string')
    );
}

function isFamilyPhotoLibraryEnvelope(value: unknown): value is FamilyPhotoLibraryEnvelope {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { sourceId?: unknown; change?: unknown };
  return typeof candidate.sourceId === 'string'
    && isFamilyPhotoLibraryChange(candidate.change);
}

export function publishFamilyPhotoLibraryChange(change: FamilyPhotoLibraryChange): void {
  const envelope = { sourceId: SOURCE_ID, change };
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(LOCAL_EVENT_NAME, { detail: envelope }));
  }
  broadcastChange(envelope);
}

export function subscribeFamilyPhotoLibraryChanges(
  listener: (change: FamilyPhotoLibraryChange) => void,
): () => void {
  const handleLocalChange = (event: Event): void => {
    const envelope = (event as CustomEvent<unknown>).detail;
    if (isFamilyPhotoLibraryEnvelope(envelope)) {
      listener(envelope.change);
    }
  };
  const handleBroadcastChange = (event: MessageEvent<unknown>): void => {
    if (
      isFamilyPhotoLibraryEnvelope(event.data)
      && event.data.sourceId !== SOURCE_ID
    ) {
      listener(event.data.change);
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
