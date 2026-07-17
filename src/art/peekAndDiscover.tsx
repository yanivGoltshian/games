import type { ButtonHTMLAttributes, ImgHTMLAttributes } from 'react';
import { PuppyMascotArt } from './mascot';
import type { SpeechLocale } from '../domain/types';
import type { PeekAndDiscoverPhase } from '../games/peekAndDiscoverState';
import type { PeekAndDiscoverVisualGagId } from '../content/peekAndDiscover';

export type PeekAndDiscoverDemoMode = 'none' | 'tutorial' | 'silence';

export interface PeekAndDiscoverArtProps {
  readonly phase: PeekAndDiscoverPhase;
  readonly demoMode: PeekAndDiscoverDemoMode;
  readonly gagId: PeekAndDiscoverVisualGagId | null;
  readonly gagActive: boolean;
  readonly revealed: boolean;
  readonly reducedMotion: boolean;
  readonly locale: SpeechLocale;
  readonly imageUrl: string;
  readonly contentId: string;
  readonly assetState: 'playing' | 'asset-error' | 'session-stop';
  readonly coverButtonProps: ButtonHTMLAttributes<HTMLButtonElement>;
  readonly objectButtonProps: ButtonHTMLAttributes<HTMLButtonElement>;
  readonly imageProps?: Pick<ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'>;
}

function localeDirection(locale: SpeechLocale): 'rtl' | 'ltr' {
  return locale === 'he-IL' ? 'rtl' : 'ltr';
}

export function PeekAndDiscoverArt({
  phase,
  demoMode,
  gagId,
  gagActive,
  revealed,
  reducedMotion,
  locale,
  imageUrl,
  contentId,
  assetState,
  coverButtonProps,
  objectButtonProps,
  imageProps,
}: PeekAndDiscoverArtProps) {
  const gagMotion = gagId?.split('-').at(-1) ?? 'peek';
  const mascotMood = phase === 'session-stop' || gagActive ? 'happy' : 'idle';
  const travelling = !reducedMotion && (phase === 'revealing' || gagActive);

  return (
    <section
      className={`peek-and-discover-art ${travelling ? 'is-travelling' : ''}`.trim()}
      data-art-phase={phase}
      data-demo-mode={demoMode}
      data-gag-motion={gagMotion}
      data-gag-active={gagActive ? 'true' : 'false'}
      data-revealed={revealed ? 'true' : 'false'}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      data-asset-state={assetState}
      data-content-id={contentId}
      lang={locale === 'he-IL' ? 'he' : 'en'}
      dir={localeDirection(locale)}
    >
      <div className="peek-and-discover-stage" data-stage-orientation={localeDirection(locale)}>
        <div className="peek-and-discover-stage__arch" />
        <div className="peek-and-discover-stage__curtain-rail" />
        <div className="peek-and-discover-stage__floor" />
        <div className="peek-and-discover-stage__spotlight" />

        <div
          className={[
            'peek-and-discover-object-shell',
            revealed ? 'is-revealed' : 'is-covered',
            gagActive ? 'is-gagging' : '',
            `is-gag-${gagMotion}`,
          ].filter(Boolean).join(' ')}
          data-object-shell="true"
        >
          <button
            {...objectButtonProps}
            className={[
              'peek-and-discover-object-button',
              objectButtonProps.className ?? '',
            ].join(' ').trim()}
            type={objectButtonProps.type ?? 'button'}
          >
            <span className="peek-and-discover-object-button__halo" />
            <span className="peek-and-discover-object-button__frame">
              <img
                {...imageProps}
                src={imageUrl}
                alt=""
                className="peek-and-discover-object-image"
                draggable={false}
                decoding="async"
                data-object-image="true"
              />
            </span>
          </button>
        </div>

        <div
          className={[
            'peek-and-discover-cover-shell',
            revealed ? 'is-open' : 'is-closed',
            reducedMotion ? 'is-reduced-motion' : '',
          ].join(' ')}
          data-cover-shell="true"
        >
          <button
            {...coverButtonProps}
            className={[
              'peek-and-discover-cover-button',
              coverButtonProps.className ?? '',
            ].join(' ').trim()}
            type={coverButtonProps.type ?? 'button'}
          >
            <span className="peek-and-discover-cover-button__panel peek-and-discover-cover-button__panel--left" />
            <span className="peek-and-discover-cover-button__panel peek-and-discover-cover-button__panel--right" />
            <span className="peek-and-discover-cover-button__paw" />
          </button>
        </div>

        <div
          className={[
            'peek-and-discover-mascot',
            `is-demo-${demoMode}`,
            gagActive ? 'is-cheering' : '',
            assetState !== 'playing' ? `is-${assetState}` : '',
          ].filter(Boolean).join(' ')}
          data-mascot-demo={demoMode}
        >
          <div className="peek-and-discover-mascot__bubble" />
          <div className="peek-and-discover-mascot__paw peek-and-discover-mascot__paw--front" />
          <div className="peek-and-discover-mascot__paw peek-and-discover-mascot__paw--back" />
          <PuppyMascotArt className="peek-and-discover-mascot__art" mood={mascotMood} />
        </div>

        <div
          className={[
            'peek-and-discover-overlay',
            assetState !== 'playing' ? 'is-visible' : '',
            assetState === 'session-stop' ? 'is-resting' : '',
          ].join(' ')}
          data-overlay-state={assetState}
        >
          <div className="peek-and-discover-overlay__curtain" />
          <div className="peek-and-discover-overlay__pawprint" />
        </div>
      </div>
    </section>
  );
}
