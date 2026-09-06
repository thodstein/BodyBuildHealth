/**
 * native-bridge.ts — единый фасад нативных возможностей.
 *
 * Контракт: каждый метод безопасен на ЛЮБОЙ платформе.
 * - native (APK): Capacitor-плагины (ленивый dynamic import → не раздувают web-бандл);
 * - telegram: Telegram HapticFeedback / WebApp API как fallback;
 * - web: Web API (navigator.share / Notification / вибрация) или graceful no-op.
 *
 * Никаких throw наружу: отсутствие возможности = false/null, а не краш.
 * Telegram Mini App ведёт себя ровно как раньше — мост только добавляет
 * fallback-ветки, ничего не перехватывая.
 */

import { isCapacitorNative } from './app-platform';
import { hapticImpact as tgHaptic } from './telegram';

export type HapticKind = 'light' | 'medium' | 'heavy';

export interface DeviceInfo {
  platform: string;
  model: string;
  osVersion: string;
  appVersion: string;
}

/* ------------------------------------------------------------------ */
/* Haptics                                                             */
/* ------------------------------------------------------------------ */

/** Тактильный отклик: Capacitor Haptics → Telegram → navigator.vibrate. */
export async function haptics(kind: HapticKind = 'light'): Promise<void> {
  if (isCapacitorNative()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({
        style:
          kind === 'heavy'
            ? ImpactStyle.Heavy
            : kind === 'medium'
              ? ImpactStyle.Medium
              : ImpactStyle.Light,
      });
      return;
    } catch {
      /* fallback ниже */
    }
  }
  try {
    tgHaptic(kind);
  } catch {
    /* ignore */
  }
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator)
      navigator.vibrate(kind === 'heavy' ? 40 : kind === 'medium' ? 20 : 10);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Notifications (local + push)                                        */
/* ------------------------------------------------------------------ */

/** Локальное уведомление: Capacitor LocalNotifications → ServiceWorker → no-op. */
export async function notifyLocal(title: string, body: string): Promise<boolean> {
  if (isCapacitorNative()) {
    try {
      const { LocalNotifications } = await import(
        '@capacitor/local-notifications'
      );
      try {
        await LocalNotifications.requestPermissions();
      } catch {
        /* ignore */
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Date.now() % 2147483647),
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }
  try {
    const { triggerLocalPush } = await import('./push-manager');
    await triggerLocalPush(title, body);
    return true;
  } catch {
    return false;
  }
}

export interface WeeklyReminder {
  /** Стабильный id (для отмены/перезаписи). */
  id: number;
  /** День недели в формате Capacitor: 1 = воскресенье … 7 = суббота. */
  weekday: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

/** JS-день (0 = Пн … 6 = Вс, как в дневниках/курсе) → день Capacitor (1 = Вс … 7 = Сб). */
export function jsDayToCapacitorWeekday(jsDayMon0: number): number {
  const jsSun0 = (jsDayMon0 + 1) % 7;
  return jsSun0 + 1;
}

/**
 * Еженедельные повторы (напоминания о днях инъекций и т.п.).
 * Возвращает число поставленных. Вне native — 0. Ошибки плагина — тихий 0.
 */
export async function scheduleWeeklyReminders(items: WeeklyReminder[]): Promise<number> {
  if (!isCapacitorNative() || items.length === 0) return 0;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    try {
      await LocalNotifications.requestPermissions();
    } catch {
      /* ignore */
    }
    await LocalNotifications.schedule({
      notifications: items.map((r) => ({
        id: r.id,
        title: r.title,
        body: r.body,
        schedule: { on: { weekday: r.weekday, hour: r.hour, minute: r.minute } },
      })),
    });
    return items.length;
  } catch {
    return 0;
  }
}

/** Снять запланированные напоминания по id. Вне native — no-op. */
export async function cancelScheduledReminders(ids: number[]): Promise<void> {
  if (!isCapacitorNative() || ids.length === 0) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
  } catch {
    /* ignore */
  }
}

/**
 * Инициализация нативных push (APK). В Telegram/web — no-op (там свои механики).
 * onToken — сохранить токен на бэкенде для адресных рассылок (FCM).
 */
export async function initNativePush(
  onToken?: (token: string) => void,
): Promise<boolean> {
  if (!isCapacitorNative()) return false;
  try {
    const { PushNotifications } = await import(
      '@capacitor/push-notifications'
    );
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return false;
    await PushNotifications.register();
    if (onToken) {
      await PushNotifications.addListener('registration', (t) => {
        try {
          onToken(t.value);
        } catch {
          /* ignore */
        }
      });
    }
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Share / files                                                       */
/* ------------------------------------------------------------------ */

export interface SharePayload {
  title?: string;
  text?: string;
  url?: string;
}

/** Поделиться: Capacitor Share → navigator.share → clipboard. */
export async function shareText(payload: SharePayload): Promise<boolean> {
  if (isCapacitorNative()) {
    try {
      const { Share } = await import('@capacitor/share');
      await Share.share({
        title: payload.title ?? '',
        text: payload.text ?? '',
        url: payload.url,
      });
      return true;
    } catch {
      /* пользователь закрыл диалог или плагин недоступен — пробуем web-путь */
    }
  }
  try {
    const nav = navigator as Navigator & {
      share?: (d: SharePayload) => Promise<void>;
    };
    if (typeof nav.share === 'function') {
      await nav.share(payload);
      return true;
    }
  } catch {
    return false;
  }
  try {
    const text = [payload.title, payload.text, payload.url]
      .filter(Boolean)
      .join('\n');
    if (text && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Сохранить текстовый файл: native — Filesystem (Documents) + Share-диалог,
 * web/telegram — классическое скачивание через <a download>.
 */
export async function saveTextFile(
  filename: string,
  text: string,
): Promise<boolean> {
  if (isCapacitorNative()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const res = await Filesystem.writeFile({
        path: filename,
        data: text,
        directory: Directory.Documents,
      });
      try {
        const { Share } = await import('@capacitor/share');
        await Share.share({ title: filename, url: res.uri });
      } catch {
        /* файл уже сохранён — диалог шаринга опционален */
      }
      return true;
    } catch {
      return false;
    }
  }
  try {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
    }, 500);
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Camera / gallery                                                    */
/* ------------------------------------------------------------------ */

export interface PickedPhoto {
  /** dataUrl (web) или file:// URI (native). */
  uri: string;
  format: string;
}

/**
 * Фото: native — системный диалог (камера/галерея),
 * остальные — <input type=file accept=image>.
 */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  if (isCapacitorNative()) {
    try {
      const { Camera, CameraSource, CameraResultType } = await import(
        '@capacitor/camera'
      );
      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
        quality: 85,
      });
      if (photo.dataUrl)
        return { uri: photo.dataUrl, format: photo.format ?? 'jpeg' };
      if (photo.webPath)
        return { uri: photo.webPath, format: photo.format ?? 'jpeg' };
      return null;
    } catch {
      return null;
    }
  }
  try {
    return await new Promise<PickedPhoto | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = () =>
          resolve({
            uri: String(reader.result ?? ''),
            format: file.type.split('/')[1] ?? 'jpeg',
          });
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Device / network                                                    */
/* ------------------------------------------------------------------ */

/** Информация об устройстве: Capacitor Device → userAgent fallback. */
export async function getDeviceInfo(): Promise<DeviceInfo> {
  const fallback: DeviceInfo = {
    platform: 'web',
    model: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
    osVersion: '',
    appVersion: '',
  };
  if (!isCapacitorNative()) return fallback;
  try {
    const { Device } = await import('@capacitor/device');
    const [id, info] = await Promise.all([Device.getId(), Device.getInfo()]);
    let appVersion = '';
    try {
      const { App } = await import('@capacitor/app');
      appVersion = (await App.getInfo()).version ?? '';
    } catch {
      /* версия приложения опциональна */
    }
    return {
      platform: info.platform ?? id.identifier ?? 'android',
      model: info.model ?? fallback.model,
      osVersion: info.osVersion ?? '',
      appVersion,
    };
  } catch {
    return fallback;
  }
}

export function isOnline(): boolean {
  try {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  } catch {
    return true;
  }
}

export function watchOnline(cb: (online: boolean) => void): () => void {
  const on = () => cb(true);
  const off = () => cb(false);
  try {
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
  } catch {
    return () => {};
  }
  return () => {
    try {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    } catch {
      /* ignore */
    }
  };
}

/* ------------------------------------------------------------------ */
/* Native chrome: status bar, splash, back button                       */
/* ------------------------------------------------------------------ */

/** Статус-бар + сплэш для APK. Вне native — no-op. */
export async function initNativeChrome(
  bgColor = '#050b16',
  style: 'dark' | 'light' = 'dark',
): Promise<void> {
  if (!isCapacitorNative()) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    try {
      await StatusBar.setBackgroundColor({ color: bgColor });
    } catch {
      /* ignore */
    }
    try {
      await StatusBar.setStyle({
        style: style === 'dark' ? Style.Dark : Style.Light,
      });
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
}

/**
 * Системная кнопка «назад» Android. Возвращает unsubscribe.
 * В Telegram/web — no-op (там свои BackButton/история).
 */
export async function setupNativeBackButton(
  onBack: () => boolean | void,
): Promise<() => void> {
  if (!isCapacitorNative()) return () => {};
  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('backButton', () => {
      try {
        const handled = onBack();
        if (handled === false) {
          // Явно не перехвачено — сворачиваем приложение штатно.
          void App.minimizeApp().catch(() => App.exitApp().catch(() => {}));
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      try {
        void sub.remove();
      } catch {
        /* ignore */
      }
    };
  } catch {
    return () => {};
  }
}

/* ------------------------------------------------------------------ */
/* Biometry (WebAuthn platform authenticator, без лишних native-зависимостей) */
/* ------------------------------------------------------------------ */

function bufToB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBuf(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomChallenge(): Uint8Array {
  const c = new Uint8Array(32);
  crypto.getRandomValues(c);
  return c;
}

const CRED_KEY = 'he_webauthn_cred_v1';

/** Удалить зарегистрированный биометрический ключ (выключение биометрии). */
export function disableBiometrics(): void {
  try {
    localStorage.removeItem(CRED_KEY);
  } catch {
    /* ignore */
  }
}

/** Доступна ли платформенная биометрия (отпечаток/Face) в этом WebView. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const PKC = window.PublicKeyCredential;
    if (!PKC || typeof PKC.isUserVerifyingPlatformAuthenticatorAvailable !== 'function')
      return false;
    return await PKC.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * Разблокировка биометрией. Первая успешная регистрация сохраняет credentialId
 * локально; дальше — проверка им. Возвращает true только при реальном
 * подтверждении пользователем. Любая ошибка/отмена = false.
 */
export async function authenticateWithBiometrics(
  reason = 'Разблокировка Health Engine',
): Promise<boolean> {
  try {
    if (!(await isBiometricAvailable())) return false;
    const stored = (() => {
      try {
        return localStorage.getItem(CRED_KEY);
      } catch {
        return null;
      }
    })();
    if (!stored) {
      const cred = (await navigator.credentials.create({
        publicKey: {
          challenge: randomChallenge() as BufferSource,
          rp: { name: 'Health Engine' },
          user: {
            id: randomChallenge() as BufferSource,
            name: 'he-user',
            displayName: 'Health Engine',
          },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'required',
          },
          timeout: 60000,
          attestation: 'none',
        },
      })) as PublicKeyCredential | null;
      if (!cred) return false;
      try {
        localStorage.setItem(CRED_KEY, bufToB64url(cred.rawId));
      } catch {
        /* ignore */
      }
      return true;
    }
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge() as BufferSource,
        allowCredentials: [
          { type: 'public-key', id: b64urlToBuf(stored) as BufferSource },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    })) as PublicKeyCredential | null;
    void reason;
    return !!assertion;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Self-update без сторов (APK → APK). Java: AppUpdaterPlugin          */
/* ------------------------------------------------------------------ */

export type ApkDownloadState = 'pending' | 'downloading' | 'done' | 'failed';

export interface ApkDownloadStatus {
  status: ApkDownloadState;
  /** 0..1 (total может быть неизвестен — тогда 0 до done). */
  progress: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function appUpdaterPlugin(): Promise<any | null> {
  if (!isCapacitorNative()) return null;
  try {
    const { registerPlugin } = await import('@capacitor/core');
    return registerPlugin('AppUpdater');
  } catch {
    return null;
  }
}

/** Поставить APK в очередь DownloadManager. Возвращает downloadId или null. */
export async function startApkDownload(url: string): Promise<number | null> {
  try {
    const plugin = await appUpdaterPlugin();
    if (!plugin) return null;
    const ret = await plugin.downloadApk({ url });
    const id = Number(ret?.downloadId);
    return Number.isFinite(id) && id >= 0 ? id : null;
  } catch {
    return null;
  }
}

/** Статус закачки. Вне native — всегда failed (баннер тихо прячется). */
export async function pollApkDownload(downloadId: number): Promise<ApkDownloadStatus> {
  const fallback: ApkDownloadStatus = { status: 'failed', progress: 0 };
  try {
    const plugin = await appUpdaterPlugin();
    if (!plugin) return fallback;
    const ret = await plugin.downloadStatus({ downloadId: String(downloadId) });
    const status = String(ret?.status ?? 'failed');
    const progress = Number(ret?.progress ?? 0);
    return {
      status:
        status === 'done' || status === 'downloading' || status === 'pending'
          ? status
          : 'failed',
      progress: Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0,
    };
  } catch {
    return fallback;
  }
}

/**
 * Открыть скачанный APK системным установщиком.
 * @returns true — установщик открыт; 'blocked' — запрещены неизвестные
 * источники (вести в настройки); false — иная ошибка.
 */
export async function installDownloadedApk(): Promise<true | 'blocked' | false> {
  try {
    const plugin = await appUpdaterPlugin();
    if (!plugin) return false;
    await plugin.installApk();
    return true;
  } catch (e) {
    try {
      const msg = String((e as { message?: unknown })?.message ?? e);
      if (msg.includes('UNKNOWN_SOURCES_BLOCKED')) return 'blocked';
    } catch {
      /* ignore */
    }
    return false;
  }
}

/** Экран «Установка неизвестных приложений» для нашего пакета. */
export async function openUnknownSourcesSettings(): Promise<boolean> {
  try {
    const plugin = await appUpdaterPlugin();
    if (!plugin) return false;
    await plugin.openUnknownSourcesSettings();
    return true;
  } catch {
    return false;
  }
}
