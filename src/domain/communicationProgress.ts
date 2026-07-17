export const COMMUNICATION_PROGRESS_VERSION = 1 as const;
export const RECENT_COMMUNICATION_CONTENT_LIMIT = 12;

export interface CommunicationProgress {
  version: typeof COMMUNICATION_PROGRESS_VERSION;
  contentVersion: string | null;
  sessionsCompleted: number;
  roundsSeen: number;
  recentContentIds: string[];
  lastPlayedAt: number;
}

export function createInitialCommunicationProgress(
  contentVersion: string | null = null,
): CommunicationProgress {
  return {
    version: COMMUNICATION_PROGRESS_VERSION,
    contentVersion,
    sessionsCompleted: 0,
    roundsSeen: 0,
    recentContentIds: [],
    lastPlayedAt: 0,
  };
}

function progressForContentVersion(
  progress: CommunicationProgress,
  contentVersion: string,
): CommunicationProgress {
  return progress.contentVersion === contentVersion
    ? progress
    : createInitialCommunicationProgress(contentVersion);
}

export function recordCommunicationRound(
  progress: CommunicationProgress,
  contentVersion: string,
  contentId: string,
  playedAt = Date.now(),
): CommunicationProgress {
  const current = progressForContentVersion(progress, contentVersion);
  const recentContentIds = [
    ...current.recentContentIds.filter((recentId) => recentId !== contentId),
    contentId,
  ].slice(-RECENT_COMMUNICATION_CONTENT_LIMIT);

  return {
    ...current,
    roundsSeen: current.roundsSeen + 1,
    recentContentIds,
    lastPlayedAt: playedAt,
  };
}

export function recordCommunicationSessionCompleted(
  progress: CommunicationProgress,
  contentVersion: string,
  playedAt = Date.now(),
): CommunicationProgress {
  const current = progressForContentVersion(progress, contentVersion);
  return {
    ...current,
    sessionsCompleted: current.sessionsCompleted + 1,
    lastPlayedAt: playedAt,
  };
}
