export async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker registered:', reg.scope);
  } catch (e) { console.warn('⚠️ SW registration failed:', e); }
}

export function isOnline() { return navigator.onLine; }
export function monitorConnection(cb: (online: boolean) => void) {
  window.addEventListener('online', () => cb(true));
  window.addEventListener('offline', () => cb(false));
}