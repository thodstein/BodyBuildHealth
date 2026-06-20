export async function registerSW() {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');

    reg.update();

    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      if (!newSW) return;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          const existing = document.getElementById('sw-update-toast');
          if (existing) return;
          const toast = document.createElement('div');
          toast.id = 'sw-update-toast';
          toast.style.cssText =
            'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9999;' +
            'padding:10px 20px;border-radius:12px;background:rgba(0,0,0,0.9);backdropFilter:blur(20px);' +
            'color:#fff;font-size:12px;font-weight:600;cursor:pointer;border:1px solid rgba(0,230,138,0.3);' +
            'display:flex;align-items:center;gap:8px;animation:fadeSlideIn 0.3s ease;';
          toast.textContent = '🔄 Доступно обновление! Нажмите для перезагрузки';
          toast.onclick = () => { newSW.postMessage({ type: 'SKIP_WAITING' }); };
          document.body.appendChild(toast);
        }
      });
    });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      const toast = document.getElementById('sw-update-toast');
      if (toast) toast.remove();
      window.location.reload();
    });
  } catch (e) {
    console.warn('SW registration failed:', e);
  }
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function monitorConnection(callback: (online: boolean) => void) {
  window.addEventListener('online', () => callback(true));
  window.addEventListener('offline', () => callback(false));
}
