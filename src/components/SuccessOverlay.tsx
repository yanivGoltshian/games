import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { CelebrationArt } from '../art/celebrations';
import { LEVEL_UP_SPEECH } from '../content/levelUpSpeech';
import { REAL_WORLD_PAUSE_EN, REAL_WORLD_PAUSE_HE, type PraiseTier } from '../content/praise';
import type { InteractionMediaScope } from '../domain/interactionMedia';
import type { LevelRecommendation, ToddlerSettings } from '../domain/types';
import { selectCelebrationVariant, type CelebrationVariant } from '../games/celebrationVariants';
import { selectPraiseSegments } from '../games/praiseSpeech';
import {
  createInteractionMediaUnits,
  interactionMediaCoordinator,
} from '../services/interactionMediaCoordinator';
import { soundService } from '../services/sound';
import {
  buildPersonalizedPhraseSegments,
  speechService,
  type SpeechResult,
  type SpeechSegment,
} from '../services/speech';
import { scheduleSuccessAdvance } from './successTiming';

export interface SuccessOverlayProps {
  settings: ToddlerSettings;
  scope: string;
  /** Unique per round so the deterministic praise selector varies naturally. */
  seed: string;
  /** Spoken (and modeled) before praise: the answer/target label for this round. */
  targetSegments: SpeechSegment[];
  /** Existing target narration that must finish before the success sequence starts. */
  beforeSpeech?: Promise<SpeechResult>;
  coordinatedSpeech?: {
    intentId: string;
    scope: InteractionMediaScope;
  };
  tier: PraiseTier;
  recommendation: LevelRecommendation | null;
  celebrationVariant?: CelebrationVariant;
  followUpSegments?: SpeechSegment[];
  onAdvance: () => void;
}

const STANDARD_MINIMUM_MS = 1400;
const MILESTONE_MINIMUM_MS = 1800;
const LIVENESS_GUARD_MS = 15_000;
let previousCelebrationVariant: CelebrationVariant | null = null;
const EMPTY_FOLLOW_UP_SEGMENTS: SpeechSegment[] = [];

/**
 * Inline, non-blocking success moment: puppy mascot, tasteful confetti,
 * locale-aware praise, a generated chime, and an optional light vibration.
 * Auto-advances only after target and praise speech finish. Tapping advances
 * immediately and intentionally interrupts the current success request.
 */
export function SuccessOverlay({
  settings,
  scope,
  seed,
  targetSegments,
  beforeSpeech,
  coordinatedSpeech,
  tier,
  recommendation,
  celebrationVariant: celebrationVariantOverride,
  followUpSegments,
  onAdvance,
}: SuccessOverlayProps) {
  const advanceRef = useRef(onAdvance);
  const advancedRef = useRef(false);
  const [celebrationVariant] = useState(() => {
    if (celebrationVariantOverride) {
      return celebrationVariantOverride;
    }
    const nextVariant = selectCelebrationVariant(seed, previousCelebrationVariant);
    previousCelebrationVariant = nextVariant;
    return nextVariant;
  });
  advanceRef.current = onAdvance;
  const praise = useMemo(
    () => selectPraiseSegments(settings, tier, seed),
    [seed, settings, tier],
  );
  const recommendationSegments = useMemo(
    () => recommendation
      ? LEVEL_UP_SPEECH.flatMap((line) => buildPersonalizedPhraseSegments(line, settings))
      : [],
    [recommendation, settings],
  );
  const extraSegments = followUpSegments ?? EMPTY_FOLLOW_UP_SEGMENTS;
  const advanceOnce = useCallback((interruptSpeech = false) => {
    if (advancedRef.current) {
      return;
    }
    advancedRef.current = true;
    if (interruptSpeech) {
      if (coordinatedSpeech) {
        interactionMediaCoordinator.notifyInteraction(
          coordinatedSpeech.scope,
          'round-replacement',
        );
      } else {
        speechService.cancelScope(scope, 'navigation');
      }
    }
    advanceRef.current();
  }, [coordinatedSpeech, scope]);

  useEffect(() => {
    let cancelled = false;
    let cancelFinishTimer: (() => void) | null = null;
    const startedAt = window.performance.now();
    const minimumDuration = tier === 'milestone' ? MILESTONE_MINIMUM_MS : STANDARD_MINIMUM_MS;
    if (tier === 'milestone') {
      soundService.playMilestone(settings);
      soundService.vibrate(settings, [16, 40, 16]);
    } else {
      soundService.playCelebrate(settings);
      soundService.vibrate(settings, 18);
    }

    const speakAndAdvance = async (): Promise<void> => {
      await beforeSpeech;
      if (cancelled) {
        return;
      }
      const conclusionSegments = recommendation
        ? [...recommendationSegments, ...extraSegments]
        : [...praise.segments, ...extraSegments];
      if (coordinatedSpeech) {
        const segments = [...targetSegments, ...conclusionSegments];
        const targetEndIndex = targetSegments.length - 1;
        if (targetEndIndex >= 0 && conclusionSegments.length > 0) {
          segments[targetEndIndex] = { ...segments[targetEndIndex]!, pauseAfterMs: 280 };
        }
        await interactionMediaCoordinator.play({
          intentId: coordinatedSpeech.intentId,
          source: 'automatic',
          scope: coordinatedSpeech.scope,
          audioClass: 'mandatory',
          settings,
          units: createInteractionMediaUnits(coordinatedSpeech.scope, segments),
        });
      } else {
        await speechService.speakSuccessSequence(
          targetSegments,
          conclusionSegments,
          settings,
          {
            scope,
            key: `success:${seed}`,
          },
        );
      }
      if (cancelled) {
        return;
      }
      const remaining = Math.max(0, minimumDuration - (window.performance.now() - startedAt));
      cancelFinishTimer = scheduleSuccessAdvance(remaining, () => advanceOnce());
    };
    void speakAndAdvance();

    const cancelLivenessGuard = scheduleSuccessAdvance(
      LIVENESS_GUARD_MS,
      () => advanceOnce(true),
    );
    return () => {
      cancelled = true;
      cancelLivenessGuard();
      cancelFinishTimer?.();
    };
  }, [
    advanceOnce,
    beforeSpeech,
    coordinatedSpeech,
    extraSegments,
    praise.segments,
    recommendation,
    recommendationSegments,
    scope,
    seed,
    settings,
    targetSegments,
    tier,
  ]);
  const levelUpText = settings.languageMode === 'en'
    ? LEVEL_UP_SPEECH[0]!.en
    : LEVEL_UP_SPEECH[0]!.he;
  const displayText = recommendation ? levelUpText : praise.displayText;
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    advanceOnce(true);
  };

  return (
    <div
      className="success-overlay"
      role="button"
      tabIndex={0}
      aria-label={settings.languageMode === 'en' ? 'Continue' : 'המשך'}
      onPointerDown={() => advanceOnce(true)}
      onKeyDown={handleKeyDown}
    >
      <p className="visually-hidden" role="status" aria-live="polite">{displayText}</p>
      <div
        className={`success-card success-card--${celebrationVariant} ${tier === 'milestone' ? 'success-card--milestone' : ''}`}
        data-celebration-variant={celebrationVariant}
      >
        <CelebrationArt variant={celebrationVariant} className="success-card__celebration" />
        <p className="success-card__praise">{displayText}</p>
        {tier === 'milestone' ? (
          <p className="success-card__pause">{settings.languageMode === 'en' ? REAL_WORLD_PAUSE_EN : REAL_WORLD_PAUSE_HE}</p>
        ) : null}
      </div>
    </div>
  );
}
