// ─── Cache versioning ───────────────────────────────────────────────────────
// Bump CACHE_VERSION when you want to force a full cache refresh on all devices
const CACHE_VERSION = 'v2';
const SHELL_CACHE   = `shell-${CACHE_VERSION}`;
const STATIC_CACHE  = `static-${CACHE_VERSION}`;
const API_CACHE     = `api-${CACHE_VERSION}`;

// Pages / assets pre-cached at install time (app shell)
const SHELL_URLS = ['/', '/offline.html', '/image.png'];

// API paths served stale-while-revalidate
const SWR_API_PREFIXES = ['/api/vocabulary', '/api/quotes', '/api/whats-new'];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const currentCaches = [SHELL_CACHE, STATIC_CACHE, API_CACHE];
  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(names.filter((n) => !currentCaches.includes(n)).map((n) => caches.delete(n)))
      )
      .then(() => self.clients.claim())
  );
});

// ─── Fetch routing ──────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // /_next/static/ — immutable, content-hashed → cache-first forever
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Public images & fonts → cache-first
  if (/\.(png|jpe?g|webp|svg|ico|gif|woff2?)(\?.*)?$/.test(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Known lightweight API routes → stale-while-revalidate
  if (SWR_API_PREFIXES.some((p) => url.pathname.startsWith(p))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // HTML page navigations → network-first + offline fallback
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstWithFallback(request));
    return;
  }
});

// ─── Background sync ────────────────────────────────────────────────────────
// When the device comes back online the browser fires a 'sync' event.
// We notify open tabs so they can reload fresh data.
self.addEventListener('sync', (event) => {
  if (event.tag === 'task-sync') {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((windows) => {
        for (const w of windows) w.postMessage({ type: 'BACKGROUND_SYNC' });
      })
    );
  }
});

// ─── Caching strategies ─────────────────────────────────────────────────────

/** Cache-first: serve from cache; populate cache only on miss */
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
    return response;
  } catch {
    return new Response('Not found', { status: 404 });
  }
}

/** Stale-while-revalidate: return cache immediately; refresh in background */
async function staleWhileRevalidate(request, cacheName) {
  const cache   = await caches.open(cacheName);
  const cached  = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached ?? (await refresh) ?? new Response('Offline', { status: 503 });
}

/** Network-first: try live fetch; fall back to cache then /offline.html */
async function networkFirstWithFallback(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(SHELL_CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const offlinePage = await caches.match('/offline.html');
    return (
      offlinePage ??
      new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } })
    );
  }
}

// ─── Push notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Lets Do It', {
      body:  data.body  || 'You have a new task update.',
      icon:  '/image.png',
      badge: '/image.png',
      data:  { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((c) => c.url === targetUrl);
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});
