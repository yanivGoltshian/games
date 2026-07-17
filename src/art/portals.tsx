import type { ArtProps } from './a11y';
import { artA11yProps, useArtIds } from './a11y';

/**
 * Enormous, stable-identity portal illustrations for the home carousel.
 * Each domain keeps a consistent color family, composition, and character
 * across sessions so a non-reading toddler recognizes "their" games by sight.
 */

function BackgroundBlob({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <>
      <defs>
        <radialGradient id={id} cx="34%" cy="24%" r="88%">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </radialGradient>
      </defs>
      <rect x="8" y="8" width="304" height="304" rx="88" fill={`url(#${id})`} />
      <path d="M34 228 Q160 180 286 228 V286 Q286 300 270 300 H50 Q34 300 34 284 Z" fill="#ffffff" opacity="0.15" />
      <ellipse cx="160" cy="258" rx="102" ry="18" fill="#3b2b20" opacity="0.1" />
      <path d="M50 76 Q100 24 164 34" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" opacity="0.18" />
      <circle cx="272" cy="64" r="7" fill="#ffffff" opacity="0.48" />
      <circle cx="250" cy="44" r="3.5" fill="#ffffff" opacity="0.42" />
    </>
  );
}

export function ListeningPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'head');
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-listening', label)}>
      <BackgroundBlob id={ids.bg} from="#ffd7b0" to="#ff9a5a" />
      {[0, 1, 2].map((ring) => (
        <path
          key={ring}
          d={`M226 ${118 - ring * 4} Q${266 + ring * 14} ${160} 226 ${202 + ring * 4}`}
          fill="none"
          stroke="#ffffff"
          strokeOpacity={0.55 - ring * 0.12}
          strokeWidth={8}
          strokeLinecap="round"
        />
      ))}
      <defs>
        <radialGradient id={ids.head} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#f4d5a8" />
          <stop offset="100%" stopColor="#cf9c5e" />
        </radialGradient>
      </defs>
      <ellipse cx="112" cy="132" rx="46" ry="58" fill={`url(#${ids.head})`} stroke="#8a6636" strokeOpacity={0.3} strokeWidth={4} transform="rotate(-16 112 132)" />
      <circle cx="160" cy="188" r="86" fill={`url(#${ids.head})`} stroke="#8a6636" strokeOpacity={0.3} strokeWidth={4} />
      <ellipse cx="160" cy="216" rx="40" ry="30" fill="#fff6e6" />
      <circle cx="132" cy="176" r="13" fill="#3a2a18" />
      <circle cx="188" cy="176" r="13" fill="#3a2a18" />
      <ellipse cx="160" cy="204" rx="15" ry="12" fill="#3a2a18" />
      <ellipse cx="128" cy="160" rx="17" ry="13" fill="white" opacity={0.35} />
    </svg>
  );
}

export function CountingPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'apple');
  const clusters = [1, 2, 3];
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-counting', label)}>
      <BackgroundBlob id={ids.bg} from="#fff2b0" to="#ffce4a" />
      <defs>
        <radialGradient id={ids.apple} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffb2a8" />
          <stop offset="100%" stopColor="#d8392f" />
        </radialGradient>
      </defs>
      {clusters.map((count, rowIndex) => (
        <g key={count}>
          {Array.from({ length: count }, (_, dotIndex) => {
            const totalWidth = (count - 1) * 46;
            const x = 160 - totalWidth / 2 + dotIndex * 46;
            const y = 96 + rowIndex * 66;
            return <circle key={dotIndex} cx={x} cy={y} r="19" fill={`url(#${ids.apple})`} stroke="#9c2a20" strokeOpacity={0.3} strokeWidth={2} />;
          })}
        </g>
      ))}
    </svg>
  );
}

export function SortingPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'basketA', 'basketB');
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-sorting', label)}>
      <BackgroundBlob id={ids.bg} from="#d3f0ff" to="#7ec2ee" />
      <defs>
        <linearGradient id={ids.basketA} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffcf8a" />
          <stop offset="100%" stopColor="#e8971a" />
        </linearGradient>
        <linearGradient id={ids.basketB} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c3edb0" />
          <stop offset="100%" stopColor="#6bbf5a" />
        </linearGradient>
      </defs>
      <path d="M74 210 L88 260 Q90 268 100 268 H150 Q160 268 162 260 L176 210 Z" fill={`url(#${ids.basketA})`} stroke="#a1660f" strokeOpacity={0.3} strokeWidth={3} />
      <path d="M64 206 H186 L176 216 H74 Z" fill="#f7b25a" stroke="#a1660f" strokeOpacity={0.3} strokeWidth={2} />
      <path d="M144 210 L158 260 Q160 268 170 268 H220 Q230 268 232 260 L246 210 Z" fill={`url(#${ids.basketB})`} stroke="#3f7a30" strokeOpacity={0.3} strokeWidth={3} />
      <path d="M134 206 H256 L246 216 H144 Z" fill="#8ed46f" stroke="#3f7a30" strokeOpacity={0.3} strokeWidth={2} />
      <circle cx="108" cy="120" r="26" fill="#ff8b7b" stroke="#9c2a20" strokeOpacity={0.3} strokeWidth={3} />
      <rect x="150" y="96" width="46" height="46" rx="10" fill="#7db9ff" stroke="#2c6fa8" strokeOpacity={0.3} strokeWidth={3} transform="rotate(8 173 119)" />
      <path d="M220 150 L238 190 L200 190 Z" fill="#ffd66e" stroke="#b9821b" strokeOpacity={0.3} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

export function PuzzlePortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'piece');
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-puzzle', label)}>
      <BackgroundBlob id={ids.bg} from="#e9dcff" to="#b78bec" />
      <defs>
        <linearGradient id={ids.piece} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffce4a" />
        </linearGradient>
      </defs>
      <path
        d="M110 90 H180 V126 Q198 118 198 140 Q198 162 180 154 V190 H110 V154 Q92 162 92 140 Q92 118 110 126 Z"
        fill={`url(#${ids.piece})`}
        stroke="#b9821b"
        strokeOpacity={0.35}
        strokeWidth={4}
      />
      <path
        d="M180 90 H250 V126 Q268 118 268 140 Q268 162 250 154 V190 H180 V154 Q198 162 198 140 Q198 118 180 126 Z"
        fill="#8fe0ff"
        stroke="#2c6f9c"
        strokeOpacity={0.35}
        strokeWidth={4}
        transform="translate(-140 60)"
      />
      <circle cx="150" cy="230" r="22" fill="#ffce4a" stroke="#b9821b" strokeOpacity={0.3} strokeWidth={3} />
      <circle cx="196" cy="230" r="22" fill="#8fe0ff" stroke="#2c6f9c" strokeOpacity={0.3} strokeWidth={3} />
    </svg>
  );
}

export function MemoryPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'card', 'duck');
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-memory', label)}>
      <BackgroundBlob id={ids.bg} from="#dff5df" to="#8fd48a" />
      <defs>
        <linearGradient id={ids.card} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fdf1e2" />
        </linearGradient>
        <radialGradient id={ids.duck} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffce4a" />
        </radialGradient>
      </defs>
      <rect x="62" y="96" width="88" height="118" rx="20" fill={`url(#${ids.card})`} stroke="#c9a15a" strokeOpacity={0.3} strokeWidth={3} transform="rotate(-6 106 155)" />
      <rect x="168" y="96" width="88" height="118" rx="20" fill={`url(#${ids.card})`} stroke="#c9a15a" strokeOpacity={0.3} strokeWidth={3} transform="rotate(6 212 155)" />
      <circle cx="106" cy="150" r="30" fill={`url(#${ids.duck})`} stroke="#b9821b" strokeOpacity={0.3} strokeWidth={3} transform="rotate(-6 106 155)" />
      <circle cx="212" cy="150" r="30" fill={`url(#${ids.duck})`} stroke="#b9821b" strokeOpacity={0.3} strokeWidth={3} transform="rotate(6 212 155)" />
      <circle cx="96" cy="142" r="5" fill="#3a2a18" transform="rotate(-6 106 155)" />
      <circle cx="202" cy="142" r="5" fill="#3a2a18" transform="rotate(6 212 155)" />
    </svg>
  );
}

export function NumberPairsPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'tileTop', 'tileBottom');
  const tiles = [
    { x: 66, y: 82, value: 2, fill: `url(#${ids.tileTop})` },
    { x: 170, y: 82, value: 5, fill: `url(#${ids.tileTop})` },
    { x: 66, y: 182, value: 5, fill: `url(#${ids.tileBottom})` },
    { x: 170, y: 182, value: 2, fill: `url(#${ids.tileBottom})` },
  ];
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-number-pairs', label)}>
      <BackgroundBlob id={ids.bg} from="#d7fbf5" to="#63d8c7" />
      <defs>
        <linearGradient id={ids.tileTop} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e5f8ff" />
        </linearGradient>
        <linearGradient id={ids.tileBottom} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff9da" />
          <stop offset="100%" stopColor="#ffe98b" />
        </linearGradient>
      </defs>
      {tiles.map((tile) => (
        <g key={`${tile.x}-${tile.y}`}>
          <rect
            x={tile.x}
            y={tile.y}
            width="84"
            height="76"
            rx="22"
            fill={tile.fill}
            stroke="#247d77"
            strokeOpacity="0.28"
            strokeWidth="3"
          />
          <text
            x={tile.x + 42}
            y={tile.y + 55}
            textAnchor="middle"
            fontSize="52"
            fontWeight="900"
            fontFamily="Arial Rounded MT Bold, Arial, sans-serif"
            fill="#245f68"
          >
            {tile.value}
          </text>
        </g>
      ))}
      <path d="M108 162 C108 174 108 174 108 182" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.72" />
      <path d="M212 162 C212 174 212 174 212 182" stroke="#ffffff" strokeWidth="7" strokeLinecap="round" opacity="0.72" />
    </svg>
  );
}

export function SillyAlienPortalArt({ label, className }: ArtProps) {
  const ids = useArtIds('bg', 'body', 'glow');
  return (
    <svg viewBox="0 0 320 320" className={className} {...artA11yProps('portal-silly-alien', label)}>
      <BackgroundBlob id={ids.bg} from="#e4d7ff" to="#8f6bff" />
      <defs>
        <radialGradient id={ids.body} cx="42%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#c8ff9a" />
          <stop offset="100%" stopColor="#5fce6a" />
        </radialGradient>
        <radialGradient id={ids.glow} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff6a8" />
          <stop offset="100%" stopColor="#fff6a8" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* antenna + glowing bulb */}
      <path d="M160 96 Q150 60 176 44" fill="none" stroke="#3f9a4d" strokeWidth="9" strokeLinecap="round" />
      <circle cx="182" cy="40" r="20" fill={`url(#${ids.glow})`} />
      <circle cx="182" cy="40" r="10" fill="#fff08a" stroke="#f6c945" strokeWidth="3" />
      {/* head / body blob */}
      <path
        d="M160 104 C214 104 244 146 244 190 C244 236 208 262 160 262 C112 262 76 236 76 190 C76 146 106 104 160 104 Z"
        fill={`url(#${ids.body})`}
        stroke="#3f9a4d"
        strokeWidth="5"
      />
      {/* two big friendly eyes */}
      <ellipse cx="132" cy="180" rx="26" ry="30" fill="#ffffff" />
      <ellipse cx="188" cy="180" rx="26" ry="30" fill="#ffffff" />
      <circle cx="136" cy="186" r="12" fill="#2c2140" />
      <circle cx="184" cy="186" r="12" fill="#2c2140" />
      <circle cx="140" cy="181" r="4" fill="#ffffff" />
      <circle cx="188" cy="181" r="4" fill="#ffffff" />
      {/* little "oo" mouth — mid-mumble */}
      <ellipse cx="160" cy="226" rx="15" ry="18" fill="#3a7d3f" />
      <ellipse cx="160" cy="222" rx="8" ry="9" fill="#8be08f" />
      {/* rosy cheeks */}
      <circle cx="104" cy="212" r="10" fill="#ff9ecf" opacity="0.6" />
      <circle cx="216" cy="212" r="10" fill="#ff9ecf" opacity="0.6" />
      {/* dropped-sound dots drifting off */}
      <circle cx="256" cy="150" r="7" fill="#ffffff" opacity="0.85" />
      <circle cx="276" cy="130" r="4.5" fill="#ffffff" opacity="0.7" />
      <circle cx="290" cy="116" r="3" fill="#ffffff" opacity="0.5" />
    </svg>
  );
}
