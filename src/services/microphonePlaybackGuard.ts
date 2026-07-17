export const DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS = 400;

export type PlaybackGuardOutcome =
  | 'completed'
  | 'cancelled'
  | 'replaced'
  | 'errored'
  | 'unavailable';

export interface MicrophonePlaybackGuardSnapshot {
  activePlaybackId: string | null;
  blockedUntil: number;
  microphoneAllowed: boolean;
}

export interface MicrophonePlaybackGuardContract {
  beginPlayback(playbackId: string): void;
  settlePlayback(playbackId: string, outcome: PlaybackGuardOutcome): void;
  microphoneAllowed(): boolean;
  subscribe(listener: (snapshot: MicrophonePlaybackGuardSnapshot) => void): () => void;
}

export class MicrophonePlaybackGuard implements MicrophonePlaybackGuardContract {
  private activePlaybackId: string | null = null;
  private blockedUntil = 0;
  private readonly subscribers = new Set<(snapshot: MicrophonePlaybackGuardSnapshot) => void>();

  constructor(
    private readonly guardMs = DEFAULT_MICROPHONE_PLAYBACK_GUARD_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  beginPlayback(playbackId: string): void {
    this.activePlaybackId = playbackId;
    this.notify();
  }

  settlePlayback(playbackId: string, outcome: PlaybackGuardOutcome): void {
    if (this.activePlaybackId !== playbackId) {
      return;
    }
    this.activePlaybackId = null;
    if (outcome === 'completed') {
      this.blockedUntil = Math.max(this.blockedUntil, this.now() + this.guardMs);
    }
    this.notify();
  }

  microphoneAllowed(): boolean {
    return this.activePlaybackId === null && this.now() >= this.blockedUntil;
  }

  getSnapshot(): MicrophonePlaybackGuardSnapshot {
    return {
      activePlaybackId: this.activePlaybackId,
      blockedUntil: this.blockedUntil,
      microphoneAllowed: this.microphoneAllowed(),
    };
  }

  subscribe(listener: (snapshot: MicrophonePlaybackGuardSnapshot) => void): () => void {
    this.subscribers.add(listener);
    listener(this.getSnapshot());
    return () => this.subscribers.delete(listener);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.subscribers.forEach((listener) => listener(snapshot));
  }
}

export const communicationMicrophoneGuard = new MicrophonePlaybackGuard();
