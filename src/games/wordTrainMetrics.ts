export interface WordTrainPerformanceTimings {
  sessionElapsedMs: number;
  latestModelPlaybackMs: number | null;
  latestConnectionMs: number | null;
}

export interface WordTrainMetrics {
  sessions: number;
  trainsSeen: number;
  trainsConnected: number;
  recentContentIds: string[];
  dragCancellations: number;
  mediaErrors: number;
  performanceTimings: WordTrainPerformanceTimings;
}

export type WordTrainMetricsCallback = (metrics: Readonly<WordTrainMetrics>) => void;

export const INITIAL_WORD_TRAIN_METRICS: WordTrainMetrics = {
  sessions: 0,
  trainsSeen: 0,
  trainsConnected: 0,
  recentContentIds: [],
  dragCancellations: 0,
  mediaErrors: 0,
  performanceTimings: {
    sessionElapsedMs: 0,
    latestModelPlaybackMs: null,
    latestConnectionMs: null,
  },
};

export function appendWordTrainContentId(
  recentContentIds: readonly string[],
  contentId: string,
  limit = 12,
): string[] {
  return [
    ...recentContentIds.filter((recentId) => recentId !== contentId),
    contentId,
  ].slice(-limit);
}
