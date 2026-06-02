import { renderAuthModule } from './ui/auth-module';
import { db } from './core/db';
import { registry } from './core/data/registry';
import { initPWA } from './core/pwa-manager';
import { initCloudSync } from './core/cloud-sync';
import { processQueue } from './core/sync-queue';
import { initEncryption } from './core/db-encryption';
import { registerSW } from './core/service-worker';
import { initRealtime } from './core/realtime-sync';
import { initErrorHandler } from './core/error-handler';
import { optimizeDBSpace } from './core/performance-optimizer';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) {
    document.body.innerHTML = '<div style="padding:20px;color:#ff453a;">Error: app container not found</div>';
    return;
  }

  if (typeof window !== 'undefined') {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready?.();
        tg.expand?.();
        (window as any).__TELEGRAM_THEME__ = tg.themeParams || {};
      } catch (e) { console.warn('Telegram SDK init failed:', e); }
    } else {
      initPWA();
    }
  }

  try {
    await db.init();
  } catch (e) {
    app.innerHTML = '<div style="padding:20px;color:#ff453a;">Error initializing database. Please reload.</div>';
    return;
  }

  try {
    await registry.init();
    const savedKey = localStorage.getItem('he_crypto_key') || btoa('health-engine-secure-key-v3.1');
    localStorage.setItem('he_crypto_key', savedKey);
    await initEncryption(atob(savedKey));
  } catch (e) {
    console.warn('Crypto/Registry init failed:', e);
  }

  initErrorHandler('app');
  optimizeDBSpace(db, 50);

  if (!(window as any).Telegram?.WebApp) {
    registerSW();
  }

  initCloudSync();
  processQueue();

  const onLogin = (profile: any) => {
    initRealtime(profile.id || 'user_default');
    const root = createRoot(app);
    root.render(<App />);
  };

  renderAuthModule(app, onLogin);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('he_last_active', new Date().toISOString()); } catch {}
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    processQueue();
  }
});