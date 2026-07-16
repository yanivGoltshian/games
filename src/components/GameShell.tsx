import type { ReactNode } from 'react';
import { HomeIconArt, ReplayIconArt } from '../art/controls';
import type { LanguageMode } from '../domain/types';

interface GameShellProps {
  ariaLabel: string;
  accentClass: string;
  reducedMotion: boolean;
  onHome: () => void;
  onRepeat?: () => void;
  repeatDisabled?: boolean;
  repeatSpeaking?: boolean;
  replayLabel: string;
  homeLabel: string;
  /** Visually-hidden but screen-reader-announced current task state. */
  liveStatus: string;
  languageMode: LanguageMode;
  successOverlay?: ReactNode;
  children: ReactNode;
}

/**
 * Minimal child game frame: a top rail with exactly two large controls
 * (home/back, replay) and nothing else instructional. The stage below fills
 * the rest of the viewport without page scroll. The caregiver gate never
 * renders inside a game screen.
 */
export function GameShell({
  ariaLabel,
  accentClass,
  reducedMotion,
  onHome,
  onRepeat,
  repeatDisabled,
  repeatSpeaking,
  replayLabel,
  homeLabel,
  liveStatus,
  languageMode,
  successOverlay,
  children,
}: GameShellProps) {
  return (
    <main
      className={`page game-shell ${accentClass} ${reducedMotion ? 'reduced-motion' : ''}`}
      aria-label={ariaLabel}
      lang={languageMode === 'en' ? 'en' : 'he'}
      dir={languageMode === 'en' ? 'ltr' : 'rtl'}
    >
      <header className="game-top-rail">
        <button className="rail-button rail-button--home" onClick={onHome} type="button" aria-label={homeLabel}>
          <HomeIconArt className="rail-button__icon" />
        </button>
        {onRepeat ? (
          <button
            className={`rail-button rail-button--replay ${repeatSpeaking ? 'is-speaking' : ''}`}
            disabled={repeatDisabled}
            onClick={onRepeat}
            type="button"
            aria-label={replayLabel}
            aria-pressed={repeatSpeaking}
          >
            <ReplayIconArt className="rail-button__icon" />
          </button>
        ) : (
          <span aria-hidden="true" />
        )}
      </header>

      <p
        className="visually-hidden"
        aria-live="polite"
        lang={languageMode === 'en' ? 'en' : 'he'}
        dir={languageMode === 'en' ? 'ltr' : 'rtl'}
      >
        {liveStatus}
      </p>

      <section className="game-stage">{children}</section>

      {successOverlay}
    </main>
  );
}
