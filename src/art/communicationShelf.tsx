import type { CommunicationActivityId } from '../domain/communicationGame';
import type { ArtProps } from './a11y';
import { artA11yProps, useArtIds } from './a11y';

export function CommunicationShelfPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('background');
  return (
    <svg
      viewBox="0 0 320 320"
      className={className}
      {...artA11yProps('portal-communication-shelf', label)}
    >
      <defs>
        <linearGradient id={ids.background} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff4dc" />
          <stop offset="100%" stopColor="#eadcff" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="304" height="304" rx="88" fill={`url(#${ids.background})`} />
      <path d="M58 82 Q160 24 262 82 V262 H58 Z" fill="#fffaf0" stroke="#7e6294" strokeWidth="7" />
      {[
        { x: 78, color: '#ef826d' },
        { x: 124, color: '#63add0' },
        { x: 170, color: '#78bd78' },
        { x: 216, color: '#e6b64e' },
      ].map((door) => (
        <g key={door.x}>
          <path
            d={`M${door.x} 238 V130 Q${door.x} 106 ${door.x + 18} 106 Q${door.x + 36} 106 ${door.x + 36} 130 V238 Z`}
            fill={door.color}
            stroke="#493a55"
            strokeOpacity="0.35"
            strokeWidth="4"
          />
          <circle cx={door.x + 27} cy="177" r="4" fill="#fff6cb" />
        </g>
      ))}
      <path d="M46 248 H274" stroke="#7e6294" strokeWidth="12" strokeLinecap="round" />
      <circle cx="160" cy="72" r="16" fill="#a66eb7" opacity="0.7" />
    </svg>
  );
}

interface CommunicationDoorArtProps extends ArtProps {
  activityId: CommunicationActivityId;
}

export function CommunicationDoorArt({
  activityId,
  label,
  className,
}: CommunicationDoorArtProps) {
  const ids = useArtIds('screen', 'page');
  return (
    <svg
      viewBox="0 0 180 160"
      className={className}
      {...artA11yProps(`communication-door-${activityId}`, label)}
    >
      {activityId === 'peek' ? (
        <>
          <path d="M32 28 H148 V132 H32 Z" fill="#fff7e5" stroke="#603f45" strokeWidth="7" />
          <path d="M90 28 V132 M32 80 H148" stroke="#603f45" strokeWidth="6" />
          <circle cx="90" cy="80" r="27" fill="#ffffff" stroke="#603f45" strokeWidth="6" />
          <circle cx="90" cy="80" r="12" fill="#6e9fbd" />
          <circle cx="86" cy="75" r="4" fill="#ffffff" />
        </>
      ) : null}
      {activityId === 'phone' ? (
        <>
          <rect x="45" y="22" width="90" height="122" rx="24" fill="#78bd78" stroke="#426b52" strokeWidth="7" />
          <rect x="60" y="37" width="60" height="42" rx="9" fill={`url(#${ids.screen})`} />
          <defs>
            <linearGradient id={ids.screen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#eefaff" />
              <stop offset="100%" stopColor="#acd7e8" />
            </linearGradient>
          </defs>
          {[0, 1, 2].flatMap((row) => [0, 1, 2].map((column) => (
            <circle
              key={`${row}-${column}`}
              cx={72 + column * 18}
              cy={94 + row * 17}
              r="5"
              fill="#fff6cb"
            />
          )))}
        </>
      ) : null}
    </svg>
  );
}
