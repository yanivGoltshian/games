import { afterEach, expect, it, vi } from 'vitest';
import { startGardenRecording } from './gardenVoiceMedia';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('starts only on request, selects the supported format, ends the stream and returns its clip', async () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
  const create = vi.fn();
  class Recorder {
    static isTypeSupported = (type: string) => type === 'audio/webm;codecs=opus';
    state = 'inactive';
    mimeType = 'audio/webm;codecs=opus';
    ondataavailable?: (event: { data: Blob }) => void;
    onstop?: () => void;
    constructor(stream: MediaStream, options: MediaRecorderOptions) { create(stream, options); }
    start() { this.state = 'recording'; }
    stop() {
      this.state = 'inactive';
      queueMicrotask(() => {
        this.ondataavailable?.({ data: new Blob(['local'], { type: this.mimeType }) });
        this.onstop?.();
      });
    }
  }
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', Recorder);
  const recording = await startGardenRecording(new AbortController().signal);
  expect(getUserMedia).toHaveBeenCalledExactlyOnceWith({ audio: true });
  expect(create).toHaveBeenCalledWith(expect.anything(), { mimeType: 'audio/webm;codecs=opus' });
  recording.stop();
  expect(await (await recording.result).text()).toBe('local');
  expect(stop).toHaveBeenCalledTimes(1);
});

it('handles denied permission and stops a late stream when permission resolves after dismount', async () => {
  const stop = vi.fn();
  const getUserMedia = vi.fn();
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
  vi.stubGlobal('MediaRecorder', class {});
  const controller = new AbortController();
  getUserMedia.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
  await expect(startGardenRecording(controller.signal)).rejects.toMatchObject({ name: 'NotAllowedError' });
  let grant!: (stream: unknown) => void;
  getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { grant = resolve; }));
  const pending = startGardenRecording(controller.signal);
  controller.abort();
  grant({ getTracks: () => [{ stop }] });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(stop).toHaveBeenCalledTimes(1);
});
