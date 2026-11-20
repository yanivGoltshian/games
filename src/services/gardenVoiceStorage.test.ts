import 'fake-indexeddb/auto';
import { expect, it } from 'vitest';
import { GARDEN_SENTENCES, getGardenVoiceKey } from '../content/gardenSentences';
import { deleteGardenVoice, GARDEN_VOICE_MAX_BYTES, readGardenVoice, saveGardenVoice } from './gardenVoiceStorage';

it('keeps locally saved Sean clips isolated by sentence and language through save, replace, and delete', async () => {
  const [banana, dates] = GARDEN_SENTENCES;
  const hebrew = getGardenVoiceKey(banana, 'he');
  const english = getGardenVoiceKey(banana, 'en');
  const otherSentence = getGardenVoiceKey(dates, 'he');
  const clip = (text: string) => new Blob([text], { type: 'audio/webm' });

  await saveGardenVoice(hebrew, clip('Hebrew recording'));
  await saveGardenVoice(english, clip('English recording'));
  expect(await (await readGardenVoice(hebrew))?.text()).toBe('Hebrew recording');
  expect(await (await readGardenVoice(english))?.text()).toBe('English recording');
  expect(await readGardenVoice(otherSentence)).toBeNull();

  await saveGardenVoice(hebrew, clip('replacement'));
  expect(await (await readGardenVoice(hebrew))?.text()).toBe('replacement');
  await deleteGardenVoice(hebrew);
  expect(await readGardenVoice(hebrew)).toBeNull();
  expect(await (await readGardenVoice(english))?.text()).toBe('English recording');
  await deleteGardenVoice(english);
});

it('rejects invalid local clips without overwriting the existing sentence recording', async () => {
  const key = getGardenVoiceKey(GARDEN_SENTENCES[0], 'en');
  await saveGardenVoice(key, new Blob(['original'], { type: 'audio/mp4' }));
  for (const invalid of [
    new Blob([], { type: 'audio/mp4' }),
    new Blob(['not audio'], { type: 'text/plain' }),
    new Blob([new Uint8Array(GARDEN_VOICE_MAX_BYTES + 1)], { type: 'audio/mp4' }),
  ]) {
    await expect(saveGardenVoice(key, invalid)).rejects.toThrow();
  }
  expect(await (await readGardenVoice(key))?.text()).toBe('original');
  await deleteGardenVoice(key);
});
