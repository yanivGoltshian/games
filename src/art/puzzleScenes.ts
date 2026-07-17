import type { PuzzleScene } from '../domain/types';
import { conceptAssetHref } from './conceptAssets';

const svgDataUri = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const BLUE_FOREST_PARTY = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#71c9ff"/><stop offset="1" stop-color="#dff7ff"/></linearGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#65b96b"/><stop offset="1" stop-color="#2e7d57"/></linearGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#sky)"/>
  <circle cx="820" cy="150" r="78" fill="#fff3a6"/>
  <path d="M0 610 Q180 520 360 620 T720 600 T1000 590 V1000 H0Z" fill="url(#ground)"/>
  <g fill="#276b67"><path d="M85 620L165 210l80 410Z"/><path d="M710 620l95-430 105 430Z"/></g>
  <g fill="#4a99a8"><circle cx="165" cy="250" r="112"/><circle cx="805" cy="230" r="128"/></g>
  <path d="M210 340 Q500 470 790 330" fill="none" stroke="#f7d85b" stroke-width="18"/>
  <g fill="#287bc0"><path d="M250 360l40 70 40-58Z"/><path d="M370 395l40 70 40-55Z"/><path d="M490 408l40 70 40-68Z"/><path d="M610 390l40 70 40-78Z"/></g>
  <g transform="translate(390 545)">
    <ellipse cx="110" cy="260" rx="165" ry="48" fill="#1d5945" opacity=".3"/>
    <ellipse cx="110" cy="150" rx="145" ry="120" fill="#4386bd"/>
    <circle cx="110" cy="50" r="92" fill="#69aee0"/>
    <path d="M35 15Q-10-45 30-70Q80-60 82 5M185 15q45-60 5-85q-50 10-52 75" fill="#4386bd"/>
    <circle cx="78" cy="42" r="11" fill="#17344f"/><circle cx="143" cy="42" r="11" fill="#17344f"/>
    <ellipse cx="110" cy="78" rx="20" ry="15" fill="#17344f"/>
    <path d="M78 102q32 35 65 0" fill="none" stroke="#17344f" stroke-width="9" stroke-linecap="round"/>
    <path d="M-5 150q-90-55-105 15M225 150q90-55 105 15" fill="none" stroke="#69aee0" stroke-width="34" stroke-linecap="round"/>
  </g>
  <g fill="#eef8ff"><circle cx="140" cy="760" r="18"/><circle cx="250" cy="840" r="13"/><circle cx="770" cy="770" r="17"/><circle cx="870" cy="850" r="12"/></g>
</svg>`);

const RESCUE_PLANES = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs><linearGradient id="air" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#51b8ee"/><stop offset="1" stop-color="#eefaff"/></linearGradient></defs>
  <rect width="1000" height="1000" fill="url(#air)"/>
  <g fill="#fff" opacity=".9"><ellipse cx="150" cy="180" rx="120" ry="45"/><ellipse cx="250" cy="160" rx="90" ry="60"/><ellipse cx="790" cy="250" rx="145" ry="55"/><ellipse cx="890" cy="220" rx="90" ry="62"/></g>
  <path d="M0 740L210 500l150 165 180-260 260 335 200-95v355H0Z" fill="#6f9a8c"/>
  <path d="M0 820l250-180 160 150 210-220 210 190 170-80v320H0Z" fill="#3d7168"/>
  <path d="M350 100C530 140 680 250 790 410" fill="none" stroke="#fff" stroke-width="20" stroke-dasharray="35 30" opacity=".75"/>
  <g transform="translate(210 300) rotate(-8 280 180)">
    <path d="M75 175Q260 60 500 150L610 200 505 230Q265 250 75 205Z" fill="#ff8c42" stroke="#8b4c30" stroke-width="10"/>
    <path d="M265 140L360 15 430 35 390 155Z" fill="#ffd166" stroke="#8b4c30" stroke-width="10"/>
    <path d="M250 220L395 330 460 300 380 215Z" fill="#ffd166" stroke="#8b4c30" stroke-width="10"/>
    <path d="M155 170L75 75 35 95 90 185Z" fill="#f25f5c" stroke="#8b4c30" stroke-width="9"/>
    <ellipse cx="505" cy="187" rx="75" ry="48" fill="#f7fbff"/>
    <circle cx="70" cy="190" r="48" fill="#2f4858"/><circle cx="70" cy="190" r="16" fill="#d8f3dc"/>
    <g fill="#2f4858"><circle cx="282" cy="170" r="15"/><circle cx="330" cy="163" r="15"/></g>
    <path d="M286 202q28 24 57-4" fill="none" stroke="#2f4858" stroke-width="10" stroke-linecap="round"/>
  </g>
  <g transform="translate(680 520) scale(.48)">
    <path d="M0 150Q190 35 430 125l110 55-105 32Q195 230 0 182Z" fill="#4cc9a6" stroke="#28666e" stroke-width="14"/>
    <path d="M205 118L300 0l75 25-45 110Z" fill="#f9c74f" stroke="#28666e" stroke-width="14"/>
    <circle cx="20" cy="170" r="55" fill="#28666e"/>
  </g>
  <path d="M720 875h180l-30-95H750Z" fill="#f5f3e7"/><rect x="785" y="810" width="50" height="65" fill="#ef476f"/>
</svg>`);

const GIANT_CARROT_GARDEN = svgDataUri(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="sunny" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#8ed6ff"/><stop offset="1" stop-color="#fff4ba"/></linearGradient>
    <linearGradient id="carrot" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffb13b"/><stop offset="1" stop-color="#ef6c2f"/></linearGradient>
  </defs>
  <rect width="1000" height="1000" fill="url(#sunny)"/>
  <circle cx="150" cy="145" r="80" fill="#ffe873"/>
  <path d="M0 620q260-95 510 10t490-10v380H0Z" fill="#6fbf63"/>
  <path d="M0 760q250-80 500 0t500 0v240H0Z" fill="#9a633f"/>
  <g transform="translate(370 180)">
    <path d="M130 250Q20 90 95 0q95 85 90 225Q185 70 285 25q20 125-85 235Q300 135 365 210q-45 95-180 105Z" fill="#3d9b58" stroke="#267146" stroke-width="12"/>
    <path d="M85 280Q170 235 260 275Q285 590 125 735Q-10 555 85 280Z" fill="url(#carrot)" stroke="#a84f2c" stroke-width="14"/>
    <path d="M65 390l90 18M45 485l95 22M65 580l78 20M190 350l80 14M180 460l92 18M165 560l80 20" stroke="#d85b2d" stroke-width="13" stroke-linecap="round"/>
    <circle cx="105" cy="330" r="14" fill="#5b3525"/><circle cx="184" cy="325" r="14" fill="#5b3525"/>
    <path d="M105 370q42 42 83-4" fill="none" stroke="#5b3525" stroke-width="12" stroke-linecap="round"/>
  </g>
  <g fill="#f8f1d0" stroke="#8f6b4a" stroke-width="8">
    <ellipse cx="180" cy="780" rx="88" ry="72"/><ellipse cx="805" cy="810" rx="95" ry="76"/>
  </g>
  <g fill="#6b4b36"><circle cx="155" cy="770" r="10"/><circle cx="205" cy="770" r="10"/><circle cx="780" cy="800" r="10"/><circle cx="832" cy="800" r="10"/></g>
  <path d="M148 807q32 25 65 0M778 837q32 25 65 0" fill="none" stroke="#6b4b36" stroke-width="9" stroke-linecap="round"/>
  <g fill="#fff"><circle cx="80" cy="680" r="12"/><circle cx="260" cy="720" r="10"/><circle cx="725" cy="690" r="12"/><circle cx="920" cy="735" r="11"/></g>
</svg>`);

const PUZZLE_SCENE_IMAGES: Record<string, string> = {
  'blue-forest-party': BLUE_FOREST_PARTY,
  'rescue-planes': RESCUE_PLANES,
  'giant-carrot-garden': GIANT_CARROT_GARDEN,
};

export const ORIGINAL_PUZZLE_SCENE_IDS = Object.keys(PUZZLE_SCENE_IMAGES);

export function sceneImageHref(scene: PuzzleScene): string {
  if (scene.image.kind === 'concept') {
    return conceptAssetHref(scene.image.conceptId);
  }
  if (scene.image.kind === 'family') {
    return scene.image.href;
  }

  const image = PUZZLE_SCENE_IMAGES[scene.id];
  if (!image) {
    throw new Error(`Missing original puzzle scene: ${scene.id}`);
  }
  return image;
}

export function sceneBackgroundImage(scene: PuzzleScene): string {
  return `url("${sceneImageHref(scene)}")`;
}
