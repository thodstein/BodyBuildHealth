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

const KEY = 'he_apk_theme_v1';

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
    return applyApkTheme();
  } catch {
    return '';
  }
}
