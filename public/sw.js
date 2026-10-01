/// <reference lib="webworker" />

// ─── Cache versioning ───────────────────────────────────────────────────────
const CURRENT_VERSION = 'v4';
const PREVIOUS_STATIC_CACHE = 'static-v3'; // Retained for 1 generation to prevent ChunkLoadError
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
 * HTML Navigation: Network-First with 3s timeout.
 * - If network responds with redirect (307) or error, returns it as-is (NEVER replaces redirect with offline page)
 * - Caches only response.ok (200) HTML
 * - If network times out or fails (airplane mode), serves cached HTML
 * - Only serves offline.html if no cached HTML exists
 */
async function navigationWithFallback(request) {
  const cache = await caches.open(SHELL_CACHE);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    // If it's a redirect (3xx) or auth error (401/403/5xx), return as-is
    if (networkResponse.type === 'opaqueredirect' || networkResponse.redirected || !networkResponse.ok) {
      return networkResponse;
    }

    // Cache clean 200 OK HTML
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch {
    // Network timed out or connection offline: check cache for this URL
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fall back to offline page
    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) {
      return offlinePage;
    }

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
