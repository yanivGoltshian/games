import type { ToyPhoneCallerId, ToyPhoneObjectId } from '../content/toyPhone';
import { artA11yProps, useArtIds, type ArtProps } from './a11y';
import { PuppyMascotArt } from './mascot';
import { ConceptArt } from './objects';

interface ToyPhoneDeviceArtProps extends ArtProps {
  ringing: boolean;
  answered: boolean;
  mascotAnswering?: boolean;
}

export function ToyPhoneDeviceArt({
  label,
  className,
  ringing,
  answered,
  mascotAnswering = false,
}: ToyPhoneDeviceArtProps) {
  const ids = useArtIds('phone', 'handset', 'shadow');
  return (
    <svg
      viewBox="0 0 360 220"
      className={[
        'toy-phone-device',
        ringing ? 'is-ringing' : '',
        answered ? 'is-answered' : '',
        mascotAnswering ? 'is-mascot-answering' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      {...artA11yProps('toy-phone-device', label)}
    >
      <defs>
        <linearGradient id={ids.phone} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffe992" />
          <stop offset="100%" stopColor="#f7b957" />
        </linearGradient>
        <linearGradient id={ids.handset} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#83d4dc" />
          <stop offset="100%" stopColor="#41aebc" />
        </linearGradient>
        <filter id={ids.shadow} x="-20%" y="-40%" width="140%" height="190%">
          <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor="#624322" floodOpacity="0.2" />
        </filter>
      </defs>
      <ellipse cx="180" cy="200" rx="128" ry="14" fill="#694622" opacity="0.13" />
      <g filter={`url(#${ids.shadow})`}>
        <rect x="62" y="72" width="236" height="121" rx="47" fill={`url(#${ids.phone})`} />
        <circle className="toy-phone-device__glow" cx="180" cy="132" r="38" fill="#fff9cf" />
        <path
          className="toy-phone-device__handset"
          d="M62 76 C70 36 96 22 126 32 L145 53 C154 63 206 63 215 53 L234 32 C264 22 290 36 298 76 L272 104 C260 116 240 114 230 100 L220 86 C209 75 151 75 140 86 L130 100 C120 114 100 116 88 104 Z"
          fill={`url(#${ids.handset})`}
          stroke="#278c99"
          strokeWidth="5"
          strokeLinejoin="round"
        />
        <path d="M112 158 Q180 183 248 158" fill="none" stroke="#e39a40" strokeWidth="8" strokeLinecap="round" opacity="0.45" />
      </g>
      <g className="toy-phone-device__ring-waves" fill="none" stroke="#48aebc" strokeWidth="7" strokeLinecap="round">
        <path d="M42 56 Q24 77 39 99" />
        <path d="M318 56 Q336 77 321 99" />
      </g>
    </svg>
  );
}

export function ToyPhoneCallerArt({
  callerId,
  label,
  className,
}: ArtProps & { callerId: ToyPhoneCallerId }) {
  const artProps = {
    ...(label === undefined ? {} : { label }),
    ...(className === undefined ? {} : { className }),
  };
  if (callerId === 'mascot') {
    return <PuppyMascotArt {...artProps} mood="happy" />;
  }
  return <ConceptArt conceptId={callerId} {...artProps} />;
}

export function ToyPhoneObjectArt({
  objectId,
  label,
  className,
}: ArtProps & { objectId: ToyPhoneObjectId }) {
  return (
    <ConceptArt
      conceptId={objectId}
      {...(label === undefined ? {} : { label })}
      {...(className === undefined ? {} : { className })}
    />
  );
}
