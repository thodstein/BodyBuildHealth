export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    console.warn('⚠️ Service Workers not supported');
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    console.log('✅ Service Worker registered:', reg.scope);
  } catch (e) {
    console.warn('⚠️ SW registration failed:', e);
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function monitorConnection(callback: (online: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}