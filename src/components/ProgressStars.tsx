import { StarIconArt } from '../art/controls';

interface ProgressStarsProps {
  count: number;
}

/** Caregiver-only progress indicator (child screens never show a stars/points dashboard). */
export function ProgressStars({ count }: ProgressStarsProps) {
  return (
    <div className="stars-pill" aria-label={`נצברו ${count} כוכבים`}>
      <StarIconArt className="stars-pill__icon" />
      <strong>{count}</strong>
    </div>
  );
}
