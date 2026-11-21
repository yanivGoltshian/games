import { GARDEN_DRAWINGS, type GardenSentence } from '../content/gardenSentences';

/** SVG symbols and the original transparent paintings share one scene coordinate system. */
export function GardenDrawing({ src, x = 0, y = 0, w = 100, h = w, effect }: {
  src: string; x?: number; y?: number; w?: number; h?: number; effect?: string;
}) {
  const placement = { x, y, width: w, height: h };
  return <g className={effect && `garden-motion--${effect}`}>
    {src.startsWith('#') ? <use href={GARDEN_DRAWINGS + src} {...placement} />
      : <image href={src} {...placement} />}
  </g>;
}

export function GardenStoryScene({ sentence: s }: { sentence: GardenSentence }) {
  const draw = (src: string, x: number, y: number, w: number, h = w, effect?: string) =>
    <GardenDrawing {...{ src, x, y, w, h }} {...(effect ? { effect } : {})} />;
  const soil = draw('#soil', 26, 85, 150, 107);
  const cup = draw('#water', 52, 62, 110, 120);
  const pit = draw('#pit', 82, 60, 48, 54);
  const plant = draw('#berry-plant', 39, 69, 115, 111);
  const apple = '/assets/vocabulary/apple.webp';
  switch (s.id) {
    case 'banana-peel': return <>{draw('#hand', 18, 64, 155, 113)}{draw('#peel', 60, 32, 87, 89, 'settle')}</>;
    case 'banana-bin': return <>{draw('#bin', 109, 82, 90)}{draw('#peel', 130, 87, 46, 48, 'drop-in')}</>;
    case 'date-sprout': return <>{soil}{draw(s.art.subject!, 48, 26, 109, 121, 'emerge')}</>;
    case 'avocado-water': return <>{draw('#avocado', 79, 136, 46)}{draw('#water', 114, 91, 82)}{draw('#pit', 137, 84, 36, 42, 'drop-in')}</>;
    case 'avocado-shoot': return <>{cup}{draw('#root', 86, 102, 45, 51)}{draw('#shoot', 82, 17, 55, 63, 'emerge')}{pit}</>;
    case 'avocado-soil': return <>{draw('#pot', 96, 94, 100)}{draw('#shoot', 114, 64, 64, 64, 'transplant')}</>;
    case 'berry-flower': return <>{draw('#sun', 135, 8, 46)}{plant}{draw('#flower', 73, 41, 65, 65, 'blossom')}</>;
    case 'berry-bee': return <>{plant}{draw('#flower', 80, 60, 66)}{draw('#bee', 88, 48, 47, 43, 'land')}</>;
    case 'carrot-sow': return <>{draw('#soil', 83, 92, 115)}{draw('#seeds', 114, 123, 44, 40, 'drop-in')}</>;
    case 'carrot-rain': return <>{soil}{draw('#rain', 44, 3, 108)}{draw('#drops', 82, 91, 45, 55, 'drip')}</>;
    case 'carrot-leaves': return <>{soil}{draw('#tops', 47, 37, 105, 111, 'emerge')}</>;
    case 'carrot-pull': return <>{draw('#soil', 84, 96, 115)}{draw(s.art.object, 79, 57, 79, 79, 'pull')}</>;
    case 'apple-pick': return <>
      <path d="M198 18q-25 28-99 31" stroke="#896441" strokeWidth="9" fill="none" strokeLinecap="round"/>
      <path d="M142 39q4-20 19-23 0 14-19 23Zm25-9q16-4 25 4-14 5-25-4Z" fill="#69974d"/>
      {draw(apple, 79, 63, 56, 60, 'pick')}
    </>;
    case 'apple-wash': return <>
      <path d="M188 51h-23q-11 0-11 11v9" fill="none" stroke="#799f99" strokeWidth="11" strokeLinecap="round"/>
      {draw('#drops', 137, 75, 35, 36, 'drip')}{draw(apple, 109, 103, 66, 63, 'wash')}
    </>;
  }
}
