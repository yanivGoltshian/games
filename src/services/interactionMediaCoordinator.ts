import {
  communicationScopeKey,
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
  | 'exit'
  | 'background'
  | 'activity-replacement';

export interface InteractionMediaRequest {
  intentId: string;
  source: CommunicationInputSource;
  scope: CommunicationGameScope;
  localeLock: CommunicationLocaleLock;
  audioClass: InteractionAudioClass;
  segments: readonly SpeechSegment[];
  settings: ToddlerSettings;
}

export interface InteractionMediaOutcome {
  intentId: string;
  status: InteractionMediaOutcomeStatus;
  speechStatus?: SpeechResult['status'];
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
  backendScope: string;
  started: boolean;
  playbackGuardActive: boolean;
  forcedStatus: InteractionMediaOutcomeStatus | null;
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
    if (
      !localeLockMatches(request.localeLock, request.scope, request.localeLock.locale)
      || request.segments.some((segment) => segment.locale !== request.localeLock.locale)
    ) {
      return Promise.resolve({
        intentId: request.intentId,
        status: 'unavailable',
        reason: 'locale-mismatch',
      });
    }
    if (request.segments.length === 0) {
      return Promise.resolve({
        intentId: request.intentId,
        status: 'unavailable',
        reason: 'empty-content',
      });
    }

    return new Promise((resolve) => {
      const entry: MediaEntry = {
        request,
        backendScope: `communication:${communicationScopeKey(request.scope)}`,
        started: false,
        playbackGuardActive: false,
        forcedStatus: null,
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

    if (this.pending && relevant(this.pending)) {
      this.settlePending(this.pending, reason === 'exit' || reason === 'background' ? 'cancelled' : 'replaced');
    }
    if (!this.active || !relevant(this.active)) {
      return;
    }

    const mustCancelMandatory = (
      reason === 'exit'
      || reason === 'background'
      || reason === 'activity-replacement'
      || !this.active.started
    );
    if (
      this.active.request.audioClass !== 'mandatory'
      || mustCancelMandatory
    ) {
      this.cancelActive(reason === 'exit' || reason === 'background' ? 'cancelled' : 'replaced');
    }
  }

  cancelAll(reason: Extract<InteractionCancellationReason, 'exit' | 'background'> = 'exit'): void {
    if (this.pending) {
      this.settlePending(this.pending, 'cancelled');
    }
    if (this.active) {
      this.cancelActive('cancelled', reason === 'background' ? 'visibility' : 'navigation');
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

  private settlePending(entry: MediaEntry, status: InteractionMediaOutcomeStatus): void {
    if (this.pending === entry) {
      this.pending = null;
    }
    entry.resolve({ intentId: entry.request.intentId, status });
  }

  private cancelActive(
    status: InteractionMediaOutcomeStatus,
    reason: 'navigation' | 'replay' | 'visibility' = 'replay',
  ): void {
    if (!this.active) {
      return;
    }
    this.active.forcedStatus = status;
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
      [...entry.request.segments],
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
