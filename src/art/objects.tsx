import type { ArtProps } from './a11y';
import { artA11yProps, useArtIds } from './a11y';

/**
 * Warm editorial-vector object icons. Every icon shares a 0-160 viewBox,
 * a two-stop gradient body, a soft highlight, and a matching stroke so the
 * whole set reads as one coherent illustrated set. Stable art ids are used
 * both for automated tests and for future asset tooling.
 */

const STROKE_OPACITY = 0.32;

function Highlight({ cx, cy, rx, ry }: { cx: number; cy: number; rx: number; ry: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" opacity={0.4} />;
}

export function BallArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-ball', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffe3b0" />
          <stop offset="55%" stopColor="#ff9f5a" />
          <stop offset="100%" stopColor="#e8712f" />
        </radialGradient>
      </defs>
      <circle cx="80" cy="82" r="62" fill={`url(#${ids.grad})`} stroke="#a9481a" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M22 82 Q80 108 138 82" fill="none" stroke="#c65a22" strokeWidth={5} strokeLinecap="round" opacity={0.55} />
      <path d="M80 20 Q106 82 80 144" fill="none" stroke="#c65a22" strokeWidth={5} strokeLinecap="round" opacity={0.4} />
      <Highlight cx={58} cy={56} rx={20} ry={14} />
    </svg>
  );
}

export function CarArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-car', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7fd0ff" />
          <stop offset="100%" stopColor="#3f9fe0" />
        </linearGradient>
      </defs>
      <rect x="18" y="86" width="124" height="34" rx="14" fill={`url(#${ids.grad})`} stroke="#2c6fa8" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M36 88 Q50 52 82 52 H108 Q128 52 132 88 Z" fill={`url(#${ids.grad})`} stroke="#2c6fa8" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M56 56 L50 84 H92 L88 56 Z" fill="#eaf8ff" opacity={0.85} />
      <circle cx="52" cy="122" r="16" fill="#3a3630" />
      <circle cx="52" cy="122" r="7" fill="#dfe6ea" />
      <circle cx="112" cy="122" r="16" fill="#3a3630" />
      <circle cx="112" cy="122" r="7" fill="#dfe6ea" />
      <Highlight cx={64} cy={64} rx={12} ry={7} />
    </svg>
  );
}

export function BananaArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-banana', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffce4a" />
        </linearGradient>
      </defs>
      <path
        d="M40 128 C34 96 46 56 84 34 C96 27 108 30 108 40 C108 48 98 50 90 56 C64 74 58 104 70 122 C78 133 96 132 110 118 C114 114 121 118 117 124 C100 146 62 150 44 138 C41 136 40 132 40 128 Z"
        fill={`url(#${ids.grad})`}
        stroke="#b9821b"
        strokeOpacity={STROKE_OPACITY}
        strokeWidth={3}
      />
      <path d="M96 36 C102 32 110 33 112 40" fill="none" stroke="#7a5a22" strokeWidth={4} strokeLinecap="round" />
      <Highlight cx={64} cy={72} rx={10} ry={22} />
    </svg>
  );
}

export function AppleArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-apple', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#ffb2a8" />
          <stop offset="60%" stopColor="#ff6a5c" />
          <stop offset="100%" stopColor="#d8392f" />
        </radialGradient>
      </defs>
      <path
        d="M80 58 C58 38 24 46 22 78 C20 112 48 138 74 138 C78 138 82 136 80 136 C78 136 82 138 86 138 C112 138 140 112 138 78 C136 46 102 38 80 58 Z"
        fill={`url(#${ids.grad})`}
        stroke="#9c2a20"
        strokeOpacity={STROKE_OPACITY}
        strokeWidth={3}
      />
      <path d="M80 58 C80 46 76 34 66 26" fill="none" stroke="#7a4a20" strokeWidth={5} strokeLinecap="round" />
      <path d="M80 34 C92 24 104 26 108 34" fill="none" stroke="#4f8c3f" strokeWidth={8} strokeLinecap="round" />
      <Highlight cx={56} cy={80} rx={14} ry={20} />
    </svg>
  );
}

export function BookArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-book', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#8fd0ff" />
          <stop offset="100%" stopColor="#4a9fe6" />
        </linearGradient>
      </defs>
      <path d="M30 40 Q80 26 80 46 V128 Q80 108 30 122 Z" fill={`url(#${ids.grad})`} stroke="#2c6fa8" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M130 40 Q80 26 80 46 V128 Q80 108 130 122 Z" fill="#ffe3a8" stroke="#b98a2c" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M42 60 Q70 52 70 60" fill="none" stroke="#eaf8ff" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      <path d="M42 78 Q70 70 70 78" fill="none" stroke="#eaf8ff" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
      <path d="M118 60 Q90 52 90 60" fill="none" stroke="#fff6dd" strokeWidth={4} strokeLinecap="round" opacity={0.8} />
    </svg>
  );
}

export function CupArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-cup', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dce8ef" />
        </linearGradient>
      </defs>
      <path d="M44 54 H116 L108 132 Q106 140 96 140 H64 Q54 140 52 132 Z" fill={`url(#${ids.grad})`} stroke="#8fa6b3" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M116 62 Q140 62 138 84 Q136 104 112 100" fill="none" stroke="#8fa6b3" strokeOpacity={0.5} strokeWidth={6} />
      <path d="M60 54 C60 40 100 40 100 54" fill="#bfe6ff" opacity={0.9} />
      <Highlight cx={68} cy={78} rx={8} ry={20} />
    </svg>
  );
}

export function ShoeArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-shoe', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff9db0" />
          <stop offset="100%" stopColor="#e85a7c" />
        </linearGradient>
      </defs>
      <path
        d="M24 118 Q22 96 46 92 L74 84 Q86 64 108 68 L124 72 Q140 78 138 100 Q136 118 116 120 H30 Q24 120 24 118 Z"
        fill={`url(#${ids.grad})`}
        stroke="#9c3350"
        strokeOpacity={STROKE_OPACITY}
        strokeWidth={3}
      />
      <path d="M46 92 Q60 100 74 84" fill="none" stroke="#fff4f6" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
      <rect x="24" y="118" width="114" height="12" rx="6" fill="#5a4032" />
    </svg>
  );
}

export function SunArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-sun', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="100%" stopColor="#ffb54a" />
        </radialGradient>
      </defs>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        const x1 = 80 + Math.cos(angle) * 56;
        const y1 = 80 + Math.sin(angle) * 56;
        const x2 = 80 + Math.cos(angle) * 74;
        const y2 = 80 + Math.sin(angle) * 74;
        return <line key={index} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffb54a" strokeWidth={7} strokeLinecap="round" />;
      })}
      <circle cx="80" cy="80" r="42" fill={`url(#${ids.grad})`} stroke="#d5842a" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <Highlight cx={64} cy={64} rx={12} ry={9} />
    </svg>
  );
}

export function FlowerArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad', 'center');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('object-flower', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff2fb" />
          <stop offset="100%" stopColor="#f2a8d8" />
        </radialGradient>
        <radialGradient id={ids.center} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffce4a" />
        </radialGradient>
      </defs>
      <path d="M80 122 V150" stroke="#5f9a4e" strokeWidth={7} strokeLinecap="round" fill="none" />
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2;
        const cx = 80 + Math.cos(angle) * 30;
        const cy = 76 + Math.sin(angle) * 30;
        return <ellipse key={index} cx={cx} cy={cy} rx={22} ry={16} fill={`url(#${ids.grad})`} stroke="#c96fb0" strokeOpacity={STROKE_OPACITY} strokeWidth={2} transform={`rotate(${(angle * 180) / Math.PI} ${cx} ${cy})`} />;
      })}
      <circle cx="80" cy="76" r="20" fill={`url(#${ids.center})`} stroke="#c98a1a" strokeOpacity={STROKE_OPACITY} strokeWidth={2} />
    </svg>
  );
}

export function DogArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-dog', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f4d5a8" />
          <stop offset="100%" stopColor="#cf9c5e" />
        </radialGradient>
      </defs>
      <ellipse cx="52" cy="52" rx="24" ry="30" fill={`url(#${ids.grad})`} stroke="#8a6636" strokeOpacity={STROKE_OPACITY} strokeWidth={3} transform="rotate(-18 52 52)" />
      <ellipse cx="108" cy="52" rx="24" ry="30" fill={`url(#${ids.grad})`} stroke="#8a6636" strokeOpacity={STROKE_OPACITY} strokeWidth={3} transform="rotate(18 108 52)" />
      <circle cx="80" cy="88" r="46" fill={`url(#${ids.grad})`} stroke="#8a6636" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <ellipse cx="80" cy="104" rx="22" ry="16" fill="#fff6e6" />
      <circle cx="64" cy="80" r="7" fill="#3a2a18" />
      <circle cx="96" cy="80" r="7" fill="#3a2a18" />
      <ellipse cx="80" cy="100" rx="9" ry="7" fill="#3a2a18" />
      <path d="M68 116 Q80 124 92 116" fill="none" stroke="#3a2a18" strokeWidth={4} strokeLinecap="round" />
      <Highlight cx={62} cy={72} rx={10} ry={8} />
    </svg>
  );
}

export function CatArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-cat', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#f3ede6" />
          <stop offset="100%" stopColor="#cbb9a8" />
        </radialGradient>
      </defs>
      <path d="M40 46 L54 20 L64 50 Z" fill={`url(#${ids.grad})`} stroke="#8a7666" strokeOpacity={STROKE_OPACITY} strokeWidth={2} />
      <path d="M120 46 L106 20 L96 50 Z" fill={`url(#${ids.grad})`} stroke="#8a7666" strokeOpacity={STROKE_OPACITY} strokeWidth={2} />
      <circle cx="80" cy="86" r="46" fill={`url(#${ids.grad})`} stroke="#8a7666" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="64" cy="80" r="7" fill="#4a3626" />
      <circle cx="96" cy="80" r="7" fill="#4a3626" />
      <path d="M76 98 Q80 102 84 98" fill="none" stroke="#4a3626" strokeWidth={3} strokeLinecap="round" />
      <path d="M40 96 H62 M40 104 H60 M98 96 H120 M100 104 H120" stroke="#8a7666" strokeWidth={2.5} strokeLinecap="round" />
      <Highlight cx={62} cy={72} rx={10} ry={8} />
    </svg>
  );
}

export function DuckArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad', 'beak');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-duck', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffce4a" />
        </radialGradient>
        <linearGradient id={ids.beak} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffb64a" />
          <stop offset="100%" stopColor="#e88a1a" />
        </linearGradient>
      </defs>
      <ellipse cx="86" cy="100" rx="52" ry="38" fill={`url(#${ids.grad})`} stroke="#b9821b" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="66" cy="58" r="30" fill={`url(#${ids.grad})`} stroke="#b9821b" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M40 58 Q18 60 22 70 Q34 74 44 66 Z" fill={`url(#${ids.beak})`} stroke="#a1660f" strokeOpacity={STROKE_OPACITY} strokeWidth={2} />
      <circle cx="58" cy="50" r="6" fill="#3a2a18" />
      <Highlight cx={52} cy={44} rx={8} ry={6} />
    </svg>
  );
}

export function FishArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-fish', label)}>
      <defs>
        <linearGradient id={ids.grad} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#8fe0ff" />
          <stop offset="100%" stopColor="#3fa8e0" />
        </linearGradient>
      </defs>
      <path d="M30 82 Q60 40 116 60 Q140 68 140 82 Q140 96 116 104 Q60 124 30 82 Z" fill={`url(#${ids.grad})`} stroke="#2c6f9c" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M116 60 L142 42 L134 82 L142 122 L116 104 Z" fill={`url(#${ids.grad})`} stroke="#2c6f9c" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="56" cy="76" r="6" fill="#1e3a4a" />
      <path d="M60 96 Q80 108 100 96" fill="none" stroke="#1e5a7a" strokeWidth={4} strokeLinecap="round" opacity={0.5} />
      <Highlight cx={48} cy={66} rx={10} ry={8} />
    </svg>
  );
}

export function BirdArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad', 'beak');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-bird', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#bfe0ff" />
          <stop offset="100%" stopColor="#5a9bd8" />
        </radialGradient>
        <linearGradient id={ids.beak} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffce6a" />
          <stop offset="100%" stopColor="#e8971a" />
        </linearGradient>
      </defs>
      <ellipse cx="86" cy="96" rx="44" ry="38" fill={`url(#${ids.grad})`} stroke="#31688f" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="60" cy="60" r="26" fill={`url(#${ids.grad})`} stroke="#31688f" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <path d="M36 60 Q18 62 24 70 Q34 72 40 64 Z" fill={`url(#${ids.beak})`} stroke="#a1660f" strokeOpacity={STROKE_OPACITY} strokeWidth={2} />
      <circle cx="54" cy="52" r="5" fill="#22334a" />
      <path d="M108 90 Q136 84 140 100 Q120 110 104 104 Z" fill="#3f83bd" opacity={0.85} />
      <Highlight cx={48} cy={48} rx={7} ry={5} />
    </svg>
  );
}

export function BearArt({ label, className }: ArtProps) {
  const ids = useArtIds('grad');
  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps('animal-bear', label)}>
      <defs>
        <radialGradient id={ids.grad} cx="35%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#e8c39a" />
          <stop offset="100%" stopColor="#b9814e" />
        </radialGradient>
      </defs>
      <circle cx="46" cy="46" r="18" fill={`url(#${ids.grad})`} stroke="#8a5f34" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="114" cy="46" r="18" fill={`url(#${ids.grad})`} stroke="#8a5f34" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <circle cx="80" cy="90" r="50" fill={`url(#${ids.grad})`} stroke="#8a5f34" strokeOpacity={STROKE_OPACITY} strokeWidth={3} />
      <ellipse cx="80" cy="102" rx="24" ry="18" fill="#fbeadb" />
      <circle cx="62" cy="82" r="7" fill="#3a2a18" />
      <circle cx="98" cy="82" r="7" fill="#3a2a18" />
      <ellipse cx="80" cy="98" rx="8" ry="6" fill="#3a2a18" />
      <Highlight cx={62} cy={72} rx={10} ry={8} />
    </svg>
  );
}

const OBJECT_ART: Record<string, (props: ArtProps) => React.JSX.Element> = {
  ball: BallArt,
  car: CarArt,
  banana: BananaArt,
  apple: AppleArt,
  book: BookArt,
  cup: CupArt,
  shoe: ShoeArt,
  sun: SunArt,
  flower: FlowerArt,
  dog: DogArt,
  cat: CatArt,
  duck: DuckArt,
  fish: FishArt,
  bird: BirdArt,
  bear: BearArt,
};

const REALISTIC_ASSETS: Record<string, string> = {
  apple: '/assets/vocabulary/apple.webp',
  duck: '/assets/vocabulary/duck.webp',
  bird: '/assets/vocabulary/bird.webp',
  sun: '/assets/vocabulary/sun.webp',
};

export interface ConceptArtProps extends ArtProps {
  conceptId: string;
}

/** Generic dispatcher used by content that only knows a stable concept id. */
export function ConceptArt({ conceptId, label, className }: ConceptArtProps) {
  const realisticAsset = REALISTIC_ASSETS[conceptId];
  if (realisticAsset) {
    return (
      <img
        src={realisticAsset}
        alt={label ?? ''}
        aria-hidden={label ? undefined : 'true'}
        className={`concept-photo ${className ?? ''}`.trim()}
        data-art-id={`photo-${conceptId}`}
        draggable={false}
        decoding="async"
      />
    );
  }
  const Component = OBJECT_ART[conceptId];
  if (!Component) {
    return null;
  }
  return <Component {...(label ? { label } : {})} {...(className ? { className } : {})} />;
}
