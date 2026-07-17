import type { ToddlerSettings } from '../domain/types';

interface ToneStep {
  frequency: number;
  duration: number;
  gain: number;
  /** Fundamental waveform. Defaults to a soft sine. */
  type?: OscillatorType;
  /** Amount (0..1) of gentle one-octave overtone layered on top for a warm, bell-like body. */
  shimmer?: number;
}

interface MasterBus {
  context: AudioContext;
  input: GainNode;
}

const MIN_GAIN = 0.0001;
const TAIL_SECONDS = 0.07;

class SoundService {
  private context: AudioContext | null = null;

  private master: MasterBus | null = null;

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

  /**
   * Lazily builds (and caches) a warm master chain: soft low-pass to tame harsh
   * highs, then a gentle compressor to glue the voices and prevent clicks. This is
   * what gives every cue its premium, non-alarm character.
   */
  private ensureMaster(context: AudioContext): GainNode {
    if (this.master && this.master.context === context) {
      return this.master.input;
    }

    const input = context.createGain();
    input.gain.value = 1;

    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3200;
    filter.Q.value = 0.7;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;

    input.connect(filter);
    filter.connect(compressor);
    compressor.connect(context.destination);

    this.master = { context, input };
    return input;
  }

  unlock(): void {
    this.ensureContext()?.resume().catch(() => undefined);
  }

  getContext(): AudioContext | null {
    return this.ensureContext();
  }

  /** Schedules one enveloped voice on the master bus with a soft attack and warm release tail. */
  private scheduleVoice(
    context: AudioContext,
    destination: GainNode,
    options: { frequency: number; type: OscillatorType; peak: number; start: number; end: number },
  ): void {
    const { frequency, type, peak, start, end } = options;
    const safePeak = Math.max(MIN_GAIN * 6, peak);
    const attackEnd = start + Math.min(0.014, (end - start) * 0.35);
    const sustainAt = Math.max(attackEnd + 0.001, end - Math.min(0.09, (end - start) * 0.45));
    const tailEnd = end + TAIL_SECONDS;

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);

    gainNode.gain.setValueAtTime(MIN_GAIN, start);
    gainNode.gain.exponentialRampToValueAtTime(safePeak, attackEnd);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(MIN_GAIN, safePeak * 0.55), sustainAt);
    gainNode.gain.exponentialRampToValueAtTime(MIN_GAIN, tailEnd);

    oscillator.connect(gainNode);
    gainNode.connect(destination);
    oscillator.start(start);
    oscillator.stop(tailEnd);
  }

  private playSequence(settings: ToddlerSettings, sequence: ToneStep[]): void {
    if (settings.quietMode || settings.soundLevel <= 0) {
      return;
    }

    const context = this.ensureContext();
    if (!context) {
      return;
    }

    const master = this.ensureMaster(context);
    const startAt = context.currentTime + 0.01;
    sequence.forEach((step, index) => {
      const stepStart = startAt + sequence.slice(0, index).reduce((sum, item) => sum + item.duration, 0);
      const stepEnd = stepStart + step.duration;
      const peak = step.gain * settings.soundLevel;

      this.scheduleVoice(context, master, {
        frequency: step.frequency,
        type: step.type ?? 'sine',
        peak,
        start: stepStart,
        end: stepEnd,
      });

      const shimmer = step.shimmer ?? 0.25;
      if (shimmer > 0) {
        this.scheduleVoice(context, master, {
          frequency: step.frequency * 2,
          type: 'sine',
          peak: peak * shimmer,
          start: stepStart,
          end: stepEnd,
        });
      }
    });
  }

  playTap(settings: ToddlerSettings): void {
    // A soft, crisp click — low shimmer keeps it a tap rather than a bell.
    this.playSequence(settings, [{ frequency: 420, duration: 0.08, gain: 0.08, shimmer: 0.12 }]);
  }

  playSuccess(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.11, gain: 0.1 },
      { frequency: 659, duration: 0.14, gain: 0.1, shimmer: 0.32 },
    ]);
  }

  playRetry(settings: ToddlerSettings): void {
    // Gentle, rounded "let's try again" — softened shimmer so it never reads as a buzzer.
    this.playSequence(settings, [
      { frequency: 440, duration: 0.08, gain: 0.055, shimmer: 0.18 },
      { frequency: 494, duration: 0.1, gain: 0.05, shimmer: 0.18 },
    ]);
  }

  playCelebrate(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.1, gain: 0.1 },
      { frequency: 659, duration: 0.12, gain: 0.11 },
      { frequency: 784, duration: 0.15, gain: 0.12, shimmer: 0.34 },
    ]);
  }

  /** Slightly richer chime for streak/level-up milestones. Still gentle, no alarm-like tones. */
  playMilestone(settings: ToddlerSettings): void {
    this.playSequence(settings, [
      { frequency: 523, duration: 0.09, gain: 0.1 },
      { frequency: 659, duration: 0.11, gain: 0.11 },
      { frequency: 784, duration: 0.12, gain: 0.12 },
      { frequency: 988, duration: 0.18, gain: 0.13, shimmer: 0.4 },
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

export function getSharedAudioContext(): AudioContext | null {
  return soundService.getContext();
}

export async function unlockAudioContext(): Promise<void> {
  const context = soundService.getContext();
  if (context?.state === 'suspended') {
    await context.resume();
  }
}
