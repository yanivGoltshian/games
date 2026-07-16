import { useCallback, useEffect, useMemo, useRef } from 'react';
import { ConfettiBurst } from '../art/confetti';
import { PuppyMascotArt } from '../art/mascot';
import { REAL_WORLD_PAUSE_EN, REAL_WORLD_PAUSE_HE, type PraiseTier } from '../content/praise';
import type { ToddlerSettings } from '../domain/types';
import { selectPraiseSegments } from '../games/praiseSpeech';
import { soundService } from '../services/sound';
import { speechService, type SpeechSegment } from '../services/speech';

export interface SuccessOverlayProps {
  settings: ToddlerSettings;
  scope: string;
  /** Unique per round so the deterministic praise selector varies naturally. */
  seed: string;
  /** Spoken (and modeled) before praise: the answer/target label for this round. */
  targetSegments: SpeechSegment[];
  tier: PraiseTier;
  onAdvance: () => void;
}

const STANDARD_MINIMUM_MS = 1400;
const MILESTONE_MINIMUM_MS = 1800;
const LIVENESS_GUARD_MS = 15_000;

/**
 * Inline, non-blocking success moment: puppy mascot, tasteful confetti,
 * locale-aware praise, a generated chime, and an optional light vibration.
 * Auto-advances only after target and praise speech finish. Tapping advances
 * immediately and intentionally interrupts the current success request.
 */
export function SuccessOverlay({ settings, scope, seed, targetSegments, tier, onAdvance }: SuccessOverlayProps) {
  const advanceRef = useRef(onAdvance);
  const advancedRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);
  advanceRef.current = onAdvance;
  const praise = useMemo(
    () => selectPraiseSegments(settings, tier, seed),
    [seed, settings, tier],
  );
  const advanceOnce = useCallback((interruptSpeech = false) => {
    if (advancedRef.current) {
      return;
    }
    advancedRef.current = true;
    if (interruptSpeech) {
      speechService.cancelScope(scope, 'navigation');
    }
    advanceRef.current();
  }, [scope]);

  useEffect(() => {
    const startedAt = window.performance.now();
    const minimumDuration = tier === 'milestone' ? MILESTONE_MINIMUM_MS : STANDARD_MINIMUM_MS;
    if (tier === 'milestone') {
      soundService.playMilestone(settings);
      soundService.vibrate(settings, [16, 40, 16]);
    } else {
      soundService.playCelebrate(settings);
      soundService.vibrate(settings, 18);
    }

    void speechService
      .speakSuccessSequence(targetSegments, praise.segments, settings, {
        scope,
        key: `success:${seed}`,
      })
      .then(() => {
        const remaining = Math.max(0, minimumDuration - (window.performance.now() - startedAt));
        finishTimerRef.current = window.setTimeout(() => advanceOnce(), remaining);
      });

    // This guard never cancels speech. It only keeps a broken platform voice
    // from trapping the child on the celebration screen indefinitely.
    const livenessGuard = window.setTimeout(() => advanceOnce(), LIVENESS_GUARD_MS);
    return () => {
      window.clearTimeout(livenessGuard);
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
      }
    };
  }, [advanceOnce, praise.segments, scope, seed, settings, targetSegments, tier]);

  return (
    <div className="success-overlay" role="status" aria-live="polite" onPointerDown={() => advanceOnce(true)}>
      <div className={`success-card ${tier === 'milestone' ? 'success-card--milestone' : ''}`}>
        <ConfettiBurst richness={tier === 'milestone' ? 'milestone' : 'standard'} />
        <PuppyMascotArt mood={tier === 'milestone' ? 'milestone' : 'happy'} className="success-card__mascot" />
        <p className="success-card__praise">{praise.displayText}</p>
        {tier === 'milestone' ? (
          <p className="success-card__pause">{settings.languageMode === 'en' ? REAL_WORLD_PAUSE_EN : REAL_WORLD_PAUSE_HE}</p>
        ) : null}
      </div>
    </div>
  );
}
