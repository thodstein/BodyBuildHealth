import { renderAuthModule } from './ui/auth-module';
import { renderDashboard } from './ui/dashboard';
import { db } from './core/db';
import { initPWA } from './core/pwa-manager';
import { initCloudSync, processQueue } from './core/cloud-sync';
import { initEncryption } from './core/db-encryption';
import { initRealtime } from './core/realtime-sync';
import { initErrorHandler } from './core/error-handler';
import { optimizeDBSpace } from './core/performance-optimizer';

async function bootstrap() {
  if (typeof window !== 'undefined') {
    if ((window as any).Telegram?.WebApp) {
      try { (window as any).Telegram.WebApp.ready?.(); (window as any).Telegram.WebApp.expand?.(); } catch(e) {}
    }
    if (!(window as any).Telegram?.WebApp) initPWA();
  }

  const app = document.getElementById('app');
  if (!app) {
    document.body.innerHTML = '<div style="padding:20px;color:#ff453a;font-family:sans-serif;">⚠️ Ошибка: контейнер #app не найден</div>';
    return;
  }

  try {
    await db.init();
    console.log('✅ IndexedDB initialized');

    const savedKey = localStorage.getItem('he_crypto_key') || btoa('health-engine-secure-key-v3.1');
    localStorage.setItem('he_crypto_key', savedKey);
    await initEncryption(atob(savedKey));
    console.log('🔐 AES-GCM Encryption initialized');
  } catch (e) { console.warn('⚠️ Crypto/DB init failed:', e); }

  initErrorHandler('app');
  optimizeDBSpace(db, 50);
  initCloudSync(); processQueue();

  const onLogin = (profile: any) => {
    console.log('👤 User logged in:', profile.role);
    initRealtime(profile.id || 'user_default');
    renderDashboard(profile);
  };

  renderAuthModule(app, onLogin);
  console.log('🚀 App Bootstrap complete | v3.1.0');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();

window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('he_last_active', new Date().toISOString()); } catch {}
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('👁️ Tab visible, resuming sync...');
    processQueue();
  }
});
