const CACHE_NAME = 'sean-learning-adventure-v34';
const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon-32.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/assets/vocabulary/apple.webp',
  '/assets/vocabulary/airplane.webp',
  '/assets/vocabulary/ball.webp',
  '/assets/vocabulary/banana.webp',
  '/assets/vocabulary/bus.webp',
  '/assets/vocabulary/car.webp',
  '/assets/vocabulary/carrot.webp',
  '/assets/vocabulary/cherries.webp',
  '/assets/vocabulary/cat.webp',
  '/assets/vocabulary/chair.webp',
  '/assets/vocabulary/cup.webp',
  '/assets/vocabulary/dog.webp',
  '/assets/vocabulary/dates.webp',
  '/assets/vocabulary/duck.webp',
  '/assets/vocabulary/elephant.webp',
  '/assets/vocabulary/emotion-angry.svg',
  '/assets/vocabulary/emotion-crying.svg',
  '/assets/vocabulary/emotion-happy.svg',
  '/assets/vocabulary/emotion-sad.svg',
  '/assets/vocabulary/emotion-scared.svg',
  '/assets/vocabulary/emotion-surprised.svg',
  '/assets/vocabulary/flower.webp',
  '/assets/vocabulary/orange.webp',
  '/assets/vocabulary/persimmons.webp',
  '/assets/vocabulary/rabbit.webp',
  '/assets/vocabulary/shoe.webp',
  '/assets/vocabulary/spoon.webp',
  '/assets/vocabulary/strawberry.webp',
  '/assets/vocabulary/train.webp',
  '/assets/vocabulary/tree.webp',
  '/assets/garden/banana.webp',
  '/assets/garden/banana-bitten.webp',
  '/assets/garden/dates.webp',
  '/assets/garden/date-pit-germinating.webp',
  '/assets/garden/date-pit-planted.webp',
  '/assets/garden/date-palm-seedling.webp',
  '/assets/garden/date-palm-tree.webp',
  '/assets/garden/persimmon.webp',
  '/assets/garden/sean-avatar.webp',
  '/assets/garden/station.webp',
  '/assets/garden/story-art.svg',
  '/assets/garden/token.webp',
  '/assets/garden/watering-can.webp',
  '/speech/manifest.json',
  '/speech/manifest.json?rev=garden-stories-v1',
  '/speech/manifest.json?rev=garden-stories-v2',
  '/speech/garden-question-he-IL-v1.mp3',
  '/speech/garden-stories-he-IL-v1.mp3',
  '/speech/garden-stories-en-GB-v1.mp3',
  '/speech/garden-stories-en-US-v1.mp3',
  '/speech/garden-stories-he-IL-v2.mp3',
  '/speech/garden-stories-en-GB-v2.mp3',
  '/speech/garden-stories-en-US-v2.mp3',
  '/speech/he-IL.mp3',
  '/speech/en-US.mp3',
  '/speech/en-GB.mp3',
];
const RETIRED_ASSET_PATHS = [
  '/speech/toy-phone-he-IL-v1.mp3',
  '/speech/toy-phone-en-US-v1.mp3',
  '/speech/toy-phone-en-GB-v1.mp3',
  '/speech/story-that-waits-v1.manifest.json',
  '/speech/story-that-waits-he-IL-v1.mp3',
  '/speech/story-that-waits-en-US-v1.mp3',
  '/speech/story-that-waits-en-GB-v1.mp3',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    fetch('/index.html', { cache: 'no-cache' })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to cache app shell: ${response.status}`);
        }

        const html = await response.clone().text();
        const buildAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
          .map((match) => match[1])
          .filter((path) => path?.startsWith('/assets/'));
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', response);
        await cache.addAll([...APP_SHELL, ...buildAssets].map((path) =>
          path.startsWith('/speech/manifest.json') || path === '/assets/garden/story-art.svg'
            ? new Request(path, { cache: 'reload' }) : path));
        // Keep the lookup URLs used by already-open tabs. New tabs see only
        // the current catalog; old tabs can still finish removed story beats.
        for (const [path, from] of [
          ['/speech/manifest.json?rev=garden-stories-v1', 'v33'],
          ['/speech/manifest.json', 'v33'],
          ['/speech/manifest.json', 'v32'],
        ]) {
          const previous = await caches.match(path, { cacheName: `sean-learning-adventure-${from}` });
          if (!previous) continue;
          const old = await previous.json().catch(() => null);
          if (old?.version === 2 && old.entries) {
            const current = await (await cache.match(path)).json();
            await cache.put(path, Response.json({
              ...current, entries: { ...old.entries, ...current.entries },
            }));
          }
        }
        await self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
      caches
        .open(CACHE_NAME)
        .then((cache) => Promise.all(RETIRED_ASSET_PATHS.map((path) => cache.delete(path)))),
    ])
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }
  if (RETIRED_ASSET_PATHS.includes(url.pathname)) {
    event.respondWith(Promise.resolve(new Response(null, {
      status: 404,
      statusText: 'Not Found',
    })));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', clone));
          return response;
        })
        .catch(() => caches.match('/index.html')),
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreVary: true }).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});
