/**
 * appearance.ts — тема оформления APK (dark / amoled / light).
 * ТОЛЬКО native: вне Capacitor WebView все функции — no-op.
 * Telegram Mini App и web не затрагиваются (атрибут data-apk-theme
 * читается исключительно селекторами `html.app-native[...]`).
 *
 * Ключ: he_apk_theme_v1. Дефолт — системная тёмная ('' = без атрибута).
 */

import { isCapacitorNative } from '../../core/app-platform';

export type ApkTheme = '' | 'amoled' | 'light';

/** Акцент: '' = фирменный лайм (дефолт). Слой var-изирован (§58–59). */
export type ApkAccent = '' | 'mint' | 'sky' | 'violet' | 'amber' | 'system';

export const APK_ACCENTS: { id: ApkAccent; label: string; swatch: string }[] = [
  { id: '', label: 'Лайм', swatch: '#c9f73a' },
  { id: 'mint', label: 'Минт', swatch: '#00e68a' },
  { id: 'sky', label: 'Небо', swatch: '#38bdf8' },
  { id: 'violet', label: 'Фиолет', swatch: '#a78bfa' },
  { id: 'amber', label: 'Янтарь', swatch: '#fbbf24' },
  { id: 'system', label: 'Системный', swatch: '#94a3b8' },
];

const KEY = 'he_apk_theme_v1';
const ACCENT_KEY = 'he_apk_accent_v1';
/** Последний удачный системный акцент (для boot-применения без опроса ОС). */
const SYSTEM_HEX_KEY = 'he_apk_system_hex_v1';

function readStored(): ApkTheme {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'amoled' || v === 'light') return v;
  } catch {
    /* ignore */
  }
  return '';
}

/** Текущая тема APK (в TG/web всегда '' — дефолт без визуального эффекта). */
export function getApkTheme(): ApkTheme {
  try {
    return readStored();
  } catch {
    return '';
  }
}

/**
 * Применить тему: ставит/снимает data-apk-theme на <html>.
 * Вне native — no-op (TG-ветка не выполняется вообще).
 */
export function applyApkTheme(theme?: ApkTheme): ApkTheme {
  const next = theme === undefined ? readStored() : theme;
  try {
    if (!isCapacitorNative()) return next;
    const root = document.documentElement;
    if (next) root.setAttribute('data-apk-theme', next);
    else root.removeAttribute('data-apk-theme');
  } catch {
    /* non-DOM окружение (тесты) */
  }
  return next;
}

/** Сохранить выбор пользователя и применить сразу. Вне native — только персист. */
export function setApkTheme(theme: ApkTheme): ApkTheme {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    /* quota/SSR — применяем без персиста */
  }
  return applyApkTheme(theme);
}

/**
 * Вызывать один раз на старте (main.tsx) до первого рендера.
 * В Telegram/web — мгновенный no-op, вёрстка Mini App 1-в-1.
 */
export function initApkAppearance(): ApkTheme {
  try {
    applyApkAccent();
    return applyApkTheme();
  } catch {
    return '';
  }
}

function readStoredAccent(): ApkAccent {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    if (
      v === 'mint' ||
      v === 'sky' ||
      v === 'violet' ||
      v === 'amber' ||
      v === 'system'
    )
      return v;
  } catch {
    /* ignore */
  }
  return '';
}

/** #RRGGBB → 'r, g, b' для rgb-триплетов. null при мусоре. */
export function hexToRgbTriplet(hex: string): string | null {
  try {
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  } catch {
    return null;
  }
}

/** Тёмный или светлый текст поверх акцента (luminance-порог 0.55). */
export function contrastForHex(hex: string): string {
  try {
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return '#0a1a08';
    const n = parseInt(m[1], 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return lum > 0.55 ? '#0b1526' : '#f4f7ff';
  } catch {
    return '#0a1a08';
  }
}

/**
 * Инлайн-переменные системного акцента (бьют любое правило таблицы стилей).
 * Без гейта на native — чистая DOM-операция, вызывается только из native-веток.
 */
export function writeSystemVars(accent: string, accent2: string): boolean {
  try {
    const rgb = hexToRgbTriplet(accent);
    const rgb2 = hexToRgbTriplet(accent2);
    if (!rgb || !rgb2) return false;
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', rgb);
    root.style.setProperty('--accent-2', accent2);
    root.style.setProperty('--accent-2-rgb', rgb2);
    root.style.setProperty('--accent-contrast', contrastForHex(accent));
    return true;
  } catch {
    return false;
  }
}

/** Снять инлайн системного акцента (возврат к таблице стилей). */
export function clearSystemVars(): void {
  try {
    const root = document.documentElement;
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-rgb');
    root.style.removeProperty('--accent-2');
    root.style.removeProperty('--accent-2-rgb');
    root.style.removeProperty('--accent-contrast');
  } catch {
    /* ignore */
  }
}

/** Текущий акцент APK (в TG/web всегда '' — дефолт без визуального эффекта). */
export function getApkAccent(): ApkAccent {
  try {
    return readStoredAccent();
  } catch {
    return '';
  }
}

/**
 * Применить акцент: ставит/снимает data-apk-accent на <html>.
 * 'system' дополнительно кладёт инлайн-переменные из сохранённой палитры
 * (boot без опроса ОС). Вне native — no-op для DOM (возвращает персист).
 */
export function applyApkAccent(accent?: ApkAccent): ApkAccent {
  const next = accent === undefined ? readStoredAccent() : accent;
  try {
    if (!isCapacitorNative()) return next;
    const root = document.documentElement;
    if (next) root.setAttribute('data-apk-accent', next);
    else root.removeAttribute('data-apk-accent');
    if (next === 'system') {
      try {
        const raw = localStorage.getItem(SYSTEM_HEX_KEY);
        if (raw) {
          const [a, a2] = raw.split('|');
          if (a) writeSystemVars(a, a2 || a);
        }
      } catch {
        /* ignore */
      }
    } else {
      clearSystemVars();
    }
  } catch {
    /* non-DOM окружение (тесты) */
  }
  return next;
}

/**
 * Опросить ОС (Material You, Android 12+), сохранить и применить.
 * Возвращает true только при реальном применении. Вне native — false.
 */
export async function applySystemAccentFromDevice(): Promise<boolean> {
  try {
    if (!isCapacitorNative()) return false;
    const { getSystemDynamicColors } = await import('./dynamic-color');
    const sys = await getSystemDynamicColors();
    if (!sys) return false;
    if (!writeSystemVars(sys.accent, sys.accent2)) return false;
    try {
      localStorage.setItem(SYSTEM_HEX_KEY, `${sys.accent}|${sys.accent2}`);
    } catch {
      /* quota — применяем без персиста */
    }
    setApkAccent('system');
    return true;
  } catch {
    return false;
  }
}

/** Сохранить выбор акцента и применить сразу. Вне native — только персист. */
export function setApkAccent(accent: ApkAccent): ApkAccent {
  try {
    if (accent) localStorage.setItem(ACCENT_KEY, accent);
    else localStorage.removeItem(ACCENT_KEY);
  } catch {
    /* quota/SSR — применяем без персиста */
  }
  return applyApkAccent(accent);
}
