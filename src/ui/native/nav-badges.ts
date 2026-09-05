/**
 * nav-badges.ts — живые бейджи нижнего навбара. ТОЛЬКО APK
 * (CSS-точка `[data-badge]` уже в styles-native.css §58.2).
 * Telegram/web data-атрибут не выставляют — визуал Mini App 1-в-1.
 *
 * Сигналы (все синхронные, localStorage, try/catch):
 * - support: критические лекарственные взаимодействия (he_drug_warnings).
 * Точка расширения: добавить таб → посчитать → вернуть строку.
 */

export type NavBadgeMap = Record<string, string>;

function readDrugHighCount(): number {
  try {
    const raw = localStorage.getItem('he_drug_warnings');
    if (!raw) return 0;
    const d = JSON.parse(raw) as { highCount?: unknown };
    const n = typeof d.highCount === 'number' ? d.highCount : 0;
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function fmtCount(n: number): string {
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

/** Бейджи для PRIMARY_NAV. Пустая строка = точки нет (CSS-селектор скрывает). */
export function getNavBadges(): NavBadgeMap {
  try {
    return { support: fmtCount(readDrugHighCount()) };
  } catch {
    return {};
  }
}
