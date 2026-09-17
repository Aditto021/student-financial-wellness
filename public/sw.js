/**
 * public/sw.js
 * -----------------------------------------------------------------
 * Minimal service worker. This app is fully dynamic (live database
 * data on every page) — there's no offline mode to build, and no
 * point risking stale cached HTML. Its only job is to exist and
 * register, which is what browsers require before they'll treat the
 * site as installable ("Add to Home Screen" / PWA install).
 * -----------------------------------------------------------------
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op — falls through to a normal network fetch every time.
self.addEventListener('fetch', () => {});
