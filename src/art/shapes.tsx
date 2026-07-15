import type { ArtProps } from './a11y';
import { artA11yProps, useArtIds } from './a11y';
import type { ColorId, ShapeId } from '../domain/types';

const COLOR_STOPS: Record<ColorId, [string, string, string]> = {
  red: ['#ffb0a4', '#ff6a5c', '#9c2a20'],
  blue: ['#a6d8ff', '#4a9fe6', '#2c6fa8'],
  green: ['#c3edb0', '#6bbf5a', '#3f7a30'],
  yellow: ['#fff2b0', '#ffce4a', '#b9821b'],
};

interface ShapeArtProps extends ArtProps {
  shapeId: ShapeId;
  colorId: ColorId;
}

/**
 * A single parametrized shape/color renderer used by the sorting game and
 * anywhere else a stable color+shape token needs an illustrated face
 * instead of a color-only swatch (colour never carries meaning alone).
 */
export function ShapeArt({ shapeId, colorId, label, className }: ShapeArtProps) {
  const ids = useArtIds('grad');
  const [light, mid, dark] = COLOR_STOPS[colorId];
  const artId = `shape-${colorId}-${shapeId}`;

  return (
    <svg viewBox="0 0 160 160" className={className} {...artA11yProps(artId, label)}>
      <defs>
        <radialGradient id={ids.grad} cx="36%" cy="30%" r="78%">
          <stop offset="0%" stopColor={light} />
          <stop offset="60%" stopColor={mid} />
          <stop offset="100%" stopColor={dark} />
        </radialGradient>
      </defs>
      {shapeId === 'circle' ? (
        <circle cx="80" cy="80" r="56" fill={`url(#${ids.grad})`} stroke={dark} strokeOpacity={0.4} strokeWidth={3} />
      ) : null}
      {shapeId === 'square' ? (
        <rect x="26" y="26" width="108" height="108" rx="22" fill={`url(#${ids.grad})`} stroke={dark} strokeOpacity={0.4} strokeWidth={3} />
      ) : null}
      {shapeId === 'triangle' ? (
        <path d="M80 22 L138 128 Q80 148 22 128 Z" fill={`url(#${ids.grad})`} stroke={dark} strokeOpacity={0.4} strokeWidth={3} strokeLinejoin="round" />
      ) : null}
      {shapeId === 'star' ? (
        <path
          d="M80 20 L94 60 L138 60 L102 84 L116 128 L80 102 L44 128 L58 84 L22 60 L66 60 Z"
          fill={`url(#${ids.grad})`}
          stroke={dark}
          strokeOpacity={0.4}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      ) : null}
      <ellipse cx={64} cy={58} rx={16} ry={11} fill="white" opacity={0.38} />
    </svg>
  );
}
