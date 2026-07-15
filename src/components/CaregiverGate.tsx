import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { GearIconArt } from '../art/controls';

const HOLD_MS = 2700;

interface CaregiverGateProps {
  onUnlock: () => void;
}

export function CaregiverGate({ onUnlock }: CaregiverGateProps) {
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [showHint, setShowHint] = useState(false);

  const stopHold = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setProgress(0);
  };

  const startHold = () => {
    stopHold();
    setShowHint(false);
    const startedAt = performance.now();
    intervalRef.current = window.setInterval(() => {
      setProgress(Math.min(1, (performance.now() - startedAt) / HOLD_MS));
    }, 40);
    timeoutRef.current = window.setTimeout(() => {
      stopHold();
      onUnlock();
    }, HOLD_MS);
  };

  useEffect(() => () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
    }
  }, []);

  return (
    <div className="caregiver-gate">
      <button
        className="floating-gear"
        type="button"
        aria-label="אזור למבוגרים בלבד. לחיצה ארוכה לפתיחה"
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          startHold();
        }}
        onPointerUp={stopHold}
        onPointerCancel={stopHold}
        onClick={() => setShowHint(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            stopHold();
          }
        }}
      >
        <span className="gear-ring" style={{ '--gate-progress': `${progress}` } as CSSProperties} />
        <GearIconArt className="floating-gear__icon" />
      </button>
      {showHint ? <p className="gate-hint">לחיצה ארוכה של בערך 3 שניות פותחת את אזור המבוגרים.</p> : null}
    </div>
  );
}
