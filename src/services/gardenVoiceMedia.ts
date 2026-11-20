import { getSharedAudioContext } from './sound';
import { GARDEN_VOICE_MAX_BYTES, GARDEN_VOICE_MAX_MS } from './gardenVoiceStorage';

export type GardenRecording = { stop: () => void; result: Promise<Blob> };

export async function startGardenRecording(signal: AbortSignal): Promise<GardenRecording> {
  if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Recording is not supported on this device.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    stream.getTracks().forEach((track) => track.stop());
  };
  if (signal.aborted) {
    release();
    throw new DOMException('Recording cancelled.', 'AbortError');
  }
  let recorder: MediaRecorder;
  try {
    const mimeType = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
      .find((type) => MediaRecorder.isTypeSupported?.(type));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch (error) {
    release();
    throw error;
  }

  const stop = () => {
    if (recorder.state === 'recording') recorder.stop();
  };
  let timer: ReturnType<typeof setTimeout>;
  const result = new Promise<Blob>((resolve, reject) => {
    const chunks: Blob[] = [];
    let size = 0;
    const cleanup = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      release();
    };
    const abort = () => {
      cleanup();
      reject(new DOMException('Recording cancelled.', 'AbortError'));
      stop();
    };
    signal.addEventListener('abort', abort, { once: true });
    recorder.ondataavailable = ({ data }) => {
      size += data.size;
      if (data.size && size <= GARDEN_VOICE_MAX_BYTES) chunks.push(data);
      if (size > GARDEN_VOICE_MAX_BYTES) stop();
    };
    recorder.onerror = () => {
      cleanup();
      reject(new Error('The device could not finish recording.'));
    };
    recorder.onstop = () => {
      cleanup();
      const type = recorder.mimeType || chunks[0]?.type;
      if (!size || !type || size > GARDEN_VOICE_MAX_BYTES) {
        reject(new Error('No usable recording was created.'));
        return;
      }
      resolve(new Blob(chunks, { type }));
    };
    try {
      recorder.start(250);
      timer = setTimeout(stop, GARDEN_VOICE_MAX_MS);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
  return { stop, result };
}

export async function playGardenVoice(clip: Blob, volume: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return false;
  const context = getSharedAudioContext();
  if (!context || context.state !== 'running') return false;
  return new Promise<boolean>((resolve) => {
    let source: AudioBufferSourceNode | undefined;
    let gain: GainNode | undefined;
    let settled = false;
    const finish = (played: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      if (source) {
        source.onended = null;
        if (!played) source.stop();
        source.disconnect();
      }
      gain?.disconnect();
      resolve(played);
    };
    const abort = () => finish(false);
    const timer = setTimeout(abort, GARDEN_VOICE_MAX_MS + 2_000);
    signal.addEventListener('abort', abort, { once: true });
    void clip.arrayBuffer().then((bytes) => context.decodeAudioData(bytes)).then((buffer) => {
      if (settled) return;
      if (buffer.duration > GARDEN_VOICE_MAX_MS / 1_000 + 1) {
        finish(false);
        return;
      }
      gain = context.createGain();
      gain.gain.value = Math.max(0, Math.min(1, volume));
      gain.connect(context.destination);
      const playback = context.createBufferSource();
      playback.buffer = buffer;
      playback.connect(gain);
      playback.onended = () => finish(true);
      playback.start();
      source = playback;
    }).catch(() => finish(false));
  });
}
