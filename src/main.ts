// src/main.ts — безопасная точка входа
import { renderDashboard } from './ui/dashboard';

function safeRender() {
  try {
    // Инициализация Telegram (безопасно, с проверкой)
    if (typeof window !== 'undefined' && (window as any).Telegram?.WebApp) {
      try {
        (window as any).Telegram.WebApp.ready?.();
        (window as any).Telegram.WebApp.expand?.();
      } catch (e) {
        console.warn('⚠️ Telegram SDK init failed:', e);
      }
    }

    // Проверка контейнера
    const app = document.getElementById('app');
    if (!app) {
      throw new Error('❌ Элемент #app не найден в HTML. Проверь index.html');
    }

    // Рендер БЕЗ аргументов — демо-данные внутри функции
    renderDashboard();
    console.log('✅ Health Engine loaded successfully');
  } catch (err: any) {
    // Показываем ошибку пользователю, если рендер упал
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="padding:20px;color:#ff453a;font-family:sans-serif;">
          <h2>⚠️ Ошибка загрузки</h2>
          <pre style="background:#222;padding:10px;border-radius:8px;overflow:auto;color:#fff;">${err.message || String(err)}</pre>
          <p style="font-size:13px;color:#888;margin-top:10px;">
            Открой консоль (F12) для деталей.
          </p>
        </div>
      `;
    }
    console.error('🔴 Render failed:', err);
  }
}

// Запуск после загрузки DOM
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', safeRender);
} else {
  safeRender();
}
