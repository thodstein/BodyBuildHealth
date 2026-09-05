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
export type ApkAccent = '' | 'mint' | 'sky' | 'violet' | 'amber';

export const APK_ACCENTS: { id: ApkAccent; label: string; swatch: string }[] = [
  { id: '', label: 'Лайм', swatch: '#c9f73a' },
  { id: 'mint', label: 'Минт', swatch: '#00e68a' },
  { id: 'sky', label: 'Небо', swatch: '#38bdf8' },
  { id: 'violet', label: 'Фиолет', swatch: '#a78bfa' },
  { id: 'amber', label: 'Янтарь', swatch: '#fbbf24' },
];

const KEY = 'he_apk_theme_v1';
const ACCENT_KEY = 'he_apk_accent_v1';

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
    if (v === 'mint' || v === 'sky' || v === 'violet' || v === 'amber') return v;
  } catch {
    /* ignore */
  }
  return '';
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
 * Вне native — no-op для DOM (возвращает персист).
 */
export function applyApkAccent(accent?: ApkAccent): ApkAccent {
  const next = accent === undefined ? readStoredAccent() : accent;
  try {
    if (!isCapacitorNative()) return next;
    const root = document.documentElement;
    if (next) root.setAttribute('data-apk-accent', next);
    else root.removeAttribute('data-apk-accent');
  } catch {
    /* non-DOM окружение (тесты) */
  }
  return next;
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
