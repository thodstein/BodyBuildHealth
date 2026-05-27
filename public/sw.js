const CACHE_NAME = 'health-engine-v2';
const STATIC_ASSETS = ['/', '/index.html', '/src/main.ts', '/src/styles.css'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const { title, body } = e.data.json();
  e.waitUntil(self.registration.showNotification(title, { body, icon: '/icon.png', tag: 'health-engine' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});

self.addEventListener('periodicsync', e => {
  if (e.tag === 'check-lab-deadlines') {
    e.waitUntil(checkDeadlines());
  }
});

async function checkDeadlines() {
  const reminders = JSON.parse(localStorage.getItem('pending_reminders') || '[]');
  const now = Date.now();
  const active = reminders.filter(r => now > new Date(r.due).getTime() + 3*24*60*60*1000);
  
  if (active.length > 0) {
    self.registration.showNotification('⚠️ Просрочены анализы', {
      body: `Не сдано: ${active.map(r=>r.checkpoint).join(', ')}`,
      icon: '/icon.png', tag: 'health-engine'
    });
  }
}