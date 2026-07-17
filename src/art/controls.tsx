import type { ArtProps } from './a11y';
import { artA11yProps } from './a11y';

/**
 * Vector control icons for the always-minimal child top rail (home/back,
 * restart) and the caregiver-only gate/star affordances. No emoji anywhere.
 */

export function HomeIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-home', label)}>
      <path d="M8 24 L24 10 L40 24 V38 Q40 40 38 40 H10 Q8 40 8 38 Z" fill="currentColor" opacity={0.16} />
      <path d="M8 24 L24 10 L40 24" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 22 V38 Q14 39.5 15.5 39.5 H32.5 Q34 39.5 34 38 V22" fill="none" stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <rect x="20" y="27" width="8" height="12.5" rx="2" fill="currentColor" />
    </svg>
  );
}

export function BackIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-back', label)}>
      {/* Points toward reading-start in this app's always-RTL shell (back = right-pointing). */}
      <path d="M20 12 L32 24 L20 36" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M31 24 H12" fill="none" stroke="currentColor" strokeWidth={3.6} strokeLinecap="round" />
    </svg>
  );
}

export function RestartIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-restart', label)}>
      <path
        d="M14 18 Q19 10 28 11 Q38 12.5 39 23 Q40 34 29 37.5 Q19 40.5 13 32"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.6}
        strokeLinecap="round"
      />
      <path d="M14 10 L14 18 L22 18 Z" fill="currentColor" />
    </svg>
  );
}

export function GearIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-gear', label)}>
      <circle cx="24" cy="24" r="8.5" fill="none" stroke="currentColor" strokeWidth={3.4} />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const x1 = 24 + Math.cos(angle) * 14;
        const y1 = 24 + Math.sin(angle) * 14;
        const x2 = 24 + Math.cos(angle) * 19.5;
        const y2 = 24 + Math.sin(angle) * 19.5;
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={3.4} strokeLinecap="round" />;
      })}
    </svg>
  );
}

export function StarIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-star', label)}>
      <path
        d="M24 6 L28.5 18.5 L42 19 L31.5 27.5 L35 40.5 L24 33 L13 40.5 L16.5 27.5 L6 19 L19.5 18.5 Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function SpeakerIconArt({ label, className }: ArtProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} {...artA11yProps('control-speaker', label)}>
      <path d="M10 19 H16 L26 11 V37 L16 29 H10 Z" fill="currentColor" />
      <path d="M32 17 Q38 24 32 31" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M36 12 Q45 24 36 36" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" opacity={0.6} />
    </svg>
  );
}
