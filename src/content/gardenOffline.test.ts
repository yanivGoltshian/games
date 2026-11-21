import { readFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';

it.each([false, true])('installs a fresh story catalog without stranding old Garden tabs (upgrade=%s)', async (upgrade) => {
  const install = new Map<string, (event: { waitUntil: (p: Promise<void>) => void }) => void>();
  const self = { addEventListener: install.set.bind(install), skipWaiting: vi.fn() };
  const fresh = { version: 2, entries: { question: 'corrected', story: 'new' } };
  const old = Response.json({ version: 2, entries: { question: 'obsolete', retired: 'original' } });
  const stored = new Map<string, string>();
  const origin = 'https://local.example';
  const cache = {
    match: async (key: string) => new Response(stored.get(key)),
    put: async (key: string, value: Response) => { stored.set(key, await value.text()); },
    addAll: async (items: (string | Request)[]) => {
      for (const item of items) {
        if (typeof item === 'string') stored.set(item, 'bundled');
        else {
          expect(item.cache).toBe('reload');
          stored.set(item.url.slice(origin.length), JSON.stringify(fresh));
        }
      }
    },
  };
  const storage = {
    open: async () => cache,
    match: async (key: string, options: CacheQueryOptions & { cacheName: string }) =>
      upgrade && key === '/speech/manifest.json' && options.cacheName.endsWith('v32') ? old : undefined,
  };
  class LocalRequest extends Request {
    constructor(path: string, init?: RequestInit) { super(new URL(path, origin), init); }
  }
  new Function('self', 'caches', 'fetch', 'Request', readFileSync('public/sw.js', 'utf8'))(
    self, storage, async () => new Response('<script src="/assets/test.js"></script>'), LocalRequest);
  let done: Promise<void> | undefined;
  install.get('install')!({ waitUntil: p => { done = p; } });
  await done;
  expect(JSON.parse(stored.get('/speech/manifest.json?rev=garden-stories-v1')!)).toEqual(fresh);
  expect(JSON.parse(stored.get('/speech/manifest.json')!).entries)
    .toEqual(upgrade ? { retired: 'original', ...fresh.entries } : fresh.entries);
  expect(stored.get('/assets/garden/story-art.svg')).toBe('bundled');
  for (const file of ['garden-question-he-IL', 'garden-stories-he-IL', 'garden-stories-en-US', 'garden-stories-en-GB']) {
    expect(stored.get(`/speech/${file}-v1.mp3`)).toBe('bundled');
  }
  expect(self.skipWaiting).toHaveBeenCalledOnce();
});
