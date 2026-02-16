const CACHE_NAME = 'sw-v11';
const ASSETS = [
    './',
    './index.html',
    './style.css?v=1.4.1',
    './script.js?v=1.4.1',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return Promise.all(
                ASSETS.map((url) => {
                    return fetch(new Request(url, { cache: 'reload' })).then((response) => {
                        if (!response.ok) throw new Error(`Fetch failed for ${url}`);
                        // Use a separate function or try-catch if needed here too, 
                        // but these are core assets so failure here is usually fatal for the SW installation.
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
    // Only handle GET requests with http/https schemes for caching
    // This is the first line of defense against unsupported protocols
    try {
        const url = new URL(event.request.url);
        if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
            return;
        }
    } catch (e) {
        // If URL parsing fails, ignore this request
        return;
    }

    // 1. Navigation requests (HTML): Network First
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Update the cache with the new version of the page
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        // Extra protection: catch errors inside the cache.put call
                        try {
                            cache.put(event.request, copy).catch(err => {
                                console.warn('PWA: Failed to cache navigation request:', err);
                            });
                        } catch (err) {
                            console.warn('PWA: Cache.put error (sync):', err);
                        }
                    });
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // 2. Other assets: Cache First, falling back to network
    event.respondWith(
        caches.match(event.request, { ignoreSearch: true }).then((response) => {
            return response || fetch(event.request).then((networkResponse) => {
                // Optionally cache new assets found on the fly
                if (networkResponse && networkResponse.status === 200) {
                    const copy = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        try {
                            cache.put(event.request, copy).catch(err => {
                                // This is where we catch the "unsupported method" or "unsupported scheme" if previous checks missed it
                                console.warn('PWA: Failed to cache dynamic asset:', err);
                            });
                        } catch (err) {
                            console.warn('PWA: Cache.put error (sync) dynamic:', err);
                        }
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
