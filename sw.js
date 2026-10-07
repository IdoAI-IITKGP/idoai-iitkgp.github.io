/* ==========================================================================
   IdoAI - Service Worker (makes the site installable as an app and usable offline)
   Pages, CSS and JS: network first, so updates show at once; the cached copy is used offline.
   Images and fonts: served from the cache straight away and refreshed in the background.
   Bump CACHE_VERSION to drop everything cached by an older version.
   ========================================================================== */
const CACHE_VERSION = 'idoai-v7';

const CORE_FILES = [
    './',
    'index.html',
    'events.html',
    'gallery.html',
    'contact.html',
    '404.html',
    'style.css',
    'js/main.js',
    'manifest.webmanifest',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'icons/favicon.svg',
    'icons/favicon-32.png',
    'IITKgp_logo.svg',
    'iitlogo.png'
];

// Fonts and icon font come from these hosts; anything else cross-origin is left to the browser
const ASSET_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION)
            .then((cache) => cache.addAll(CORE_FILES))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || request.headers.has('range')) return;

    const url = new URL(request.url);
    const sameOrigin = url.origin === self.location.origin;

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request, true));
    } else if (sameOrigin && /\.(css|js|webmanifest)$/.test(url.pathname)) {
        event.respondWith(networkFirst(request, false));
    } else if (sameOrigin || ASSET_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(request, event));
    }
});

async function networkFirst(request, isPage) {
    const cache = await caches.open(CACHE_VERSION);
    try {
        const response = await fetch(request);
        // (a redirected response can't be replayed for a page load, so those aren't stored)
        if (response.ok && !response.redirected) cache.put(request, response.clone());
        return response;
    } catch (err) {
        const cached = await cache.match(request, { ignoreSearch: isPage });
        if (cached) return cached;
        // Offline and this page was never visited: show the home page instead
        if (isPage) return (await cache.match('index.html')) || Response.error();
        return Response.error();
    }
}

async function staleWhileRevalidate(request, event) {
    const cache = await caches.open(CACHE_VERSION);
    const cached = await cache.match(request);
    const refresh = fetch(request)
        .then((response) => {
            if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached || Response.error());
    if (cached) {
        event.waitUntil(refresh.then(() => undefined));
        return cached;
    }
    return refresh;
}
