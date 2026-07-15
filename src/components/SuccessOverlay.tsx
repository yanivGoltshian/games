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
  /** Unique per round so the deterministic praise selector varies naturally. */
  seed: string;
  /** Spoken (and modeled) before praise: the answer/target label for this round. */
  targetSegments: SpeechSegment[];
  tier: PraiseTier;
  onAdvance: () => void;
}

const STANDARD_DELAY_MS = 1600;
const MILESTONE_DELAY_MS = 2000;

/**
 * Inline, non-blocking success moment: puppy mascot, tasteful confetti,
 * locale-aware praise, a generated chime, and an optional light vibration.
 * Auto-advances after ~1.6-2s; tapping anywhere advances immediately.
 * Praise speech always plays after the target/answer audio and is
 * cancellation-safe if the overlay unmounts early.
 */
export function SuccessOverlay({ settings, seed, targetSegments, tier, onAdvance }: SuccessOverlayProps) {
  const advanceRef = useRef(onAdvance);
  const advancedRef = useRef(false);
  advanceRef.current = onAdvance;
  const praise = useMemo(
    () => selectPraiseSegments(settings, tier, seed),
    [seed, settings, tier],
  );
  const advanceOnce = useCallback(() => {
    if (advancedRef.current) {
      return;
    }
    advancedRef.current = true;
    advanceRef.current();
  }, []);

  useEffect(() => {
    const delay = tier === 'milestone' ? MILESTONE_DELAY_MS : STANDARD_DELAY_MS;
    if (tier === 'milestone') {
      soundService.playMilestone(settings);
      soundService.vibrate(settings, [16, 40, 16]);
    } else {
      soundService.playCelebrate(settings);
      soundService.vibrate(settings, 18);
    }

    // Praise always follows the target/answer audio, and the whole chain is
    // cancellation-safe if the round changes before it resolves.
    void speechService.speakSuccessSequence(targetSegments, praise.segments, settings);

    const timer = window.setTimeout(advanceOnce, delay);
    return () => {
      window.clearTimeout(timer);
      speechService.cancel();
    };
  }, [advanceOnce, seed, settings, targetSegments, tier, praise.segments]);

  return (
    <div className="success-overlay" role="status" aria-live="polite" onPointerDown={advanceOnce}>
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
