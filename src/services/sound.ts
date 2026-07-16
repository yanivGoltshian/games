import type { ToddlerSettings } from '../domain/types';

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
}

class SoundService {
  private context: AudioContext | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') {
      return null;
    }

    if (!this.context) {
      const AudioContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) {
        return null;
      }
      this.context = new AudioContextCtor();
    }

    return this.context;
  }

  unlock(): void {
    this.ensureContext()?.resume().catch(() => undefined);
  }

  private playSequence(settings: ToddlerSettings, sequence: ToneStep[]): void {
    if (settings.quietMode || settings.soundLevel <= 0) {
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const startAt = context.currentTime + 0.01;
    sequence.forEach((step, index) => {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const stepStart = startAt + sequence.slice(0, index).reduce((sum, item) => sum + item.duration, 0);
      const stepEnd = stepStart + step.duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(step.frequency, stepStart);
      gainNode.gain.setValueAtTime(0.0001, stepStart);
      gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, step.gain * settings.soundLevel), stepStart + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stepEnd);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(stepStart);
      oscillator.stop(stepEnd);
    });
  }

  playTap(settings: ToddlerSettings): void {
    this.playSequence(settings, [{ frequency: 420, duration: 0.08, gain: 0.08 }]);
  }

  playSuccess(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.11, gain: 0.1 },
      { frequency: 659, duration: 0.14, gain: 0.1 },
    ]);
  }

  playRetry(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 440, duration: 0.08, gain: 0.055 },
      { frequency: 494, duration: 0.1, gain: 0.05 },
    ]);
  }

  playCelebrate(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.1, gain: 0.1 },
      { frequency: 659, duration: 0.12, gain: 0.11 },
      { frequency: 784, duration: 0.15, gain: 0.12 },
    ]);
  }

  /** Slightly richer chime for streak/level-up milestones. Still gentle, no alarm-like tones. */
  playMilestone(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.09, gain: 0.1 },
      { frequency: 659, duration: 0.11, gain: 0.11 },
      { frequency: 784, duration: 0.12, gain: 0.12 },
      { frequency: 988, duration: 0.18, gain: 0.13 },
    ]);
  }

  /** Optional light haptic feedback. Gated by quiet mode; never required for correctness. */
  vibrate(settings: ToddlerSettings, pattern: number | number[] = 18): void {
    if (settings.quietMode || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
      return;
    }
    try {
      navigator.vibrate(pattern);
    } catch {
      // Vibration is a nice-to-have; silently ignore unsupported/blocked calls.
    }
  }
}

export const soundService = new SoundService();
