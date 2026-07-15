import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react';

export interface DragItemState {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  width: number;
  height: number;
  locked?: boolean;
}

interface ActiveDrag {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
}

interface UseToddlerDragOptions {
  surfaceRef: RefObject<HTMLElement | null>;
  items: Record<string, DragItemState>;
  setItems: Dispatch<SetStateAction<Record<string, DragItemState>>>;
  zones: Record<string, RefObject<HTMLElement | null>>;
  onDrop: (itemId: string, zoneId: string) => boolean;
}

const WIGGLE_MS = 520;

/**
 * Pointer-capture drag with a tap-select / tap-destination fallback so a
 * toddler can either drag with a finger or tap an item then tap its target.
 * Exposes explicit interaction states (pressed via aria-pressed, selected,
 * dragging, zone-hover, and a brief wiggle-then-return on a wrong drop) so
 * every game can render consistent, non-color-only feedback.
 */
export function useToddlerDrag({ surfaceRef, items, setItems, zones, onDrop }: UseToddlerDragOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [wigglingId, setWigglingId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const activeRef = useRef<ActiveDrag | null>(null);
  const wiggleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      if (wiggleTimeoutRef.current !== null) {
        window.clearTimeout(wiggleTimeoutRef.current);
      }
    },
    [],
  );

  const resetItem = useCallback(
    (itemId: string): void => {
      setItems((current) => {
        const item = current[itemId];
        if (!item) {
          return current;
        }
        return {
          ...current,
          [itemId]: {
            ...item,
            x: item.homeX,
            y: item.homeY,
          },
        };
      });
    },
    [setItems],
  );

  const wiggleThenReset = useCallback(
    (itemId: string): void => {
      setWigglingId(itemId);
      if (wiggleTimeoutRef.current !== null) {
        window.clearTimeout(wiggleTimeoutRef.current);
      }
      wiggleTimeoutRef.current = window.setTimeout(() => {
        setWigglingId((current) => (current === itemId ? null : current));
        resetItem(itemId);
      }, WIGGLE_MS);
    },
    [resetItem],
  );

  const updateItemPosition = (itemId: string, x: number, y: number): void => {
    const surface = surfaceRef.current;
    const item = itemsRef.current[itemId];
    if (!surface || !item) {
      return;
    }

    const maxX = Math.max(0, surface.clientWidth - item.width);
    const maxY = Math.max(0, surface.clientHeight - item.height);
    const nextX = Math.min(maxX, Math.max(0, x));
    const nextY = Math.min(maxY, Math.max(0, y));

    itemsRef.current = {
      ...itemsRef.current,
      [itemId]: {
        ...item,
        x: nextX,
        y: nextY,
      },
    };

    setItems((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId]!,
        x: nextX,
        y: nextY,
      },
    }));
  };

  const findZoneAt = (centerX: number, centerY: number): string | null => {
    for (const [zoneId, zoneRef] of Object.entries(zones)) {
      const zoneRect = zoneRef.current?.getBoundingClientRect();
      if (!zoneRect) {
        continue;
      }
      if (centerX >= zoneRect.left && centerX <= zoneRect.right && centerY >= zoneRect.top && centerY <= zoneRect.bottom) {
        return zoneId;
      }
    }
    return null;
  };

  const findZone = (itemId: string): string | null => {
    const surfaceRect = surfaceRef.current?.getBoundingClientRect();
    const item = itemsRef.current[itemId];
    if (!surfaceRect || !item) {
      return null;
    }

    const centerX = surfaceRect.left + item.x + item.width / 2;
    const centerY = surfaceRect.top + item.y + item.height / 2;
    return findZoneAt(centerX, centerY);
  };

  const attemptDrop = (itemId: string, zoneId: string | null): void => {
    if (!zoneId || !onDrop(itemId, zoneId)) {
      wiggleThenReset(itemId);
      setSelectedId((current) => (current === itemId ? null : current));
      return;
    }
    setSelectedId(null);
  };

  const bindItem = (itemId: string) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      const surfaceRect = surfaceRef.current?.getBoundingClientRect();
      const item = itemsRef.current[itemId];
      if (!surfaceRect || !item || item.locked) {
        return;
      }

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      activeRef.current = {
        id: itemId,
        pointerId: event.pointerId,
        offsetX: event.clientX - surfaceRect.left - item.x,
        offsetY: event.clientY - surfaceRect.top - item.y,
        moved: false,
      };
      setSelectedId(itemId);
    },
    onPointerMove: (event: PointerEvent<HTMLElement>) => {
      const active = activeRef.current;
      const surfaceRect = surfaceRef.current?.getBoundingClientRect();
      if (!active || active.id !== itemId || active.pointerId !== event.pointerId || !surfaceRect) {
        return;
      }

      event.preventDefault();
      const nextX = event.clientX - surfaceRect.left - active.offsetX;
      const nextY = event.clientY - surfaceRect.top - active.offsetY;
      active.moved = active.moved || Math.abs(nextX - itemsRef.current[itemId]!.x) > 6 || Math.abs(nextY - itemsRef.current[itemId]!.y) > 6;
      if (active.moved) {
        setDraggingId(itemId);
      }
      updateItemPosition(itemId, nextX, nextY);
      const item = itemsRef.current[itemId];
      if (item) {
        setHoverZoneId(findZoneAt(event.clientX, event.clientY) ?? findZone(itemId));
      }
    },
    onPointerUp: (event: PointerEvent<HTMLElement>) => {
      const active = activeRef.current;
      if (!active || active.id !== itemId || active.pointerId !== event.pointerId) {
        return;
      }

      event.preventDefault();
      setDraggingId(null);
      setHoverZoneId(null);
      if (!active.moved) {
        // Pointer-down already selected the item so it can be named
        // immediately. Keep that selection after a tap for the
        // tap-item/tap-destination fallback.
        setSelectedId(itemId);
      } else {
        attemptDrop(itemId, findZone(itemId));
      }
      activeRef.current = null;
    },
    onPointerCancel: () => {
      activeRef.current = null;
      setDraggingId(null);
      setHoverZoneId(null);
      resetItem(itemId);
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId((current) => (current === itemId ? null : itemId));
      }
    },
    tabIndex: 0,
    role: 'button' as const,
    'aria-pressed': selectedId === itemId,
  });

  const bindZone = (zoneId: string) => ({
    onClick: () => {
      if (selectedId) {
        attemptDrop(selectedId, zoneId);
      }
    },
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
      if ((event.key === 'Enter' || event.key === ' ') && selectedId) {
        event.preventDefault();
        attemptDrop(selectedId, zoneId);
      }
    },
    tabIndex: 0,
  });

  return {
    selectedId,
    draggingId,
    hoverZoneId,
    wigglingId,
    bindItem,
    bindZone,
    resetItem,
    setSelectedId,
  };
}
