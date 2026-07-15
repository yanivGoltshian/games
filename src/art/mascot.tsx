import type { ArtProps } from './a11y';
import { artA11yProps, useArtIds } from './a11y';

export type MascotMood = 'idle' | 'happy' | 'milestone';

interface MascotArtProps extends ArtProps {
  mood?: MascotMood;
}

/**
 * Original puppy mascot used in the welcome and non-blocking success overlay.
 * Motion (tail wag / bounce) is pure CSS driven by `--motion-*` tokens so
 * reduced-motion mode collapses to a gentle static pose automatically.
 */
export function PuppyMascotArt({ label, className, mood = 'idle' }: MascotArtProps) {
  const ids = useArtIds('body', 'ear');
  const mouthOpen = mood !== 'idle';

  return (
    <svg
      viewBox="0 0 200 200"
      className={`puppy-mascot puppy-mascot--${mood} ${className ?? ''}`.trim()}
      {...artA11yProps('mascot-puppy', label)}
    >
      <defs>
        <radialGradient id={ids.body} cx="35%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#ffe3c2" />
          <stop offset="100%" stopColor="#e2a869" />
        </radialGradient>
        <radialGradient id={ids.ear} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#f0bf8a" />
          <stop offset="100%" stopColor="#c2854a" />
        </radialGradient>
      </defs>
      <g className="puppy-mascot__tail">
        <path d="M150 130 Q184 118 178 84 Q174 62 154 70" fill="none" stroke="#e2a869" strokeWidth={16} strokeLinecap="round" />
      </g>
      <ellipse cx="58" cy="76" rx="26" ry="34" fill={`url(#${ids.ear})`} stroke="#8a5f34" strokeOpacity={0.3} strokeWidth={3} transform="rotate(-18 58 76)" />
      <ellipse cx="142" cy="76" rx="26" ry="34" fill={`url(#${ids.ear})`} stroke="#8a5f34" strokeOpacity={0.3} strokeWidth={3} transform="rotate(18 142 76)" />
      <circle cx="100" cy="112" r="58" fill={`url(#${ids.body})`} stroke="#8a5f34" strokeOpacity={0.3} strokeWidth={4} />
      <ellipse cx="100" cy="132" rx="28" ry="20" fill="#fff6e6" />
      <circle cx="82" cy="100" r="8" fill="#3a2a18" />
      <circle cx="118" cy="100" r="8" fill="#3a2a18" />
      <ellipse cx="100" cy="124" rx="10" ry="8" fill="#3a2a18" />
      {mouthOpen ? (
        <path d="M86 138 Q100 154 114 138 Q100 148 86 138 Z" fill="#c65a44" />
      ) : (
        <path d="M86 138 Q100 146 114 138" fill="none" stroke="#3a2a18" strokeWidth={4} strokeLinecap="round" />
      )}
      <ellipse cx="80" cy="90" rx="12" ry="9" fill="white" opacity={0.35} />
    </svg>
  );
}
