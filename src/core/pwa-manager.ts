let deferredPrompt: any = null;

export function initPWA() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwa_installed', 'true');
    hideInstallBanner();
    deferredPrompt = null;
  });
}

function showInstallBanner() {
  if (localStorage.getItem('pwa_installed') === 'true') return;
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:var(--card-bg);border-top:1px solid var(--border);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;z-index:999;';
  banner.innerHTML = `
    <span style="font-size:14px;">📱 Установить Health Engine на главный экран</span>
    <div style="display:flex;gap:8px;">
      <button id="pwa-install-btn" class="btn" style="width:auto;margin:0;padding:6px 12px;font-size:12px;">Установить</button>
      <button id="pwa-close-btn" style="background:transparent;border:none;color:#8e8e93;font-size:18px;cursor:pointer;padding:0 4px;">×</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('pwa-install-btn')!.onclick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') localStorage.setItem('pwa_installed', 'true');
    hideInstallBanner();
    deferredPrompt = null;
  };

  document.getElementById('pwa-close-btn')!.onclick = hideInstallBanner;
}

function hideInstallBanner() {
  const b = document.getElementById('pwa-banner');
  if (b) b.remove();
}