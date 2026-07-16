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
  const ids = useArtIds('body', 'ear', 'chest', 'shadow');
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
        <linearGradient id={ids.chest} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8ed" />
          <stop offset="100%" stopColor="#ead8c0" />
        </linearGradient>
        <filter id={ids.shadow} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#6d431f" floodOpacity="0.22" />
        </filter>
      </defs>
      <ellipse cx="100" cy="181" rx="61" ry="11" fill="#70451f" opacity="0.14" />
      <g filter={`url(#${ids.shadow})`}>
        <g className="puppy-mascot__tail">
          <path d="M148 145 Q185 132 178 96 Q174 78 157 82" fill="none" stroke="#d99a59" strokeWidth={15} strokeLinecap="round" />
          <path d="M160 86 Q172 82 178 96" fill="none" stroke="#f4c58e" strokeWidth={5} strokeLinecap="round" opacity="0.75" />
        </g>
        <ellipse cx="100" cy="151" rx="48" ry="42" fill={`url(#${ids.body})`} />
        <ellipse cx="100" cy="157" rx="26" ry="30" fill={`url(#${ids.chest})`} />
        <ellipse cx="69" cy="174" rx="18" ry="11" fill="#d99a59" />
        <ellipse cx="131" cy="174" rx="18" ry="11" fill="#d99a59" />
        <ellipse cx="58" cy="67" rx="25" ry="34" fill={`url(#${ids.ear})`} stroke="#8a5f34" strokeOpacity={0.28} strokeWidth={3} transform="rotate(-20 58 67)" />
        <ellipse cx="142" cy="67" rx="25" ry="34" fill={`url(#${ids.ear})`} stroke="#8a5f34" strokeOpacity={0.28} strokeWidth={3} transform="rotate(20 142 67)" />
        <circle cx="100" cy="104" r="55" fill={`url(#${ids.body})`} stroke="#8a5f34" strokeOpacity={0.26} strokeWidth={4} />
        <path d="M107 52 Q139 60 143 92 Q120 83 109 65 Z" fill="#c9874e" opacity="0.9" />
        <ellipse cx="100" cy="125" rx="28" ry="21" fill={`url(#${ids.chest})`} />
        <path d="M72 89 Q81 83 90 89" fill="none" stroke="#6b482a" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <path d="M110 89 Q119 83 128 89" fill="none" stroke="#6b482a" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
        <circle cx="82" cy="100" r="8" fill="#352519" />
        <circle cx="118" cy="100" r="8" fill="#352519" />
        <circle cx="79" cy="97" r="2.6" fill="white" />
        <circle cx="115" cy="97" r="2.6" fill="white" />
        <ellipse cx="100" cy="119" rx="10" ry="8" fill="#352519" />
        <path d="M96 116 Q100 112 104 116" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" opacity="0.42" />
        {mouthOpen ? (
          <>
            <path d="M85 132 Q100 153 115 132 Q100 143 85 132 Z" fill="#8c3e32" />
            <ellipse cx="100" cy="143" rx="8" ry="4" fill="#ef8d86" />
          </>
        ) : (
          <path d="M86 133 Q100 142 114 133" fill="none" stroke="#352519" strokeWidth={4} strokeLinecap="round" />
        )}
        <ellipse cx="70" cy="121" rx="9" ry="5" fill="#dc7f72" opacity="0.2" />
        <ellipse cx="130" cy="121" rx="9" ry="5" fill="#dc7f72" opacity="0.2" />
        <ellipse cx="75" cy="69" rx="14" ry="9" fill="white" opacity={0.28} transform="rotate(-18 75 69)" />
      </g>
    </svg>
  );
}
