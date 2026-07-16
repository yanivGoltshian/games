import { artA11yProps, useArtIds } from './a11y';
import type { CelebrationVariant } from '../games/celebrationVariants';

interface CelebrationSceneProps {
  className?: string;
}

interface CelebrationArtProps extends CelebrationSceneProps {
  variant: CelebrationVariant;
}

function classNames(variant: CelebrationVariant, className?: string): string {
  const parts = ['celebration-art', `celebration-art--${variant}`];
  if (className) {
    parts.push(className);
  }
  return parts.join(' ');
}

function Sparkle({
  x,
  y,
  size,
  rotate = 0,
  className,
  fill = '#fff6cf',
}: {
  x: number;
  y: number;
  size: number;
  rotate?: number;
  className?: string;
  fill?: string;
}) {
  return (
    <path
      className={className}
      transform={`translate(${x} ${y}) rotate(${rotate}) scale(${size / 10})`}
      d="M0 -8 L2 -2 L8 0 L2 2 L0 8 L-2 2 L-8 0 L-2 -2 Z"
      fill={fill}
    />
  );
}

function PuppyConfettiCelebrationArt({ className }: CelebrationSceneProps) {
  const ids = useArtIds('body', 'ear', 'shadow');
  const confetti = [
    { x: 24, y: 18, width: 6, height: 15, rotate: -24, fill: '#ff9f5a', shape: 'streamer' },
    { x: 44, y: 26, width: 6, height: 6, rotate: 8, fill: '#4da0f0', shape: 'dot' },
    { x: 186, y: 18, width: 6, height: 14, rotate: 28, fill: '#7cc96d', shape: 'streamer' },
    { x: 205, y: 36, width: 7, height: 7, rotate: 0, fill: '#ffcf4d', shape: 'dot' },
    { x: 198, y: 58, width: 8, height: 8, rotate: 14, fill: '#d977d1', shape: 'dot' },
    { x: 26, y: 58, width: 8, height: 8, rotate: -12, fill: '#ffcf4d', shape: 'dot' },
  ] as const;

  return (
    <svg
      viewBox="0 0 240 180"
      className={classNames('puppy-confetti', className)}
      data-celebration-variant="puppy-confetti"
      {...artA11yProps('celebration-puppy-confetti')}
    >
      <defs>
        <radialGradient id={ids.body} cx="35%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#ffe6c8" />
          <stop offset="100%" stopColor="#e1a05a" />
        </radialGradient>
        <radialGradient id={ids.ear} cx="30%" cy="24%" r="85%">
          <stop offset="0%" stopColor="#f3c28c" />
          <stop offset="100%" stopColor="#c47f39" />
        </radialGradient>
        <filter id={ids.shadow} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="6" floodColor="#7c4a1f" floodOpacity="0.18" />
        </filter>
      </defs>
      <ellipse cx="121" cy="162" rx="64" ry="11" fill="#7c4a1f" opacity="0.12" />
      {confetti.map((piece) => (
        piece.shape === 'streamer' ? (
          <rect
            key={`${piece.x}-${piece.y}`}
            className="celebration-art__confetti celebration-art__confetti--streamer"
            x={piece.x}
            y={piece.y}
            width={piece.width}
            height={piece.height}
            rx="2"
            fill={piece.fill}
            transform={`rotate(${piece.rotate} ${piece.x + piece.width / 2} ${piece.y + piece.height / 2})`}
          />
        ) : (
          <circle
            key={`${piece.x}-${piece.y}`}
            className="celebration-art__confetti celebration-art__confetti--dot"
            cx={piece.x}
            cy={piece.y}
            r={piece.width / 2}
            fill={piece.fill}
          />
        )
      ))}
      <g filter={`url(#${ids.shadow})`}>
        <g className="celebration-art__tail celebration-art__wiggle">
          <path d="M151 128 Q189 118 183 86 Q180 67 163 71" fill="none" stroke="#d79250" strokeWidth={14} strokeLinecap="round" />
          <path d="M160 74 Q171 72 176 86" fill="none" stroke="#f1c695" strokeWidth={5} strokeLinecap="round" opacity="0.78" />
        </g>
        <ellipse cx="120" cy="118" rx="48" ry="41" fill={`url(#${ids.body})`} />
        <ellipse cx="120" cy="124" rx="26" ry="30" fill="#fff7ea" />
        <ellipse cx="87" cy="60" rx="23" ry="32" fill={`url(#${ids.ear})`} transform="rotate(-18 87 60)" />
        <ellipse cx="153" cy="60" rx="23" ry="32" fill={`url(#${ids.ear})`} transform="rotate(18 153 60)" />
        <circle cx="120" cy="81" r="52" fill={`url(#${ids.body})`} stroke="#8a5f34" strokeOpacity={0.25} strokeWidth={4} />
        <circle cx="101" cy="76" r="7" fill="#352519" />
        <circle cx="139" cy="76" r="7" fill="#352519" />
        <circle cx="98" cy="73" r="2.4" fill="white" />
        <circle cx="136" cy="73" r="2.4" fill="white" />
        <ellipse cx="120" cy="95" rx="10" ry="8" fill="#352519" />
        <path d="M115 93 Q120 89 125 93" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" opacity={0.44} />
        <path d="M104 106 Q120 121 136 106" fill="none" stroke="#352519" strokeWidth={4} strokeLinecap="round" />
        <ellipse cx="82" cy="92" rx="8" ry="5" fill="#db7b6d" opacity="0.18" />
        <ellipse cx="158" cy="92" rx="8" ry="5" fill="#db7b6d" opacity="0.18" />
      </g>
      <Sparkle x={30} y={24} size={8} rotate={8} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={208} y={26} size={7} rotate={-14} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
    </svg>
  );
}

function CakeCandlesCelebrationArt({ className }: CelebrationSceneProps) {
  const ids = useArtIds('cake', 'icing', 'plate', 'flame');

  return (
    <svg
      viewBox="0 0 240 180"
      className={classNames('cake-candles', className)}
      data-celebration-variant="cake-candles"
      {...artA11yProps('celebration-cake-candles')}
    >
      <defs>
        <linearGradient id={ids.cake} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd89f" />
          <stop offset="100%" stopColor="#ec9f46" />
        </linearGradient>
        <linearGradient id={ids.plate} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f3e7d3" />
        </linearGradient>
        <linearGradient id={ids.icing} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff8f0" />
          <stop offset="100%" stopColor="#f3dfc5" />
        </linearGradient>
        <radialGradient id={ids.flame} cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff8b3" />
          <stop offset="100%" stopColor="#ff9f5a" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="161" rx="74" ry="12" fill="#7c4a1f" opacity="0.12" />
      <ellipse cx="120" cy="145" rx="84" ry="13" fill={`url(#${ids.plate})`} />
      <ellipse cx="120" cy="145" rx="84" ry="13" fill="#fff8ea" stroke="#d8c4a2" strokeOpacity={0.35} strokeWidth={3} />
      <path d="M64 94 Q120 74 176 94 V132 Q120 148 64 132 Z" fill={`url(#${ids.cake})`} />
      <path d="M68 88 Q120 68 172 88 V101 Q120 84 68 101 Z" fill={`url(#${ids.icing})`} />
      <path
        className="celebration-art__icing-drip"
        d="M78 90 Q82 96 82 104 Q82 113 76 117 Q72 120 72 127 H84 V110 Q84 101 90 96 Q95 92 96 86 Z"
        fill={`url(#${ids.icing})`}
      />
      <path
        className="celebration-art__icing-drip"
        d="M111 88 Q116 94 116 103 Q116 111 110 117 Q106 120 106 129 H122 V108 Q122 98 128 93 Q133 89 134 84 Z"
        fill={`url(#${ids.icing})`}
      />
      <path
        className="celebration-art__icing-drip"
        d="M146 90 Q150 96 150 103 Q150 111 145 116 Q141 120 141 127 H156 V110 Q156 100 162 95 Q167 91 168 86 Z"
        fill={`url(#${ids.icing})`}
      />
      <path d="M60 132 Q120 152 180 132" fill="none" stroke="#be823c" strokeOpacity={0.2} strokeWidth={6} strokeLinecap="round" />
      <rect x="74" y="76" width="14" height="28" rx="6" fill="#4da0f0" />
      <rect x="113" y="68" width="14" height="36" rx="6" fill="#ff9f5a" />
      <rect x="152" y="76" width="14" height="28" rx="6" fill="#7cc96d" />
      <path d="M81 64 Q88 73 81 82 Q74 73 81 64 Z" fill={`url(#${ids.flame})`} className="celebration-art__flame celebration-art__twinkle" />
      <path d="M120 56 Q128 66 120 76 Q112 66 120 56 Z" fill={`url(#${ids.flame})`} className="celebration-art__flame celebration-art__twinkle" />
      <path d="M159 64 Q166 73 159 82 Q152 73 159 64 Z" fill={`url(#${ids.flame})`} className="celebration-art__flame celebration-art__twinkle" />
      {[
        { x: 82, y: 110, fill: '#ff6a5c' },
        { x: 96, y: 120, fill: '#7cc96d' },
        { x: 120, y: 118, fill: '#4da0f0' },
        { x: 144, y: 108, fill: '#ffcf4d' },
        { x: 162, y: 120, fill: '#d977d1' },
      ].map((sprinkle) => (
        <circle
          key={`${sprinkle.x}-${sprinkle.y}`}
          className="celebration-art__sprinkle"
          cx={sprinkle.x}
          cy={sprinkle.y}
          r="3.5"
          fill={sprinkle.fill}
        />
      ))}
      <Sparkle x={34} y={34} size={8} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={202} y={38} size={9} rotate={18} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
    </svg>
  );
}

function BalloonsCelebrationArt({ className }: CelebrationSceneProps) {
  const ids = useArtIds('balloonA', 'balloonB', 'balloonC', 'tie');

  return (
    <svg
      viewBox="0 0 240 180"
      className={classNames('balloons', className)}
      data-celebration-variant="balloons"
      {...artA11yProps('celebration-balloons')}
    >
      <defs>
        <radialGradient id={ids.balloonA} cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#ffd0c4" />
          <stop offset="100%" stopColor="#ff7f70" />
        </radialGradient>
        <radialGradient id={ids.balloonB} cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#d3f0ff" />
          <stop offset="100%" stopColor="#4da0f0" />
        </radialGradient>
        <radialGradient id={ids.balloonC} cx="34%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#dff6cf" />
          <stop offset="100%" stopColor="#7cc96d" />
        </radialGradient>
      </defs>
      <ellipse cx="121" cy="161" rx="64" ry="12" fill="#7c4a1f" opacity="0.12" />
      <path d="M73 46 Q94 38 102 56 Q108 70 100 84 Q92 96 73 102 Q54 96 46 84 Q38 70 44 56 Q52 38 73 46 Z" fill={`url(#${ids.balloonA})`} className="celebration-art__balloon celebration-art__float" />
      <path d="M121 32 Q145 24 156 46 Q165 64 156 80 Q145 96 121 102 Q97 96 86 80 Q77 64 86 46 Q97 24 121 32 Z" fill={`url(#${ids.balloonB})`} className="celebration-art__balloon celebration-art__float" />
      <path d="M169 48 Q188 40 196 56 Q203 70 196 84 Q188 98 169 104 Q150 98 142 84 Q135 70 142 56 Q150 40 169 48 Z" fill={`url(#${ids.balloonC})`} className="celebration-art__balloon celebration-art__float" />
      <path d="M73 102 L68 112" stroke="#7a4b23" strokeWidth={2} strokeLinecap="round" />
      <path d="M121 102 L120 112" stroke="#7a4b23" strokeWidth={2} strokeLinecap="round" />
      <path d="M169 104 L173 114" stroke="#7a4b23" strokeWidth={2} strokeLinecap="round" />
      <path d="M68 112 Q80 121 73 134" fill="none" stroke="#7a4b23" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M120 112 Q128 123 121 138" fill="none" stroke="#7a4b23" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M173 114 Q182 126 175 140" fill="none" stroke="#7a4b23" strokeWidth={2.5} strokeLinecap="round" />
      <path d="M70 134 Q83 126 90 134 Q83 142 70 134 Z" fill="#ff9f5a" opacity={0.9} />
      <path d="M118 138 Q131 130 138 138 Q131 146 118 138 Z" fill="#4da0f0" opacity={0.9} />
      <path d="M171 140 Q184 132 191 140 Q184 148 171 140 Z" fill="#7cc96d" opacity={0.9} />
      <Sparkle x={30} y={50} size={8} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={212} y={52} size={9} rotate={16} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={26} y={124} size={7} rotate={-8} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
    </svg>
  );
}

function RainbowHopCelebrationArt({ className }: CelebrationSceneProps) {
  const ids = useArtIds('rainbow', 'hop');

  return (
    <svg
      viewBox="0 0 240 180"
      className={classNames('rainbow-hop', className)}
      data-celebration-variant="rainbow-hop"
      {...artA11yProps('celebration-rainbow-hop')}
    >
      <defs>
        <linearGradient id={ids.rainbow} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff7f70" />
          <stop offset="25%" stopColor="#ff9f5a" />
          <stop offset="50%" stopColor="#ffcf4d" />
          <stop offset="75%" stopColor="#7cc96d" />
          <stop offset="100%" stopColor="#4da0f0" />
        </linearGradient>
        <radialGradient id={ids.hop} cx="35%" cy="30%" r="82%">
          <stop offset="0%" stopColor="#fff7d1" />
          <stop offset="100%" stopColor="#ffd66a" />
        </radialGradient>
      </defs>
      <ellipse cx="120" cy="160" rx="78" ry="12" fill="#7c4a1f" opacity="0.12" />
      <path d="M44 126 Q120 46 196 126" fill="none" stroke="#ff7f70" strokeWidth={14} strokeLinecap="round" className="celebration-art__rainbow celebration-art__hop" />
      <path d="M52 126 Q120 54 188 126" fill="none" stroke="#ff9f5a" strokeWidth={12} strokeLinecap="round" className="celebration-art__rainbow celebration-art__hop" />
      <path d="M60 126 Q120 62 180 126" fill="none" stroke="#ffcf4d" strokeWidth={10} strokeLinecap="round" className="celebration-art__rainbow celebration-art__hop" />
      <path d="M68 126 Q120 70 172 126" fill="none" stroke="#7cc96d" strokeWidth={8} strokeLinecap="round" className="celebration-art__rainbow celebration-art__hop" />
      <path d="M76 126 Q120 78 164 126" fill="none" stroke="#4da0f0" strokeWidth={6} strokeLinecap="round" className="celebration-art__rainbow celebration-art__hop" />
      <circle cx="120" cy="78" r="19" fill={`url(#${ids.hop})`} className="celebration-art__star" />
      <Sparkle x={120} y={78} size={10} className="celebration-art__sparkle celebration-art__sparkle--twinkle" fill="#fff8d6" />
      <Sparkle x={52} y={56} size={7} rotate={10} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={190} y={58} size={8} rotate={-12} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <path d="M92 135 Q100 123 108 135" fill="none" stroke="#7c4a1f" strokeWidth={3} strokeLinecap="round" className="celebration-art__footprint" />
      <path d="M132 135 Q140 123 148 135" fill="none" stroke="#7c4a1f" strokeWidth={3} strokeLinecap="round" className="celebration-art__footprint" />
    </svg>
  );
}

function TrophySparkCelebrationArt({ className }: CelebrationSceneProps) {
  const ids = useArtIds('cup', 'shine', 'base');

  return (
    <svg
      viewBox="0 0 240 180"
      className={classNames('trophy-spark', className)}
      data-celebration-variant="trophy-spark"
      {...artA11yProps('celebration-trophy-spark')}
    >
      <defs>
        <radialGradient id={ids.cup} cx="35%" cy="26%" r="82%">
          <stop offset="0%" stopColor="#fff2b0" />
          <stop offset="100%" stopColor="#ffcf4d" />
        </radialGradient>
        <linearGradient id={ids.base} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd09a" />
          <stop offset="100%" stopColor="#e49734" />
        </linearGradient>
      </defs>
      <ellipse cx="120" cy="161" rx="70" ry="12" fill="#7c4a1f" opacity="0.12" />
      <path d="M82 54 H158 V78 Q158 122 120 132 Q82 122 82 78 Z" fill={`url(#${ids.cup})`} className="celebration-art__trophy" />
      <path d="M76 60 H82 Q80 84 66 92 Q58 96 52 88 Q62 70 76 60 Z" fill={`url(#${ids.cup})`} className="celebration-art__trophy" />
      <path d="M164 60 H158 Q160 84 174 92 Q182 96 188 88 Q178 70 164 60 Z" fill={`url(#${ids.cup})`} className="celebration-art__trophy" />
      <path d="M108 132 H132 V146 Q132 150 136 150 H148 V156 H92 V150 H104 Q108 150 108 146 Z" fill={`url(#${ids.base})`} />
      <path d="M100 86 Q120 100 140 86" fill="none" stroke="#b9821b" strokeOpacity={0.24} strokeWidth={5} strokeLinecap="round" />
      <path d="M96 96 Q120 112 144 96" fill="none" stroke="#b9821b" strokeOpacity={0.18} strokeWidth={4} strokeLinecap="round" />
      <circle cx="120" cy="74" r="17" fill="#ff7f70" opacity={0.18} />
      <Sparkle x={120} y={74} size={12} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={54} y={50} size={8} rotate={12} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={186} y={52} size={9} rotate={-16} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={70} y={118} size={7} rotate={-10} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <Sparkle x={172} y={118} size={7} rotate={18} className="celebration-art__sparkle celebration-art__sparkle--twinkle" />
      <path d="M104 34 Q120 18 136 34" fill="none" stroke="#ffcf4d" strokeWidth={4} strokeLinecap="round" className="celebration-art__ribbon" />
    </svg>
  );
}

const CELEBRATION_ART_COMPONENTS = {
  'puppy-confetti': PuppyConfettiCelebrationArt,
  'cake-candles': CakeCandlesCelebrationArt,
  balloons: BalloonsCelebrationArt,
  'rainbow-hop': RainbowHopCelebrationArt,
  'trophy-spark': TrophySparkCelebrationArt,
} satisfies Record<CelebrationVariant, (props: CelebrationSceneProps) => React.JSX.Element>;

export { BalloonsCelebrationArt, CakeCandlesCelebrationArt, PuppyConfettiCelebrationArt, RainbowHopCelebrationArt, TrophySparkCelebrationArt };

export function CelebrationArt({ variant, className }: CelebrationArtProps) {
  const Scene = CELEBRATION_ART_COMPONENTS[variant];
  return className ? <Scene className={className} /> : <Scene />;
}
