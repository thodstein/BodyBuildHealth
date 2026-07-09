// Self-unregistering service worker — removes any stale SW
self.addEventListener("install", (e) => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(self.registration.unregister().then(() => self.clients.claim()));
});
