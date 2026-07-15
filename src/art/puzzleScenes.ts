import type { PuzzleScene } from '../domain/types';

/**
 * Puzzle background scenes. Each scene exposes a self-contained SVG markup
 * string (used as a sliced background-image so jigsaw pieces reveal the
 * right fragment) built from the same warm editorial-vector conventions as
 * the rest of the art library: gradients, a soft highlight, and a stroke.
 */

function wrapScene(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">${inner}</svg>`.trim();
}

function fishSceneMarkup(): string {
  return wrapScene(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#bdeaff" />
        <stop offset="100%" stop-color="#79c9ec" />
      </linearGradient>
      <linearGradient id="fish" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#ffce8a" />
        <stop offset="100%" stop-color="#f08b47" />
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="56" fill="url(#bg)" />
    <circle cx="90" cy="90" r="26" fill="#ffffff" opacity="0.4" />
    <circle cx="140" cy="70" r="14" fill="#ffffff" opacity="0.3" />
    <path d="M110 220 Q190 130 300 190 Q340 205 340 230 Q340 255 300 268 Q190 328 110 240 Z" fill="url(#fish)" stroke="#b9611f" stroke-opacity="0.35" stroke-width="6" />
    <path d="M300 190 L360 150 L344 230 L360 308 L300 268 Z" fill="url(#fish)" stroke="#b9611f" stroke-opacity="0.35" stroke-width="6" />
    <circle cx="168" cy="216" r="12" fill="#3a2a18" />
    <path d="M150 260 Q220 292 280 258" fill="none" stroke="#b9611f" stroke-width="6" stroke-linecap="round" opacity="0.4" />
    <ellipse cx="150" cy="180" rx="24" ry="16" fill="#ffffff" opacity="0.32" />
  `);
}

function sunSceneMarkup(): string {
  return wrapScene(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff2c2" />
        <stop offset="100%" stop-color="#ffcf7a" />
      </linearGradient>
      <radialGradient id="sun" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stop-color="#fff6c8" />
        <stop offset="100%" stop-color="#ffb54a" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" rx="56" fill="url(#bg)" />
    <path d="M0 320 Q200 260 400 320 V400 H0 Z" fill="#ffe19a" opacity="0.6" />
    ${Array.from({ length: 10 }, (_, index) => {
      const angle = (index / 10) * Math.PI * 2;
      const cx = 200 + Math.cos(angle) * 100;
      const cy = 170 + Math.sin(angle) * 100;
      const cx2 = 200 + Math.cos(angle) * 138;
      const cy2 = 170 + Math.sin(angle) * 138;
      return `<line x1="${cx}" y1="${cy}" x2="${cx2}" y2="${cy2}" stroke="#ffb54a" stroke-width="12" stroke-linecap="round" />`;
    }).join('')}
    <circle cx="200" cy="170" r="80" fill="url(#sun)" stroke="#d5842a" stroke-opacity="0.3" stroke-width="6" />
    <ellipse cx="168" cy="140" rx="22" ry="16" fill="#ffffff" opacity="0.4" />
  `);
}

function teddySceneMarkup(): string {
  return wrapScene(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#ffe6d2" />
        <stop offset="100%" stop-color="#f0c299" />
      </linearGradient>
      <radialGradient id="fur" cx="35%" cy="30%" r="78%">
        <stop offset="0%" stop-color="#eccaa2" />
        <stop offset="100%" stop-color="#b9814e" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" rx="56" fill="url(#bg)" />
    <circle cx="140" cy="130" r="42" fill="url(#fur)" stroke="#8a5f34" stroke-opacity="0.3" stroke-width="6" />
    <circle cx="260" cy="130" r="42" fill="url(#fur)" stroke="#8a5f34" stroke-opacity="0.3" stroke-width="6" />
    <circle cx="200" cy="220" r="120" fill="url(#fur)" stroke="#8a5f34" stroke-opacity="0.3" stroke-width="6" />
    <ellipse cx="200" cy="252" rx="56" ry="42" fill="#fbeadb" />
    <circle cx="164" cy="200" r="15" fill="#3a2a18" />
    <circle cx="236" cy="200" r="15" fill="#3a2a18" />
    <ellipse cx="200" cy="238" rx="17" ry="13" fill="#3a2a18" />
    <ellipse cx="150" cy="176" rx="22" ry="16" fill="#ffffff" opacity="0.32" />
  `);
}

function flowerSceneMarkup(): string {
  return wrapScene(`
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#fff7cf" />
        <stop offset="100%" stop-color="#dff0b0" />
      </linearGradient>
      <radialGradient id="petal" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fff2fb" />
        <stop offset="100%" stop-color="#f2a8d8" />
      </radialGradient>
      <radialGradient id="center" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stop-color="#fff2b0" />
        <stop offset="100%" stop-color="#ffce4a" />
      </radialGradient>
    </defs>
    <rect width="400" height="400" rx="56" fill="url(#bg)" />
    <path d="M200 260 V360" stroke="#5f9a4e" stroke-width="16" stroke-linecap="round" fill="none" />
    <path d="M200 300 Q240 300 250 330" stroke="#5f9a4e" stroke-width="10" stroke-linecap="round" fill="none" />
    ${Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * Math.PI * 2;
      const cx = 200 + Math.cos(angle) * 70;
      const cy = 180 + Math.sin(angle) * 70;
      const deg = (angle * 180) / Math.PI;
      return `<ellipse cx="${cx}" cy="${cy}" rx="52" ry="38" fill="url(#petal)" stroke="#c96fb0" stroke-opacity="0.3" stroke-width="4" transform="rotate(${deg} ${cx} ${cy})" />`;
    }).join('')}
    <circle cx="200" cy="180" r="48" fill="url(#center)" stroke="#c98a1a" stroke-opacity="0.3" stroke-width="4" />
  `);
}

interface PuzzleSceneDefinition extends PuzzleScene {
  markup: () => string;
}

export const PUZZLE_SCENES: PuzzleSceneDefinition[] = [
  { id: 'fishy', titleHe: 'דג', titleEn: 'fish', markup: fishSceneMarkup },
  { id: 'sunny', titleHe: 'שמש', titleEn: 'sun', markup: sunSceneMarkup },
  { id: 'teddy', titleHe: 'דובי', titleEn: 'teddy', markup: teddySceneMarkup },
  { id: 'flower', titleHe: 'פרח', titleEn: 'flower', markup: flowerSceneMarkup },
];

export function sceneBackgroundImage(scene: PuzzleScene): string {
  const definition = PUZZLE_SCENES.find((item) => item.id === scene.id) ?? PUZZLE_SCENES[0]!;
  return `url("data:image/svg+xml;charset=UTF-8,${encodeURIComponent(definition.markup())}")`;
}
