/// <reference lib="webworker" />

// ─── Cache versioning ───────────────────────────────────────────────────────
const CURRENT_VERSION = 'v5';
const PREVIOUS_STATIC_CACHE = 'static-v4'; // Retained for 1 generation to prevent ChunkLoadError
const SHELL_CACHE   = `shell-${CURRENT_VERSION}`;
const STATIC_CACHE  = `static-${CURRENT_VERSION}`;
const IMAGE_CACHE   = `image-${CURRENT_VERSION}`;
const API_CACHE     = `api-${CURRENT_VERSION}`;

// Precache static, unauthenticated, non-redirecting assets only (NEVER precache '/')
const PRECACHE_URLS = [
  '/offline.html',
  '/image.png',
  '/morning.webp',
  '/afternoon.webp',
  '/evening.webp',
  '/night.webp',
  '/favicon.ico',
];

// API prefixes served stale-while-revalidate
const SWR_API_PREFIXES = ['/api/vocabulary', '/api/quotes', '/api/whats-new'];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      // Use Promise.allSettled with per-URL cache.add so one failure never aborts install
      return Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Precache skipped for ${url}:`, err);
          })
        )
      );
    })
  );
  // Do NOT call self.skipWaiting() here — wait for client SKIP_WAITING message
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const allowedCaches = [SHELL_CACHE, STATIC_CACHE, PREVIOUS_STATIC_CACHE, IMAGE_CACHE, API_CACHE];

  event.waitUntil(
    caches.keys()
      .then((names) =>
        Promise.all(
          names.filter((name) => !allowedCaches.includes(name)).map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ─── Controlled Skip Waiting Message ────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data?.type === 'CLEAR_USER_CACHE') {
    // Clear HTML cache on logout so one user's data is never served to another
    caches.delete(SHELL_CACHE);
  }
});

// ─── Fetch Routing ──────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache Server Actions or RSC stream requests
  if (
    request.headers.get('next-action') ||
    request.headers.get('rsc') ||
    url.searchParams.has('_rsc')
  ) {
    return;
  }

  // 1. Next.js Static Chunks (immutable, content-hashed) -> Cache-First
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirstStatic(request));
    return;
  }

  // 2. Images, fonts, and icons -> Cache-First in IMAGE_CACHE
  if (/\.(png|jpe?g|webp|svg|ico|gif|woff2?)(\?.*)?$/.test(url.pathname)) {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  // 3. Known API routes -> Stale-While-Revalidate
  if (SWR_API_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  // 4. HTML Page Navigations -> Network-First with short timeout, fallback to cache, then offline.html
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(navigationWithFallback(request));
    return;
  }
});

// ─── Caching Strategies ─────────────────────────────────────────────────────

/** Cache-First for Next.js static assets with fallback to previous static cache */
async function cacheFirstStatic(request) {
  const cached = (await caches.match(request)) || (await (await caches.open(PREVIOUS_STATIC_CACHE)).match(request));
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset not found', { status: 404 });
  }
}

/** Cache-First for images and media */
async function cacheFirstImage(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(IMAGE_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

/** Stale-While-Revalidate for APIs */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch(() => null);

  return cached || (await fetchPromise) || new Response(JSON.stringify({ error: 'Offline' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * HTML Navigation: Stale-While-Revalidate.
 *
 * Repeat opens (cached shell exists):
 *   1. Return cached HTML immediately — shell appears without waiting on network.
 *   2. Kick off a background network fetch to refresh the cache.
 *   3. After background fetch completes, post SW_BACKGROUND_UPDATED to all clients
 *      so React can call router.refresh() to pull fresh server data.
 *
 * First opens (no cache yet) or non-200 network responses:
 *   - Wait for network; cache on 200 OK.
 *   - Redirects (307 etc.) and errors pass through as-is — never replaced with
 *     offline page or stale HTML.
 *
 * Security / privacy:
 *   - HTML cache is keyed by URL. Since both users share '/', logout MUST send
 *     CLEAR_USER_CACHE so the next user never sees stale HTML from the previous session.
 *   - We check for the presence of a Set-Cookie/Location redirect in the
 *     background response: if it redirects (auth expired), we delete the cache
 *     and let the client nav naturally expire on next real visit.
 */
async function navigationWithFallback(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);

  // ── Helper: background network fetch ─────────────────────────────────────
  async function refreshInBackground() {
    try {
      const networkResponse = await fetch(request);

      if (networkResponse.redirected || !networkResponse.ok) {
        // Auth expired / server error: evict the stale cache entry so the next
        // navigation goes through the network and picks up the redirect.
        await cache.delete(request);
        return;
      }

      // Update cache with fresh HTML
      await cache.put(request, networkResponse.clone());

      // Notify all clients so they can call router.refresh()
      const allClients = await self.clients.matchAll({ type: 'window' });
      for (const client of allClients) {
        client.postMessage({ type: 'SW_BACKGROUND_UPDATED' });
      }
    } catch {
      // Offline or network error — cached version stays valid, no notification sent
    }
  }

  if (cached) {
    // Serve from cache immediately; revalidate in background (fire-and-forget)
    refreshInBackground();
    return cached;
  }

  // ── No cache yet: wait for the network ───────────────────────────────────
  try {
    const networkResponse = await fetch(request);

    // Redirects and errors pass through as-is
    if (networkResponse.redirected || !networkResponse.ok) {
      return networkResponse;
    }

    // Cache the first successful 200 response
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    // Offline on very first open: show offline fallback
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('<h1>Offline</h1><p>Please check your internet connection.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

// ─── Push Notifications ──────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title || 'Lets Do It', {
        body: data.body || 'You have a new task update.',
        icon: '/image.png',
        badge: '/image.png',
        data: { url: data.url || '/' },
      })
    );
  } catch (err) {
    console.error('[SW] Push error:', err);
  }
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
