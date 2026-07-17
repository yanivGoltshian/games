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
  <g transform="translate(55 600)">
    <ellipse cx="115" cy="250" rx="105" ry="32" fill="#1d5945" opacity=".28"/>
    <ellipse cx="115" cy="165" rx="65" ry="78" fill="#f7f1dd"/>
    <circle cx="115" cy="86" r="56" fill="#fffaf0"/>
    <ellipse cx="82" cy="18" rx="19" ry="65" fill="#fffaf0" transform="rotate(-10 82 18)"/>
    <ellipse cx="148" cy="18" rx="19" ry="65" fill="#fffaf0" transform="rotate(10 148 18)"/>
    <circle cx="96" cy="80" r="8" fill="#25394b"/><circle cx="135" cy="80" r="8" fill="#25394b"/>
    <path d="M105 105q12 14 24 0M60 170q-45-25-55 12M170 170q45-25 55 12" fill="none" stroke="#d8cdb6" stroke-width="12" stroke-linecap="round"/>
    <path d="M182 173q42-35 78-3" fill="none" stroke="#f7d85b" stroke-width="10" stroke-linecap="round"/>
    <circle cx="271" cy="160" r="17" fill="#ef476f"/>
  </g>
  <g transform="translate(710 630)">
    <rect x="15" y="150" width="235" height="25" rx="12" fill="#8a5a3b"/>
    <path d="M55 175l-20 100M215 175l20 100" stroke="#6b422f" stroke-width="18" stroke-linecap="round"/>
    <ellipse cx="130" cy="135" rx="70" ry="22" fill="#fff4d6"/>
    <path d="M80 132h100l-14-65H94Z" fill="#ff9fce" stroke="#b84c7a" stroke-width="8"/>
    <path d="M93 75q35-50 72 0" fill="#fff5bd"/>
    <circle cx="128" cy="48" r="17" fill="#ef476f"/><path d="M128 33q10-24 24-24" stroke="#3d9b58" stroke-width="7" fill="none"/>
    <g fill="#ffe873"><circle cx="35" cy="50" r="18"/><circle cx="220" cy="35" r="16"/></g>
  </g>
  <g fill="#f7d85b"><circle cx="290" cy="365" r="12"/><circle cx="410" cy="405" r="12"/><circle cx="650" cy="390" r="12"/></g>
  <g fill="none" stroke="#17344f" stroke-width="9" stroke-linecap="round"><path d="M300 250v55q30-18 42 3"/><path d="M690 285v55q30-18 42 3"/></g>
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
  <path d="M0 900q150-85 310 0t330 0t360 0v100H0Z" fill="#4ca7c9" opacity=".75"/>
  <path d="M595 560q-5 105-10 195" fill="none" stroke="#704f37" stroke-width="10" stroke-dasharray="18 12"/>
  <g transform="translate(510 715)">
    <path d="M45 55h120l-18 70H62Z" fill="#ffd166" stroke="#8b4c30" stroke-width="9"/>
    <path d="M60 55q45-42 90 0" fill="none" stroke="#8b4c30" stroke-width="9"/>
    <circle cx="105" cy="10" r="42" fill="#f2d2a9"/>
    <path d="M72-10q-30-45 8-55q35 20 40 58M138-10q30-45-8-55q-35 20-40 58" fill="#ad7145"/>
    <circle cx="92" cy="5" r="7" fill="#2f4858"/><circle cx="120" cy="5" r="7" fill="#2f4858"/>
    <path d="M94 25q14 12 27 0" fill="none" stroke="#2f4858" stroke-width="7" stroke-linecap="round"/>
  </g>
  <g transform="translate(75 560)">
    <rect x="0" y="115" width="170" height="85" rx="12" fill="#f5f3e7" stroke="#8b4c30" stroke-width="10"/>
    <path d="M0 115l85-78 85 78M85 37V0" fill="none" stroke="#8b4c30" stroke-width="12"/>
    <path d="M85 0l80 28-80 28Z" fill="#ef476f"/>
    <circle cx="85" cy="150" r="20" fill="#4cc9a6"/>
  </g>
  <g fill="none" stroke="#fff" stroke-width="13" stroke-linecap="round"><path d="M120 310q55-45 110 0"/><path d="M740 150q55-45 110 0"/></g>
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
  <path d="M455 585Q330 560 235 675Q170 740 105 775" fill="none" stroke="#7b4f32" stroke-width="18" stroke-linecap="round"/>
  <g transform="translate(50 585)">
    <ellipse cx="90" cy="190" rx="72" ry="64" fill="#fff7df" stroke="#8f6b4a" stroke-width="8"/>
    <circle cx="90" cy="105" r="52" fill="#fff7df" stroke="#8f6b4a" stroke-width="8"/>
    <ellipse cx="62" cy="42" rx="17" ry="55" fill="#fff7df" stroke="#8f6b4a" stroke-width="8" transform="rotate(-12 62 42)"/>
    <ellipse cx="118" cy="42" rx="17" ry="55" fill="#fff7df" stroke="#8f6b4a" stroke-width="8" transform="rotate(12 118 42)"/>
    <circle cx="74" cy="100" r="7" fill="#5b3525"/><circle cx="108" cy="100" r="7" fill="#5b3525"/>
    <path d="M70 130q20 18 40 0M150 160q40-18 72 8" fill="none" stroke="#8f6b4a" stroke-width="10" stroke-linecap="round"/>
  </g>
  <g transform="translate(205 650)">
    <ellipse cx="80" cy="140" rx="67" ry="55" fill="#f7d85b" stroke="#9a633f" stroke-width="8"/>
    <circle cx="80" cy="75" r="45" fill="#ffe873" stroke="#9a633f" stroke-width="8"/>
    <path d="M40 70L5 55l35 35M120 70l35-15-35 35" fill="#ef8d32" stroke="#9a633f" stroke-width="8" stroke-linejoin="round"/>
    <circle cx="67" cy="72" r="6" fill="#5b3525"/><circle cx="95" cy="72" r="6" fill="#5b3525"/>
    <path d="M125 125q35-18 65 4" fill="none" stroke="#9a633f" stroke-width="10" stroke-linecap="round"/>
  </g>
  <g transform="translate(690 580)">
    <path d="M40 170h170l-18 80H58Z" fill="#7dcf8a" stroke="#267146" stroke-width="10"/>
    <circle cx="75" cy="260" r="28" fill="#5b3525"/><circle cx="180" cy="260" r="28" fill="#5b3525"/>
    <path d="M60 168q70-105 135 0" fill="#d8f3dc" stroke="#267146" stroke-width="10"/>
    <path d="M90 128q20-65 42 0M130 125q25-70 45 2" fill="none" stroke="#3d9b58" stroke-width="14" stroke-linecap="round"/>
  </g>
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
