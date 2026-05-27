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
  // 1. Инициализация окружения
  if (typeof window !== 'undefined') {
    // Telegram WebApp SDK
    if ((window as any).Telegram?.WebApp) {
      try {
        (window as any).Telegram.WebApp.ready?.();
        (window as any).Telegram.WebApp.expand?.();
        console.log('📱 Telegram SDK initialized');
      } catch (e) { console.warn('⚠️ Telegram SDK init failed:', e); }
    }
    // PWA (только вне Telegram)
    if (!(window as any).Telegram?.WebApp) {
      initPWA();
      console.log('📱 PWA Manager initialized');
    }
  }

  const app = document.getElementById('app');
  if (!app) {
    console.error('❌ App container #app not found');
    document.body.innerHTML = '<div style="padding:20px;color:#ff453a;">⚠️ Ошибка: контейнер приложения не найден. Проверь index.html</div>';
    return;
  }

  // 2. Инициализация БД и Шифрования
  try {
    await db.init();
    console.log('✅ IndexedDB initialized');

    const savedKey = localStorage.getItem('he_crypto_key') || btoa('health-engine-secure-key-v3.1');
    localStorage.setItem('he_crypto_key', savedKey);
    await initEncryption(atob(savedKey));
    console.log('🔐 AES-GCM Encryption initialized');
  } catch (e) {
    console.warn('⚠️ Crypto/DB init failed:', e);
  }

  // 3. Обработчик ошибок
  initErrorHandler('app');
  console.log('🛡️ Error Handler mounted');

  // 4. Оптимизация памяти/БД
  optimizeDBSpace(db, 50);
  console.log('🧹 DB Space optimized');

  // 5. Облако и Realtime
  initCloudSync();
  processQueue();

  const onLogin = (profile: any) => {
    console.log('👤 User logged in:', profile.role);
    initRealtime(profile.id || 'user_default');
    renderDashboard(profile);
  };

  // 6. Рендер
  renderAuthModule(app, onLogin);
  console.log('🚀 App Bootstrap complete');
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// Graceful shutdown / Last active tracking
window.addEventListener('beforeunload', () => {
  try { localStorage.setItem('he_last_active', new Date().toISOString()); } catch {}
});

// Обработка видимости вкладки (экономия ресурсов)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    console.log('👁️ Tab visible, resuming sync...');
    processQueue();
  }
});