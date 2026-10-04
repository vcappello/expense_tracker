// Service worker per Expense Tracker AI (PWA).
// Strategie:
//  - Navigazioni: network-first con fallback su index.html (app shell, offline).
//  - Asset statici (assets/, icons/, manifest): cache-first.
// I dati restano locali nel dispositivo (IndexedDB), non c'è API di rete.
//
// GitHub Pages: l'app può essere servita dalla root (localhost/preview) o da una
// sottocartella (es. /expense_tracker/). Tutti i percorsi derivano da
// self.registration.scope (che termina sempre con '/'), quindi funzionano in
// entrambi i casi senza hardcoded path.
// Versione delle icone: va bumpata insieme a index.html e manifest.webmanifest
// quando le icone cambiano. I file mantengono lo stesso nome (quindi lo stesso
// URL) e senza `?v=` browser e service worker continuerebbero a servire le
// icone vecchie dal loro cache.
const ICON_VERSION = '2';

// Bumpare a ogni correzione della strategia di cache: `activate` elimina le
// cache con nome diverso, forzando il refresh degli asset cache-first.
const CACHE = 'expense-tracker-v3';

const BASE = self.registration.scope;
const INDEX_HTML = new URL('index.html', BASE).href;
const MANIFEST = new URL('manifest.webmanifest', BASE).href;
const ASSETS_BASE = new URL('assets/', BASE).href;
const ICONS_BASE = new URL('icons/', BASE).href;
const PRECACHE = [BASE, INDEX_HTML, MANIFEST];
const PRECACHE_ICONS = ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'icon-180.png'].map(
  (name) => new URL(`icons/${name}?v=${ICON_VERSION}`, BASE).href
);

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      // Icone precache best-effort: un errore non deve bloccare l'update del SW.
      // `cache: 'reload'` scavalca l'HTTP cache (GitHub Pages: max-age 600).
      await Promise.all(
        PRECACHE_ICONS.map((url) =>
          cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
        )
      );
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigazioni: prima la rete, se offline restituisci l'app shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(INDEX_HTML, copy));
          return res;
        })
        .catch(() => caches.match(INDEX_HTML))
    );
    return;
  }

  // Asset statici: cache-first.
  const isStatic =
    url.href.startsWith(ASSETS_BASE) ||
    url.href.startsWith(ICONS_BASE) ||
    url.href === MANIFEST;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && isStatic) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return res;
      });
    })
  );
});
