type TouchLike = Pick<Touch, 'clientX' | 'clientY' | 'identifier'>;
type PointLike = Pick<TouchLike, 'clientX' | 'clientY'>;

type TouchEventLike = Pick<TouchEvent, 'target' | 'touches' | 'changedTouches' | 'timeStamp'>;

interface TapState {
  target: EventTarget | null;
  timeStamp: number;
  clientX: number;
  clientY: number;
}

interface ActiveTouchState {
  identifier: number;
  target: EventTarget | null;
  timeStamp: number;
  clientX: number;
  clientY: number;
  moved: boolean;
}

export interface TouchZoomGuard {
  handleTouchStart(event: TouchEventLike): boolean;
  handleTouchMove(event: TouchEventLike): boolean;
  handleTouchEnd(event: TouchEventLike): boolean;
  handleTouchCancel(): void;
  handleGestureEvent(): boolean;
}

const DOUBLE_TAP_DELAY_MS = 300;
const TAP_MOVE_TOLERANCE_PX = 12;
const TAP_START_TOLERANCE_PX = 20;

function getPrimaryTouch(list: TouchList): TouchLike | null {
  const touch = list[0];
  return touch ? { clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier } : null;
}

function getTouchByIdentifier(list: TouchList, identifier: number): TouchLike | null {
  for (const touch of Array.from(list)) {
    if (touch.identifier === identifier) {
      return { clientX: touch.clientX, clientY: touch.clientY, identifier: touch.identifier };
    }
  }
  return null;
}

function distanceSquared(first: PointLike, second: PointLike): number {
  const deltaX = first.clientX - second.clientX;
  const deltaY = first.clientY - second.clientY;
  return deltaX * deltaX + deltaY * deltaY;
}

function isStationaryTap(start: ActiveTouchState, endPoint: TouchLike, endTimeStamp: number): boolean {
  const duration = endTimeStamp - start.timeStamp;
  if (duration < 0 || duration > DOUBLE_TAP_DELAY_MS) {
    return false;
  }

  const movementToleranceSquared = TAP_MOVE_TOLERANCE_PX * TAP_MOVE_TOLERANCE_PX;
  return distanceSquared(start, endPoint) <= movementToleranceSquared;
}

function isDoubleTapCandidate(previousTap: TapState | null, nextTap: TapState): boolean {
  if (!previousTap) {
    return false;
  }

  if (nextTap.target !== previousTap.target) {
    return false;
  }

  const timeDelta = nextTap.timeStamp - previousTap.timeStamp;
  if (timeDelta < 0 || timeDelta > DOUBLE_TAP_DELAY_MS) {
    return false;
  }

  return distanceSquared(previousTap, nextTap) <= TAP_START_TOLERANCE_PX * TAP_START_TOLERANCE_PX;
}

export function createTouchZoomGuard(): TouchZoomGuard {
  let lastTap: TapState | null = null;
  let activeTouch: ActiveTouchState | null = null;
  let pinchInProgress = false;

  const clearActiveTouch = () => {
    activeTouch = null;
  };

  return {
    handleTouchStart(event) {
      if (pinchInProgress) {
        return true;
      }

      if (event.touches.length > 1) {
        pinchInProgress = true;
        lastTap = null;
        clearActiveTouch();
        return true;
      }

      const touch = getPrimaryTouch(event.touches);
      if (!touch) {
        return false;
      }

      activeTouch = {
        identifier: touch.identifier,
        target: event.target,
        timeStamp: event.timeStamp,
        clientX: touch.clientX,
        clientY: touch.clientY,
        moved: false,
      };
      return false;
    },

    handleTouchMove(event) {
      if (pinchInProgress) {
        return true;
      }

      if (event.touches.length > 1) {
        pinchInProgress = true;
        lastTap = null;
        clearActiveTouch();
        return true;
      }

      if (!activeTouch) {
        return false;
      }

      const touch = getTouchByIdentifier(event.touches, activeTouch.identifier) ?? getPrimaryTouch(event.touches);
      if (!touch) {
        return false;
      }

      if (distanceSquared(activeTouch, touch) > TAP_MOVE_TOLERANCE_PX * TAP_MOVE_TOLERANCE_PX) {
        activeTouch.moved = true;
      }

      return false;
    },

    handleTouchEnd(event) {
      if (event.touches.length > 1 || pinchInProgress) {
        if (event.touches.length === 0) {
          pinchInProgress = false;
        }
        lastTap = null;
        clearActiveTouch();
        return true;
      }

      const endedTouch = activeTouch ? getTouchByIdentifier(event.changedTouches, activeTouch.identifier) ?? getPrimaryTouch(event.changedTouches) : getPrimaryTouch(event.changedTouches);
      if (!endedTouch) {
        if (event.touches.length === 0) {
          pinchInProgress = false;
        }
        clearActiveTouch();
        return false;
      }

      const touchStart = activeTouch;
      clearActiveTouch();

      if (event.touches.length === 0) {
        pinchInProgress = false;
      }

      if (!touchStart || !isStationaryTap(touchStart, endedTouch, event.timeStamp)) {
        lastTap = null;
        return false;
      }

      const nextTap: TapState = {
        target: event.target,
        timeStamp: event.timeStamp,
        clientX: endedTouch.clientX,
        clientY: endedTouch.clientY,
      };
      const shouldPrevent = isDoubleTapCandidate(lastTap, nextTap);
      lastTap = nextTap;
      return shouldPrevent;
    },

    handleTouchCancel() {
      pinchInProgress = false;
      lastTap = null;
      clearActiveTouch();
    },

    handleGestureEvent() {
      pinchInProgress = false;
      lastTap = null;
      clearActiveTouch();
      return true;
    },
  };
}

function shouldInstallTouchZoomGuard(): boolean {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const platform = navigator.platform ?? '';
  const userAgent = navigator.userAgent ?? '';
  const maxTouchPoints = navigator.maxTouchPoints ?? 0;
  return /iPad/i.test(platform) || /iPad/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

export function installTouchZoomGuard(targetDocument: Document | undefined = globalThis.document): () => void {
  if (!targetDocument || !shouldInstallTouchZoomGuard()) {
    return () => {};
  }

  const guard = createTouchZoomGuard();
  const touchListenerOptions: AddEventListenerOptions = { capture: true, passive: false };
  const gestureListenerOptions: AddEventListenerOptions = { capture: true };

  const preventTouchEvent = (handler: (event: TouchEventLike) => boolean) => (event: TouchEvent) => {
    if (handler(event)) {
      event.preventDefault();
    }
  };

  const preventGestureEvent = (event: Event) => {
    if (guard.handleGestureEvent()) {
      event.preventDefault();
    }
  };

  const handleTouchStart = preventTouchEvent(guard.handleTouchStart);
  const handleTouchMove = preventTouchEvent(guard.handleTouchMove);
  const handleTouchEnd = preventTouchEvent(guard.handleTouchEnd);
  const handleTouchCancel = guard.handleTouchCancel.bind(guard);

  targetDocument.addEventListener('touchstart', handleTouchStart, touchListenerOptions);
  targetDocument.addEventListener('touchmove', handleTouchMove, touchListenerOptions);
  targetDocument.addEventListener('touchend', handleTouchEnd, touchListenerOptions);
  targetDocument.addEventListener('touchcancel', handleTouchCancel, gestureListenerOptions);
  targetDocument.addEventListener('gesturestart', preventGestureEvent, touchListenerOptions);
  targetDocument.addEventListener('gesturechange', preventGestureEvent, touchListenerOptions);
  targetDocument.addEventListener('gestureend', preventGestureEvent, touchListenerOptions);

  return () => {
    targetDocument.removeEventListener('touchstart', handleTouchStart, touchListenerOptions);
    targetDocument.removeEventListener('touchmove', handleTouchMove, touchListenerOptions);
    targetDocument.removeEventListener('touchend', handleTouchEnd, touchListenerOptions);
    targetDocument.removeEventListener('touchcancel', handleTouchCancel, gestureListenerOptions);
    targetDocument.removeEventListener('gesturestart', preventGestureEvent, touchListenerOptions);
    targetDocument.removeEventListener('gesturechange', preventGestureEvent, touchListenerOptions);
    targetDocument.removeEventListener('gestureend', preventGestureEvent, touchListenerOptions);
  };
}
