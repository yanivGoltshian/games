import {
  useCallback,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { CommunicationDoorArt } from '../art/communicationShelf';
import { PuppyMascotArt } from '../art/mascot';
import type { CommunicationActivityId } from '../domain/communicationGame';
import type { LanguageMode } from '../domain/types';
import { COMMUNICATION_SHELF_REGISTRY } from '../communication/registry';

interface CommunicationShelfProps {
  activityIds: readonly CommunicationActivityId[];
  languageMode: LanguageMode;
  reducedMotion: boolean;
  onHome: () => void;
  onSelect: (activityId: CommunicationActivityId) => void;
}

interface PointerOwner {
  activityId: CommunicationActivityId;
  pointerId: number;
}

export function CommunicationShelf({
  activityIds,
  languageMode,
  reducedMotion,
  onHome,
  onSelect,
}: CommunicationShelfProps) {
  const english = languageMode === 'en';
  const entries = COMMUNICATION_SHELF_REGISTRY.filter((entry) => (
    activityIds.includes(entry.activityId)
  ));
  const pointerOwner = useRef<PointerOwner | null>(null);
  const selectionCommitted = useRef(false);
  const [pressedActivity, setPressedActivity] = useState<CommunicationActivityId | null>(null);

  const commitSelection = useCallback((activityId: CommunicationActivityId) => {
    if (selectionCommitted.current) {
      return;
    }
    selectionCommitted.current = true;
    onSelect(activityId);
  }, [onSelect]);

  const handlePointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    activityId: CommunicationActivityId,
  ) => {
    if (selectionCommitted.current || pointerOwner.current) {
      return;
    }
    pointerOwner.current = { activityId, pointerId: event.pointerId };
    setPressedActivity(activityId);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerUp = (
    event: PointerEvent<HTMLButtonElement>,
    activityId: CommunicationActivityId,
  ) => {
    const owner = pointerOwner.current;
    if (owner?.activityId !== activityId || owner.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPressedActivity(null);
    commitSelection(activityId);
  };

  const handlePointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointerOwner.current?.pointerId !== event.pointerId) {
      return;
    }
    pointerOwner.current = null;
    setPressedActivity(null);
  };

  const handleClick = (
    event: MouseEvent<HTMLButtonElement>,
    activityId: CommunicationActivityId,
  ) => {
    if (event.detail === 0 && pointerOwner.current === null) {
      commitSelection(activityId);
    }
  };

  const handleHome = (event: MouseEvent<HTMLButtonElement>) => {
    if (pointerOwner.current || selectionCommitted.current) {
      event.preventDefault();
      return;
    }
    onHome();
  };

  return (
    <main
      aria-label={english ? 'Communication Shelf' : 'מדף התקשורת'}
      className="page communication-shelf"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      dir={english ? 'ltr' : 'rtl'}
      lang={english ? 'en' : 'he'}
    >
      <header className="communication-shelf__rail">
        <button
          aria-label={english ? 'Home' : 'דף הבית'}
          className="communication-shelf__edge-control communication-shelf__edge-control--home"
          onClick={handleHome}
          type="button"
        >
          <span aria-hidden="true">⌂</span>
        </button>
        <PuppyMascotArt className="communication-shelf__mascot" />
      </header>

      <ul className="communication-shelf__doors" data-door-count={entries.length}>
        {entries.map((entry) => {
          const title = english ? entry.title.en : entry.title.he;
          const description = 'description' in entry
            ? (english ? entry.description.en : entry.description.he)
            : null;
          const pressed = pressedActivity === entry.activityId;
          return (
            <li key={entry.activityId} className="communication-shelf__door-slot">
              <button
                aria-label={description ? `${title}. ${description}` : title}
                className={`communication-door communication-door--${entry.palette}${pressed ? ' is-pressed' : ''}`}
                data-activity-id={entry.activityId}
                onClick={(event) => handleClick(event, entry.activityId)}
                onPointerCancel={handlePointerCancel}
                onPointerDown={(event) => handlePointerDown(event, entry.activityId)}
                onPointerUp={(event) => handlePointerUp(event, entry.activityId)}
                type="button"
              >
                <span className="communication-door__theatre" aria-hidden="true">
                  <i className="communication-door__curtain communication-door__curtain--start" />
                  <i className="communication-door__curtain communication-door__curtain--end" />
                </span>
                <CommunicationDoorArt
                  activityId={entry.activityId}
                  className="communication-door__art"
                />
                <span className="communication-door__label">{title}</span>
                <span className="communication-door__knob" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
