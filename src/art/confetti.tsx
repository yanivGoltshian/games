import type { CSSProperties } from 'react';

interface ConfettiBurstProps {
  richness?: 'standard' | 'milestone';
}

type ConfettiPieceStyle = CSSProperties & {
  '--confetti-color'?: string;
  '--confetti-rotate'?: string;
};

interface Piece {
  left: number;
  delay: number;
  duration: number;
  rotate: number;
  color: string;
  shape: 'streamer' | 'dot' | 'star';
}

const PALETTE = ['#ff9f5a', '#4a9fe6', '#6bbf5a', '#ffce4a', '#e07bd0'];

function buildPieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, index) => {
    const shapeCycle: Piece['shape'][] = ['streamer', 'dot', 'star'];
    return {
      left: ((index * 137.5) % 100),
      delay: (index % 6) * 0.06,
      duration: 0.9 + (index % 5) * 0.12,
      rotate: (index * 47) % 360,
      color: PALETTE[index % PALETTE.length]!,
      shape: shapeCycle[index % shapeCycle.length]!,
    };
  });
}

const STANDARD_PIECES = buildPieces(12);
const MILESTONE_PIECES = buildPieces(20);

/**
 * Tasteful vector/CSS confetti and streamers for the success overlay.
 * Reduced-motion mode (OS or caregiver setting) collapses the fall/spin
 * animation via the shared `--motion-*` tokens while keeping the shapes
 * visible as a calm static flourish.
 */
export function ConfettiBurst({ richness = 'standard' }: ConfettiBurstProps) {
  const pieces = richness === 'milestone' ? MILESTONE_PIECES : STANDARD_PIECES;

  return (
    <div className="confetti-burst" aria-hidden="true">
      {pieces.map((piece, index) => {
        const style: ConfettiPieceStyle = {
          left: `${piece.left}%`,
          animationDelay: `${piece.delay}s`,
          animationDuration: `${piece.duration}s`,
          '--confetti-color': piece.color,
          '--confetti-rotate': `${piece.rotate}deg`,
        };
        return <span key={index} className={`confetti-piece confetti-piece--${piece.shape}`} style={style} />;
      })}
    </div>
  );
}
