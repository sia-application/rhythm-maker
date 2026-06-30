const CACHE_NAME = 'sw-v34';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css?v=1.4.5',
    './script.js?v=1.4.5',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS_TO_CACHE.map((url) => {
                    return fetch(new Request(url, { cache: 'reload' })).then((response) => {
                        if (!response.ok) throw new Error(`Fetch failed for ${url}`);
                        return cache.put(url, response);
                    });
                })
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            caches.keys().then((keys) => {
                return Promise.all(
                    keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // CRITICAL: Only handle GET requests with http/https schemes
    let url;
    try {
        url = new URL(event.request.url);
        if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
            return;
        }
    } catch (e) {
        return;
    }

    // CRITICAL: Only intercept same-origin requests to avoid breaking Firestore/external APIs
    if (url.origin !== self.location.origin) {
        return;
    }

    // 1. Navigation requests (HTML): Network First
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            cache.put(event.request, copy).catch(() => { });
                        } catch (err) { }
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Other assets: Cache First, falling back to network
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            // Don't use ignoreSearch here for dynamic caching to be safe
                            cache.put(event.request, copy).catch(() => { });
                        } catch (err) { }
                    });
                }
                return networkResponse;
            });
        })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
