const CACHE_NAME = 'sean-learning-adventure-v18';
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
  '/assets/vocabulary/cat.webp',
  '/assets/vocabulary/chair.webp',
  '/assets/vocabulary/cup.webp',
  '/assets/vocabulary/dog.webp',
  '/assets/vocabulary/duck.webp',
  '/assets/vocabulary/elephant.webp',
  '/assets/vocabulary/flower.webp',
  '/assets/vocabulary/orange.webp',
  '/assets/vocabulary/rabbit.webp',
  '/assets/vocabulary/shoe.webp',
  '/assets/vocabulary/spoon.webp',
  '/assets/vocabulary/strawberry.webp',
  '/assets/vocabulary/train.webp',
  '/assets/vocabulary/tree.webp',
  '/speech/manifest.json',
  '/speech/he-IL.mp3',
  '/speech/en-US.mp3',
  '/speech/en-GB.mp3',
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
        await cache.addAll([...APP_SHELL, ...buildAssets]);
        await self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
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
