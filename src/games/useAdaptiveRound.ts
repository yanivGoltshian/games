import { useCallback, useRef, useState } from 'react';
import type { DomainKey, DomainProgress } from '../domain/types';

type RoundGenerator<TRound> = (progress: DomainProgress, seed: string) => TRound;

export function useAdaptiveRound<TRound>(
  domain: DomainKey,
  progress: DomainProgress,
  generate: RoundGenerator<TRound>,
): { round: TRound; roundKey: number; startNextRound: (progressOverride?: DomainProgress) => void } {
  const latestProgress = useRef(progress);
  const roundIndex = useRef(0);
  latestProgress.current = progress;

  const makeRound = useCallback(
    (current: DomainProgress, index: number) => generate(
      current,
      `${domain}-${current.attempts}-${current.successes}-${current.level}-${index}`,
    ),
    [domain, generate],
  );
  const [round, setRound] = useState(() => makeRound(progress, roundIndex.current));

  const startNextRound = useCallback((progressOverride?: DomainProgress) => {
    roundIndex.current += 1;
    setRound(makeRound(progressOverride ?? latestProgress.current, roundIndex.current));
  }, [makeRound]);

  return { round, roundKey: roundIndex.current, startNextRound };
}
