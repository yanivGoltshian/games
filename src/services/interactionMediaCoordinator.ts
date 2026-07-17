import {
  communicationScopeKey,
  createCommunicationLocaleLock,
  localeLockMatches,
  type CommunicationGameScope,
  type CommunicationInputSource,
  type CommunicationLocaleLock,
} from '../domain/communicationGame';
import type { ToddlerSettings } from '../domain/types';
import { subscribeAppLifecycle } from '../platform/useAppLifecycle';
import {
  speechService,
  type SpeechRequestOptions,
  type SpeechResult,
  type SpeechSegment,
} from './speech';
import {
  communicationMicrophoneGuard,
  type MicrophonePlaybackGuardContract,
  type PlaybackGuardOutcome,
} from './microphonePlaybackGuard';

export type InteractionAudioClass = 'mandatory' | 'conditional' | 'decorative';
export type InteractionMediaOutcomeStatus = PlaybackGuardOutcome;
export type InteractionCancellationReason =
  | 'touch'
  | 'voice'
  | 'automatic'
  | 'state-transition'
  | 'round-replacement'
  | 'exit'
  | 'background'
  | 'activity-replacement';

interface InteractionMediaRequestBase {
  intentId: string;
  source: CommunicationInputSource;
  scope: CommunicationGameScope;
  audioClass: InteractionAudioClass;
  settings: ToddlerSettings;
}

export interface InteractionMediaUnit {
  scope: CommunicationGameScope;
  localeLock: CommunicationLocaleLock;
  segment: SpeechSegment;
}

export type InteractionMediaRequest = InteractionMediaRequestBase & (
  | {
    localeLock: CommunicationLocaleLock;
    segments: readonly SpeechSegment[];
    units?: never;
  }
  | {
    localeLock?: never;
    segments?: never;
    units: readonly InteractionMediaUnit[];
  }
);

export interface InteractionMediaOutcome {
  intentId: string;
  status: InteractionMediaOutcomeStatus;
  speechStatus?: SpeechResult['status'];
  cancellationReason?: InteractionCancellationReason;
  reason?: 'locale-mismatch' | 'empty-content';
}

export interface InteractionSpeechBackend {
  speakSegments(
    segments: SpeechSegment[],
    settings: ToddlerSettings,
    options: SpeechRequestOptions,
  ): Promise<SpeechResult>;
  cancelScope(scope: string, reason?: 'navigation' | 'replay' | 'visibility'): void;
}

interface MediaEntry {
  request: InteractionMediaRequest;
  segments: readonly SpeechSegment[];
  backendScope: string;
  started: boolean;
  playbackGuardActive: boolean;
  forcedStatus: InteractionMediaOutcomeStatus | null;
  cancellationReason: InteractionCancellationReason | null;
  resolve: (outcome: InteractionMediaOutcome) => void;
}

function mapSpeechOutcome(status: SpeechResult['status']): InteractionMediaOutcomeStatus {
  switch (status) {
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'superseded':
      return 'replaced';
    case 'skipped':
    case 'unsupported':
      return 'unavailable';
    case 'error':
    case 'timed-out':
      return 'errored';
  }
}

function sameActivity(left: CommunicationGameScope, right: CommunicationGameScope): boolean {
  return left.activityId === right.activityId && left.sessionId === right.sessionId;
}

function sameRound(left: CommunicationGameScope, right: CommunicationGameScope): boolean {
  return (
    sameActivity(left, right)
    && left.roundId === right.roundId
  );
}

function intentWaitsForMandatory(reason: InteractionCancellationReason): boolean {
  return reason === 'touch' || reason === 'voice' || reason === 'automatic';
}

export function createInteractionMediaUnits(
  scope: CommunicationGameScope,
  segments: readonly SpeechSegment[],
): InteractionMediaUnit[] {
  return segments.map((segment, index) => {
    const unitScope = {
      ...scope,
      stepId: `${scope.stepId}:segment:${index + 1}`,
    };
    return {
      scope: unitScope,
      localeLock: createCommunicationLocaleLock(unitScope, segment.locale, 'step'),
      segment,
    };
  });
}

function readRequestSegments(request: InteractionMediaRequest): {
  segments: readonly SpeechSegment[];
  valid: boolean;
} {
  if (request.units !== undefined) {
    return {
      segments: request.units.map((unit) => unit.segment),
      valid: request.units.every((unit) => (
        sameRound(request.scope, unit.scope)
        && localeLockMatches(unit.localeLock, unit.scope, unit.segment.locale)
      )),
    };
  }

  return {
    segments: request.segments,
    valid: (
      localeLockMatches(request.localeLock, request.scope, request.localeLock.locale)
      && request.segments.every((segment) => segment.locale === request.localeLock.locale)
    ),
  };
}

export class InteractionMediaCoordinator {
  private active: MediaEntry | null = null;
  private pending: MediaEntry | null = null;
  private readonly unsubscribeLifecycle: () => void;

  constructor(
    private readonly speech: InteractionSpeechBackend = speechService,
    private readonly microphoneGuard: MicrophonePlaybackGuardContract = communicationMicrophoneGuard,
    subscribeLifecycle: typeof subscribeAppLifecycle = subscribeAppLifecycle,
  ) {
    this.unsubscribeLifecycle = subscribeLifecycle((state) => {
      if (state === 'background') {
        this.cancelAll('background');
      }
    });
  }

  play(request: InteractionMediaRequest): Promise<InteractionMediaOutcome> {
    const content = readRequestSegments(request);
    if (!content.valid) {
      return Promise.resolve({
        intentId: request.intentId,
        status: 'unavailable',
        reason: 'locale-mismatch',
      });
    }
    if (content.segments.length === 0) {
      return Promise.resolve({
        intentId: request.intentId,
        status: 'unavailable',
        reason: 'empty-content',
      });
    }

    return new Promise((resolve) => {
      const entry: MediaEntry = {
        request,
        segments: content.segments,
        backendScope: `communication:${communicationScopeKey(request.scope)}`,
        started: false,
        playbackGuardActive: false,
        forcedStatus: null,
        cancellationReason: null,
        resolve,
      };
      this.accept(entry);
    });
  }

  notifyInteraction(scope: CommunicationGameScope, reason: InteractionCancellationReason): void {
    const relevant = (entry: MediaEntry): boolean => (
      reason === 'background'
      || reason === 'exit'
      || reason === 'activity-replacement'
      || sameActivity(entry.request.scope, scope)
    );

    if (
      this.pending
      && relevant(this.pending)
      && (
        this.pending.request.audioClass !== 'mandatory'
        || !intentWaitsForMandatory(reason)
      )
    ) {
      this.settlePending(
        this.pending,
        reason === 'exit' || reason === 'background' ? 'cancelled' : 'replaced',
        reason,
      );
    }
    if (!this.active || !relevant(this.active)) {
      return;
    }
    if (
      this.active.request.audioClass === 'mandatory'
      && intentWaitsForMandatory(reason)
    ) {
      return;
    }

    const mustCancelMandatory = (
      reason === 'exit'
      || reason === 'background'
      || reason === 'activity-replacement'
      || reason === 'round-replacement'
      || !this.active.started
    );
    if (
      this.active.request.audioClass !== 'mandatory'
      || mustCancelMandatory
    ) {
      this.cancelActive(
        reason === 'exit' || reason === 'background' ? 'cancelled' : 'replaced',
        reason === 'background' ? 'visibility' : 'replay',
        reason,
      );
    }
  }

  cancelAll(reason: Extract<InteractionCancellationReason, 'exit' | 'background'> = 'exit'): void {
    if (this.pending) {
      this.settlePending(this.pending, 'cancelled', reason);
    }
    if (this.active) {
      this.cancelActive(
        'cancelled',
        reason === 'background' ? 'visibility' : 'navigation',
        reason,
      );
    }
  }

  dispose(): void {
    this.unsubscribeLifecycle();
    this.cancelAll('exit');
  }

  private accept(entry: MediaEntry): void {
    if (!this.active) {
      this.start(entry);
      return;
    }

    if (entry.request.audioClass === 'decorative') {
      entry.resolve({ intentId: entry.request.intentId, status: 'replaced' });
      return;
    }

    const activeCanFinish = (
      this.active.request.audioClass === 'mandatory'
      && this.active.started
      && sameActivity(this.active.request.scope, entry.request.scope)
    );
    this.replacePending(entry);
    if (!activeCanFinish) {
      this.cancelActive('replaced');
    }
  }

  private replacePending(entry: MediaEntry): void {
    if (this.pending) {
      this.settlePending(this.pending, 'replaced');
    }
    this.pending = entry;
  }

  private settlePending(
    entry: MediaEntry,
    status: InteractionMediaOutcomeStatus,
    cancellationReason: InteractionCancellationReason | null = null,
  ): void {
    if (this.pending === entry) {
      this.pending = null;
    }
    entry.resolve({
      intentId: entry.request.intentId,
      status,
      ...(cancellationReason === null ? {} : { cancellationReason }),
    });
  }

  private cancelActive(
    status: InteractionMediaOutcomeStatus,
    reason: 'navigation' | 'replay' | 'visibility' = 'replay',
    cancellationReason: InteractionCancellationReason | null = null,
  ): void {
    if (!this.active || this.active.forcedStatus !== null) {
      return;
    }
    this.active.forcedStatus = status;
    this.active.cancellationReason = cancellationReason;
    this.speech.cancelScope(this.active.backendScope, reason);
  }

  private start(entry: MediaEntry): void {
    this.active = entry;
    const options: SpeechRequestOptions = {
      scope: entry.backendScope,
      key: entry.request.intentId,
      priority: entry.request.audioClass === 'mandatory'
        ? 'label'
        : entry.request.audioClass === 'conditional'
          ? 'prompt'
          : 'retry',
      onStart: () => {
        if (this.active !== entry || entry.started) {
          return;
        }
        entry.started = true;
        entry.playbackGuardActive = true;
        this.microphoneGuard.beginPlayback(entry.request.intentId);
      },
    };

    void this.speech.speakSegments(
      [...entry.segments],
      entry.request.settings,
      options,
    ).then(
      (result) => this.finish(entry, result),
      () => this.finish(entry, { requestId: -1, status: 'error' }),
    );
  }

  private finish(entry: MediaEntry, result: SpeechResult): void {
    const status = entry.forcedStatus ?? mapSpeechOutcome(result.status);
    if (entry.playbackGuardActive) {
      this.microphoneGuard.settlePlayback(entry.request.intentId, status);
      entry.playbackGuardActive = false;
    }
    entry.resolve({
      intentId: entry.request.intentId,
      status,
      speechStatus: result.status,
      ...(entry.cancellationReason === null
        ? {}
        : { cancellationReason: entry.cancellationReason }),
    });
    if (this.active !== entry) {
      return;
    }
    this.active = null;
    const next = this.pending;
    this.pending = null;
    if (next) {
      this.start(next);
    }
  }
}

export const interactionMediaCoordinator = new InteractionMediaCoordinator();
