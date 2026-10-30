/**
 * Drone Lab service worker.
 *
 * - install: precache the app shell (document, manifest, icons)
 * - activate: delete caches from older versions
 * - fetch strategy:
 *   - navigation documents: network-first (so new deploys are picked up),
 *     falling back to the cached shell when offline
 *   - hashed static assets (JS/CSS/icons): cache-first, runtime cached
 * - non-GET and cross-origin requests are left untouched
 *
 * Bump VERSION to invalidate every cache on deploy.
 */
/* global self, caches, fetch, clients */

const VERSION = 'dl-v1';
const CACHE_NAME = `drone-lab-${VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return; // never intercept mutations
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // cross-origin: pass through

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkFirstDocument(request));
    return;
  }
  event.respondWith(cacheFirst(request));
});

/** Documents: try the network so deploys show up; offline falls back to shell. */
async function networkFirstDocument(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    const hit =
      (await cache.match(request)) ??
      (await cache.match('./index.html')) ??
      (await cache.match('./'));
    if (hit) return hit;
    throw err;
  }
}

/** Hashed assets: cache-first; misses go to the network and get cached. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell =
        (await cache.match('./index.html')) ?? (await cache.match('./'));
      if (shell) return shell;
    }
    throw err;
  }
}
