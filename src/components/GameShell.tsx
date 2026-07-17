import type { ReactNode } from 'react';
import { HomeIconArt, RestartIconArt, SpeakerIconArt } from '../art/controls';
import { PuppyMascotArt } from '../art/mascot';
import type { LanguageMode } from '../domain/types';

interface GameShellProps {
  ariaLabel: string;
  accentClass: string;
  reducedMotion: boolean;
  onHome: () => void;
  onRestart?: () => void;
  restartDisabled?: boolean;
  restartLabel?: string;
  onRepeat?: () => void;
  repeatDisabled?: boolean;
  repeatSpeaking?: boolean;
  replayLabel?: string;
  homeLabel: string;
  /** Visually-hidden but screen-reader-announced current task state. */
  liveStatus: string;
  languageMode: LanguageMode;
  successOverlay?: ReactNode;
  retryActive?: boolean;
  children: ReactNode;
}

/**
 * Minimal child game frame: a top rail with home/back plus one game action.
 * The stage below fills the rest of the viewport without page scroll.
 * The caregiver gate never renders inside a game screen.
 */
export function GameShell({
  ariaLabel,
  accentClass,
  reducedMotion,
  onHome,
  onRestart,
  restartDisabled,
  restartLabel,
  onRepeat,
  repeatDisabled,
  repeatSpeaking,
  replayLabel,
  homeLabel,
  liveStatus,
  languageMode,
  successOverlay,
  retryActive = false,
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
            <SpeakerIconArt className="rail-button__icon" />
          </button>
        ) : onRestart ? (
          <button
            className="rail-button rail-button--restart"
            disabled={restartDisabled}
            onClick={onRestart}
            type="button"
            aria-label={restartLabel}
          >
            <RestartIconArt className="rail-button__icon" />
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

      <section className="game-stage">
        {children}
        <div className={`retry-coach ${retryActive ? 'is-active' : ''}`} aria-hidden="true">
          <PuppyMascotArt mood="idle" className="retry-coach__mascot" />
        </div>
      </section>

      {successOverlay}
    </main>
  );
}
