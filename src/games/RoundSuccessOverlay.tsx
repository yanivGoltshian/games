import { useRef } from 'react';
import { SuccessOverlay } from '../components/SuccessOverlay';
import type { DomainProgress, ProgressionChoice, ToddlerSettings } from '../domain/types';
import type { CelebrationInfo } from './types';

interface RoundSuccessOverlayProps {
  celebration: CelebrationInfo;
  settings: ToddlerSettings;
  scope: string;
  onDismiss: () => void;
  onProgressionChoice: (choice: ProgressionChoice) => DomainProgress;
  startNextRound: (progressOverride?: DomainProgress) => void;
}

export function RoundSuccessOverlay({
  celebration,
  settings,
  scope,
  onDismiss,
  onProgressionChoice,
  startNextRound,
}: RoundSuccessOverlayProps) {
  const finishedRef = useRef(false);
  const finish = (progressOverride?: DomainProgress) => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onDismiss();
    startNextRound(progressOverride);
  };
  const choose = (choice: ProgressionChoice) => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    const progressOverride = onProgressionChoice(choice);
    onDismiss();
    startNextRound(progressOverride);
  };

  return (
    <SuccessOverlay
      settings={settings}
      scope={scope}
      seed={celebration.seed}
      targetSegments={celebration.targetSegments}
      tier={celebration.tier}
      recommendation={celebration.recommendation}
      onAdvance={() => finish()}
      onNextLevel={() => choose('next')}
      onReplayLevel={() => choose('replay')}
    />
  );
}
