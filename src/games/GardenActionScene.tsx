import { useId, type ReactNode } from 'react';
import { GARDEN_DEFAULT_AVATAR, type GardenSentence } from '../content/gardenSentences';

// Measured on the original 456 x 936 illustration. The hand and whatever it
// holds rotate about the same elbow. Never segment or reshape a user's photo.
const FOREARM = 'M356 311H456V485H327V470L329 440 334 425 344 410 350 405 365 398 362 388Z';

function Gardener() {
  return <g className="sentence-train__recipient" transform="translate(108 48) scale(.76)">
    <path d="M21 123V99q0-29 39-29t39 29v24Z" fill="#63704a" />
    <circle cx="60" cy="56" r="34" fill="#be845f" />
    <path d="M32 43 39 15q21-13 42 0l7 28Z" fill="#8a9868" />
    <ellipse cx="60" cy="43" rx="50" ry="9" fill="#a2af78" />
    <circle cx="48" cy="59" r="3" fill="#382620" /><circle cx="73" cy="59" r="3" fill="#382620" />
    <path d="M50 72q10 10 20 0" fill="none" stroke="#713f2c" strokeWidth="3" strokeLinecap="round" />
    <g className="garden-recipient-hand">
      <path d="M40 94q-9 12-18 5L5 85" fill="none" stroke="#be845f" strokeWidth="12" strokeLinecap="round" />
      <path d="M43 92l-8 11" stroke="#63704a" strokeWidth="17" />
    </g>
  </g>;
}

function Fruit({ sentence, acted }: { sentence: GardenSentence; acted: boolean }) {
  const biteId = useId();
  const fruit = (href: string, className: string) => sentence.id === 'dates'
    // One date in the hand; retain the whole bunch on the object card.
    ? <svg x="344" y="255" width="126" height="139" viewBox="0 0 218 180">
        <image className={className} href={href} width="391" height="402" />
      </svg>
    : <image className={className} href={href} x="338" y="245" width="138" height="155" />;
  return <>
    {acted && !sentence.aftermath && <defs>
      <mask id={biteId} maskUnits="userSpaceOnUse" x="300" y="220" width="200" height="200">
        <path d="M300 220h200v200H300z" fill="white" />
        <circle cx="399" cy="269" r="19" /><circle cx="413" cy="266" r="15" />
      </mask>
    </defs>}
    <g mask={acted && !sentence.aftermath ? `url(#${biteId})` : undefined}>
      {fruit(acted && sentence.aftermath ? sentence.aftermath : sentence.image, 'sentence-train__moving-object')}
    </g>
    {acted && fruit(sentence.image, 'garden-before-bite')}
  </>;
}

export function GardenActionScene({ sentence, acted, original, actor }: {
  sentence: GardenSentence; acted: boolean; original: boolean; actor: ReactNode;
}) {
  const id = useId();
  const { motion } = sentence;
  const food = motion === 'eat';
  const articulate = food && original;
  return <div className={`sentence-train__picture sentence-train__action is-${motion}`} data-acted={acted}>
    <svg viewBox={food ? '0 0 146 175' : '0 0 200 188'} aria-hidden="true" className="garden-scene">
      {articulate && <defs>
        <clipPath id={`${id}-body`}><path clipRule="evenodd" d={`M0 0H456V936H0Z ${FOREARM}`} /></clipPath>
        <clipPath id={`${id}-arm`}><path d={FOREARM} /></clipPath>
      </defs>}
      <ellipse cx={food ? 62 : 96} cy={food ? 172 : 175} rx={food ? 53 : 88} ry="4" fill="#c5b995" opacity=".38" />
      <g transform={food ? 'translate(9 -13) scale(.235)' : 'translate(8 8) scale(.184)'}>
        <g clipPath={articulate ? `url(#${id}-body)` : undefined}>
          <foreignObject width="456" height="936" className="sentence-train__actor">{actor}</foreignObject>
        </g>
        {food && <g className="garden-grasp">
          {articulate && <image href={GARDEN_DEFAULT_AVATAR} width="456" height="936" clipPath={`url(#${id}-arm)`} />}
          <Fruit sentence={sentence} acted={acted} />
        </g>}
      </g>
      {motion === 'handoff' && <>
        <Gardener />
        <g className="garden-token"><image href={sentence.image} x="77" y="62" width="26" height="26" /></g>
      </>}
      {motion === 'water' && <>
        <image href={sentence.image} x="100" y="130" width="95" height="52" />
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
      {motion === 'germinate' && <>
        <image className="sentence-train__moving-object" href={sentence.image} x="70" y="76" width="118" height="90" />
        <g className="garden-sprout">
          <path d="M144 117q4-12 9-22" stroke="#4c7138" strokeWidth="3" fill="none" />
          <path d="M151 102q-12-2-12-15 12 2 12 15Zm1-3q1-15 14-18-1 14-14 18Z" fill="#638847" />
        </g>
      </>}
      {motion === 'grow' && <>
        <ellipse cx="142" cy="170" rx="35" ry="5" fill="#956b46" />
        <image className="garden-seedling" href={sentence.setting} x="121" y="110" width="42" height="62" />
        {acted && <image className="garden-palm sentence-train__moving-object" href={sentence.image} x="84" y="48" width="116" height="124" />}
      </>}
    </svg>
  </div>;
}
