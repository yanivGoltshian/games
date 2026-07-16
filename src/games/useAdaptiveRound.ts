import { useCallback, useRef, useState } from 'react';
import type { DomainKey, DomainProgress } from '../domain/types';

type RoundGenerator<TRound> = (
  progress: DomainProgress,
  seed: string,
  recentSignatures?: readonly string[],
) => TRound;

interface AdaptiveRoundHistory<TRound> {
  getSignature: (round: TRound) => string;
  limit?: number;
}

export function useAdaptiveRound<TRound>(
  domain: DomainKey,
  progress: DomainProgress,
  generate: RoundGenerator<TRound>,
  history?: AdaptiveRoundHistory<TRound>,
): { round: TRound; roundKey: number; startNextRound: (progressOverride?: DomainProgress) => void } {
  const latestProgress = useRef(progress);
  const roundIndex = useRef(0);
  const recentSignatures = useRef<string[]>([]);
  const getSignature = history?.getSignature;
  const historyLimit = Math.max(6, history?.limit ?? 8);
  latestProgress.current = progress;

  const makeRound = useCallback((current: DomainProgress, index: number) => {
    const seed = `${domain}-${current.attempts}-${current.successes}-${current.level}-${index}`;
    const nextRound = getSignature
      ? generate(current, seed, recentSignatures.current)
      : generate(current, seed);

    if (getSignature) {
      const signature = getSignature(nextRound);
      if (recentSignatures.current.at(-1) !== signature) {
        recentSignatures.current = [
          ...recentSignatures.current.slice(-(historyLimit - 1)),
          signature,
        ];
      }
    }
    return nextRound;
  }, [
    domain,
    generate,
    getSignature,
    historyLimit,
  ]);
  const [round, setRound] = useState(() => makeRound(progress, roundIndex.current));

  const startNextRound = useCallback((progressOverride?: DomainProgress) => {
    roundIndex.current += 1;
    setRound(makeRound(progressOverride ?? latestProgress.current, roundIndex.current));
  }, [makeRound]);

  return { round, roundKey: roundIndex.current, startNextRound };
}
