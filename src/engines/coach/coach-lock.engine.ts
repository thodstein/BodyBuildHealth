/**
 * coach-lock.engine.ts — PIN на профиль тренера (по желанию) и автовыход.
 *
 * ЗАЧЕМ. В режиме тренера на телефоне лежат данные нескольких людей. PIN — не
 * «безопасность уровня банка», а защита от «взял телефон посмотреть время».
 * Поэтому:
 *  • PIN включается ТОЛЬКО по желанию и выключается тем же PIN-ом;
 *  • хранится не PIN, а медленный хэш (PBKDF2-SHA256, 100 000 итераций, своя соль);
 *  • если WebView не умеет WebCrypto (старые Android), честно записываем
 *    алгоритм `fnv1a` — он слабее, и UI обязан это сказать, а не делать вид,
 *    что защита та же;
 *  • автовыход — по бездействию, от 1 до 240 минут или «выкл» (0). Это
 *    настройка устройства, а не данных атлета;
 *  • ключ `he_coach_lock` устройственный: при входе в данные атлета PIN не
 *    слетает и не копируется в чужое пространство.
 *
 * ЧЕСТНАЯ ГРАНИЦА: PIN защищает экран, а не шифрует базу. Кто имеет доступ к
 * файлам приложения на устройстве, тот технически может их прочитать; об этом
 * сказано в интерфейсе, а не «всё зашифровано».
 */
export const COACH_LOCK_KEY = 'he_coach_lock';
export const COACH_UNLOCK_KEY = 'he_coach_unlocked_at';
export const COACH_PIN_MIN = 4;
export const COACH_PIN_MAX = 8;
export const COACH_LOCK_MAX_MIN = 240;

export type CoachPinAlgo = 'pbkdf2-sha256' | 'sha256' | 'fnv1a';

export interface CoachLockSettings {
  version: 1;
  enabled: boolean;
  algo: CoachPinAlgo;
  salt: string;
  hash: string;
  /** 0 — без автовыхода. */
  autoLockMin: number;
  updatedAt: string;
}

export type CoachPinError = 'short' | 'long' | 'nondigit' | 'weak-storage' | null;

export function emptyCoachLock(): CoachLockSettings {
  return { version: 1, enabled: false, algo: pinAlgoAvailable(), salt: '', hash: '', autoLockMin: 15, updatedAt: '' };
}

/** Какой алгоритм реально доступен на этом движке. */
export function pinAlgoAvailable(): CoachPinAlgo {
  try {
    return typeof globalThis.crypto?.subtle?.importKey === 'function' ? 'pbkdf2-sha256' : 'fnv1a';
  } catch {
    return 'fnv1a';
  }
}

export function pinPolicyError(pin: string): CoachPinError {
  if (!/^\d+$/.test(pin)) return 'nondigit';
  if (pin.length < COACH_PIN_MIN) return 'short';
  if (pin.length > COACH_PIN_MAX) return 'long';
  return null;
}

export function pinPolicyErrorText(error: CoachPinError): string {
  switch (error) {
    case 'short':
      return `PIN короче ${COACH_PIN_MIN} цифр — такой подбирается слишком легко.`;
    case 'long':
      return `PIN длиннее ${COACH_PIN_MAX} цифр — запомнить сложно, а защита та же.`;
    case 'nondigit':
      return 'PIN — только цифры: на телефоне его набирают цифровой клавиатурой.';
    case 'weak-storage':
      return 'На этом устройстве нет WebCrypto — PIN будет защищать только от случайного взгляда.';
    default:
      return '';
  }
}

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

function randomSalt(): string {
  try {
    const arr = new Uint8Array(16);
    globalThis.crypto.getRandomValues(arr);
    return hex(arr);
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Запасной вариант для движков без WebCrypto: честно слабый, но не «никакой». */
function fnv1a(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (c + i), 0x85ebca6b) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(2);
}

/** Хэш PIN-а для конкретного алгоритма. */
export async function hashPin(pin: string, salt: string, algo: CoachPinAlgo = pinAlgoAvailable()): Promise<string> {
  const data = `${salt}:${pin}`;
  try {
    if (algo === 'pbkdf2-sha256' && globalThis.crypto?.subtle) {
      const enc = new TextEncoder();
      const keyMaterial = await globalThis.crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
        'deriveBits',
      ]);
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100_000, hash: 'SHA-256' },
        keyMaterial,
        256,
      );
      return `pbkdf2$${hex(new Uint8Array(bits))}`;
    }
    if (algo === 'sha256' && globalThis.crypto?.subtle) {
      const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
      return `sha256$${hex(new Uint8Array(digest))}`;
    }
  } catch {
    /* падаем в запасной вариант ниже */
  }
  return `fnv1a$${fnv1a(data)}`;
}

/** Сравнение без раннего выхода по длине (не даём отличить «почти угадал»). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createCoachLock(
  pin: string,
  opts: { autoLockMin?: number; now?: string; salt?: string } = {},
): Promise<{ settings: CoachLockSettings | null; error: CoachPinError }> {
  const policy = pinPolicyError(pin);
  if (policy) return { settings: null, error: policy };
  const algo = pinAlgoAvailable();
  const salt = opts.salt ?? randomSalt();
  const hash = await hashPin(pin, salt, algo);
  return {
    settings: {
      version: 1,
      enabled: true,
      algo,
      salt,
      hash,
      autoLockMin: clampAutoLock(opts.autoLockMin ?? 15),
      updatedAt: opts.now ?? new Date().toISOString(),
    },
    error: null,
  };
}

export async function verifyCoachPin(settings: CoachLockSettings, pin: string): Promise<boolean> {
  if (!settings.enabled || !settings.hash) return false;
  if (pinPolicyError(pin)) return false;
  const hash = await hashPin(pin, settings.salt, settings.algo);
  return safeEqual(hash, settings.hash);
}

export function clampAutoLock(min: number): number {
  const n = Number.isFinite(min) ? Math.trunc(min) : 15;
  if (n <= 0) return 0;
  return Math.min(COACH_LOCK_MAX_MIN, Math.max(1, n));
}

export function disableCoachLock(settings: CoachLockSettings, opts: { now?: string } = {}): CoachLockSettings {
  return {
    ...settings,
    enabled: false,
    hash: '',
    salt: '',
    updatedAt: opts.now ?? new Date().toISOString(),
  };
}

export function parseCoachLock(raw: string | null | undefined): CoachLockSettings {
  if (!raw) return emptyCoachLock();
  try {
    const parsed = JSON.parse(raw) as Partial<CoachLockSettings> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return emptyCoachLock();
    const algo: CoachPinAlgo =
      parsed.algo === 'pbkdf2-sha256' || parsed.algo === 'sha256' || parsed.algo === 'fnv1a'
        ? parsed.algo
        : pinAlgoAvailable();
    const enabled = parsed.enabled === true && typeof parsed.hash === 'string' && !!parsed.hash;
    return {
      version: 1,
      enabled,
      algo,
      salt: typeof parsed.salt === 'string' ? parsed.salt : '',
      hash: enabled ? String(parsed.hash) : '',
      autoLockMin: clampAutoLock(typeof parsed.autoLockMin === 'number' ? parsed.autoLockMin : 15),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return emptyCoachLock();
  }
}

export function readCoachLock(storage: { getItem?: (k: string) => string | null } | null | undefined): CoachLockSettings {
  if (!storage || typeof storage.getItem !== 'function') return emptyCoachLock();
  try {
    return parseCoachLock(storage.getItem(COACH_LOCK_KEY));
  } catch {
    return emptyCoachLock();
  }
}

export function writeCoachLock(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  settings: CoachLockSettings,
): CoachLockSettings {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_LOCK_KEY, JSON.stringify(settings));
    } catch {
      /* настройка не важнее данных */
    }
  }
  return settings;
}

/* ------------------------------------------------------------------ */
/* Сессия: когда профиль разблокирован                                 */
/* ------------------------------------------------------------------ */

export function readUnlockedAt(storage: { getItem?: (k: string) => string | null } | null | undefined): string | null {
  if (!storage || typeof storage.getItem !== 'function') return null;
  try {
    return storage.getItem(COACH_UNLOCK_KEY);
  } catch {
    return null;
  }
}

export function writeUnlockedAt(
  storage: { setItem?: (k: string, v: string) => void; removeItem?: (k: string) => void } | null | undefined,
  at: string | null,
): void {
  if (!storage) return;
  try {
    if (at) storage.setItem?.(COACH_UNLOCK_KEY, at);
    else storage.removeItem?.(COACH_UNLOCK_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Разблокировано ли сейчас. `nowMs` — текущее время (мс).
 * Без PIN — всегда true. С PIN — только если была разблокировка и не истёк
 * автовыход.
 */
export function isCoachUnlocked(
  settings: CoachLockSettings,
  unlockedAt: string | null,
  nowMs: number,
): boolean {
  if (!settings.enabled) return true;
  if (!unlockedAt) return false;
  const at = Date.parse(unlockedAt);
  if (!Number.isFinite(at)) return false;
  if (settings.autoLockMin <= 0) return true;
  return nowMs - at <= settings.autoLockMin * 60_000;
}
