import { useId, type ReactNode } from 'react';
import { GARDEN_DEFAULT_AVATAR, type GardenSentence } from '../content/gardenSentences';
import { GardenDrawing, GardenStoryScene } from './GardenStoryScene';

// Measured on the original 456 x 936 illustration. The hand and whatever it
// holds rotate about the same elbow. Never segment or reshape a user's photo.
const FOREARM = 'M356 311H456V485H327V470L329 440 334 425 344 410 350 405 365 398 362 388Z';

function Fruit({ sentence, acted }: { sentence: GardenSentence; acted: boolean }) {
  const biteId = useId();
  const fruit = (href: string, className: string) => sentence.id === 'dates'
    // One date in the hand; retain the whole bunch on the object card.
    ? <svg x="344" y="255" width="126" height="139" viewBox="0 0 218 180">
        <image className={className} href={href} width="391" height="402" />
      </svg>
    : href.startsWith('#') ? <g className={className}><GardenDrawing src={href} x={338} y={245} w={138} h={155} /></g>
    : <image className={className} href={href} x="338" y="245" width="138" height="155" />;
  return <>
    {acted && !sentence.aftermath && <defs>
      <mask id={biteId} maskUnits="userSpaceOnUse" x="300" y="220" width="200" height="200">
        <path d="M300 220h200v200H300z" fill="white" />
        <circle cx="399" cy="269" r="19" /><circle cx="413" cy="266" r="15" />
      </mask>
    </defs>}
    <g mask={acted && !sentence.aftermath ? `url(#${biteId})` : undefined}>
      {fruit(acted && sentence.aftermath ? sentence.aftermath : sentence.art.object, 'sentence-train__moving-object')}
    </g>
    {acted && fruit(sentence.art.object, 'garden-before-bite')}
  </>;
}

export function GardenActionScene({ sentence, acted, original, actor }: {
  sentence: GardenSentence; acted: boolean; original: boolean; actor: ReactNode;
}) {
  const id = useId();
  const { motion } = sentence;
  const food = motion === 'eat';
  const articulate = food && original;
  const frame = food ? '0 0 146 175' : sentence.id === 'avocado-shoot' ? '36 8 139 176' : '0 0 200 188';
  return <div className={`sentence-train__picture sentence-train__action is-${motion ?? sentence.id}`} data-acted={acted}>
    <svg viewBox={frame} aria-hidden="true" className="garden-scene">
      {articulate && <defs>
        <clipPath id={`${id}-body`}><path clipRule="evenodd" d={`M0 0H456V936H0Z ${FOREARM}`} /></clipPath>
        <clipPath id={`${id}-arm`}><path d={FOREARM} /></clipPath>
      </defs>}
      <ellipse cx={food ? 62 : 96} cy={food ? 172 : 175} rx={food ? 53 : 88} ry="4" fill="#c5b995" opacity=".38" />
      {sentence.isSean && <g transform={food ? 'translate(9 -13) scale(.235)' : 'translate(8 8) scale(.184)'}>
        <g clipPath={articulate ? `url(#${id}-body)` : undefined}>
          <foreignObject width="456" height="936" className="sentence-train__actor">{actor}</foreignObject>
        </g>
        {food && <g className="garden-grasp">
          {articulate && <image href={GARDEN_DEFAULT_AVATAR} width="456" height="936" clipPath={`url(#${id}-arm)`} />}
          <Fruit sentence={sentence} acted={acted} />
        </g>}
      </g>}
      {!motion && <GardenStoryScene sentence={sentence} />}
      {motion === 'water' && <>
        <GardenDrawing src={sentence.art.object} x={102} y={111} w={96} h={69} />
        <g className="garden-pour"><g transform="translate(154 65) scale(-1 1)">
          <image href={sentence.setting} width="77" height="63" />
        </g></g>
        {acted && <g className="sentence-train__drops" fill="#3683a5">
          {[[146, 111], [148, 120], [150, 130]].map(([x,y], i) => <g key={x} transform={`translate(${x} ${y})`}>
            <path className={`garden-drop drop-${i}`} d="M0-4Q5 1 2 4Q-4 6-3 1Z" />
          </g>)}
          <ellipse cx="150" cy="148" rx="10" ry="3" fill="#725030" />
        </g>}
      </>}
      {motion === 'bury' && <>
        <path d="M87 156q11-17 46-20 34-2 57 19-1 18-51 21-42-1-52-20Z" fill="#8d5935" />
        <ellipse cx="143" cy="151" rx="18" ry="5" fill="#563923" />
        <g className="sentence-train__pit"><ellipse cx="86" cy="76" rx="10" ry="5" fill="#8e512e" stroke="#51351f" strokeWidth="1.8" />
          <path d="m81 77 9-3" stroke="#c08c56" strokeWidth="1.4" /></g>
        <path className="garden-furrow" d="M115 154q13-9 24-6 17-3 31 3-30 13-55 3Z" fill="#9f6840" />
      </>}
      {motion === 'grow' && <g transform="translate(-78 -30) scale(1.26)">
        <ellipse cx="142" cy="170" rx="35" ry="5" fill="#956b46" />
        <image className="garden-seedling" href={sentence.setting} x="121" y="110" width="42" height="62" />
        {acted && <image className="garden-palm sentence-train__moving-object" href={sentence.image} x="84" y="48" width="116" height="124" />}
      </g>}
    </svg>
  </div>;
}
