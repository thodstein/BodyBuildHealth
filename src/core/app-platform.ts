/**
 * app-platform.ts — единая точка определения платформы запуска.
 *
 * Один код, два артефакта:
 * - Telegram Mini App = текущий web-билд (dist/), открытый внутри Telegram WebView;
 * - APK = тот же dist/, обёрнутый Capacitor в нативный Android WebView.
 *
 * Порядок детекции (важен):
 * 1. native  — Capacitor WebView (window.Capacitor.isNativePlatform() === true).
 *    Проверяется ПЕРВЫМ: в APK может быть доступен и Telegram-скрипт, но
 *    нативом управляет Capacitor.
 * 2. telegram — строгий контекст Telegram: непустой initData ИЛИ initDataUnsafe.user
 *    ИЛИ tgWebAppData в хэше. Намеренно НЕ считаем telegram'ом простое наличие
 *    window.Telegram (скрипт telegram-web-app.js подключён в index.html всегда и
 *    объект существует и в обычном браузере с пустым initData).
 * 3. web — всё остальное (браузер/PWA).
 *
 * Сброс кэша resetAppPlatformCache() — только для тестов.
 */

/** Платформа запуска приложения. */
export type AppPlatform = 'telegram' | 'native' | 'web';

/** Идентичность для облачного синка: Telegram-аккаунт или стабильный id устройства (APK). */
export interface SyncIdentity {
  kind: 'telegram' | 'device';
  id: string;
}

let cached: AppPlatform | null = null;

/** True внутри нативного Capacitor WebView (APK). Безопасен вне браузера. */
export function isCapacitorNative(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const cap = (window as unknown as { Capacitor?: unknown }).Capacitor as
      | { isNativePlatform?: () => boolean; getPlatform?: () => string; platform?: string }
      | undefined;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === 'function') {
      try {
        return cap.isNativePlatform() === true;
      } catch {
        /* fallthrough к platform-строке */
      }
    }
    const plat =
      typeof cap.getPlatform === 'function' ? cap.getPlatform() : cap.platform;
    return plat === 'android' || plat === 'ios';
  } catch {
    return false;
  }
}

/**
 * Строгий контекст Telegram Mini App.
 * Ложное срабатывание исключено: пустой WebApp-объект в обычном браузере — не Telegram.
 */
export function isTelegramContext(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const tg = (window as unknown as { Telegram?: { WebApp?: unknown } }).Telegram
      ?.WebApp as
      | { initData?: unknown; initDataUnsafe?: { user?: unknown } }
      | undefined;
    if (!tg) return false;
    if (typeof tg.initData === 'string' && tg.initData.length > 0) return true;
    if (tg.initDataUnsafe?.user) return true;
    try {
      const h = window.location.hash || '';
      if (h.includes('tgWebAppData')) return true;
    } catch {
      /* ignore */
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Детекция без кэша. Сначала проверяется build-time override VITE_APP_PLATFORM
 * (удобно для CI-матрицы: собрать dist строго под платформу), затем runtime.
 */
export function detectAppPlatform(): AppPlatform {
  // ВАЖНО: только буквальный import.meta.env.VITE_APP_PLATFORM подхватывается
  // подстановкой Vite в проде. Через каст с ?. (как было) замена не срабатывает
  // и оверрайд молча не работает — проверено прод-сборкой.
  try {
    const forced: string | undefined = import.meta.env.VITE_APP_PLATFORM;
    if (forced === 'native' || forced === 'telegram' || forced === 'web')
      return forced;
  } catch {
    /* ignore */
  }
  if (isCapacitorNative()) return 'native';
  if (isTelegramContext()) return 'telegram';
  return 'web';
}

/** Мемоизированная платформа текущего запуска. */
export function getAppPlatform(): AppPlatform {
  if (!cached) cached = detectAppPlatform();
  return cached;
}

/** Только для тестов: сбросить мемоизацию. */
export function resetAppPlatformCache(): void {
  cached = null;
}

export function isNativeApp(): boolean {
  return getAppPlatform() === 'native';
}

export function isTelegramApp(): boolean {
  return getAppPlatform() === 'telegram';
}

export function isWebApp(): boolean {
  return getAppPlatform() === 'web';
}

/**
 * Выставляет data-platform + класс app-<platform> на <html>.
 * Вызывать один раз на старте (main.tsx) до первого рендера.
 */
export function applyPlatformAttributes(): AppPlatform {
  const p = getAppPlatform();
  try {
    const root = document.documentElement;
    root.dataset.platform = p;
    root.classList.remove('app-telegram', 'app-native', 'app-web');
    root.classList.add(`app-${p}`);
  } catch {
    /* non-DOM окружение (тесты) */
  }
  return p;
}

const DEVICE_ID_KEY = 'he_device_id_v1';

/**
 * Стабильный id устройства для APK (где нет Telegram-аккаунта).
 * Используется как identity для облачного синка и push-токенов.
 */
export function getOrCreateDeviceId(): string {
  try {
    let id: string | null = null;
    try {
      id = localStorage.getItem(DEVICE_ID_KEY);
    } catch {
      id = null;
    }
    if (id && id.length > 0) return id;
    const fresh =
      'dev_' +
      (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`);
    try {
      localStorage.setItem(DEVICE_ID_KEY, fresh);
    } catch {
      /* quota/SSR — отдаём без персиста */
    }
    return fresh;
  } catch {
    return 'dev_fallback';
  }
}

/**
 * Кто мы для облака: Telegram-аккаунт (Mini App) или устройство (APK/web).
 * cloud-kv продолжает работать как раньше: для tg_* — текущий транспорт,
 * для device_* синк включится после серверной поддержки device-токенов
 * (см. docs/NATIVE-APP.md), до этого — локальный режим без ошибок.
 */
export function getSyncIdentity(): SyncIdentity {
  try {
    const tgUser = (
      window as unknown as {
        Telegram?: { WebApp?: { initDataUnsafe?: { user?: { id?: unknown } } } };
      }
    ).Telegram?.WebApp?.initDataUnsafe?.user;
    if (tgUser && typeof tgUser.id !== 'undefined' && tgUser.id !== null)
      return { kind: 'telegram', id: `tg_${String(tgUser.id)}` };
  } catch {
    /* ignore */
  }
  return { kind: 'device', id: getOrCreateDeviceId() };
}
