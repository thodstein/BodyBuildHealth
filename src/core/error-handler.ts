interface CrashReport {
  timestamp: string;
  url: string;
  error: string;
  stack: string;
  userAgent: string;
  lastAction: string;
}

let lastAction = 'App Bootstrap';
const MAX_REPORTS = 5;
// После готовности приложения фоновый шум (синк, сеть, ресурсы) НЕ должен
// ронять весь экран: иначе пользователь получает вечный цикл
// «ошибка → перезагрузка → ошибка». Фатален только краш ДО готовности.
let booted = false;

/** Вызывать один раз после успешного первого рендера (main.tsx). */
export function markBooted(): void {
  booted = true;
}

export function initErrorHandler(appId: string = 'app') {
  window.addEventListener('error', (e) => {
    // Ошибка ресурса (картинка/шрифт/скрипт): e.error пуст, target — элемент.
    // Это не краш приложения — только в лог, без оверлея.
    try {
      const t = e.target as unknown;
      if (t && t !== window && typeof (t as HTMLElement).tagName === 'string') return;
    } catch {
      /* ниже — общий путь */
    }
    handleCrash(e.error?.message || 'Unknown Error', e.error?.stack || '');
  });
  window.addEventListener('unhandledrejection', (e) => {
    try {
      if (e && typeof (e as PromiseRejectionEvent).preventDefault === 'function') {
        (e as PromiseRejectionEvent).preventDefault();
      }
    } catch {
      /* ignore */
    }
    handleCrash(e.reason?.message || 'Unhandled Promise', e.reason?.stack || '');
  });
  
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    lastAction = `Click: ${target.tagName}[${target.className || target.id || 'unknown'}]`;
  });

  const container = document.getElementById(appId);
  if (!container) return;

  const fallback = document.createElement('div');
  fallback.id = 'error-fallback';
  fallback.style.cssText = 'position:fixed;inset:0;background:#1c1c1e;color:#fff;display:none;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;z-index:9999;font-family:system-ui,sans-serif;';
  fallback.innerHTML = `
    <h2 style="color:#ff453a;margin-bottom:12px;">⚠️ Приложение восстановлено</h2>
    <p style="color:#8e8e93;margin-bottom:20px;max-width:400px;">Произошла непредвиденная ошибка. Данные сохранены локально. Перезагрузите страницу или очистите кэш.</p>
    <div style="display:flex;gap:12px;">
      <button id="reload-btn" style="padding:10px 20px;background:#007aff;color:#fff;border:none;border-radius:8px;cursor:pointer;">🔄 Перезагрузить</button>
      <button id="clear-btn" style="padding:10px 20px;background:#3a3a3c;color:#fff;border:none;border-radius:8px;cursor:pointer;">🗑️ Очистить кэш</button>
    </div>
  `;
  document.body.appendChild(fallback);

  document.getElementById('reload-btn')!.onclick = () => location.reload();
  document.getElementById('clear-btn')!.onclick = () => {
    localStorage.clear();
    indexedDB.deleteDatabase('HealthEngineDB_v3');
    location.reload();
  };
}

function handleCrash(message: string, stack: string) {
  const report: CrashReport = {
    timestamp: new Date().toISOString(),
    url: location.href,
    error: message,
    stack,
    userAgent: navigator.userAgent,
    lastAction
  };

  try {
    const existing = JSON.parse(localStorage.getItem('he_crash_reports') || '[]');
    existing.push(report);
    if (existing.length > MAX_REPORTS) existing.shift();
    localStorage.setItem('he_crash_reports', JSON.stringify(existing));
  } catch {}

  // Оверлей — только для фатального краша до готовности. После — тихо в лог:
  // иначе любой фоновый чих даёт вечный цикл «ошибка → перезагрузка».
  if (!booted) {
    const fallback = document.getElementById('error-fallback');
    if (fallback) fallback.style.display = 'flex';
  }

  console.error('🔴 CRASH REPORT:', report);
}