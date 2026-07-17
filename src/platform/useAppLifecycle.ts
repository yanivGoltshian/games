import { useEffect, useState } from 'react';

export type AppLifecycleState = 'foreground' | 'background';

type LifecycleDocument = Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
type LifecycleWindow = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface AppLifecycleTargets {
  document?: LifecycleDocument;
  window?: LifecycleWindow;
}

function defaultTargets(): AppLifecycleTargets {
  return {
    ...(typeof document === 'undefined' ? {} : { document }),
    ...(typeof window === 'undefined' ? {} : { window }),
  };
}

export function readAppLifecycleState(
  targetDocument: Pick<Document, 'visibilityState'> | undefined =
    typeof document === 'undefined' ? undefined : document,
): AppLifecycleState {
  return targetDocument?.visibilityState === 'hidden' ? 'background' : 'foreground';
}

export function subscribeAppLifecycle(
  listener: (state: AppLifecycleState) => void,
  targets: AppLifecycleTargets = defaultTargets(),
): () => void {
  const targetDocument = targets.document;
  const targetWindow = targets.window;
  let state = readAppLifecycleState(targetDocument);

  const emit = (next: AppLifecycleState): void => {
    if (next === state) {
      return;
    }
    state = next;
    listener(next);
  };
  const handleVisibility = (): void => {
    emit(readAppLifecycleState(targetDocument));
  };
  const handlePageHide = (): void => emit('background');
  const handlePageShow = (): void => emit(readAppLifecycleState(targetDocument));

  targetDocument?.addEventListener('visibilitychange', handleVisibility);
  targetWindow?.addEventListener('pagehide', handlePageHide);
  targetWindow?.addEventListener('pageshow', handlePageShow);

  return () => {
    targetDocument?.removeEventListener('visibilitychange', handleVisibility);
    targetWindow?.removeEventListener('pagehide', handlePageHide);
    targetWindow?.removeEventListener('pageshow', handlePageShow);
  };
}

export function useAppLifecycle(): AppLifecycleState {
  const [state, setState] = useState(readAppLifecycleState);

  useEffect(() => subscribeAppLifecycle(setState), []);

  return state;
}
