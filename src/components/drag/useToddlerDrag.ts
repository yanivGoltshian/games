import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent,
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
  startX: number;
  startY: number;
  moved: boolean;
}

interface UseToddlerDragOptions {
  surfaceRef: RefObject<HTMLElement | null>;
  items: Record<string, DragItemState>;
  setItems: Dispatch<SetStateAction<Record<string, DragItemState>>>;
  zones: Record<string, RefObject<HTMLElement | null>>;
  onDrop: (itemId: string, zoneId: string) => boolean;
  onSelect: (itemId: string) => void;
  roundKey: string | number;
  disabled?: boolean;
}

const WIGGLE_MS = 520;

/**
 * Pointer-capture drag with a tap-select / tap-destination fallback so a
 * toddler can either drag with a finger or tap an item then tap its target.
 * Exposes explicit interaction states (pressed via aria-pressed, selected,
 * dragging, zone-hover, and a brief wiggle back at home on a wrong drop) so
 * every game can render consistent, non-color-only feedback.
 */
export function useToddlerDrag({ surfaceRef, items, setItems, zones, onDrop, onSelect, roundKey, disabled = false }: UseToddlerDragOptions) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [hoverZoneId, setHoverZoneId] = useState<string | null>(null);
  const [wigglingId, setWigglingId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const activeRef = useRef<ActiveDrag | null>(null);
  const suppressClick = useRef<string | null>(null);
  const wiggleTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    setSelectedId(null);
    setDraggingId(null);
    setHoverZoneId(null);
    setWigglingId(null);
    return () => {
      activeRef.current = null;
      suppressClick.current = null;
      if (wiggleTimeoutRef.current !== null) {
        window.clearTimeout(wiggleTimeoutRef.current);
      }
    };
  }, [roundKey]);

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

  const returnHomeWithWiggle = useCallback(
    (itemId: string): void => {
      setWigglingId(itemId);
      resetItem(itemId);
      if (wiggleTimeoutRef.current !== null) {
        window.clearTimeout(wiggleTimeoutRef.current);
      }
      wiggleTimeoutRef.current = window.setTimeout(() => {
        setWigglingId((current) => (current === itemId ? null : current));
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
    if (disabled) {
      resetItem(itemId);
      setSelectedId(null);
      return;
    }
    if (!zoneId || !onDrop(itemId, zoneId)) {
      returnHomeWithWiggle(itemId);
      setSelectedId((current) => (current === itemId ? null : current));
      return;
    }
    setSelectedId(null);
  };

  const bindItem = (itemId: string) => {
    const unavailable = disabled || Boolean(items[itemId]?.locked);
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        const surfaceRect = surfaceRef.current?.getBoundingClientRect();
        const item = itemsRef.current[itemId];
        if (disabled || !surfaceRect || !item || item.locked || activeRef.current || !event.isPrimary || event.button !== 0) {
          return;
        }

        suppressClick.current = null;
        event.currentTarget.setPointerCapture(event.pointerId);
        activeRef.current = {
          id: itemId,
          pointerId: event.pointerId,
          offsetX: event.clientX - surfaceRect.left - item.x,
          offsetY: event.clientY - surfaceRect.top - item.y,
          startX: event.clientX,
          startY: event.clientY,
          moved: false,
        };
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
        if (!active.moved) {
          if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) <= 6) return;
          active.moved = true;
          onSelect(itemId);
          setSelectedId(itemId);
          setDraggingId(itemId);
          setWigglingId(null);
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

        setDraggingId(null);
        setHoverZoneId(null);
        if (active.moved) {
          suppressClick.current = itemId;
          attemptDrop(itemId, findZoneAt(event.clientX, event.clientY) ?? findZone(itemId));
        }
        activeRef.current = null;
      },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => {
        if (activeRef.current?.pointerId !== event.pointerId) return;
        activeRef.current = null;
        setDraggingId(null);
        setHoverZoneId(null);
        setSelectedId(null);
        resetItem(itemId);
      },
      onClick: (event: MouseEvent<HTMLElement>) => {
        if (unavailable || (event.detail !== 0 && suppressClick.current === itemId)) {
          suppressClick.current = null;
          return;
        }
        onSelect(itemId);
        setWigglingId(null);
        setSelectedId(event.detail === 0 && selectedId === itemId ? null : itemId);
      },
      disabled: unavailable,
      tabIndex: unavailable ? -1 : 0,
      role: 'button' as const,
      'aria-pressed': selectedId === itemId,
      'aria-disabled': unavailable,
    };
  };

  const bindZone = (zoneId: string) => ({
    onClick: () => {
      if (!disabled && selectedId) {
        attemptDrop(selectedId, zoneId);
      }
    },
    disabled,
    tabIndex: disabled ? -1 : 0,
    'aria-disabled': disabled,
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
