/**
 * app-config.ts — per-platform параметры приложения.
 *
 * Задача: менять поведение/дизайн ОТДЕЛЬНО для Telegram Mini App и APK,
 * не форкая код. Правило одно:
 *
 *   1. общий дефолт живёт в BASE_CONFIG;
 *   2. отличия версии — только в PLATFORM_OVERRIDES[platform];
 *   3. код читает итог через getAppConfig(), а не разбросанные if'ы.
 *
 * Файлы под конкретную версию (второй механизм, рядом с этим):
 *   Foo.telegram.tsx / Foo.native.tsx / Foo.web.tsx + Foo.tsx выбирает через
 *   resolvePlatformModule({ telegram, native, web, default }).
 * Пример:
 *   import { PushSettings } from './PushSettings';
 *   // PushSettings.tsx:
 *   import { resolvePlatformModule } from '@/core/app-config';
 *   import { PushSettingsTelegram } from './PushSettings.telegram';
 *   import { PushSettingsNative } from './PushSettings.native';
 *   export const PushSettings = resolvePlatformModule({
 *     telegram: PushSettingsTelegram, native: PushSettingsNative, default: PushSettingsTelegram,
 *   });
 */

import { getAppPlatform, type AppPlatform } from './app-platform';

export interface AppFeatureFlags {
  /** Push-уведомления (native: Capacitor Push + Local; telegram/web: ServiceWorker). */
  push: boolean;
  /** Биометрия через WebAuthn (везде, где доступен platform authenticator). */
  biometry: boolean;
  /** Загрузка фото через нативную камеру/галерею (native) или input[type=file]. */
  cameraUpload: boolean;
  /** Нативный шаринг файлов (APK) вместо скачивания через браузер. */
  fileSharing: boolean;
  /** Офлайн-пак: агрессивное кэширование + очередь синка (важно для APK). */
  offlinePack: boolean;
  /** Dev-меню диагностики платформы (только native-сборки для отладки). */
  devMenu: boolean;
}

export interface AppConfig {
  appName: string;
  packageId: string;
  platform: AppPlatform;
  /** Telegram Mini App — вход по аккаунту TG; APK/web — локальный профиль. */
  authMode: 'telegram' | 'local';
  /** telegram-cloud — текущий user_kv синк; device-local — только локально (до server-side device-токенов). */
  syncMode: 'telegram-cloud' | 'device-local';
  /** Пресет темы: Mini App подстраивается под тему TG, APK — собственный PRO-дизайн. */
  themePreset: 'telegram-adaptive' | 'app-pro' | 'web-default';
  features: AppFeatureFlags;
  native: {
    statusBarStyle: 'dark' | 'light';
    statusBarColor: string;
  };
  telegram: {
    /** Уважать кнопки Telegram (BackButton/MainButton) вместо своих. */
    useTelegramChrome: boolean;
  };
}

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const BASE_CONFIG: Omit<AppConfig, 'platform'> = {
  appName: 'Health Engine',
  packageId: 'com.healthengine.app',
  authMode: 'local',
  syncMode: 'device-local',
  themePreset: 'web-default',
  features: {
    push: true,
    biometry: true,
    cameraUpload: true,
    fileSharing: true,
    offlinePack: true,
    devMenu: false,
  },
  native: {
    statusBarStyle: 'dark',
    statusBarColor: '#0a1628',
  },
  telegram: {
    useTelegramChrome: true,
  },
};

/**
 * ТОЛЬКО отличия версий. Общее — в BASE_CONFIG выше.
 * Telegram Mini App сохраняет поведение 1-в-1 как сейчас.
 */
const PLATFORM_OVERRIDES: Record<AppPlatform, DeepPartial<AppConfig>> = {
  telegram: {
    authMode: 'telegram',
    syncMode: 'telegram-cloud',
    themePreset: 'telegram-adaptive',
    features: {
      // В Mini App нет своих push/шаринга поверх Telegram — остаются TG-механики.
      push: false,
      fileSharing: false,
      offlinePack: false,
      devMenu: false,
    },
    telegram: { useTelegramChrome: true },
  },
  native: {
    authMode: 'local',
    syncMode: 'device-local',
    themePreset: 'app-pro',
    features: {
      push: true,
      biometry: true,
      cameraUpload: true,
      fileSharing: true,
      offlinePack: true,
      // Включается переменной VITE_APP_DEV_MENU=1 для отладочных сборок.
      devMenu: false,
    },
    native: { statusBarStyle: 'dark', statusBarColor: '#0a1628' },
  },
  web: {
    authMode: 'local',
    syncMode: 'device-local',
    themePreset: 'web-default',
  },
};

function mergeConfig(
  base: Omit<AppConfig, 'platform'>,
  override: DeepPartial<AppConfig>,
  platform: AppPlatform,
): AppConfig {
  return {
    ...base,
    ...override,
    platform,
    features: { ...base.features, ...(override.features ?? {}) },
    native: { ...base.native, ...(override.native ?? {}) },
    telegram: { ...base.telegram, ...(override.telegram ?? {}) },
  };
}

/** Итоговый конфиг текущей (или явно переданной) платформы. */
export function getAppConfig(platform: AppPlatform = getAppPlatform()): AppConfig {
  const override = PLATFORM_OVERRIDES[platform] ?? {};
  const cfg = mergeConfig(BASE_CONFIG, override, platform);
  // Отладочное dev-меню — только по явному флагу сборки, никогда в проде по умолчанию.
  try {
    if (
      (import.meta as unknown as { env?: Record<string, string> })?.env
        ?.VITE_APP_DEV_MENU === '1'
    ) {
      cfg.features.devMenu = true;
    }
  } catch {
    /* ignore */
  }
  return cfg;
}

/**
 * Выбор реализации под платформу без if'ов по всему коду.
 * Приоритет: точное совпадение → default → первый переданный.
 */
export function resolvePlatformModule<T>(mods: {
  telegram?: T;
  native?: T;
  web?: T;
  default?: T;
  platform?: AppPlatform;
}): T {
  const p = mods.platform ?? getAppPlatform();
  const exact = mods[p];
  if (exact !== undefined) return exact;
  if (mods.default !== undefined) return mods.default;
  const fallback = mods.telegram ?? mods.native ?? mods.web;
  if (fallback === undefined)
    throw new Error('[app-config] resolvePlatformModule: no module provided');
  return fallback;
}
