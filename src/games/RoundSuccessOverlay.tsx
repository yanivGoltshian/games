import { useRef } from 'react';
import { SuccessOverlay } from '../components/SuccessOverlay';
import type { ToddlerSettings } from '../domain/types';
import type { CelebrationInfo } from './types';

interface RoundSuccessOverlayProps {
  celebration: CelebrationInfo;
  settings: ToddlerSettings;
  scope: string;
  onDismiss: () => void;
  startNextRound: () => void;
}

export function RoundSuccessOverlay({
  celebration,
  settings,
  scope,
  onDismiss,
  startNextRound,
}: RoundSuccessOverlayProps) {
  const finishedRef = useRef(false);
  const finish = () => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    onDismiss();
    startNextRound();
  };

  return (
    <SuccessOverlay
      settings={settings}
      scope={scope}
      seed={celebration.seed}
      targetSegments={celebration.targetSegments}
      {...(celebration.beforeSpeech ? { beforeSpeech: celebration.beforeSpeech } : {})}
      {...(celebration.coordinatedSpeech
        ? { coordinatedSpeech: celebration.coordinatedSpeech }
        : {})}
      tier={celebration.tier}
      recommendation={celebration.recommendation}
      {...(celebration.celebrationVariant
        ? { celebrationVariant: celebration.celebrationVariant }
        : {})}
      {...(celebration.followUpSegments
        ? { followUpSegments: celebration.followUpSegments }
        : {})}
      onAdvance={() => finish()}
    />
  );
}
