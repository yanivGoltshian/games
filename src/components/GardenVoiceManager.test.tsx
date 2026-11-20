// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { GardenVoiceManager } from './GardenVoiceManager';

const mocks = vi.hoisted(() => ({ start: vi.fn(), read: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('../services/gardenVoiceMedia', () => ({ startGardenRecording: mocks.start }));
vi.mock('../services/gardenVoiceStorage', () => ({
  readGardenVoice: mocks.read, saveGardenVoice: mocks.save, deleteGardenVoice: mocks.remove,
}));

it('records only after caregiver action, previews a draft, preserves it on failed save, then replaces and deletes it', async () => {
  const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  env.IS_REACT_ACT_ENVIRONMENT = true;
  const host = document.createElement('div');
  const root = createRoot(host);
  const saved = new Map<string, Blob>();
  const clip = new Blob(['sample'], { type: 'audio/webm' });
  const replacement = new Blob(['new sample'], { type: 'audio/webm' });
  const preview = vi.fn(() => 'blob:synthetic-preview');
  const revoke = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: preview, revokeObjectURL: revoke }));
  mocks.read.mockImplementation(async (key: string) => saved.get(key) ?? null);
  mocks.save.mockImplementation(async (key: string, value: Blob) => { saved.set(key, value); });
  mocks.remove.mockImplementation(async (key: string) => { saved.delete(key); });
  const record = (value: Blob) => {
    let finish!: (value: Blob) => void;
    return { stop: () => finish(value), result: new Promise<Blob>((resolve) => { finish = resolve; }) };
  };
  mocks.start.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
    .mockResolvedValueOnce(record(clip)).mockResolvedValueOnce(record(replacement));
  const click = async (label: string) => {
    const button = [...host.querySelectorAll('button')].find((item) => item.textContent?.trim() === label);
    expect(button?.disabled).toBe(false);
    await act(async () => button!.click());
  };
  const change = async (select: HTMLSelectElement, value: string) => {
    await act(async () => { select.value = value; select.dispatchEvent(new Event('change', { bubbles: true })); });
  };
  try {
    await act(async () => root.render(<GardenVoiceManager useSean />));
    const selects = host.querySelectorAll('select');
    const language = selects.item(0);
    const sentence = selects.item(1);
    await change(language, 'en');
    await change(sentence, 'dates');
    expect(host.querySelector('[lang="en"]')?.textContent).toBe('Sean eats dates');
    expect(mocks.start).not.toHaveBeenCalled();
    await click('התחלת הקלטה');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('לא ניתנה הרשאת מיקרופון');
    await click('התחלת הקלטה');
    await click('עצירת הקלטה');
    expect(host.querySelector('audio')?.getAttribute('src')).toBe('blob:synthetic-preview');
    expect(preview).toHaveBeenLastCalledWith(clip);
    expect(saved.size).toBe(0);
    mocks.save.mockRejectedValueOnce(new Error('disk full'));
    await click('שמירת ההקלטה');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('לא הצלחנו לשמור');
    await click('שמירת ההקלטה');
    expect(saved.get('dates:sean:en')).toBe(clip);
    await click('הקלטת גרסה חדשה');
    await click('עצירת הקלטה');
    await click('שמירת ההקלטה');
    expect(saved.get('dates:sean:en')).toBe(replacement);
    await change(language, 'he');
    expect(host.querySelector('audio')).toBeNull();
    await change(language, 'en');
    await click('מחיקת ההקלטה');
    expect(saved.size).toBe(0);
    expect(host.querySelector('audio')).toBeNull();
    expect(revoke).toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
    delete env.IS_REACT_ACT_ENVIRONMENT;
  }
});
