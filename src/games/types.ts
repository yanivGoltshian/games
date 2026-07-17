import type {
  DomainProgress,
  LevelRecommendation,
  ProgressUpdateSummary,
  RecordedRound,
  ToddlerSettings,
} from '../domain/types';
import type { CelebrationVariant } from './celebrationVariants';
import type { SpeechResult, SpeechSegment, SpeechStatus } from '../services/speech';
import type { PraiseTier } from '../content/praise';
import type { CommunicationGameScope } from '../domain/communicationGame';

export interface ToddlerGameProps {
  domainProgress: DomainProgress;
  settings: ToddlerSettings;
  overallStars: number;
  mediaReady: boolean;
  speechStatus: SpeechStatus;
  onBack: () => void;
  onCompleteRound: (round: RecordedRound) => ProgressUpdateSummary;
}

/** State each game keeps to drive the shared SuccessOverlay after a correct round. */
export interface CelebrationInfo {
  seed: string;
  targetSegments: SpeechSegment[];
  beforeSpeech?: Promise<SpeechResult>;
  coordinatedSpeech?: {
    intentId: string;
    scope: CommunicationGameScope;
  };
  tier: PraiseTier;
  recommendation: LevelRecommendation | null;
  celebrationVariant?: CelebrationVariant;
  followUpSegments?: SpeechSegment[];
}
