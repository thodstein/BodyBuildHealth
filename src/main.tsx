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
import { ensureAdmin } from './core/auth-manager';
import './styles.css';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

function initTelegramWebApp() {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg) return false;

  try {
    tg.ready();
    tg.expand();

    // Apply Telegram theme colors as CSS variables
    const root = document.documentElement;
    const params = tg.themeParams || {};
    
    if (params.bg_color) root.style.setProperty('--tg-bg', params.bg_color);
    if (params.secondary_bg_color) root.style.setProperty('--tg-secondary-bg', params.secondary_bg_color);
    if (params.text_color) root.style.setProperty('--tg-text', params.text_color);
    if (params.hint_color) root.style.setProperty('--tg-hint', params.hint_color);
    if (params.button_color) root.style.setProperty('--tg-button', params.button_color);
    if (params.button_text_color) root.style.setProperty('--tg-button-text', params.button_text_color);
    if (params.destructive_text_color) root.style.setProperty('--tg-destructive', params.destructive_text_color);
    if (params.outline_color) root.style.setProperty('--tg-outline', params.outline_color);

    // Add tg-theme class for CSS variable mapping
    root.classList.add('tg-theme');

    // Set safe area insets from Telegram
    const safeTop = tg.safeAreaInsetTop || 0;
    const safeBottom = tg.safeAreaInsetBottom || 0;
    root.style.setProperty('--tg-safe-top', `${safeTop}px`);
    root.style.setProperty('--tg-safe-bottom', `${safeBottom}px`);

    // Handle Telegram back button
    tg.BackButton.onClick(() => {
      // Can be used for navigation back
    });

    console.log('Telegram WebApp initialized successfully');
    return true;
  } catch (e) {
    console.warn('Telegram WebApp init failed:', e);
    return false;
  }
}

function fixMobileViewport() {
  const setVH = () => {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };
  setVH();
  window.addEventListener('resize', setVH);
  window.addEventListener('orientationchange', () => setTimeout(setVH, 100));
}

function showBootstrapError(msg: string) {
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `<div style="padding:24px;color:#ff453a;font-family:system-ui,sans-serif;">
      <h2 style="margin:0 0 8px;font-size:18px;">Ошибка загрузки</h2>
      <p style="margin:0 0 16px;color:#aaa;font-size:14px;">${msg}</p>
      <button onclick="location.reload()" style="padding:10px 20px;background:#007aff;color:#fff;border:none;border-radius:8px;cursor:pointer;">⟳ Перезагрузить</button>
    </div>`;
  }
}

async function bootstrap() {
  const app = document.getElementById('app');
  if (!app) {
    document.body.innerHTML = '<div style="padding:20px;color:#ff453a;">Error: app container not found</div>';
    return;
  }

  console.log('[bootstrap] step 1: fixMobileViewport');
  try { fixMobileViewport(); } catch (e) { console.warn('fixMobileViewport failed:', e); }

  console.log('[bootstrap] step 2: initTelegramWebApp');
  let isTg = false;
  try { isTg = initTelegramWebApp(); } catch (e) { console.warn('initTelegramWebApp failed:', e); }

  if (!isTg) {
    console.log('[bootstrap] not TG, initPWA');
    try { initPWA(); } catch (e) { console.warn('initPWA failed:', e); }
  } else {
    console.log('[bootstrap] is TG mode');
  }

  console.log('[bootstrap] step 3: db.init');
  try {
    await db.init();
  } catch (e) {
    showBootstrapError('Ошибка инициализации базы данных. Перезагрузите.');
    return;
  }

  console.log('[bootstrap] step 4: ensureAdmin');
  try {
    const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || '';
    const adminPass = import.meta.env.VITE_ADMIN_PASSWORD || '';
    if (adminEmail && adminPass) {
      await ensureAdmin(adminEmail, adminPass, 'Admin', 'admin');
    }
  } catch (e) {
    console.warn('Admin seed failed:', e);
  }

  console.log('[bootstrap] step 5: registry.init + crypto');
  try {
    await registry.init();
    const cryptoKey = import.meta.env.VITE_CRYPTO_KEY || '';
    const savedKey = cryptoKey ? btoa(cryptoKey) : localStorage.getItem('he_crypto_key') || '';
    if (savedKey) {
      localStorage.setItem('he_crypto_key', savedKey);
      await initEncryption(atob(savedKey));
    }
  } catch (e) {
    console.warn('Crypto/Registry init failed:', e);
  }

  console.log('[bootstrap] step 6: error handler + optimize');
  try { initErrorHandler('app'); } catch (e) { console.warn('initErrorHandler failed:', e); }
  try { optimizeDBSpace(db, 50); } catch (e) { console.warn('optimizeDBSpace failed:', e); }

  if (!isTg) {
    console.log('[bootstrap] step 7: registerSW');
    try { registerSW(); } catch (e) { console.warn('registerSW failed:', e); }
  }

  console.log('[bootstrap] step 8: initCloudSync + processQueue');
  try { initCloudSync(); } catch (e) { console.warn('initCloudSync failed:', e); }
  try { processQueue(); } catch (e) { console.warn('processQueue failed:', e); }

  console.log('[bootstrap] step 9: renderAuthModule');
  const onLogin = (profile: any) => {
    console.log('[bootstrap] onLogin called, profile.id:', profile?.id);
    try {
      try { initRealtime(profile.id || 'user_default'); } catch (e) { console.warn('initRealtime failed:', e); }
      const root = createRoot(app);
      console.log('[bootstrap] createRoot done, rendering <App />');
      root.render(<App />);
    } catch (e) {
      console.error('[bootstrap] React render failed:', e);
      showBootstrapError('Ошибка рендеринга приложения: ' + ((e as Error)?.message || e));
    }
  };

  try {
    await renderAuthModule(app, onLogin);
  } catch (e) {
    console.error('[bootstrap] renderAuthModule failed:', e);
    showBootstrapError('Ошибка авторизации: ' + ((e as Error)?.message || e));
  }
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
